# Selector SDK

A lightweight, framework-agnostic DOM element inspector and selector generator. Generate unique CSS Selectors, XPaths, and modern test automation locators (Playwright & Cypress) for any webpage, with built-in customizable focus overlays.

Perfect for automation builders, chrome extension overlays, and interactive user onboarding tours.

## 🚀 Installation

Install via npm:

```bash
npm install selecto-sdk
```

Or load directly in the browser via script tag:

```html
<script src="node_modules/selecto-sdk/package/selector-sdk.js"></script>
```

## 📖 Usage

### 1. Element Inspector

Create a visual overlay highlighted cutout that follows the cursor and captures selectors on click.

```javascript
import { ElementInspector } from 'selecto-sdk';

const inspector = new ElementInspector({
  // Enabled by default (Dims everything else around the hovered element)
  enableFade: true,
  fadeOpacity: 0.6, // Configure dimming opacity (0.1 to 0.9)
  
  // Enabled by default (Shows the tag/id tooltip label over the highlighted element)
  showLabel: true,

  // Tag names to prioritize parent matching (e.g. clicking inner text will select button)
  prioritySelectors: 'button, input, select, textarea, a, label',

  // Callback on cursor element hover
  onHover: (targetElement, originalElement) => {
    console.log('Hovering:', targetElement);
  },

  // Callback on element click (intercepts page navigations/clicks)
  onSelect: (targetElement, selectorData) => {
    console.log('Captured Element Data:', selectorData);
    
    // selectorData contains:
    // - tagName (e.g. "button")
    // - css (Unique CSS Selector)
    // - xpath (Robust XPath query)
    // - playwright (Modern playwright locator code string)
    // - cypress (Cypress cy.get() locator code string)
    // - text (element text content)
  },

  // Skip overlays on specific panels
  excludeFilter: (el) => {
    return el.id === 'my-sidebar-panel' || el.closest('#my-sidebar-panel');
  }
});

// Start listening and show hover highlighting
inspector.start();

// Programmatically disable/stop
// inspector.stop();

// Toggle dimming overlay dynamically
// inspector.setEnableFade(false);

// Adjust dim intensity dynamically
// inspector.setFadeOpacity(0.4);

// Toggle label visibility dynamically
// inspector.setShowLabel(false);
```

### 2. Standalone Selector Generator

Need to generate a selector for an element programmatically without overlays? Use the generator static methods:

```javascript
import { SelectorGenerator } from 'selecto-sdk';

const target = document.querySelector('button');

const cssSelector = SelectorGenerator.getCssSelector(target);
const xpath = SelectorGenerator.getXPath(target);
const playwrightLocator = SelectorGenerator.getPlaywrightLocator(target);
const cypressLocator = SelectorGenerator.getCypressLocator(target);
```

## 📄 License

MIT
