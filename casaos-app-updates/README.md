# App Updates for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod: a small blue badge with an arrow on the icon of **each app that has an update** in its app store, on the CasaOS dashboard.

- **Point at the badge:** "Update available · ⋯ → Check then update", in CasaOS's language.
- **Click the badge:** it opens the app's ⋯ menu, where **Check then update** is (CasaOS's own update). After the update, the badge goes away.

CasaOS knows when an app from its store has a newer version, but only shows it if you open each app's ⋯ menu and press **Check then update**. This mod shows it on the dashboard.

## Which apps get a badge

The ones CasaOS itself can tell have an update: apps installed from an app store (CasaOS's or another you added), on the image tag the store uses. CasaOS compares the app with the store's current version. Apps CasaOS doesn't track never get a badge:

- apps installed by hand (**Install a customized app**, a Docker Compose file, or outside CasaOS);
- apps on an image tag of their own (CasaOS calls them "uncontrolled").

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Install **App Updates** from the CasaMOD Store, or copy the `app-updates` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).

To remove it, move `app-updates` out of `/DATA/AppData/casamod/mod/` and restart CasaMOD.

## How it works

- The mod asks CasaOS for its list of installed apps, `GET /v2/app_management/compose` (with the session's token): each app comes with CasaOS's `update_available`, the same check behind **Check then update** (CasaOS keeps its answer for a while, so it's quick after the first time).
- It asks a couple of seconds after CasaOS opens, then every half hour while the tab is in sight, again soon after CasaOS draws its app cards again (an app installed, updated or removed; at most once a minute), and a minute and a half after a click on a badge (after the update).
- The badge goes on the top-left corner of the app's icon, in CasaOS's card (`#app-<name>` → `.cards-content .is-relative`, next to the icon, where CasaOS puts its own "NEW" tag). A click on it opens the card's ⋯ menu (`.app-card-drop`), and doesn't open the app. When CasaOS draws its cards again, the badges come back.

It relies on CasaOS-UI's markup: the `#app-<name>` card holders, `.cards-content .is-relative`, `.app-card-drop`. A CasaOS update that renames them needs the mod adjusted.

## Tests

- `node tests/text-check.js`: the text in all 31 CasaOS languages.
- `node tests/card-check.mjs`: the mod on cards shaped like CasaOS's, with CasaOS's answer faked: badges only where `update_available` is true, the tooltip in the CasaOS language, a click opening the ⋯ menu and not the app, the badges coming back after CasaOS draws a card again. It needs Playwright and Chrome or Chromium (found in the usual places, or set `CHROME`).
