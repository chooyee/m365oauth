require('dotenv').config()
const express = require("express");
const session = require('express-session');
const router = express.Router();
const axios = require('axios'); // <-- Import axios
const msal = require('@azure/msal-node');

const REDIRECT_URI = process.env.REDIRECT_URI;
const POST_LOGOUT_REDIRECT_URI = process.env.POST_LOGOUT_REDIRECT_URI;
const GRAPH_SCOPES = process.env.GRAPH_SCOPES.split(' ');


// --- MSAL Configuration ---
const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    },
    system: {
        loggerOptions: { // Optional logging
            loggerCallback(loglevel, message, containsPii) {
                // console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Info, // Adjust as needed (Verbose, Warning, Error)
        }
    }
    // --- Token Cache (Optional but recommended for production) ---
    // cache: {
    //    cachePlugin: getCachePlugin() // Implement your own cache plugin (e.g., using Redis, DB)
    // }
};

// Create an MSAL Confidential Client Application instance
const msalClient = new msal.ConfidentialClientApplication(msalConfig);

router.get("/ping", (req, res) => {
    res.status(200).send("pong");
});

router.get("/", (req, res) => {
    const hostname =
      process.env.ENVIRONMENT === "dev"
        ? `${req.protocol}://${req.header("host")}`
        : `${req.protocol}://${req.hostname}`;
        
    res.render("login");
  });

// === Login ===
router.get('/login', (req, res) => {
    //console.log(`Session = ${req.session.refreshToken}`);
    const authCodeUrlParameters = {
        scopes: GRAPH_SCOPES, // Include offline_access for refresh token
        redirectUri: REDIRECT_URI,
        prompt: "select_account" // Force user to select account each time (optional)
    };

    // Get url to sign user in and consent to scopes needed for application
    msalClient.getAuthCodeUrl(authCodeUrlParameters)
        .then((authCodeUrl) => {
            console.log("Redirecting to MS Auth:", authCodeUrl);
            res.redirect(authCodeUrl);
        })
        .catch((error) => {
            console.error("Error getting Auth Code URL:", error);
            res.status(500).send('Error initiating login');
        });
});

// === Callback ===
// This is the Redirect URI configured in Azure AD
router.get('/auth/callback', (req, res) => {
    // Check for errors from Microsoft (e.g., user denied consent)
    if (req.query.error) {
        console.error("Callback error:", req.query.error, req.query.error_description);
        return res.status(400).send(`Error: ${req.query.error} - ${req.query.error_description}`);
    }

    const tokenRequest = {
        code: req.query.code, // The authorization code received from Microsoft
        scopes: GRAPH_SCOPES,
        redirectUri: REDIRECT_URI,
    };

    // Exchange the authorization code for tokens
    msalClient.acquireTokenByCode(tokenRequest)
        .then((response) => {
            console.log(response);
            console.log("\nTokens acquired successfully:");
            console.log("Access Token:", response.accessToken);
            console.log("Refresh Token:", response.refreshToken);
            const refreshToken = response.refreshToken;

            if (refreshToken) {              
                console.log("Refresh Token received (manual access).");

                try {
                    req.session.refreshToken = refreshToken; // Store refresh token in session (or secure storage)
                    // Placeholder for secure storage logic (e.g., database, encrypted file)
                    console.log(`Placeholder: Would securely store refresh token for account ${response.account.homeAccountId}`);
                } catch (storageError) {
                    console.error("FATAL: Failed to securely store refresh token!", storageError);
                    // Handle this critical error appropriately - perhaps invalidate the session
                    // and redirect to an error page, as the user might not have offline access later.
                    // Do not proceed as if everything is normal if storage fails.
                    return res.status(500).send('Critical error storing authentication token.');
                }

            } else {
                // This might happen if 'offline_access' wasn't requested or granted,
                // or due to specific tenant policies.
                console.warn("Refresh Token was NOT received in the response.");
            }
            // --- Store token data in session ---
            req.session.isAuthenticated = true;
            req.session.account = response.account;
            req.session.homeAccountId = response.account.homeAccountId;

            res.redirect('/');
        })
        .catch((error) => {
            console.error("Error acquiring token by code:", error.response?.data || error.message);
            res.status(500).send('Error acquiring token');
        });
});

// === Logout ===
router.get('/logout', (req, res) => {
    if (req.session.isAuthenticated) {
        const logoutUri = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(POST_LOGOUT_REDIRECT_URI)}`;

        // Clear MSAL cache for the specific account (if using cache)
        if (req.session.homeAccountId) {
             msalClient.getTokenCache().getAccountByHomeId(req.session.homeAccountId)
                 .then(account => {
                      if(account) {
                           msalClient.getTokenCache().removeAccount(account)
                                .then(() => console.log("Account removed from MSAL cache."))
                                .catch(e => console.error("Error removing account from MSAL cache", e));
                      }
                 })
                 .catch(e => console.error("Error finding account in MSAL cache for logout", e));
        }

        // Destroy the local session
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
                return res.status(500).send('Could not log out.');
            }
            console.log("Redirecting to MS Logout:", logoutUri);
            res.redirect(logoutUri);
        });
    } else {
        res.redirect('/');
    }
});

// === Example API Call: Get Emails (Using Axios) === <--- MODIFIED SECTION
router.get('/get-emails', async (req, res) => {
    if (!req.session.isAuthenticated || !req.session.homeAccountId) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    const account = await msalClient.getTokenCache().getAccountByHomeId(req.session.homeAccountId);
    if (!account) {
        console.warn("Account not found in cache for silent token request. Redirecting to login.");
        return res.redirect('/login');
    }

    const silentRequest = {
        account: account,
        scopes: GRAPH_SCOPES, // Ensure GRAPH_SCOPES is defined correctly from .env
    };

    let accessToken = null;

    try {
        // Attempt to acquire token silently using the cache/refresh token
        const tokenResponse = await msalClient.acquireTokenSilent(silentRequest);
        console.log("Token acquired silently for API call.");
        accessToken = tokenResponse.accessToken;

    } catch (error) {
        if (error instanceof msal.InteractionRequiredAuthError) {
            console.warn('Silent token acquisition failed (Interaction Required):', error.message);
            return res.redirect('/login'); // Force re-authentication
        } else {
            console.error("Error acquiring token silently:", error);
            return res.status(500).send('Error acquiring token for API call.');
        }
    }

    // --- Make the Graph API Call using Axios ---
    if (accessToken) {
        const graphEndpoint = "https://graph.microsoft.com/v1.0/me/messages?$top=10"; // Get top 10 emails
        console.log("Calling Graph API with Axios:", graphEndpoint);

        try {
            // Use axios.get instead of fetch
            const response = await axios.get(graphEndpoint, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            // Axios successful response data is in response.data
            const data = response.data;
            console.log("Emails received from Graph API via Axios.");

            // Display emails (simple example)
            let html = '<h1>Your Top 10 Emails (via Axios)</h1>';
            if (data.value && data.value.length > 0) {
                html += '<ul>';
                data.value.forEach(email => {
                    html += `<li>Subject: ${email.subject} (From: ${email.from?.emailAddress?.name || 'N/A'})</li>`;
                });
                html += '</ul>';
            } else {
                html += '<p>No emails found.</p>';
            }

            html += '<br><a href="/">Back Home</a>';
            res.send(html);

        } catch (error) {
            // Axios error handling
            console.error("Error calling Microsoft Graph API with Axios:");
            if (error.response) {
                console.error("Status:", error.response.status);
                console.error("Headers:", error.response.headers);
                console.error("Data:", error.response.data);
                res.status(error.response.status).send(`Graph API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                console.error("Request Error:", error.request);
                res.status(500).send('Error fetching emails: No response received from Graph API.');
            } else {
                console.error('Axios Config Error:', error.message);
                res.status(500).send(`Error fetching emails: ${error.message}`);
            }
        }
    } else {
        res.status(401).send("Could not acquire access token.");
    }
});
// --- End of MODIFIED SECTION ---

module.exports = router;
