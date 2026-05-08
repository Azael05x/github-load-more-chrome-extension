# GitHub PR Auto Load More

A Chrome extension that adds a `Load All` button to GitHub pull request timelines, so you can expand every collapsed comment with a single click instead of repeatedly hitting `Load more…`.

## Why

GitHub collapses long PR timelines behind a `Load more…` button that only loads one batch at a time. On busy PRs this can mean clicking the same button dozens of times before you can search the page or read every comment. This extension automates that.

## What it does

On any GitHub pull request page:

- GitHub's existing `Load more…` button is left untouched and still loads a single batch when clicked.
- A new `Load All` button is inserted beneath it. Clicking it repeatedly triggers `Load more…` until GitHub has nothing left to load.

While `Load All` is running, a status badge appears in the top-right corner of the page:

- 🟠 Orange — `Loaded page, N left`
- 🟢 Green — `Loaded all GH comments`

The extension only injects UI on PR pages (`/<owner>/<repo>/pull/<number>`) and only acts on timeline sections that GitHub has marked as expandable.

## Install (from source)

This extension is not on the Chrome Web Store. To install it locally:

1. Clone this repository, or download it as a ZIP and extract it.
   ```
   git clone https://github.com/Azael05x/github-load-more-chrome-extension.git
   ```
2. Open `chrome://extensions` in Chrome (or any Chromium-based browser).
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the cloned/extracted folder.
5. Reload any open GitHub PR tabs so the content script runs on them.

## Permissions

The extension uses Manifest V3 and requests **no host permissions or APIs** beyond a content script that runs on `https://github.com/*`. It does not make network requests of its own — it only clicks GitHub's own `Load more…` button on your behalf.

## Files

- `manifest.json` — Chrome extension manifest (MV3).
- `content.js` — All extension logic: button injection, click handling, status badge.

## Contributing

Issues and pull requests are welcome. If you hit a PR layout where `Load All` doesn't appear or doesn't finish, please include:

- A link to the PR (or a description of its structure).
- The browser and extension version.
- Any errors from the DevTools console.

## License

MIT
