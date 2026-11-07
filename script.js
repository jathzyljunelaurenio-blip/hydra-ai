
/* =====================================
   HYDRA AI - SMART CHAT SYSTEM
   VERSION 1.3.0
   STREAMING RESPONSE OPTIMIZATION
===================================== */

const API_BASE_URL =
  "https://proud-bread-6eb8hydra-ai-backend.jathzyljunelaurenio.workers.dev";

const REQUEST_TIMEOUT = 90000;
const STORAGE_KEY = "hydra_ai_conversations_v1";
const AUTH_TOKEN_KEY = "hydra_ai_token";

const modes = {
  chat: {
    name: "AI Chat",
    icon: "◈",
    placeholder: "Ask HYDRA anything..."
  },
  image: {
    name: "Image Generator",
    icon: "▧",
    placeholder: "Describe the image you want to create..."
  },
  code: {
    name: "Code Generator",
    icon: "⌘",
    placeholder: "Describe the code or application you want..."
  },
  writing: {
    name: "Writing Generator",
    icon: "✎",
    placeholder: "What would you like HYDRA to write?"
  }
};

// =====================================
// APPLICATION STATE
// =====================================

let currentMode = "chat";
let currentConversationId = null;
let conversations = [];
let isGenerating = false;
let toastTimeout;

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || null;
let currentUser = null;
let isAuthenticating = false;

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const conversation = document.getElementById("conversation");

const currentModeLabel = document.getElementById("currentMode");
const modeIcon = document.getElementById("modeIcon");
const modeName = document.getElementById("modeName");
const charCount = document.getElementById("charCount");
const toast = document.getElementById("toast");

const conversationList =
  document.getElementById("conversationList");

const historyCount =
  document.getElementById("historyCount");

// AUTH ELEMENTS

const authScreen = document.getElementById("authScreen");
const app = document.getElementById("app");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const registerName = document.getElementById("registerName");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");

const loginSubmit = document.getElementById("loginSubmit");
const registerSubmit = document.getElementById("registerSubmit");

const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");

const logoutBtn = document.getElementById("logoutBtn");

const profileName = document.getElementById("profileName");
const profileAvatar = document.getElementById("profileAvatar");
const profilePlan = document.getElementById("profilePlan");
const topAvatar = document.getElementById("topAvatar");

// =====================================
// ACCOUNT STORAGE
// =====================================

function getStorageKey() {
  if (!currentUser || !currentUser.id) {
    return STORAGE_KEY;
  }

  return `${STORAGE_KEY}_${currentUser.id}`;
}

function saveConversations() {
  if (!currentUser) return false;

  try {
    localStorage.setItem(
      getStorageKey(),
      JSON.stringify(conversations)
    );

    return true;
  } catch (error) {
    console.error("HYDRA storage error:", error);
    showToast("Unable to save conversations.");
    return false;
  }
}

function loadConversations() {
  if (!currentUser) return [];

  try {
    const saved = localStorage.getItem(getStorageKey());

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item =>
        item &&
        typeof item.id === "string" &&
        Array.isArray(item.messages)
      )
      .map(item => ({
        id: item.id,
        title: String(item.title || "New conversation"),
        mode: modes[item.mode] ? item.mode : "chat",
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Date.now(),

        messages: item.messages
          .filter(message =>
            message &&
            ["user", "assistant"].includes(message.role) &&
            typeof message.content === "string"
          )
          .map(message => ({
            role: message.role,
            content: message.content,
            imageUrl:
              typeof message.imageUrl === "string"
                ? message.imageUrl
                : null,
            mode: modes[message.mode]
              ? message.mode
              : item.mode
          }))
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);

  } catch (error) {
    console.error("HYDRA loading error:", error);
    return [];
  }
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "hydra_" + Date.now() + "_" +
    Math.random().toString(36).slice(2);
}

// =====================================
// AUTHENTICATION UI
// =====================================

function showLoginScreen() {
  if (authScreen) authScreen.hidden = false;
  if (app) app.hidden = true;
}

function showApplication() {
  if (authScreen) authScreen.hidden = true;
  if (app) app.hidden = false;
}

function switchAuthForm(form) {
  if (form === "register") {
    if (loginForm) loginForm.hidden = true;
    if (registerForm) registerForm.hidden = false;
  } else {
    if (registerForm) registerForm.hidden = true;
    if (loginForm) loginForm.hidden = false;
  }
}

showRegister?.addEventListener("click", () => {
  switchAuthForm("register");
});

showLogin?.addEventListener("click", () => {
  switchAuthForm("login");
});

// =====================================
// USER PROFILE
// =====================================

function updateUserProfile() {
  if (!currentUser) return;

  const name = currentUser.name || "HYDRA User";
  const email = currentUser.email || "";
  const plan = currentUser.plan || "free";

  const initial = name.trim().charAt(0).toUpperCase() || "H";

  if (profileName) profileName.textContent = name;

  if (profileAvatar) {
    profileAvatar.textContent = initial;
    profileAvatar.title = email;
  }

  if (topAvatar) topAvatar.textContent = initial;

  if (profilePlan) {
    profilePlan.textContent =
      plan.charAt(0).toUpperCase() + plan.slice(1) + " Plan";
  }
}

// =====================================
// AUTHENTICATION REQUESTS
// =====================================

async function authenticateRequest(
  path,
  payload = null,
  method = "POST"
) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const headers = {};

    if (payload !== null) {
      headers["Content-Type"] = "application/json";
    }

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: payload !== null
        ? JSON.stringify(payload)
        : undefined,
      signal: controller.signal
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `The server returned an invalid response (${response.status}).`
      );
    }

    if (!response.ok || data.success === false) {
      throw new Error(
        data.error || `Server error (${response.status}).`
      );
    }

    return data;

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The request took too long. Please try again.");
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Cannot connect to HYDRA AI. Check your internet connection."
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

// =====================================
// COMPLETE LOGIN
// =====================================

function completeLogin(data) {
  if (!data || !data.token || !data.user) {
    throw new Error("The server returned incomplete account information.");
  }

  authToken = data.token;
  currentUser = data.user;

  localStorage.setItem(AUTH_TOKEN_KEY, authToken);

  conversations = loadConversations();
  currentConversationId = null;

  messages.innerHTML = "";

  welcome.hidden = false;
  conversation.hidden = true;

  promptInput.value = "";
  updateCharacterCount();

  updateUserProfile();
  renderConversationList();
  updateModeDisplay();

  showApplication();

  console.log("HYDRA account authenticated.");
}

// =====================================
// LOGIN
// =====================================

loginForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (isAuthenticating) return;

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showToast("Please enter your email and password.");
    return;
  }

  isAuthenticating = true;

  if (loginSubmit) {
    loginSubmit.disabled = true;
    loginSubmit.textContent = "Signing in...";
  }

  try {
    const data = await authenticateRequest(
      "/api/login",
      { email, password }
    );

    completeLogin(data);
    loginForm.reset();

    showToast("Welcome back to HYDRA AI!");

  } catch (error) {
    showToast(error.message);
    console.error("HYDRA login error:", error);

  } finally {
    isAuthenticating = false;

    if (loginSubmit) {
      loginSubmit.disabled = false;
      loginSubmit.textContent = "Sign In";
    }
  }
});

// =====================================
// REGISTER
// =====================================

registerForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (isAuthenticating) return;

  const name = registerName.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value;

  if (!name || !email || !password) {
    showToast("Please complete all registration fields.");
    return;
  }

  if (name.length < 2) {
    showToast("Your name must contain at least 2 characters.");
    return;
  }

  if (password.length < 8) {
    showToast("Your password must contain at least 8 characters.");
    return;
  }

  isAuthenticating = true;

  if (registerSubmit) {
    registerSubmit.disabled = true;
    registerSubmit.textContent = "Creating account...";
  }

  try {
    const data = await authenticateRequest(
      "/api/register",
      { name, email, password }
    );

    completeLogin(data);
    registerForm.reset();

    showToast("Your HYDRA account was created!");

  } catch (error) {
    showToast(error.message);
    console.error("HYDRA registration error:", error);

  } finally {
    isAuthenticating = false;

    if (registerSubmit) {
      registerSubmit.disabled = false;
      registerSubmit.textContent = "Create Account";
    }
  }
});

// =====================================
// RESTORE SESSION
// =====================================

async function restoreSession() {
  if (!authToken) {
    showLoginScreen();
    return false;
  }

  try {
    const data = await authenticateRequest(
      "/api/me",
      null,
      "GET"
    );

    if (!data.user) {
      throw new Error("Invalid session.");
    }

    currentUser = data.user;
    conversations = loadConversations();

    updateUserProfile();
    renderConversationList();
    updateModeDisplay();

    showApplication();

    console.log("HYDRA session restored.");

    return true;

  } catch (error) {
    console.warn("HYDRA session restoration failed:", error);

    authToken = null;
    currentUser = null;

    localStorage.removeItem(AUTH_TOKEN_KEY);

    showLoginScreen();

    return false;
  }
}

// =====================================
// LOGOUT
// =====================================

async function logout() {
  if (isGenerating || isAuthenticating) {
    showToast("Please wait for the current operation.");
    return;
  }

  if (!confirm("Are you sure you want to log out?")) {
    return;
  }

  try {
    if (authToken) {
      await authenticateRequest("/api/logout", {});
    }
  } catch (error) {
    console.warn("HYDRA logout request failed:", error);
  }

  authToken = null;
  currentUser = null;

  localStorage.removeItem(AUTH_TOKEN_KEY);

  conversations = [];
  currentConversationId = null;

  messages.innerHTML = "";

  welcome.hidden = false;
  conversation.hidden = true;

  promptInput.value = "";
  updateCharacterCount();

  renderConversationList();
  showLoginScreen();

  showToast("You have logged out.");
}

logoutBtn?.addEventListener("click", logout);

// =====================================
// CONVERSATION MANAGEMENT
// =====================================

function createConversation() {
  const item = {
    id: createId(),
    title: "New conversation",
    mode: currentMode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };

  conversations.unshift(item);
  currentConversationId = item.id;

  saveConversations();
  renderConversationList();

  return item;
}

function getCurrentConversation() {
  return conversations.find(
    item => item.id === currentConversationId
  ) || null;
}

function newChat() {
  if (isGenerating) {
    showToast("Please wait for the current response.");
    return;
  }

  currentConversationId = null;

  messages.innerHTML = "";

  welcome.hidden = false;
  conversation.hidden = true;

  promptInput.value = "";
  updateCharacterCount();

  changeMode("chat");
  renderConversationList();

  if (sidebar) sidebar.classList.remove("open");
}

function openConversation(id) {
  if (isGenerating) {
    showToast("Please wait for the current response.");
    return;
  }

  const item = conversations.find(
    conversation => conversation.id === id
  );

  if (!item) return;

  currentConversationId = id;
  currentMode = item.mode;

  messages.innerHTML = "";

  if (item.messages.length > 0) {
    welcome.hidden = true;
    conversation.hidden = false;

    item.messages.forEach(message => {
      addMessage(
        message.role,
        message.content,
        message.imageUrl,
        false
      );
    });

  } else {
    welcome.hidden = false;
    conversation.hidden = true;
  }

  updateModeDisplay();
  renderConversationList();

  promptInput.value = "";
  updateCharacterCount();

  if (sidebar) sidebar.classList.remove("open");
}

function renameConversation(id) {
  if (isGenerating) return;

  const item = conversations.find(
    conversation => conversation.id === id
  );

  if (!item) return;

  const newTitle = prompt(
    "Enter a new conversation name:",
    item.title
  );

  if (newTitle === null) return;

  const cleaned = newTitle.trim();

  if (!cleaned) {
    showToast("Conversation name cannot be empty.");
    return;
  }

  item.title = cleaned.slice(0, 60);
  item.updatedAt = Date.now();

  saveConversations();
  renderConversationList();

  showToast("Conversation renamed.");
}

function deleteConversation(id) {
  if (isGenerating) return;

  const item = conversations.find(
    conversation => conversation.id === id
  );

  if (!item) return;

  if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) {
    return;
  }

  conversations = conversations.filter(
    conversation => conversation.id !== id
  );

  if (currentConversationId === id) {
    currentConversationId = null;
    messages.innerHTML = "";

    welcome.hidden = false;
    conversation.hidden = true;

    promptInput.value = "";
    updateCharacterCount();

    changeMode("chat");
  }

  saveConversations();
  renderConversationList();

  showToast("Conversation deleted.");
}

// =====================================
// CONVERSATION LIST
// =====================================

function renderConversationList() {
  if (!conversationList) return;

  conversationList.innerHTML = "";

  if (historyCount) {
    historyCount.textContent = conversations.length;
  }

  if (conversations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No conversations yet.";

    conversationList.appendChild(empty);
    return;
  }

  conversations.forEach(item => {
    const wrapper = document.createElement("div");

    wrapper.className = "history-item";

    if (item.id === currentConversationId) {
      wrapper.classList.add("active");
    }

    const openButton = document.createElement("button");

    openButton.type = "button";
    openButton.className = "history-open";
    openButton.title = item.title;

    const icon = document.createElement("span");
    icon.className = "history-icon";
    icon.textContent = modes[item.mode]?.icon || "◈";

    const title = document.createElement("span");
    title.className = "history-title";
    title.textContent = item.title;

    openButton.appendChild(icon);
    openButton.appendChild(title);

    openButton.addEventListener("click", () => {
      openConversation(item.id);
    });

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const renameButton = document.createElement("button");

    renameButton.type = "button";
    renameButton.className = "history-action";
    renameButton.textContent = "✎";
    renameButton.title = "Rename conversation";

    renameButton.addEventListener("click", () => {
      renameConversation(item.id);
    });

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "history-action delete";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete conversation";

    deleteButton.addEventListener("click", () => {
      deleteConversation(item.id);
    });

    actions.appendChild(renameButton);
    actions.appendChild(deleteButton);

    wrapper.appendChild(openButton);
    wrapper.appendChild(actions);

    conversationList.appendChild(wrapper);
  });
}

// =====================================
// MODE NAVIGATION
// =====================================

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => {
    changeMode(button.dataset.mode);

    if (sidebar) sidebar.classList.remove("open");
  });
});

function updateModeDisplay() {
  const selected = modes[currentMode];

  currentModeLabel.textContent = selected.name;
  modeName.textContent = selected.name;
  modeIcon.textContent = selected.icon;

  promptInput.placeholder = selected.placeholder;

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.mode === currentMode
    );
  });
}

function changeMode(mode) {
  if (!modes[mode]) return;

  if (isGenerating) {
    showToast("Please wait for the current response.");
    return;
  }

  currentMode = mode;

  const item = getCurrentConversation();

  if (item) {
    item.mode = mode;
    item.updatedAt = Date.now();
    saveConversations();
  }

  updateModeDisplay();
  renderConversationList();

  promptInput.focus();
}

menuBtn?.addEventListener("click", () => {
  if (sidebar) sidebar.classList.toggle("open");
});

// =====================================
// INPUT HANDLING
// =====================================

function updateCharacterCount() {
  charCount.textContent =
    `${promptInput.value.length} / 4000`;
}

promptInput.addEventListener("input", () => {
  updateCharacterCount();

  promptInput.style.height = "auto";

  promptInput.style.height =
    Math.min(promptInput.scrollHeight, 180) + "px";
});

promptInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    generate();
  }
});

// =====================================
// MARKDOWN RENDERING
// =====================================

function appendInlineMarkdown(container, text) {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    container.appendChild(
      document.createTextNode(
        text.slice(lastIndex, match.index)
      )
    );

    const token = match[0];
    let element;

    if (token.startsWith("**")) {
      element = document.createElement("strong");
      element.textContent = token.slice(2, -2);

    } else if (token.startsWith("`")) {
      element = document.createElement("code");
      element.textContent = token.slice(1, -1);

    } else {
      element = document.createElement("em");
      element.textContent = token.slice(1, -1);
    }

    container.appendChild(element);
    lastIndex = pattern.lastIndex;
  }

  container.appendChild(
    document.createTextNode(text.slice(lastIndex))
  );
}

function makeCopyButton(text, label = "Copy") {
  const button = document.createElement("button");

  button.className = "copy-button";
  button.type = "button";
  button.textContent = label;

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);

      button.textContent = "Copied!";
      showToast("Copied to clipboard.");

      setTimeout(() => {
        button.textContent = label;
      }, 1600);

    } catch {
      showToast("Copy is unavailable in this browser.");
    }
  });

  return button;
}

function renderFormattedText(container, content) {
  const parts = content.split(
    /```([\w+-]*)\n([\s\S]*?)```/g
  );

  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 1) {
      const language = parts[i] || "code";
      const codeText = parts[i + 1] || "";

      const wrapper = document.createElement("div");
      wrapper.className = "code-block";

      const header = document.createElement("div");
      header.className = "code-header";

      const languageLabel = document.createElement("span");
      languageLabel.textContent = language;

      header.appendChild(languageLabel);
      header.appendChild(makeCopyButton(codeText, "Copy code"));

      const pre = document.createElement("pre");
      const code = document.createElement("code");

      code.textContent = codeText;

      pre.appendChild(code);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      container.appendChild(wrapper);

      i++;
      continue;
    }

    const text = parts[i];

    if (!text) continue;

    const lines = text.split("\n");

    let paragraph = null;
    let list = null;

    function closeParagraph() {
      paragraph = null;
    }

    function closeList() {
      list = null;
    }

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        closeParagraph();
        closeList();
        continue;
      }

      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

      if (heading) {
        closeParagraph();
        closeList();

        const level = heading[1].length;
        const element = document.createElement(`h${level + 2}`);

        appendInlineMarkdown(element, heading[2]);
        container.appendChild(element);

        continue;
      }

      const bullet = trimmed.match(/^[-*]\s+(.+)$/);
      const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);

      if (bullet || numbered) {
        closeParagraph();

        const type = bullet ? "ul" : "ol";

        if (!list || list.tagName.toLowerCase() !== type) {
          closeList();

          list = document.createElement(type);
          container.appendChild(list);
        }

        const item = document.createElement("li");

        appendInlineMarkdown(
          item,
          (bullet || numbered)[1]
        );

        list.appendChild(item);
        continue;
      }

      closeList();

      if (!paragraph) {
        paragraph = document.createElement("p");
        container.appendChild(paragraph);
      } else {
        paragraph.appendChild(document.createElement("br"));
      }

      appendInlineMarkdown(paragraph, line);
    }
  }
}

// =====================================
// MESSAGE DISPLAY
// =====================================

function addMessage(role, content, imageUrl = null, persist = true) {
  const message = document.createElement("div");

  message.className = `message ${role}`;

  const avatar = document.createElement("div");

  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "U" : "H";

  const messageContent = document.createElement("div");

  messageContent.className = "message-content";

  if (role === "assistant") {
    renderFormattedText(messageContent, content);
  } else {
    const text = document.createElement("div");

    text.textContent = content;
    messageContent.appendChild(text);
  }

  if (imageUrl) {
    const image = document.createElement("img");

    image.src = imageUrl;
    image.alt = "HYDRA AI generated image";
    image.loading = "lazy";

    image.onerror = () => {
      image.replaceWith(
        document.createTextNode("Image could not be displayed.")
      );
    };

    messageContent.appendChild(image);

    const download = document.createElement("a");

    download.href = imageUrl;
    download.download = "hydra-ai-image.jpg";
    download.textContent = "Download image";
    download.className = "image-download";

    messageContent.appendChild(download);

  } else if (role === "assistant") {
    messageContent.appendChild(
      makeCopyButton(content, "Copy response")
    );
  }

  message.appendChild(avatar);
  message.appendChild(messageContent);

  messages.appendChild(message);

  message.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });

  return message;
}

// =====================================
// LIVE STREAM MESSAGE
// =====================================

function createStreamingMessage() {
  const message = document.createElement("div");
  message.className = "message assistant";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "H";

  const content = document.createElement("div");
  content.className = "message-content";

  const output = document.createElement("div");
  output.className = "streaming-output";

  output.textContent = "";

  content.appendChild(output);
  message.appendChild(avatar);
  message.appendChild(content);

  messages.appendChild(message);

  message.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });

  return {
    message,
    content,
    output
  };
}

function finishStreamingMessage(target, text) {
  target.output.remove();

  renderFormattedText(target.content, text);

  target.content.appendChild(
    makeCopyButton(text, "Copy response")
  );
}

function showLoading() {
  const loading = document.createElement("div");

  loading.className = "message";

  const avatar = document.createElement("div");

  avatar.className = "message-avatar";
  avatar.textContent = "H";

  const content = document.createElement("div");

  content.className = "message-content typing";

  content.textContent = currentMode === "image"
    ? "HYDRA is creating your image..."
    : "HYDRA is thinking...";

  loading.appendChild(avatar);
  loading.appendChild(content);

  messages.appendChild(loading);

  loading.scrollIntoView({ behavior: "smooth" });

  return loading;
}

// =====================================
// CONTEXT MANAGEMENT
// =====================================

function getConversationHistory(item) {
  if (!item) return [];

  return item.messages
    .filter(message =>
      ["user", "assistant"].includes(message.role)
    )
    .map(message => ({
      role: message.role,
      content: message.content
    }));
}

// =====================================
// NETWORK ERROR HANDLING
// =====================================

function networkError(error) {
  if (error.name === "AbortError") {
    return new Error(
      "The request took too long. Please try again."
    );
  }

  if (error instanceof TypeError) {
    return new Error(
      "Cannot connect to HYDRA AI. Check your internet connection."
    );
  }

  return error;
}

// =====================================
// NORMAL JSON REQUEST
// Used for authentication and images
// =====================================

async function postJSON(path, payload) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const headers = {
      "Content-Type": "application/json"
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `The server returned an invalid response (${response.status}).`
      );
    }

    if (!response.ok || data.success === false) {
      const details = data.details
        ? ` ${data.details}`
        : "";

      throw new Error(
        (data.error || `Server error (${response.status}).`) +
        details
      );
    }

    return data;

  } catch (error) {
    throw networkError(error);

  } finally {
    clearTimeout(timeout);
  }
}

// =====================================
// STREAM CHUNK EXTRACTION
// =====================================

function extractStreamText(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  const content =
    data.choices?.[0]?.delta?.content ??
    data.choices?.[0]?.message?.content ??
    data.response ??
    data.text ??
    data.result?.response ??
    "";

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(item =>
      typeof item === "string"
        ? item
        : item?.text || ""
    ).join("");
  }

  return "";
}

// =====================================
// STREAMING AI REQUEST
// =====================================

async function requestAI(prompt, history, onChunk) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const headers = {
      "Content-Type": "application/json"
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/generate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: currentMode,
          prompt,
          history: currentMode === "chat"
            ? history.slice(-10)
            : []
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      let errorData = {};

      try {
        errorData = await response.json();
      } catch {
        // Keep the HTTP status as fallback.
      }

      throw new Error(
        errorData.error ||
        `Server error (${response.status}).`
      );
    }

    if (!response.body) {
      throw new Error("Streaming is not supported by this response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let fullText = "";
    let streamFinished = false;

    function processEvent(eventText) {
      const lines = eventText.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const value = line.slice(5).trim();

        if (!value) continue;

        if (value === "[DONE]") {
          streamFinished = true;
          continue;
        }

        let data;

        try {
          data = JSON.parse(value);
        } catch {
          continue;
        }

        if (data.error) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "The AI stream returned an error."
          );
        }

        const chunk = extractStreamText(data);

        if (chunk) {
          fullText += chunk;
          onChunk(chunk, fullText);
        }

        if (
          data.choices?.[0]?.finish_reason === "error"
        ) {
          throw new Error("The AI stream ended unexpectedly.");
        }
      }
    }

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true
      });

      const events = buffer.split(/\r?\n\r?\n/);

      buffer = events.pop() || "";

      for (const eventText of events) {
        processEvent(eventText);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processEvent(buffer);
    }

    if (!fullText.trim()) {
      throw new Error(
        streamFinished
          ? "The AI returned an empty response."
          : "The AI stream ended without returning text."
      );
    }

    return {
      success: true,
      text: fullText,
      mode: currentMode
    };

  } catch (error) {
    throw networkError(error);

  } finally {
    clearTimeout(timeout);
  }
}

// =====================================
// IMAGE REQUEST
// =====================================

async function requestImage(prompt) {
  return postJSON("/api/image", { prompt });
}

// =====================================
// GENERATE
// =====================================

async function generate() {
  if (!currentUser || !authToken) {
    showToast("Please sign in to use HYDRA AI.");
    showLoginScreen();
    return;
  }

  const prompt = promptInput.value.trim();

  if (!prompt || isGenerating) return;

  if (prompt.length > 4000) {
    showToast("Your prompt is too long.");
    return;
  }

  if (!API_BASE_URL.startsWith("https://")) {
    showToast("Please configure your backend URL.");
    return;
  }

  isGenerating = true;

  sendBtn.disabled = true;
  sendBtn.textContent = "Generating...";

  welcome.hidden = true;
  conversation.hidden = false;

  let item = getCurrentConversation();

  if (!item) {
    item = createConversation();
  }

  item.mode = currentMode;

  const userMessage = {
    role: "user",
    content: prompt,
    imageUrl: null,
    mode: currentMode,
    createdAt: Date.now()
  };

  item.messages.push(userMessage);

  if (item.title === "New conversation") {
    item.title = prompt.slice(0, 40) +
      (prompt.length > 40 ? "..." : "");
  }

  item.updatedAt = Date.now();

  addMessage("user", prompt);

  saveConversations();
  renderConversationList();

  const history = getConversationHistory(item)
    .slice(0, -1);

  promptInput.value = "";
  promptInput.style.height = "auto";

  updateCharacterCount();

  let loading = null;
  let streamTarget = null;

  try {
    if (currentMode === "image") {
      loading = showLoading();

      const data = await requestImage(prompt);

      loading.remove();
      loading = null;

      if (!data.image_url) {
        throw new Error("The server did not return an image.");
      }

      const assistantMessage = {
        role: "assistant",
        content: data.message ||
          "Your image has been generated!",
        imageUrl: data.image_url,
        mode: currentMode,
        createdAt: Date.now()
      };

      item.messages.push(assistantMessage);

      addMessage(
        "assistant",
        assistantMessage.content,
        assistantMessage.imageUrl,
        false
      );

    } else {
      // Create an immediate loading indicator.
      loading = showLoading();

      // Create the streaming message after connection starts.
      const data = await requestAI(
        prompt,
        history,
        (chunk, fullText) => {
          if (loading) {
            loading.remove();
            loading = null;
          }

          if (!streamTarget) {
            streamTarget = createStreamingMessage();
          }

          // Display arriving text immediately.
          streamTarget.output.textContent = fullText;

          streamTarget.message.scrollIntoView({
            behavior: "auto",
            block: "nearest"
          });
        }
      );

      if (loading) {
        loading.remove();
        loading = null;
      }

      if (
        typeof data.text !== "string" ||
        !data.text.trim()
      ) {
        throw new Error("The AI returned an empty response.");
      }

      if (!streamTarget) {
        streamTarget = createStreamingMessage();
      }

      // Convert the finished response to Markdown.
      finishStreamingMessage(streamTarget, data.text);

      const assistantMessage = {
        role: "assistant",
        content: data.text,
        imageUrl: null,
        mode: currentMode,
        createdAt: Date.now()
      };

      item.messages.push(assistantMessage);
    }

    item.updatedAt = Date.now();

    saveConversations();
    renderConversationList();

  } catch (error) {
    if (loading) loading.remove();

    // Remove an incomplete streaming message.
    if (streamTarget) {
      streamTarget.message.remove();
    }

    const errorMessage = {
      role: "assistant",
      content:
        `HYDRA encountered a problem.\n\n${error.message}\n\nPlease try again.`,
      imageUrl: null,
      mode: currentMode,
      createdAt: Date.now()
    };

    item.messages.push(errorMessage);

    addMessage(
      "assistant",
      errorMessage.content,
      null,
      false
    );

    saveConversations();

    console.error("HYDRA request error:", error);

  } finally {
    isGenerating = false;

    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Generate <span>➤</span>';

    renderConversationList();

    promptInput.focus();
  }
}

// =====================================
// BUTTON EVENTS
// =====================================

sendBtn.addEventListener("click", generate);

// =====================================
// TOAST
// =====================================

function showToast(message) {
  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// =====================================
// INITIALIZATION
// =====================================

async function initializeHydra() {
  showLoginScreen();

  updateCharacterCount();

  changeMode("chat");

  console.log("HYDRA AI starting...");

  const restored = await restoreSession();

  if (restored) {
    console.log(
      `Restored ${conversations.length} conversations.`
    );

    showToast("Welcome back to HYDRA AI!");

  } else {
    console.log("Please sign in or create an account.");
  }
}

initializeHydra();
