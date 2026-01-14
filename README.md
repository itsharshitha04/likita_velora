# Velora Boutique — ACDL-enabled site bundle

Files included:
- index.html
- plp.html
- pdp.html
- cart.html
- checkout.html
- thankyou.html
- adl-utils.js
- adl-xdm-helper.js
- client.js
- styles.css

How to create a zip (macOS / Linux)
1. Save all files into a folder, e.g. `velora-site`.
2. In Terminal run:
   ```
   cd path/to/velora-site
   zip -r velora-site.zip .
   ```
   `velora-site.zip` will be created in that folder.

How to create a zip (Windows)
1. Save all files into a folder, e.g. `velora-site`.
2. Right-click the folder → Send to → Compressed (zipped) folder.

Serve locally (recommended)
- Using Python 3:
  ```
  cd path/to/velora-site
  python -m http.server 8000
  ```
  Then open http://localhost:8000 in your browser.

Quick testing checklist
- Open console and verify sessionStorage keys: `velora_pageData` and `velora_lastLinkClicked`.
- Click header links: linkClicked should be pushed and persisted, then navigation occurs (300ms).
- Navigate between pages: restored linkClicked should appear before new pageLoaded.
- Confirm console logs: ✓ ACDL: ... tracked: and 📊 ACDL Length:
- Ensure styles load (styles.css) and images display.

If you want, I can produce a downloadable zip archive for you; otherwise this bundle has everything to create the zip locally.
