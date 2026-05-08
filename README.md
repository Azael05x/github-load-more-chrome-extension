# GitHub PR Auto Load More

This Chrome extension adds a `Load All` button under GitHub's pull request timeline `Load more…` control.

## What it does

On GitHub pull request pages:

- Clicking GitHub's normal `Load more…` button behaves normally and loads a single batch.
- Clicking the extension's `Load All` button keeps clicking GitHub's `Load more…` control after each batch loads until GitHub removes it.

While it runs, a small status badge appears in the top-right:

- Orange: `Loaded page, N left`
- Green: `Loaded all GH comments`

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this folder:

`/Users/aigars/projects/github-load-more-extension`

## Notes

- It only runs on `https://github.com/*`
- `Load All` appears under GitHub's own `Load more…` button on PR timeline sections that can be expanded
- Reload the PR page after enabling the extension if the page was already open
# github-load-more-chrome-extension
