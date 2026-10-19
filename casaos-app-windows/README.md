# App Windows for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod: the apps open in **windows inside the CasaOS tab** instead of new tabs, as on a desktop.

- A slim bar on top of each window: the app's icon and title, then **⋯** (more), **open in a new tab**, **minimize**, **maximize / restore** and **close**.
- **Drag** a window by its bar, **resize** it by its edges and corners. **Maximize** fills the whole tab, over the CasaOS top bar (with the browser in full screen, F11, the whole screen: only the window's bar and the app); double-click the bar to maximize or restore, drag a maximized window to set it loose again. A narrow window shows the app's phone layout, if it has one.
- **Minimize** hides the window and the app **keeps running**: music keeps playing in this tab while you use other apps. The app's icon on the dashboard brings it back (an open app has a dot under its icon, dimmed while minimized).
- **Open in a new tab** moves the app to a tab, CasaOS's usual way, and closes the window.
- **Files** and the **App Store** (CasaOS's own panels) become windows too: the same bar, dragged, resized, minimized without closing (Files keeps its folder).
- Windows go anywhere in the tab, over the CasaOS top bar too. Each app's size, place and maximized state are kept, in this browser. On a phone, windows always fill the screen.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Copy the `app-windows` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).

To remove it, move `app-windows` out of `/DATA/AppData/casamod/mod/` and restart CasaMOD.

## Using it

- **Click an app's icon:** it opens in a window. Click it again (or after minimizing): the same window comes back, not a new one.
- **Ctrl+click** (Cmd+click on a Mac) an icon: a new tab, as before.
- **F5** (Ctrl+R) reloads the app whose window you last pressed (its bar or edges), not CasaOS (**Shift+F5** reloads CasaOS). Inside an app's page too, through the [frame proxy](#every-app-in-a-window-the-frame-proxy). Without it, after a click inside an app's page the keys belong to that page and the browser reloads the whole tab, which no page can prevent: click the window's bar first. After a whole reload, the apps' windows come back by themselves.
- **⋯ (more):** **Always open in a new tab** for that app. **Shift+click** its icon still opens it in a window (to switch it back).
- Apps opened from elsewhere (an app's **Open** in the App Store, a widget) open in windows too.

### When an app doesn't show

**A blank window, or "refused to connect":** the app doesn't allow being shown inside another page. The browser's console (F12) of the CasaOS tab then says `Refused to display … in a frame because it set 'X-Frame-Options'` (or `frame-ancestors`). Browsers don't tell the page, so the mod can't know. Three ways out:

- the [frame proxy](#every-app-in-a-window-the-frame-proxy) below, which fixes it for every app at once;
- **open in a new tab**, and **⋯ → Always open in a new tab** for that app;
- the app's own setting, where it has one:

| App | Setting |
| --- | --- |
| Home Assistant | `http: use_x_frame_options: false` in `configuration.yaml` |
| qBittorrent | Web UI → uncheck "Enable clickjacking protection" |
| Grafana | `allow_embedding = true` |

**CasaOS on https://:** the browser blocks `http://` apps inside an `https://` page (mixed content). So with CasaOS opened over HTTPS, an app opens at its `https://` address on the same port, which needs the server to answer HTTPS there: the frame proxy does that for every app. Without it the window shows the browser's error: use **open in a new tab**. At CasaOS's `http://` address, windows work without the proxy (except for apps that refuse frames).

**An app with its own certificate** (self-signed: Portainer, MineOS) can't show inside a window by itself, because a certificate warning can't be accepted inside a frame. The frame proxy gives it Tailscale's certificate. Without it: open the app in a new tab and accept the certificate, and after that it opens in windows too.

## Every app in a window: the frame proxy

[`frame-proxy.sh`](frame-proxy.sh) is a script you run once on the CasaOS server (it's not part of the mod). With CasaOS opened at its Tailscale HTTPS address, it makes **every app open in a window**, with a valid certificate and no warnings. It only works inside your tailnet, and nothing is exposed to the internet.

### How it works

```
browser ── https://<machine>.<tailnet>.ts.net:8096 ──▶ tailscale serve        (Tailscale's certificate)
        ──▶ Caddy on 127.0.0.1:38096 (container "frame-proxy")             (removes the frame blocks)
        ──▶ the app on 127.0.0.1:8096                                      (http, or its own https)
```

- **Tailscale** answers HTTPS on each app's port with Tailscale's certificate (`tailscale serve`), only to devices in your tailnet.
- **Caddy**, a small web server in a Docker container (`frame-proxy`, host network), listens only on the server itself, on `127.0.0.1:<port + 30000>`, and passes each request to the app:
  - without `X-Frame-Options` and without the CSP `frame-ancestors` directive, the two headers that forbid frames. The rest of the app's security policy stays.
  - with `X-Forwarded-Proto: https` (the app knows it's served over HTTPS), and without `X-Forwarded-For` (Home Assistant answers "400: Bad Request" to a proxy it wasn't told to trust).
  - over HTTPS to apps that serve HTTPS themselves (found by trying TLS on their port), without checking their certificate.
  - When an app doesn't answer, the window shows "Frame proxy: the app on port … did not answer (…)" instead of a blank page.
- Each app's address also serves App Windows' **window page** (`/__casaos-windows/`, files the script writes to `/DATA/AppData/frame-proxy/www`). A window loads it, and it holds the app. Being on the app's own address, it can reach the app's page, which the CasaOS tab can't:
  - **F5** (Ctrl+R) pressed inside the app reloads the app, not the whole CasaOS tab;
  - **what the app plays** (title, artist, album, cover, playing or paused, position: what the browser's media controls show) reaches the CasaOS tab, for Live Wallpapers' media integration;
  - **its sound**, analysed there, so wallpapers that react to sound react to the app's music too (only while a wallpaper listens and the app plays);
  - "open in a new tab" and a reload of CasaOS keep the app's current page.
- The app's port is the same in both addresses: `http://<server>:8096` on your network (unchanged) and `https://<machine>.<tailnet>.ts.net:8096` in the tailnet.

### Before you start

1. **Tailscale** installed on the CasaOS server and logged in to your tailnet (`tailscale status` lists your devices).
2. In the [Tailscale admin console](https://login.tailscale.com/admin/dns) → **DNS**: **MagicDNS** on, and **HTTPS Certificates** enabled.
3. **CasaOS itself over HTTPS**, on the server (use CasaOS's port if it isn't 80):
   ```bash
   sudo tailscale serve --bg 80
   ```
   It prints CasaOS's address, `https://<machine>.<tailnet>.ts.net/`. Open CasaOS there from now on. Already done if you use Music Player + Spotify.
4. **Docker** and **curl** on the server (CasaOS has both).

### Step by step

1. **Download the script** on the CasaOS server:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/UsuarioDeJava/CasaMODs/main/casaos-app-windows/frame-proxy.sh -o frame-proxy.sh
   ```
2. **List the ports Docker doesn't show.** The script finds every port Docker publishes. It can't see two kinds of apps, so you list their ports in `EXTRA`:
   - apps **outside Docker** (noVNC on 6080, for example);
   - apps on the **host network** (Home Assistant from CasaOS's store, on 8123). This lists them:
     ```bash
     sudo docker ps --filter network=host --format '{{.Names}}'
     ```
     Their port is the one in the app's address when CasaOS opens it.
3. **Run it** (with your ports in `EXTRA`, or just `sudo bash frame-proxy.sh` if there are none):
   ```bash
   sudo EXTRA="6080 8123" bash frame-proxy.sh
   ```
   It prints one line per app port, with `(its own https)` for the apps that have their own certificate:
   ```
   https port 8096 -> app 8096
   https port 8123 -> app 8123
   https port 8444 -> app 8444 (its own https)
   ```
4. **Reload CasaOS** at its `https://` address (Ctrl+F5) and open an app: it opens in a window.
5. **Run the same command again** after installing an app or changing an app's port. Each run rebuilds everything, so it's always safe to run it again.

### Options

Set them before the command, as in step 3.

| Option | What it does |
| --- | --- |
| `EXTRA="6080 8123"` | Ports of apps the script can't find in Docker: outside Docker or on the host network. |
| `HTTPS_APPS="8444"` | Ports to treat as HTTPS even if the app wasn't running when the script ran (the script tries TLS on each port; a stopped app can't answer). |

### Check that it's working

On the server:

```bash
tailscale serve status                     # each app port -> http://127.0.0.1:<port + 30000>
sudo docker ps --filter name=frame-proxy   # the Caddy container, "Up"
curl -sI http://127.0.0.1:38096/           # an app through Caddy (port + 30000): its answer, without X-Frame-Options
sudo docker logs frame-proxy               # Caddy's messages
```

Caddy's configuration is in `/DATA/AppData/frame-proxy/Caddyfile`, written again at each run.

### When something goes wrong

| What you see | Why | What to do |
| --- | --- | --- |
| **"Frame proxy: the app on port … did not answer (502 …)"** | The app is stopped, or its port changed. | Start the app. If its port changed, run the script again. |
| **"Refused to connect"** at `https://…ts.net:<port>` | Nothing answers HTTPS on that port: an app outside Docker or on the host network, or one installed after the script ran. | Add its port to `EXTRA` and run the script again. |
| **A blank window**, and the console says `X-Frame-Options` or `frame-ancestors` | That app isn't going through the proxy (CasaOS opened at `http://`, or its port isn't served). | Open CasaOS at its `https://` address; run the script again with the port in `EXTRA` if needed. |
| **"400: Bad Request"** (Home Assistant) | An older version of the script, or the port is served straight to the app by an older `tailscale serve` line. | Download the script again and run it with the port in `EXTRA`. |
| **A certificate error** for an app with its own HTTPS | The app wasn't running when the script ran, so it was taken for plain HTTP. | Start the app and run the script again, or use `HTTPS_APPS="<port>"`. |
| **"Port … is in use: app port … skipped."** | Something else already uses that app's port + 30000. | That app stays out of the proxy. Free that port and run the script again. |

### Undo

```bash
sudo EXTRA="6080 8123" bash frame-proxy.sh off
```

Use the same `EXTRA` as when you ran it: `off` removes the Caddy container and the `tailscale serve` line of each port it finds. CasaOS's own `https://` (port 443) stays. `sudo tailscale serve reset` clears every `tailscale serve` line, CasaOS's too (then run `sudo tailscale serve --bg 80` again).

### What it changes, security-wise

- Only devices in your tailnet reach these addresses (`tailscale serve`, not Funnel). Caddy listens only on the server itself (`127.0.0.1`).
- On these addresses, the apps lose their protection against being shown inside other sites' pages (clickjacking). Only pages in your tailnet could try that.
- The `http://` addresses on your network don't change at all.
- The apps see every request as coming from the server itself (`127.0.0.1`, or Docker's gateway), not from your device. Logs and IP-based rules in the apps (Home Assistant's login notices and bans, for example) show that address.

## Notes

- **Sound and wallpapers:** browsers don't let a page listen to another site's audio, and each app is another site (another port), so Live Wallpapers can't analyse an app's sound by itself. Through the frame proxy, the window page does it on the app's own address: it copies the playing element's audio (`captureStream`, the app's sound untouched) into an analyser set like Live Wallpapers' own and sends 64 bands about 30 times a second, only while a wallpaper listens (Live Wallpapers says so) and the app plays. The mod passes them on as `casamods:audio` events, and wallpapers react to Jellyfin's music as to the tab's own. **What** plays reaches them too, as a `casamods:nowplaying` event (as Music Player + Spotify does), so a wallpaper with media integration shows the title, artist, cover and position. Protected audio (DRM) can't be analysed anywhere. An app whose service worker covers its whole address may show its own page instead of the window page; it still works, without these two.
- **Idle Hide:** what you do inside a window doesn't reach the CasaOS page, so the mod tells other mods that a window is in use (`html.cw-active`). Idle Hide doesn't hide the dashboard meanwhile.
- **CasaOS's own panels:** Files and the App Store depend on CasaOS's page, and a CasaOS update may need an adjustment here (they were made for CasaOS 0.4.x).

## How it works

- CasaOS opens an app with `window.open(scheme://host:port/index)`, or with its launch page `#/launch?appDetailData=…` for an app it just started. The mod wraps `window.open`. An app's address becomes a window: another port of this server, or anything opened right after a click on an app icon. Any other address opens as before.
- A window is an `<iframe>` in a `<div>` added once to `<body>`. An iframe moved in the page reloads, so windows never move in the page: which one is on top is only its `z-index` (21–29: above the dashboard and CasaOS's top bar, 20; below its dialogs, 40). Clicking inside an app's page doesn't reach CasaOS. The tab then loses focus to the iframe, which is how its window comes to the front.
- The icon and title come from the app icon that was clicked. For an app opened from elsewhere, they come from CasaOS's app list (`/v2/app_management/web/appgrid`), by port.
- Files and the App Store are CasaOS's Buefy modals (`.modal.file-panel`, kept when closed, and `.modal.app-panel`, made at each opening). The mod gives them the bar and the place of a window, hides their backdrop, and closes them with their own close button. Minimizing only hides them, so they keep their state.
- Nothing is checked before a window opens: a page can't tell whether another site will show in a frame (Chrome hides the answer of a `no-cors` request for a web page: ORB). For an app CasaOS has just started, the window waits until the app's `/favicon.ico` loads (an image is the one answer a page can see from another site), 12 s at most.
- Settings: `localStorage['casamod-app-windows']` (`apps[name]`: `rect` as fractions of the tab, `max`, `tab`). The open apps, for a reload: `sessionStorage['casamod-app-windows-open']`.
- Files and the App Store get their place with `!important` inline styles: they are Bulma modals, whose stylesheet pins them to the whole screen.
- The window page (from `frame-proxy.sh`): the mod loads it when its picture (`/__casaos-windows/ok.svg`) loads from the app's `https://` address. It gets the app's path and CasaOS's address in its `#`, loads the app from its own address only, and posts only to CasaOS's address (`{cw: 1, type: 'place' | 'media', data}`); the mod checks that a message comes from that window's frame and address. Covers become `data:` images (512 px at most), so another page can read them.
- `window.CasaAppWindows`: `open(url, title, iconUrl)` and `windows` (the list), for other mods and debugging.

## Tests

```bash
node tests/text-check.js     # languages, a second
```

All 31 CasaOS languages, every text in each.
