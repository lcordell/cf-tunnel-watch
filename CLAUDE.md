# cf-tunnel-watch

A Cloudflare Worker that monitors Cloudflare tunnel status and sends Telegram notifications on state changes.

## What it does

- Runs every minute via cron trigger
- Lists all tunnels for the configured Cloudflare account
- Checks each tunnel's connection status via Cloudflare API
- Persists last-known state in KV storage
- Sends a Telegram message only when a tunnel transitions between up/down states
- Also triggerable manually via HTTP GET `/run`

## Stack

- **Runtime**: Cloudflare Workers (vanilla JS, no npm dependencies)
- **Config/Deploy**: Wrangler CLI (`wrangler.toml`)
- **Storage**: Cloudflare KV (binding: `STATE`)
- **Notifications**: Telegram Bot API

## Project structure

```
worker.js       # All logic — cron handler, fetch handler, checkTunnelsAndNotify()
wrangler.toml   # Worker config: name, cron schedule, KV binding
```

## Required environment variables (secrets)

Set via `wrangler secret put <NAME>`:

| Variable | Description |
|---|---|
| `CF_API_TOKEN` | Cloudflare API token with tunnel read access |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `TG_BOT_TOKEN` | Telegram bot token |
| `TG_CHAT_ID` | Telegram chat/channel ID for notifications |

## Development & deployment

```bash
# Local dev (simulates cron + KV)
wrangler dev

# Deploy to Cloudflare
wrangler deploy

# Manually trigger a check (after deploy)
curl https://<worker-url>/run
```
