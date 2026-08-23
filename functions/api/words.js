import { createDb } from "../../db.js";

export async function onRequestGet({ env }) {
  const db = createDb({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
  return Response.json(await db.listWords());
}
