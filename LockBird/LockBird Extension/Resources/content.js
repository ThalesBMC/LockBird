// LockBird: Feed Blocker - Content Script
// Runs on ALL pages for time tracking
// Blocks feed only on Twitter/X

(function () {
  "use strict";

  // ============================================
  // HEARTBEAT SYSTEM - Runs on ALL pages
  // ============================================

  let heartbeatInterval = null;

  // Heartbeat constants
  const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
  const MAX_HEARTBEAT_GAP = 5 * 60 * 1000; // 5 minutes
  const MIN_HEARTBEAT_GAP = 1000; // 1 second - prevent double counting

  function saveHeartbeat() {
    if (typeof browser === "undefined" || !browser.storage) return;

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

          // Skip if gap is too small (prevents double counting from multiple tabs/scripts)
          if (gap < MIN_HEARTBEAT_GAP) {
            return;
          }

          // Only count time if gap is reasonable (was actively tracking)
          if (gap > 0 && gap <= MAX_HEARTBEAT_GAP) {
            const isBlockerEnabled = result.xFeedBlockerEnabled !== false;

            if (isBlockerEnabled) {
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
            // Gap too large - tracking was interrupted, just update heartbeat
            browser.storage.local.set({ lastHeartbeat: now });
          }
        } else {
          // First heartbeat ever
          browser.storage.local.set({ lastHeartbeat: now });
        }
      })
      .catch((error) => {
        console.error("🛡️ LockBird: Heartbeat error", error);
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
    const isBlockerEnabled = result.xFeedBlockerEnabled !== false;

    browser.storage.local.set({
      totalTimeSaved: 0,
      totalTimeWasted: 0,
      enabledAt: isBlockerEnabled ? now : null,
      disabledAt: !isBlockerEnabled ? now : null,
      lastHeartbeat: now,
      lastResetDate: today,
      dailyStats: dailyStats,
    });

    console.log("🛡️ LockBird: Daily stats reset for", today);
  }

  function startHeartbeat() {
    // Save initial heartbeat immediately
    saveHeartbeat();

    // Continue heartbeat every 30 seconds
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    heartbeatInterval = setInterval(() => {
      saveHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    // Save final heartbeat
    saveHeartbeat();
  }

  // Start heartbeat when page loads
  startHeartbeat();

  // Handle page visibility changes
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      // User came back to this tab - restart heartbeat
      startHeartbeat();
    } else {
      // User left this tab - save and stop
      stopHeartbeat();
    }
  });

  // Save heartbeat when leaving page
  window.addEventListener("beforeunload", function () {
    saveHeartbeat();
  });

  // ============================================
  // END HEARTBEAT SYSTEM
  // ============================================

  // ============================================
  // TWITTER/X BLOCKING - Only runs on Twitter
  // ============================================

  function isTwitterSite() {
    const hostname = window.location.hostname;
    return (
      hostname === "twitter.com" ||
      hostname === "x.com" ||
      hostname === "mobile.twitter.com" ||
      hostname.endsWith(".twitter.com") ||
      hostname.endsWith(".x.com")
    );
  }

  // Only run blocking logic on Twitter/X
  if (!isTwitterSite()) {
    return; // Exit early for non-Twitter sites
  }

  // --- Twitter-specific code below ---

  let isEnabled = true;
  let styleElement = null;
  let messageInjected = false;

  // Advanced blocking options
  let advancedOptions = {
    blockNotifications: false,
    blockMessages: false,
    blockExplore: false,
    blockPost: false,
    blockHome: false,
    blockTrending: false,
    blockRightSidebar: false,
    blockGrok: false,
    blockCommunities: false,
    blockLists: false,
    blockBookmarks: false,
  };

  // Message displayed instead of the feed
  const blockedMessage = `
    <div class="feed-blocked-message">
      <div class="emoji">🛡️</div>
      <h2>Feed Blocked</h2>
      <p>The home feed is hidden to boost your productivity. You can still use search, notifications, messages, and view profiles.</p>
    </div>
  `;

  // Load saved state from browser storage
  function loadState() {
    if (typeof browser !== "undefined" && browser.storage) {
      browser.storage.local
        .get([
          "xFeedBlockerEnabled",
          "blockNotifications",
          "blockMessages",
          "blockExplore",
          "blockPost",
          "blockHome",
          "blockTrending",
          "blockRightSidebar",
          "blockGrok",
          "blockCommunities",
          "blockLists",
          "blockBookmarks",
        ])
        .then((result) => {
          isEnabled = result.xFeedBlockerEnabled !== false;
          advancedOptions.blockNotifications =
            result.blockNotifications || false;
          advancedOptions.blockMessages = result.blockMessages || false;
          advancedOptions.blockExplore = result.blockExplore || false;
          advancedOptions.blockPost = result.blockPost || false;
          advancedOptions.blockHome = result.blockHome || false;
          advancedOptions.blockTrending = result.blockTrending || false;
          advancedOptions.blockRightSidebar = result.blockRightSidebar || false;
          advancedOptions.blockGrok = result.blockGrok || false;
          advancedOptions.blockCommunities = result.blockCommunities || false;
          advancedOptions.blockLists = result.blockLists || false;
          advancedOptions.blockBookmarks = result.blockBookmarks || false;
          applyState();
        })
        .catch(() => {
          isEnabled = true;
          applyState();
        });
    } else {
      isEnabled = true;
      applyState();
    }
  }

  // Listen for messages from popup
  if (typeof browser !== "undefined" && browser.runtime) {
    browser.runtime.onMessage.addListener((message) => {
      if (message.action === "toggleBlocking") {
        isEnabled = message.enabled;
        applyState();
      }
      if (message.action === "updateAdvancedOptions") {
        Object.assign(advancedOptions, message.options);
        applyAdvancedBlocking();
      }
      if (message.action === "getState") {
        return Promise.resolve({ enabled: isEnabled });
      }
    });
  }

  function applyState() {
    if (isEnabled && isHomePage()) {
      hideTimeline();
    } else {
      showTimeline();
    }
    applyAdvancedBlocking();
  }

  function applyAdvancedBlocking() {
    const existingAdvancedStyle = document.getElementById(
      "x-feed-blocker-advanced-style"
    );
    if (existingAdvancedStyle) {
      existingAdvancedStyle.remove();
    }

    let advancedCSS = "";

    if (advancedOptions.blockNotifications) {
      advancedCSS += `
        a[href="/notifications"],
        a[aria-label*="Notifications"] {
          pointer-events: none;
          opacity: 0.3;
        }
        [data-testid="primaryColumn"] div[aria-label*="Timeline: Notifications"] {
          display: none !important;
        }
      `;
    }

    if (advancedOptions.blockMessages) {
      advancedCSS += `
        a[href="/messages"],
        a[aria-label*="Direct Messages"] {
          pointer-events: none;
          opacity: 0.3;
        }
        [data-testid="DMDrawer"],
        [data-testid="primaryColumn"] div[aria-label*="Timeline: Messages"] {
          display: none !important;
        }
      `;
    }

    if (advancedOptions.blockExplore) {
      advancedCSS += `
        a[href="/explore"],
        a[href*="/search"],
        a[aria-label*="Search and explore"] {
          pointer-events: none;
          opacity: 0.3;
        }
        [data-testid="primaryColumn"] div[aria-label*="Search"] {
          display: none !important;
        }
      `;
    }

    if (advancedOptions.blockPost) {
      advancedCSS += `
        a[href="/compose/post"],
        a[data-testid="SideNav_NewTweet_Button"],
        [data-testid="toolBar"],
        [data-testid="tweetButtonInline"],
        div[aria-label*="Post text"] {
          display: none !important;
        }
      `;
    }

    if (advancedOptions.blockHome) {
      advancedCSS += `
        a[href="/home"],
        a[aria-label="Home"],
        a[data-testid="AppTabBar_Home_Link"] {
          pointer-events: none;
          opacity: 0.3;
        }
      `;
    }

    if (advancedOptions.blockTrending) {
      advancedCSS += `
        [data-testid="sidebarColumn"] [aria-label="Timeline: Trending now"],
        [data-testid="trend"],
        div[aria-label*="Timeline: Trending"],
        section[aria-labelledby*="accessible-list"] div[data-testid="trend"],
        [data-testid="sidebarColumn"] section:has([data-testid="trend"]),
        aside[aria-label*="What"] {
          display: none !important;
        }
      `;
    }

    if (advancedOptions.blockRightSidebar) {
      advancedCSS += `
        [data-testid="sidebarColumn"] {
          display: none !important;
        }
      `;
    }

    if (advancedOptions.blockGrok) {
      advancedCSS += `
        a[href="/i/grok"],
        a[aria-label="Grok"],
        [data-testid="grokDrawer"],
        a[href*="grok"] {
          pointer-events: none;
          opacity: 0.3;
        }
        [data-testid="grokDrawer"] {
          display: none !important;
        }
      `;
    }

    if (advancedOptions.blockCommunities) {
      advancedCSS += `
        a[href*="/communities"],
        a[aria-label="Communities"] {
          pointer-events: none;
          opacity: 0.3;
        }
      `;
    }

    if (advancedOptions.blockLists) {
      advancedCSS += `
        a[href*="/lists"],
        a[aria-label="Lists"] {
          pointer-events: none;
          opacity: 0.3;
        }
      `;
    }

    if (advancedOptions.blockBookmarks) {
      advancedCSS += `
        a[href="/i/bookmarks"],
        a[aria-label="Bookmarks"] {
          pointer-events: none;
          opacity: 0.3;
        }
      `;
    }

    if (advancedCSS) {
      const advancedStyleElement = document.createElement("style");
      advancedStyleElement.id = "x-feed-blocker-advanced-style";
      advancedStyleElement.textContent = advancedCSS;
      document.head.appendChild(advancedStyleElement);
    }
  }

  function showTimeline() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    const msg = document.querySelector(".feed-blocked-message");
    if (msg) msg.remove();
    messageInjected = false;
  }

  function hideTimeline() {
    if (!isEnabled || !isHomePage()) {
      showTimeline();
      return;
    }

    // Ensure style element exists and is in the document
    if (!styleElement || !document.head.contains(styleElement)) {
      if (styleElement) styleElement.remove();
      styleElement = document.createElement("style");
      styleElement.id = "x-feed-blocker-style";
      styleElement.textContent = `
        [data-testid="primaryColumn"] section[role="region"] > div > div {
          display: none !important;
        }
        [data-testid="primaryColumn"] [data-testid="cellInnerDiv"] {
          display: none !important;
        }
        [data-testid="primaryColumn"] > div > div:first-child {
          display: block !important;
        }
        /* Also hide "For you" and "Following" tabs content */
        [data-testid="primaryColumn"] div[aria-label*="Timeline"] > div {
          display: none !important;
        }
      `;
      document.head.appendChild(styleElement);
    }

    // Try to inject message
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    if (!primaryColumn) return;

    const existingMessage = primaryColumn.querySelector(".feed-blocked-message");
    
    if (!existingMessage) {
      const section = primaryColumn.querySelector('section[role="region"]');
      if (section && section.parentElement) {
        const messageDiv = document.createElement("div");
        messageDiv.innerHTML = blockedMessage;
        section.parentElement.insertBefore(messageDiv, section);
        messageInjected = true;
      } else {
        // Fallback: try to insert in primaryColumn directly if section not found
        const firstChild = primaryColumn.querySelector('div > div');
        if (firstChild) {
          const messageDiv = document.createElement("div");
          messageDiv.innerHTML = blockedMessage;
          firstChild.parentElement.insertBefore(messageDiv, firstChild.nextSibling);
          messageInjected = true;
        }
      }
    } else {
      messageInjected = true;
    }
  }

  function isHomePage() {
    const path = window.location.pathname;
    return path === "/home" || path === "/" || path === "";
  }

  // Initial load
  loadState();

  // Observer for dynamic changes (X is a SPA)
  const observer = new MutationObserver(() => {
    if (isEnabled && isHomePage()) {
      hideTimeline();
    }
  });

  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver);
  }

  // Re-run on navigation (X uses History API)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      messageInjected = false;
      applyState();
    }
  }).observe(document, { subtree: true, childList: true });

  // Intercept History API for more reliable navigation detection
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    handleNavigation();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    handleNavigation();
  };

  window.addEventListener("popstate", handleNavigation);

  function handleNavigation() {
    messageInjected = false;
    // Small delay to let Twitter render the new page
    setTimeout(() => {
      applyState();
    }, 100);
    // Double check after content loads
    setTimeout(() => {
      applyState();
    }, 500);
  }

  // Periodic check to ensure blocking stays active (catches edge cases)
  setInterval(() => {
    if (isEnabled && isHomePage()) {
      const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
      const existingMessage = primaryColumn?.querySelector(".feed-blocked-message");
      const styleExists = document.head.contains(styleElement);
      
      // Re-apply if message is missing or style was removed
      if (!existingMessage || !styleExists) {
        messageInjected = false;
        hideTimeline();
      }
    }
  }, 500); // Check every 500ms for faster response

  // Intercept clicks on Home button, logo, and navigation links
  document.addEventListener("click", function (e) {
    // Check for home navigation elements
    const homeTarget = e.target.closest(
      'a[href="/home"], ' +
      'a[data-testid="AppTabBar_Home_Link"], ' +
      'a[aria-label="Home"], ' +
      'a[aria-label="X"], ' +  // Twitter/X logo
      'h1 a[href="/home"], ' + // Header logo link
      '[data-testid="twitterCloseIcon"]'
    );
    
    if (homeTarget && isEnabled) {
      // Delay to let navigation complete, then apply blocking
      setTimeout(() => {
        messageInjected = false;
        applyState();
      }, 150);
      setTimeout(() => {
        applyState();
      }, 400);
      setTimeout(() => {
        applyState();
      }, 800);
    }
  }, true);

  // Also watch for navigation via keyboard (Enter on focused link)
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.matches && 
          activeElement.matches('a[href="/home"], a[data-testid="AppTabBar_Home_Link"], a[aria-label="Home"]')) {
        if (isEnabled) {
          setTimeout(() => {
            messageInjected = false;
            applyState();
          }, 200);
        }
      }
    }
  }, true);

  // Focus/visibility change - recheck when user returns to tab
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && isEnabled && isHomePage()) {
      setTimeout(() => {
        applyState();
      }, 100);
    }
  });

  // Window focus - recheck blocking
  window.addEventListener("focus", function () {
    if (isEnabled && isHomePage()) {
      setTimeout(() => {
        applyState();
      }, 100);
    }
  });
})();
