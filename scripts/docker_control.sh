#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-}"
shift || true

if [[ "$cmd" == "list" ]]; then
  docker_output="$(docker service ls --format '{{.ID}}|{{.Name}}|{{.Replicas}}|{{.Image}}' 2>&1)" || {
    err="${docker_output//\"/\\\"}"
    echo "{\"ok\":false,\"error\":\"${err}\"}"
    exit 1
  }

  printf '%s\n' "$docker_output" | awk -F'|' '
    BEGIN { print "{\"ok\":true,\"containers\":["; first=1 }
    NF < 4 { next }
    {
      gsub(/"/, "\\\"", $2);
      gsub(/"/, "\\\"", $3);
      gsub(/"/, "\\\"", $4);
      split($3, r, "/");
      running = (r[1]+0 > 0) ? "true" : "false";
      if (!first) printf ",";
      first=0;
      printf "{\"id\":\"%s\",\"name\":\"%s\",\"status\":\"%s\",\"image\":\"%s\",\"running\":%s}", $1, $2, $3, $4, running;
    }
    END { print "]}" }
  '
  exit 0
fi

if [[ "$cmd" == "start" || "$cmd" == "stop" ]]; then
  if [[ "$#" -eq 0 ]]; then
    echo '{"ok":true,"changed":0}'
    exit 0
  fi
  changed=0
  if [[ "$cmd" == "stop" ]]; then
    for name in "$@"; do
      if docker service scale --detach "${name}=0" >/dev/null 2>&1; then
        changed=$((changed + 1))
      fi
    done
  else
    for name in "$@"; do
      # Set replicas and force a new task in one update (recovers stuck/paused services)
      if docker service update --replicas 1 --force --detach --with-registry-auth "$name" >/dev/null 2>&1; then
        changed=$((changed + 1))
      fi
    done
  fi
  if [[ "$changed" -eq 0 ]]; then
    echo '{"ok":false,"error":"failed to start/stop all requested services"}'
    exit 1
  fi
  echo "{\"ok\":true,\"changed\":$changed}"
  exit 0
fi

echo '{"ok":false,"error":"unknown command"}'
exit 1
