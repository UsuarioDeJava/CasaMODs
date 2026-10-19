#!/bin/bash
# Frame proxy for App Windows (CasaMODs): every app of this server can open in
# a window when CasaOS is opened at its Tailscale HTTPS address.
#
# For each app port P, `tailscale serve` gives https://<machine>.<tailnet>.ts.net:P
# (Tailscale's certificate) and hands it to a small Caddy listening on
# 127.0.0.1:P+30000, which passes it to the app without the headers that
# forbid being shown inside another page (X-Frame-Options, the CSP
# frame-ancestors directive). Only inside your tailnet: nothing is exposed to
# the internet, and the http:// addresses on your network don't change.
#
# On the CasaOS server (again after installing an app):
#   sudo bash frame-proxy.sh
# Undo:
#   sudo bash frame-proxy.sh off
# Options (environment):
#   HTTPS_APPS="9443 8443"  apps that serve HTTPS themselves, with their own
#                           certificate (Portainer, MineOS): Caddy talks HTTPS to them
#   EXTRA="6080"            ports of apps outside Docker (noVNC, for example)
set -euo pipefail

DIR=/DATA/AppData/frame-proxy
HTTPS_APPS=${HTTPS_APPS:-"9443 8443"}
EXTRA=${EXTRA:-""}
OFFSET=30000
NAME=frame-proxy
IMAGE=caddy:2-alpine

[ "$(id -u)" = 0 ] || { echo "Run it with sudo." >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker not found." >&2; exit 1; }
command -v tailscale >/dev/null || { echo "Tailscale not found." >&2; exit 1; }

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

is_https_app() { case " $HTTPS_APPS " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

if [ "${1:-}" = off ]; then
  for p in $(app_ports); do tailscale serve --https="$p" off >/dev/null 2>&1 || true; done
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  echo "Frame proxy removed. CasaOS's own https:// (port 443) is untouched."
  exit 0
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true   # the old one, if any (its ports free up)
mkdir -p "$DIR"

served=""
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
      tls=$'\t\ttransport http {\n\t\t\ttls_insecure_skip_verify\n\t\t}\n'
    else
      up="127.0.0.1:$p"
      tls=""
    fi
    # any Host (tailscale serve passes the browser's: <machine>.<tailnet>.ts.net:P),
    # on this machine only
    printf 'http://:%s {\n\tbind 127.0.0.1\n\treverse_proxy %s {\n%s' "$q" "$up" "$tls"
    printf '\t\theader_up X-Forwarded-Proto https\n'
    printf '\t\theader_down -X-Frame-Options\n'
    printf '\t\theader_down Content-Security-Policy "frame-ancestors[^;]*;?" ""\n'
    printf '\t}\n}\n'
    served="$served $p"
  done
} > "$DIR/Caddyfile"

[ -n "$served" ] || { echo "No app ports found." >&2; exit 1; }

docker run -d --name "$NAME" --restart unless-stopped --network host \
  -v "$DIR/Caddyfile:/etc/caddy/Caddyfile:ro" "$IMAGE" >/dev/null
sleep 3
if ! docker ps --filter "name=^${NAME}$" --format '{{.Status}}' | grep -q '^Up'; then
  echo "Caddy didn't start:" >&2
  docker logs "$NAME" 2>&1 | tail -20 >&2
  exit 1
fi

for p in $served; do
  tailscale serve --bg --https="$p" "http://127.0.0.1:$(local_port "$p")" >/dev/null
  echo "https port $p -> app $p$(is_https_app "$p" && echo ' (its own https)')"
done
echo
echo "Done. Open CasaOS at its https:// Tailscale address: the apps open in windows."
