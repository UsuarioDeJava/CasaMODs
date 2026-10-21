# App Usage for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod: each app's card on the CasaOS dashboard shows **what the app uses right now**, in two small gauges drawn like the ones of CasaOS's own system widget:

- bottom-left, **CPU**: the app's share of the whole processor, in %;
- bottom-right, **RAM**: the memory the app uses (`678 M`, `1.6 G`); the arc fills with its share of the server's memory (or of the app's own memory limit, if it has one).

Point at a gauge for the exact numbers (`CPU 3.0%`, `RAM 677.86 MB · 4.1%`). The gauges move smoothly as the numbers change. A stopped app shows none.

They are the same numbers as the list in CasaOS's **System Status** widget (its CPU and RAM tabs, under the gauges), shown on each app instead. An app made of several containers (LibreChat: its API, its database…) shows their total.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Install **App Usage** from the CasaMOD Store, or copy the `app-usage` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).

Nothing else to install: the numbers come from CasaOS itself.

To remove it, move `app-usage` out of `/DATA/AppData/casamod/mod/` and restart CasaMOD.

## How it works

- Every 3 seconds, only while the CasaOS tab is in sight and shows app cards, the mod asks CasaOS for its containers' numbers: `GET /v1/container/usage` (with the session's token), the request CasaOS's System Status widget makes. CasaOS answers with each running container's Docker statistics, the previous reading, its name and its app's icon.
- The numbers are worked out as that widget does (`widgets/Cpu.vue` in CasaOS-UI): CPU = the container's CPU time between the two readings ÷ the whole machine's, in %; RAM = the memory used minus the page cache (`inactive_file`, or `cache`), against the container's memory limit (the machine's memory when it has none).
- Each container goes to the card of its app: the app whose name is the container's name or begins it (`librechat` for `librechat-api`, `mineos` for `mineos_server`; the longest name wins), else the app with the container's icon (CasaOS labels an app's containers with the app's icon). An app's containers are added up.
- The gauges are small copies of CasaOS's `RadialBar`: a 270° arc, a white track at 40%, the green-to-yellow gradient (`#33FFAA` → `#FFD580`), round ends. They sit in the card's holder (`#app-<name>`, outside CasaOS's own card component), so CasaOS's card keeps working as before; when CasaOS draws its cards again (an app installed, started or stopped), the gauges come back at once from the last reading. The app's name gets a little room on each side so it doesn't run under them.
- With "reduce motion" set in the system, the gauges don't animate.

It relies on CasaOS-UI's markup: the `#app-<name>` card holders, `.app-card`, `.cards-content` (its `img` and `p.one-line`). A CasaOS update that renames them needs the mod adjusted.

## Tests

`node tests/card-check.mjs` loads the mod on cards shaped like CasaOS's, with CasaOS's answer faked (an app with two containers, one found by its icon, a stopped one), and checks the numbers, the tooltips, the room for the name and the gauges coming back after CasaOS draws a card again. It needs Playwright and Chrome or Chromium (found in the usual places, or set `CHROME`).
