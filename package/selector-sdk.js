/**
 * Selector SDK - Core Inspector and Selector Generators
 * A standalone, framework-agnostic SDK to inspect, highlight, and generate selectors
 * for DOM elements. Perfect for extension overlays and embedded SaaS tools.
 */

(function (global) {
  'use strict';

  /**
   * Generates robust CSS Selectors and XPaths for DOM elements.
   */
  class SelectorGenerator {
    /**
     * Generates a unique CSS Selector for the given element.
     * @param {HTMLElement} el - The element to inspect.
     * @returns {string} The CSS Selector.
     */
    static getCssSelector(el) {
      if (!(el instanceof Element)) return '';
      
      const path = [];
      let current = el;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();

        // 1. Check for unique ID
        if (current.id) {
          // Escape special characters in ID
          const escapedId = current.id.replace(/(:|\.|\[|\]|,|=|@)/g, '\\$1');
          try {
            // Check if the ID is unique in the DOM
            if (document.querySelectorAll('#' + escapedId).length === 1) {
              selector = '#' + escapedId;
              path.unshift(selector);
              break; // Unique ID found, stop traversing
            }
          } catch (e) {
            // Fallback if ID is invalid or selector fails
          }
        }

        // 2. Fallback to tag name and nth-of-type for robustness
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const sameTagSiblings = siblings.filter(
            sibling => sibling.nodeName.toLowerCase() === current.nodeName.toLowerCase()
          );

          if (sameTagSiblings.length > 1) {
            const index = sameTagSiblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }

        path.unshift(selector);
        current = current.parentElement;
      }

      return path.join(' > ');
    }

    /**
     * Generates a robust XPath for the given element.
     * @param {HTMLElement} el - The element to inspect.
     * @returns {string} The XPath query.
     */
    static getXPath(el) {
      if (!(el instanceof Element)) return '';

      // If the element has a unique ID, return a short XPath
      if (el.id) {
        const escapedId = el.id.replace(/'/g, "\\'");
        try {
          const xpathQuery = `//*[@id='${escapedId}']`;
          const result = document.evaluate(
            xpathQuery,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (result.singleNodeValue === el) {
            return `//*[@id="${el.id}"]`;
          }
        } catch (e) {
          // Fallback if evaluate fails
        }
      }

      const paths = [];
      let current = el;

      for (; current && current.nodeType === Node.ELEMENT_NODE; current = current.parentElement) {
        let index = 0;
        let sibling = current.previousSibling;

        // Count preceding siblings with the same tag name
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }

        const tagName = current.nodeName.toLowerCase();
        
        // Check if there are succeeding siblings of the same tag name to determine if index is needed
        let hasSameTagSibling = false;
        let nextSibling = current.nextSibling;
        while (nextSibling) {
          if (nextSibling.nodeType === Node.ELEMENT_NODE && nextSibling.nodeName === current.nodeName) {
            hasSameTagSibling = true;
            break;
          }
          nextSibling = nextSibling.nextSibling;
        }

        const needIndex = index > 0 || hasSameTagSibling;
        const pathIndex = needIndex ? `[${index + 1}]` : '';
        paths.unshift(`${tagName}${pathIndex}`);
      }

      return paths.length ? '/' + paths.join('/') : '';
    }

    /**
     * Generates a Playwright-specific locator representation.
     * @param {HTMLElement} el - The element to inspect.
     * @returns {string} Playwright locator code string.
     */
    static getPlaywrightLocator(el) {
      if (!(el instanceof Element)) return '';

      // 1. Try to find placeholder/role text
      const role = el.getAttribute('role');
      const placeholder = el.getAttribute('placeholder');
      const type = el.getAttribute('type');
      const text = el.textContent ? el.textContent.trim() : '';

      if (placeholder) {
        return `page.getByPlaceholder('${placeholder}')`;
      }
      if (role && text && text.length < 30) {
        return `page.getByRole('${role}', { name: '${text}' })`;
      }
      
      // Form fields by label
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label && label.textContent) {
          return `page.getByLabel('${label.textContent.trim()}')`;
        }
      }

      // Fallback to CSS Selector
      const css = this.getCssSelector(el);
      return `page.locator('${css}')`;
    }

    /**
     * Generates a Cypress-specific locator representation.
     * @param {HTMLElement} el - The element to inspect.
     * @returns {string} Cypress locator code string.
     */
    static getCypressLocator(el) {
      if (!(el instanceof Element)) return '';
      
      if (el.id) {
        return `cy.get('#${el.id}')`;
      }
      
      const css = this.getCssSelector(el);
      return `cy.get('${css}')`;
    }
  }

  /**
   * Manages DOM hovering, overlays, parent element prioritizations,
   * and click interceptions.
   */
  class ElementInspector {
    /**
     * Creates an ElementInspector instance.
     * @param {Object} options - Configuration options.
     * @param {string} [options.prioritySelectors] - Selector string listing element tags that should be prioritary parents.
     * @param {Function} [options.onHover] - Callback triggered when target element changes.
     * @param {Function} [options.onSelect] - Callback triggered when an element is clicked.
     * @param {Function} [options.excludeFilter] - Callback returning boolean: true if click/hover should be ignored for this element/path.
     */
    constructor(options = {}) {
      this.prioritySelectors = options.prioritySelectors || 'button, input, select, textarea, a, label, [role="button"]';
      this.onHover = options.onHover || (() => {});
      this.onSelect = options.onSelect || (() => {});
      this.excludeFilter = options.excludeFilter || (() => false);
      this.enableFade = options.enableFade !== undefined ? options.enableFade : true;
      this.fadeOpacity = options.fadeOpacity !== undefined ? options.fadeOpacity : 0.6;
      this.showLabel = options.showLabel !== undefined ? options.showLabel : true;

      this.active = false;
      this.hoveredElement = null;
      this.overlay = null;

      // Track last mouse position for key events (Shift trigger)
      this.lastMouseX = 0;
      this.lastMouseY = 0;

      // Bound listeners
      this._handleMouseMove = this._handleMouseMove.bind(this);
      this._handleMouseClick = this._handleMouseClick.bind(this);
      this._handleKeyDown = this._handleKeyDown.bind(this);
      this._handleKeyUp = this._handleKeyUp.bind(this);
      this._updateOverlayPosition = this._updateOverlayPosition.bind(this);
    }

    /**
     * Programmatically toggle the background fade/dimming effect.
     * @param {boolean} enable - Whether to enable or disable the fade effect.
     */
    setEnableFade(enable) {
      this.enableFade = enable;
      this._updateOverlayShadow();
    }

    /**
     * Programmatically update the opacity/intensity of the background fade.
     * @param {number} opacity - The opacity value between 0 and 1.
     */
    setFadeOpacity(opacity) {
      this.fadeOpacity = opacity;
      this._updateOverlayShadow();
    }

    /**
     * Programmatically show or hide the element tag labels over the highlighted area.
     * @param {boolean} show - Whether to display element labels.
     */
    setShowLabel(show) {
      this.showLabel = show;
      if (this.overlay) {
        const label = this.overlay.querySelector('#selector-sdk-overlay-label');
        if (label) {
          label.style.display = this.showLabel ? 'block' : 'none';
        }
      }
    }

    /**
     * Updates the box-shadow style property of the overlay element.
     * @private
     */
    _updateOverlayShadow() {
      if (this.overlay) {
        this.overlay.style.boxShadow = this.enableFade
          ? `0 0 0 99999px rgba(15, 23, 42, ${this.fadeOpacity}), 0 0 15px rgba(99, 102, 241, 0.6)`
          : '0 0 12px rgba(99, 102, 241, 0.3)';
      }
    }

    /**
     * Starts inspection mode.
     */
    start() {
      if (this.active) return;
      this.active = true;

      this._createOverlay();
      this._addListeners();
    }

    /**
     * Stops inspection mode and cleans up UI overlays.
     */
    stop() {
      if (!this.active) return;
      this.active = false;

      this._removeListeners();
      this._destroyOverlay();
      this.hoveredElement = null;
    }

    /**
     * Programmatically highlights a specific element on the page.
     * @param {HTMLElement|null} element - The element to highlight, or null to clear.
     */
    highlightElement(element) {
      if (element) {
        this._createOverlay();
        this.hoveredElement = element;
        this._updateOverlayPosition();
      } else {
        this.hoveredElement = null;
        this._hideOverlay();
        // Clean up DOM if inspector is not currently active
        if (!this.active) {
          this._destroyOverlay();
        }
      }
    }

    /**
     * Creates the visual overlay element and appends it to the DOM.
     * @private
     */
    _createOverlay() {
      if (this.overlay) return;

      this.overlay = document.createElement('div');
      this.overlay.id = 'selector-sdk-overlay';
      
      // Inject inline styles for robust rendering without external stylesheets
      Object.assign(this.overlay.style, {
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: '2147483647',
        border: '2px solid rgba(99, 102, 241, 0.95)', // Indigo border
        background: 'rgba(99, 102, 241, 0.08)',      // Light indigo wash
        borderRadius: '4px',
        transition: 'all 0.08s ease-out',
        boxSizing: 'border-box',
        display: 'none'
      });
      this._updateOverlayShadow();

      // Simple tag label on overlay
      const label = document.createElement('span');
      label.id = 'selector-sdk-overlay-label';
      Object.assign(label.style, {
        position: 'absolute',
        bottom: '100%',
        left: '0',
        transform: 'translateY(-4px)',
        backgroundColor: 'rgba(99, 102, 241, 0.95)',
        color: '#ffffff',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '11px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
        display: this.showLabel ? 'block' : 'none'
      });
      
      this.overlay.appendChild(label);
      document.body.appendChild(this.overlay);
    }

    /**
     * Destroys the visual overlay element.
     * @private
     */
    _destroyOverlay() {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
    }

    /**
     * Attaches page-level event listeners.
     * @private
     */
    _addListeners() {
      window.addEventListener('mousemove', this._handleMouseMove, { passive: true });
      window.addEventListener('click', this._handleMouseClick, { capture: true });
      window.addEventListener('keydown', this._handleKeyDown, { passive: true });
      window.addEventListener('keyup', this._handleKeyUp, { passive: true });
      window.addEventListener('scroll', this._updateOverlayPosition, { capture: true, passive: true });
      window.addEventListener('resize', this._updateOverlayPosition, { passive: true });
    }

    /**
     * Detaches page-level event listeners.
     * @private
     */
    _removeListeners() {
      window.removeEventListener('mousemove', this._handleMouseMove);
      window.removeEventListener('click', this._handleMouseClick, { capture: true });
      window.removeEventListener('keydown', this._handleKeyDown);
      window.removeEventListener('keyup', this._handleKeyUp);
      window.removeEventListener('scroll', this._updateOverlayPosition, { capture: true });
      window.removeEventListener('resize', this._updateOverlayPosition);
    }

    /**
     * Resolves the target element taking priority parents and modifier keys into account.
     * @param {HTMLElement} element - The original event target.
     * @param {boolean} shiftPressed - State of the shift modifier key.
     * @returns {HTMLElement} The resolved target element to inspect.
     * @private
     */
    _resolveTarget(element, shiftPressed) {
      if (!element || element === document.body || element === document.documentElement) {
        return null;
      }

      // Check if target matches exclude filter (e.g. extension floating UI)
      if (this.excludeFilter(element)) {
        return null;
      }

      // Shift key overrides parent prioritizing
      if (shiftPressed) {
        return element;
      }

      // Find nearest prioritized parent element
      const priorityParent = element.closest(this.prioritySelectors);
      if (priorityParent && !this.excludeFilter(priorityParent)) {
        return priorityParent;
      }

      return element;
    }

    /**
     * Handle mouse moving across the viewport.
     * @private
     */
    _handleMouseMove(e) {
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      const element = document.elementFromPoint(e.clientX, e.clientY);
      const target = this._resolveTarget(element, e.shiftKey);

      this._updateHovered(target, element);
    }

    /**
     * Updates the hovered element reference and overlay position.
     * @private
     */
    _updateHovered(target, original) {
      if (this.hoveredElement === target) return;

      this.hoveredElement = target;

      if (target) {
        this._updateOverlayPosition();
        this.onHover(target, original);
      } else {
        this._hideOverlay();
      }
    }

    /**
     * Recalculates the overlay position matching the currently hovered element bounds.
     * @private
     */
    _updateOverlayPosition() {
      if (!this.overlay || !this.hoveredElement) return;

      const el = this.hoveredElement;
      const rect = el.getBoundingClientRect();

      // Check if element is hidden/zero-sized
      if (rect.width === 0 || rect.height === 0) {
        this._hideOverlay();
        return;
      }

      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      Object.assign(this.overlay.style, {
        display: 'block',
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        left: `${rect.left + scrollX}px`,
        top: `${rect.top + scrollY}px`
      });

      // Update overlay label content
      const label = this.overlay.querySelector('#selector-sdk-overlay-label');
      if (label) {
        const tagName = el.tagName.toLowerCase();
        const idStr = el.id ? `#${el.id}` : '';
        const classStr = el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
          : '';
        label.textContent = `${tagName}${idStr}${classStr}`;
      }
    }

    /**
     * Hides the active overlay element.
     * @private
     */
    _hideOverlay() {
      if (this.overlay) {
        this.overlay.style.display = 'none';
      }
    }

    /**
     * Handle mouse clicks, preventing default actions.
     * @private
     */
    _handleMouseClick(e) {
      if (!this.active) return;

      // Read composite path to check for exclusions
      const path = e.composedPath();
      const isExcluded = path.some(node => node instanceof Element && this.excludeFilter(node));

      if (isExcluded) return;

      e.preventDefault();
      e.stopPropagation();

      const element = document.elementFromPoint(e.clientX, e.clientY);
      const target = this._resolveTarget(element, e.shiftKey);

      if (target) {
        const selectorData = {
          tagName: target.tagName.toLowerCase(),
          css: SelectorGenerator.getCssSelector(target),
          xpath: SelectorGenerator.getXPath(target),
          playwright: SelectorGenerator.getPlaywrightLocator(target),
          cypress: SelectorGenerator.getCypressLocator(target),
          text: target.textContent ? target.textContent.trim().substring(0, 60) : ''
        };
        this.onSelect(target, selectorData);
      }
    }

    /**
     * Listens for KeyDown event, specifically shift modifier toggling.
     * @private
     */
    _handleKeyDown(e) {
      if (e.key === 'Shift') {
        const element = document.elementFromPoint(this.lastMouseX, this.lastMouseY);
        const target = this._resolveTarget(element, true);
        this._updateHovered(target, element);
      }
    }

    /**
     * Listens for KeyUp event, specifically shift modifier toggling.
     * @private
     */
    _handleKeyUp(e) {
      if (e.key === 'Shift') {
        const element = document.elementFromPoint(this.lastMouseX, this.lastMouseY);
        const target = this._resolveTarget(element, false);
        this._updateHovered(target, element);
      }
    }
  }

  // Export to global scope
  global.SelectorGenerator = SelectorGenerator;
  global.ElementInspector = ElementInspector;

  // Support CommonJS/Node module exports
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = { SelectorGenerator, ElementInspector };
  }

})(typeof window !== 'undefined' ? window : this);
