# CasaMODs

Mods for the [CasaOS](https://casaos.io) dashboard, installed with [CasaMOD](https://github.com/Cp0204/CasaMOD). Each folder is its own project, with its own README and tests:

- [`casaos-live-wallpapers`](casaos-live-wallpapers) — **Live Wallpapers**: animated wallpapers for the dashboard. Wallpaper Engine web and video wallpapers, HTML folders and loose videos, picked from the CasaOS wallpaper menu, with a settings panel built from their `project.json` (pictures, videos and folders picked from the CasaOS storage included).
- [`casaos-music-player`](casaos-music-player) — **Music Player**: a dashboard widget that plays a folder of the CasaOS storage in the CasaOS tab.
- [`casaos-music-player-spotify`](casaos-music-player-spotify) — **Music Player + Spotify**: the Music Player with a switch to your Spotify account (what plays on any of your devices, its controls, your playlists, the queue, search and devices; or the CasaOS tab plays it, as a Spotify device), or your Jellyfin music library, played in the tab. Install it instead of the Music Player; the Spotify mode needs CasaOS over HTTPS (its README shows how, with Tailscale).
- [`casaos-idle-hide`](casaos-idle-hide) — **Idle Hide**: after a while without activity (or with a switch at the far right of the top bar), everything but the wallpaper fades away, one piece after the other; a click or a key brings it back. The idle time is set in the CasaOS settings.
- [`casaos-app-windows`](casaos-app-windows) — **App Windows**: apps open in windows inside the CasaOS tab instead of new tabs (drag, resize, maximize, minimize while the app keeps running, open in a new tab); Files and the App Store become windows too.
- [`casaos-hide-footer`](casaos-hide-footer) — **Hide Footer**: hides the dashboard footer (CasaOS logo, text and social buttons) and gives the space to apps and widgets.
- [`casaos-hide-widget-settings`](casaos-hide-widget-settings) — **Hide Widget Settings**: hides the "Widget settings" card of the widget column. With Hide Footer, they also fix CasaOS's widget column so it ends on the apps' line at any window size.
- [`casaos-transparence-everywhere`](casaos-transparence-everywhere) — **Transparence Everywhere**: the widgets' frosted glass on the top bar, its menus and the CasaOS dialogs. CSS only.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Copy the mod folder (the folder inside each project, e.g. `casaos-music-player/music-player-widget` or `casaos-hide-footer/hide-footer`) into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).

## Tests

The JavaScript mods each have a quick language check and, except Music Player + Spotify and App Windows, an end-to-end suite against a mock CasaOS (Node.js 18+, Python 3 and Chrome or Chromium):

```bash
node casaos-live-wallpapers/tests/text-check.js
node casaos-live-wallpapers/tests/live-runner.mjs
node casaos-music-player/tests/text-check.js
node casaos-music-player/tests/player-runner.mjs
node casaos-music-player-spotify/tests/text-check.js
node casaos-idle-hide/tests/text-check.js
node casaos-idle-hide/tests/idle-runner.mjs
node casaos-app-windows/tests/text-check.js
```

The widget column of Hide Footer and Hide Widget Settings: `node casaos-hide-widget-settings/tests/layout-check.mjs`.
