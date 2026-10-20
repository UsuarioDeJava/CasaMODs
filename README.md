# CasaMODs

Mods for the [CasaOS](https://casaos.io) dashboard, installed with [CasaMOD](https://github.com/Cp0204/CasaMOD). Each folder is its own project, with its own README and tests:

- [`casaos-live-wallpapers`](casaos-live-wallpapers) — **Live Wallpapers**: animated wallpapers for the dashboard. Wallpaper Engine web and video wallpapers, HTML folders and loose videos, picked from the CasaOS wallpaper menu, with a settings panel built from their `project.json` (pictures, videos and folders picked from the CasaOS storage included). They react to the music playing in the tab and show what plays (now playing, synced lyrics).
- [`casaos-music-player`](casaos-music-player) — **Music Player**: a dashboard music widget with a switch between a folder of the CasaOS storage (played in the CasaOS tab), your Spotify account (what plays on any of your devices, its controls, your playlists, the queue, search and devices; or the CasaOS tab plays it, as a Spotify device) and your Jellyfin music library (played in the tab). The Spotify mode needs CasaOS over HTTPS (its README shows how, with Tailscale).
- [`casaos-idle-hide`](casaos-idle-hide) — **Idle Hide**: after a while without activity (or with a switch at the far right of the top bar), everything but the wallpaper fades away, one piece after the other; a click or a key brings it back. The idle time is set in the CasaOS settings.
- [`casaos-app-windows`](casaos-app-windows) — **App Windows**: apps open in windows inside the CasaOS tab instead of new tabs (drag, resize, maximize, minimize while the app keeps running, open in a new tab); Files and the App Store become windows too. Its frame proxy (a script run once on the server) lets every app open in a window over HTTPS, F5 reload the app inside it, and wallpapers hear and show what the app plays.
- [`casaos-hide-footer`](casaos-hide-footer) — **Hide Footer**: hides the dashboard footer (CasaOS logo, text and social buttons) and gives the space to apps and widgets.
- [`casaos-hide-widget-settings`](casaos-hide-widget-settings) — **Hide Widget Settings**: hides the "Widget settings" card of the widget column. With Hide Footer, they also fix CasaOS's widget column so it ends on the apps' line at any window size.
- [`casaos-transparency-everywhere`](casaos-transparency-everywhere) — **Transparency Everywhere**: the widgets' frosted glass on the top bar, its menus and the CasaOS dialogs. CSS only.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Copy the mod folder (the folder inside each project, e.g. `casaos-music-player/music-player-widget` or `casaos-hide-footer/hide-footer`) into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).

To update a mod, copy its folder again (replacing the old one) and do step 3.

## Step-by-step guides

- **CasaOS over HTTPS with Tailscale** (for Spotify, and for the frame proxy): [Music Player → Spotify, step 1](casaos-music-player/README.md#1-casaos-over-https-with-tailscale).
- **Spotify in the Music Player:** [create your Spotify app and connect](casaos-music-player/README.md#spotify).
- **Jellyfin in the Music Player:** [connect with Quick Connect](casaos-music-player/README.md#jellyfin).
- **Every app in a window, CasaOS on Tailscale (the frame proxy):** [App Windows → the frame proxy](casaos-app-windows/README.md#every-app-in-a-window-the-frame-proxy).
- **Every app in a window, CasaOS on your own domain and certificate:** [App Windows → CasaOS on your own domain](casaos-app-windows/README.md#casaos-on-your-own-domain-your-own-certificate).
- **Wallpapers:** [where to put them and what runs](casaos-live-wallpapers/README.md#the-wallpapers-folder).

## Tests

The JavaScript mods each have a quick language check and, except App Windows, an end-to-end suite against a mock CasaOS (for the Music Player, its local mode). The suites need Node.js 18+, Python 3 and Chrome or Chromium:

```bash
node casaos-live-wallpapers/tests/text-check.js
node casaos-live-wallpapers/tests/live-runner.mjs
node casaos-music-player/tests/text-check.js
node casaos-music-player/tests/player-runner.mjs
node casaos-idle-hide/tests/text-check.js
node casaos-idle-hide/tests/idle-runner.mjs
node casaos-app-windows/tests/text-check.js
```

The widget column of Hide Footer and Hide Widget Settings: `node casaos-hide-widget-settings/tests/layout-check.mjs`.
