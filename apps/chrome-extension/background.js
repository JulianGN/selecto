/**
 * Background Service Worker
 * Listens for browser actions, keyboard shortcuts, and routes commands
 * to the content script of the active tab.
 */

// Listen for global extension command keyboard shortcuts (defined in manifest.json)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        ensureScriptInjected(tabs[0].id, () => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-selection' })
            .catch(err => console.log('Could not send message to active tab. Page might not be loaded or is a protected page.', err));
        });
      }
    });
  }
});

// Listener to handle requests from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get-tab-id') {
    sendResponse({ tabId: sender.tab ? sender.tab.id : null });
    return false; // Return false since response is synchronous
  }

  if (message.action === 'set-icon-state') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      const iconPath = message.active ? 'icon-active.svg' : 'icon.svg';
      chrome.action.setIcon({
        path: {
          "16": iconPath,
          "32": iconPath,
          "48": iconPath,
          "128": iconPath
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
  }
  return true;
});

// Clean up tab-specific storage state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`tab_${tabId}`);
});

// Helper to ensure scripts are injected dynamically on demand
function ensureScriptInjected(tabId, callback) {
  // Check if content.js is already running in the tab
  chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
    if (chrome.runtime.lastError || !response || response.status !== 'alive') {
      // Script is not running, inject it dynamically
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['selector-sdk.js', 'content.js']
      }).then(() => {
        // Allow a tiny delay for scripts to load and run listeners
        setTimeout(callback, 100);
      }).catch(err => {
        console.error('Cannot inject scripts programmatically:', err);
      });
    } else {
      // Script is already active
      callback();
    }
  });
}
