# 🇩🇪 Vocab

A personal German vocabulary trainer: text a word to a Telegram bot, watch it show up as a color- and size-coded word in a live web word-cloud. No app to open, no forms to fill — just message the bot the moment you hit a word you don't know.

**Live:** [dbot.biplovpokhrel.com.np](https://dbot.biplovpokhrel.com.np)

## How it works

```
Telegram message ──▶ Cloudflare Worker ──▶ Turso (libSQL)
                            │
                            ▼
                     React word cloud  ◀── same Worker, same DB
```

- Text the bot a German word → it's added to a "don't know" list with a strength score from 0–7.
- Text it again → the score increases (you clearly don't know it yet).
- `k <word>` → the score decreases (you're learning it).
- `rm <word>` → moves it out of the cloud into a "known" list, off by default.
- The web page renders every unknown word sized and colored by that score — small and gray means you basically know it, large and red means you really don't.
- Click a word to mark it known-better, right-click to mark it known-worse — same effect as the bot commands, without leaving the browser.

One database, read and written from both the bot and the web UI, so the two are always in sync.

## Stack

- **Frontend:** React + Vite, no component library, no router — the whole UI is two views and a handful of `useState` calls.
- **Backend:** a single Cloudflare Worker (`worker.js`) doing manual `fetch`-based routing — no framework, since the entire API surface is 5 routes.
- **Database:** [Turso](https://turso.tech) (hosted libSQL/SQLite), read/written via `@libsql/client` from both the Worker and a local Node script.
- **Bot:** Telegram Bot API via webhook (not polling) — Telegram pushes updates directly to the Worker, so the bot has no server to keep alive.
- **Local dev:** a small Express server (`index.js`) mirrors the Worker's routes 1:1 and runs the bot via long-polling instead, so the whole thing is testable without touching Cloudflare.

No ORM, no D1, no state management library — every layer here is the smallest thing that does the job for a single-user tool.

## Bot commands

| Command | Effect |
|---|---|
| `<word or phrase>` | Add it, or +1 to "don't know" strength (caps at 7) |
| `k <word>` | −1 to "don't know" strength (floors at 0) |
| `rm <word>` | Move out of the cloud, into the known list |
| `rmk <word>` | Permanently purge from the known list |
| `gk` | Last 10 known words |
| `gu` | All unknown words, strongest first |
| `/commands` | Prints this list |

Multi-word phrases (`die absicht haben`) are one entity — the bot never splits on spaces. Everything is case-insensitive and normalized to lowercase.

The first person to message the bot becomes its permanent owner; everyone else is silently ignored. No shared word list with strangers who find the bot's username.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/words` | List unknown words with scores |
| `GET` | `/api/known-words` | List known (archived) words |
| `POST` | `/api/words/:word/know` | −1 to score |
| `POST` | `/api/words/:word/dontknow` | +1 to score |
| `POST` | `/telegram` | Telegram webhook (requires a matching secret token header) |

## Running locally

```bash
npm install
cp .env.example .env   # fill in TELEGRAM_BOT_TOKEN; leave TURSO_* empty to use a local SQLite file
npm run build
npm start               # http://localhost:3001
```

```bash
npm test                # plain node:assert self-checks, no test framework
```

## Deploying

```bash
wrangler login
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
npm run cf:deploy
```

Then point Telegram at the deployed URL:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<your-domain>/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
