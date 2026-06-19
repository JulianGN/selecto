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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-selection' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Error communicating with content script: ', chrome.runtime.lastError.message);
            // Revert state if we couldn't toggle
            toggleCheckbox.checked = !toggleCheckbox.checked;
            alert(
              'Cannot inspect this page.\n\n' +
              'This usually happens for one of the following reasons:\n' +
              '1. You are on an internal Chrome page (e.g. chrome://extensions, chrome://newtab).\n' +
              '2. You are on the Chrome Web Store (pages protected by browser security).\n' +
              '3. This tab was already open before loading/reloading the extension. ' +
              'To solve this, simply REFRESH this tab (press F5) and try again.'
            );
            return;
          }
          if (response) {
            updateBadgeState(response.active);
          }
        });
      }
    });
  });

  // 3. Open Floating Sidebar panel button
  openPanelBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'open-sidebar' }, () => {
          if (chrome.runtime.lastError) {
            alert(
              'Cannot open the panel on this page.\n\n' +
              'Make sure it is not an internal page (chrome://) and refresh the page (F5) ' +
              'if it was opened before the extension was installed/reloaded.'
            );
            return;
          }
          window.close(); // Close popup after opening sidebar
        });
      }
    });
  });

  // 4. Open Local Sandbox tab button
  openSandboxBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('test-sdk.html') });
    window.close();
  });

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
