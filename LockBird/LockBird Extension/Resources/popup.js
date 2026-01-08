// Popup script for LockBird: Feed Blocker with Money Tracking

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
  {
    message: "",
    phrase: "I prefer watching others live their lives instead of living mine",
  },
  {
    message: "",
    phrase: "I trade my focus and productivity for endless notifications",
  },
  {
    message: "",
    phrase: "I let algorithms decide how I spend my limited time on earth",
  },
  {
    message: "",
    phrase: "I choose short term pleasure over long term fulfillment",
  },
  {
    message: "",
    phrase: "I accept that my attention is the product being sold here",
  },
  {
    message: "",
    phrase: "I willingly feed my anxiety with constant comparison to others",
  },
  {
    message: "",
    phrase: "I choose to scroll instead of working on my goals today",
  },
  {
    message: "",
    phrase: "I let social media control my mood and self worth",
  },
  {
    message: "",
    phrase: "I trade real connections for superficial online interactions",
  },
  {
    message: "",
    phrase: "I accept losing hours of my day to content I wont remember",
  },
  {
    message: "",
    phrase: "I choose outrage and drama over peace and productivity",
  },
  {
    message: "",
    phrase: "I let strangers opinions affect my mental health daily",
  },
  {
    message: "",
    phrase: "I accept being a pawn in the attention economy game",
  },
  {
    message: "",
    phrase: "I trade my creative energy for passive consumption",
  },
  {
    message: "",
    phrase: "I choose to feel inadequate by comparing my life to highlights",
  },
  {
    message: "",
    phrase: "I willingly sacrifice my sleep for one more scroll session",
  },
  {
    message: "",
    phrase: "I accept that I am addicted and refuse to change today",
  },
  {
    message: "",
    phrase: "I let fear of missing out control my daily decisions",
  },
  {
    message: "",
    phrase: "I choose digital noise over the silence I need to think",
  },
  {
    message: "",
    phrase: "I trade my potential for temporary entertainment",
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

  // Settings
  const currentSalary = document.getElementById("currentSalary");
  const editSalaryButton = document.getElementById("editSalaryButton");

  // Advanced options
  const expandButton = document.getElementById("expandButton");
  const advancedHeader = expandButton
    ? expandButton.closest(".advanced-header")
    : null;
  const advancedContent = document.getElementById("advancedContent");
  const toggleNotifications = document.getElementById("toggleNotifications");
  const toggleMessages = document.getElementById("toggleMessages");
  const toggleExplore = document.getElementById("toggleExplore");
  const togglePost = document.getElementById("togglePost");

  let currentPhrase = null;
  let moneyUpdateInterval = null;
  let updateCounter = 0;

  // Heartbeat constant for display calculations
  const MAX_HEARTBEAT_GAP = 5 * 60 * 1000; // 5 minutes - if gap is larger, assume Safari was closed

  // Load initial state
  loadState();

  // Trigger a heartbeat in background script when popup opens
  browser.runtime.sendMessage({ action: "forceHeartbeat" }).catch(() => {
    // Background might not be ready yet, that's ok
  });

  // Setup money tracking interval with adaptive frequency
  // First 5 minutes: update every second (300 updates)
  // After 5 minutes: update every 10 seconds (performance optimization)
  moneyUpdateInterval = setInterval(() => {
    updateCounter++;
    const useSlowUpdate = updateCounter > 300; // After 5 minutes

    if (!useSlowUpdate || updateCounter % 10 === 0) {
      updateMoneyDisplay();
    }
  }, 1000);

  // Advanced options expand/collapse - make entire header clickable
  if (advancedHeader) {
    advancedHeader.addEventListener("click", function () {
      if (advancedContent && expandButton) {
        advancedContent.classList.toggle("expanded");
        expandButton.classList.toggle("expanded");
      }
    });
  }

  // Advanced toggles
  toggleNotifications.addEventListener("click", function () {
    toggleAdvancedOption("blockNotifications", toggleNotifications);
  });

  toggleMessages.addEventListener("click", function () {
    toggleAdvancedOption("blockMessages", toggleMessages);
  });

  toggleExplore.addEventListener("click", function () {
    toggleAdvancedOption("blockExplore", toggleExplore);
  });

  togglePost.addEventListener("click", function () {
    toggleAdvancedOption("blockPost", togglePost);
  });

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

  // Settings - Edit salary button
  if (editSalaryButton) {
    editSalaryButton.addEventListener("click", function () {
      showSetupModal();
    });
  }

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
    // Remove commas, dots, spaces and other non-numeric characters, then parse
    const cleanedValue = salaryInput.value.replace(/[^0-9]/g, "");
    const salary = parseInt(cleanedValue);
    if (salary && salary > 0) {
      browser.storage.local.set({ annualSalary: salary }).then(() => {
        hideSetupModal();
        // Update settings display
        if (currentSalary) {
          currentSalary.textContent = `$${salary.toLocaleString()}`;
        }
        // Update input to show clean number
        salaryInput.value = salary;
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
        "blockNotifications",
        "blockMessages",
        "blockExplore",
        "blockPost",
      ])
      .then((result) => {
        const isEnabled = result.xFeedBlockerEnabled !== false;
        updateUI(isEnabled);

        if (result.annualSalary) {
          salaryInput.value = result.annualSalary;
          // Update settings display
          if (currentSalary) {
            currentSalary.textContent = `$${result.annualSalary.toLocaleString()}`;
          }
        } else {
          // Update settings display
          if (currentSalary) {
            currentSalary.textContent = "Not set";
          }
        }

        // Load advanced options state
        if (result.blockNotifications)
          toggleNotifications.classList.add("active");
        if (result.blockMessages) toggleMessages.classList.add("active");
        if (result.blockExplore) toggleExplore.classList.add("active");
        if (result.blockPost) togglePost.classList.add("active");

        // Initialize enabledAt if extension is enabled but no timestamp exists
        // Wait for the set to complete before updating display
        if (isEnabled && !result.enabledAt) {
          browser.storage.local.set({ enabledAt: Date.now() }).then(() => {
            updateMoneyDisplay();
          });
        } else {
          updateMoneyDisplay();
        }
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

    // With heartbeat system, we DON'T calculate time here anymore
    // The heartbeat already persisted the time, we just need to switch state
    // and update the heartbeat timestamp
    browser.storage.local
      .set({
        xFeedBlockerEnabled: true,
        disabledAt: null,
        enabledAt: now,
        lastHeartbeat: now, // Reset heartbeat to avoid counting switch time twice
      })
      .then(() => {
        updateUI(true);
        sendMessageToContentScript(true);
        updateMoneyDisplay();
      });
  }

  function disableBlocking() {
    const now = Date.now();

    // With heartbeat system, we DON'T calculate time here anymore
    // The heartbeat already persisted the time, we just need to switch state
    // and update the heartbeat timestamp
    browser.storage.local
      .set({
        xFeedBlockerEnabled: false,
        disabledAt: now,
        enabledAt: null,
        lastHeartbeat: now, // Reset heartbeat to avoid counting switch time twice
      })
      .then(() => {
        updateUI(false);
        sendMessageToContentScript(false);
        updateMoneyDisplay();
      });
  }

  function checkAndResetDaily(result, callback) {
    const today = new Date().toDateString();
    const lastReset = result.lastResetDate;

    // If lastResetDate is not set, initialize it (first time user)
    if (!lastReset) {
      browser.storage.local.set({ lastResetDate: today }).then(() => {
        result.lastResetDate = today;
        if (callback) callback(result);
      });
      return true;
    }

    if (lastReset !== today) {
      const now = Date.now();
      const dailyStats = result.dailyStats || {};

      // With heartbeat system, totalTimeSaved/Wasted already contains
      // the ACTUAL time Safari was open (not theoretical time)
      // So we just save what we have for lastReset day
      const lastDayTimeSaved = result.totalTimeSaved || 0;
      const lastDayTimeWasted = result.totalTimeWasted || 0;

      // Save lastReset day's stats (this is accurate because heartbeat tracked it)
      dailyStats[lastReset] = {
        timeSaved: lastDayTimeSaved,
        timeWasted: lastDayTimeWasted,
      };

      // Handle SKIPPED DAYS - with heartbeat, Safari was closed so time = 0
      const lastResetDateObj = new Date(lastReset);
      const todayDateObj = new Date(today);
      const daysDiff = Math.floor(
        (todayDateObj - lastResetDateObj) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > 1) {
        // There are skipped days - Safari was closed, so fill with zeros
        for (let i = 1; i < daysDiff; i++) {
          const skippedDate = new Date(lastResetDateObj);
          skippedDate.setDate(skippedDate.getDate() + i);
          const skippedDateStr = skippedDate.toDateString();

          // Only add if not already in history
          if (!dailyStats[skippedDateStr]) {
            // Safari was closed on these days, so no time to count
            dailyStats[skippedDateStr] = {
              timeSaved: 0,
              timeWasted: 0,
            };
          }
        }
      }

      // Reset daily counters for today, preserve all other data
      browser.storage.local.get(null).then((allData) => {
        const newData = {
          ...allData,
          totalTimeSaved: 0,
          totalTimeWasted: 0,
          // Reset timestamps to now (heartbeat will track from here)
          enabledAt: result.xFeedBlockerEnabled ? now : null,
          disabledAt: !result.xFeedBlockerEnabled ? now : null,
          lastHeartbeat: now, // Reset heartbeat for new day
          lastResetDate: today,
          dailyStats: dailyStats,
        };

        browser.storage.local.set(newData).then(() => {
          if (callback) callback(newData);
        });
      });

      return true; // Indicates reset happened
    }
    return false;
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
        "lastResetDate",
        "dailyStats",
        "lastHeartbeat",
      ])
      .then((result) => {
        // Check if we need to reset daily stats
        const needsReset = checkAndResetDaily(result, (newData) => {
          // After reset completes, update display with new data
          displayMoney(newData);
        });

        // If no reset needed, display with current data
        if (!needsReset) {
          displayMoney(result);
        }
      });
  }

  function displayMoney(result) {
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

    // Calculate time since last heartbeat (only count if Safari was actively running)
    const lastHeartbeat = result.lastHeartbeat || now;
    const timeSinceHeartbeat = now - lastHeartbeat;
    // Only count this time if it's within the heartbeat gap (Safari was open)
    const activeSessionTime =
      timeSinceHeartbeat <= MAX_HEARTBEAT_GAP
        ? Math.max(0, timeSinceHeartbeat)
        : 0;

    // Handle undefined xFeedBlockerEnabled (default to true = enabled)
    const isEnabled = result.xFeedBlockerEnabled !== false;

    if (isEnabled) {
      // Extension is active - calculate money saved
      // totalTimeSaved already contains persisted time from heartbeats
      // Add only the time since last heartbeat (if Safari was active)
      let totalSavedMs = (result.totalTimeSaved || 0) + activeSessionTime;
      totalSavedMs = Math.max(0, totalSavedMs);

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
      // totalTimeWasted already contains persisted time from heartbeats
      // Add only the time since last heartbeat (if Safari was active)
      let totalWastedMs = (result.totalTimeWasted || 0) + activeSessionTime;
      totalWastedMs = Math.max(0, totalWastedMs);

      const hoursWasted = totalWastedMs / (1000 * 60 * 60);
      const moneyLost = hoursWasted * hourlyRate;

      moneyCard.classList.add("losing");
      moneyTitle.textContent = "💸 MONEY LOST TODAY";
      moneyAmount.textContent = `$${moneyLost.toFixed(2)}`;
      moneySubtitle.textContent = `${formatTime(
        totalWastedMs
      )} wasted on scrolling 😔`;
    }
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

  function toggleAdvancedOption(optionKey, toggleElement) {
    const isCurrentlyActive = toggleElement.classList.contains("active");
    const newState = !isCurrentlyActive;

    // Update UI
    if (newState) {
      toggleElement.classList.add("active");
    } else {
      toggleElement.classList.remove("active");
    }

    // Save to storage
    browser.storage.local.set({ [optionKey]: newState }).then(() => {
      // Send message to content script
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]) {
          browser.tabs
            .sendMessage(tabs[0].id, {
              action: "updateAdvancedOptions",
              options: {
                [optionKey]: newState,
              },
            })
            .catch(() => {
              // Tab might not have content script loaded
            });
        }
      });
    });
  }

  // Cleanup interval on unload
  window.addEventListener("unload", function () {
    if (moneyUpdateInterval) {
      clearInterval(moneyUpdateInterval);
    }
    // Trigger heartbeat in background when popup closes
    browser.runtime.sendMessage({ action: "forceHeartbeat" }).catch(() => {});
  });

  // Also trigger heartbeat when page becomes hidden
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      browser.runtime.sendMessage({ action: "forceHeartbeat" }).catch(() => {});
    }
  });
});
