import Database from "better-sqlite3";

const db = new Database(process.env.DB_PATH || new URL("./data.db", import.meta.url).pathname);

db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    word TEXT PRIMARY KEY,
    score INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS owner (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    chat_id INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS known_words (
    word TEXT PRIMARY KEY,
    known_at INTEGER NOT NULL
  );
`);

const MIN = 0;
const MAX = 7;
const clamp = (n) => Math.max(MIN, Math.min(MAX, n));

// clamp any pre-existing scores from the old -7..7 scale
db.exec(`UPDATE words SET score = MAX(score, 0)`);

export function getOwnerChatId() {
  return db.prepare("SELECT chat_id FROM owner WHERE id = 1").get()?.chat_id ?? null;
}

// first sender to message the bot becomes the permanent owner
export function claimOwner(chatId) {
  db.prepare("INSERT OR IGNORE INTO owner (id, chat_id) VALUES (1, ?)").run(chatId);
}

export function listWords() {
  return db.prepare("SELECT word, score FROM words ORDER BY word").all();
}

// highest not-knowing first, for the "getunknown" command
export function listWordsByScore() {
  return db.prepare("SELECT word, score FROM words ORDER BY score DESC, word").all();
}

export function bumpWord(word, delta) {
  const row = db.prepare("SELECT score FROM words WHERE word = ?").get(word);
  const score = clamp((row?.score ?? 0) + delta);
  db.prepare(
    "INSERT INTO words (word, score) VALUES (?, ?) ON CONFLICT(word) DO UPDATE SET score = excluded.score"
  ).run(word, score);
  // a word back in the unknown list is no longer "known"
  db.prepare("DELETE FROM known_words WHERE word = ?").run(word);
  return score;
}

// rm moves a word out of the cloud and into the known list, rather than deleting history
export function removeWord(word) {
  const info = db.prepare("DELETE FROM words WHERE word = ?").run(word);
  if (info.changes > 0) {
    db.prepare(
      "INSERT INTO known_words (word, known_at) VALUES (?, ?) ON CONFLICT(word) DO UPDATE SET known_at = excluded.known_at"
    ).run(word, Date.now());
  }
  return info.changes > 0;
}

// most recently known first; pass a limit for "getknown", omit for the known-words page
export function listKnownWords(limit) {
  const sql = `SELECT word, known_at FROM known_words ORDER BY known_at DESC${limit ? " LIMIT ?" : ""}`;
  return limit ? db.prepare(sql).all(limit) : db.prepare(sql).all();
}
