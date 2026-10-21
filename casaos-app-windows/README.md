# App Windows for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod: the apps open in **windows inside the CasaOS tab** instead of new tabs, as on a desktop.

- A slim bar on top of each window: the app's icon and title, then **⋯** (more), **open in a new tab**, **minimize**, **maximize / restore** and **close**.
- **Drag** a window by its bar, **resize** it by its edges and corners. **Maximize** fills the whole tab, over the CasaOS top bar (with the browser in full screen, F11, the whole screen: only the window's bar and the app); double-click the bar to maximize or restore, drag a maximized window to set it loose again. A narrow window shows the app's phone layout, if it has one.
- **Minimize** hides the window and the app **keeps running**: music keeps playing in this tab while you use other apps. The app's icon on the dashboard brings it back (an open app has a dot under its icon, dimmed while minimized).
- **Open in a new tab** moves the app to a tab, CasaOS's usual way, and closes the window.
- **Files** and the **App Store** (CasaOS's own panels) can become windows too, **experimental** and off by default (setting `panels`): the same bar, dragged, resized, minimized without closing (Files keeps its folder).
- Windows go anywhere in the tab, over the CasaOS top bar too. Each app's size, place and maximized state are kept, in this browser. On a phone, windows always fill the screen.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Install **App Windows** from the CasaMOD Store, or copy the `app-windows` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).
4. **If you open CasaOS at an `https://` address**, the apps need `https://` too (the browser blocks `http://` pages inside an `https://` one):
   - at its **Tailscale** address (`https://<machine>.<tailnet>.ts.net`): set up the [frame proxy](#every-app-in-a-window-the-frame-proxy) once, one command on the server;
   - on **your own domain** with your own certificate (`https://casa.example.com`): no Tailscale and no frame proxy, a few settings in your proxy and in CasaOS: [CasaOS on your own domain](#casaos-on-your-own-domain-your-own-certificate).

   At CasaOS's `http://` address on your network, windows work without either, except for the few apps that refuse to be shown in a window (both fix those too).

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

**CasaOS on https://:** the browser blocks `http://` apps inside an `https://` page (mixed content). So with CasaOS opened over HTTPS, an app opens at its `https://` address on the same port, which needs the server to answer HTTPS there: the frame proxy does that for every app. Without it the window shows the browser's error: use **open in a new tab**. On your own domain, each app gets its own `https://` address instead: [CasaOS on your own domain](#casaos-on-your-own-domain-your-own-certificate). At CasaOS's `http://` address, windows work without either (except for apps that refuse frames).

**An app with its own certificate** (self-signed: Portainer, MineOS) can't show inside a window by itself, because a certificate warning can't be accepted inside a frame. The frame proxy gives it Tailscale's certificate. Without it: open the app in a new tab and accept the certificate, and after that it opens in windows too.

## Every app in a window: the frame proxy

This is for CasaOS opened at its **Tailscale** address. On your own domain, with your own certificate, see [CasaOS on your own domain](#casaos-on-your-own-domain-your-own-certificate) instead.

[`frame-proxy.sh`](app-windows/frame-proxy.sh) comes in the mod's folder, and you run it once on the CasaOS server. With CasaOS opened at its Tailscale HTTPS address, it makes **every app open in a window**, with a valid certificate and no warnings. After that, new apps join by themselves, and its page adds or removes ports. It only works inside your tailnet, and nothing is exposed to the internet.

### How it works

```
browser ── https://<machine>.<tailnet>.ts.net:8096 ──▶ tailscale serve        (Tailscale's certificate)
        ──▶ Caddy on 127.0.0.1:38096 (container "frame-proxy")             (removes the frame blocks)
        ──▶ the app on 127.0.0.1:8096                                      (http, or its own https)
```

- **Tailscale** answers HTTPS on each app's port with Tailscale's certificate (`tailscale serve`), only to devices in your tailnet.
- **Caddy**, a small web server in a Docker container (`frame-proxy`, host network), runs as the CasaOS app **Frame Proxy** (see [below](#the-frame-proxy-app)). It listens only on the server itself, on `127.0.0.1:<port + 30000>`, and passes each request to the app:
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
   It prints CasaOS's address, `https://<machine>.<tailnet>.ts.net/`. Open CasaOS there from now on. Already done if you use the Music Player's Spotify mode.
4. **Docker**, **curl** and **systemd** on the server (CasaOS has them).

### Set it up (once)

1. **Install the mod** ([Install](#install)): the script comes in its folder, at `/DATA/AppData/casamod/mod/app-windows/frame-proxy.sh`.
2. **List the ports Docker doesn't show** (optional: you can also add them later on its page). The script finds every port Docker publishes. It can't see two kinds of apps, so you list their ports in `EXTRA`:
   - apps **outside Docker** (noVNC on 6080, for example);
   - apps on the **host network** (Home Assistant from CasaOS's store, on 8123). This lists them:
     ```bash
     sudo docker ps --filter network=host --format '{{.Names}}'
     ```
     Their port is the one in the app's address when CasaOS opens it.
3. **Run it** on the server (with your ports in `EXTRA`, or without `EXTRA="…"` if there are none):
   ```bash
   sudo EXTRA="6080 8123" bash /DATA/AppData/casamod/mod/app-windows/frame-proxy.sh
   ```
   It prints one line per app port, with `(its own https)` for the apps that have their own certificate, and the port of its own page:
   ```
   https port 8096 -> app 8096
   https port 8123 -> app 8123
   https port 8390 -> the Frame Proxy page
   https port 8444 -> app 8444 (its own https)
   ```
4. **Reload CasaOS** at its `https://` address (Ctrl+F5) and open an app: it opens in a window. The dashboard now has the **Frame Proxy** app.

### From then on

- **New apps join by themselves.** When you install or remove an app, a timer on the server notices its port within a minute and runs the script again. Nothing to do.
- **Other changes go on the [Frame Proxy page](#the-frame-proxy-app)** (its card on the dashboard): add a port Docker doesn't show, remove one, scan again.
- **After updating App Windows** (from the Store or by copying the folder), run the command once more. The ports you chose are kept, so no `EXTRA` is needed:
  ```bash
  sudo bash /DATA/AppData/casamod/mod/app-windows/frame-proxy.sh
  ```
  The update brings a newer script, but the server never runs a new script by itself: you decide when.
- Running it again is always safe: each run rebuilds everything.

### Options

Set them before the command, as in step 3. They're kept in `/DATA/AppData/frame-proxy/config` for the next runs (the timer's, the page's), and the page changes `EXTRA`, `HTTPS_APPS` and `SKIP`.

| Option | What it does |
| --- | --- |
| `EXTRA="6080 8123"` | Ports of apps the script can't find in Docker: outside Docker or on the host network. |
| `HTTPS_APPS="8444"` | Ports to treat as HTTPS even if the app wasn't running when the script ran (the script tries TLS on each port; a stopped app can't answer). |
| `SKIP="9000"` | Ports Docker publishes that stay out of the proxy (on the page: **Remove** on a Docker app). |
| `PAGE_PORT="8390"` | The port of the Frame Proxy page (8390 unless set; `PAGE_PORT=""` for no page). |

### Check that it's working

On the server:

```bash
tailscale serve status                     # each app port -> http://127.0.0.1:<port + 30000>
sudo docker ps --filter name=frame-proxy   # the Caddy container, "Up"
curl -sI http://127.0.0.1:38096/           # an app through Caddy (port + 30000): its answer, without X-Frame-Options
sudo docker logs frame-proxy               # Caddy's messages
systemctl status frame-proxy-api.socket frame-proxy-scan.timer   # the page's requests, the timer
```

Caddy's configuration is in `/DATA/AppData/frame-proxy/Caddyfile`, written again at each run.

### The Frame Proxy app

Caddy shows on the CasaOS dashboard as the app **Frame Proxy**, with its own icon. The script writes it as a Docker Compose app (`/DATA/AppData/frame-proxy/docker-compose.yml`, with CasaOS's `x-casaos` details) and starts it with `docker compose`; CasaOS lists every Compose app on the server, so nothing needs importing.

Its card opens its page (port 8390, or `PAGE_PORT`):

- the ports it serves, each one a link: **Docker app**, or **added** by you; **its own https** for apps with their own certificate;
- **Remove** takes a port out (a Docker app's port is then kept out, **left out**, until **Add back**); the box below adds a port (tick **the app serves https itself** for one with its own certificate); **Scan again** looks for apps right away;
- each change runs the script again on the server (Caddy restarts, a few seconds), and the page says **Done.** when it's over.

Changes work only with the page opened from CasaOS at its `https://` address (through Tailscale). At `http://` on your network, the page only shows the ports. Behind it: the page's requests go to a systemd socket on the server (`frame-proxy-api.socket`), which Caddy reaches only for requests coming through `tailscale serve`; it saves the ports and runs the script again. `frame-proxy-scan.timer` checks Docker's ports every minute and runs the script when they change.

- **Manage it with its page and the script, not in CasaOS:** `off` removes it. Stopping or uninstalling it in CasaOS leaves each app's `https://` address pointing at a Caddy that isn't there (those addresses stop answering until the script runs again or `off` clears them), and changing its settings in CasaOS is undone by the next run.
- An older version of the script made it a plain container, which CasaOS shows under **Legacy app (To be rebuilt)**. Running the new script replaces it with the app (don't use **Import to CasaOS** on the old one).
- Without Docker Compose on the server (`docker compose version` fails), the script falls back to a plain container, which CasaOS shows under Legacy app.

### When something goes wrong

| What you see | Why | What to do |
| --- | --- | --- |
| **"Frame proxy: the app on port … did not answer (502 …)"** | The app is stopped, or its port changed. | Start the app. If its port changed, run the script again. |
| **"Refused to connect"** at `https://…ts.net:<port>` | Nothing answers HTTPS on that port: an app outside Docker or on the host network. | Add its port on the Frame Proxy page (or in `EXTRA`). |
| **A blank window**, and the console says `X-Frame-Options` or `frame-ancestors` | That app isn't going through the proxy (CasaOS opened at `http://`, or its port isn't served). | Open CasaOS at its `https://` address; run the script again with the port in `EXTRA` if needed. |
| **"400: Bad Request"** (Home Assistant) | An older version of the script, or the port is served straight to the app by an older `tailscale serve` line. | Copy the mod again (it brings the newer script) and run the script. |
| **A certificate error** for an app with its own HTTPS | The app wasn't running when the script ran, so it was taken for plain HTTP. | Start the app and press **Scan again** on the page, or remove the port and add it back with **the app serves https itself**. |
| **"Port … is in use: app port … skipped."** | Something else already uses that app's port + 30000. | That app stays out of the proxy. Free that port and run the script again. |

### Undo

```bash
sudo bash /DATA/AppData/casamod/mod/app-windows/frame-proxy.sh off
```

`off` removes the Frame Proxy app (Caddy's container), its systemd socket and timer, and the `tailscale serve` line of each port it served. CasaOS's own `https://` (port 443) stays. `sudo tailscale serve reset` clears every `tailscale serve` line, CasaOS's too (then run `sudo tailscale serve --bg 80` again).

### What it changes, security-wise

- Only devices in your tailnet reach these addresses (`tailscale serve`, not Funnel). Caddy listens only on the server itself (`127.0.0.1`), except the Frame Proxy page (port 8390), which your network can open but only to read.
- Changing ports on the page needs the tailnet too: the server takes the page's requests only through `tailscale serve`, marked so that another site can't send them, and they carry only port numbers. They run the script as root on the server (through `frame-proxy-api.socket`), the same script you ran.
- The server never runs a newer script by itself: after an update of App Windows, you run it again.
- On these addresses, the apps lose their protection against being shown inside other sites' pages (clickjacking). Only pages in your tailnet could try that.
- The `http://` addresses on your network don't change at all.
- The apps see every request as coming from the server itself (`127.0.0.1`, or Docker's gateway), not from your device. Logs and IP-based rules in the apps (Home Assistant's login notices and bans, for example) show that address.

## CasaOS on your own domain (your own certificate)

This part is for you if you open CasaOS at an address like `https://casa.example.com`: **your own domain, with a valid certificate**, through your own reverse proxy (Nginx Proxy Manager, Caddy, Traefik, plain Nginx, a Cloudflare Tunnel…).

**You don't need Tailscale, and you don't need the frame proxy script.** App Windows works on your domain: your proxy does, for each app, what the frame proxy does on Tailscale. That's three steps, plus a fourth one if you want the extras.

### Which case are you?

| How you open CasaOS | What you need for every app in a window |
| --- | --- |
| `http://192.168.1.10` (its address on your network) | Nothing. A few apps refuse windows: see [When an app doesn't show](#when-an-app-doesnt-show). |
| `https://<machine>.<tailnet>.ts.net` (Tailscale) | The [frame proxy](#every-app-in-a-window-the-frame-proxy): one command, once. |
| `https://casa.example.com` (your own domain and certificate) | The steps below. No Tailscale, no frame proxy. |

### Why, in plain words

A window is a page shown inside the CasaOS page. The browser has three rules about that:

1. **A secure page only shows secure pages inside it.** CasaOS is at `https://`, so each app has to be at `https://` too. An app at `http://192.168.1.10:8096` can't show inside it. App Windows then tries the app at `https://` on CasaOS's own address and the app's port (`https://casa.example.com:8096`): on Tailscale, that's where the frame proxy answers. On your domain, nothing answers there, so each app needs its own `https://` address in your proxy (step 1), and CasaOS has to open the app there (step 2).
2. **An app can say "never show me inside another page".** Some apps do (Home Assistant, Portainer, qBittorrent, Grafana…), with a header called `X-Frame-Options`, or `frame-ancestors` in its `Content-Security-Policy`. Their window stays blank, or says "refused to connect". Your proxy can remove that header (step 3).
3. **Logins inside a window work best with the app on the same domain as CasaOS.** `jellyfin.example.com` next to `casa.example.com`: fine. A different domain (`my-jellyfin.net`): the browser may treat the app's login as a "third-party cookie" and block it (Safari and Firefox do so by default), and the app keeps asking you to log in inside the window. So use subdomains of CasaOS's domain.

### Step 1: give each app its own https:// address

In your proxy, add one address per app: a **subdomain of CasaOS's domain**, sent to the app's port on the server. For example, with the server at `192.168.1.10`:

| App | Its address in your proxy | Sent to |
| --- | --- | --- |
| Jellyfin | `https://jellyfin.example.com` | `http://192.168.1.10:8096` |
| Home Assistant | `https://homeassistant.example.com` | `http://192.168.1.10:8123` |

It's the same thing you do to reach an app from outside your home, so some may be ready already. Each address needs its name in your DNS (or a wildcard `*.example.com`) and a certificate (your proxy gets it, as it did for CasaOS). Apps that use websockets (Home Assistant, Jellyfin and many more) need websockets on in the proxy (in Nginx Proxy Manager: **Websockets Support**).

**Check:** open `https://jellyfin.example.com` in a normal tab, on the device you use CasaOS from. If the app shows, with the padlock, step 1 is done for it. If it doesn't open in a tab, it won't open in a window either.

### Step 2: tell CasaOS that address

CasaOS opens each app at the address in the app's **Web UI** setting, which is `http://<CasaOS's address>:<the app's port>` at first. Change it to the address of step 1:

1. On the CasaOS dashboard, open the app's menu (the **⋯** on its icon) → **Settings**.
2. At the top, the **Web UI** line has boxes for the address. Set them like this:
   - the first one, `http`: change it to **`https`**;
   - the address: the app's address **without** `https://`, for example **`jellyfin.example.com`**;
   - the port: **`443`** (the https port);
   - the path after it (often `/`): leave it as it is.
3. **Save.** CasaOS saves it and restarts the app (a few seconds).
4. Click the app's icon: it opens in a window, at `https://jellyfin.example.com`.

Do it for each app. App Windows leaves an `https://` address as it is: it only changes `http://` ones (rule 1).

### Step 3: if a window stays blank, let the app be shown in a window

Open the browser's console (F12) on the CasaOS tab and open the app again. If the console says `Refused to display … in a frame because it set 'X-Frame-Options'`, or mentions `frame-ancestors`, the app forbids windows (rule 2). Remove those headers in your proxy, only for that app's address. In your proxy:

**Nginx Proxy Manager:** edit the app's Proxy Host → the **Advanced** tab → in **Custom Nginx Configuration**, paste:

```nginx
proxy_hide_header X-Frame-Options;
```

and, only if the console mentioned `frame-ancestors`, this line too:

```nginx
proxy_hide_header Content-Security-Policy;
```

Then **Save**.

**Nginx:** the same lines, inside the app's `server { … }`.

**Caddy** (Caddyfile): in the app's `reverse_proxy`, the two `header_down` lines below. The second one removes only the `frame-ancestors` part of the app's security policy and keeps the rest:

```caddyfile
jellyfin.example.com {
	reverse_proxy 192.168.1.10:8096 {
		header_down -X-Frame-Options
		header_down Content-Security-Policy "frame-ancestors[^;]*;?" ""
	}
}
```

**Traefik:** a middleware that empties the headers (an empty value removes a header), added to the app's router. Keep the `Content-Security-Policy` line only if the console mentioned `frame-ancestors`:

```yaml
http:
  middlewares:
    in-a-window:
      headers:
        customResponseHeaders:
          X-Frame-Options: ""
          Content-Security-Policy: ""
```

**Cloudflare** (its proxy, or a Cloudflare Tunnel): in Cloudflare's dashboard, **Rules → Transform Rules → Modify Response Header**, a rule for the app's hostname that **removes** `X-Frame-Options` (and `Content-Security-Policy`, only if the console mentioned `frame-ancestors`).

What this changes: other websites could also show that app inside their pages (the protection the header gave, against "clickjacking"); the app still asks for its own login. Removing the whole `Content-Security-Policy` (everything above except Caddy) also removes the app's other protections from it, which is why it's only for the apps that need it. You can also allow windows in the app itself, where it has a setting: see the table in [When an app doesn't show](#when-an-app-doesnt-show).

### Step 4 (optional): the extras

Windows work after steps 1 to 3. Three extras also need App Windows' **window page** on each app's own address (on Tailscale, the frame proxy serves it):

- **F5 pressed inside the app** reloads the app. Without it, after a click inside the app, F5 reloads the whole CasaOS tab (click the window's bar first, then F5);
- **what the app plays** (title, artist, cover) reaches [Live Wallpapers](../casaos-live-wallpapers);
- **its sound** reaches the wallpapers that react to sound.

To have them:

1. **Write the window page** into a folder your proxy can read. It's three small files (`frame.html`, `frame.js`, `ok.svg`), written by the frame proxy script's `window-page` command, which needs nothing else (no Tailscale, no Docker):
   ```bash
   sudo bash /DATA/AppData/casamod/mod/app-windows/frame-proxy.sh window-page /DATA/AppData/casaos-windows
   ```
   If your proxy runs in Docker, choose a folder its container sees. Nginx Proxy Manager, for example, sees its own data folder (in CasaOS, the app's Settings shows which server folder is its `/data`): write it there, as `…/data/casaos-windows`, and that is `/data/casaos-windows` for it.
2. **Serve that folder at `/__casaos-windows/`** on each app's address:
   - **Nginx Proxy Manager / Nginx**, next to the lines of step 3 (with the folder as the proxy sees it, and the `/` at the end):
     ```nginx
     location /__casaos-windows/ {
         alias /data/casaos-windows/;
     }
     ```
   - **Caddy:**
     ```caddyfile
     jellyfin.example.com {
     	handle_path /__casaos-windows/* {
     		root * /DATA/AppData/casaos-windows
     		file_server
     	}
     	handle {
     		reverse_proxy 192.168.1.10:8096 {
     			header_down -X-Frame-Options
     			header_down Content-Security-Policy "frame-ancestors[^;]*;?" ""
     		}
     	}
     }
     ```
   - **Traefik or a Cloudflare Tunnel** don't serve files by themselves: they need a small web server for that folder (a Caddy or Nginx), sent `/__casaos-windows/` of each app's address. If that's too much, skip the extras: the windows don't need them.
3. **Check:** `https://jellyfin.example.com/__casaos-windows/ok.svg` opens as a blank page, without an error. Then reload CasaOS (Ctrl+F5): the app's windows use it from now on.
4. **After updating App Windows**, run the command of item 1 again (the update can bring a newer window page).

### What works, at a glance

| | Tailscale with the frame proxy | Own domain, steps 1–3 | Own domain, steps 1–4 |
| --- | --- | --- | --- |
| Every app in a window | yes | yes | yes |
| Apps that refuse windows | fixed by the proxy | fixed by step 3 | fixed by step 3 |
| F5 inside the app reloads the app | yes | no (click the window's bar first) | yes |
| What the app plays and its sound reach Live Wallpapers | yes | no | yes |
| New apps | join by themselves | step 1 and 2 for each new app | steps 1, 2 and the `/__casaos-windows/` of step 4 for each new app |

### When something goes wrong (own domain)

| What you see | Why | What to do |
| --- | --- | --- |
| The window shows an error page (can't be reached, `ERR_SSL_PROTOCOL_ERROR`, a certificate error) at `https://casa.example.com:<port>` | The app's Web UI is still `http`, so App Windows tried CasaOS's domain with the app's port. | Step 2. |
| The window shows an error page at the app's own address (`https://jellyfin.example.com`) | The address doesn't open from your device. | Step 1: open it in a normal tab and fix it there first. |
| Blank window, or "refused to connect"; the console says `X-Frame-Options` or `frame-ancestors` | The app forbids windows. | Step 3. |
| The app keeps asking for its login inside the window, but works in a tab | It's on a different domain from CasaOS (rule 3). | Give it a subdomain of CasaOS's domain, or use **⋯ → Always open in a new tab** for it. |
| F5 inside the app reloads the whole CasaOS | No window page on that app's address. | Step 4, or click the window's bar before F5. |
| A new app opens at `https://casa.example.com:<port>` and fails | Each new app needs its own address. | Steps 1 and 2 for it. |

## Settings: `config.json`

The mod's folder has a `config.json` with its settings, in the format every mod of this repository uses ([CONFIG.md](../CONFIG.md)): each setting describes itself (type, choices or limits, default, name in all 31 CasaOS languages), so the CasaMOD Store shows and changes them. By hand, change only a setting's `"value"`. A value outside its rules counts as the default.

| Setting (`key`) | Type | Values | Default | What it does |
| --- | --- | --- | --- | --- |
| `panels` | `boolean` | `true` or `false` | `false` | **Experimental.** Files and the App Store open as windows too. `false`: they stay CasaOS's own panels. |
| `coverTopBar` | `boolean` | `true` or `false` | `true` | Windows may use the whole tab, over CasaOS's top bar (a maximized window covers it). `false`: only the space below the top bar, which stays in sight. |

They apply when CasaOS is reloaded (`"applies": "reload"`: Ctrl+F5).

Copying a newer folder over the old one brings the new `config.json` with the default values: the CasaMOD Store keeps your values (CONFIG.md says how); by hand, note yours and set them again.

## Notes

- **Sound and wallpapers:** browsers don't let a page listen to another site's audio, and each app is another site (another port), so Live Wallpapers can't analyse an app's sound by itself. Through the frame proxy, the window page does it on the app's own address: it copies the playing element's audio (`captureStream`, the app's sound untouched) into an analyser set like Live Wallpapers' own and sends 64 bands about 30 times a second, only while a wallpaper listens (Live Wallpapers says so) and the app plays. The mod passes them on as `casamods:audio` events, and wallpapers react to Jellyfin's music as to the tab's own. **What** plays reaches them too, as a `casamods:nowplaying` event (as the Music Player's Spotify mode does), so a wallpaper with media integration shows the title, artist, cover and position. Protected audio (DRM) can't be analysed anywhere. An app whose service worker covers its whole address may show its own page instead of the window page; it still works, without these two.
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
- The window page (from `frame-proxy.sh`): the mod loads it when its picture (`/__casaos-windows/ok.svg`) loads from the app's `https://` address. It gets the app's path and CasaOS's address in its `#`, loads the app from its own address only, and posts only to CasaOS's address (`{cw: 1, type: 'place' | 'media' | 'sound', data}`: where the app is, what it plays, its 64 bands); the mod checks that a message comes from that window's frame and address, and sends it `{cw: 1, type: 'reload'}` (F5 on the window's bar) and `{cw: 1, type: 'sound', on}` (whether a wallpaper listens). Covers become `data:` images (512 px at most), so another page can read them.
- `window.CasaAppWindows`: `open(url, title, iconUrl)` and `windows` (the list), for other mods and debugging.

## Tests

```bash
node tests/text-check.js     # languages, a second
```

All 31 CasaOS languages, every text in each.
