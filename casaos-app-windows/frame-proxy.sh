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
# On the CasaOS server (again after installing an app):
#   sudo bash frame-proxy.sh
# Undo:
#   sudo bash frame-proxy.sh off
# Options (environment):
#   EXTRA="6080"            ports of apps outside Docker or on the host network
#                           (noVNC, for example)
#   HTTPS_APPS="8444"       ports to treat as HTTPS even if the app wasn't
#                           answering when the script ran
set -euo pipefail

DIR=/DATA/AppData/frame-proxy
HTTPS_APPS=${HTTPS_APPS:-""}
EXTRA=${EXTRA:-""}
OFFSET=30000
NAME=frame-proxy
IMAGE=caddy:2-alpine

[ "$(id -u)" = 0 ] || { echo "Run it with sudo." >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker not found." >&2; exit 1; }
command -v tailscale >/dev/null || { echo "Tailscale not found." >&2; exit 1; }
command -v curl >/dev/null || { echo "curl not found." >&2; exit 1; }

# The TCP ports Docker publishes on every address, plus EXTRA; not CasaOS's own (80, 443)
app_ports() {
  {
    docker ps --format '{{.Ports}}' | grep -oE '0\.0\.0\.0:[0-9]+->[0-9]+/tcp' | sed -E 's/^0\.0\.0\.0:([0-9]+)->.*/\1/' || true
    for p in $EXTRA; do echo "$p"; done
  } | sort -un | grep -vxE '80|443' || true
}

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
  for p in $(app_ports); do tailscale serve --https="$p" off >/dev/null 2>&1 || true; done
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  echo "Frame proxy removed. CasaOS's own https:// (port 443) is untouched."
  exit 0
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true   # the old one, if any (its ports free up)
mkdir -p "$DIR/www"

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
{
  printf '{\n\tauto_https off\n\tadmin off\n}\n'
  for p in $(app_ports); do
    q=$(local_port "$p")
    if ss -ltnH "sport = :$q" 2>/dev/null | grep -q .; then
      echo "Port $q is in use: app port $p skipped." >&2
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

docker run -d --name "$NAME" --restart unless-stopped --network host \
  -v "$DIR/Caddyfile:/etc/caddy/Caddyfile:ro" -v "$DIR/www:/srv/casaos-windows:ro" "$IMAGE" >/dev/null
sleep 3
if ! docker ps --filter "name=^${NAME}$" --format '{{.Status}}' | grep -q '^Up'; then
  echo "Caddy didn't start:" >&2
  docker logs "$NAME" 2>&1 | tail -20 >&2
  exit 1
fi

for p in $served; do
  tailscale serve --bg --https="$p" "http://127.0.0.1:$(local_port "$p")" >/dev/null
  case " $tls_ports " in *" $p "*) how=' (its own https)' ;; *) how='' ;; esac
  echo "https port $p -> app $p$how"
done
echo
echo "Done. Open CasaOS at its https:// Tailscale address: the apps open in windows."
