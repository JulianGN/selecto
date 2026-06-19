# Selecto - Element Organizer & Selector Finder

<p align="center">
  <img src="package/icon-active-128.png" alt="Selecto Logo" width="128" height="128">
</p>

**Selecto** is a Google Chrome extension designed for developers and QA engineers. It allows you to inspect, generate, organize, and export HTML selectors (CSS and XPath) and modern automation locators (**Playwright** and **Cypress**) directly on any webpage.

With a modern, intuitive user interface that runs fully isolated inside the page's DOM (via Shadow DOM), Selecto simplifies UI test writing by eliminating the manual work of finding and testing element selectors.

---

## ✨ Key Features

* **Active Visual Inspection**: Hover and click on any HTML element on the page to instantly capture its details.
* **Smart Selector Generation**:
  * **CSS Selector**: Generates short, clean, and unique CSS paths prioritizing IDs and structural order.
  * **XPath**: Generates structured, robust XPath queries.
  * **Playwright Locators**: Automatically outputs modern code like `page.getByPlaceholder`, `page.getByRole`, etc.
  * **Cypress Locators**: Formats selectors directly for `cy.get()`.
* **Floating Sidebar Panel**: A built-in, draggable sidebar that can be positioned anywhere on your screen so it never blocks your content.
* **Shadow DOM Isolation**: The extension's UI is completely isolated, ensuring it never affects or gets deformed by the styles of the page being inspected.
* **Element Queue**: Capture multiple elements in a row, give them custom names/aliases for documentation, switch display formats in real-time, and copy all or export them as an organized JSON file.
* **Keyboard Shortcut**: Press `Alt + Shift + S` to quickly toggle the element selection mode on/off.
* **Local Test Sandbox**: An interactive sandbox page built into the extension to test the SDK's behavior against various element types (buttons, inputs, tables).

---

## 📁 Project Structure

```text
AreaDeSelecao/
├── package/                # Chrome extension source code
│   ├── manifest.json       # Manifest v3 metadata
│   ├── background.js       # Background service worker
│   ├── content.js          # Injected UI sidebar and control script
│   ├── selector-sdk.js     # Selector and XPath generation SDK (framework-agnostic)
│   ├── popup.html/.css/.js # Extension icon action menu
│   └── icon*.png           # Visual assets
├── test-sdk.html           # Interactive sandbox for testing the SDK
├── test-all.html           # Test suite page
└── README.md               # Project documentation
```

---

## 🚀 How to Install and Test Locally (Developer Mode)

Since the extension is loaded locally, you can install it on your Google Chrome browser:

1. Download or clone this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. In the top-right corner, enable **"Developer mode"**.
4. In the top-left corner, click the **"Load unpacked"** button.
5. Select the **`package`** folder located inside this project directory.
6. The **Selecto** icon will now appear in your extension bar.

---

## 📖 How to Use

1. Navigate to any website (e.g., `https://google.com`).
2. Click the **Selecto** icon in your browser extension bar and click **"Open Panel on Page"** (or press the **`Alt + Shift + S`** shortcut).
3. Enable the **Inspection Mode** on the sidebar header or by using the shortcut.
4. Hover over the page. The element under your cursor will be highlighted with a blue translucent overlay.
5. **Click** the element you want to capture. It will be added to the list in your floating sidebar.
6. In the sidebar:
   * Change the output format (CSS, XPath, Playwright, or Cypress) at any time by clicking the gear settings icon.
   * Add custom names/labels to your elements.
   * Click **Copy** next to an item, or use the bottom action buttons to **Copy All** or **Export** the list as a JSON file.

---

## 🛠️ Technologies Used

* **Vanilla JS**: Lightweight, fast, framework-free client-side code.
* **Modern Vanilla CSS**: Sleek glassmorphism effect, clean animations, and a responsive layout.
* **Shadow DOM**: Complete style encapsulation to prevent UI bleed/conflicts with the host website.
* **Chrome Extensions API v3**: Built on the latest manifest standards required by the Chrome Web Store.

---

## 📝 License

This project is licensed under the MIT License. Feel free to use, modify, and distribute it.
