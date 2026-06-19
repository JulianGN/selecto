# Privacy Policy for Selecto

**Effective Date:** June 19, 2026

Your privacy is extremely important to us. This Privacy Policy describes how **Selecto** ("the Extension") handles information when you use it.

---

## 1. No Data Collection or Transmission
Selecto is built with privacy in mind. 
* **No personal data** is collected, stored, or transmitted by the Extension.
* **No browsing history** is tracked, recorded, or sent to any external server.
* The Extension runs **100% offline** and does not make any network requests.

---

## 2. Local Storage Usage
All information generated while using the Extension—such as captured HTML tags, custom element names, CSS selectors, and XPath queries—is stored strictly on your local device. 
* We use the Chrome `chrome.storage.local` API to persist your element queue so that you don't lose your work when you refresh the tab.
* This data is stored locally within your browser's isolated profile directory and is never sent to us or any third party.
* You can clear all stored data at any time by clicking the "Clear All" button inside the Extension sidebar or by uninstalling the Extension.

---

## 3. Permissions Explained
To function properly, Selecto requests the following permissions. Here is why they are needed:
* **`storage`**: Used to save your active selector preferences and lists of captured elements locally in your browser.
* **`activeTab` & `scripting`**: Used to temporarily inject the selection overlay highlight and the floating sidebar panel onto the webpage you are currently inspecting.
* **Host Permissions (`<all_urls>`)**: Allows you to run the visual element selector tool on any webpage of your choice. No page data is read or collected unless you explicitly activate the inspector and click on an element to capture it.

---

## 4. Third-Party Services
Selecto does not contain any third-party analytics tools, advertisements, or tracking scripts.

---

## 5. Changes to This Privacy Policy
We may update our Privacy Policy from time to time. Any changes will be posted on this page or in the project repository. Your continued use of the Extension after changes are posted constitutes your acceptance of the updated policy.

---

## 6. Contact
If you have any questions about this Privacy Policy, feel free to open an issue in the project repository or contact the developer directly.
