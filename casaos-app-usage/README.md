# App Usage for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod: each app's card on the CasaOS dashboard shows **what the app uses right now**, in two small gauges drawn like the ones of CasaOS's own system widget:

- bottom-left, **CPU**: the app's share of the whole processor, in %;
- bottom-right, **RAM**: the memory the app uses (`678 M`, `1.6 G`); the arc fills with its share of the server's memory (or of the app's own memory limit, if it has one).

By default they show **when the pointer is on the card** (they fade in), so the dashboard stays clean; `config.json` can keep them on all the time. Point at a gauge for the exact numbers (`CPU 3.0%`, `RAM 677.86 MB · 4.1%`). The gauges move smoothly as the numbers change. A stopped app shows none.

They are the same numbers as the list in CasaOS's **System Status** widget (its CPU and RAM tabs, under the gauges), shown on each app instead. An app made of several containers (LibreChat: its API, its database…) shows their total.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Install **App Usage** from the CasaMOD Store, or copy the `app-usage` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).

Nothing else to install: the numbers come from CasaOS itself.

To remove it, move `app-usage` out of `/DATA/AppData/casamod/mod/` and restart CasaMOD.

## Settings: `config.json`

The mod's folder has a `config.json` with its settings, in the format every mod of this repository uses ([CONFIG.md](../CONFIG.md)): each setting describes itself (its type, its choices or limits, its default, its name and description in all 31 CasaOS languages), so the CasaMOD Store shows and changes them for you. By hand, change only the `"value"` of a setting.

| Setting (`key`) | Type | Values | Default | What it does |
| --- | --- | --- | --- | --- |
| `show` | `select` | `"hover"` (On hover) or `"always"` (Always) | `"hover"` | `"hover"`: the gauges show while the pointer is on the card, and CasaOS is asked for the numbers only then. `"always"`: on every card all the time. |
| `interval` | `number` | `1` to `60`, step `1` (seconds) | `3` | Seconds between two readings. |
| `startup` | `boolean` | `true` or `false` | `false` | A startup animation: when CasaOS loads, every card's gauges show, sweep up to 100% and come back down to their reading, like a car's rev counter; then `show` applies again. Only for looks; with `"hover"`, CasaOS is asked once at load without a card hovered. |

`show` and `interval` apply when the CasaOS tab comes back in sight (`"applies": "visible"`: switch to another tab and back), without reloading; `startup` at the next load (`"applies": "reload"`: Ctrl+F5). A value outside its rules counts as the default.

Copying a newer `app-usage` folder over the old one brings the new `config.json` with the default values: the CasaMOD Store keeps your values (CONFIG.md says how); by hand, note yours and set them again.

## How it works

- Every 3 seconds (`interval`), only while the CasaOS tab is in sight and shows app cards, and with `"show": "hover"` only while the pointer is on one, the mod asks CasaOS for its containers' numbers: `GET /v1/container/usage` (with the session's token), the request CasaOS's System Status widget makes. CasaOS answers with each running container's Docker statistics, the previous reading, its name and its app's icon. Each request keeps CasaOS reading every container's statistics, once a second, for the next 100 seconds, which is why `"hover"` asks only while you look.
- The numbers are worked out as that widget does (`widgets/Cpu.vue` in CasaOS-UI): CPU = the container's CPU time between the two readings ÷ the whole machine's, in %; RAM = the memory used minus the page cache (`inactive_file`, or `cache`), against the container's memory limit (the machine's memory when it has none).
- Each container goes to the card of its app: the app whose name is the container's name or begins it (`librechat` for `librechat-api`, `mineos` for `mineos_server`; the longest name wins), else the app with the container's icon (CasaOS labels an app's containers with the app's icon). An app's containers are added up.
- The gauges are small copies of CasaOS's `RadialBar`: a 270° arc, a white track at 40%, the green-to-yellow gradient (`#33FFAA` → `#FFD580`), round ends. They sit in the card's holder (`#app-<name>`, outside CasaOS's own card component), so CasaOS's card keeps working as before; when CasaOS draws its cards again (an app installed, started or stopped), the gauges come back at once from the last reading. They sit under the app's name, which keeps its whole width. CasaOS's cards are square with their content centered, so the room under the name shrinks with the window (about 47 px on a 205 px card, 27 px on a 168 px one): the gauges are as big as that room allows, 32 to 40 px, a few pixels clear of the name, and their numbers scale with them. Where even 32 px would reach the name's line, a name long enough to run over the gauges is shortened to fit between them while they show (a short one isn't touched).
- `config.json` is read from the mod's own folder (CasaMOD loads the mod as `<script src="mod/<folder>/mod.js">`), at load and each time the tab comes back in sight. The mod keeps the defaults and limits in its own code and takes each `value` by its `key` only if it's valid (it also reads the plain `{ "show", "interval" }` file of version 1.1.0).
- With "reduce motion" set in the system, the gauges don't animate.

It relies on CasaOS-UI's markup: the `#app-<name>` card holders, `.app-card`, `.cards-content` (its `img` and `p.one-line`). A CasaOS update that renames them needs the mod adjusted.

## Tests

- `node tests/config-check.js`: `config.json` against the format of [CONFIG.md](../CONFIG.md) (structure, every text in all 31 languages, values within their rules) and its defaults against the mod's own.
- `node tests/card-check.mjs` loads the mod on cards shaped like CasaOS's, with CasaOS's answer faked (an app with two containers, one found by its icon, a stopped one), and checks both `show` settings (in `"hover"`, nothing asked before the pointer is on a card, the gauges fading in on that card only and CasaOS no longer asked once the pointer leaves), the numbers, the tooltips, the name's width and the gauges coming back after CasaOS draws a card again, with `config.json` served next to the mod as CasaMOD does. It needs Playwright and Chrome or Chromium (found in the usual places, or set `CHROME`).
