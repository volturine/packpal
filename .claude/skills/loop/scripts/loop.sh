#!/usr/bin/env bash
set -euo pipefail

# loop.sh — Inject a prompt into an OpenCode session on a recurring interval.
#
# Usage:
#   loop.sh --prompt "check the deploy" --interval 300 [options]
#   loop.sh --prompt "run tests" --interval 600 --session <id> --port 4096
#
# Required:
#   --prompt   TEXT    The prompt to send each iteration
#   --interval SECS   Interval between runs in seconds
#
# Optional:
#   --host     HOST   OpenCode server host (default: 127.0.0.1)
#   --port     PORT   OpenCode server port (default: 4096, or OPENCODE_PORT env)
#   --token    TOKEN  Bearer token for authenticated servers
#   --session  ID     Session ID to target (default: auto-detect latest)
#   --name     NAME   Human-readable name for this loop (default: derived from prompt)
#   --sync            Use synchronous /message endpoint instead of prompt_async (waits for response)
#   --no-immediate    Don't execute the first prompt immediately
#   --max-runs N      Stop after N runs (default: unlimited)
#   --max-errors N    Stop after N consecutive errors (default: 10)
#
# Environment:
#   OPENCODE_PORT     Server port override
#   OPENCODE_HOST     Server host override
#   OPENCODE_TOKEN    Bearer token override
#   OPENCODE_LOOP_CONNECT_TIMEOUT  Curl connect timeout in seconds (default: 5)
#   OPENCODE_LOOP_MAX_TIME         Curl total timeout in seconds (default: 30)

PROMPT=""
INTERVAL=""
HOST="${OPENCODE_HOST:-127.0.0.1}"
PORT="${OPENCODE_PORT:-4096}"
TOKEN="${OPENCODE_TOKEN:-}"
SESSION_ID=""
LOOP_NAME=""
SYNC_MODE=false
IMMEDIATE=true
MAX_RUNS=0
MAX_ERRORS=10
MAX_AGE=259200  # 3 days in seconds
CONNECT_TIMEOUT="${OPENCODE_LOOP_CONNECT_TIMEOUT:-5}"
MAX_TIME="${OPENCODE_LOOP_MAX_TIME:-30}"
FOREGROUND=false
HEALTH_CHECK_INTERVAL=20  # re-check server/session liveness every N iterations
TRANSPORT="server"
TMUX_TARGET_PANE="${OPENCODE_LOOP_TMUX_PANE:-}"

# --- Argument parsing ---

usage() {
    cat <<'USAGE'
Usage: loop.sh --prompt "TEXT" --interval SECS [options]

Required:
  --prompt   TEXT    Prompt to send each iteration
  --interval SECS   Interval between runs in seconds

Optional:
  --host     HOST   Server host (default: 127.0.0.1 / $OPENCODE_HOST)
  --port     PORT   Server port (default: 4096 / $OPENCODE_PORT)
  --token    TOKEN  Bearer token for authenticated servers
  --session  ID     Target session ID (default: auto-detect)
  --name     NAME   Loop name for PID/log files (default: derived)
  --sync            Wait for each response before sleeping
  --no-immediate    Skip the first immediate execution
  --max-runs N      Stop after N runs (0 = unlimited)
  --max-errors N    Stop after N consecutive errors (default: 10)
  --max-age SECS    Stop after SECS wall-clock seconds (default: 259200 = 3 days, 0 = unlimited)
  --foreground      Run in the foreground instead of self-daemonizing
USAGE
    exit 1
}

sanitize_loop_name() {
    local raw="$1"
    local sanitized checksum base
    sanitized=$(printf '%s' "$raw" | tr ' ' '-' | tr -cd '[:alnum:]-')
    set -- $(printf '%s' "$raw" | cksum)
    checksum="$1"
    base="${sanitized:-loop}"
    base=$(printf '%s' "$base" | head -c 24)
    printf '%s\n' "${base}-${checksum}"
}

sanitize_explicit_loop_name() {
    local raw="$1"
    local sanitized
    sanitized=$(printf '%s' "$raw" | tr ' ' '-' | tr -cd '[:alnum:]-')
    sanitized=$(printf '%s' "$sanitized" | head -c 40)
    printf '%s\n' "${sanitized:-loop}"
}

detect_tmux_target_pane() {
    local pane
    local line
    local best_key=""
    local best_pane=""
    local session_attached session_last_attached window_active pane_active pane_id pane_current_command

    if ! command -v tmux &>/dev/null; then
        return 1
    fi

    if [[ -n "$TMUX_TARGET_PANE" ]]; then
        while IFS='|' read -r pane_id pane_current_command; do
            if [[ "$pane_id" == "$TMUX_TARGET_PANE" && "$pane_current_command" == "opencode" ]]; then
                printf '%s\n' "$pane_id"
                return 0
            fi
        done < <(tmux list-panes -a -F '#{pane_id}|#{pane_current_command}' 2>/dev/null)
        return 1
    fi

    while IFS='|' read -r session_attached session_last_attached window_active pane_active pane_id pane_current_command; do
        [[ "$pane_current_command" == "opencode" ]] || continue
        printf -v line '%01d:%015d:%01d:%01d' "$session_attached" "$session_last_attached" "$window_active" "$pane_active"
        if [[ -z "$best_key" || "$line" > "$best_key" ]]; then
            best_key="$line"
            best_pane="$pane_id"
        fi
    done < <(tmux list-panes -a -F '#{session_attached}|#{session_last_attached}|#{window_active}|#{pane_active}|#{pane_id}|#{pane_current_command}' 2>/dev/null)

    [[ -n "$best_pane" ]] || return 1
    printf '%s\n' "$best_pane"
}

require_positive_integer() {
    local label="$1"
    local value="$2"
    if [[ ! "$value" =~ ^[0-9]+$ || "$value" -le 0 ]]; then
        echo "Error: ${label} must be a positive integer" >&2
        exit 1
    fi
}

require_non_negative_integer() {
    local label="$1"
    local value="$2"
    if [[ ! "$value" =~ ^[0-9]+$ ]]; then
        echo "Error: ${label} must be a non-negative integer" >&2
        exit 1
    fi
}

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

lock_is_older_than() {
    local seconds="$1"
    local modified_at now
    modified_at=$(stat -c %Y "$LOCK_DIR" 2>/dev/null || true)
    now=$(date +%s)
    if [[ -z "$modified_at" || -z "$now" ]]; then
        return 1
    fi
    [[ $((now - modified_at)) -ge "$seconds" ]]
}

read_lock_identity() {
    local pid=""
    local started=""
    if [[ -f "$LOCK_OWNER_FILE" ]]; then
        pid=$(sed -n '1p' "$LOCK_OWNER_FILE" 2>/dev/null || true)
        started=$(sed -n '2p' "$LOCK_OWNER_FILE" 2>/dev/null || true)
    fi
    printf '%s\n%s\n' "$pid" "$started"
}

clear_stale_lock_if_needed() {
    local lock_pid lock_started
    mapfile -t lock_identity < <(read_lock_identity)
    lock_pid="${lock_identity[0]:-}"
    lock_started="${lock_identity[1]:-}"

    if [[ -z "$lock_pid" && -z "$lock_started" ]]; then
        if lock_is_older_than 5; then
            rm -rf "$LOCK_DIR"
            return 0
        fi
        return 1
    fi

    if ! process_matches_identity "$lock_pid" "$lock_started"; then
        rm -rf "$LOCK_DIR"
        return 0
    fi

    return 1
}

ORIGINAL_ARGS=("$@")

while [[ $# -gt 0 ]]; do
    case "$1" in
        --prompt)    PROMPT="$2"; shift 2 ;;
        --interval)  INTERVAL="$2"; shift 2 ;;
        --host)      HOST="$2"; shift 2 ;;
        --port)      PORT="$2"; shift 2 ;;
        --token)     TOKEN="$2"; shift 2 ;;
        --session)   SESSION_ID="$2"; shift 2 ;;
        --name)      LOOP_NAME="$2"; shift 2 ;;
        --sync)      SYNC_MODE=true; shift ;;
        --foreground|--fg) FOREGROUND=true; shift ;;
        --no-immediate) IMMEDIATE=false; shift ;;
        --max-runs)  MAX_RUNS="$2"; shift 2 ;;
        --max-errors) MAX_ERRORS="$2"; shift 2 ;;
        --max-age)   MAX_AGE="$2"; shift 2 ;;
        -h|--help)   usage ;;
        *)           echo "Unknown option: $1"; usage ;;
    esac
done

if [[ -z "$PROMPT" || -z "$INTERVAL" ]]; then
    echo "Error: --prompt and --interval are required"
    usage
fi

require_positive_integer "--interval" "$INTERVAL"
require_non_negative_integer "--max-runs" "$MAX_RUNS"
require_non_negative_integer "--max-errors" "$MAX_ERRORS"
require_non_negative_integer "--max-age" "$MAX_AGE"
require_positive_integer "OPENCODE_LOOP_CONNECT_TIMEOUT" "$CONNECT_TIMEOUT"
require_positive_integer "OPENCODE_LOOP_MAX_TIME" "$MAX_TIME"

# --- Derived values ---

BASE="http://${HOST}:${PORT}"

if [[ -z "$LOOP_NAME" ]]; then
    LOOP_NAME=$(sanitize_loop_name "$PROMPT")
else
    LOOP_NAME=$(sanitize_explicit_loop_name "$LOOP_NAME")
fi

PID_FILE="/tmp/opencode-loop_${LOOP_NAME}.pid"
LOG_FILE="/tmp/opencode-loop_${LOOP_NAME}.log"
LOCK_DIR="/tmp/opencode-loop_${LOOP_NAME}.lock"
LOCK_OWNER_FILE="${LOCK_DIR}/owner"

# --- Self-daemonize (default) ---
# When not already a daemon and not in --foreground mode, re-exec as a fully
# detached background process so the calling shell (e.g. an agent's Bash tool)
# returns immediately instead of blocking on the infinite loop.

if [[ "${__LOOP_DAEMONIZED:-}" != "1" && "$FOREGROUND" != "true" ]]; then
    export __LOOP_DAEMONIZED=1
    nohup "$0" "${ORIGINAL_ARGS[@]}" </dev/null >>"$LOG_FILE" 2>&1 &
    CHILD_PID=$!
    disown "$CHILD_PID" 2>/dev/null || true

    # Brief wait to catch immediate startup failures
    sleep 0.3
    if ! kill -0 "$CHILD_PID" 2>/dev/null; then
        echo "Error: Loop failed to start. Check ${LOG_FILE}" >&2
        exit 1
    fi

    echo "Loop '${LOOP_NAME}' started (PID: ${CHILD_PID})"
    echo "  Log: ${LOG_FILE}"
    echo "  Stop: $(dirname "$0")/loop-stop.sh ${LOOP_NAME}"
    exit 0
fi

cleanup_lock_dir() {
    rm -rf "$LOCK_DIR"
}

AUTH_ARGS=()
if [[ -n "$TOKEN" ]]; then
    AUTH_ARGS=(-H "Authorization: Bearer ${TOKEN}")
fi

CURL_BASE_ARGS=(
    --silent
    --show-error
    --fail
    --connect-timeout "$CONNECT_TIMEOUT"
    --max-time "$MAX_TIME"
)

# --- Dependency check ---

for cmd in curl jq ps mkdir cksum stat date; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "Error: '$cmd' is required but not found"
        exit 1
    fi
done

# --- Server detection ---

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    if ! clear_stale_lock_if_needed || ! mkdir "$LOCK_DIR" 2>/dev/null; then
        echo "Error: Loop '${LOOP_NAME}' is already starting or running"
        echo "  Stop it with: $(dirname "$0")/loop-stop.sh ${LOOP_NAME}"
        exit 1
    fi
fi

PROCESS_START=$(get_process_start_time "$$")
printf '%s\n%s\n' "$$" "$PROCESS_START" > "$LOCK_OWNER_FILE"

trap cleanup_lock_dir EXIT

log "Loop started: prompt='${PROMPT}', interval=${INTERVAL}s, name=${LOOP_NAME}"
log "Server target: ${BASE}"

HEALTH=$(curl "${CURL_BASE_ARGS[@]}" "${AUTH_ARGS[@]}" "${BASE}/global/health" 2>/dev/null || true)
if ! echo "$HEALTH" | jq -e '.healthy == true' &>/dev/null; then
    TMUX_TARGET_PANE=$(detect_tmux_target_pane || true)
    if [[ -n "$TMUX_TARGET_PANE" ]]; then
        TRANSPORT="tmux"
        log "OpenCode server not reachable at ${BASE}; falling back to tmux pane ${TMUX_TARGET_PANE}"
    else
        echo "Error: OpenCode server not reachable at ${BASE}"
        echo "  - Is OpenCode running? (opencode or opencode serve)"
        echo "  - Try: --host <host> --port <port>"
        echo "  - Or set OPENCODE_PORT / OPENCODE_HOST env vars"
        echo "  - If auth is required, pass --token or set OPENCODE_TOKEN"
        echo "  - Or run inside tmux with an active opencode pane"
        exit 1
    fi
else
    VERSION=$(echo "$HEALTH" | jq -r '.version // "unknown"')
    log "Server healthy (version: ${VERSION})"
fi

# --- Session detection ---

if [[ "$TRANSPORT" == "server" && -z "$SESSION_ID" ]]; then
    log "Auto-detecting session..."
    SESSIONS=$(curl "${CURL_BASE_ARGS[@]}" "${AUTH_ARGS[@]}" "${BASE}/session" 2>/dev/null || true)
    if [[ -z "$SESSIONS" ]]; then
        echo "Error: Could not list sessions"
        exit 1
    fi

    SESSION_ID=$(echo "$SESSIONS" | jq -r '.[0].id // empty')
    if [[ -z "$SESSION_ID" ]]; then
        echo "Error: No sessions found. Open a session in OpenCode first."
        exit 1
    fi

    SESSION_TITLE=$(echo "$SESSIONS" | jq -r '.[0].title // "untitled"')
    log "Using session: ${SESSION_ID} (${SESSION_TITLE})"
elif [[ "$TRANSPORT" == "server" ]]; then
    log "Using provided session: ${SESSION_ID}"
else
    log "Using tmux transport via pane ${TMUX_TARGET_PANE}"
fi

# --- PID management ---

if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(sed -n '1p' "$PID_FILE" 2>/dev/null || true)
    OLD_START=$(sed -n '2p' "$PID_FILE" 2>/dev/null || true)
    if process_matches_identity "$OLD_PID" "$OLD_START"; then
        echo "Error: Loop '${LOOP_NAME}' already running (PID ${OLD_PID})"
        echo "  Stop it with: kill ${OLD_PID}"
        echo "  Or: $(dirname "$0")/loop-stop.sh ${LOOP_NAME}"
        exit 1
    fi
    rm -f "$PID_FILE"
fi

PROCESS_START=$(get_process_start_time "$$")
printf '%s\n%s\n' "$$" "$PROCESS_START" > "$PID_FILE"
log "PID $$ written to ${PID_FILE}"

# --- Cleanup handler ---

cleanup_pid_file() {
    local pid_in_file=""
    if [[ -f "$PID_FILE" ]]; then
        pid_in_file=$(sed -n '1p' "$PID_FILE" 2>/dev/null || true)
        if [[ "$pid_in_file" == "$$" ]]; then
            rm -f "$PID_FILE"
        fi
    fi
    cleanup_lock_dir
}

handle_signal() {
    log "Loop stopped (signal received)"
    exit 0
}

trap cleanup_pid_file EXIT
trap handle_signal SIGINT SIGTERM

# --- Send prompt function ---

send_prompt() {
    local http_code body

    if [[ "$TRANSPORT" == "tmux" ]]; then
        if tmux send-keys -t "$TMUX_TARGET_PANE" -l -- "$PROMPT" && tmux send-keys -t "$TMUX_TARGET_PANE" Enter; then
            log "Prompt sent via tmux to ${TMUX_TARGET_PANE}"
            return 0
        else
            log "WARN: tmux send-keys failed for pane ${TMUX_TARGET_PANE}"
            return 1
        fi
    fi

    if $SYNC_MODE; then
        # Synchronous: POST to /session/:id/message, wait for response
        body=$(curl "${CURL_BASE_ARGS[@]}" "${AUTH_ARGS[@]}" -w "\n%{http_code}" \
            -X POST "${BASE}/session/${SESSION_ID}/message" \
            -H "Content-Type: application/json" \
            -d "$(jq -n --arg p "$PROMPT" '{parts: [{type: "text", text: $p}]}')" 2>/dev/null || echo -e "\n000")

        http_code=$(echo "$body" | tail -1)
        body=$(echo "$body" | sed '$d')

        if [[ "$http_code" == "200" ]]; then
            log "Prompt sent (sync), response received"
            return 0
        else
            log "WARN: message returned HTTP ${http_code}"
            return 1
        fi

    else
        # Default: async fire-and-forget
        http_code=$(curl "${CURL_BASE_ARGS[@]}" "${AUTH_ARGS[@]}" -o /dev/null -w "%{http_code}" \
            -X POST "${BASE}/session/${SESSION_ID}/prompt_async" \
            -H "Content-Type: application/json" \
            -d "$(jq -n --arg p "$PROMPT" '{parts: [{type: "text", text: $p}]}')" 2>/dev/null || echo "000")

        if [[ "$http_code" == "204" || "$http_code" == "200" ]]; then
            log "Prompt sent (async, HTTP ${http_code})"
            return 0
        else
            log "WARN: prompt_async returned HTTP ${http_code}"
            return 1
        fi
    fi
}

# --- Liveness checks ---

LOOP_START_EPOCH=$(date +%s)

check_max_age() {
    if [[ "$MAX_AGE" -gt 0 ]]; then
        local now elapsed
        now=$(date +%s)
        elapsed=$((now - LOOP_START_EPOCH))
        if [[ "$elapsed" -ge "$MAX_AGE" ]]; then
            log "Max age reached (${MAX_AGE}s / $(( MAX_AGE / 86400 ))d). Stopping."
            exit 0
        fi
    fi
}

check_server_health() {
    if [[ "$TRANSPORT" != "server" ]]; then
        return 0
    fi
    local health
    health=$(curl "${CURL_BASE_ARGS[@]}" "${AUTH_ARGS[@]}" "${BASE}/global/health" 2>/dev/null || true)
    if ! echo "$health" | jq -e '.healthy == true' &>/dev/null; then
        log "WARN: Server health check failed"
        return 1
    fi
    return 0
}

check_session_alive() {
    if [[ "$TRANSPORT" != "server" || -z "$SESSION_ID" ]]; then
        return 0
    fi
    local sessions session_exists
    sessions=$(curl "${CURL_BASE_ARGS[@]}" "${AUTH_ARGS[@]}" "${BASE}/session" 2>/dev/null || true)
    if [[ -z "$sessions" ]]; then
        log "WARN: Could not list sessions for liveness check"
        return 1
    fi
    session_exists=$(echo "$sessions" | jq -r --arg sid "$SESSION_ID" '[.[] | select(.id == $sid)] | length' 2>/dev/null || echo "0")
    if [[ "$session_exists" == "0" ]]; then
        log "WARN: Target session ${SESSION_ID} no longer exists"
        return 1
    fi
    return 0
}

# Runs server + session liveness checks. Returns 1 if the loop should stop.
run_liveness_checks() {
    if ! check_server_health; then
        return 1
    fi
    if ! check_session_alive; then
        return 1
    fi
    return 0
}

# --- Main loop ---

RUN_COUNT=0
ERROR_COUNT=0
ITERATIONS_SINCE_HEALTH_CHECK=0

if [[ "$MAX_AGE" -gt 0 ]]; then
    log "=== Loop active: every ${INTERVAL}s, max-age ${MAX_AGE}s ($(( MAX_AGE / 86400 ))d) ==="
else
    log "=== Loop active: every ${INTERVAL}s, no max-age ==="
fi
log "Stop with: kill $$ or $(dirname "$0")/loop-stop.sh ${LOOP_NAME}"

if $IMMEDIATE; then
    log "--- Immediate run ---"
    if send_prompt; then
        RUN_COUNT=$((RUN_COUNT + 1))
        ERROR_COUNT=0
    else
        ERROR_COUNT=$((ERROR_COUNT + 1))
        log "Immediate run failed (error count: ${ERROR_COUNT})"
        if [[ "$MAX_ERRORS" -gt 0 && "$ERROR_COUNT" -ge "$MAX_ERRORS" ]]; then
            log "Max consecutive errors reached (${MAX_ERRORS}). Stopping."
            exit 1
        fi
    fi
fi

if [[ "$MAX_RUNS" -gt 0 && "$RUN_COUNT" -ge "$MAX_RUNS" ]]; then
    log "Max runs reached (${MAX_RUNS}). Stopping."
    exit 0
fi

while true; do
    sleep "$INTERVAL"

    # Wall-clock expiry
    check_max_age

    # Periodic liveness: server health + session existence
    ITERATIONS_SINCE_HEALTH_CHECK=$((ITERATIONS_SINCE_HEALTH_CHECK + 1))
    if [[ "$ITERATIONS_SINCE_HEALTH_CHECK" -ge "$HEALTH_CHECK_INTERVAL" ]]; then
        ITERATIONS_SINCE_HEALTH_CHECK=0
        if ! run_liveness_checks; then
            ERROR_COUNT=$((ERROR_COUNT + 1))
            log "Liveness check failed (consecutive errors: ${ERROR_COUNT}/${MAX_ERRORS})"
            if [[ "$MAX_ERRORS" -gt 0 && "$ERROR_COUNT" -ge "$MAX_ERRORS" ]]; then
                log "Max consecutive errors reached (${MAX_ERRORS}). Stopping."
                exit 1
            fi
            continue
        fi
    fi

    log "--- Run #$((RUN_COUNT + 1)) ---"

    if send_prompt; then
        RUN_COUNT=$((RUN_COUNT + 1))
        ERROR_COUNT=0
        log "Run #${RUN_COUNT} complete"
    else
        ERROR_COUNT=$((ERROR_COUNT + 1))
        log "Run failed (consecutive errors: ${ERROR_COUNT}/${MAX_ERRORS})"

        if [[ "$MAX_ERRORS" -gt 0 && "$ERROR_COUNT" -ge "$MAX_ERRORS" ]]; then
            log "Max consecutive errors reached (${MAX_ERRORS}). Stopping."
            exit 1
        fi
    fi

    if [[ "$MAX_RUNS" -gt 0 && "$RUN_COUNT" -ge "$MAX_RUNS" ]]; then
        log "Max runs reached (${MAX_RUNS}). Stopping."
        exit 0
    fi
done
