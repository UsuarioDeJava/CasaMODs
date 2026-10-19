# Music Player + Spotify for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod: the [Music Player](../casaos-music-player) widget with a switch at its top between **Local** (a folder of your CasaOS storage, played in the CasaOS tab), **Spotify** (your Spotify account: what plays in the Spotify app on any of your devices, with its controls, your playlists, the queue, search and devices; with **Play in this browser**, the CasaOS tab is one of those devices and plays the music itself) and **Jellyfin** (the music library of your Jellyfin server, played in the CasaOS tab).

It replaces the Music Player mod: install one or the other. If both are installed, the Music Player stands down and only this widget shows.

## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Copy the `music-player-spotify` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine. If `music-player-widget` (the Music Player) is there, remove it.
3. Restart CasaMOD and reload the CasaOS page.

The local player's settings (folder, queue, volume, shuffle, repeat, last track) are taken over from the Music Player the first time. Local mode works like the Music Player (see [its README](../casaos-music-player/README.md)), plus the **Up next** button described below.

## Spotify

The Spotify mode controls the Spotify app playing on any of your devices (PC, phone, TV, speaker). With **Play in this browser** on (step 4), the CasaOS tab becomes one of them: the music plays right there.

### What you need

- **Spotify Premium** to control playback (play, pause, skip, seek, shuffle, repeat, volume, queue, devices). Spotify's API allows control only for Premium accounts. A free account still sees what plays and its playlists, with a small (i) explaining why there are no controls. Creating the Spotify app (step 2) also needs a Premium account.
- **For Play in this browser:** Premium too, and a browser that plays protected content (DRM): Chrome, Edge, Firefox or Safari on a PC or Mac. Chromium builds without Widevine (some Linux ones) can't.
- **CasaOS over HTTPS**, for the Spotify login (once) and for Play in this browser. Spotify only sends you back to an `https://` address after you log in (`http://` works only as `http://127.0.0.1`, on the server itself). If you use Tailscale, step 1 does it in two minutes. The login is then kept on your CasaOS server, so the widget is connected at any CasaOS address, `http://…` too.

### 1. CasaOS over HTTPS with Tailscale

1. In the Tailscale admin console → **DNS**, turn on **MagicDNS** and **HTTPS Certificates**.
2. On the CasaOS server:
   ```bash
   sudo tailscale serve --bg 80
   ```
   (use CasaOS's port if it is not 80). It prints your address, like `https://my-server.tail1234.ts.net/`. It keeps running after a reboot; `sudo tailscale serve --https=443 off` turns it off.
3. Open CasaOS at that address to connect the widget (step 3). Your browser treats it as a different site from `http://…`: log in to CasaOS again there.

Only devices in your tailnet can open it; nothing is exposed to the internet (no Funnel needed: Spotify never connects to your server). Any other HTTPS reverse proxy (Caddy, Nginx Proxy Manager…) works too.

### 2. Create your Spotify app

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), log in and click **Create app** (accept the developer terms if asked).
2. **App name** and **App description**: anything (e.g. "CasaOS Music").
3. **Redirect URI**: your CasaOS HTTPS address with the trailing slash, exactly, e.g. `https://my-server.tail1234.ts.net/`. The widget's Spotify settings show the address to copy.
4. **Which API/SDKs are you planning to use?** Tick **Web API**, and **Web Playback SDK** for Play in this browser (step 4). Accept the terms and **Save**. Already created the app? Open it → **Settings** → **Edit**, tick **Web Playback SDK** and **Save**.
5. In the app → **Settings** → **User Management**, add the Spotify account(s) that will use it (name and the account's e-mail), up to 5. Spotify only lets the accounts listed there log in.
6. Copy the **Client ID**. The Client Secret is not used: never paste it anywhere.

### 3. Connect the widget

1. On the dashboard, switch the widget to **Spotify** (the round icon at its top) and open its settings (the gear).
2. Paste the Client ID and click **Connect**. Spotify asks you to allow access, then sends you back to CasaOS, connected.
3. Play something in Spotify on any device. The widget follows it; the "Playing on…" line moves the music to another device.

**One login for every browser:** the login is saved on your CasaOS server, so any browser where you're logged in to CasaOS (another PC, the phone, the `http://` address) is connected too, with no Spotify login of its own. See "How it works" for where it is kept.

**Disconnect** in the settings forgets the login everywhere (on the server too). You can also remove the app's access at [spotify.com/account](https://www.spotify.com/account/) → **Manage apps**. Spotify asks for a new login every 6 months (since July 2026): once, for all the browsers.

### 4. Play in this browser (optional)

The CasaOS tab becomes a Spotify device, named after the browser ("CasaOS (Chrome)"): it shows up in every Spotify app (phone, PC) and in the widget's devices, and the music plays in the tab.

1. Tick **Web Playback SDK** in your Spotify app (step 2.4).
2. In the widget's Spotify settings, turn on **Play in this browser**. If the widget connected before version 1.2.0, it asks you to connect again once (the player needs three more permissions: `streaming`, `user-read-email`, `user-read-private`): click **Connect** and accept.
3. "Ready: CasaOS (Chrome) is in your Spotify devices" means it worked. Choose **This browser** at the top of the devices (the "Playing on…" line), or pick it in any Spotify app. With nothing playing anywhere, play in the widget starts it here.

- It is per browser: turn it on in each browser that should play. With several CasaOS tabs open, one of them is the device (the others take over when it closes).
- The device exists only while CasaOS is open in Spotify mode: switching the widget to Local (or disconnecting) stops it, and the music playing here with it.
- Animated wallpapers still get what plays (title, cover, synced lyrics), but wallpapers that react to the sound stay still: Spotify plays protected audio in a frame of its own, which no page can listen to.
- The first time after opening CasaOS, a browser may hold back the sound until you click somewhere on the page; the widget says so, and play starts it.

### Using it

- **Now playing:** the cover, title, artist and album, a ❤ to save it to (or remove it from) Liked Songs, the progress (drag it to seek), shuffle, previous, play/pause, next, repeat (all / one / off) and the volume (when the device lets it be set), and the device it plays on.
- **Library** (the list button): Liked Songs and your playlists, with the same search box as the local playlist; typing also searches Spotify's catalog (its 10 best tracks, under "On Spotify"). Clicking a playlist opens its tracks (more load as you scroll; a search goes through all of them). Clicking a track plays it there, in the playlist; the button beside it adds it to the Spotify queue (✓ once added: only Spotify itself can take it out of the queue, the API has no way to).
- **Up next** (the button beside the list button, in both modes): what plays now and what comes after it. In Spotify mode, Spotify's queue and then the rest of the playlist or album (up to 20); clicking one skips ahead to it. In local mode, the tracks you queued (✕ takes one out), then the next 20 in play order; clicking one plays it.
- **Devices** (the "Playing on…" line): **This browser** first (with Play in this browser), then the devices where Spotify is open; one click moves the music there. With nothing playing, a command opens this list (or, with this browser ready, play starts here).
- **Free account**: what plays, the library and the ❤; no controls, and an (i) beside the title that says why. The widget finds out by itself (Spotify no longer says it to apps like this one): a command that changes nothing is sent when a device is playing, and a free account's answer is `PREMIUM_REQUIRED`. It asks again after 6 hours and on another device, so an upgrade shows up by itself.
- Media keys that reach the CasaOS tab, and the browser's and the system's media controls (Chrome's media button, Windows' volume overlay), control Spotify in Spotify mode: what plays, the cover, where the song is, play/pause, previous/next, ±10 s and seeking.

### Troubleshooting

- **"INVALID_CLIENT: Invalid redirect URI"** (on Spotify's page): the Redirect URI registered in step 2.3 is not exactly the address you opened CasaOS with (the trailing slash, `http` instead of `https`, another hostname).
- **"This account isn't in your Spotify app"**: add the account in step 2.5.
- **No controls, an (i) instead**: the account is not Premium.
- **"No device is playing"**: open Spotify on a device and play something, or pick one in the devices list.
- **Not connected in another browser**: that browser must be logged in to CasaOS (the login is read from the server through it); reload the page. A widget from before 1.3.0 shares its login once it is updated in one browser that has it.
- **Play in this browser: "Spotify didn't take this browser as a device"**: tick **Web Playback SDK** in your Spotify app (step 2.4); the account must be Premium. Then switch it off and on.
- **Play in this browser: "protected content (DRM) is off"**: allow protected content in the browser's site settings (Chrome: the lock icon → Site settings → Protected content), or use another browser. Then switch it off and on.
- **Play in this browser: "Connect again"**: the login is from before 1.2.0 and lacks the player's permissions; click **Connect** in the settings.
- **A feature disappeared** (the library, search, the ❤): Spotify refused it to this app (it gives new apps fewer features). The browser console says which (`[Music Player + Spotify] Spotify refuses …`). Disconnecting and connecting again tries everything again.

## Jellyfin

The Jellyfin mode plays the music library of your [Jellyfin](https://jellyfin.org) server right in the CasaOS tab: your favorites, albums, artists and playlists, with search, the queue and Up next. No Jellyfin app or account setup is needed beyond a code you approve once.

### What you need

- **Jellyfin 10.8 or later** with **Quick Connect** on (it is by default; Jellyfin's **Dashboard → General → Quick Connect**).
- **Its address**, reachable from the browser. The widget suggests the CasaOS host at port 8096 (Jellyfin's usual one), with the page's scheme: `http://my-server:8096` when CasaOS is opened at `http://my-server`.
- **With CasaOS over HTTPS** (`https://…ts.net`, for Spotify), Jellyfin needs an `https://` address too: a browser doesn't let an https page talk to an http one. App Windows' [frame proxy](../casaos-app-windows/README.md#every-app-in-a-window-the-frame-proxy) gives every app one, at the same port (`https://my-server.tail1234.ts.net:8096`), so the suggested address just works. Without it, use the widget at the `http://` address.

### Connect

1. Switch the widget to **Jellyfin** (the triangle at its top). Its settings open (the gear).
2. Check the **Jellyfin address** (change it if Jellyfin uses another port or address; a pasted `…/web/#/home` is fine) and click **Connect**. A 6-digit code shows.
3. In Jellyfin (in a window, with [App Windows](../casaos-app-windows)): your profile picture → **Quick Connect**, type the code, **Authorize**. The widget connects within a few seconds. A code lasts 10 minutes; a new one shows while the settings stay open.

**One login for every browser:** as with Spotify, the login is kept on your CasaOS server, so every browser logged in to CasaOS is connected too. When Jellyfin is on the CasaOS host, only its port is kept, so the same login works at the `http://` and the `https://` address.

**Disconnect** in the settings logs out everywhere, and Jellyfin forgets the login. It also shows in Jellyfin's **Dashboard → Devices** as "CasaOS" (CasaOS Music Player); deleting it there logs the widget out too.

### Using it

- **Library** (the list button): **Favorites**, **Albums**, **Artists** and your playlists. An artist opens their albums, an album or a playlist its tracks. Clicking a track plays that list from it; the button beside it adds it to the queue (its number is its place in the queue; click again to take it out).
- **Search**: on the first level, typing searches Jellyfin (artists, albums, playlists and tracks, under "On Jellyfin"); in Albums or Artists it searches those; in a list of tracks it filters them.
- **Now playing**: the cover, title, artist and album, a ❤ that adds the track to (or removes it from) your Jellyfin favorites, the progress, the controls and the volume. Shuffle, repeat and the volume are the local player's.
- **Up next**: what plays now, the queue (✕ takes a track out), then the next 20 of the list.
- After a reload, the widget is back on the same track, paused where it was.
- Jellyfin sees what plays (its dashboard, play counts, and plugins like Last.fm scrobbling), and the media keys and the browser's media controls work.
- **Animated wallpapers** react to it and show what plays: the music plays in the CasaOS page itself, and Jellyfin lets the page analyse it.
- Formats the browser plays (MP3, FLAC, Ogg, Opus, WAV, and AAC/M4A in most browsers) come as they are; anything else (WMA, APE…) is converted to MP3 by Jellyfin as it plays (seeking inside those may not work).

### Troubleshooting

- **"Jellyfin didn't answer at this address"**: the address or port is wrong (open it in a tab to check), or CasaOS is open over `https://` and Jellyfin's address is `http://` (run the frame proxy, or use the widget at CasaOS's `http://` address).
- **"Quick Connect is off on this Jellyfin"**: turn it on in Jellyfin's **Dashboard → General**.
- **"The Jellyfin login was revoked"**: it was disconnected in another browser or deleted in Jellyfin's Devices: connect again.
- **A track is skipped with "Could not play this file"**: Jellyfin couldn't stream or convert it (check Jellyfin's log); the next one plays.

## How it works

- **Login:** Authorization Code with PKCE, right from the CasaOS page (`crypto.subtle` for the challenge): no server and no secret, only your app's Client ID. The redirect is the page's own address (`location.origin + '/'`); back from Spotify, the mod exchanges the code and cleans the address. The access token is renewed a minute before it ends, with the refresh token Spotify replaces each time (shared between tabs through `localStorage`). Scopes: `user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative user-library-read user-library-modify streaming user-read-email user-read-private` (the last three for the Web Playback SDK).
- **Storage:** the local player's settings (and the Jellyfin mode's list, track and queue, as Jellyfin ids) in `localStorage['casamod-music-player-spotify']`; the Spotify login, the account and what Spotify refused in `localStorage['casamod-music-player-spotify-auth']`; the Jellyfin login in `localStorage['casamod-music-player-spotify-jellyfin']`.
- **The login on the server:** a copy of the Spotify login (Client ID, access and refresh tokens, account) in `/DATA/AppData/casamod/data/music-player-spotify.json`, read and written with CasaOS's file API (`/v1/file/content`, `PUT /v1/file`), which needs the CasaOS login. It is deliberately **outside** `/DATA/AppData/casamod/mod/`: CasaMOD serves that folder to anyone at `/mod/…`, without a login. Whoever is logged in to your CasaOS (or can read its files) can read it, as any of your files; the tokens control what this app may do in your Spotify (playback, library, playlists), not your password or account, and **Manage apps** at spotify.com revokes them. Each browser reads it when the widget appears and before renewing the token (every hour, at a random minute so the browsers don't all renew at once: the later ones find the new token there), and saves it after a login, a renewal or Disconnect; the newest (`at`) wins.
- **What plays:** `GET /me/player` every 3 seconds while playing and every 10 while paused, right after each command and when the song ends; nothing in local mode or while the tab is hidden. In between, the progress moves on its own (a 500 ms timer, only while playing and visible). A command shows at once and is then read back from Spotify. After a 429, nothing is asked until Spotify's `Retry-After` has passed.
- **Endpoints:** the player (`/me/player`, `play`, `pause`, `next`, `previous`, `seek`, `shuffle`, `repeat`, `volume`, `queue` to read and add, `devices`, transfer; skipping ahead in Up next is that many `next` calls, 20 at most), `/me/playlists`, `/playlists/{id}/items` (2026's name for a playlist's tracks; `items[].item` or `items[].track`), `/me/tracks` (Liked Songs), `/me/library` and `/me/library/contains` (saving, with the older `/me/tracks?ids=` as a fallback), `/search?type=track&limit=10`. Liked Songs play as your collection (`spotify:user:{id}:collection`), else as up to 100 tracks from the one clicked.
- **Play in this browser:** Spotify's [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk), loaded from `sdk.scdn.co` only with the switch on and in Spotify mode (it adds a hidden iframe where Spotify plays protected audio). One player per page, and one tab per browser at a time (Web Locks: the others wait). It gets the access token from the same login, a new one each time it asks (it refuses the same token twice). While the music plays here, the player's events say what plays and its methods take play/pause, seek, previous, next and the volume (no Web API calls, so no Web API quota); `GET /me/player` is read only every 30 s, to notice the music moving elsewhere. Shuffle, repeat, the queue and starting a playlist still go through the Web API. While it plays here, a silent quarter-second loop plays in the page too (paused with the music, and started with a `play()` from a blank frame, so other mods that watch what plays, like Live Wallpapers, don't take it for the song): browsers give the media controls (Chrome's media button, Windows' overlay) to the topmost frame with a player, and this way they reach the widget, which knows the song's position, instead of the SDK's own media session (off: it gives milliseconds as seconds, a 2-minute song shows as 40 hours and seeking skips it). "This browser" is `PUT /me/player` with this device's id (retried while Spotify doesn't list the new device yet).
- **Jellyfin:** the login is Quick Connect (`GET /QuickConnect/Enabled`, `POST /QuickConnect/Initiate` (`GET` before 10.9), `GET /QuickConnect/Connect` every 3 s, `POST /Users/AuthenticateWithQuickConnect`), with a device id of its own; Disconnect is `POST /Sessions/Logout`. Every call sends `Authorization: MediaBrowser Client="CasaOS Music Player", Device="CasaOS", DeviceId=…, Version=…, Token=…` and asks for PascalCase JSON (`Accept: application/json; profile="PascalCase"`: Jellyfin 12 answers camelCase otherwise). Jellyfin's API allows any page (CORS), so the widget talks to it from the CasaOS page. The library is `/Items` (favorites, albums, an album's tracks, an artist's albums, search: `SearchTerm`), `/Artists/AlbumArtists` and `/Playlists/{id}/Items`; albums and artists come 200 at a time as you scroll. A track plays from `/Audio/{id}/universal` in an audio element of the page (with `crossOrigin`, so Live Wallpapers can analyse it), listing the formats this browser plays (`canPlayType`) and MP3 for the rest; the token goes in its `ApiKey` parameter (an audio element can't send headers). Covers are `/Items/{id}/Images/Primary`, a track without its own showing its album's. What plays is reported to `/Sessions/Playing`, `…/Progress` (pause and play) and `…/Stopped`; the ❤ is `/UserFavoriteItems/{id}` (the older `/Users/{user}/FavoriteItems/{id}` as a fallback). Its login on the server is `/DATA/AppData/casamod/data/music-player-jellyfin.json` (address, token, account, device id, `at`), shared like Spotify's: the address is kept as `:port` when Jellyfin is on the CasaOS host, and becomes the page's scheme and host (`http://host:8096` or `https://….ts.net:8096`). A 401 reads the server first (another browser's newer login), then logs out.
- **For other mods:** in Spotify mode, the widget fires a `casamods:nowplaying` event on `window` with `{ source: 'spotify', title, artist, album, cover, playing, position, duration, at }` (seconds; `at` is `Date.now()`), and `{ playing: false }` when it stops or leaves Spotify mode. `window.CasaMusicPlayer` has the Music Player's API, plus `source('local' | 'spotify' | 'jellyfin')`, `jellyfin` (`audio`, `connected`, `playing`, `disconnect`) and `spotify` (`playback`, `connected`, `premium`, `connect`, `disconnect`, `refresh`, `here` (this browser as a device: `{ on, ready, active, device, failed }`), `playHere()`).

## Tests

```bash
node tests/text-check.js     # languages, a second
```

All 31 CasaOS languages, every text in each. There is no browser suite for the Spotify mode: its login can only be tested with a real Spotify account, on your CasaOS.
