# jen-chung.com

Jen Chung's product design portfolio — plain HTML, CSS and JavaScript (no build step).
Hosted on GitHub Pages.

## Preview locally
Double-click `index.html` to open it in your browser. Refresh after each change.

## Publish a change
1. **GitHub Desktop** shows every file that changed.
2. Write a short summary (bottom-left), click **Commit to main**.
3. Click **Push origin**. The live site updates in about a minute.

Every version is saved in the repo's history, so any change can be undone
(GitHub Desktop → **History** → right-click a commit → **Revert changes in commit**).

## What's where
| Path | What it is |
|---|---|
| `index.html` | Home page: nav, konbini hero, Work, Archive, footer. **Card copy and links are edited here** (look for ✏️). |
| `css/site.css` | All page styles. Colors for light/dark are the tokens at the top. |
| `js/site.js` | Light/dark toggle (remembers each visitor's choice), mobile menu, and the link to the konbini hero. |
| `konbini/konbini-hero.html` | The konbini hero (storefront, seasons, fridge, loader, intro sentence), shown inside the home page. |
| `konbini/assets/` | Season videos, posters, fridge sprite. |
| `assets/work/`, `assets/archive/` | Card images (WebP), exported from Figma. Replace a file with the same name to swap an image. |
| `assets/icons/` | Logo dash, light/dark switch icons, footer line and icons. |

Settings for the hero (season, rotating words, timing) are in the **✏️ EDIT ME** block
near the top of the `<script>` in `konbini/konbini-hero.html`. The theme is set by the page.
Edit files in VS Code — never TextEdit (it can save as rich text and wipe the file).
