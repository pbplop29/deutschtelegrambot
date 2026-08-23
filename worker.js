import { createDb } from "./db.js";
import { handleUpdate } from "./bot.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const db = createDb({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

    if (request.method === "GET" && url.pathname === "/api/words") {
      return Response.json(await db.listWords());
    }

    if (request.method === "GET" && url.pathname === "/api/known-words") {
      return Response.json(await db.listKnownWords());
    }

    // left click = know it better, right click = know it less
    const bump = url.pathname.match(/^\/api\/words\/([^/]+)\/(know|dontknow)$/);
    if (request.method === "POST" && bump) {
      const word = decodeURIComponent(bump[1]).toLowerCase();
      const delta = bump[2] === "know" ? -1 : 1;
      return Response.json({ score: await db.bumpWord(word, delta) });
    }

    // Telegram calls this on every message (set via setWebhook) instead of us polling
    if (request.method === "POST" && url.pathname === "/telegram") {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const update = await request.json();
      await handleUpdate(db, env.TELEGRAM_BOT_TOKEN, update);
      return new Response("ok");
    }

    return env.ASSETS.fetch(request);
  },
};
