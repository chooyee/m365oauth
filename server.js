// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const crypto = require('crypto'); // For generating state

const app = express();
const port = process.env.PORT || 3000;

// --- Configuration ---
const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
const scopes = process.env.GRAPH_SCOPES;

const authority = `https://login.microsoftonline.com/${tenantId}`;
const authorizeUrl = `${authority}/oauth2/v2.0/authorize`;
const tokenUrl = `${authority}/oauth2/v2.0/token`;
const graphApiEndpoint = 'https://graph.microsoft.com/v1.0/me/messages'; // Example API endpoint

if (!clientId || !clientSecret || !redirectUri || !scopes || !tenantId) {
    console.error("Error: Missing essential environment variables. Check your .env file.");
    process.exit(1);
}

// --- Session Middleware ---
// Needed to store state temporarily and potentially tokens (though DB is better for long term)
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using https
        httpOnly: true,
    }
}));

// --- Routes ---

// 1. Login Route - Redirects user to Microsoft login
app.get('/login', (req, res) => {
    // Generate random state to prevent CSRF
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state; // Store state in session

    const authorizationParams = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: scopes,
        response_mode: 'query', // code will be in query params
        state: state // Include state in the request
    });

    const authorizationRequestUrl = `${authorizeUrl}?${authorizationParams.toString()}`;
    console.log("Redirecting to:", authorizationRequestUrl);
    res.redirect(authorizationRequestUrl);
});

// 2. Callback Route - Handles the response from Microsoft
app.get('/auth/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;

    // Check for errors from Microsoft
    if (error) {
        console.error("Error from Microsoft:", error, error_description);
        return res.status(500).send(`Error during authentication: ${error} - ${error_description}`);
    }

    // Verify state parameter to prevent CSRF
    if (state !== req.session.oauthState) {
        console.error("State mismatch error.");
        return res.status(403).send("State mismatch error. Possible CSRF attack.");
    }
    // Clear state from session after verification
    delete req.session.oauthState;

    if (!code) {
        return res.status(400).send("Authorization code is missing.");
    }

    // 3. Exchange authorization code for tokens
    const tokenRequestParams = new URLSearchParams({
        client_id: clientId,
        scope: scopes, // Scopes should match the initial request
        code: code,
        redirect_uri: redirectUri, // Must exactly match the one used in the auth request and registration
        grant_type: 'authorization_code',
        client_secret: clientSecret,
    });

    try {
        console.log("Requesting tokens from:", tokenUrl);
        const tokenResponse = await axios.post(tokenUrl, tokenRequestParams.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        console.log(tokenResponse.data);
        console.log("Tokens received successfully!");
        // console.log("Access Token:", access_token); // Be careful logging tokens
        // console.log("Refresh Token:", refresh_token); // Be VERY careful logging refresh tokens

        // --- IMPORTANT: Securely Store Tokens ---
        // For long-term offline access, store the refresh_token securely,
        // associated with the user (e.g., in a database).
        // Access token can be stored temporarily (e.g., session or memory cache)
        // or regenerated using the refresh token when needed.
        // DO NOT store tokens in client-side storage (localStorage/sessionStorage).
        req.session.accessToken = access_token;
        req.session.refreshToken = refresh_token; // Storing in session for demo purposes ONLY. Use a DB!
        req.session.tokenExpires = Date.now() + (expires_in * 1000); // Store expiration time

        // Redirect to a protected route or dashboard
        res.redirect('/profile');

    } catch (err) {
        console.error("Error exchanging code for tokens:", err.response ? err.response.data : err.message);
        res.status(500).send(`Error obtaining tokens: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
    }
});

// --- Helper Function to Refresh Token ---
async function refreshAccessToken(refreshToken) {
    const tokenRequestParams = new URLSearchParams({
        client_id: clientId,
        scope: scopes, // Re-specify scopes if needed, or omit if they were granted initially
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_secret: clientSecret,
    });

    try {
        console.log("Attempting to refresh token...");
        const tokenResponse = await axios.post(tokenUrl, tokenRequestParams.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        console.log("Token refreshed successfully!");
        return tokenResponse.data; // Contains new access_token, possibly new refresh_token, expires_in

    } catch (err) {
        console.error("Error refreshing token:", err.response ? err.response.data : err.message);
        // Handle specific errors like invalid_grant (refresh token expired/revoked)
        if (err.response && err.response.data && err.response.data.error === 'invalid_grant') {
             // The refresh token is no longer valid. User needs to re-authenticate.
             throw new Error('RefreshTokenInvalid');
        }
        throw err; // Re-throw other errors
    }
}

// --- Middleware to ensure user is authenticated and token is valid ---
async function ensureAuthenticated(req, res, next) {
    if (!req.session.accessToken || !req.session.refreshToken) {
        console.log("No tokens found in session, redirecting to login.");
        return res.redirect('/login');
    }

    // Check if access token is expired (or close to expiring)
    if (Date.now() >= (req.session.tokenExpires - 60000)) { // Check 60 seconds before expiry
        console.log("Access token expired or nearing expiry, attempting refresh...");
        try {
            const refreshedTokens = await refreshAccessToken(req.session.refreshToken);

            // Store the new tokens
            req.session.accessToken = refreshedTokens.access_token;
            req.session.tokenExpires = Date.now() + (refreshedTokens.expires_in * 1000);

            // IMPORTANT: Microsoft sometimes issues a new refresh token during refresh.
            // Always store the latest one received.
            if (refreshedTokens.refresh_token) {
                req.session.refreshToken = refreshedTokens.refresh_token;
                console.log("New refresh token received and stored.");
                // Persist the new refresh token in your secure database here!
            }
             console.log("Token refresh successful.");

        } catch (err) {
             if (err.message === 'RefreshTokenInvalid') {
                 console.error("Refresh token is invalid. User needs to re-authenticate.");
                 // Clear potentially invalid tokens from session
                 delete req.session.accessToken;
                 delete req.session.refreshToken;
                 delete req.session.tokenExpires;
                 return res.redirect('/login?error=session_expired'); // Redirect to login
             } else {
                 console.error("Failed to refresh token:", err);
                 return res.status(500).send("Failed to refresh authentication token.");
             }
        }
    }
    // If token is valid or successfully refreshed, proceed
    next();
}

// 4. Example Protected Route (e.g., User Profile or Email Access)
app.get('/profile', ensureAuthenticated, async (req, res) => {
    try {
        const userProfileResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': `Bearer ${req.session.accessToken}`
            }
        });
        res.send(`<h1>Welcome <span class="math-inline">\{userProfileResponse\.data\.displayName \|\| userProfileResponse\.data\.userPrincipalName\}</h1\> <pre\></span>{JSON.stringify(userProfileResponse.data, null, 2)}</pre> <a href="/read-email">Read Email</a> | <a href="/logout">Logout</a>`);
    } catch (err) {
        console.error("Error fetching user profile:", err.response ? err.response.data : err.message);
        res.status(500).send(`Error fetching profile: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
    }
});

// Example: Read Email Route
app.get('/read-email', ensureAuthenticated, async (req, res) => {
     try {
        console.log("Fetching emails using Graph API...");
        const emailResponse = await axios.get(graphApiEndpoint, { // Using the example endpoint
            headers: {
                'Authorization': `Bearer ${req.session.accessToken}`
            },
            params: { // Optional: Add query params like $top
                '$top': 5,
                '$select': 'subject,from,receivedDateTime'
            }
        });
        res.send(`<h1>Your latest emails:</h1> <pre>${JSON.stringify(emailResponse.data.value, null, 2)}</pre> <a href="/profile">Back to Profile</a> | <a href="/logout">Logout</a>`);
    } catch (err) {
        console.error("Error fetching emails:", err.response ? err.response.data : err.message);
        res.status(500).send(`Error fetching emails: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
    }
});


// 5. Logout Route
app.get('/logout', (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return next(err);
        }
        // Optional: Redirect to Microsoft's logout endpoint for single sign-out
        // const logoutUrl = `<span class="math-inline">\{authority\}/oauth2/v2\.0/logout?post\_logout\_redirect\_uri\=</span>{encodeURIComponent('http://localhost:3000')}`;
        // res.redirect(logoutUrl);
        res.redirect('/'); // Redirect to home page after local logout
    });
});

// Home Route
app.get('/', (req, res) => {
    if (req.session.accessToken) {
        res.send('<h1>Welcome Back!</h1><p>You are logged in.</p><a href="/profile">View Profile</a> | <a href="/read-email">Read Email</a> | <a href="/logout">Logout</a>');
    } else {
        res.send('<h1>Node.js Outlook OAuth Demo (No MSAL)</h1><a href="/login">Login with Microsoft</a>');
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`Visit http://localhost:${port}/login to start the authentication flow.`);
});