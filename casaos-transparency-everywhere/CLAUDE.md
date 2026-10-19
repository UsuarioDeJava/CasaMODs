# Transparency Everywhere for CasaOS

A CasaMOD mod, CSS only: frosted glass, like the dashboard widgets', on the top bar, its menus and the CasaOS dialogs. See `README.md`.

- `transparency-everywhere/` is the mod as installed (`mod.css`): no build step, copied as is to `/DATA/AppData/casamod/mod/transparency-everywhere/`.
- It is its own project; it depends on no other mod. Called Transparence Everywhere (folder `transparence-everywhere`) until 1.1.0.

## Working here

- The user is Brazilian: reply in Portuguese (pt-BR). Code, comments and README stay in English.
- It relies on CasaOS-UI class names (listed in the README); a CasaOS update that renames them needs the selectors adjusted. Keep the README list in sync with the selectors.
- No test suite: after a change, check the rules in a headless Chrome/Chromium against markup with the CasaOS classes (`getComputedStyle`), and say what could not be checked.
- Write files with LF line endings (Python on Windows: `open(..., 'w', newline='\n')`). Don't create `.html` files with the editor tool here: the desktop app opens them in the user's browser pane.
- At the end, tell the user what to copy: `transparency-everywhere/` to `/DATA/AppData/casamod/mod/` on the CasaOS server, then restart CasaMOD and reload with Ctrl+F5.
