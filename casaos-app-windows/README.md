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
- **F5** (Ctrl+R) reloads the app whose window you last pressed (its bar or edges), not CasaOS (**Shift+F5** reloads CasaOS). After a click inside an app's page, the keys belong to that page and the browser reloads the whole tab, which no page can prevent: click the window's bar first. After a whole reload, the apps' windows come back by themselves.
- **⋯ (more):** **Always open in a new tab** for that app. **Shift+click** its icon still opens it in a window (to switch it back).
- Apps opened from elsewhere (an app's **Open** in the App Store, a widget) open in windows too.

### When an app doesn't show

**A blank window, or "refused to connect":** the app doesn't allow being shown inside another page. The browser's console (F12) of the CasaOS tab then says `Refused to display … in a frame because it set 'X-Frame-Options'` (or `frame-ancestors`). Some apps protect themselves this way (`X-Frame-Options` / `frame-ancestors`). Browsers don't tell the page, so the mod can't know. Use **open in a new tab**, and **⋯ → Always open in a new tab** for that app. Some apps can allow it in their settings:

| App | Setting |
| --- | --- |
| Home Assistant | `http: use_x_frame_options: false` in `configuration.yaml` |
| qBittorrent | Web UI → uncheck "Enable clickjacking protection" |
| Grafana | `allow_embedding = true` |

**Every app in windows: the frame proxy.** With CasaOS opened at its Tailscale HTTPS address, [`frame-proxy.sh`](frame-proxy.sh) makes every app open in a window. Run it on the CasaOS server, and again after installing an app:

```bash
curl -fsSL https://raw.githubusercontent.com/UsuarioDeJava/CasaMODs/main/casaos-app-windows/frame-proxy.sh -o frame-proxy.sh
sudo bash frame-proxy.sh                  # apps outside Docker too: sudo EXTRA="6080" bash frame-proxy.sh
```

- For each port Docker publishes, `tailscale serve` answers `https://<machine>.<tailnet>.ts.net:<port>` with Tailscale's certificate, so there are no browser warnings, not even for apps with their own certificate.
- It hands each request to a small Caddy container (`frame-proxy`, host network, listening only on `127.0.0.1:<port + 30000>`). Caddy passes it to the app without `X-Frame-Options` and without the CSP `frame-ancestors` directive; the rest of the app's policy stays.
- Apps that serve HTTPS themselves (Portainer, MineOS) are found by trying TLS on their port, and reached over HTTPS without checking their certificate (`HTTPS_APPS="8444"` forces a port, if the app was stopped when the script ran).
- It doesn't pass `X-Forwarded-For` to the apps: Home Assistant answers "400: Bad Request" to a proxy it wasn't told to trust. Apps on the host network (Home Assistant from CasaOS's store) publish no port in Docker: add theirs to `EXTRA` (`sudo EXTRA="6080 8123" bash frame-proxy.sh`).
- When an app doesn't answer, the window says so ("Frame proxy: the app on port … did not answer") instead of staying blank.
- It only works inside your tailnet, and the `http://` addresses on your network don't change. Those apps lose their protection against being framed by other sites, but only on these addresses. `sudo bash frame-proxy.sh off` undoes it (CasaOS's own `https://`, port 443, stays).

**CasaOS on https://:** the browser blocks `http://` apps inside an `https://` page (mixed content). So with CasaOS opened over HTTPS (for example `tailscale serve`), an app opens at its `https://` address on the same port. That works where the server serves HTTPS on that port, such as `tailscale serve --bg --https=8096 http://127.0.0.1:8096`. Otherwise the window shows the browser's error: use **open in a new tab**. At CasaOS's `http://` address, windows just work.

**An app with its own certificate** (self-signed, one the browser doesn't know) can't show inside a window, because a certificate can't be accepted there. Open it in a new tab and accept the certificate; after that, it opens in windows too. Or give it Tailscale's certificate on the same port: `tailscale serve --bg --https=9443 https+insecure://127.0.0.1:9443` (`https+insecure`: Tailscale doesn't check the app's own certificate).

## Notes

- **Sound and wallpapers:** an app's sound plays in this tab, but Live Wallpapers can't analyse it. Browsers don't let a page listen to another site's audio, and each app is another site (another port). Wallpapers that react to sound stay still while a window plays.
- **Idle Hide:** what you do inside a window doesn't reach the CasaOS page, so the mod tells other mods that a window is in use (`html.cw-active`). Idle Hide doesn't hide the dashboard meanwhile.
- **CasaOS's own panels:** Files and the App Store depend on CasaOS's page, and a CasaOS update may need an adjustment here (they were made for CasaOS 0.4.x).

## How it works

- CasaOS opens an app with `window.open(scheme://host:port/index)`, or with its launch page `#/launch?appDetailData=…` for an app it just started. The mod wraps `window.open`. An app's address becomes a window: another port of this server, or anything opened right after a click on an app icon. Any other address opens as before.
- A window is an `<iframe>` in a `<div>` added once to `<body>`. An iframe moved in the page reloads, so windows never move in the page: which one is on top is only its `z-index` (21–29: above the dashboard, below CasaOS's top bar menus and dialogs). Clicking inside an app's page doesn't reach CasaOS. The tab then loses focus to the iframe, which is how its window comes to the front.
- The icon and title come from the app icon that was clicked. For an app opened from elsewhere, they come from CasaOS's app list (`/v2/app_management/web/appgrid`), by port.
- Files and the App Store are CasaOS's Buefy modals (`.modal.file-panel`, kept when closed, and `.modal.app-panel`, made at each opening). The mod gives them the bar and the place of a window, hides their backdrop, and closes them with their own close button. Minimizing only hides them, so they keep their state.
- Nothing is checked before a window opens: a page can't tell whether another site will show in a frame (Chrome hides the answer of a `no-cors` request for a web page: ORB). For an app CasaOS has just started, the window waits until the app's `/favicon.ico` loads (an image is the one answer a page can see from another site), 12 s at most.
- Settings: `localStorage['casamod-app-windows']` (`apps[name]`: `rect` as fractions of the space below the top bar, `max`, `tab`). The open apps, for a reload: `sessionStorage['casamod-app-windows-open']`.
- Files and the App Store get their place with `!important` inline styles: they are Bulma modals, whose stylesheet pins them to the whole screen.
- `window.CasaAppWindows`: `open(url, title, iconUrl)` and `windows` (the list), for other mods and debugging.

## Tests

```bash
node tests/text-check.js     # languages, a second
```

All 31 CasaOS languages, every text in each.
