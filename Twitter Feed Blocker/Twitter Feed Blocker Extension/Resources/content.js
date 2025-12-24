// X Feed Blocker - Content Script
// Only blocks the HOME feed, not notifications, messages, explore, or profiles

(function() {
  'use strict';

  let isEnabled = true;
  let styleElement = null;
  let messageInjected = false;
  
  // Advanced blocking options (optional, no tracking)
  let advancedOptions = {
    blockNotifications: false,
    blockMessages: false,
    blockExplore: false,
    blockPost: false,
  };

  // Message displayed instead of the feed
  const blockedMessage = `
    <div class="feed-blocked-message">
      <div class="emoji">🛡️</div>
      <h2>Feed Blocked</h2>
      <p>The X home feed is hidden to boost your productivity. You can still use search, notifications, messages, and view profiles.</p>
    </div>
  `;

  // Load saved state from browser storage
  function loadState() {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get([
        'xFeedBlockerEnabled',
        'blockNotifications',
        'blockMessages',
        'blockExplore',
        'blockPost'
      ]).then((result) => {
        isEnabled = result.xFeedBlockerEnabled !== false;
        advancedOptions.blockNotifications = result.blockNotifications || false;
        advancedOptions.blockMessages = result.blockMessages || false;
        advancedOptions.blockExplore = result.blockExplore || false;
        advancedOptions.blockPost = result.blockPost || false;
        applyState();
      }).catch(() => {
        isEnabled = true;
        applyState();
      });
    } else {
      // Fallback
      isEnabled = true;
      applyState();
    }
  }

  // Listen for messages from popup
  if (typeof browser !== 'undefined' && browser.runtime) {
    browser.runtime.onMessage.addListener((message) => {
      if (message.action === 'toggleBlocking') {
        isEnabled = message.enabled;
        applyState();
      }
      if (message.action === 'updateAdvancedOptions') {
        Object.assign(advancedOptions, message.options);
        applyAdvancedBlocking();
      }
      if (message.action === 'getState') {
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
    // Remove existing advanced blocking styles
    const existingAdvancedStyle = document.getElementById('x-feed-blocker-advanced-style');
    if (existingAdvancedStyle) {
      existingAdvancedStyle.remove();
    }

    // Build CSS for advanced blocking options
    let advancedCSS = '';

    if (advancedOptions.blockNotifications) {
      advancedCSS += `
        /* Block notifications page */
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
        /* Block messages page */
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
        /* Block explore/search page */
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
        /* Block post/tweet button and composer */
        a[href="/compose/post"],
        a[data-testid="SideNav_NewTweet_Button"],
        [data-testid="toolBar"],
        [data-testid="tweetButtonInline"],
        div[aria-label*="Post text"] {
          display: none !important;
        }
      `;
    }

    // Inject advanced blocking CSS if any options are enabled
    if (advancedCSS) {
      const advancedStyleElement = document.createElement('style');
      advancedStyleElement.id = 'x-feed-blocker-advanced-style';
      advancedStyleElement.textContent = advancedCSS;
      document.head.appendChild(advancedStyleElement);
    }
  }

  function showTimeline() {
    // Remove hiding styles
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    // Remove blocked message
    const msg = document.querySelector('.feed-blocked-message');
    if (msg) msg.remove();
    messageInjected = false;

    console.log('🛡️ X Feed Blocker: Feed visible');
  }

  function hideTimeline() {
    if (!isEnabled || !isHomePage()) {
      showTimeline();
      return;
    }

    // Inject CSS to hide only home feed elements
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'x-feed-blocker-style';
      styleElement.textContent = `
        /* Only hide on home page - timeline content */
        [data-testid="primaryColumn"] section[role="region"] > div > div {
          display: none !important;
        }
        
        /* Hide the timeline tabs content area */
        [data-testid="primaryColumn"] [data-testid="cellInnerDiv"] {
          display: none !important;
        }
        
        /* Keep the header visible */
        [data-testid="primaryColumn"] > div > div:first-child {
          display: block !important;
        }
      `;
      document.head.appendChild(styleElement);
    }

    // Inject blocked message
    if (!messageInjected) {
      const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
      if (primaryColumn && !primaryColumn.querySelector('.feed-blocked-message')) {
        const section = primaryColumn.querySelector('section[role="region"]');
        if (section) {
          const messageDiv = document.createElement('div');
          messageDiv.innerHTML = blockedMessage;
          section.parentElement.insertBefore(messageDiv, section);
          messageInjected = true;
        }
      }
    }

    console.log('🛡️ X Feed Blocker: Feed hidden');
  }

  function isHomePage() {
    const path = window.location.pathname;
    return path === '/home' || path === '/' || path === '';
  }

  // Initial load
  loadState();

  // Observer for dynamic changes (X is a SPA)
  const observer = new MutationObserver(() => {
    if (isEnabled && isHomePage()) {
      hideTimeline();
    }
  });

  // Start observer when DOM is ready
  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
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

})();
