import { createDb } from "../../../../db.js";

// left click = know it better (-1), right click = know it less (+1)
export async function onRequestPost({ params, env }) {
  const { word, action } = params;
  if (action !== "know" && action !== "dontknow") {
    return new Response("not found", { status: 404 });
  }

  const db = createDb({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
  const delta = action === "know" ? -1 : 1;
  const score = await db.bumpWord(word.toLowerCase(), delta);
  return Response.json({ score });
}
