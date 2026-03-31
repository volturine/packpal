#!/usr/bin/env bash
set -euo pipefail

# loop-list.sh — List all active OpenCode loops.
#
# Usage:
#   loop-list.sh           List active loops
#   loop-list.sh --all     Include stopped/stale loops

SHOW_ALL=false
[[ "${1:-}" == "--all" ]] && SHOW_ALL=true

found=0
seen_names=" "

get_process_start_time() {
    ps -o lstart= -p "$1" 2>/dev/null | sed 's/^ *//'
}

process_matches_identity() {
    local pid="$1"
    local expected_start="$2"
    local current_start
    if [[ -z "$pid" || -z "$expected_start" ]]; then
        return 1
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
        return 1
    fi
    current_start=$(get_process_start_time "$pid")
    [[ -n "$current_start" && "$current_start" == "$expected_start" ]]
}

read_lock_identity() {
    local lock_dir="$1"
    local pid=""
    local started=""
    if [[ -f "$lock_dir/owner" ]]; then
        pid=$(sed -n '1p' "$lock_dir/owner" 2>/dev/null || true)
        started=$(sed -n '2p' "$lock_dir/owner" 2>/dev/null || true)
    fi
    printf '%s\n%s\n' "$pid" "$started"
}

extract_timestamp() {
    sed -n 's/^\[\([^]]*\)\].*/\1/p' | tail -1
}

for pid_file in /tmp/opencode-loop_*.pid; do
    [[ -f "$pid_file" ]] || continue

    name=$(basename "$pid_file" .pid)
    name="${name#opencode-loop_}"
    lock_dir="/tmp/opencode-loop_${name}.lock"
    pid=$(sed -n '1p' "$pid_file" 2>/dev/null || true)
    expected_start=$(sed -n '2p' "$pid_file" 2>/dev/null || true)
    log_file="/tmp/opencode-loop_${name}.log"
    running=false

    if process_matches_identity "$pid" "$expected_start"; then
        running=true
    fi

    if ! $running && [[ -d "$lock_dir" ]]; then
        mapfile -t lock_identity < <(read_lock_identity "$lock_dir")
        lock_pid="${lock_identity[0]:-}"
        lock_started="${lock_identity[1]:-}"
        if process_matches_identity "$lock_pid" "$lock_started"; then
            running=true
            found=$((found + 1))
            echo "[STARTING (lock only)] ${name}"
            [[ -n "$lock_pid" ]] && echo "  PID:       ${lock_pid}"
            echo "  Lock:      ${lock_dir}"
            echo ""
            seen_names+="${name} "
            continue
        fi
    fi

    if ! $running && ! $SHOW_ALL; then
        continue
    fi

    found=$((found + 1))

    if $running; then
        status="RUNNING"
    else
        status="STOPPED (stale PID file)"
    fi

    # Extract info from log file if available
    started=""
    last_run=""
    if [[ -f "$log_file" ]]; then
        started=$(grep "Loop started:" "$log_file" 2>/dev/null | extract_timestamp || true)
        last_run=$(grep -E "Run #[0-9]+ complete|Run failed|Immediate run|Immediate run failed|Max runs reached|Max consecutive errors reached|Loop stopped" "$log_file" 2>/dev/null | extract_timestamp || true)
    fi

    echo "[$status] ${name}"
    echo "  PID:       ${pid}"
    [[ -n "$started" ]] && echo "  Started:   ${started}"
    [[ -n "$last_run" ]] && echo "  Last run:  ${last_run}"
    echo "  Log:       ${log_file}"
    echo ""
    seen_names+="${name} "
done

for lock_dir in /tmp/opencode-loop_*.lock; do
    [[ -d "$lock_dir" ]] || continue

    name=$(basename "$lock_dir" .lock)
    name="${name#opencode-loop_}"
    if [[ "$seen_names" == *" ${name} "* ]]; then
        continue
    fi
    pid_file="/tmp/opencode-loop_${name}.pid"
    if [[ -f "$pid_file" ]]; then
        pid=$(sed -n '1p' "$pid_file" 2>/dev/null || true)
        expected_start=$(sed -n '2p' "$pid_file" 2>/dev/null || true)
        if process_matches_identity "$pid" "$expected_start"; then
            continue
        fi
    fi

    mapfile -t lock_identity < <(read_lock_identity "$lock_dir")
    pid="${lock_identity[0]:-}"
    expected_start="${lock_identity[1]:-}"

    if process_matches_identity "$pid" "$expected_start"; then
        running=true
        status="STARTING (lock only)"
    else
        running=false
        status="STOPPED (stale lock)"
    fi

    if ! $running && ! $SHOW_ALL; then
        continue
    fi

    found=$((found + 1))
    echo "[$status] ${name}"
    [[ -n "$pid" ]] && echo "  PID:       ${pid}"
    echo "  Lock:      ${lock_dir}"
    echo ""
done

if [[ "$found" -eq 0 ]]; then
    if $SHOW_ALL; then
        echo "No loops found"
    else
        echo "No active loops"
    fi
fi
