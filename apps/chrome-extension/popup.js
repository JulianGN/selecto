/**
 * Action Popup Controller Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const toggleCheckbox = document.getElementById('inspector-toggle');
  const statusBadge = document.getElementById('status-badge');
  const capturedCountEl = document.getElementById('captured-count');
  const openPanelBtn = document.getElementById('open-panel-btn');
  const openSandboxBtn = document.getElementById('open-sandbox-btn');

  let tabId = null;

  // Query active tab to identify its key
  const activeTabs = await queryActiveTab();
  if (activeTabs[0] && activeTabs[0].id) {
    tabId = activeTabs[0].id;
  }

  // Load initial state
  await updateUIState();

  // 1. Listen to storage changes to sync popup numbers in real-time
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      updateUIState();
    }
  });

  // 2. Toggle inspector action
  toggleCheckbox.addEventListener('change', () => {
    if (!tabId) return;
    ensureScriptInjected(tabId, () => {
      chrome.tabs.sendMessage(tabId, { action: 'toggle-selection' }, (response) => {
        if (response) {
          updateBadgeState(response.active);
        }
      });
    });
  });

  // 3. Open Floating Sidebar panel button
  openPanelBtn.addEventListener('click', () => {
    if (!tabId) return;
    ensureScriptInjected(tabId, () => {
      chrome.tabs.sendMessage(tabId, { action: 'open-sidebar' }, () => {
        window.close(); // Close popup after opening sidebar
      });
    });
  });

  // 4. Open Local Sandbox tab button
  openSandboxBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('test-sdk.html') });
    window.close();
  });

  // Helper to ensure script injection
  function ensureScriptInjected(tabId, callback) {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError || !response || response.status !== 'alive') {
        // Inject scripts programmatically
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['selector-sdk.js', 'content.js']
        }).then(() => {
          setTimeout(callback, 100);
        }).catch(err => {
          alert(
            'Cannot inspect this page.\n\n' +
            'This usually happens for one of the following reasons:\n' +
            '1. You are on an internal Chrome page (e.g. chrome://extensions, chrome://newtab).\n' +
            '2. You are on the Chrome Web Store (pages protected by browser security).\n' +
            '3. This tab was already open before loading/reloading the extension. ' +
            'To solve this, simply REFRESH this tab (press F5) and try again.\n\n' +
            'Error detail: ' + err.message
          );
          toggleCheckbox.checked = !toggleCheckbox.checked;
        });
      } else {
        // Already active
        callback();
      }
    });
  }

  /**
   * Reads data from local storage and updates popup visual values.
   */
  async function updateUIState() {
    if (!tabId) return;
    const data = await getStorageData();
    
    // Update count
    const items = data.capturedItems || [];
    capturedCountEl.textContent = items.length;

    // Update checkbox and badge
    const isActive = !!data.isSelectionActive;
    toggleCheckbox.checked = isActive;
    updateBadgeState(isActive);
  }

  function updateBadgeState(isActive) {
    if (isActive) {
      statusBadge.textContent = 'Active';
      statusBadge.className = 'badge badge-active';
    } else {
      statusBadge.textContent = 'Inactive';
      statusBadge.className = 'badge badge-inactive';
    }
  }

  // Query the active tab metadata
  function queryActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs);
      });
    });
  }

  // Promise wrapper for chrome storage
  function getStorageData() {
    return new Promise((resolve) => {
      if (tabId) {
        chrome.storage.local.get(`tab_${tabId}`, (result) => {
          resolve(result[`tab_${tabId}`] || {});
        });
      } else {
        resolve({});
      }
    });
  }
});
