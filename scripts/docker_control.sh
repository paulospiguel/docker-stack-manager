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
  if [[ "$cmd" == "stop" ]]; then
    scale_args=()
    for name in "$@"; do scale_args+=("${name}=0"); done
    docker service scale --detach "${scale_args[@]}" >/dev/null
  else
    scale_args=()
    for name in "$@"; do scale_args+=("${name}=1"); done
    docker service scale --detach "${scale_args[@]}" >/dev/null
    for name in "$@"; do
      docker service update --force --detach --with-registry-auth "$name" >/dev/null
    done
  fi
  echo "{\"ok\":true,\"changed\":$#}"
  exit 0
fi

echo '{"ok":false,"error":"unknown command"}'
exit 1
