# App Windows for CasaOS

A CasaMOD mod: CasaOS's apps open in windows inside the CasaOS tab (an iframe each, with a bar: icon, title, ⋯, new tab, minimize, maximize/restore, close), dragged, resized, minimized without stopping; Files and the App Store (CasaOS's Buefy modals) become windows too. See `README.md`.

- `app-windows/` is the mod as installed (`mod.js`, `mod.css`, `mod.json`, `preview.png`): no build step, copied as is to `/DATA/AppData/casamod/mod/app-windows/`.
- It is its own project and depends on no other mod. It tells others that a window is in use with `html.cw-active` (Idle Hide reads it).
- The CasaOS facts (README, "How it works") come from CasaOS-UI's source: `mixins/app/Business_OpenThirdApp.js` (`window.open`, the `#/launch?appDetailData=` page), `components/Apps/AppCard.vue` (`#app-<name>` cards, `.cards-content` icon, the `.app-card-drop` menu), `views/Home.vue` (Files: `b-modal` `.file-panel`, `destroy-on-hide=false`, v-show), `components/Apps/AppSection.vue` (App Store: `$buefy.modal.open`, `.app-panel`), `.top-bar`, `.close-button`.
- Rules: a window's element never moves in the DOM once added (an iframe that moves reloads): order is z-index only (21–29). No per-frame work: a MutationObserver on `childList` plus the panels' own `style`, pointer events only while dragging.

## Working here

- The user is Brazilian: reply in Portuguese (pt-BR). Code, comments and README stay in English.
- Texts live in the `TEXT` table of `mod.js`, in all 31 CasaOS languages (`pt-pt` only overrides `pt`). A new or changed text needs every language — `node tests/text-check.js` fails otherwise.
- Tests: `node tests/text-check.js` (a second) and `node --check app-windows/mod.js`. There is no browser suite yet: the user tests on their CasaOS and doesn't want long test runs from here.
- Write files with LF line endings (Python on Windows: `open(..., 'w', newline='\n')`). Don't create `.html` files with the editor tool here: the desktop app opens them in the user's browser pane.
- The user's PC is low-end: keep it light.
- Bump `version` in `app-windows/mod.json` when the mod changes. At the end, tell the user what to copy: `app-windows/` to `/DATA/AppData/casamod/mod/` on the CasaOS server, then restart CasaMOD and reload with Ctrl+F5.
