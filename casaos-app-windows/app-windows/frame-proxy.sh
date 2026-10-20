#!/bin/bash
# Frame proxy for App Windows (CasaMODs): every app of this server can open in
# a window when CasaOS is opened at its Tailscale HTTPS address.
#
# For each app port P, `tailscale serve` gives https://<machine>.<tailnet>.ts.net:P
# (Tailscale's certificate) and hands it to a small Caddy listening on
# 127.0.0.1:P+30000, which passes it to the app without the headers that
# forbid being shown inside another page (X-Frame-Options, the CSP
# frame-ancestors directive), and without X-Forwarded-For (Home Assistant
# refuses requests that carry it from a proxy it wasn't told to trust, and the
# value would only be 127.0.0.1 anyway). Apps that serve HTTPS themselves
# (Portainer, MineOS) are found by trying TLS on their port. Each app's address
# also serves App Windows' window page (/__casaos-windows/): on the app's own
# origin it holds the app, so F5 inside the app reloads the app and what the
# app plays reaches the CasaOS tab (Live Wallpapers). Only inside your
# tailnet: nothing is exposed to the internet, and the http:// addresses on
# your network don't change.
#
# Caddy runs as a CasaOS app, "Frame Proxy" (a Docker Compose project whose
# file the script writes; CasaOS lists every Compose project). Its card opens
# a page that lists the ports and adds or removes them: the page's requests
# reach a systemd socket on this machine (frame-proxy-api.socket), which saves
# the ports and runs this script again. A timer (frame-proxy-scan.timer) runs
# it again by itself when Docker's ports change (an app installed or removed).
# It ships in App Windows' folder: run it once on the server; after that the
# page and the timer keep it up to date.
#
# On the CasaOS server:
#   sudo bash /DATA/AppData/casamod/mod/app-windows/frame-proxy.sh
# Undo:
#   sudo bash /DATA/AppData/casamod/mod/app-windows/frame-proxy.sh off
# Options (environment; kept in /DATA/AppData/frame-proxy/config for the next
# runs, and changed by the page):
#   EXTRA="6080"            ports of apps outside Docker or on the host network
#                           (noVNC, for example)
#   HTTPS_APPS="8444"       ports to treat as HTTPS even if the app wasn't
#                           answering when the script ran
#   SKIP="9000"             ports Docker publishes that stay out of the proxy
#   PAGE_PORT="8390"        the port of the Frame Proxy page (empty: no page)
set -euo pipefail

DIR=/DATA/AppData/frame-proxy
OFFSET=30000
NAME=frame-proxy
IMAGE=caddy:2-alpine
ICON=https://cdn.jsdelivr.net/gh/UsuarioDeJava/CasaMODs@main/casaos-app-windows/frame-proxy-icon.png
UNITS=/etc/systemd/system

# A list of ports: the numbers 1-65535 in it, sorted, once each
ports() { tr -cs '0-9' '\n' <<<"${1:-}" | awk '$1 > 0 && $1 < 65536 { print $1 + 0 }' | sort -un | head -n 64 | paste -sd' ' - || true; }

# The settings: from the environment when given, else from the last run
conf() { sed -n "s/^$1=\"\\(.*\\)\"\$/\\1/p" "$DIR/config" 2>/dev/null | head -n1 || true; }
EXTRA=$(ports "${EXTRA-$(conf EXTRA)}")
HTTPS_APPS=$(ports "${HTTPS_APPS-$(conf HTTPS_APPS)}")
SKIP=$(ports "${SKIP-$(conf SKIP)}")
if [ -z "${PAGE_PORT+x}" ]; then
  if grep -q '^PAGE_PORT=' "$DIR/config" 2>/dev/null; then PAGE_PORT=$(conf PAGE_PORT); else PAGE_PORT=8390; fi
fi
PAGE_PORT=$(ports "$PAGE_PORT" | cut -d' ' -f1)
save_config() {
  mkdir -p "$DIR"
  printf 'EXTRA="%s"\nHTTPS_APPS="%s"\nSKIP="%s"\nPAGE_PORT="%s"\n' "$EXTRA" "$HTTPS_APPS" "$SKIP" "$PAGE_PORT" > "$DIR/config"
}

# One request from the Frame Proxy page. systemd hands the connection over as
# stdin/stdout (frame-proxy-api.socket: a Unix socket in $DIR/api that only the
# Caddy app reaches, and Caddy passes on only POSTs from this machine, which is
# how tailscale serve's requests arrive). It answers first: the run it starts
# (its own unit, frame-proxy-apply-…; runs wait for each other) restarts
# Caddy, the answer's way back.
if [ "${1:-}" = api ]; then
  answer() {
    printf 'HTTP/1.1 %s\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: %s\r\n\r\n%s' "$1" "${#2}" "$2"
    exit 0
  }
  IFS= read -r -t 5 req || exit 0
  read -r method target _ <<<"${req%$'\r'}"
  marked=""
  while IFS= read -r -t 5 h; do
    h=${h%$'\r'}
    [ -n "$h" ] || break
    case "${h,,}" in 'x-frame-proxy: 1') marked=1 ;; esac
  done
  [ "$method" = POST ] && [ -n "$marked" ] || answer '403 Forbidden' '{"ok":false}'
  case "$target" in
    /api/ping) answer '200 OK' '{"ok":true}' ;;
    /api/scan) ;;
    /api/ports\?*)
      IFS='&' read -ra pairs <<<"${target#*\?}"
      for kv in ${pairs[@]+"${pairs[@]}"}; do
        v=${kv#*=}
        [[ $v =~ ^[0-9.]*$ ]] || answer '400 Bad Request' '{"ok":false}'
        case "${kv%%=*}" in
          extra) EXTRA=$(ports "$v") ;;
          https) HTTPS_APPS=$(ports "$v") ;;
          skip) SKIP=$(ports "$v") ;;
        esac
      done
      save_config ;;
    *) answer '404 Not Found' '{"ok":false}' ;;
  esac
  systemd-run --no-block --collect --quiet --unit "frame-proxy-apply-$(date +%s%N)" -p After=docker.service \
    /bin/bash "$DIR/frame-proxy.sh" >/dev/null 2>&1 || answer '500 Internal Server Error' '{"ok":false}'
  answer '202 Accepted' '{"ok":true}'
fi

[ "$(id -u)" = 0 ] || { echo "Run it with sudo." >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker not found." >&2; exit 1; }
command -v tailscale >/dev/null || { echo "Tailscale not found." >&2; exit 1; }
command -v curl >/dev/null || { echo "curl not found." >&2; exit 1; }
COMPOSE=""
docker compose version >/dev/null 2>&1 && COMPOSE=1
SYSTEMD=""
[ -d /run/systemd/system ] && command -v systemctl >/dev/null && SYSTEMD=1

# The TCP ports Docker publishes on every address; not CasaOS's own (80, 443)
docker_ports() {
  docker ps --format '{{.Ports}}' | grep -oE '0\.0\.0\.0:[0-9]+->[0-9]+/tcp' | sed -E 's/^0\.0\.0\.0:([0-9]+)->.*/\1/' |
    grep -vxE '80|443' | sort -un || true
}

# What the proxy serves: Docker's ports and EXTRA, without SKIP; the page's port
app_ports() {
  local out="" p
  for p in $(ports "$(docker_ports) $EXTRA"); do
    case " $SKIP $PAGE_PORT " in *" $p "*) ;; *) out="$out $p" ;; esac
  done
  ports "$out $PAGE_PORT"
}

# Run again when Docker's ports change (the scan timer)
if [ "${1:-}" = scan ]; then
  [ "$(app_ports)" = "$(cat "$DIR/scanned" 2>/dev/null || true)" ] && exit 0
  exec bash "$0"
fi

# Where Caddy listens for port P (only on this machine)
local_port() {
  if [ "$1" -lt 35536 ]; then echo $(($1 + OFFSET)); else echo $(($1 - OFFSET)); fi
}

# An app that serves HTTPS itself: its port answers TLS (any certificate)
is_https_app() {
  case " $HTTPS_APPS " in *" $1 "*) return 0 ;; esac
  curl -sk -o /dev/null -m 5 "https://127.0.0.1:$1/"
}

if [ "${1:-}" = off ]; then
  for p in $(app_ports) $(cat "$DIR/served" 2>/dev/null || true); do tailscale serve --https="$p" off >/dev/null 2>&1 || true; done
  if [ -n "$SYSTEMD" ]; then
    systemctl disable --now frame-proxy-api.socket frame-proxy-scan.timer >/dev/null 2>&1 || true
    rm -f "$UNITS/frame-proxy-api.socket" "$UNITS/frame-proxy-api@.service" \
      "$UNITS/frame-proxy-scan.service" "$UNITS/frame-proxy-scan.timer"
    systemctl daemon-reload || true
  fi
  [ -z "$COMPOSE" ] || docker compose -p "$NAME" down >/dev/null 2>&1 || true
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -f "$DIR/served" "$DIR/scanned"
  echo "Frame proxy removed. CasaOS's own https:// (port 443) is untouched."
  exit 0
fi

mkdir -p "$DIR"
exec 9>"$DIR/lock"
flock 9   # one run at a time (the page, the timer, by hand)
save_config
app_ports > "$DIR/scanned"   # what the timer compares (a failed run isn't retried until they change)
docker rm -f "$NAME" >/dev/null 2>&1 || true   # the old one, if any (its ports free up)
mkdir -p "$DIR/www" "$DIR/page" "$DIR/api"
# The copy the page's requests and the timer run
if [ -f "$0" ] && [ "$(readlink -f "$0")" != "$DIR/frame-proxy.sh" ]; then cp -f "$0" "$DIR/frame-proxy.sh"; fi
if [ -n "$PAGE_PORT" ] && ss -ltnH "sport = :$PAGE_PORT" 2>/dev/null | grep -q .; then
  echo "Port $PAGE_PORT is in use: no Frame Proxy page (choose another with PAGE_PORT=...)." >&2
  PAGE_PORT=""
fi

# App Windows' window page, served at /__casaos-windows/ on every app's address
cat > "$DIR/www/frame.html" <<'HTML'
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>App Windows</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#fff}iframe{display:block;width:100%;height:100%;border:0}</style>
</head>
<body>
<iframe id="app" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-read; clipboard-write; microphone; camera; display-capture; geolocation; screen-wake-lock; web-share" allowfullscreen></iframe>
<script src="frame.js"></script>
</body>
</html>
HTML

cat > "$DIR/www/frame.js" <<'JS'
// App Windows (CasaMODs): an app's window loads this page, which holds the
// app, unchanged, in the frame below. It is on the app's own address (same
// origin), so it reaches the app's page, which the CasaOS tab can't:
// - F5 (Ctrl+R) inside the app reloads the app, not the whole CasaOS tab;
// - what the app plays (the Media Session's title, artist, album and cover;
//   the media element's state, position and duration) goes to the CasaOS
//   tab, where App Windows passes it to other mods (Live Wallpapers);
// - its sound, analysed here (64 bands, the way Live Wallpapers does), goes
//   there too, only while a wallpaper listens and the app plays.
(function () {
  'use strict';
  var frame = document.getElementById('app');
  var q = new URLSearchParams(location.hash.slice(1));
  var path = q.get('u') || '/';
  if (!/^\/(?![\/\\])/.test(path)) path = '/';   // this address only
  var casa = '';   // the CasaOS page: the only one told anything
  try {
    var o = new URL(q.get('o'));
    if (o.hostname === location.hostname) casa = o.origin;
  } catch (e) { /* none */ }
  frame.src = path;

  function tell(type, data) {
    if (casa) parent.postMessage({ cw: 1, type: type, data: data }, casa);
  }

  // The app's page, when it can be reached (not another site, after a redirect)
  function page() {
    try {
      var w = frame.contentWindow;
      return w && w.document && w.document.URL !== 'about:blank' ? w : null;
    } catch (e) { return null; }
  }

  // F5 / Ctrl+R: the app (Shift: the whole tab, as always)
  function reload() {
    var w = page();
    if (w) w.location.reload();
    else frame.src = path;
  }
  function onKey(e) {
    var r = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'r' || e.key === 'R'));
    if (!r || e.shiftKey || e.defaultPrevented) return;
    e.preventDefault();
    reload();
  }
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!casa || e.source !== parent || e.origin !== casa || !d || d.cw !== 1) return;
    if (d.type === 'reload') reload();
    else if (d.type === 'sound') {
      wantSound = !!d.on;
      sound();
    }
  });

  // What plays: the media element that last started playing, in the page or not
  var EVENTS = ['play', 'playing', 'pause', 'ended', 'emptied', 'loadedmetadata', 'durationchange', 'seeked', 'ratechange'];
  var seen = new WeakSet(), el = null, timer = 0, poll = 0, lastMeta = '';
  function isMedia(t) { return !!t && (t.nodeName === 'AUDIO' || t.nodeName === 'VIDEO'); }
  function watch(m) {
    if (seen.has(m)) return;
    seen.add(m);
    EVENTS.forEach(function (t) { m.addEventListener(t, onMedia); });
  }
  function onMedia(e) {
    var m = e.currentTarget;
    if (e.type === 'play' || e.type === 'playing') el = m;
    if (m !== el) return;
    soon();
    sound(e.type === 'playing');   // a new track: captured again
  }
  function soon() {
    clearTimeout(timer);
    timer = setTimeout(report, 150);
  }

  function meta(w) {
    var md = null;
    try { md = w.navigator.mediaSession && w.navigator.mediaSession.metadata; } catch (e) { /* none */ }
    var art = '', size = -1;
    if (md && md.artwork) {
      for (var i = 0; i < md.artwork.length; i++) {
        var a = md.artwork[i], n = parseInt(String(a.sizes || '').split('x')[0], 10) || 0;
        if (n >= size) { size = n; art = a.src; }
      }
    }
    return {
      title: (md && md.title) || w.document.title || '', artist: (md && md.artist) || '', album: (md && md.album) || '', art: art
    };
  }

  // The cover as an image the CasaOS tab can read (a picture from the app's
  // own address; another site's stays an address)
  var covers = {}, ncovers = 0;
  function cover(src, done) {
    if (!src) return done('');
    if (src in covers) return done(covers[src] || src);
    var img = new Image();
    img.onload = function () {
      var c = '';
      try {
        var k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight, 1)), cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.naturalWidth * k));
        cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        c = cv.toDataURL('image/jpeg', 0.85);
      } catch (e) { /* another site's picture */ }
      if (++ncovers > 20) { covers = {}; ncovers = 1; }
      covers[src] = c;
      done(c || src);
    };
    img.onerror = function () { covers[src] = ''; done(src); };
    img.src = src;
  }

  function report() {
    var w = page(), m = el;
    if (!w || !m) return;
    var md = meta(w), playing = !m.paused && !m.ended;
    lastMeta = md.title + '\n' + md.artist + '\n' + md.art;
    var d = {
      title: md.title, artist: md.artist, album: md.album, playing: playing,
      position: m.currentTime || 0, duration: isFinite(m.duration) ? m.duration : 0, at: Date.now()
    };
    cover(md.art, function (c) {
      d.cover = c;
      tell('media', d);
    });
    // a new track's title can come a moment later, with no event: look again while it plays
    clearInterval(poll);
    if (playing) {
      poll = setInterval(function () {
        var x = page(), n = x && meta(x);
        if (n && n.title + '\n' + n.artist + '\n' + n.art !== lastMeta) report();
      }, 2000);
    }
  }

  // Its sound, for wallpapers that react to it: the media element's audio,
  // copied (captureStream: the app's own sound and Web Audio stay untouched)
  // into an analyser set like Live Wallpapers' own, 64 bands from 30 Hz to
  // 16 kHz (the loudest bin of each, 0-255), about 30 times a second
  var BANDS = 64, wantSound = false, ac = null, an = null, feed = null, fed = null, bins = null, edges = null;
  var soundTimer = 0, loud = false;
  function sound(again) {
    var m = el;
    if (!wantSound || !m || m.paused || m.ended) {
      clearInterval(soundTimer);
      soundTimer = 0;
      return;
    }
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      an = ac.createAnalyser();
      an.fftSize = 4096;
      an.smoothingTimeConstant = 0.55;
      an.minDecibels = -85;
      an.maxDecibels = -25;
      bins = new Uint8Array(an.frequencyBinCount);
      var hz = ac.sampleRate / an.fftSize;
      edges = new Uint16Array(BANDS + 1);
      for (var i = 0; i <= BANDS; i++) {
        edges[i] = Math.max(1, Math.round(30 * Math.pow(16000 / 30, i / BANDS) / hz));
        if (i > 0 && edges[i] <= edges[i - 1]) edges[i] = edges[i - 1] + 1;
      }
    }
    if (ac.state === 'suspended') ac.resume().catch(function () { /* after the next click in the app */ });
    if (again || fed !== m) {
      if (feed) feed.disconnect();
      feed = null;
      fed = m;
      try {
        var st = m.captureStream();
        if (st.getAudioTracks().length) {
          feed = ac.createMediaStreamSource(st);
          feed.connect(an);
        }
      } catch (e) { /* another site's media, or no captureStream: no sound to read */ }
    }
    if (!soundTimer) soundTimer = setInterval(listen, 33);
  }
  function listen() {
    if (!el || el.paused || el.ended || !wantSound) return sound();
    an.getByteFrequencyData(bins);
    var out = new Array(BANDS), any = false;
    for (var b = 0; b < BANDS; b++) {
      var v = 0;
      for (var k = edges[b]; k < edges[b + 1] && k < bins.length; k++) if (bins[k] > v) v = bins[k];
      out[b] = v;
      if (v) any = true;
    }
    if (any || loud) tell('sound', { bands: out });   // silence once, then nothing
    loud = any;
  }

  // Where the app is: for "open in a new tab", and after CasaOS reloads
  function where() {
    var w = page();
    if (w) tell('place', { href: w.location.href });
  }

  // Each page the app loads (again on every navigation)
  function hook() {
    var w = page();
    if (!w || w.document.__cw) return;
    var d = w.document;
    d.__cw = true;
    d.addEventListener('keydown', onKey, true);
    d.addEventListener('pointerdown', function () {
      if (ac && ac.state === 'suspended') ac.resume().catch(function () { /* not yet */ });
    }, true);
    d.addEventListener('play', function (e) {
      if (!isMedia(e.target)) return;
      watch(e.target);
      el = e.target;
      soon();
    }, true);
    var proto = w.HTMLMediaElement && w.HTMLMediaElement.prototype;
    if (proto && !proto.__cw) {
      proto.__cw = true;
      var play = proto.play;
      proto.play = function () {
        watch(this);
        return play.apply(this, arguments);
      };
    }
    var all = d.querySelectorAll('audio, video');
    for (var i = 0; i < all.length; i++) {
      watch(all[i]);
      if (!all[i].paused) el = all[i];
    }
    ['pushState', 'replaceState'].forEach(function (k) {
      var f = w.history[k];
      w.history[k] = function () {
        var r = f.apply(w.history, arguments);
        where();
        return r;
      };
    });
    w.addEventListener('popstate', where);
    w.addEventListener('hashchange', where);
    w.addEventListener('pagehide', function () {
      // its music stops with it
      if (!el) return;
      el = null;
      clearInterval(poll);
      tell('media', { title: '', playing: false });
      sound();
    });
    where();
    if (el) soon();
  }
  frame.addEventListener('load', hook);
  setInterval(hook, 1000);   // a page that hasn't finished loading yet
})();
JS

printf '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>\n' > "$DIR/www/ok.svg"

served=""
tls_ports=""
busy=""
{
  printf '{\n\tauto_https off\n\tadmin off\n}\n'
  # The Frame Proxy page (what its card in CasaOS opens), on every address.
  # Its requests (/api/) go on only when they come from this machine (through
  # tailscale serve) and are marked, which another site can't do.
  if [ -n "$PAGE_PORT" ]; then
    printf 'http://:%s {\n' "$PAGE_PORT"
    printf '\t@api path /api/*\n\thandle @api {\n'
    printf '\t\t@mine {\n\t\t\tmethod POST\n\t\t\tremote_ip 127.0.0.1 ::1\n\t\t\theader X-Frame-Proxy 1\n\t\t}\n'
    printf '\t\thandle @mine {\n\t\t\treverse_proxy unix//srv/api/sock\n\t\t}\n'
    printf '\t\thandle {\n\t\t\trespond "{\\"ok\\":false}" 403\n\t\t}\n\t}\n'
    printf '\thandle {\n\t\troot * /srv/page\n\t\theader Cache-Control no-cache\n\t\tfile_server\n\t}\n}\n'
  fi
  for p in $(app_ports); do
    q=$(local_port "$p")
    if ss -ltnH "sport = :$q" 2>/dev/null | grep -q .; then
      echo "Port $q is in use: app port $p skipped." >&2
      busy="$busy $p"
      continue
    fi
    if is_https_app "$p"; then
      up="https://127.0.0.1:$p"
      tls=$'\t\t\ttransport http {\n\t\t\t\ttls_insecure_skip_verify\n\t\t\t}\n'
      tls_ports="$tls_ports $p"
    else
      up="127.0.0.1:$p"
      tls=""
    fi
    # any Host (tailscale serve passes the browser's: <machine>.<tailnet>.ts.net:P),
    # on this machine only
    printf 'http://:%s {\n\tbind 127.0.0.1\n' "$q"
    printf '\thandle_path /__casaos-windows/* {\n\t\troot * /srv/casaos-windows\n'
    printf '\t\theader Cache-Control no-cache\n\t\tfile_server\n\t}\n'
    printf '\thandle {\n\t\treverse_proxy %s {\n%s' "$up" "$tls"
    printf '\t\t\theader_up X-Forwarded-Proto https\n'
    printf '\t\t\theader_up -X-Forwarded-For\n'
    printf '\t\t\theader_down -X-Frame-Options\n'
    printf '\t\t\theader_down Content-Security-Policy "frame-ancestors[^;]*;?" ""\n'
    printf '\t\t}\n\t}\n'
    # not a blank page when the app doesn't answer
    printf '\thandle_errors {\n\t\trespond "Frame proxy: the app on port %s did not answer ({err.status_code} {err.message})." {err.status_code}\n\t}\n}\n' "$p"
    served="$served $p"
  done
} > "$DIR/Caddyfile"

[ -n "$served" ] || { echo "No app ports found." >&2; exit 1; }

# The Frame Proxy page: it reads state.json (written at the end of each run)
# and sends its changes to /api/ (the systemd socket above)
cat > "$DIR/page/index.html" <<'PAGE'
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Frame Proxy</title>
<style>
body{margin:0;min-height:100vh;background:#1e2533;color:#e8edf3;font:15px/1.5 system-ui,sans-serif}
main{max-width:36rem;margin:0 auto;padding:2rem 1.25rem}
h1{margin:0 0 .25rem;font-size:1.4rem;font-weight:600}
p{margin:.5rem 0;color:#aab6c5}
ul{list-style:none;margin:1.25rem 0;padding:0}
li{display:flex;align-items:center;gap:.75rem;padding:.55rem .8rem;border-radius:.6rem;background:rgba(255,255,255,.06);margin:.35rem 0;transition:opacity .2s}
li.off{opacity:.55}
li .what{flex:1;color:#aab6c5;font-size:13px}
a{color:#8ab8ff;text-decoration:none}
button{font:inherit;font-size:13px;color:#e8edf3;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:.25rem .8rem;cursor:pointer;transition:background .15s}
button:hover{background:rgba(255,255,255,.18)}
button:disabled{opacity:.45;cursor:default}
button.main{background:#3388ff;border-color:#3388ff}
form{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:1rem 0}
input[type=number]{width:7rem;font:inherit;color:#fff;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.15);border-radius:.5rem;padding:.3rem .55rem}
label{color:#aab6c5;font-size:13px}
#msg{min-height:1.5em;color:#ffd27a}
small{color:#aab6c5}
code{background:rgba(255,255,255,.08);padding:.1rem .35rem;border-radius:.3rem}
[hidden]{display:none!important}
</style>
</head>
<body>
<main>
<h1>Frame Proxy</h1>
<p>With CasaOS opened at its <code>https://</code> Tailscale address, the apps on these ports open in App Windows' windows. New apps join by themselves within a minute.</p>
<ul id="ports"></ul>
<form id="add" hidden>
  <input type="number" id="port" min="1" max="65535" placeholder="Port" required>
  <label><input type="checkbox" id="https"> the app serves https itself</label>
  <button class="main">Add</button>
  <button type="button" id="scan">Scan again</button>
</form>
<p id="msg"></p>
<p id="note" hidden></p>
<p><small id="when"></small></p>
</main>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var state = null, can = false, working = false;
  var nums = function (a) { return (a || []).map(Number); };
  var has = function (a, p) { return a.indexOf(p) >= 0; };
  var without = function (a, p) { return a.filter(function (x) { return x !== p; }); };
  function load() { return fetch('state.json?' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function say(text) { $('msg').textContent = text || ''; }
  function render() {
    var s = state, list = $('ports');
    var docker = nums(s.docker), extra = nums(s.extra), skip = nums(s.skip), served = nums(s.served), tls = nums(s.https), busy = nums(s.busy);
    var all = docker.concat(extra).filter(function (p, i, a) { return a.indexOf(p) === i && p !== s.page; }).sort(function (a, b) { return a - b; });
    list.textContent = '';
    all.forEach(function (p) {
      var out = has(skip, p) && !has(extra, p), li = document.createElement('li'), name, what = [];
      if (has(served, p)) {
        name = document.createElement('a');
        name.href = location.protocol + '//' + location.hostname + ':' + p + '/';
        name.target = '_blank';
        name.rel = 'noopener';
      } else name = document.createElement('span');
      name.textContent = 'Port ' + p;
      what.push(has(docker, p) ? 'Docker app' : 'added');
      if (has(tls, p)) what.push('its own https');
      if (out) what.push('left out');
      if (has(busy, p)) what.push('skipped: port ' + (p < 35536 ? p + 30000 : p - 30000) + ' is in use');
      var w = document.createElement('span');
      w.className = 'what';
      w.textContent = what.join(' · ');
      li.className = out ? 'off' : '';
      li.appendChild(name);
      li.appendChild(w);
      if (can) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = out ? 'Add back' : 'Remove';
        b.disabled = working;
        b.onclick = function () { out ? change({ skip: without(skip, p) }) : remove(p); };
        li.appendChild(b);
      }
      list.appendChild(li);
    });
    if (!all.length) list.innerHTML = '<li><span class="what">No app ports yet.</span></li>';
    $('add').hidden = !can;
    [].forEach.call($('add').querySelectorAll('button, input'), function (e) { e.disabled = working; });
    $('when').textContent = 'Updated ' + new Date(s.at).toLocaleString() + '.';
  }
  function remove(p) {
    var s = state;
    change({ extra: without(nums(s.extra), p), https: without(nums(s.httpsApps), p), skip: has(nums(s.docker), p) ? nums(s.skip).concat(p) : nums(s.skip) });
  }
  function change(c) {
    var s = state;
    var q = ['extra', 'https', 'skip'].map(function (k) {
      var v = c[k] || nums(k === 'https' ? s.httpsApps : s[k]);
      return k + '=' + v.join('.');
    }).join('&');
    send('api/ports?' + q);
  }
  function send(path) {
    var before = state.at, t0 = Date.now();
    working = true;
    say('Applying… Caddy restarts, a few seconds.');
    render();
    fetch(path, { method: 'POST', headers: { 'X-Frame-Proxy': '1' } }).then(function (r) {
      if (!r.ok) throw new Error('the server answered ' + r.status);
      (function poll() {
        if (Date.now() - t0 > 90000) return fail(new Error('no news after 90 s (on the server: sudo journalctl -u "frame-proxy-apply-*")'));
        setTimeout(function () {
          load().then(function (s) {
            if (s.at === before) return poll();
            state = s;
            working = false;
            say('Done.');
            render();
          }, poll);
        }, 1500);
      })();
    }).catch(fail);
  }
  function fail(e) {
    working = false;
    say('Not applied: ' + e.message + '.');
    render();
  }
  $('add').onsubmit = function (e) {
    e.preventDefault();
    var p = Number($('port').value), s = state;
    if (!(p > 0 && p < 65536) || p === 80 || p === 443 || p === s.page) return say('Choose another port.');
    var c = { skip: without(nums(s.skip), p), extra: nums(s.extra), https: nums(s.httpsApps) };
    if (!has(nums(s.docker), p) && !has(c.extra, p)) c.extra.push(p);
    if ($('https').checked && !has(c.https, p)) c.https.push(p);
    $('port').value = '';
    $('https').checked = false;
    change(c);
  };
  $('scan').onclick = function () { send('api/scan'); };
  load().then(function (s) {
    state = s;
    render();
    // Changes only reach the server through CasaOS's https:// address (tailscale serve)
    return fetch('api/ping', { method: 'POST', headers: { 'X-Frame-Proxy': '1' } }).then(function (r) {
      can = r.ok;
      if (!can) {
        $('note').hidden = false;
        $('note').textContent = r.status === 403
          ? 'To add or remove ports, open this page from CasaOS at its https:// address.'
          : 'Adding or removing ports here needs systemd on the server; run frame-proxy.sh there with EXTRA or SKIP.';
      }
      render();
    });
  }).catch(function (e) { say('Could not read the state: ' + e.message + '.'); });
})();
</script>
</body>
</html>
PAGE

# Caddy as the CasaOS app "Frame Proxy": a Compose project (CasaOS lists every
# one; a plain container would show under Legacy app). Without Docker Compose,
# a plain container.
cat > "$DIR/docker-compose.yml" <<YAML
name: $NAME
services:
  $NAME:
    image: $IMAGE
    container_name: $NAME
    restart: unless-stopped
    network_mode: host
    volumes:
      - type: bind
        source: $DIR/Caddyfile
        target: /etc/caddy/Caddyfile
        read_only: true
      - type: bind
        source: $DIR/www
        target: /srv/casaos-windows
        read_only: true
      - type: bind
        source: $DIR/page
        target: /srv/page
        read_only: true
      - type: bind
        source: $DIR/api
        target: /srv/api
x-casaos:
  main: $NAME
  author: UsuarioDeJava
  developer: CasaMODs
  category: Utilities
  architectures:
    - amd64
    - arm64
    - arm
  icon: $ICON
  title:
    en_us: Frame Proxy
  tagline:
    en_us: Every app in a window (App Windows)
  description:
    en_us: Written by frame-proxy.sh (CasaMODs, App Windows). Its page adds and removes ports; "sudo bash frame-proxy.sh off" removes it.
  scheme: http
  port_map: "${PAGE_PORT}"
  index: /
YAML

# The page's requests (a socket that runs this script once per connection)
# and the timer that runs it again when Docker's ports change
if [ -n "$SYSTEMD" ]; then
  cat > "$UNITS/frame-proxy-api.socket" <<UNIT
[Unit]
Description=Frame Proxy page requests (CasaMODs App Windows)

[Socket]
ListenStream=$DIR/api/sock
SocketMode=0600
Accept=yes
MaxConnections=4

[Install]
WantedBy=sockets.target
UNIT
  cat > "$UNITS/frame-proxy-api@.service" <<UNIT
[Unit]
Description=Frame Proxy page request

[Service]
ExecStart=/bin/bash $DIR/frame-proxy.sh api
StandardInput=socket
StandardOutput=socket
StandardError=journal
UNIT
  cat > "$UNITS/frame-proxy-scan.service" <<UNIT
[Unit]
Description=Frame Proxy: look for new app ports
After=docker.service

[Service]
Type=oneshot
ExecStart=/bin/bash $DIR/frame-proxy.sh scan
UNIT
  cat > "$UNITS/frame-proxy-scan.timer" <<UNIT
[Unit]
Description=Frame Proxy: look for new app ports every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable frame-proxy-api.socket frame-proxy-scan.timer >/dev/null 2>&1
  systemctl restart frame-proxy-api.socket
  systemctl start frame-proxy-scan.timer
fi

if [ -n "$COMPOSE" ]; then
  docker compose -p "$NAME" -f "$DIR/docker-compose.yml" up -d >/dev/null 2>&1 || {
    echo "Docker Compose couldn't start Caddy:" >&2
    docker compose -p "$NAME" -f "$DIR/docker-compose.yml" up -d >&2 || true
    exit 1
  }
else
  echo "Docker Compose not found: Caddy runs as a plain container (CasaOS lists it under Legacy app)." >&2
  docker run -d --name "$NAME" --restart unless-stopped --network host \
    -v "$DIR/Caddyfile:/etc/caddy/Caddyfile:ro" -v "$DIR/www:/srv/casaos-windows:ro" -v "$DIR/page:/srv/page:ro" \
    -v "$DIR/api:/srv/api" "$IMAGE" >/dev/null
fi
sleep 3
if ! docker ps --filter "name=^${NAME}$" --format '{{.Status}}' | grep -q '^Up'; then
  echo "Caddy didn't start:" >&2
  docker logs "$NAME" 2>&1 | tail -20 >&2
  exit 1
fi

for p in $served; do
  tailscale serve --bg --https="$p" "http://127.0.0.1:$(local_port "$p")" >/dev/null
  case " $tls_ports " in *" $p "*) how=' (its own https)' ;; *) how='' ;; esac
  if [ "$p" = "$PAGE_PORT" ]; then echo "https port $p -> the Frame Proxy page"; else echo "https port $p -> app $p$how"; fi
done
# The ports served last time and not now (removed on the page, or their app is gone)
for p in $(cat "$DIR/served" 2>/dev/null || true); do
  case " $served " in *" $p "*) ;; *) tailscale serve --https="$p" off >/dev/null 2>&1 || true ;; esac
done
printf '%s\n' $served > "$DIR/served"

# What the page shows; written last, so the page knows the run is over
list() { local out="" p; for p in $1; do out="$out${out:+,}$p"; done; printf '[%s]' "$out"; }
api=false
[ -z "$SYSTEMD" ] || api=true
printf '{"at":"%s","api":%s,"page":%s,"served":%s,"docker":%s,"extra":%s,"httpsApps":%s,"https":%s,"skip":%s,"busy":%s}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" "$api" "${PAGE_PORT:-null}" "$(list "$served")" "$(list "$(docker_ports)")" "$(list "$EXTRA")" \
  "$(list "$HTTPS_APPS")" "$(list "$tls_ports")" "$(list "$SKIP")" "$(list "$busy")" > "$DIR/page/state.json"

echo
echo "Done. Open CasaOS at its https:// Tailscale address: the apps open in windows."
[ -z "$COMPOSE" ] || echo "Caddy is the app \"Frame Proxy\" on the CasaOS dashboard${PAGE_PORT:+ (its page, port $PAGE_PORT, adds and removes ports)}."
