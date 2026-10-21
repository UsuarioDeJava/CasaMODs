# App Updates for CasaOS

A CasaMOD mod: a badge on the icon of each app with an update in its app store, from CasaOS's `GET /v2/app_management/compose` (`update_available`). See `README.md`.

- `app-updates/` is the mod as installed (`mod.js`, `mod.css`, `mod.json`, `preview.png`): no build step, copied as is to `/DATA/AppData/casamod/mod/app-updates/`.
- It is its own project; it depends on no other mod.
- CasaOS facts, from CasaOS-AppManagement's source: `MyComposeAppList` (`GET /v2/app_management/compose`) runs `IsUpdateAvailable` for each app (cached in `isAppUpgradable`): false for uncontrolled apps and apps without a store app id, else the installed main tag against the store's. `GET /compose/{id}` doesn't (its check is disabled for speed). The ⋯ menu's "Check then update" is CasaOS-UI's `checkAppVersion` in `components/Apps/AppCard.vue`; its label comes from CasaOS's own translations (`vm.$t('Check then update')`).
- The badge is a button inside `.cards-content .is-relative` (next to the icon, like CasaOS's "NEW" `CTooltip`); its click (capture phase, stopped) clicks the card's `.app-card-drop [role="button"]`.

## Working here

- The user is Brazilian: reply in Portuguese (pt-BR). Code, comments and README stay in English.
- Texts live in the `TEXT` table of `mod.js`, in all 31 CasaOS languages (`pt-pt` only overrides `pt`). A new or changed text needs every language — `node tests/text-check.js` fails otherwise.
- Tests: `node tests/text-check.js` (a second) and `node tests/card-check.mjs` (a few seconds) after a change.
- Write files with LF line endings (Python on Windows: `open(..., 'w', newline='\n')`). Don't create `.html` files with the editor tool here: the desktop app opens them in the user's browser pane.
- Bump `version` in `app-updates/mod.json` when the mod changes. At the end, tell the user what to copy: `app-updates/` to `/DATA/AppData/casamod/mod/` on the CasaOS server, then restart CasaMOD and reload with Ctrl+F5.
