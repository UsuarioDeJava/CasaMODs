# App Windows for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod: the apps open in **windows inside the CasaOS tab** instead of new tabs, as on a desktop.

- A slim bar on top of each window: the app's icon and title, then **⋯** (more), **open in a new tab**, **minimize**, **maximize / restore** and **close**.
- **Drag** a window by its bar, **resize** it by its edges and corners. **Maximize** fills the space below the CasaOS top bar (not full screen); double-click the bar to maximize or restore, drag a maximized window to set it loose again. A narrow window shows the app's phone layout, if it has one.
- **Minimize** hides the window and the app **keeps running**: music keeps playing in this tab while you use other apps. The app's icon on the dashboard brings it back (an open app has a dot under its icon, dimmed while minimized).
- **Open in a new tab** moves the app to a tab, CasaOS's usual way, and closes the window.
- **Files** and the **App Store** (CasaOS's own panels) become windows too: the same bar, dragged, resized, minimized without closing (Files keeps its folder).
- Each app's size, place and maximized state are kept, in this browser. On a phone, windows always fill the screen.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Copy the `app-windows` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).

To remove it, move `app-windows` out of `/DATA/AppData/casamod/mod/` and restart CasaMOD.

## Using it

- **Click an app's icon:** it opens in a window. Click it again (or after minimizing): the same window comes back, not a new one.
- **Ctrl+click** (Cmd+click on a Mac) an icon: a new tab, as before.
- **⋯ (more):**
  - **Reload** the app;
  - **Always open in a new tab** for that app. **Shift+click** its icon still opens it in a window (to switch it back);
  - the app's **HTTPS port** (see below).
- Apps opened from elsewhere (an app's **Open** in the App Store, a widget) open in windows too.

### When an app doesn't show

**A blank window, or "refused to connect":** the app doesn't allow being shown inside another page. Some apps protect themselves this way (`X-Frame-Options` / `frame-ancestors`). Browsers don't tell the page, so the mod can't know. Use **open in a new tab**, and **⋯ → Always open in a new tab** for that app. Some apps can allow it in their settings:

| App | Setting |
| --- | --- |
| Home Assistant | `http: use_x_frame_options: false` in `configuration.yaml` |
| qBittorrent | Web UI → uncheck "Enable clickjacking protection" |
| Grafana | `allow_embedding = true` |

**CasaOS on https://, the app on http://:** if you open CasaOS over HTTPS (for example `tailscale serve`, for the Spotify login), the browser blocks `http://` apps inside the page (mixed content). The window explains it and offers three ways out:

1. open the app in a new tab;
2. open CasaOS at its `http://` address (on your network), where windows just work;
3. give the app an HTTPS port on the server. With Tailscale, the window shows the command, one per app, with any free port (it suggests the app's port + 10000), for example:
   ```bash
   sudo tailscale serve --bg --https=18096 http://127.0.0.1:8096
   ```
   Then type the port in the window and click **Use this port**. It is kept for that app; **⋯** changes it.

## Notes

- **Sound and wallpapers:** an app's sound plays in this tab, but Live Wallpapers can't analyse it. Browsers don't let a page listen to another site's audio, and each app is another site (another port). Wallpapers that react to sound stay still while a window plays.
- **Idle Hide:** what you do inside a window doesn't reach the CasaOS page, so the mod tells other mods that a window is in use (`html.cw-active`). Idle Hide doesn't hide the dashboard meanwhile.
- **CasaOS's own panels:** Files and the App Store depend on CasaOS's page, and a CasaOS update may need an adjustment here (they were made for CasaOS 0.4.x).

## How it works

- CasaOS opens an app with `window.open(scheme://host:port/index)`, or with its launch page `#/launch?appDetailData=…` for an app it just started. The mod wraps `window.open`. An app's address becomes a window: another port of this server, or anything opened right after a click on an app icon. Any other address opens as before. For an app CasaOS has just started, the window waits (a spinner, up to 40 s) until the app answers, as CasaOS's launch page does.
- A window is an `<iframe>` in a `<div>` added once to `<body>`. An iframe moved in the page reloads, so windows never move in the page: which one is on top is only its `z-index` (21–29: above the dashboard, below CasaOS's top bar menus and dialogs). Clicking inside an app's page doesn't reach CasaOS. The tab then loses focus to the iframe, which is how its window comes to the front.
- The icon and title come from the app icon that was clicked. For an app opened from elsewhere, they come from CasaOS's app list (`/v2/app_management/web/appgrid`), by port.
- Files and the App Store are CasaOS's Buefy modals (`.modal.file-panel`, kept when closed, and `.modal.app-panel`, made at each opening). The mod gives them the bar and the place of a window, hides their backdrop, and closes them with their own close button. Minimizing only hides them, so they keep their state.
- Settings: `localStorage['casamod-app-windows']` (`apps[name]`: `rect` as fractions of the space below the top bar, `max`, `tab`, `https`).
- `window.CasaAppWindows`: `open(url, title, iconUrl)` and `windows` (the list), for other mods and debugging.

## Tests

```bash
node tests/text-check.js     # languages, a second
```

All 31 CasaOS languages, every text in each.
