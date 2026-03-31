#!/usr/bin/env bash
set -euo pipefail

# loop-stop.sh — Stop a running loop by name or PID.
#
# Usage:
#   loop-stop.sh <name>       Stop loop by name
#   loop-stop.sh --pid <PID>  Stop loop by PID
#   loop-stop.sh --all        Stop all running loops

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

cleanup_pid_files_for_pid() {
    local pid="$1"
    for pid_file in /tmp/opencode-loop_*.pid; do
        [[ -f "$pid_file" ]] || continue
        local file_pid
        file_pid=$(sed -n '1p' "$pid_file" 2>/dev/null || true)
        if [[ "$file_pid" == "$pid" ]]; then
            rm -f "$pid_file"
        fi
    done
}

stop_by_name() {
    local name="$1"
    local pid_file="/tmp/opencode-loop_${name}.pid"
    local lock_dir="/tmp/opencode-loop_${name}.lock"
    local log_file="/tmp/opencode-loop_${name}.log"
    local lock_pid=""
    local lock_start=""

    finalize_stop() {
        local pid="$1"
        cleanup_pid_files_for_pid "$pid"
        rm -rf "$lock_dir"
        return 0
    }

    if [[ -d "$lock_dir" ]]; then
        mapfile -t lock_identity < <(read_lock_identity "$lock_dir")
        lock_pid="${lock_identity[0]:-}"
        lock_start="${lock_identity[1]:-}"
    fi

    if process_matches_identity "$lock_pid" "$lock_start"; then
        if [[ -f "$pid_file" ]]; then
            local pid
            local expected_start
            pid=$(sed -n '1p' "$pid_file" 2>/dev/null || true)
            expected_start=$(sed -n '2p' "$pid_file" 2>/dev/null || true)
            if process_matches_identity "$pid" "$expected_start"; then
                kill "$pid"
                echo "Stopped loop '${name}' (PID ${pid})"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopped by loop-stop.sh" >> "$log_file" 2>/dev/null || true
                sleep 1
                if ! process_matches_identity "$pid" "$expected_start"; then
                    finalize_stop "$pid"
                fi
                kill -0 "$pid" 2>/dev/null || finalize_stop "$pid"
                echo "Loop '${name}' did not exit after SIGTERM" >&2
                return 1
            fi
            rm -f "$pid_file"
        fi

        kill "$lock_pid"
        echo "Stopped starting loop '${name}' (PID ${lock_pid})"
        sleep 1
        if ! process_matches_identity "$lock_pid" "$lock_start"; then
            rm -rf "$lock_dir"
            return 0
        fi
        echo "Starting loop '${name}' did not exit after SIGTERM" >&2
        return 1
    fi

    if [[ ! -f "$pid_file" ]]; then
        if [[ -d "$lock_dir" ]]; then
            rm -rf "$lock_dir"
            echo "Removed stale lock for loop '${name}'"
            return 1
        fi
        echo "No loop '${name}' found (no PID file at ${pid_file})"
        return 1
    fi

    local pid
    local expected_start
    pid=$(sed -n '1p' "$pid_file" 2>/dev/null || true)
    expected_start=$(sed -n '2p' "$pid_file" 2>/dev/null || true)

    if process_matches_identity "$pid" "$expected_start"; then
        kill "$pid"
        echo "Stopped loop '${name}' (PID ${pid})"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopped by loop-stop.sh" >> "$log_file" 2>/dev/null || true
        sleep 1
        if ! process_matches_identity "$pid" "$expected_start"; then
            finalize_stop "$pid"
        else
            kill -0 "$pid" 2>/dev/null || finalize_stop "$pid"
            echo "Loop '${name}' did not exit after SIGTERM" >&2
            return 1
        fi
    else
        echo "Loop '${name}' not running (stale PID ${pid})"
        rm -f "$pid_file"
        rm -rf "$lock_dir"
        return 1
    fi
}

stop_by_pid() {
    local pid="$1"
    local matched=false
    for pid_file in /tmp/opencode-loop_*.pid; do
        [[ -f "$pid_file" ]] || continue
        local file_pid
        local expected_start
        local name
        file_pid=$(sed -n '1p' "$pid_file" 2>/dev/null || true)
        expected_start=$(sed -n '2p' "$pid_file" 2>/dev/null || true)
        if [[ "$file_pid" != "$pid" ]]; then
            continue
        fi
        matched=true
        name=$(basename "$pid_file" .pid)
        name="${name#opencode-loop_}"
        if process_matches_identity "$pid" "$expected_start"; then
            stop_by_name "$name"
            return $?
        fi
        rm -f "$pid_file"
        rm -rf "/tmp/opencode-loop_${name}.lock"
    done

    if $matched; then
        echo "PID ${pid} is not running"
        return 1
    fi

    for lock_dir in /tmp/opencode-loop_*.lock; do
        [[ -d "$lock_dir" ]] || continue
        local expected_start
        local name
        mapfile -t lock_identity < <(read_lock_identity "$lock_dir")
        file_pid="${lock_identity[0]:-}"
        expected_start="${lock_identity[1]:-}"
        if [[ "$file_pid" != "$pid" ]]; then
            continue
        fi
        matched=true
        name=$(basename "$lock_dir" .lock)
        name="${name#opencode-loop_}"
        if process_matches_identity "$pid" "$expected_start"; then
            stop_by_name "$name"
            return $?
        fi
        rm -rf "$lock_dir"
        echo "Removed stale lock for loop '${name}'"
        return 1
    done

    if $matched; then
        echo "PID ${pid} is not running"
        return 1
    fi

    if kill -0 "$pid" 2>/dev/null; then
        echo "Refusing to stop PID ${pid}: no matching loop metadata found" >&2
        return 1
    else
        echo "PID ${pid} is not running"
        cleanup_pid_files_for_pid "$pid"
        return 1
    fi
}

stop_all() {
    local found=0
    local seen_names=" "
    for pid_file in /tmp/opencode-loop_*.pid; do
        [[ -f "$pid_file" ]] || continue
        local name
        name=$(basename "$pid_file" .pid)
        name="${name#opencode-loop_}"
        seen_names+="${name} "
        stop_by_name "$name" && found=$((found + 1)) || true
    done

    for lock_dir in /tmp/opencode-loop_*.lock; do
        [[ -d "$lock_dir" ]] || continue
        local name
        name=$(basename "$lock_dir" .lock)
        name="${name#opencode-loop_}"
        if [[ "$seen_names" == *" ${name} "* ]]; then
            continue
        fi
        stop_by_name "$name" && found=$((found + 1)) || true
    done

    if [[ "$found" -eq 0 ]]; then
        echo "No active loops found"
    else
        echo "Stopped ${found} loop(s)"
    fi
}

# --- Main ---

case "${1:-}" in
    --all)
        stop_all
        ;;
    --pid)
        if [[ -z "${2:-}" ]]; then
            echo "Usage: loop-stop.sh --pid <PID>"
            exit 1
        fi
        stop_by_pid "$2"
        ;;
    -h|--help|"")
        cat <<'USAGE'
Usage:
  loop-stop.sh <name>       Stop loop by name
  loop-stop.sh --pid <PID>  Stop loop by PID
  loop-stop.sh --all        Stop all running loops
USAGE
        exit 0
        ;;
    *)
        stop_by_name "$1"
        ;;
esac
