import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dbPath = fileURLToPath(new URL("./test.db", import.meta.url));
const { createDb } = await import("./db.js");
const { handleText } = await import("./bot.js");

const db = createDb({ url: `file:${dbPath}` });

// first sender becomes owner; later claims for a different chat are no-ops
assert.equal(await db.getOwnerChatId(), null);
await db.claimOwner(111);
assert.equal(await db.getOwnerChatId(), 111);
await db.claimOwner(222);
assert.equal(await db.getOwnerChatId(), 111);

// clamping stays within 0..7 (no more negative/green range)
assert.equal(await db.bumpWord("haus", 100), 7);
assert.equal(await db.bumpWord("haus", -100), 0);

// case-insensitive: "Hallo" and "hallo" are the same word
assert.equal(await handleText(db, "Hallo"), '"hallo" → 1');
assert.equal(await handleText(db, "hallo"), '"hallo" → 2');
assert.equal(await handleText(db, "HALLO"), '"hallo" → 3');
assert.equal((await db.listWords()).filter((w) => w.word === "hallo").length, 1);

// plain word increments, "k word" decrements toward 0, "rm word" archives (not deletes forever)
assert.equal(await handleText(db, "Katze"), '"katze" → 1');
assert.equal(await handleText(db, "Katze"), '"katze" → 2');
assert.equal(await handleText(db, "K Katze"), '"katze" → 1');
assert.equal(await handleText(db, "RM Katze"), 'Removed "katze".');
assert.equal((await db.listWords()).find((w) => w.word === "katze"), undefined);
assert.equal(await handleText(db, "rm Katze"), '"katze" wasn\'t there.');
assert.deepEqual((await db.listKnownWords()).map((w) => w.word), ["katze"]);

// re-adding a known word pulls it back out of the known list
assert.equal(await handleText(db, "Katze"), '"katze" → 1');
assert.deepEqual((await db.listKnownWords()).map((w) => w.word), []);
assert.equal(await handleText(db, "RM Katze"), 'Removed "katze".');

// multi-word phrase is one entity
assert.equal(await handleText(db, "Auf Jeden Fall"), '"auf jeden fall" → 1');

// gk / gu commands, case-insensitive
assert.equal(await handleText(db, "gk"), "katze");
assert.equal(await handleText(db, "GK"), "katze");
assert.equal(await handleText(db, "gu"), "hallo (3)\nauf jeden fall (1)\nhaus (0)");

// rmk permanently purges from the known list, with no trace left
assert.equal(await handleText(db, "RMK Katze"), 'Purged "katze" from known list.');
assert.deepEqual((await db.listKnownWords()).map((w) => w.word), []);
assert.equal(await handleText(db, "rmk katze"), '"katze" wasn\'t in known list.');

unlinkSync(dbPath);
console.log("ok");
