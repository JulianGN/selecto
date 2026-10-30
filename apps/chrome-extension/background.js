/**
 * Background Service Worker
 * Listens for browser actions, keyboard shortcuts, and routes commands
 * to the content script of the active tab.
 */

// 1. Listen for clicks on the extension toolbar icon (One-Click Activation)
chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;
  if (isProtectedUrl(tab.url)) {
    console.warn('Cannot inspect protected page:', tab.url);
    return;
  }
  ensureScriptInjected(tab.id, () => sendToggle(tab.id));
});

// 2. Listen for global extension command keyboard shortcuts (defined in manifest.json)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (activeTab && activeTab.id) {
        if (isProtectedUrl(activeTab.url)) {
          console.warn('Cannot inspect protected page:', activeTab.url);
          return;
        }
        ensureScriptInjected(activeTab.id, () => sendToggle(activeTab.id));
      }
    });
  }
});

// Listener to handle requests from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get-tab-id') {
    if (sender.tab && sender.tab.id) {
      sendResponse({ tabId: sender.tab.id });
      return false;
    }
    // Fallback for frames where sender.tab might be omitted
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tabId: tabs && tabs[0] && tabs[0].id ? tabs[0].id : null });
    });
    return true; // Keep message port open for async response
  }

  if (message.action === 'set-icon-state') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      // setIcon does not support SVG: use the PNG sets
      const prefix = message.active ? 'icon-active' : 'icon';
      chrome.action.setIcon({
        path: {
          "16": `${prefix}-16.png`,
          "32": `${prefix}-48.png`,
          "48": `${prefix}-48.png`,
          "128": `${prefix}-128.png`
        },
        tabId: tabId
      }).then(() => {
        sendResponse({ success: true });
      }).catch(err => {
        console.log('Error setting icon: ', err);
        sendResponse({ success: false, error: err.message });
      });
      return true; // Keep channel open for async response
    }
    sendResponse({ success: false });
    return false;
  }

  return false;
});

// Clean up tab-specific storage state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`tab_${tabId}`);
});

// Sends the toggle command to the top frame only
function sendToggle(tabId) {
  chrome.tabs.sendMessage(tabId, { action: 'toggle-action' }, { frameId: 0 })
    .catch(err => console.log('Could not send message to active tab:', err));
}

// Helper to ensure scripts are injected dynamically on demand
function ensureScriptInjected(tabId, callback) {
  // Ping the top frame to check whether content.js is already running
  chrome.tabs.sendMessage(tabId, { action: 'ping' }, { frameId: 0 }, (response) => {
    if (!chrome.runtime.lastError && response && response.status === 'alive') {
      callback();
      return;
    }

    // 1. Top frame (guaranteed by activeTab)
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['selector-sdk.js', 'content.js']
    }).then(() => {
      // Listener is registered synchronously during script execution
      callback();

      // 2. Eligible iframes (same-origin / inline); restricted ones are ignored
      chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        files: ['selector-sdk.js', 'content.js']
      }).catch(() => {});
    }).catch(err => {
      console.error('Cannot inject scripts programmatically:', err);
    });
  });
}

// Check if a URL is an internal or protected browser page
function isProtectedUrl(url) {
  if (!url) return false;
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') || 
         url.startsWith('edge://') || 
         url.startsWith('about:') || 
         url.startsWith('devtools://') || 
         url.startsWith('view-source:') ||
         url.includes('chrome.google.com/webstore') ||
         url.includes('chromewebstore.google.com');
}
