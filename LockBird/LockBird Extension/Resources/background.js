// Background script for LockBird: Feed Blocker
// Fallback heartbeat when no tabs are open
// Main heartbeat is done by content.js (more reliable in Safari)

(function () {
  "use strict";

  // Heartbeat constants
  const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
  const MAX_HEARTBEAT_GAP = 5 * 60 * 1000; // 5 minutes
  const MIN_HEARTBEAT_GAP = 1000; // 1 second - prevent double counting with content.js

  let heartbeatTimer = null;

  // Initialize
  initialize();

  function initialize() {
    console.log("🛡️ LockBird Background: Starting...");

    // Start fallback heartbeat
    startHeartbeat();

    // Listen for messages from popup/content scripts
    browser.runtime.onMessage.addListener(handleMessage);

    console.log("🛡️ LockBird Background: Initialized");
  }

  function startHeartbeat() {
    // Clear any existing timer
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }

    // Save initial heartbeat
    saveHeartbeat();

    // Run heartbeat every 30 seconds as fallback
    heartbeatTimer = setInterval(() => {
      saveHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }

  function handleMessage(message, sender, sendResponse) {
    if (message.action === "getHeartbeatStatus") {
      browser.storage.local
        .get(["lastHeartbeat", "totalTimeSaved", "totalTimeWasted"])
        .then((result) => {
          sendResponse({
            lastHeartbeat: result.lastHeartbeat,
            totalTimeSaved: result.totalTimeSaved,
            totalTimeWasted: result.totalTimeWasted,
          });
        });
      return true; // Keep channel open for async response
    }

    if (message.action === "forceHeartbeat") {
      saveHeartbeat();
      sendResponse({ success: true });
      return true;
    }
  }

  function saveHeartbeat() {
    const now = Date.now();
    const today = new Date().toDateString();

    browser.storage.local
      .get([
        "lastHeartbeat",
        "xFeedBlockerEnabled",
        "totalTimeSaved",
        "totalTimeWasted",
        "lastResetDate",
        "dailyStats",
      ])
      .then((result) => {
        const lastHeartbeat = result.lastHeartbeat;
        const lastResetDate = result.lastResetDate;

        // Check if day changed - reset daily stats
        if (lastResetDate && lastResetDate !== today) {
          resetDailyStats(result, now, today);
          return;
        }

        // Initialize lastResetDate if not set
        if (!lastResetDate) {
          browser.storage.local.set({
            lastResetDate: today,
            lastHeartbeat: now,
          });
          return;
        }

        // If there's a previous heartbeat, calculate time to add
        if (lastHeartbeat) {
          const gap = now - lastHeartbeat;

          // Skip if gap is too small (content.js probably just saved)
          // This prevents double counting when both are running
          if (gap < MIN_HEARTBEAT_GAP) {
            return;
          }

          // Only count time if gap is reasonable
          if (gap > 0 && gap <= MAX_HEARTBEAT_GAP) {
            const isEnabled = result.xFeedBlockerEnabled !== false;

            if (isEnabled) {
              const newTotal = (result.totalTimeSaved || 0) + gap;
              browser.storage.local.set({
                lastHeartbeat: now,
                totalTimeSaved: newTotal,
              });
            } else {
              const newTotal = (result.totalTimeWasted || 0) + gap;
              browser.storage.local.set({
                lastHeartbeat: now,
                totalTimeWasted: newTotal,
              });
            }
          } else {
            // Gap too large - Safari was closed, just update heartbeat
            browser.storage.local.set({ lastHeartbeat: now });
          }
        } else {
          // First heartbeat ever
          browser.storage.local.set({ lastHeartbeat: now });
        }
      })
      .catch((error) => {
        console.error("🛡️ LockBird Background: Heartbeat error", error);
      });
  }

  function resetDailyStats(result, now, today) {
    const dailyStats = result.dailyStats || {};
    const lastReset = result.lastResetDate;

    // Save previous day's stats
    dailyStats[lastReset] = {
      timeSaved: result.totalTimeSaved || 0,
      timeWasted: result.totalTimeWasted || 0,
    };

    // Handle skipped days
    const lastResetDateObj = new Date(lastReset);
    const todayDateObj = new Date(today);
    const daysDiff = Math.floor(
      (todayDateObj - lastResetDateObj) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > 1) {
      for (let i = 1; i < daysDiff; i++) {
        const skippedDate = new Date(lastResetDateObj);
        skippedDate.setDate(skippedDate.getDate() + i);
        const skippedDateStr = skippedDate.toDateString();

        if (!dailyStats[skippedDateStr]) {
          dailyStats[skippedDateStr] = { timeSaved: 0, timeWasted: 0 };
        }
      }
    }

    // Reset for new day
    const isEnabled = result.xFeedBlockerEnabled !== false;

    browser.storage.local.set({
      totalTimeSaved: 0,
      totalTimeWasted: 0,
      enabledAt: isEnabled ? now : null,
      disabledAt: !isEnabled ? now : null,
      lastHeartbeat: now,
      lastResetDate: today,
      dailyStats: dailyStats,
    });

    console.log("🛡️ LockBird Background: Daily stats reset for", today);
  }
})();
