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
        // Send toggle command to content.js in the active tab
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-selection' })
          .catch(err => console.log('Could not send message to active tab. Page might not be loaded or is a protected chrome:// page.', err));
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
      const paths = message.active ? {
        "16": "icon-active-16.png",
        "32": "icon-active-48.png",
        "48": "icon-active-48.png",
        "128": "icon-active-128.png"
      } : {
        "16": "icon-16.png",
        "32": "icon-48.png",
        "48": "icon-48.png",
        "128": "icon-128.png"
      };
      chrome.action.setIcon({
        path: paths,
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
