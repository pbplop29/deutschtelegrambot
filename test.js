import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";

process.env.DB_PATH = new URL("./test.db", import.meta.url).pathname;
const { listWords, bumpWord, getOwnerChatId, claimOwner, listKnownWords } = await import("./db.js");
const { handleText } = await import("./bot.js");

// first sender becomes owner; later claims for a different chat are no-ops
assert.equal(getOwnerChatId(), null);
claimOwner(111);
assert.equal(getOwnerChatId(), 111);
claimOwner(222);
assert.equal(getOwnerChatId(), 111);

// clamping stays within 0..7 (no more negative/green range)
assert.equal(bumpWord("haus", 100), 7);
assert.equal(bumpWord("haus", -100), 0);

// case-insensitive: "Hallo" and "hallo" are the same word
assert.equal(handleText("Hallo"), '"hallo" → 1');
assert.equal(handleText("hallo"), '"hallo" → 2');
assert.equal(handleText("HALLO"), '"hallo" → 3');
assert.equal(listWords().filter((w) => w.word === "hallo").length, 1);

// plain word increments, "k word" decrements toward 0, "rm word" archives (not deletes forever)
assert.equal(handleText("Katze"), '"katze" → 1');
assert.equal(handleText("Katze"), '"katze" → 2');
assert.equal(handleText("K Katze"), '"katze" → 1');
assert.equal(handleText("RM Katze"), 'Removed "katze".');
assert.equal(listWords().find((w) => w.word === "katze"), undefined);
assert.equal(handleText("rm Katze"), '"katze" wasn\'t there.');
assert.deepEqual(listKnownWords().map((w) => w.word), ["katze"]);

// re-adding a known word pulls it back out of the known list
assert.equal(handleText("Katze"), '"katze" → 1');
assert.deepEqual(listKnownWords().map((w) => w.word), []);
assert.equal(handleText("RM Katze"), 'Removed "katze".');

// multi-word phrase is one entity
assert.equal(handleText("Auf Jeden Fall"), '"auf jeden fall" → 1');

// gk / gu commands, case-insensitive
assert.equal(handleText("gk"), "katze");
assert.equal(handleText("GK"), "katze");
assert.equal(handleText("gu"), "hallo (3)\nauf jeden fall (1)\nhaus (0)");

unlinkSync(process.env.DB_PATH);
console.log("ok");
