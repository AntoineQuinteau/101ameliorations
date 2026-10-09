#!/bin/bash
# PreToolUse guard (Bash): while session-setup-worker.sh is still running,
# holds back commands whose first word needs Node/node_modules (npm, npx,
# node, ...) or Docker (docker, supabase, e2e/db scripts), each only on the
# step it needs. Anything else (file reads, git, ...) goes through at once.
set -uo pipefail

state_dir=/tmp/claude-session-setup
[ -f "$state_dir/node" ] || exit 0

command="$(jq -r '.tool_input.command // ""')"

# First three words of each simple command: split on shell operators, drop
# leading VAR=value assignments and wrapper commands, strip any path.
words="$(
  sed -E 's/&&|\|\||\$\(|[;|&()`]/\n/g' <<< "$command" \
    | sed -E 's/^[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*|env|time|nohup|sudo|timeout[[:space:]]+[^[:space:]]+)[[:space:]]+)*//' \
    | awk 'NF { sub(/.*\//, "", $1); print $1, $2, $3 }'
)"

needs=""
while read -r w1 w2 w3; do
  case "$w1" in
    docker) needs="$needs docker" ;;
    supabase) needs="$needs node docker" ;;
    npx)
      needs="$needs node"
      [ "$w2" = supabase ] && needs="$needs docker"
      ;;
    npm)
      needs="$needs node"
      if [ "$w2" = run ]; then
        case "$w3" in e2e* | db:test | gen:types) needs="$needs docker" ;; esac
      fi
      ;;
    node | vitest | tsc | eslint | prettier | playwright | wrangler) needs="$needs node" ;;
  esac
done <<< "$words"
[ -n "$needs" ] || exit 0

# Only a PID that still names the worker counts (the file can outlive it).
worker_alive() {
  local pid
  pid="$(cat "$state_dir/worker.pid" 2> /dev/null)"
  [ -n "$pid" ] && tr '\0' ' ' 2> /dev/null < "/proc/$pid/cmdline" | grep -q session-setup-worker
}

deadline=$((SECONDS + 280))
for step in node docker; do
  case " $needs " in *" $step "*) ;; *) continue ;; esac
  [ -f "$state_dir/$step" ] || continue

  # An empty read (file being replaced) counts as still running.
  status="$(cat "$state_dir/$step" 2> /dev/null)"
  while { [ "$status" = running ] || [ -z "$status" ]; } && worker_alive && [ "$SECONDS" -lt "$deadline" ]; do
    sleep 1
    status="$(cat "$state_dir/$step" 2> /dev/null)"
  done

  if [ "$status" = running ] || [ -z "$status" ]; then
    if worker_alive; then
      echo "Session setup ($step) is still running after 280s; run the command again to keep waiting, or see $state_dir/log." >&2
      exit 2
    fi
    status=failed # worker killed before recording an outcome
  fi

  if [ "$status" = failed ] && [ ! -e "$state_dir/$step.reported" ]; then
    # Block once with the reason, then let commands through so they can be
    # used to investigate or retry the setup by hand.
    touch "$state_dir/$step.reported"
    {
      echo "Session setup step '$step' failed; this command was held back once, later ones run normally."
      echo "Last lines of $state_dir/log:"
      tail -n 20 "$state_dir/log"
    } >&2
    exit 2
  fi
done
exit 0
