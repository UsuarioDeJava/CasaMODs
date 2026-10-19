# Idle Hide for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod: after some minutes without activity on the CasaOS dashboard, everything but the wallpaper goes away, one piece after the other, and the wallpaper is left alone on screen. A click or a key brings it all back. A switch at the far right of the top bar does the same on demand.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Copy the `idle-hide` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).

To remove it, move `idle-hide` out of `/DATA/AppData/casamod/mod/` and restart CasaMOD.

## Using it

- **Idle:** after the idle time (5 minutes at first) without moving the mouse, clicking, scrolling, touching or typing, the dashboard goes: the top bar first, then the search, apps and widgets in a wave from the top left, then the footer. The wallpaper stays, raised above everything.
  - Only a **click** (or a tap) or a **key** brings it back, in the reverse order. That click or key does nothing else: no app opens, nothing gets typed.
  - **Mouse moves don't** bring it back. An animated wallpaper ([Live Wallpapers](../casaos-live-wallpapers)) keeps following the mouse.
  - Modifier keys alone (Shift, Ctrl, Alt…) don't wake it either. Shortcuts such as Ctrl+F or F5 still work.
  - **Media keys** (play/pause, next, previous, volume) control the music without waking it, and they don't count as activity either.
- **By hand:** the switch at the far right of the top bar hides everything at once, and it stays that way until the switch is turned off again, or Esc.
  - Meanwhile clicks and moves go to the wallpaper, so an interactive one can be played with.
  - The switch stays visible, faint, and turns clear under the mouse.
  - Hiding by hand isn't remembered: a reload shows everything.
- **Settings:** CasaOS settings (top bar) → **Idle time**, right after **Wallpaper**:
  - the minutes (1 to 1440);
  - a switch that turns idle hiding on or off. The top-bar switch keeps working either way.

  Saved in the browser.
- It never hides while something is in use:
  - an open menu or CasaOS dialog;
  - an app window in use ([App Windows](../casaos-app-windows): what you do inside a window doesn't reach the page);
  - the Live Wallpapers settings panel;
  - a text field with the cursor in it;
  - any page other than the dashboard (login…).

  A CasaOS dialog that opens while everything is hidden brings it back.
- With "reduce motion" turned on in the system, there's no cascade, just a short fade.
- It follows the CasaOS language (`localStorage.lang`) in all 31 CasaOS languages, English otherwise.

## How it works

- **The cascade:**
  - The pieces are the top bar (`.top-bar`) and the dashboard items: `.search-bar`, `.swiper-container`, the section titles, the app cards `.app-list > .handle`, the widgets `.side-bar .scroll-area > *` and the widget settings card. Then the footer (`#app > .base-bar`).
  - Each piece fades and drops a few pixels, with CSS transitions only. The script just gives each one a delay (`--idh-d`).
  - **The frosted glass keeps blurring while it fades.** In CasaOS the glass is a `.blur-background` child of each widget and app card, or a `::before` on a themed top bar. An ancestor with opacity below 1 would cut it off from the wallpaper, and the blur would vanish during the fade. So when hiding starts, each piece is marked (`data-idh-fade`, `data-idh-glass`) so that the opacity lands on the glass itself and on the content next to it, never on a box around the glass. The movement (`translate`) stays on the piece, since a transform doesn't cut the glass off.
  - The dashboard items are sorted by their position on screen, so the wave works with any number of apps and widgets and any layout. The whole cascade lasts under a second.
- **The dashboard root:** after the cascade, the dashboard root (`#app > :has(> .top-bar)`, which matches every CasaOS-UI version) and the footer become `visibility: hidden`. Whatever wasn't in the list goes too. The root itself never fades or moves: opacity would cut its glass off, and a transform would break the fixed widget column. Hidden things can't be clicked or focused, and the widgets' frosted glass isn't drawn.
- **The wallpaper on top:** at the end the wallpaper is raised above everything, so nothing unknown can stay on screen (a toast, another mod's popup, something new in CasaOS).
  - With **Live Wallpapers** on (`html.lw-on`), its own layer (`#lw-layer`) is raised.
  - Otherwise a copy of the CasaOS image (`#background`'s background) is put on top.
  - Coming back, the wallpaper is lowered first, while the rest is still invisible.
- **The catcher:** while hidden, a transparent full-screen layer takes every click, so nothing invisible can be clicked. Live Wallpapers sees it as empty background, so in manual mode it forwards presses and moves to the wallpaper.
- **Waking up:** the wake listeners are on `window`, in the capture phase, so they run before the page's own listeners (CasaOS, Live Wallpapers).
  - A trusted `pointerdown` while idle brings everything back and stops the rest of that press (`mousedown`, `mouseup`, `click`, `contextmenu`, the touch).
  - A key while idle does the same for that key.
  - Mouse moves are never stopped. Synthetic events (from scripts) are ignored.
- **Idle detection:** activity listeners only store the time of the last activity. A single timer is set for the whole idle time and checked when it fires. There's no polling and no per-frame work. Mouse moves count only when the pointer really moved.
- **The top-bar switch** is a page-level element placed over the top bar's empty right end (`.navbar-end`).
  - It takes the color of the top bar's icons, so it follows light and dark mode and themes.
  - It isn't inside the top bar because of three things: the fade would hide it, Bulma hides `.navbar-menu` below 1024 px, and Vue re-renders the top bar.
- **The settings row** uses the markup of CasaOS's own rows: the `_box` row classes, a Buefy `_small` switch and the `casa-time-outline` icon. It goes after the Wallpaper row, or before `._footer` if there's no Wallpaper row.
- **CasaOS re-renders:** a debounced observer puts the row back and refreshes the texts. Leaving the dashboard (logout, `#/login`) shows everything and hides the switch.
- `window.CasaIdleHide` exposes `hide()`, `show()`, `mode` and `settings`.

## Tests

```bash
node tests/text-check.js    # languages, a second
node tests/idle-runner.mjs  # end to end, a few minutes
```

`idle-runner.mjs` drives a headless Chrome (found where it usually is on Windows, Linux or macOS, or set `CHROME`) through the DevTools protocol with real mouse, key and touch input. It runs against a mock CasaOS dashboard (`tests/mock.html` served by `tests/server.py`, Python 3), built after CasaOS-UI (App.vue, Home.vue, TopBar.vue, SideBar.vue, AppSection.vue) and Buefy 0.9.29.

The mock has:
- the top bar with its settings dropdown and Buefy switches;
- the footer, with a tooltip that forces itself visible;
- the search bar, the apps and the widget column;
- the hidden file manager.

It records what the page sees, imitates Live Wallpapers' press forwarding, and can open dialogs, the Live Wallpapers panel and its layer, the login page, and re-render the settings or the top bar. The idle time is set to 3 seconds for the run.

It checks:
- where the switch sits (1440, 1000 and 400 px wide);
- the settings row (place, markup, defaults, limits, persistence, re-renders);
- the cascade order and timing, the raised wallpaper (a copy, or Live Wallpapers' layer), and the catcher;
- that the frosted glass keeps blurring through the cascade, both ways, also with Transparency Everywhere's top bar;
- that moves and media keys don't wake it and cost nothing (no timers, no animation frames);
- waking by click, right click, tap or key with nothing else happening, while modifiers and synthetic events don't wake it;
- every case that keeps it from hiding;
- manual hiding (wallpaper clicks, Esc, Space, the Live Wallpapers panel, not kept after a reload) and turning idle hiding off;
- reduced motion and languages;
- and it fails on any console error. Screenshots go to `tests/shots/`.

## Notes

- Built against CasaOS-UI as of CasaOS 0.4.15 (both the `out-container` and the older Tailwind dashboard layout). CasaOS updates that rename the classes above may need small adjustments; the raised wallpaper still keeps anything unknown off screen.
- Independent from the other mods. It works with a static CasaOS wallpaper or with Live Wallpapers, and the Music Player keeps playing while everything is hidden.
