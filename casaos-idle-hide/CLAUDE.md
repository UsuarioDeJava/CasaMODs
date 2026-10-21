# Idle Hide for CasaOS

A CasaMOD mod: after some minutes without activity on the dashboard (or with a switch at the far right of the top bar), everything but the wallpaper fades away in a cascade and the wallpaper is raised on top; a click or a key (only those) brings it back. The idle time and an on/off switch sit in a row of the CasaOS settings dropdown. See `README.md`.

- `idle-hide/` is the mod as installed (`mod.js`, `mod.css`, `config.json`, `mod.json`, `preview.png`): no build step, copied as is to `/DATA/AppData/casamod/mod/idle-hide/`.
- It is its own project and depends on no other mod. It only knows Live Wallpapers by its public markers (`html.lw-on`, `#lw-layer`, `#lw-panel`), and App Windows by `html.cw-active` (a window in use: never idle meanwhile), and must keep working without them.
- Settings: `idle-hide/config.json` in the repository's format ([`../CONFIG.md`](../CONFIG.md)): `cascade` (true; false: no delays between pieces), `speed` (slow/normal/fast: `PACE` 1.8/1/0.5 on the fade times and steps), `wakeOnMove` (false; true: a real mouse move wakes an idle hide, never a manual one); "applies": "visible". The idle time and switch stay in its CasaOS settings row (localStorage). `mod.js` keeps `DEFAULTS` and `VALID` and reads each `value` by key (`loadConfig`); a new or changed setting needs `config.json` (all 31 languages), `DEFAULTS`/`VALID` and the README's table, and `node tests/config-check.js` checks them.

## Working here

- The user is Brazilian: reply in Portuguese (pt-BR). Code, comments and README stay in English.
- Texts live in the `TEXT` table of `mod.js`, in all 31 CasaOS languages (`pt-pt` only overrides `pt`). A new or changed text needs every language — `node tests/text-check.js` fails otherwise.
- The CasaOS selectors (README, "How it works") come from CasaOS-UI's source; keep `tests/mock.html` faithful to it when touching them.
- The wake listeners are on window in the capture phase and must never stop `mousemove`, never act on untrusted events, and do nothing while everything shows.
- Tests: the user's PC struggles with browser tests. Always run `node tests/text-check.js` (a second); run `node tests/idle-runner.mjs` (a few minutes) once after changing the mod, not repeatedly. In a cloud session, run it after each change.
- Write files with LF line endings (Python on Windows: `open(..., 'w', newline='\n')`). Don't create `.html` files with the editor tool here: the desktop app opens them in the user's browser pane.
- The user's PC is low-end: one timer, no per-frame work, CSS transitions only.
- Bump `version` in `idle-hide/mod.json` when the mod changes. At the end, tell the user what to copy: `idle-hide/` to `/DATA/AppData/casamod/mod/` on the CasaOS server, then restart CasaMOD and reload with Ctrl+F5.
