# App Usage for CasaOS

A CasaMOD mod: CPU and RAM gauges in the bottom corners of each app card on the CasaOS dashboard, from CasaOS's own `GET /v1/container/usage` (what its System Status widget lists). See `README.md`.

- `app-usage/` is the mod as installed (`mod.js`, `mod.css`, `mod.json`, `preview.png`, `config.json`): no build step, copied as is to `/DATA/AppData/casamod/mod/app-usage/`.
- It is its own project; it depends on no other mod.
- CasaOS facts, from its source: the endpoint is CasaOS-AppManagement's `v1ContainerGroup.GET("/usage", v1.AppUsageList)`; each item is `{ title: container name, icon: the container's "icon" label, data: Docker stats, previous: the reading before }`, sampled about once a second by CasaOS for 100 s after each request. The CPU and RAM formulas are CasaOS-UI's `widgets/Cpu.vue` (CPU against the whole machine, not × cores, so the numbers match its widget). The gauge is `components/widgets/RadialBar.vue` (viewBox, `stroke-dasharray: 75 100`, `rotate(-225deg)`, the gradient).
- Containers go to cards by name (equal, or `<name>-` / `<name>_` prefix, longest wins), then by icon. The gauges live in the `#app-<name>` holder (AppSection's v-for div), not inside the Vue component; a MutationObserver puts them back from the last reading.
- `config.json` is in the repository's settings format, [`../CONFIG.md`](../CONFIG.md) (format 1: self-describing settings for the user's CasaMOD Store to show and edit; it writes only `value`). Settings: `show` (`select`: `"hover"`, the default: gauges only on the hovered card, fading in, and requests only while a card is hovered; `"always"`), `interval` (`number`, 1–60, step 1, default 3); both `"applies": "visible"`. The mod keeps `DEFAULTS` and `VALID` in `mod.js` and takes each `value` by key only if valid (it also reads 1.1.0's flat `{ show, interval }`). Read from `new URL('config.json', document.currentScript.src)` at load and on `visibilitychange`. A new or changed setting needs its entry in `config.json` (all 31 languages), `DEFAULTS`/`VALID` and the README's table: `node tests/config-check.js` checks the file and that its defaults match `DEFAULTS`. Hover mode matters for the server too: each request keeps CasaOS sampling every container's stats once a second for 100 s.
- No per-frame work: one request per `interval` only while the tab is visible and has cards (and, in hover mode, a card is hovered); CSS transitions for the arcs and the fade. The gauges sit under the app's name (CasaOS's cards are square), which keeps its width.

## Working here

- The user is Brazilian: reply in Portuguese (pt-BR). Code, comments and README stay in English.
- The gauges have no texts to translate (CPU, RAM and the sizes are the same in every language, as in CasaOS's widget); the settings' texts are in `config.json`.
- Tests: `node tests/config-check.js` (a second) and `node tests/card-check.mjs` (a few seconds) after a change.
- Write files with LF line endings (Python on Windows: `open(..., 'w', newline='\n')`). Don't create `.html` files with the editor tool here: the desktop app opens them in the user's browser pane.
- Bump `version` in `app-usage/mod.json` when the mod changes. At the end, tell the user what to copy: `app-usage/` to `/DATA/AppData/casamod/mod/` on the CasaOS server, then restart CasaMOD and reload with Ctrl+F5.
