# Transparency Everywhere for CasaOS

A CasaMOD mod, CSS plus a small settings script: frosted glass, like the dashboard widgets', on the top bar, its menus and the CasaOS dialogs. See `README.md`.

- `transparency-everywhere/` is the mod as installed (`mod.css`, `mod.js`, `config.json`, `mod.json`, `preview.png`): no build step, copied as is to `/DATA/AppData/casamod/mod/transparency-everywhere/`.
- It is its own project; it depends on no other mod. Called Transparence Everywhere (folder `transparence-everywhere`) until 1.1.0.

- Settings: `transparency-everywhere/config.json` in the repository's format ([`../CONFIG.md`](../CONFIG.md)): `blur` (0–40 px; 20), `tint` (0–90 %, by 5; 40), `topBar` (true); "applies": "visible". `mod.js` only reads them and sets `--te-blur`, `--te-tint` and `html.te-no-bar`; `mod.css` uses them with its old values as fallbacks (`var(--te-tint, .4)`), so the CSS alone still works. `node tests/config-check.js` checks `config.json` against `DEFAULTS` in `mod.js`.

## Working here

- The user is Brazilian: reply in Portuguese (pt-BR). Code, comments and README stay in English.
- It relies on CasaOS-UI class names (listed in the README); a CasaOS update that renames them needs the selectors adjusted. Keep the README list in sync with the selectors.
- No test suite: after a change, check the rules in a headless Chrome/Chromium against markup with the CasaOS classes (`getComputedStyle`), and say what could not be checked.
- Write files with LF line endings (Python on Windows: `open(..., 'w', newline='\n')`). Don't create `.html` files with the editor tool here: the desktop app opens them in the user's browser pane.
- At the end, tell the user what to copy: `transparency-everywhere/` to `/DATA/AppData/casamod/mod/` on the CasaOS server, then restart CasaMOD and reload with Ctrl+F5.
