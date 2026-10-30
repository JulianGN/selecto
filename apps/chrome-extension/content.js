/**
 * Chrome Extension Content Script
 * Integrates Selector SDK and renders the floating Clipboard UI inside a Shadow DOM.
 */

(function () {
  'use strict';

  if (window.__SELECTO_CONTENT_SCRIPT_LOADED__) {
    return;
  }
  window.__SELECTO_CONTENT_SCRIPT_LOADED__ = true;

  // Frame identification
  const isTopFrame = window.self === window.top;

  // State
  let capturedItems = [];
  let defaultFormat = 'css'; // 'css', 'xpath', 'playwright', 'cypress'
  let isSidebarOpen = false;
  let isSelectionActive = false;
  let dimBackground = true;
  let fadeOpacity = 0.6;
  let showLabel = true;
  let tabId = null;

  // DOM references inside Shadow DOM
  let shadowRoot = null;
  let sidebarEl = null;
  let inspector = null;

  // Storage key depends on tabId: writes are queued until it is known
  let resolveTabIdReady;
  const tabIdReady = new Promise((resolve) => { resolveTabIdReady = resolve; });
  let storageQueue = Promise.resolve();

  // 1. Message listener first, so commands are never lost
  setupMessageListener();

  // 2. Inspector created synchronously: never null when a command arrives
  inspector = new ElementInspector({
    enableFade: dimBackground,
    fadeOpacity: fadeOpacity,
    showLabel: showLabel,
    excludeFilter: (el) => {
      // Exclude the extension wrapper, simulated popup/icon in simulation, and overlay highlight itself
      return el.id === 'selector-extension-root' ||
             (el.closest && el.closest('#selector-extension-root')) ||
             el.id === 'selector-sdk-overlay' ||
             (el.closest && el.closest('.simulated-extension-container')) ||
             (isTopFrame && el.tagName === 'IFRAME');
    },
    onHover: () => {},
    onSelect: (element, selectorData) => {
      addCapturedItem(selectorData);
    }
  });

  // 3. Remove overlays orphaned by a previous (reloaded) extension context
  document.querySelectorAll('#selector-sdk-overlay').forEach((el) => el.remove());

  // 4. UI injected synchronously (top frame only)
  if (isTopFrame) {
    injectUI();
  }

  // 5. Async hydration (tabId, captured items and settings)
  init();

  /**
   * Hydrates persisted data. Open/active flags are NOT restored from storage on
   * the top frame: a fresh injection always starts closed, avoiding stale toggles.
   */
  async function init() {
    tabId = await requestTabId();
    resolveTabIdReady(tabId);

    const state = await getStorageData();
    capturedItems = state.capturedItems || [];
    if (state.defaultFormat) defaultFormat = state.defaultFormat;
    if (state.dimBackground !== undefined) dimBackground = state.dimBackground;
    if (state.fadeOpacity !== undefined) fadeOpacity = state.fadeOpacity;
    if (state.showLabel !== undefined) showLabel = state.showLabel;

    inspector.setEnableFade(dimBackground);
    inspector.setFadeOpacity(fadeOpacity);
    inspector.setShowLabel(showLabel);

    if (isTopFrame) {
      syncSettingsUI();
      restoreSidebarPosition(state.sidebarPosition);
      renderElementsList();
      // Local state is authoritative: overwrite stale flags from previous page loads
      saveStorageData({ isSelectionActive, isSidebarOpen });
    } else if (state.isSelectionActive) {
      // Child frame joining an active inspection session
      isSelectionActive = true;
      inspector.start();
    }

    setupStorageSync();
  }

  /**
   * Syncs settings controls inside the Shadow DOM with the current state.
   */
  function syncSettingsUI() {
    if (!shadowRoot) return;
    const radio = shadowRoot.querySelector(`input[name="selector-format"][value="${defaultFormat}"]`);
    if (radio) radio.checked = true;
    const dimCheckbox = shadowRoot.getElementById('dim-background-checkbox');
    if (dimCheckbox) dimCheckbox.checked = dimBackground;
    const intensityContainer = shadowRoot.getElementById('fade-intensity-container');
    if (intensityContainer) intensityContainer.style.display = dimBackground ? 'flex' : 'none';
    const opacitySlider = shadowRoot.getElementById('fade-opacity-slider');
    if (opacitySlider) opacitySlider.value = fadeOpacity;
    const opacityValSpan = shadowRoot.getElementById('fade-opacity-val');
    if (opacityValSpan) opacityValSpan.textContent = `${Math.round(fadeOpacity * 100)}%`;
    const showLabelCheckbox = shadowRoot.getElementById('show-label-checkbox');
    if (showLabelCheckbox) showLabelCheckbox.checked = showLabel;
  }

  /**
   * Restores the dragged sidebar position, ignoring values outside the viewport.
   */
  function restoreSidebarPosition(pos) {
    if (!sidebarEl || !pos) return;
    const valid = Number.isFinite(pos.left) && Number.isFinite(pos.top) &&
      pos.left >= 0 && pos.top >= 0 &&
      pos.left <= window.innerWidth - 100 && pos.top <= window.innerHeight - 100;
    if (!valid) return;
    sidebarEl.style.right = 'auto';
    sidebarEl.style.bottom = 'auto';
    sidebarEl.style.left = `${pos.left}px`;
    sidebarEl.style.top = `${pos.top}px`;
  }

  /**
   * Creates the Shadow DOM container to isolate extension UI styles.
   */
  function injectUI() {
    if (!isTopFrame) return;

    const existingRoot = document.getElementById('selector-extension-root');
    if (existingRoot && existingRoot.parentNode) {
      existingRoot.parentNode.removeChild(existingRoot);
    }

    const root = document.createElement('div');
    root.id = 'selector-extension-root';
    Object.assign(root.style, {
      position: 'relative',
      zIndex: '2147483647'
    });
    
    // Inject stylesheet wrapper
    shadowRoot = root.attachShadow({ mode: 'closed' });
    document.body.appendChild(root);

    // Create stylesheet element
    const style = document.createElement('style');
    style.textContent = getSidebarStyles();
    shadowRoot.appendChild(style);

    // Create Main Sidebar Wrapper
    sidebarEl = document.createElement('div');
    sidebarEl.id = 'selector-sidebar';
    sidebarEl.className = isSidebarOpen ? 'open' : '';
    
    sidebarEl.innerHTML = `
      <div class="sidebar-header">
        <div class="header-title-area">
          <div class="app-logo">
            <svg viewBox="0 0 128 128" width="18" height="18" fill="none">
              <rect x="12" y="12" width="104" height="104" rx="20" stroke="currentColor" stroke-width="8" stroke-dasharray="14 10" />
              <rect x="34" y="34" width="60" height="60" rx="10" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="6" />
            </svg>
          </div>
          <div>
            <h3>Selecto</h3>
            <div class="status-indicator">
              <span class="status-dot ${isSelectionActive ? 'active' : ''}"></span>
              <span class="status-text">${isSelectionActive ? chrome.i18n.getMessage('inspectorActive') : chrome.i18n.getMessage('inspectorInactive')}</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button id="gear-btn" title="${chrome.i18n.getMessage('settingsBtnTitle')}" class="icon-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button id="close-sidebar-btn" title="${chrome.i18n.getMessage('closeSidebarBtnTitle')}" class="icon-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <div class="sidebar-controls">
        <span class="control-label">${chrome.i18n.getMessage('enableSelection')}</span>
        <label class="switch">
          <input type="checkbox" id="inspector-toggle-checkbox" ${isSelectionActive ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <!-- Settings Panel (hidden by default) -->
      <div id="settings-panel" class="settings-drawer">
        <h4>${chrome.i18n.getMessage('selectorSettings')}</h4>
        <div class="setting-group">
          <label>${chrome.i18n.getMessage('outputFormat')}</label>
          <div class="radio-options">
            <label class="radio-label">
              <input type="radio" name="selector-format" value="css" ${defaultFormat === 'css' ? 'checked' : ''}>
              CSS Selector
            </label>
            <label class="radio-label">
              <input type="radio" name="selector-format" value="xpath" ${defaultFormat === 'xpath' ? 'checked' : ''}>
              XPath
            </label>
            <label class="radio-label">
              <input type="radio" name="selector-format" value="playwright" ${defaultFormat === 'playwright' ? 'checked' : ''}>
              Playwright Locator
            </label>
            <label class="radio-label">
              <input type="radio" name="selector-format" value="cypress" ${defaultFormat === 'cypress' ? 'checked' : ''}>
              Cypress cy.get()
            </label>
          </div>
        </div>
        <div class="setting-group" style="margin-top: 12px; margin-bottom: 16px;">
          <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 11px; user-select: none; color: var(--text-secondary);">
            <input type="checkbox" id="dim-background-checkbox" ${dimBackground ? 'checked' : ''} style="accent-color: var(--accent); margin: 0; width: 14px; height: 14px;">
            ${chrome.i18n.getMessage('dimBackground')}
          </label>
          <div id="fade-intensity-container" style="margin-top: 8px; display: ${dimBackground ? 'flex' : 'none'}; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted);">
              <span>${chrome.i18n.getMessage('dimIntensity')}</span>
              <span id="fade-opacity-val">${Math.round(fadeOpacity * 100)}%</span>
            </div>
            <input type="range" id="fade-opacity-slider" min="0.1" max="0.9" step="0.05" value="${fadeOpacity}" style="accent-color: var(--accent); width: 100%; cursor: pointer; background: rgba(255,255,255,0.1); height: 4px; border-radius: 2px; outline: none; margin: 4px 0;">
          </div>
        </div>
        <div class="setting-group" style="margin-top: 12px; margin-bottom: 16px;">
          <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 11px; user-select: none; color: var(--text-secondary);">
            <input type="checkbox" id="show-label-checkbox" ${showLabel ? 'checked' : ''} style="accent-color: var(--accent); margin: 0; width: 14px; height: 14px;">
            ${chrome.i18n.getMessage('showElementLabels')}
          </label>
        </div>
        <div class="settings-footer-links">
          <a href="https://juliangn.github.io/selecto/" target="_blank" rel="noopener noreferrer" class="discrete-link" title="Website Oficial">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Website Oficial
          </a>
          <a href="https://github.com/juliangn/selecto" target="_blank" rel="noopener noreferrer" class="discrete-link" title="GitHub">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            GitHub
          </a>
        </div>
      </div>

      <!-- Scrollable Elements List -->
      <div class="list-container">
        <div id="empty-state" class="${capturedItems.length === 0 ? '' : 'hidden'}">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin-bottom: 12px;">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>
          </svg>
          <p>${chrome.i18n.getMessage('noElementsCaptured')}</p>
          <span style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 4px;">${chrome.i18n.getMessage('noElementsCapturedSub')}</span>
        </div>
        <div id="elements-list" class="elements-list">
          <!-- Items injected dynamically -->
        </div>
      </div>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <button id="copy-all-btn" class="btn btn-secondary ${capturedItems.length === 0 ? 'disabled' : ''}">${chrome.i18n.getMessage('copyAll')}</button>
        <button id="export-json-btn" class="btn btn-primary ${capturedItems.length === 0 ? 'disabled' : ''}">${chrome.i18n.getMessage('export')}</button>
        <button id="clear-all-btn" class="btn btn-danger ${capturedItems.length === 0 ? 'disabled' : ''}" title="${chrome.i18n.getMessage('clearAll')}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
    `;

    shadowRoot.appendChild(sidebarEl);

    // Setup Sidebar Dragging logic
    const header = sidebarEl.querySelector('.sidebar-header');
    let isDraggingSidebar = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.header-actions')) return;
      isDraggingSidebar = true;
      header.classList.add('grabbing');
      
      const rect = sidebarEl.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingSidebar) return;
      
      let left = e.clientX - dragOffsetX;
      let top = e.clientY - dragOffsetY;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const sidebarWidth = sidebarEl.offsetWidth;
      const sidebarHeight = sidebarEl.offsetHeight;
      
      left = Math.max(10, Math.min(left, viewportWidth - sidebarWidth - 10));
      top = Math.max(10, Math.min(top, viewportHeight - sidebarHeight - 10));
      
      sidebarEl.style.right = 'auto';
      sidebarEl.style.bottom = 'auto';
      sidebarEl.style.left = `${left}px`;
      sidebarEl.style.top = `${top}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingSidebar) {
        isDraggingSidebar = false;
        header.classList.remove('grabbing');
        
        // Save position in storage
        const rect = sidebarEl.getBoundingClientRect();
        saveStorageData({
          sidebarPosition: {
            left: rect.left,
            top: rect.top
          }
        });
      }
    });

    // Attach DOM Event Listeners
    setupUIListeners();
    renderElementsList();
  }

  /**
   * Binds user event handlers to elements inside the Shadow DOM.
   */
  function setupUIListeners() {
    // 1. Selector toggle checkbox
    const toggleCheckbox = shadowRoot.getElementById('inspector-toggle-checkbox');
    toggleCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        startSelection();
      } else {
        stopSelection();
      }
    });

    // 2. Settings button (gear) with active highlight and click-outside close
    const gearBtn = shadowRoot.getElementById('gear-btn');
    const settingsPanel = shadowRoot.getElementById('settings-panel');

    function closeSettingsDrawer() {
      if (settingsPanel && settingsPanel.classList.contains('open')) {
        settingsPanel.classList.remove('open');
        if (gearBtn) gearBtn.classList.remove('active');
      }
    }

    gearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = settingsPanel.classList.toggle('open');
      gearBtn.classList.toggle('active', isOpen);
    });

    // Close settings drawer when clicking outside within the sidebar
    shadowRoot.addEventListener('click', (e) => {
      if (!settingsPanel || !settingsPanel.classList.contains('open')) return;
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (!path.includes(settingsPanel) && !path.includes(gearBtn)) {
        closeSettingsDrawer();
      }
    });

    // Close settings drawer when clicking anywhere on the host page.
    // pointerdown is used because the inspector stops click propagation.
    window.addEventListener('pointerdown', (e) => {
      if (!settingsPanel || !settingsPanel.classList.contains('open')) return;
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (path.some((node) => node && node.id === 'selector-extension-root')) return;
      closeSettingsDrawer();
    }, true);

    // 2b. Auto-save Settings Controls
    const dimCheckbox = shadowRoot.getElementById('dim-background-checkbox');
    const intensityContainer = shadowRoot.getElementById('fade-intensity-container');
    const opacitySlider = shadowRoot.getElementById('fade-opacity-slider');
    const opacityValSpan = shadowRoot.getElementById('fade-opacity-val');
    const showLabelCheckbox = shadowRoot.getElementById('show-label-checkbox');

    // 2c. Output format radio buttons (instant save & re-render)
    const formatRadios = shadowRoot.querySelectorAll('input[name="selector-format"]');
    formatRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          defaultFormat = e.target.value;
          saveStorageData({ defaultFormat });
          renderElementsList();
        }
      });
    });

    // 2d. Dim background checkbox (instant apply & save)
    if (dimCheckbox && intensityContainer) {
      dimCheckbox.addEventListener('change', (e) => {
        dimBackground = e.target.checked;
        intensityContainer.style.display = dimBackground ? 'flex' : 'none';
        if (inspector) {
          inspector.setEnableFade(dimBackground);
        }
        saveStorageData({ dimBackground });
      });
    }

    // 2e. Opacity slider (real-time visual feedback + debounced save)
    let opacityDebounceTimer = null;
    if (opacitySlider && opacityValSpan) {
      opacitySlider.addEventListener('input', (e) => {
        fadeOpacity = parseFloat(e.target.value);
        opacityValSpan.textContent = `${Math.round(fadeOpacity * 100)}%`;
        if (inspector) {
          inspector.setFadeOpacity(fadeOpacity);
        }
        clearTimeout(opacityDebounceTimer);
        opacityDebounceTimer = setTimeout(() => {
          saveStorageData({ fadeOpacity });
        }, 250);
      });
    }

    // 2f. Show labels checkbox (instant apply & save)
    if (showLabelCheckbox) {
      showLabelCheckbox.addEventListener('change', (e) => {
        showLabel = e.target.checked;
        if (inspector) {
          inspector.setShowLabel(showLabel);
        }
        saveStorageData({ showLabel });
      });
    }

    // 4. Close Panel button
    const closeBtn = shadowRoot.getElementById('close-sidebar-btn');
    closeBtn.addEventListener('click', () => {
      closeSidebar();
    });

    // 5. Copy All Button
    const copyAllBtn = shadowRoot.getElementById('copy-all-btn');
    copyAllBtn.addEventListener('click', () => {
      if (capturedItems.length === 0) return;
      
      const selectors = capturedItems.map(item => {
        return formatSelectorWithComment(item, defaultFormat);
      }).join('\n\n');

      copyTextToClipboard(selectors, copyAllBtn, chrome.i18n.getMessage('copied'), chrome.i18n.getMessage('copyAll'));
    });

    // 6. Export JSON Button
    const exportBtn = shadowRoot.getElementById('export-json-btn');
    exportBtn.addEventListener('click', () => {
      if (capturedItems.length === 0) return;
      
      const exportData = capturedItems.map(item => ({
        name: item.name,
        tag: item.tagName,
        text: item.text,
        css: item.css,
        xpath: item.xpath,
        playwright: item.playwright,
        cypress: item.cypress,
        activeLocator: getSelectorByFormat(item, defaultFormat),
        formattedLocator: formatSelectorWithComment(item, defaultFormat)
      }));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_elements_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // 7. Clear All Button
    const clearBtn = shadowRoot.getElementById('clear-all-btn');
    clearBtn.addEventListener('click', () => {
      if (capturedItems.length === 0) return;
      if (confirm(chrome.i18n.getMessage('clearConfirm'))) {
        capturedItems = [];
        saveStorageData({ capturedItems });
        renderElementsList();
      }
    });

    // 8. Drag over sorting on list container
    const listContainer = shadowRoot.getElementById('elements-list');
    listContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingEl = shadowRoot.querySelector('.element-item.dragging');
      if (!draggingEl) return;
      const afterElement = getDragAfterElement(listContainer, e.clientY);
      if (afterElement == null) {
        listContainer.appendChild(draggingEl);
      } else {
        listContainer.insertBefore(draggingEl, afterElement);
      }
    });
  }

  /**
   * Renders the elements captured list in the sidebar.
   */
  function renderElementsList() {
    if (!shadowRoot) return;
    const listContainer = shadowRoot.getElementById('elements-list');
    const emptyState = shadowRoot.getElementById('empty-state');
    if (!listContainer || !emptyState) return;
    
    // Toggle empty state visibility
    if (capturedItems.length === 0) {
      emptyState.classList.remove('hidden');
      listContainer.innerHTML = '';
      toggleFooterButtons(true);
      return;
    }

    emptyState.classList.add('hidden');
    listContainer.innerHTML = '';

    capturedItems.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'element-item';
      itemEl.setAttribute('draggable', 'true');
      itemEl.dataset.id = item.id;
      
      const activeSelector = getSelectorByFormat(item, defaultFormat);

      itemEl.innerHTML = `
        <div class="item-drag-meta">
          <div class="drag-grip" title="${chrome.i18n.getMessage('dragGripTitle')}">
            <span></span><span></span>
            <span></span><span></span>
            <span></span><span></span>
          </div>
          <span class="tag-badge">${item.tagName}</span>
          <div class="reorder-controls">
            <button class="reorder-btn move-up" title="${chrome.i18n.getMessage('moveUpTitle')}" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button class="reorder-btn move-down" title="${chrome.i18n.getMessage('moveDownTitle')}" ${index === capturedItems.length - 1 ? 'disabled' : ''}>▼</button>
          </div>
        </div>

        <div class="item-body">
          <input type="text" class="rename-input" value="${escapeHtml(item.name)}" placeholder="${chrome.i18n.getMessage('renamePlaceholder')}" maxlength="80">
          <div class="selector-display" title="${escapeHtml(activeSelector)}">${escapeHtml(activeSelector)}</div>
        </div>

        <div class="item-actions">
          <button class="action-copy-btn btn-action" title="${chrome.i18n.getMessage('copySelectorTitle')}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="action-delete-btn btn-action" title="${chrome.i18n.getMessage('removeTitle')}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      `;

      // Event: Rename
      const renameInput = itemEl.querySelector('.rename-input');
      renameInput.addEventListener('change', (e) => {
        const newName = e.target.value.trim() || `${item.tagName}_${index + 1}`;
        renameItem(item.id, newName);
      });

      // Event: Copy selector
      const copyBtn = itemEl.querySelector('.action-copy-btn');
      copyBtn.addEventListener('click', () => {
        const commentedSelector = formatSelectorWithComment(item, defaultFormat);
        copyTextToClipboard(commentedSelector, copyBtn);
      });

      // Event: Delete
      const deleteBtn = itemEl.querySelector('.action-delete-btn');
      deleteBtn.addEventListener('click', () => {
        deleteItem(item.id);
      });

      // Event: Move Up
      const moveUpBtn = itemEl.querySelector('.move-up');
      if (moveUpBtn && index > 0) {
        moveUpBtn.addEventListener('click', () => reorderItems(index, index - 1));
      }

      // Event: Move Down
      const moveDownBtn = itemEl.querySelector('.move-down');
      if (moveDownBtn && index < capturedItems.length - 1) {
        moveDownBtn.addEventListener('click', () => reorderItems(index, index + 1));
      }

      // Drag and drop event listeners
      itemEl.addEventListener('dragstart', (e) => {
        itemEl.classList.add('dragging');
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
        // Clear hover highlight during dragging to avoid distraction
        inspector.highlightElement(null);
      });

      itemEl.addEventListener('dragend', () => {
        itemEl.classList.remove('dragging');
        updateStateFromDomOrder();
      });

      // Hover highlight sync on card hover
      itemEl.addEventListener('mouseenter', () => {
        // If another item is being dragged, skip hover highlights
        if (shadowRoot.querySelector('.element-item.dragging')) return;

        let element = null;
        try {
          if (item.css) {
            element = document.querySelector(item.css);
          }
        } catch (e) {}

        if (!element && item.xpath) {
          try {
            const xpathResult = document.evaluate(item.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            element = xpathResult.singleNodeValue;
          } catch (e) {}
        }

        if (element) {
          inspector.highlightElement(element);
        }
      });

      itemEl.addEventListener('mouseleave', () => {
        inspector.highlightElement(null);
      });

      listContainer.appendChild(itemEl);
    });

    toggleFooterButtons(false);
  }

  /**
   * Helper to enable/disable footer buttons
   */
  function toggleFooterButtons(disabled) {
    if (!shadowRoot) return;
    const copyAllBtn = shadowRoot.getElementById('copy-all-btn');
    const exportBtn = shadowRoot.getElementById('export-json-btn');
    const clearBtn = shadowRoot.getElementById('clear-all-btn');
    if (!copyAllBtn || !exportBtn || !clearBtn) return;

    if (disabled) {
      copyAllBtn.classList.add('disabled');
      exportBtn.classList.add('disabled');
      clearBtn.classList.add('disabled');
    } else {
      copyAllBtn.classList.remove('disabled');
      exportBtn.classList.remove('disabled');
      clearBtn.classList.remove('disabled');
    }
  }

  /**
   * Adds a newly selected element metadata to captured list.
   */
  function addCapturedItem(selectorData) {
    // Close settings drawer to prioritize viewing the captured items
    if (shadowRoot) {
      const panel = shadowRoot.getElementById('settings-panel');
      const btn = shadowRoot.getElementById('gear-btn');
      if (panel && panel.classList.contains('open')) {
        panel.classList.remove('open');
        if (btn) btn.classList.remove('active');
      }
    }

    // Atomic append inside the storage queue: fast consecutive captures never overwrite each other
    updateStorage((state) => {
      const currentItems = state.capturedItems || [];
      const tagName = selectorData.tagName.toUpperCase();
      const count = currentItems.filter((item) => item.tagName === tagName).length + 1;
      const newItem = {
        id: generateUUID(),
        name: `${selectorData.tagName}_${count}`,
        tagName: tagName,
        text: selectorData.text,
        css: selectorData.css,
        xpath: selectorData.xpath,
        playwright: selectorData.playwright,
        cypress: selectorData.cypress
      };
      capturedItems = [...currentItems, newItem];
      renderElementsList();
      return { ...state, capturedItems, isSidebarOpen: true };
    });

    if (isTopFrame) {
      openSidebar();
    }
  }

  /**
   * Renames a specific item in state and storage.
   */
  function renameItem(id, newName) {
    const item = capturedItems.find(i => i.id === id);
    if (item) {
      item.name = newName;
      saveStorageData({ capturedItems });
    }
  }

  /**
   * Deletes a specific item in state and storage.
   */
  function deleteItem(id) {
    capturedItems = capturedItems.filter(item => item.id !== id);
    saveStorageData({ capturedItems });
    renderElementsList();
  }

  /**
   * Reorders items (swapping indices).
   */
  function reorderItems(fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= capturedItems.length || toIndex >= capturedItems.length) return;
    
    // Swap items
    const temp = capturedItems[fromIndex];
    capturedItems[fromIndex] = capturedItems[toIndex];
    capturedItems[toIndex] = temp;

    saveStorageData({ capturedItems });
    renderElementsList();
  }

  /**
   * Formats a selector with a matching code comment syntax based on the output language.
   */
  function formatSelectorWithComment(item, format) {
    const selector = getSelectorByFormat(item, format);
    const comment = item.name || `${item.tagName}_element`;
    
    switch (format) {
      case 'playwright':
      case 'cypress':
        return `// ${comment}\n${selector}`;
      case 'xpath':
      case 'css':
      default:
        return `/* ${comment} */\n${selector}`;
    }
  }

  /**
   * Returns selector text string based on selected format setting.
   */
  function getSelectorByFormat(item, format) {
    switch (format) {
      case 'xpath': return item.xpath;
      case 'playwright': return item.playwright;
      case 'cypress': return item.cypress;
      case 'css':
      default:
        return item.css;
    }
  }

  // --- Toggle and Selection Control Actions ---

  function startSelection() {
    isSelectionActive = true;
    inspector.start();
    saveStorageData({ isSelectionActive });
    
    // Sync checkbox & badge visual states inside Shadow DOM
    if (shadowRoot) {
      const chk = shadowRoot.getElementById('inspector-toggle-checkbox');
      if (chk) chk.checked = true;
      
      const indicatorDot = shadowRoot.querySelector('.status-dot');
      const indicatorText = shadowRoot.querySelector('.status-text');
      if (indicatorDot) indicatorDot.className = 'status-dot active';
      if (indicatorText) indicatorText.textContent = chrome.i18n.getMessage('inspectorActive');
    }

    // Update Extension action icon state
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'set-icon-state', active: true });
    }
  }

  function stopSelection() {
    isSelectionActive = false;
    inspector.stop();
    saveStorageData({ isSelectionActive });
    
    // Sync checkbox & badge visual states inside Shadow DOM
    if (shadowRoot) {
      const chk = shadowRoot.getElementById('inspector-toggle-checkbox');
      if (chk) chk.checked = false;
      
      const indicatorDot = shadowRoot.querySelector('.status-dot');
      const indicatorText = shadowRoot.querySelector('.status-text');
      if (indicatorDot) indicatorDot.className = 'status-dot';
      if (indicatorText) indicatorText.textContent = chrome.i18n.getMessage('inspectorInactive');
    }

    // Update Extension action icon state
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'set-icon-state', active: false });
    }
  }

  function toggleSelection() {
    if (isSelectionActive) {
      stopSelection();
    } else {
      startSelection();
    }
  }

  function openSidebar() {
    isSidebarOpen = true;
    if (!sidebarEl && isTopFrame) {
      injectUI();
    }
    if (sidebarEl) {
      sidebarEl.classList.add('open');
    }
    saveStorageData({ isSidebarOpen: true });
  }

  function closeSidebar() {
    isSidebarOpen = false;
    if (sidebarEl) {
      sidebarEl.classList.remove('open');
    }
    saveStorageData({ isSidebarOpen: false });
  }

  // --- Utilities ---

  /**
   * Copies string content to system clipboard with visual button state updates.
   */
  function copyTextToClipboard(text, btnElement, successMsg = chrome.i18n.getMessage('copied') || 'Copied!', originalMsg = '') {
    // 1. Direct API Copy
    navigator.clipboard.writeText(text)
      .then(() => showCopySuccess(btnElement, successMsg, originalMsg))
      .catch(err => {
        // 2. Fallback Copy using temporary input in Shadow DOM or document.body (robust)
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        const container = shadowRoot || document.body;
        container.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          showCopySuccess(btnElement, successMsg, originalMsg);
        } catch (e) {
          console.error('Failed to copy selector: ', e);
        }
        container.removeChild(textarea);
      });
  }

  function showCopySuccess(btnElement, successMsg, originalMsg) {
    const originalContent = btnElement.innerHTML;
    
    btnElement.classList.add('copy-success');
    
    if (originalMsg) {
      btnElement.textContent = successMsg;
    } else {
      // Icon copy button swap
      btnElement.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
    }

    setTimeout(() => {
      btnElement.classList.remove('copy-success');
      btnElement.innerHTML = originalContent;
      if (originalMsg) {
        btnElement.textContent = originalMsg;
      }
    }, 1500);
  }

  function generateUUID() {
    return 'item-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
  }

  function requestTabId() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({ action: 'get-tab-id' }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Error requesting tab ID (context might be reloaded):', chrome.runtime.lastError.message);
              resolve('standalone');
              return;
            }
            if (response && response.tabId) {
              resolve(response.tabId);
            } else {
              resolve('standalone');
            }
          });
        } catch (err) {
          console.log('Runtime messaging error:', err.message);
          resolve('standalone');
        }
      } else {
        resolve('standalone');
      }
    });
  }

  function escapeHtml(string) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(string).replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // --- Drag and Drop Helper Functions ---

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.element-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function updateStateFromDomOrder() {
    const itemElements = [...shadowRoot.querySelectorAll('.element-item')];
    const newCapturedItems = [];
    
    itemElements.forEach(el => {
      const id = el.dataset.id;
      const item = capturedItems.find(i => i.id === id);
      if (item) {
        newCapturedItems.push(item);
      }
    });
    
    capturedItems = newCapturedItems;
    saveStorageData({ capturedItems });
    renderElementsList();
  }

  // --- Extension Storage Wrapper Helpers ---

  function hasStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  /**
   * Serialized read-modify-write: waits for tabId and never drops or interleaves writes.
   * @param {(state: object) => object} mutator - Receives the stored state and returns the next one.
   */
  function updateStorage(mutator) {
    if (!hasStorage()) return;
    storageQueue = storageQueue
      .then(() => tabIdReady)
      .then((id) => new Promise((resolve) => {
        const key = `tab_${id}`;
        chrome.storage.local.get(key, (result) => {
          const nextState = mutator(result[key] || {});
          chrome.storage.local.set({ [key]: nextState }, () => resolve());
        });
      }))
      .catch((err) => console.warn('Selecto storage write failed:', err));
  }

  function saveStorageData(obj) {
    updateStorage((state) => ({ ...state, ...obj }));
  }

  function getStorageData() {
    if (!hasStorage()) return Promise.resolve({});
    return tabIdReady.then((id) => new Promise((resolve) => {
      const key = `tab_${id}`;
      chrome.storage.local.get(key, (result) => resolve(result[key] || {}));
    })).catch(() => ({}));
  }

  /**
   * Sets up real-time cross-frame synchronization using chrome.storage.
   */
  function setupStorageSync() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local' || !tabId) return;
        const key = `tab_${tabId}`;
        if (changes[key]) {
          const newState = changes[key].newValue || {};
          applyStateUpdate(newState);
        }
      });
    }
  }

  /**
   * Applies storage state updates across all frames.
   */
  function applyStateUpdate(newState) {
    if (newState.isSelectionActive !== undefined && newState.isSelectionActive !== isSelectionActive) {
      isSelectionActive = newState.isSelectionActive;
      if (isSelectionActive) {
        inspector.start();
      } else {
        inspector.stop();
      }
      if (shadowRoot) {
        const chk = shadowRoot.getElementById('inspector-toggle-checkbox');
        if (chk) chk.checked = isSelectionActive;
        const indicatorDot = shadowRoot.querySelector('.status-dot');
        const indicatorText = shadowRoot.querySelector('.status-text');
        if (indicatorDot) indicatorDot.className = isSelectionActive ? 'status-dot active' : 'status-dot';
        if (indicatorText) indicatorText.textContent = isSelectionActive 
          ? chrome.i18n.getMessage('inspectorActive') 
          : chrome.i18n.getMessage('inspectorInactive');
      }
    }

    if (newState.capturedItems !== undefined) {
      capturedItems = newState.capturedItems;
      if (shadowRoot) {
        renderElementsList();
      }
    }

    if (newState.defaultFormat !== undefined && newState.defaultFormat !== defaultFormat) {
      defaultFormat = newState.defaultFormat;
      if (shadowRoot) {
        const radio = shadowRoot.querySelector(`input[name="selector-format"][value="${defaultFormat}"]`);
        if (radio) radio.checked = true;
        renderElementsList();
      }
    }

    if (newState.dimBackground !== undefined && newState.dimBackground !== dimBackground) {
      dimBackground = newState.dimBackground;
      if (inspector) inspector.setEnableFade(dimBackground);
      if (shadowRoot) {
        const dimCheckbox = shadowRoot.getElementById('dim-background-checkbox');
        if (dimCheckbox) dimCheckbox.checked = dimBackground;
        const intensityContainer = shadowRoot.getElementById('fade-intensity-container');
        if (intensityContainer) intensityContainer.style.display = dimBackground ? 'flex' : 'none';
      }
    }

    if (newState.fadeOpacity !== undefined && newState.fadeOpacity !== fadeOpacity) {
      fadeOpacity = newState.fadeOpacity;
      if (inspector) inspector.setFadeOpacity(fadeOpacity);
      if (shadowRoot) {
        const opacitySlider = shadowRoot.getElementById('fade-opacity-slider');
        if (opacitySlider) opacitySlider.value = fadeOpacity;
        const opacityValSpan = shadowRoot.getElementById('fade-opacity-val');
        if (opacityValSpan) opacityValSpan.textContent = `${Math.round(fadeOpacity * 100)}%`;
      }
    }

    if (newState.showLabel !== undefined && newState.showLabel !== showLabel) {
      showLabel = newState.showLabel;
      if (inspector) inspector.setShowLabel(showLabel);
      if (shadowRoot) {
        const showLabelCheckbox = shadowRoot.getElementById('show-label-checkbox');
        if (showLabelCheckbox) showLabelCheckbox.checked = showLabel;
      }
    }

    if (newState.isSidebarOpen !== undefined && newState.isSidebarOpen !== isSidebarOpen) {
      isSidebarOpen = newState.isSidebarOpen;
      if (sidebarEl) {
        if (isSidebarOpen) {
          sidebarEl.classList.add('open');
        } else {
          sidebarEl.classList.remove('open');
        }
      }
    }
  }

  // --- Floating UI Stylesheet Content ---

  function getSidebarStyles() {
    return `
      :host {
        all: initial; /* Reset all inherited page styles */
        --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        --bg-panel: rgba(15, 23, 42, 0.85); /* Deep slate with glass blur */
        --bg-card: rgba(30, 41, 59, 0.45);
        --bg-card-hover: rgba(30, 41, 59, 0.65);
        --border-color: rgba(255, 255, 255, 0.08);
        --border-focus: #6366f1; /* Indigo */
        --text-primary: #f8fafc;
        --text-secondary: #cbd5e1;
        --text-muted: #64748b;
        --accent: #6366f1;
        --accent-hover: #4f46e5;
        --danger: #ef4444;
        --danger-hover: #dc2626;
        --success: #10b981;
      }

      /* Sidebar Wrapper */
      #selector-sidebar {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 350px;
        height: 500px;
        max-height: calc(100vh - 40px);
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        box-shadow: 0 20px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(99, 102, 241, 0.2);
        z-index: 2147483647;
        display: none;
        flex-direction: column;
        overflow: hidden;
        font-family: var(--font-sans);
        color: var(--text-primary);
        box-sizing: border-box;
      }

      #selector-sidebar.open {
        display: flex !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }

      #selector-sidebar.open:hover {
        opacity: 0.98; /* Increase opacity on hover so it does not block reading */
      }

      #selector-sidebar * {
        box-sizing: border-box;
      }

      /* Header */
      .sidebar-header {
        padding: 16px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: grab;
        user-select: none;
      }

      .sidebar-header.grabbing {
        cursor: grabbing;
      }

      .header-title-area {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .app-logo {
        background: var(--accent);
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);
      }

      .header-title-area h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: var(--text-primary);
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-top: 2px;
      }

      .status-dot {
        width: 6px;
        height: 6px;
        background-color: var(--text-muted);
        border-radius: 50%;
        display: inline-block;
      }

      .status-dot.active {
        background-color: var(--success);
        box-shadow: 0 0 6px var(--success);
      }

      .status-text {
        font-size: 10px;
        color: var(--text-secondary);
        font-weight: 500;
      }

      .header-actions {
        display: flex;
        gap: 4px;
      }

      .icon-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        padding: 6px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s, color 0.2s;
      }

      .icon-btn:hover {
        background-color: rgba(255, 255, 255, 0.05);
        color: var(--text-primary);
      }

      .icon-btn.active {
        background-color: rgba(99, 102, 241, 0.25);
        color: var(--accent);
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.4);
      }

      .icon-btn svg {
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .icon-btn.active svg {
        transform: rotate(45deg);
      }

      /* Inspector Activation Bar */
      .sidebar-controls {
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.01);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .control-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
      }

      /* Toggle Switch */
      .switch {
        position: relative;
        display: inline-block;
        width: 38px;
        height: 20px;
      }

      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #334155;
        transition: .3s;
        border-radius: 20px;
      }

      .slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
      }

      input:checked + .slider {
        background-color: var(--accent);
      }

      input:focus + .slider {
        box-shadow: 0 0 1px var(--accent);
      }

      input:checked + .slider:before {
        transform: translateX(18px);
      }

      /* Settings Drawer */
      .settings-drawer {
        max-height: 0;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.2);
        transition: max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        border-bottom: 0 solid var(--border-color);
        padding: 0 16px;
      }

      .settings-drawer.open {
        max-height: 340px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border-color);
      }

      .settings-footer-links {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 10px;
        margin-top: 8px;
        border-top: 1px solid var(--border-color);
      }

      .discrete-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--text-muted);
        text-decoration: none;
        font-size: 10px;
        transition: color 0.15s ease;
      }

      .discrete-link:hover {
        color: var(--accent);
      }

      .settings-drawer h4 {
        margin: 0 0 10px 0;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted);
      }

      .setting-group {
        margin-bottom: 12px;
      }

      .setting-group label {
        display: block;
        font-size: 11px;
        color: var(--text-secondary);
        margin-bottom: 6px;
      }

      .radio-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 12px;
      }

      .radio-label {
        font-size: 11px !important;
        display: flex !important;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        user-select: none;
      }

      .radio-label input {
        accent-color: var(--accent);
        margin: 0;
      }

      /* Elements List Container */
      .list-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* Webkit Custom Scrollbar */
      .list-container::-webkit-scrollbar {
        width: 6px;
      }
      .list-container::-webkit-scrollbar-track {
        background: transparent;
      }
      .list-container::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }
      .list-container::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      /* Empty State */
      #empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        height: 100%;
        color: var(--text-muted);
        padding: 0 12px;
      }

      #empty-state p {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
      }

      .hidden {
        display: none !important;
      }

      /* Element Item Card */
      .element-item {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-left: 3px solid var(--accent);
        border-radius: 8px;
        padding: 10px 12px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 10px;
        align-items: center;
        transition: transform 0.2s, background-color 0.2s, border-color 0.2s;
      }

      .element-item:hover {
        background: var(--bg-card-hover);
        border-color: rgba(255, 255, 255, 0.12);
        transform: translateY(-1px);
      }

      .element-item.dragging {
        opacity: 0.45;
        border-style: dashed;
        background: rgba(99, 102, 241, 0.08);
        transform: scale(0.98);
      }

      .drag-grip {
        display: grid;
        grid-template-columns: repeat(2, 3px);
        gap: 3px;
        cursor: grab;
        opacity: 0.35;
        transition: opacity 0.2s;
        margin-bottom: 2px;
      }

      .drag-grip:hover {
        opacity: 0.8;
      }

      .drag-grip:active {
        cursor: grabbing;
      }

      .drag-grip span {
        width: 3.5px;
        height: 3.5px;
        background-color: var(--text-primary);
        border-radius: 50%;
      }

      .item-drag-meta {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .tag-badge {
        font-size: 9px;
        font-weight: 700;
        background-color: rgba(99, 102, 241, 0.15);
        color: #a5b4fc;
        padding: 1px 4px;
        border-radius: 4px;
        letter-spacing: 0.3px;
      }

      .reorder-controls {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .reorder-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 8px;
        padding: 2px;
        cursor: pointer;
        line-height: 1;
        transition: color 0.15s;
      }

      .reorder-btn:hover:not([disabled]) {
        color: var(--text-primary);
      }

      .reorder-btn[disabled] {
        opacity: 0.15;
        cursor: not-allowed;
      }

      .item-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow: hidden;
      }

      .rename-input {
        background: transparent;
        border: 1px solid transparent;
        color: var(--text-primary);
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 600;
        padding: 2px 4px;
        border-radius: 4px;
        width: 100%;
        outline: none;
        transition: border-color 0.2s, background-color 0.2s;
      }

      .rename-input:hover {
        background: rgba(255, 255, 255, 0.03);
        border-color: rgba(255, 255, 255, 0.05);
      }

      .rename-input:focus {
        background: rgba(0, 0, 0, 0.2);
        border-color: var(--border-focus);
      }

      .selector-display {
        font-family: monospace;
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 2px 4px;
        background: rgba(0, 0, 0, 0.15);
        border-radius: 4px;
      }

      .item-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .btn-action {
        background: transparent;
        border: none;
        color: var(--text-muted);
        padding: 4px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s, color 0.2s;
      }

      .btn-action:hover {
        background-color: rgba(255, 255, 255, 0.06);
      }

      .action-copy-btn:hover {
        color: var(--success);
      }

      .action-delete-btn:hover {
        color: var(--danger);
      }

      /* Buttons & Actions Layout */
      .btn {
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 600;
        padding: 8px 12px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s, transform 0.1s;
      }

      .btn:active {
        transform: scale(0.97);
      }

      .btn-sm {
        padding: 5px 10px;
        font-size: 11px;
        border-radius: 6px;
      }

      .btn-primary {
        background-color: var(--accent);
        color: white;
      }

      .btn-primary:hover:not(.disabled) {
        background-color: var(--accent-hover);
      }

      .btn-secondary {
        background-color: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
      }

      .btn-secondary:hover:not(.disabled) {
        background-color: rgba(255, 255, 255, 0.09);
        color: var(--text-primary);
      }

      .btn-danger {
        background-color: rgba(239, 68, 68, 0.12);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.2);
        padding: 8px; /* Square button */
      }

      .btn-danger:hover:not(.disabled) {
        background-color: var(--danger);
        color: white;
      }

      .btn.disabled {
        opacity: 0.35;
        cursor: not-allowed;
        pointer-events: none;
      }

      /* Sidebar Footer */
      .sidebar-footer {
        padding: 14px 16px;
        border-top: 1px solid var(--border-color);
        background: rgba(0, 0, 0, 0.15);
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 8px;
        align-items: center;
      }
    `;
  }

  // --- Chrome Message Listener (registered at bootstrap) ---
  function setupMessageListener() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const action = message && message.action;

      if (action === 'ping') {
        sendResponse({ status: 'alive', isTopFrame });
        return false;
      }

      // UI commands are handled by the top frame only (child frames stay silent)
      if (!isTopFrame) return false;

      switch (action) {
        case 'toggle-action':
          if (!isSidebarOpen || !isSelectionActive) {
            openSidebar();
            startSelection();
          } else {
            stopSelection();
            closeSidebar();
          }
          sendResponse({ success: true, isSidebarOpen, isSelectionActive });
          break;
        case 'toggle-selection':
          toggleSelection();
          if (isSelectionActive) openSidebar();
          sendResponse({ success: true, active: isSelectionActive });
          break;
        case 'open-sidebar':
          openSidebar();
          startSelection();
          sendResponse({ success: true });
          break;
        case 'get-status':
          sendResponse({ isSelectionActive, isSidebarOpen, itemCount: capturedItems.length });
          break;
        default:
          break;
      }
      return false;
    });
  }

  // --- Escape key cancels selection (panel stays open to review captured items) ---
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSelectionActive) {
      stopSelection();
    }
  }, { passive: true });

})();
