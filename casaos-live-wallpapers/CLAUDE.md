# Live Wallpapers for CasaOS

A CasaMOD mod: an animated wallpaper engine for the CasaOS dashboard. It lists `/DATA/AppData/casamod/mod/wallpapers/` (Wallpaper Engine web/video wallpapers as published, HTML folders, loose videos), adds them to the CasaOS wallpaper menu, and runs the chosen one behind the UI — web wallpapers in a sandboxed `srcdoc` iframe fed the Wallpaper Engine web API (properties, general properties, tab audio as 128 bands, mouse, pause), with a settings panel built from `project.json`. See `README.md`.

- `live-wallpapers/` is the mod as installed (`mod.js`, `mod.css`, `config.json`): no build step, copied as is to `/DATA/AppData/casamod/mod/live-wallpapers/`.
- It is its own project: it doesn't know about any player or wallpaper in particular. Audio comes from any media element playing in the tab, and from other mods' `casamods:audio` events (App Windows: apps in windows, analysed on their own address; the same 64 bands), mixed in by the loudest; `casamods:audio-wanted` tells them when a wallpaper listens. Starry Orbit (`../../star-wallpaper`, outside this repository) and the music player (`../casaos-music-player`) are separate projects.
- Settings: `live-wallpapers/config.json` in the repository's format ([`../CONFIG.md`](../CONFIG.md)): `audio` and `media` (true: a wallpaper's audio or media request is honoured), `memory` (MB of video kept in memory, 0–1000 by 10; 100); "applies": "reload" (`configured` is the promise the requests and the video wait on). Per-wallpaper settings stay in its Customize panel. `mod.js` keeps `DEFAULTS` and `VALID` and reads each `value` by key (`loadConfig`); a new or changed setting needs `config.json` (all 31 languages), `DEFAULTS`/`VALID` and the README's table, and `node tests/config-check.js` checks them.

## Working here

- The user is Brazilian: reply in Portuguese (pt-BR). Code, comments and README stay in English.
- Texts live in the `TEXT` table of `mod.js`, in all 31 CasaOS languages (`pt-pt` only overrides `pt`). A new or changed text needs every language — `node tests/text-check.js` fails otherwise.
- Tests: the user's PC struggles with browser tests. Always run `node tests/text-check.js` (a second); run `node tests/live-runner.mjs` (a few minutes) once after changing the mod, not repeatedly. Keep the mock (`tests/mock.html`, `tests/server.py`) faithful to CasaOS-UI when touching the integration.
- Wallpapers are third-party code: keep them isolated by default (sandbox, postMessage only, conditions parsed, never evaluated); "trusted" is the user's opt-in per wallpaper. An isolated wallpaper never gets the session token: files it may read (only what the user picked, checked in the page) are sent to it as content.
- Write files with LF line endings (Python on Windows: `open(..., 'w', newline='\n')`). Don't create `.html` files with the editor tool here: the desktop app opens them in the user's browser pane.
- The user's PC is low-end: nothing runs until a wallpaper is chosen, only that one loads, and everything pauses off the dashboard.
- At the end, tell the user what to copy: `live-wallpapers/` to `/DATA/AppData/casamod/mod/` on the CasaOS server, then restart CasaMOD and reload with Ctrl+F5.
