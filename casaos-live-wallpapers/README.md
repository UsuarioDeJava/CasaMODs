# Live Wallpapers for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod that turns every wallpaper in a folder of your CasaOS server — Wallpaper Engine web and video wallpapers, HTML pages, videos — into a CasaOS wallpaper, animated behind the dashboard and reacting to the audio playing in the tab.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Copy the `live-wallpapers` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Create `/DATA/AppData/casamod/mod/wallpapers/` and put wallpapers in it (see below).
4. Restart CasaMOD and reload the CasaOS page.

To remove it, move `live-wallpapers` out of `/DATA/AppData/casamod/mod/` and restart CasaMOD (pick another wallpaper first).

## Using it

- **Choosing a wallpaper:** CasaOS settings (top bar) → **Wallpaper** → **Change**, pick a tile and **Apply**, like any CasaOS wallpaper. Pick a built-in or uploaded image to go back; the animation then stops and unloads. CasaOS saves the choice on the server, so it follows your user to every device. The dashboard's right-click "Change wallpaper" opens the same menu.
- **Wallpaper settings:** while a live wallpaper is the chosen one, a **Customize** button sits next to **Change**: its own options (from its `project.json`, as Wallpaper Engine would show them) plus a frame rate limit, or sound and volume for videos. The short text lines wallpapers use as headers ("— Mouse —") become sections that open and close, all closed at first; the panel remembers which ones you opened. With many options, a search box filters them (a section's title shows the whole section). A color option opens a color picker inside the panel, under its row: a shade square, a hue bar, a hex field and, in Chrome, an eyedropper. Esc closes the color picker, then clears the search, then closes the panel. These settings are saved in the browser.
- **Pictures, videos and folders:** a wallpaper option that takes a file (an image or a video) or a folder (a slideshow, backgrounds…) shows a **Choose…** button that opens a small browser of the CasaOS storage under its row (starting at `/DATA`): click folders to go in, ↑ to go up, or type a path. An image option lists only images, a video option only videos; a folder option has **Use this folder**. ✕ removes the choice. The wallpaper gets the file the way Wallpaper Engine gives it (its absolute path, `/DATA/…`, which wallpapers turn into a `file:///` URL), and only what you picked: the picked files, and the images and videos right inside a picked folder (not its subfolders). An isolated wallpaper gets a copy of the file (the whole file loads first, so a big video takes a moment); a trusted one streams it straight from CasaOS.
- **Mouse:** moves anywhere and presses on the empty dashboard background go to the wallpaper. Icons and widgets keep working as usual, and dragging on the wallpaper doesn't select the dashboard's text.
- **Audio:** every same-origin `<audio>`/`<video>` that plays in the CasaOS tab (a music player widget, a video, anything) is routed through an analyser — the sound still reaches your speakers — and reaches web wallpapers as Wallpaper Engine audio. Sound the tab can't read can come from another mod: App Windows analyses an app playing in a window (Jellyfin, for example) on the app's own address and sends it here (`casamods:audio` events: `{ source, bands }`, the loudest bin of the same 64 bands, 0–255, about 30 times a second), mixed in by the loudest. Such mods are told when a wallpaper listens (`window.casamodsAudioWanted` and a `casamods:audio-wanted` event, `{ on }`), so they only work then. No screen sharing or permission prompt is involved.
- **Media integration:** web wallpapers that use Wallpaper Engine's media integration (now-playing widgets, synced lyrics…) get what plays in the tab: its title, artist and album, its cover as a thumbnail with its main colors (primary, secondary, tertiary, text and high-contrast), playing/paused/stopped, and its position and duration several times a second. The source is the media that last started playing in the tab (any player, never the wallpaper's own video); the title, artist, album and cover come from the Media Session the player sets for the browser's media controls (`navigator.mediaSession`), else the title is the file name. The Music Player widget sets it from each file's tags and cover. Music that plays elsewhere counts too, when a mod reports it: the Music Player's Spotify mode sends what plays on your Spotify devices (a `casamods:nowplaying` event on the page, with the title, artist, album, cover, state and position), so a synced-lyrics wallpaper follows Spotify, even though no sound reaches the tab (audio-reactive wallpapers stay still then). The latest source to start playing wins. Nothing of this runs until a wallpaper registers a media listener.

## The wallpapers folder

Put wallpapers in **`/DATA/AppData/casamod/mod/wallpapers/`**, one folder each (or a loose video file). They show up the next time the wallpaper menu opens; no restart needed. The folder must be inside `mod/`: that is what CasaMOD publishes to the browser (at `/mod/wallpapers/`). It sits next to the `live-wallpapers` mod, not inside it, so updating the mod never touches your wallpapers.

| What | Runs? | How |
|---|---|---|
| Wallpaper Engine **web** wallpaper | ✅ | Its page runs with the Wallpaper Engine web API: its properties (with the settings panel built from `project.json`, translated by its own localization; files and folders picked from the CasaOS storage), general properties (language, frame rate), the tab's audio (128 bands), media integration, the mouse, pause. |
| Wallpaper Engine **video** wallpaper, or a loose `.mp4`/`.webm` | ✅ | Looped, muted by default. Up to 100 MB it is downloaded once and played from memory; bigger files stream. |
| Folder with an `index.html` (no `project.json`) | ✅ | As a web wallpaper. |
| Wallpaper Engine **scene** | ❌ | Wallpaper Engine's own compiled format; listed greyed out with the reason. |
| Wallpaper Engine **application** | ❌ | A Windows program; listed greyed out. |

A Wallpaper Engine wallpaper is copied as is: a folder of `Steam\steamapps\workshop\content\431960\` (Workshop) or one of your own projects. The tile shows its `preview`; a video without one gets a frame of itself.

**Isolation.** A web wallpaper is someone else's code. It runs in a sandboxed iframe with no access to CasaOS, your account, its storage or your session. Some wallpapers need more (loading files with `fetch`, ES modules, WebGL textures from images, `localStorage`) and look broken that way: **Customize → Trust this wallpaper** reloads it with full compatibility, which also gives it full access to the CasaOS page — only for wallpapers you trust.

## How it fits into CasaOS

- CasaMOD injects the mod's `mod.js` and `mod.css` into the CasaOS page and serves the `mod` folder at `/mod/`.
- CasaOS draws its background image (`#background`) on a fixed layer at `z-index: 0`, with the UI above it. The wallpaper goes on that same layer, first in `<body>`, and the CasaOS image is hidden — so widgets keep their frosted glass over the animation and everything stays clickable. On pages without the CasaOS background it hides and pauses.
- The wallpaper menu (CasaOS-UI `WallpaperModal.vue`) gets copies of a built-in tile (so they keep CasaOS's scoped styles). Choosing one sets the menu's own state (`path`, `from: 'Live Wallpaper'`), and CasaOS's **Apply** saves it through its user storage: the path is the wallpaper's preview (or its file) under `/mod/wallpapers/<folder>/`, so it stays usable as a still. The mod follows the choice from `localStorage.wallpaper` at load (no flash) and from the store (`wallpaperObject`), including a choice CasaOS loads from the server (another device's).
- The folder is listed with `GET /v1/folder?path=…` when the menu opens, reading each `project.json` (retried once on a network error; a BOM is fine). On load only the chosen wallpaper is read. Web wallpapers load through `srcdoc` with a `<base>` pointing at their folder and, first in `<head>`, a small script that provides the Wallpaper Engine API and talks to the page with `postMessage`, so it works sandboxed too. Property conditions (`"condition": "a.value == true"`) are read by a small parser, never run as code.
- **Customize** uses the markup of the CasaOS buttons and goes inside the "Wallpaper" row (`.casa-wallpaper-outline` among the settings rows; the right-click menu has the same icon), before **Change**; it turns into just the sparkle when the row is too narrow for the language.
- **The panel follows the CasaOS theme.** Each time it opens it takes the glass (background, blur, radius, shadow) and the text color of a dashboard widget (`.widget .blur-background`, or the settings dropdown), and the CasaOS primary color from a primary button or switch on the page; everything else, the color picker included, derives from those. So a mod that restyles CasaOS restyles the panel too; without one it looks like the widgets.
- **Files and folders** ("file" and "directory" properties) are picked with `GET /v1/folder`, and the wallpaper gets the absolute CasaOS path (`/DATA/Media/a.jpg`), absolute like Wallpaper Engine's `C:/…` (wallpapers that build their own URL, such as Lyric Stage, treat a path without the first slash as a file of their own folder). Whatever URL the wallpaper makes of it (`'file:///' + value`, an encoded `file:///DATA/My%20a.jpg`, or the path as it is) can't load in the page, so the script in the wallpaper swaps them, wherever the wallpaper puts them (`src` of images, videos and `<source>`, `setAttribute`, inline and `<style>` CSS `url()`, `innerHTML`, `fetch`, `XMLHttpRequest`), for the file itself, asked from the page. The page checks each request against what was picked (never the project's defaults, no `..`) and sends the file read from `/v1/file`: its content to an isolated wallpaper (so the session token never reaches it; object URLs over 512 MB are let go, oldest first), its URL to a trusted one. A folder in `"mode": "fetchall"` gets its whole list through `userDirectoryFilesAddedOrChanged` (and `userDirectoryFilesRemoved` when it changes); `wallpaperRequestRandomFileForProperty` answers with a random file of it, sent along, not the same twice in a row.
- The tab audio tap lives on `window.__casaAudioTap`, so another mod could share it (a media element can feed Web Audio only once).
- It follows the CasaOS language (`localStorage.lang`) in all 31 CasaOS languages, English otherwise.

## Tests

```bash
node tests/text-check.js     # languages, a second
node tests/live-runner.mjs   # end to end, a few minutes
```

`live-runner.mjs` drives a headless Chrome (found where it usually is on Windows, Linux or macOS, or set `CHROME`) through the DevTools protocol against a mock CasaOS (`tests/mock.html` served by `tests/server.py`, Python 3): the layering, the settings dropdown, the wallpaper menu (a Vue-like instance on its `.modal-card`, scoped styles via `data-v`), the dashboard's right-click menu and a Vuex-like store, after CasaOS-UI; it injects the mod the way CasaMOD's `run.sh` does and fakes `/v1/folder` and `/v1/file` (with Range). The wallpapers are `tests/fixtures/wallpapers`:

- `probe/` — a Wallpaper Engine web wallpaper that posts everything it receives (properties, general properties, audio, media integration, mouse, pause, whether it can reach the page and its storage, its picked files and folders as images, CSS, markup, video, fetch, folder lists and random files) to the page around it;
- `plain/` — a folder with just an `index.html`;
- `clip.webm` — a loose video;
- `scene-sample/`, `exe-sample/` — types that can't run outside Wallpaper Engine.

and `tests/fixtures/pictures` is the mock's `/DATA/Media/Pictures` (images, a video, a text file, subfolders) for the file and folder options.

A test track (`tests/make_music.py`, generated into `tests/music/` on first run) plays in the tab for the audio. It checks the menu (tiles, previews, video frames, unsupported types, grid), the layering, **Customize** (where it sits, narrow rows, Vue re-renders), the panel (CasaOS look, labels, conditions, types, sections, search, the color picker, following the CasaOS theme), files and folders (the browser, what the wallpaper gets and loads every way, what it may not read, folder lists, random files, removing, trusted streaming), the isolated and trusted runtime, properties, audio, mouse (clicks, moves, drags, no text selection), persistence (and another device's choice), pause, media integration (properties, cover thumbnail and colors, playback, timeline), languages and videos (memory, loop, sound), and fails on any console error. Screenshots go to `tests/shots/`.

## Notes

- Built and tested against the mock and used on a real CasaOS 0.4.15. CasaOS updates that rename its classes (`.dropdown-content`, `.casa-wallpaper-outline`, `#upload-wallpaper`, `#background`) may need small adjustments.
- Audio from other origins (an app opened in another tab, a cross-origin iframe) cannot be analysed by the browser; it simply plays without the wallpaper reacting, unless a mod analyses it where it plays (App Windows with its frame proxy). Protected audio (Spotify's player, with DRM) can't be analysed anywhere.
- The frosted glass of the CasaOS widgets is redrawn over the animation every frame; on slow machines, set a frame rate limit (30 FPS) in **Customize**.
- Removing a wallpaper's folder while it is the chosen one leaves CasaOS pointing at a file that is gone: the background turns plain dark until another wallpaper is picked.
