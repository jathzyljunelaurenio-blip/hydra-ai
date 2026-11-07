
/* =====================================
   HYDRA PAY
   VERSION 2.0.0
   MISSION 2 - BACKEND AUTHENTICATION
   DEMO MONEY ONLY
===================================== */

const API_BASE_URL =
  "https://still-dew-4cac.jathzyljunelaurenio.workers.dev";

const TOKEN_KEY = "hydra_pay_token";
const DEMO_STORAGE_KEY = "hydra_pay_demo_v1";

const defaultWallet = {
  balance: 5000,
  transactions: []
};

let wallet = loadWallet();
let balanceVisible = true;
let currentAction = "";
let currentUser = null;
let authToken = localStorage.getItem(TOKEN_KEY);

/* =====================================
   ELEMENTS
===================================== */

const authScreen = document.getElementById("authScreen");
const dashboardScreen = document.getElementById("dashboardScreen");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const authTitle = document.getElementById("authTitle");
const authDescription = document.getElementById("authDescription");
const authMessage = document.getElementById("authMessage");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const registerName = document.getElementById("registerName");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");
const confirmPassword = document.getElementById("confirmPassword");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

const balanceElement = document.getElementById("balance");
const toggleBalanceBtn = document.getElementById("toggleBalance");
const transactionList = document.getElementById("transactionList");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");

const transactionForm = document.getElementById("transactionForm");
const amountInput = document.getElementById("amount");
const recipientInput = document.getElementById("recipient");
const recipientField = document.getElementById("recipientField");

const toast = document.getElementById("toast");

/* =====================================
   API REQUEST
===================================== */

async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (authToken) {
    headers.Authorization = "Bearer " + authToken;
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 20000);

  try {
    const response = await fetch(
      API_BASE_URL + endpoint,
      {
        ...options,
        headers,
        signal: controller.signal
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "The request could not be completed."
      );
    }

    return data;

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Unable to connect. Check your internet connection and backend URL."
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

/* =====================================
   AUTHENTICATION UI
===================================== */

function showAuthMessage(message, success = false) {
  authMessage.textContent = message;
  authMessage.classList.remove("hidden");

  authMessage.style.background = success ? "#e8fff3" : "#fff1f1";
  authMessage.style.color = success ? "#128653" : "#d63b50";
  authMessage.style.borderColor = success ? "#b9efd2" : "#ffd9de";
}

function clearAuthMessage() {
  authMessage.textContent = "";
  authMessage.classList.add("hidden");
}

function showLoginScreen() {
  authScreen.classList.remove("hidden");
  dashboardScreen.classList.add("hidden");

  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");

  authTitle.innerHTML = 'Your money.<br><span>Your control.</span>';
  authDescription.textContent =
    "Access your digital wallet securely and conveniently.";

  clearAuthMessage();
}

function showRegisterScreen() {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");

  authTitle.innerHTML = 'Start your<br><span>HYDRA journey.</span>';
  authDescription.textContent =
    "Create your account and access your wallet.";

  clearAuthMessage();
}

function showDashboard(user) {
  currentUser = user;

  authScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");

  const fullName = user.full_name || user.fullName || "HYDRA User";

  document.getElementById("userName").textContent =
    fullName + " 👋";

  document.getElementById("userAvatar").textContent =
    fullName.trim().charAt(0).toUpperCase();

  updateBalance();
  renderTransactions();
}

/* =====================================
   REGISTRATION
===================================== */

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fullName = registerName.value.trim();
  const email = registerEmail.value.trim().toLowerCase();
  const password = registerPassword.value;
  const confirmation = confirmPassword.value;

  if (fullName.length < 2) {
    showAuthMessage("Please enter your full name.");
    return;
  }

  if (password.length < 8) {
    showAuthMessage("Password must contain at least 8 characters.");
    return;
  }

  if (password !== confirmation) {
    showAuthMessage("Your passwords do not match.");
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = "Creating account...";

  try {
    const data = await apiRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({
        fullName,
        email,
        password
      })
    });

    if (data.token) {
      authToken = data.token;
      localStorage.setItem(TOKEN_KEY, authToken);

      const user = data.user || {
        full_name: fullName,
        email
      };

      showDashboard(user);
      showToast("Welcome to HYDRA PAY!");

    } else {
      loginEmail.value = email;
      loginPassword.value = "";

      showLoginScreen();
      showAuthMessage(
        "Account created successfully! Please sign in.",
        true
      );
    }

    registerForm.reset();

  } catch (error) {
    showAuthMessage(error.message);

  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = "Create Account →";
  }
});

/* =====================================
   LOGIN
===================================== */

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPassword.value;

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  try {
    const data = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!data.token || !data.user) {
      throw new Error("The server did not return a valid session.");
    }

    authToken = data.token;
    localStorage.setItem(TOKEN_KEY, authToken);

    loginForm.reset();

    showDashboard(data.user);
    showToast("Login successful!");

  } catch (error) {
    showAuthMessage(error.message);

  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In →";
  }
});

/* =====================================
   LOGOUT
===================================== */

async function logout() {
  if (!confirm("Are you sure you want to log out?")) {
    return;
  }

  try {
    if (authToken) {
      await apiRequest("/api/logout", {
        method: "POST"
      });
    }
  } catch (error) {
    console.error("Logout request error:", error);
  }

  authToken = null;
  currentUser = null;

  localStorage.removeItem(TOKEN_KEY);

  showLoginScreen();
  showToast("You have been logged out.");
}

const logoutButton = document.createElement("button");

logoutButton.type = "button";
logoutButton.id = "logoutBtn";
logoutButton.className = "icon-button";
logoutButton.textContent = "↪";
logoutButton.title = "Log out";
logoutButton.setAttribute("aria-label", "Log out");

logoutButton.addEventListener("click", logout);

document.querySelector(".topbar").appendChild(logoutButton);

/* =====================================
   RESTORE SESSION
===================================== */

async function restoreSession() {
  if (!authToken) {
    showLoginScreen();
    return;
  }

  try {
    const data = await apiRequest("/api/me", {
      method: "GET"
    });

    if (!data.user) {
      throw new Error("Invalid session.");
    }

    showDashboard(data.user);
    console.log("HYDRA PAY session restored.");

  } catch (error) {
    console.error("Session restoration failed:", error);

    authToken = null;
    localStorage.removeItem(TOKEN_KEY);

    showLoginScreen();
  }
}

/* =====================================
   AUTH SCREEN SWITCHING
===================================== */

document.getElementById("showRegister")
  .addEventListener("click", showRegisterScreen);

document.getElementById("showLogin")
  .addEventListener("click", showLoginScreen);

/* =====================================
   WALLET STORAGE
===================================== */

function loadWallet() {
  try {
    const saved = localStorage.getItem(DEMO_STORAGE_KEY);

    if (!saved) {
      return { ...defaultWallet };
    }

    const data = JSON.parse(saved);

    if (
      typeof data.balance !== "number" ||
      !Number.isFinite(data.balance) ||
      data.balance < 0 ||
      !Array.isArray(data.transactions)
    ) {
      return { ...defaultWallet };
    }

    return data;

  } catch (error) {
    console.error("Wallet loading error:", error);
    return { ...defaultWallet };
  }
}

function saveWallet() {
  try {
    localStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify(wallet)
    );
  } catch (error) {
    showToast("Unable to save demo wallet data.");
  }
}

/* =====================================
   FORMATTING
===================================== */

function formatMoney(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(amount);
}

function updateBalance() {
  balanceElement.textContent = balanceVisible
    ? formatMoney(wallet.balance)
    : "₱ ••••••";
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

/* =====================================
   TRANSACTION HISTORY
===================================== */

function renderTransactions() {
  if (wallet.transactions.length === 0) {
    transactionList.innerHTML = `
      <div class="empty-state">
        <span>↔</span>
        <p>No transactions yet</p>
        <small>Your activity will appear here.</small>
      </div>
    `;
    return;
  }

  transactionList.innerHTML = wallet.transactions
    .slice(0, 10)
    .map((transaction) => {
      const incoming =
        transaction.type === "add" ||
        transaction.type === "receive";

      const sign = incoming ? "+" : "-";
      const amountClass = incoming ? "positive" : "negative";

      return `
        <div class="transaction-item">
          <div class="transaction-left">
            <div class="transaction-icon">
              ${incoming ? "↓" : "↗"}
            </div>

            <div class="transaction-info">
              <strong>${escapeHTML(transaction.title)}</strong>
              <small>${escapeHTML(transaction.date)}</small>
            </div>
          </div>

          <div class="transaction-amount ${amountClass}">
            ${sign}${formatMoney(transaction.amount)}
          </div>
        </div>
      `;
    })
    .join("");
}

/* =====================================
   TOAST
===================================== */

let toastTimeout;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

/* =====================================
   MODAL
===================================== */

function openModal(action) {
  currentAction = action;

  const settings = {
    add: {
      title: "Add Demo Money",
      description: "Add simulated PHP to your demo wallet.",
      recipient: false
    },

    send: {
      title: "Send Demo Money",
      description: "Send simulated money from your demo wallet.",
      recipient: true
    },

    receive: {
      title: "Receive Demo Money",
      description: "Simulate receiving money in your wallet.",
      recipient: false
    }
  };

  const config = settings[action];

  if (!config) return;

  modalTitle.textContent = config.title;
  modalDescription.textContent = config.description;

  recipientField.classList.toggle(
    "hidden",
    !config.recipient
  );

  recipientInput.required = config.recipient;

  amountInput.value = "";
  recipientInput.value = "";

  modal.classList.remove("hidden");
  amountInput.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  transactionForm.reset();
}

/* =====================================
   CREATE DEMO TRANSACTION
===================================== */

function createTransaction(type, amount, title) {
  wallet.transactions.unshift({
    id: Date.now() + Math.random(),
    type,
    amount,
    title,
    date: new Date().toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short"
    })
  });

  saveWallet();
  updateBalance();
  renderTransactions();
}

function processTransaction(event) {
  event.preventDefault();

  const amount = Number(amountInput.value);

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Enter a valid amount.");
    return;
  }

  if (amount > 1000000) {
    showToast("Demo limit is ₱1,000,000 per transaction.");
    return;
  }

  if (currentAction === "send") {
    const recipient = recipientInput.value.trim();

    if (!recipient) {
      showToast("Please enter a recipient name.");
      return;
    }

    if (amount > wallet.balance) {
      showToast("Insufficient demo balance.");
      return;
    }

    wallet.balance -= amount;

    createTransaction(
      "send",
      amount,
      "Sent to " + recipient
    );

    showToast("Demo transfer completed!");
  }

  else if (currentAction === "add") {
    wallet.balance += amount;

    createTransaction(
      "add",
      amount,
      "Demo cash in"
    );

    showToast("Demo money added!");
  }

  else if (currentAction === "receive") {
    wallet.balance += amount;

    createTransaction(
      "receive",
      amount,
      "Demo money received"
    );

    showToast("Demo money received!");
  }

  closeModal();
}

/* =====================================
   MAIN ACTION BUTTONS
===================================== */

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (["add", "send", "receive"].includes(action)) {
      openModal(action);
      return;
    }

    if (action === "qr") {
      showToast("QR Pay is coming in a future mission.");
      return;
    }

    const messages = {
      load: "Mobile load service coming soon.",
      bills: "Bill payment service coming soon.",
      bank: "Bank integration coming soon.",
      more: "More services coming soon."
    };

    showToast(messages[action] || "Feature coming soon.");
  });
});

/* =====================================
   MODAL EVENTS
===================================== */

transactionForm.addEventListener(
  "submit",
  processTransaction
);

document.getElementById("closeModal")
  .addEventListener("click", closeModal);

document.getElementById("modalBackdrop")
  .addEventListener("click", closeModal);

/* =====================================
   BALANCE VISIBILITY
===================================== */

toggleBalanceBtn.addEventListener("click", () => {
  balanceVisible = !balanceVisible;

  updateBalance();

  toggleBalanceBtn.textContent = balanceVisible
    ? "◉"
    : "◎";
});

/* =====================================
   NAVIGATION
===================================== */

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    if (page === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (page === "activity") {
      document.querySelector(".transactions-section")
        .scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (page === "qr") {
      showToast("QR payment will be developed in a future mission.");
      return;
    }

    if (page === "profile") {
      showToast("Use the logout button in the top-right corner to sign out.");
      return;
    }

    if (page === "rewards") {
      showToast("Rewards feature coming soon.");
    }
  });
});

/* =====================================
   HEADER BUTTONS
===================================== */

document.getElementById("notificationBtn")
  .addEventListener("click", () => {
    showToast("You have no new notifications.");
  });

document.getElementById("viewAllBtn")
  .addEventListener("click", () => {
    document.querySelector(".transactions-section")
      .scrollIntoView({ behavior: "smooth" });
  });

/* =====================================
   INITIALIZATION
===================================== */

restoreSession();

console.log("HYDRA PAY v2.0 initialized.");
console.log("Authentication: Cloudflare Worker");
console.log("Wallet: DEMO MODE ONLY");
