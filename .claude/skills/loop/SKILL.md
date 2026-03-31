---
name: loop
description: Schedule recurring tasks that inject prompts into the running OpenCode session via the server API. Use when the user wants to run something repeatedly on an interval, poll for status, babysit a process, or set up a recurring check. Trigger on requests like "check every 5 minutes", "keep running tests", "poll the deploy", "loop this command", or "run repeatedly".
---

# /loop — Schedule a Recurring Prompt

OpenCode's built-in `/loop` command is backed by the cron scheduler when available. This skill directory also ships a shell fallback in `scripts/` for environments that need to inject prompts into a live OpenCode session.

When you are using this skill directory directly, parse the user's input into `[interval] <task>` and schedule it using `${CLAUDE_SKILL_DIR}/scripts/loop.sh`.

## Parsing (in priority order)

1. **Leading token**: if the first whitespace-delimited token matches `^\d+[smhd]$` (e.g. `5m`, `2h`), that's the interval; the rest is the prompt.
2. **Trailing "every" clause**: otherwise, if the input ends with `every <N><unit>` or `every <N> <unit-word>` (e.g. `every 20m`, `every 5 minutes`, `every 2 hours`), extract that as the interval and strip it from the prompt. Only match when what follows "every" is a time expression — `check every PR` has no interval.
3. **Default**: otherwise, interval is `10m` and the entire input is the prompt.

If the resulting prompt is empty, show usage and stop.

**Examples:**

- `5m /babysit-prs` → interval `5m`, prompt `/babysit-prs` (rule 1)
- `check the deploy every 20m` → interval `20m`, prompt `check the deploy` (rule 2)
- `run tests every 5 minutes` → interval `5m`, prompt `run tests` (rule 2)
- `check the deploy` → interval `10m`, prompt `check the deploy` (rule 3)
- `check every PR` → interval `10m`, prompt `check every PR` (rule 3 — "every" not followed by time)

## Interval Conversion

| Suffix | Meaning | Seconds    |
| ------ | ------- | ---------- |
| `s`    | seconds | N          |
| `m`    | minutes | N \* 60    |
| `h`    | hours   | N \* 3600  |
| `d`    | days    | N \* 86400 |

## Bundled Scripts

All scripts are in `scripts/` relative to this skill. They require `curl`, `jq`, and `ps`. The tmux fallback also requires `tmux`.

### `scripts/loop.sh` — Main loop runner

Runs a background process that sends the prompt to the OpenCode session on each interval.

```
scripts/loop.sh --prompt "TEXT" --interval SECS [options]
```

| Flag             | Description                                              | Default                              |
| ---------------- | -------------------------------------------------------- | ------------------------------------ |
| `--prompt`       | Prompt text to send each iteration                       | (required)                           |
| `--interval`     | Seconds between runs                                     | (required)                           |
| `--host`         | Server host                                              | `127.0.0.1` / `$OPENCODE_HOST`       |
| `--port`         | Server port                                              | `4096` / `$OPENCODE_PORT`            |
| `--token`        | Bearer token for authenticated servers                   | `$OPENCODE_TOKEN`                    |
| `--session`      | Target session ID (auto-detects if omitted)              | latest session                       |
| `--name`         | Loop name for PID/log files                              | explicit name or derived prompt name |
| `--sync`         | Use synchronous `/message` endpoint (waits for response) | off                                  |
| `--no-immediate` | Don't fire the first prompt immediately                  | fires immediately                    |
| `--max-runs`     | Stop after N runs (0 = unlimited)                        | `0`                                  |
| `--max-errors`   | Stop after N consecutive errors                          | `10`                                 |
| `--max-age`      | Stop after N wall-clock seconds (0 = unlimited)          | `259200` (3 days)                    |
| `--foreground`   | Run in foreground instead of self-daemonizing            | off (daemonizes by default)          |

Safety behavior (always active, no flags needed):

- **Wall-clock expiry**: loops auto-terminate after `--max-age` seconds (default 3 days) to prevent forgotten zombies.
- **Server health recheck**: every 20 iterations the loop verifies the OpenCode server is still healthy. Failures count toward `--max-errors`.
- **Session liveness**: every 20 iterations the loop confirms the target session still exists. If the session was closed, failures accumulate and the loop stops after `--max-errors` consecutive failures.
- **Self-daemonize**: the script forks to background by default so the calling agent is never blocked.

Transport behavior:

- First tries the local OpenCode HTTP server API.
- If the server is unavailable, falls back to injecting the prompt into an active `opencode` tmux pane via `tmux send-keys`.
- You can force a specific tmux pane with `OPENCODE_LOOP_TMUX_PANE=%<pane-id>`.

### `scripts/loop-stop.sh` — Stop loops

```
${CLAUDE_SKILL_DIR}/scripts/loop-stop.sh <name>        # Stop by name
${CLAUDE_SKILL_DIR}/scripts/loop-stop.sh --pid <PID>   # Stop by PID
${CLAUDE_SKILL_DIR}/scripts/loop-stop.sh --all         # Stop all loops
```

### `scripts/loop-list.sh` — List active loops

```
${CLAUDE_SKILL_DIR}/scripts/loop-list.sh               # Active loops only
${CLAUDE_SKILL_DIR}/scripts/loop-list.sh --all         # Include stale entries
```

## Action

1. Parse interval and prompt from the user's input using the rules above
2. Convert the interval to seconds
3. Run the loop script (it self-daemonizes and returns immediately):

```bash
"${CLAUDE_SKILL_DIR}/scripts/loop.sh" \
    --prompt "<parsed prompt>" \
    --interval <seconds> \
    --name "<loop-name>"
```

4. The script prints the loop name, PID, log path, and stop command. Relay this to the user.
5. Do not also execute the parsed prompt manually after starting `loop.sh` unless you passed `--no-immediate`, because the script fires once immediately by default.

## Modes

- **Default (async)**: fire-and-forget via `POST /session/:id/prompt_async`. Best for most use cases.
- **Sync (`--sync`)**: waits for each response via `POST /session/:id/message`. Use when ordering matters — each prompt completes before the next interval starts.
- **Tmux fallback**: if no server API is reachable, the script injects the prompt into the best matching live `opencode` tmux pane. In tmux mode, `--sync` is ignored because `send-keys` is fire-and-forget.

## Scope

- Treat the built-in bundled `/loop` command as the production path for OpenCode.
- Treat these shell scripts as a local fallback for environments where the direct session API is available or where the user is running `opencode` inside tmux without `serve` enabled.

## Fallback

If the OpenCode server is not reachable:

- Try the tmux fallback automatically if an active `opencode` pane exists.
- If no tmux `opencode` pane exists either, tell the user and suggest:
- Start OpenCode first, or
- Use a manual shell approach: `watch -n <secs> '<command>'` for simple commands
