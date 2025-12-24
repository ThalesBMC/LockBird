// Popup script for X Feed Blocker with Money Tracking

// Longer, more impactful motivational phrases
const motivationalPhrases = [
  {
    message: "",
    phrase: "I choose to waste my precious time on infinite scrolling",
  },
  {
    message: "",
    phrase: "I accept giving my attention away for free to billionaires",
  },
  {
    message: "",
    phrase: "I choose dopamine over my future success and happiness",
  },
  {
    message: "",
    phrase: "I willingly donate 38 days of my life each year to social media",
  },
  {
    message: "",
    phrase: "I accept being distracted while others achieve their dreams",
  },
];

document.addEventListener("DOMContentLoaded", function () {
  const toggle = document.getElementById("toggle");
  const statusBadge = document.getElementById("statusBadge");
  const statusText = document.getElementById("statusText");

  // Money elements
  const moneyCard = document.getElementById("moneyCard");
  const moneyTitle = document.getElementById("moneyTitle");
  const moneyAmount = document.getElementById("moneyAmount");
  const moneySubtitle = document.getElementById("moneySubtitle");
  const setupLink = document.getElementById("setupLink");

  // Disable modal
  const modalOverlay = document.getElementById("modalOverlay");
  const modalPhrase = document.getElementById("modalPhrase");
  const modalInput = document.getElementById("modalInput");
  const modalError = document.getElementById("modalError");
  const modalCancel = document.getElementById("modalCancel");
  const modalConfirm = document.getElementById("modalConfirm");

  // Setup modal
  const setupModal = document.getElementById("setupModal");
  const salaryInput = document.getElementById("salaryInput");
  const setupCancel = document.getElementById("setupCancel");
  const setupSave = document.getElementById("setupSave");

  let currentPhrase = null;
  let moneyUpdateInterval = null;

  // Load initial state
  loadState();

  // Setup money tracking interval
  moneyUpdateInterval = setInterval(updateMoneyDisplay, 1000);

  // Toggle click handler
  toggle.addEventListener("click", function () {
    const isCurrentlyActive = toggle.classList.contains("active");

    if (isCurrentlyActive) {
      // Trying to disable - show confirmation modal
      showDisableModal();
    } else {
      // Enabling - no confirmation needed
      enableBlocking();
    }
  });

  // Setup link
  setupLink.addEventListener("click", function (e) {
    e.preventDefault();
    showSetupModal();
  });

  // Disable modal handlers
  modalCancel.addEventListener("click", hideDisableModal);

  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) {
      hideDisableModal();
    }
  });

  modalInput.addEventListener("input", function () {
    modalError.classList.remove("show");
  });

  modalInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      modalConfirm.click();
    }
  });

  modalConfirm.addEventListener("click", function () {
    const userInput = modalInput.value.trim().toLowerCase();
    const correctPhrase = currentPhrase.phrase.toLowerCase();

    if (userInput === correctPhrase) {
      // Correct phrase - disable
      disableBlocking();
      hideDisableModal();
    } else {
      // Incorrect phrase
      modalError.classList.add("show");
      modalInput.value = "";
      modalInput.focus();
    }
  });

  // Setup modal handlers
  setupCancel.addEventListener("click", hideSetupModal);

  setupModal.addEventListener("click", function (e) {
    if (e.target === setupModal) {
      hideSetupModal();
    }
  });

  salaryInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      setupSave.click();
    }
  });

  setupSave.addEventListener("click", function () {
    const salary = parseInt(salaryInput.value);
    if (salary && salary > 0) {
      browser.storage.local.set({ annualSalary: salary }).then(() => {
        hideSetupModal();
        updateMoneyDisplay();
      });
    }
  });

  function loadState() {
    browser.storage.local
      .get([
        "xFeedBlockerEnabled",
        "annualSalary",
        "disabledAt",
        "enabledAt",
        "totalTimeSaved",
      ])
      .then((result) => {
        const isEnabled = result.xFeedBlockerEnabled !== false;
        updateUI(isEnabled);

        if (result.annualSalary) {
          salaryInput.value = result.annualSalary;
        }

        // Initialize enabledAt if extension is enabled but no timestamp exists
        if (isEnabled && !result.enabledAt) {
          browser.storage.local.set({ enabledAt: Date.now() });
        }

        updateMoneyDisplay();
      })
      .catch(() => {
        updateUI(true);
        // Set initial enabledAt
        browser.storage.local.set({ enabledAt: Date.now() });
      });
  }

  function showDisableModal() {
    // Choose random phrase
    currentPhrase =
      motivationalPhrases[
        Math.floor(Math.random() * motivationalPhrases.length)
      ];

    modalPhrase.textContent = currentPhrase.phrase;
    modalInput.value = "";
    modalError.classList.remove("show");

    modalOverlay.classList.add("show");
    setTimeout(() => modalInput.focus(), 100);
  }

  function hideDisableModal() {
    modalOverlay.classList.remove("show");
    modalInput.value = "";
    modalError.classList.remove("show");
  }

  function showSetupModal() {
    setupModal.classList.add("show");
    setTimeout(() => salaryInput.focus(), 100);
  }

  function hideSetupModal() {
    setupModal.classList.remove("show");
  }

  function enableBlocking() {
    const now = Date.now();

    browser.storage.local
      .get(["disabledAt", "totalTimeWasted"])
      .then((result) => {
        let totalTimeWasted = result.totalTimeWasted || 0;

        if (result.disabledAt) {
          const timeWasted = now - result.disabledAt;
          totalTimeWasted += timeWasted;
        }

        browser.storage.local
          .set({
            xFeedBlockerEnabled: true,
            disabledAt: null,
            totalTimeWasted: totalTimeWasted,
            enabledAt: now,
          })
          .then(() => {
            updateUI(true);
            sendMessageToContentScript(true);
            updateMoneyDisplay();
          });
      });
  }

  function disableBlocking() {
    const now = Date.now();

    browser.storage.local
      .get(["enabledAt", "totalTimeSaved"])
      .then((result) => {
        let totalTimeSaved = result.totalTimeSaved || 0;

        if (result.enabledAt) {
          const timeSaved = now - result.enabledAt;
          totalTimeSaved += timeSaved;
        }

        browser.storage.local
          .set({
            xFeedBlockerEnabled: false,
            disabledAt: now,
            enabledAt: null,
            totalTimeSaved: totalTimeSaved,
          })
          .then(() => {
            updateUI(false);
            sendMessageToContentScript(false);
            updateMoneyDisplay();
          });
      });
  }

  function updateMoneyDisplay() {
    browser.storage.local
      .get([
        "annualSalary",
        "xFeedBlockerEnabled",
        "disabledAt",
        "enabledAt",
        "totalTimeSaved",
        "totalTimeWasted",
      ])
      .then((result) => {
        const salary = result.annualSalary;

        if (!salary) {
          moneyTitle.textContent = "💰 TRACK YOUR SAVINGS";
          moneyAmount.textContent = "$?.??";
          moneySubtitle.textContent = "Set your salary to see the impact";
          setupLink.style.display = "inline-flex";
          moneyCard.classList.remove("losing");
          return;
        }

        setupLink.style.display = "none";

        // Calculate hourly rate
        const hourlyRate = salary / (365 * 24);
        const now = Date.now();

        if (result.xFeedBlockerEnabled) {
          // Extension is active - calculate money saved
          let totalSavedMs = result.totalTimeSaved || 0;
          if (result.enabledAt) {
            totalSavedMs += now - result.enabledAt;
          }

          const hoursSaved = totalSavedMs / (1000 * 60 * 60);
          const moneySaved = hoursSaved * hourlyRate;

          moneyCard.classList.remove("losing");
          moneyTitle.textContent = "💰 MONEY SAVED TODAY";
          moneyAmount.textContent = `$${moneySaved.toFixed(2)}`;
          moneySubtitle.textContent = `${formatTime(
            totalSavedMs
          )} of productive time 🎯`;
        } else {
          // Extension is disabled - calculate money lost
          let totalWastedMs = result.totalTimeWasted || 0;
          if (result.disabledAt) {
            totalWastedMs += now - result.disabledAt;
          }

          const hoursWasted = totalWastedMs / (1000 * 60 * 60);
          const moneyLost = hoursWasted * hourlyRate;

          moneyCard.classList.add("losing");
          moneyTitle.textContent = "💸 MONEY LOST TODAY";
          moneyAmount.textContent = `$${moneyLost.toFixed(2)}`;
          moneySubtitle.textContent = `${formatTime(
            totalWastedMs
          )} wasted on scrolling 😔`;
        }
      });
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function sendMessageToContentScript(enabled) {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs
          .sendMessage(tabs[0].id, {
            action: "toggleBlocking",
            enabled: enabled,
          })
          .catch(() => {
            // Tab might not have content script loaded, that's ok
          });
      }
    });
  }

  function updateUI(enabled) {
    if (enabled) {
      toggle.classList.add("active");
      statusBadge.classList.remove("inactive");
      statusText.textContent = "Active";
    } else {
      toggle.classList.remove("active");
      statusBadge.classList.add("inactive");
      statusText.textContent = "Inactive";
    }
  }

  // Cleanup interval on unload
  window.addEventListener("unload", function () {
    if (moneyUpdateInterval) {
      clearInterval(moneyUpdateInterval);
    }
  });
});
