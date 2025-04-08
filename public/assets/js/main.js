window.addEventListener('load', function() {
	document.querySelector('.app-wrapper').removeAttribute("style");
	document.querySelector('#lair').removeAttribute("style");
	document.querySelector('.loading-container').classList.add('hide');
});

// Constants and DOM Elements
const DOM = {
	userPromptDiv: document.getElementById('user-prompt-div'),
	userPromptTxt: document.getElementById('user-prompt-textarea'),
	fileInput: document.getElementById('fileInput'),
	sendMsgButton: document.getElementById('btnSend'),
	chatAreaDiv: document.getElementById('chat-area'),
	chatHistoryUl: document.getElementById('chat-history'),
	pillContainer: document.getElementById('pillContainer'),
	progressContainer: document.getElementById('progressContainer'),
	progressBar: document.getElementById('progressBar'),
	fileInfo: document.getElementById('fileInfo'),
	// bar: new ProgressBar.Path('#heart-path', {
	// 	easing: 'easeInOut',
	// 	duration: 1400
	//   }),
	// progressInterval:""
};

const CONFIG = {
	userImage: 'assets/images/user-icon2.png',
	//userImage: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">	<circle cx="12" cy="12" r="10" fill="#eee" />  <!-- Circle background -->	<path d="M12 14c1.66 0 2-1.34 2-2s-.34-2-2-2-2 1.34-2 2 .34 2 2 2zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" fill="#333"/>  <!-- User shape -->  </svg>',
	gptImage: 'assets/images/chatgpt-icon.png'
};

// State Management
const state = {
	//anonuserid: "",
	chatTopicId: "",
	progress: 0,
	interval: '',
	expanded: false
};

// Utility Functions
const utils = {
	createElement(elementType, attrs = {}) {
		const el = document.createElement(elementType);
		return this.appendAttr(el, attrs);
	},

	appendAttr(el, attrs = {}) {
		for (const [k, v] of Object.entries(attrs)) {
			el.setAttribute(k, v);
		}
		return el;
	},

	createSVGElement(type, attributes = {}) {
		const elem = document.createElementNS("http://www.w3.org/2000/svg", type);
		for (const [key, value] of Object.entries(attributes)) {
			elem.setAttribute(key, value);
		}
		return elem;
	},

	formatFileSize(bytes) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	},

	scrollToBottom() {
		DOM.chatAreaDiv.scrollTo({
			top: DOM.chatAreaDiv.scrollHeight,
			behavior: 'smooth'
		});
	},

	disableElement(ele) {
		ele.setAttribute('disabled', true);
	},

	enableElement(ele) {
		ele.setAttribute('disabled', false);

	},
	getFileExtension(filename) {
		const extensionIndex = filename.lastIndexOf('.');
		return extensionIndex !== -1 ? filename.substring(extensionIndex + 1) : '';
	}
	  

	// showChatProgress(){
	// 	document.getElementById('chat-progress').classList.remove('hide');
	// 	DOM.progressInterval = setInterval(()=>{
	// 		DOM.bar.set(0);
	// 		DOM.bar.animate(1.0);
	// 	},1000)  // Number from 0.0 to 1.0
	// },

	// hideChatProgress(){
	// 	clearInterval(DOM.progressInterval);
	// 	document.getElementById('chat-progress').classList.add('hide');
	// }
};

const ApiService = {
	async chat(formData) {
		try {
			const response = await fetch('/api/v1/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			if (!response.ok) {
				const errorMsg = await response.json();
				throw new Error(`HTTP error! status: ${response.status} : ${JSON.stringify(errorMsg)}`);
			}

			return await response.json();
		}
		catch (error) {
			console.error("Error sending chat:" + JSON.stringify(formData), error);
			throw error;
		}
	},

	async createNewChatTopic(userPrompt) {
		try {

			const response = await fetch('/api/v1/topic/new', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ sentence: userPrompt })
			});

			if (!response.ok) {
				const errorMsg = await response.json();
				throw new Error(`HTTP error! status: ${response.status} : ${JSON.stringify(errorMsg)}`);
			}

			return await response.json();
		} catch (error) {
			throw error;
		}
	},

	async getChatHistory(topicId) {
		try {
			const response = await fetch(`api/v1/topic/${topicId}`);
			if (!response.ok) {
				const errorMsg = await response.json();
				throw new Error(`HTTP error! status: ${response.status} : ${JSON.stringify(errorMsg)}`);
			}
			return await response.json();
		} catch (error) {
			console.error("Error fetching chat history:", error);
			throw error;
		}
	},

	async uploadFile(file) {
		const formData = new FormData();
		formData.append('file', file);
		try {

			const response = await fetch('/api/v1/docs/upload', {
				method: 'POST',
				body: formData,
			});
			if (!response.ok) {
				// Throw an error if the response status is not OK
				const errorMsg = await response.json();
				throw new Error(`HTTP error! status: ${response.status} : ${JSON.stringify(errorMsg)}`);
			}
			return await response.json();
		} catch (error) {
			console.error("Error uploading file:", error);
			throw error;
		}
	},

	async deleteDocs(itemsToDelete) {
		try {
			const myHeaders = new Headers();
			myHeaders.append("Content-Type", "application/json");

			formData = {};
			formData.items = itemsToDelete;

			const response = await fetch('/api/v1/docs/', {
				method: 'DELETE',
				headers: myHeaders,
				body: JSON.stringify(formData)
			});

			if (!response.ok) {
				// Throw an error if the response status is not OK
				const errorMsg = await response.json();
				throw new Error(`HTTP error! status: ${response.status} : ${JSON.stringify(errorMsg)}`);
			}
			return await response.json();
		}
		catch (error) {
			console.error("Error delete documents:", error);
			throw error;
		}
	},

	async getAllDocs() {
		try {
			const response = await fetch('api/v1/docs', {
				method: 'GET'
			});
			if (!response.ok) {
				// Throw an error if the response status is not OK
				const errorMsg = await response.json();
				throw new Error(`HTTP error! status: ${response.status} : ${JSON.stringify(errorMsg)}`);
			}
			return await response.json();
		}
		catch (error) {
			console.error("Error get documents:", error);
			throw error;
		}
	},

	async getChatTopics() {
		try {
			const response = await fetch('api/v1/topic', { method: 'GET' })
			if (!response.ok) {
				// Throw an error if the response status is not OK
				const errorMsg = await response.json();
				throw new Error(`HTTP error! status: ${response.status} : ${JSON.stringify(errorMsg)}`);
			}
			return await response.json();
		}
		catch (error) {
			console.error("Error getChatTopics:", error);
		}
	},
	async deleteChatTopics(topicid) {

		try {
			const response = await fetch(`api/v1/topic/${topicid}`, { method: 'DELETE' })
			if (!response.ok) {
				// Throw an error if the response status is not OK
				const errorMsg = await response.json();
				throw new Error(`HTTP error! status: ${response.status} : ${JSON.stringify(errorMsg)}`);
			}
			return await response.json();
		}
		catch (error) {
			console.error("Error deleteChatTopics:", error);
		}
	},
	async updateChatTopics(topicid, newTopic) {

		try {
			const response = await fetch(`api/v1/topic/${topicid}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ newTopic: newTopic })
			});

			if (!response.ok) {
				// Throw an error if the response status is not OK
				const errorMsg = await response.json();
				throw new Error(`HTTP error! status: ${response.status} : ${JSON.stringify(errorMsg)}`);
			}
			return await response.json();
		}
		catch (error) {
			console.error("Error deleteChatTopics:", error);
		}
	}
};

const UI = {
	createChatTopicLink(id, topic) {
		const nav = utils.createElement('li', { 'class': 'nav-item' });
		const alink = utils.createElement('a', { 'class': 'nav-link text-white topic-nav', 'href': '#', 'data-id': id });
		const p = utils.createElement('p'); 
		p.innerHTML = topic;
		alink.appendChild(p);
		nav.appendChild(alink);

		alink.appendChild(UI.createMeatballMenu(id));
		return nav;
	},

	createChatBox(chatType, text) {	
		const md = window.markdownit('commonmark');
		//const result = md.render('# markdown-it rulezz!');
		chat = utils.createElement('div', { "class": "chat-txt" });
		chat.innerHTML =  md.render(text);

		//imgSrc = chatType == 'user' ? CONFIG.userImage : CONFIG.gptImage;

		//img = utils.createElement('img', { "class": "chatgpt-icon", "src": imgSrc, "ref": "img" });
		//chaticon = utils.createElement('div', { "class": "chat-icon" });
		chatbox = utils.createElement('div', { "class": "row user-chat-box" });
		if (chatType=='user') 
		{
			chat.classList.add('chatuserprompt');
		};
		//chaticon.appendChild(img)
		//chatbox.appendChild(chaticon);
		chatbox.appendChild(chat);
		return chatbox;

	},

	toggleCheckboxes() {
		const checkboxes = document.getElementById("checkboxes");
		if (!state.expanded) {
			checkboxes.style.display = "block";
			state.expanded = true;
		} else {
			checkboxes.style.display = "none";
			state.expanded = false;
		}
	},

	createPill(value, label) {
		return `
            <div class="custom-pill" data-value="${value}">
                <span>${label}</span>
                <button class="remove-pill" onclick="UI.removePill('${value}')">×</button>
            </div>
        `;
	},

	removePill(value) {
		// Uncheck the corresponding checkbox
		const checkbox = document.querySelector(`input[type="checkbox"][value="${value}"]`);
		console.log(checkbox)
		console.log(value)
		if (checkbox) {
			checkbox.checked = false;
		}
		UI.updateSelectedItems();
	},

	updateSelectedItems() {
		const checkboxes = document.querySelectorAll('#checkboxes input[type="checkbox"]');

		// const selected = Array.from(checkboxes)
		// 	.filter(cb => cb.checked)
		// 	.map(cb => ({
		// 		value: cb.dataset.filename,
		// 		label: cb.parentElement.textContent.trim()
		// 	}));

		const selected = Array.from(checkboxes)
			.filter(cb => cb.checked)
			.map(cb => (
					UI.createPill(cb.dataset.filename, cb.parentElement.textContent.trim())					
			))
			.join('');
			
		DOM.pillContainer.innerHTML = selected;
		document.getElementById('selectedItems').classList.remove('hide');

		// const chatdoc = document.getElementById('chatdoccontainer');
		// const xxx = Array.from(checkboxes).filter(cb => cb.checked)
		// .map(cb => ({
		// 		value: cb.dataset.filename,
		// 		label: cb.parentElement.textContent.trim()
		// }));
		// console.log(xxx)
		// Array.from(checkboxes).filter(cb => cb.checked)
		// 	.map(cb=>{
		// 		const filename = cb.parentElement.textContent.trim();
		// 		console.log(filename)
		// 		const ext = utils.getFileExtension(filename);
		// 		console.log(ext);
		// 		if (ext=='mp4')
		// 		{
		// 			chatdoc.innerHTML = ` <div>
		// 			<i class="timeline-icon bi bi-envelope text-bg-primary"></i>
		// 			<div class="timeline-item"> 
		// 				<span class="time"> <i class="bi bi-clock-fill"></i> 12:05
		// 				</span>
		// 				<h3 class="timeline-header"> <a href="#">Support Team</a> sent you an email
		// 				</h3>
		// 				<div class="timeline-body">
		// 					<video width="320" height="240" controls>
		// 					<source src="uploads/${filename}" type="video/mp4">
		// 					Your browser does not support the video tag.
		// 					</video>
		// 				</div>
		// 				<div class="timeline-footer"> <a class="btn btn-primary btn-sm">Read more</a> <a class="btn btn-danger btn-sm">Delete</a> </div>
		// 			</div>
		// 			</div>`;
		// 			console.log(chatdoc.innerHTML);
		// 		}
		// 		else if (ext=='png')
		// 		{
		// 			chatdoc.innerHTML += ` <div><img src="${filename}"></div> `;
		// 		}
		// 		else if (ext=='pdf')
		// 		{
		// 			chatdoc.innerHTML += ` <div><img src="${filename}"></div> `;
		// 		}
		// 	}).join('');

		if (selected.length < 1)
		{
			DOM.pillContainer.innerHTML = '<span class="no-items-text">No items selected</span>';
			document.getElementById('selectedItems').classList.add('hide');
		}

		// if (selected.length) {
		// 	DOM.pillContainer.innerHTML = selected
		// 		.map(item => UI.createPill(item.value, item.label))
		// 		.join('');
		// 	document.getElementById('selectedItems').classList.remove('hide');
		// 	const chatdoc = document.getElementById('chatdoccontainer');
		// 	chatdoc.innerHTML = "";

		// } else {
		// 	DOM.pillContainer.innerHTML = '<span class="no-items-text">No items selected</span>';
		// 	document.getElementById('selectedItems').classList.add('hide');
		// }
	},

	addCheckboxOption(label, docid, fileName, fileUri) {
		const checkboxesContainer = document.getElementById("checkboxes");
		const labelElement = document.createElement("label");
		const checkbox = document.createElement("input");

		checkbox.type = "checkbox";
		checkbox.value = fileName;
		checkbox.className = "form-check-input me-2";
		checkbox.dataset.filename = fileName;
		checkbox.dataset.fileuri = fileUri;
		checkbox.dataset.docid = docid;

		labelElement.appendChild(checkbox);
		labelElement.appendChild(document.createTextNode(label));
		checkboxesContainer.appendChild(labelElement);
	},

	simulateUpload() {
		// Reset progress        
		DOM.progressBar.style.width = '0%';

		// Simulate upload progress
		state.interval = setInterval(() => {
			state.progress += Math.random() * 30;
			if (state.progress > 100) state.progress = 100;

			DOM.progressBar.style.width = `${state.progress}%`;

			if (state.progress === 100) {
				state.progress = 0;
			}
		}, 500);
	},

	createMeatballMenu(topicid) {
		// Create main container
		const menuContainer = utils.createElement('div', {
			class: 'menu-container'
		});

		// Create button element
		const button = utils.createElement('button', {
			'data-topicid': topicid,
			class: 'meatball-menu'
		});

		// Create SVG element
		const svg = utils.createSVGElement('svg', {
			width: '16',
			height: '16',
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'white',
			'stroke-width': '2'
		});

		// Create three circles for the meatball menu
		const circles = [
			{ cy: '12' },
			{ cy: '5' },
			{ cy: '19' }
		].map(attrs => utils.createSVGElement('circle', {
			cx: '12',
			r: '1',
			...attrs
		}));

		circles.forEach(circle => svg.appendChild(circle));
		button.appendChild(svg);
		menuContainer.appendChild(button);

		menuContainer.appendChild(UI.createDropdownMenu(button.dataset.topicid));

		// Add click handler
		// button.onclick = function() {
		//   UI.toggleMenu(this);
		// };
		button.onclick = function (event) {
			EventHandler.meatballClickHandler(this);
		};
		return menuContainer;
	},

	// Create the dropdown menu container
	createDropdownMenu(itemId) {
		const dropdownMenu = utils.createElement('div', { class: 'topic-dropdown-menu' });

		// Create Edit button
		const editButton = utils.createElement('button', {
			class: 'topic-dropdown-item',
			onclick: `EventHandler.editItem(${itemId})`
		});

		// Create edit icon SVG
		const editSvg = utils.createSVGElement('svg', {
			class: 'icon',
			width: '14',
			height: '14',
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '2'
		});

		const editPath1 = utils.createSVGElement('path', {
			d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'
		});

		const editPath2 = utils.createSVGElement('path', {
			d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'
		});

		editSvg.appendChild(editPath1);
		editSvg.appendChild(editPath2);
		editButton.appendChild(editSvg);
		editButton.appendChild(document.createTextNode(' Edit'));

		// Create Delete button
		const deleteButton = utils.createElement('button', {
			class: 'topic-dropdown-item delete',
			onclick: `EventHandler.deleteItem(${itemId})`
		});

		// Create delete icon SVG
		const deleteSvg = utils.createSVGElement('svg', {
			class: 'icon',
			width: '14',
			height: '14',
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '2'
		});

		const deletePolyline = utils.createSVGElement('polyline', {
			points: '3 6 5 6 21 6'
		});

		const deletePath = utils.createSVGElement('path', {
			d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
		});

		deleteSvg.appendChild(deletePolyline);
		deleteSvg.appendChild(deletePath);
		deleteButton.appendChild(deleteSvg);
		deleteButton.appendChild(document.createTextNode(' Delete'));

		// Add buttons to dropdown menu
		dropdownMenu.appendChild(editButton);
		dropdownMenu.appendChild(deleteButton);

		return dropdownMenu;
	},

	resetUploadButton() {
		DOM.progressBar.style.width = `100%`;
		clearInterval(state.interval);
		setTimeout(() => {
			alert('Upload complete!');
			// Reset the form
			DOM.fileInput.value = '';
			DOM.fileInfo.textContent = '';
			DOM.progressContainer.style.display = 'none';
		}, 500);
	},

	startProcessMsg(){
		document.getElementById('icosend').classList.add('hide');
		const icoprocess = document.getElementById('icoprocess');
		icoprocess.classList.add('spinico')
		icoprocess.classList.remove('hide')
		icoprocess.parentElement.setAttribute('disabled', true);
	},

	endProcessMsg(){
		document.getElementById('icosend').classList.remove('hide');
		const icoprocess = document.getElementById('icoprocess');
		icoprocess.classList.remove('spinico')
		icoprocess.classList.add('hide')
		icoprocess.parentElement.removeAttribute('disabled');
	}
}

const EventHandler = {
	meatballClickHandler: function (button) {
		event.stopPropagation();
		const menu = button.nextElementSibling;
		const allMenus = document.querySelectorAll('.topic-dropdown-menu');

		// Close all other menus
		allMenus.forEach(m => {
			if (m !== menu) {
				m.classList.remove('show');
			}
		});

		// Toggle current menu
		menu.classList.toggle('show');
	},

	editItem(id) {
		// Add your edit logic here
		const ahref = document.querySelector(`[data-id="${id}"]`);
		const parent = ahref.parentElement;
		const edit = document.getElementById('edit-wrapper');
		edit.classList.remove('hide');
		const input = edit.querySelector('.edit-input');
		parent.insertBefore(edit, ahref);
		ahref.classList.add('hide');
		input.value = ahref.querySelector('p').textContent;
		input.focus();
		input.select();
		// Close the menu after action
		EventHandler.closeAllMenus();
	},

	cancelEdit() {
		const edit = document.getElementById('edit-wrapper');
		edit.classList.add('hide');
		const parent = edit.parentElement;
		const ahref = parent.querySelector('a');
		ahref.classList.remove('hide');
		document.getElementById('lair').appendChild(edit);
	},

	async saveEdit() {
		const edit = document.getElementById('edit-wrapper');
		edit.classList.add('hide');
		const parent = edit.parentElement;
		const ahref = parent.querySelector('a');
		ahref.classList.remove('hide');
		ahref.querySelector('p').textContent = edit.querySelector('.edit-input').value;
		document.getElementById('lair').appendChild(edit);
		await ApiService.updateChatTopics(ahref.dataset.id, edit.querySelector('.edit-input').value);
	},

	async deleteItem(id) {
		const item = document.querySelector(`[data-id="${id}"]`).closest('li');
		item.remove();
		// Close the menu after action
		EventHandler.closeAllMenus();
		await ApiService.deleteChatTopics(id);
	},

	closeAllMenus() {
		const menus = document.querySelectorAll('.topic-dropdown-menu');
		menus.forEach(menu => menu.classList.remove('show'));
	},

	async handleSendMessage(e) {
		e.preventDefault();
		
		UI.startProcessMsg();

		const selectedDocs = []
		const pills = DOM.pillContainer.querySelectorAll('.custom-pill');
		pills.forEach((e) => {
			selectedDocs.push(e.dataset.value);
		});

		const userPrompt = DOM.userPromptTxt.value;

		DOM.userPromptDiv.innerHTML = '';
		DOM.userPromptTxt.value = '';
		//utils.disableElement(DOM.userPromptTxt);
		DOM.chatAreaDiv.appendChild(UI.createChatBox("user", userPrompt));

		if (state.chatTopicId === '') {			
			newTopicResult = await ApiService.createNewChatTopic(userPrompt);
			state.chatTopicId = newTopicResult["id"];
			const newChatTopicComponent = UI.createChatTopicLink(newTopicResult["id"], newTopicResult["topic"]);
			const ahrefTopic = newChatTopicComponent.querySelectorAll('.topic-nav');
			DOM.chatHistoryUl.prepend(newChatTopicComponent);
			EventHandler.TopicNavEventHandler(ahrefTopic);
		}
		
		utils.scrollToBottom();

		formData = {};
		formData.chattopicid = state.chatTopicId;
		formData.prompt = userPrompt;
		formData.docs = selectedDocs;

		ApiService.chat(formData)
			.then(data => {
				console.log("Successfully get msg: ", data.result);
				DOM.chatAreaDiv.appendChild(UI.createChatBox("gpt", data.result));
				hljs.highlightAll();
				utils.scrollToBottom();
				UI.endProcessMsg();
			})
			.catch(error => {
				DOM.chatAreaDiv.appendChild(UI.createChatBox("gpt", error));
				console.error("Error get response:", error);
				utils.scrollToBottom();
				UI.endProcessMsg();
			});
	},

	handleNewChat() {
		state.chatTopicId = '';
		DOM.userPromptTxt.value = '';
		const nickname = document.getElementById('nickname').value;
		DOM.chatAreaDiv.innerHTML = `		
			<div class="container-fluid mt-4">
				<h2 class="text-center gradient-text">Hello ${nickname}</h2>
			</div>
		`;
		//DOM.chatAreaDiv.innerHTML = '<div class="relative inline-flex justify-center text-center text-2xl font-semibold leading-9"><h1>What can I help with?</h1><h1 class="result-streaming absolute left-full transition-opacity" style="opacity: 0;"><span></span></h1></div>'
	},

	async handleDocItemDelete(e) {
		e.preventDefault();
		const checkboxes = document.querySelectorAll('#checkboxes input[type="checkbox"]');

		const itemsToDelete = Array.from(checkboxes)
			.filter(cb => cb.checked)
			.map(cb => ({
				gemini_name: cb.dataset.filename,
				doc_name: cb.parentElement.textContent.trim()
			}));

		const labelString = "<ol>" + itemsToDelete.map(item => `<li>${item.doc_name}</li>`).join('') + "</ol>";

		const isConfirmed = await EventHandler.customConfirm(`Are you sure you want to proceed to delete files below? <br>${labelString} `);
		if (!isConfirmed) return;

		ApiService.deleteDocs(itemsToDelete)
			.then(data => {
				console.log("Successfully get msg: ", data);
				alert('Document(s) deleted successfully!')
				getAllDocs();
				UI.updateSelectedItems();
			})
			.catch(error => {
				console.error("Error get response:", error);
				alert("Error get response:" + error);
				getAllDocs();
				UI.updateSelectedItems();
			});
	},

	customConfirm(message) {
		const modal = document.getElementById("modal");
		const messageElement = document.getElementById("modal-message");
		const confirmBtn = document.getElementById("confirm-btn");
		const cancelBtn = document.getElementById("cancel-btn");

		messageElement.innerHTML = message;
		modal.style.display = "block";

		return new Promise(resolve => {
			confirmBtn.addEventListener("click", () => {
				modal.style.display = "none";
				resolve(true);
			});

			cancelBtn.addEventListener("click", () => {
				modal.style.display = "none";
				resolve(false);
			});
		});
	},

	handleFileinputChange(e) {
		const file = e.target.files[0];
		if (!file) return;

		// Display file info
		DOM.fileInfo.textContent = `Selected file: ${file.name} (${utils.formatFileSize(file.size)})`;

		// Show progress container
		DOM.progressContainer.style.display = 'block';

		// Simulate file upload
		UI.simulateUpload();
		EventHandler.uploadFileHandler(file);
	},

	// Topic click event handler
	TopicNavEventHandler(topicLinks){
		// topicLinks = document.getElementsByClassName('topic-nav');
		Array.from(topicLinks).forEach(element => {
			// Add click event listener to each element
			//console.log(element)
			element.addEventListener('click', function (e) {
				e.preventDefault();
				//console.log(this.dataset.id);
				state.chatTopicId = this.dataset.id;
				EventHandler.chatHistoryHandler(this.dataset.id);
			});
		});
	},

	//Get chat history by topic
	chatHistoryHandler (topicId) {
		DOM.chatAreaDiv.innerHTML = '';
		ApiService.getChatHistory(topicId)
		.then(data => {
			data.forEach(e => {
				DOM.chatAreaDiv.appendChild(UI.createChatBox("user", e.userprompt));
				DOM.chatAreaDiv.appendChild(UI.createChatBox("gpt", e.gptanswer));
				hljs.highlightAll();
			});
			//console.log("Get chat history successfully", data);
		})
		.catch(error => {
			alertEl = utils.createElement('div', { 'class': 'alert alert-danger', 'role': 'alert' });
			alertEl.innerHTML = error;
			DOM.chatHistoryUl.appendChild(alertEl);
			console.error("Error get generateChatHistoryList response:", error);
		});
	},

	// Post file to API
	uploadFileHandler(file) {
		ApiService.uploadFile(file)
		.then(data => {
			getAllDocs();
			console.log("File uploaded successfully!", data);
			UI.resetUploadButton();
		})
		.catch(error => {
			console.error("Error uploading file:", error);
			UI.resetUploadButton();
		});
	},
}

function getAllDocs() {
	const checkboxesContainer = document.getElementById("checkboxes");
	checkboxesContainer.innerHTML = '';

	ApiService.getAllDocs().then(data => {
		console.log(data)
		data.forEach(e => {
			UI.addCheckboxOption(e["doc_name"], e["document_id"], e["file_name"], e['file_uri']);
		});
		initializeEventListeners();
		console.log("Get document list successfully", data);
	})
		.catch(error => {
			console.error("Error get doc list:", error);
		});

}

function initializeEventListeners() {
	document.addEventListener('click', function (e) {
		const multiselect = document.querySelector('.multiselect');
		if (!multiselect.contains(e.target)) {
			document.getElementById("checkboxes").style.display = "none";
			state.expanded = false;
		}
	});

	const checkboxes = document.querySelectorAll('#checkboxes input[type="checkbox"]');
	checkboxes.forEach(checkbox => {
		checkbox.addEventListener('change', UI.updateSelectedItems);
	});
}

//Generate Chat Topic List
generateChatTopicList = () => {
	DOM.chatHistoryUl.innerHTML = '';
	const liHeader= utils.createElement('li', {'class':"nav-header"});
	liHeader.innerHTML = 'Recent chat'
	DOM.chatHistoryUl.appendChild(liHeader); 
	ApiService.getChatTopics().then(data => {
		data.forEach(e => {
			DOM.chatHistoryUl.appendChild(UI.createChatTopicLink(e.id, e.topic));
		});

		const topics = DOM.chatHistoryUl.querySelectorAll('.topic-nav');
		
		EventHandler.TopicNavEventHandler(topics);
		//console.log("Get topic list successfully", data);
	})
		.catch(error => {
			alertEl = utils.createElement('div', { 'class': 'alert alert-danger', 'role': 'alert' });
			alertEl.innerHTML = error;
			DOM.chatHistoryUl.appendChild(alertEl);
			console.error("Error get generateChatHistoryList response:", error);
		});
}

function initializeApp() {
	EventHandler.handleNewChat();
	//DOM.usernameTxt.value = state.anonuserid;
	DOM.pillContainer.innerHTML = '<span class="no-items-text">No items selected</span>';
	DOM.sendMsgButton.addEventListener('click', EventHandler.handleSendMessage);
	DOM.userPromptDiv.addEventListener('input', () => {
		DOM.userPromptTxt.value = DOM.userPromptDiv.innerText;
	  });

	  DOM.userPromptTxt.addEventListener('input', () => {
		DOM.userPromptDiv.value = DOM.userPromptTxt.innerText;
	  });
	
	DOM.userPromptDiv.addEventListener('keydown', function(event){
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault(); // Prevent newline
			EventHandler.handleSendMessage(event);
		}
	});

	document.getElementById('new-chat').addEventListener('click', EventHandler.handleNewChat);
	document.getElementById('AddFileBtn').addEventListener('click', (e)=>{
		e.preventDefault();
		DOM.fileInput.click();
	});
	//Delete document button
	document.getElementById('deleteDocs').addEventListener('click', EventHandler.handleDocItemDelete);
	DOM.fileInput.addEventListener('change', EventHandler.handleFileinputChange);

	// Initialize document handling
	document.addEventListener('DOMContentLoaded', () => {
		getAllDocs();
		generateChatTopicList();
	});

	// Close all menus when clicking outside
	document.addEventListener('click', function (event) {
		if (!event.target.closest('.menu-container')) {
			const menus = document.querySelectorAll('.topic-dropdown-menu');
			menus.forEach(menu => menu.classList.remove('show'));
		}
	});
}

initializeApp();