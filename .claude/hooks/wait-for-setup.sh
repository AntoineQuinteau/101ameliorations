#!/bin/bash
# PreToolUse guard (Bash): while session-setup-worker.sh is still running,
# holds back commands that need node_modules, Node or Docker. Other commands
# (reading files, git) go through immediately.
set -uo pipefail

state_dir=/tmp/claude-session-setup
status_file="$state_dir/status"
[ -f "$status_file" ] || exit 0

command="$(jq -r '.tool_input.command // ""')"
if ! grep -qE '(^|[^[:alnum:]_-])(npm|npx|node|docker|supabase|vitest|playwright|tsc|eslint|prettier|wrangler)([^[:alnum:]_-]|$)' <<< "$command"; then
  exit 0
fi

for _ in $(seq 1 280); do
  [ "$(cat "$status_file")" = running ] || break
  sleep 1
done

case "$(cat "$status_file")" in
  done | failed-reported)
    exit 0
    ;;
  failed)
    # Block once with the reason, then let commands through so they can be
    # used to investigate or retry the setup by hand.
    echo failed-reported > "$status_file"
    {
      echo "Session setup (npm install / Docker) failed. Last lines of $state_dir/log:"
      tail -n 20 "$state_dir/log"
    } >&2
    exit 2
    ;;
  *)
    echo "Session setup is still running after 280s; see $state_dir/log." >&2
    exit 2
    ;;
esac
