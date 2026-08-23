import { createDb } from "../db.js";
import { handleUpdate } from "../bot.js";

// Telegram calls this on every message (set via setWebhook) instead of us polling.
export async function onRequestPost({ request, env }) {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const db = createDb({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
  const update = await request.json();
  await handleUpdate(db, env.TELEGRAM_BOT_TOKEN, update);

  return new Response("ok");
}
