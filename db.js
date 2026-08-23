import { createClient } from "@libsql/client";

const MIN = 0;
const MAX = 7;
const clamp = (n) => Math.max(MIN, Math.min(MAX, n));

export function createDb({ url, authToken } = {}) {
  if (!url) throw new Error("createDb: url is required (set TURSO_DATABASE_URL)");
  const client = createClient(authToken ? { url, authToken } : { url });

  let ready;
  function ensureSchema() {
    if (!ready) {
      ready = client.batch([
        "CREATE TABLE IF NOT EXISTS words (word TEXT PRIMARY KEY, score INTEGER NOT NULL DEFAULT 0)",
        "CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK (id = 1), chat_id INTEGER NOT NULL)",
        "CREATE TABLE IF NOT EXISTS known_words (word TEXT PRIMARY KEY, known_at INTEGER NOT NULL)",
        // clamp any pre-existing scores from the old -7..7 scale
        "UPDATE words SET score = MAX(score, 0)",
      ]);
    }
    return ready;
  }

  return {
    async getOwnerChatId() {
      await ensureSchema();
      const { rows } = await client.execute("SELECT chat_id FROM owner WHERE id = 1");
      return rows[0]?.chat_id ?? null;
    },

    // first sender to message the bot becomes the permanent owner
    async claimOwner(chatId) {
      await ensureSchema();
      await client.execute({ sql: "INSERT OR IGNORE INTO owner (id, chat_id) VALUES (1, ?)", args: [chatId] });
    },

    async listWords() {
      await ensureSchema();
      const { rows } = await client.execute("SELECT word, score FROM words ORDER BY word");
      return rows;
    },

    // highest not-knowing first, for the "gu" command
    async listWordsByScore() {
      await ensureSchema();
      const { rows } = await client.execute("SELECT word, score FROM words ORDER BY score DESC, word");
      return rows;
    },

    async bumpWord(word, delta) {
      await ensureSchema();
      const { rows } = await client.execute({ sql: "SELECT score FROM words WHERE word = ?", args: [word] });
      const score = clamp((rows[0]?.score ?? 0) + delta);
      await client.execute({
        sql: "INSERT INTO words (word, score) VALUES (?, ?) ON CONFLICT(word) DO UPDATE SET score = excluded.score",
        args: [word, score],
      });
      // a word back in the unknown list is no longer "known"
      await client.execute({ sql: "DELETE FROM known_words WHERE word = ?", args: [word] });
      return score;
    },

    // rm moves a word out of the cloud and into the known list, rather than deleting history
    async removeWord(word) {
      await ensureSchema();
      const result = await client.execute({ sql: "DELETE FROM words WHERE word = ?", args: [word] });
      const changed = result.rowsAffected > 0;
      if (changed) {
        await client.execute({
          sql: "INSERT INTO known_words (word, known_at) VALUES (?, ?) ON CONFLICT(word) DO UPDATE SET known_at = excluded.known_at",
          args: [word, Date.now()],
        });
      }
      return changed;
    },

    // most recently known first; pass a limit for "gk", omit for the known-words page
    async listKnownWords(limit) {
      await ensureSchema();
      const sql = `SELECT word, known_at FROM known_words ORDER BY known_at DESC${limit ? " LIMIT ?" : ""}`;
      const { rows } = await client.execute({ sql, args: limit ? [limit] : [] });
      return rows;
    },
  };
}
