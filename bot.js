import { bumpWord, removeWord, getOwnerChatId, claimOwner, listKnownWords, listWordsByScore } from "./db.js";

const apiUrl = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

async function sendMessage(token, chatId, text) {
  await fetch(apiUrl(token, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export function handleText(text) {
  if (/^gk$/i.test(text)) {
    const words = listKnownWords(10);
    return words.length ? words.map((w) => w.word).join("\n") : "No known words yet.";
  }

  if (/^gu$/i.test(text)) {
    const words = listWordsByScore();
    return words.length ? words.map((w) => `${w.word} (${w.score})`).join("\n") : "No unknown words yet.";
  }

  const rm = text.match(/^rm\s+(.+)$/i);
  if (rm) {
    const word = rm[1].trim().toLowerCase();
    return removeWord(word) ? `Removed "${word}".` : `"${word}" wasn't there.`;
  }

  const know = text.match(/^k\s+(.+)$/i);
  if (know) {
    const word = know[1].trim().toLowerCase();
    return `"${word}" → ${bumpWord(word, -1)}`;
  }

  const word = text.trim().toLowerCase();
  return `"${word}" → ${bumpWord(word, 1)}`;
}

// ponytail: single global long-poll loop, one bot/chat at a time is fine for personal use
export async function startBot(token) {
  let offset = 0;
  console.log("Telegram bot polling started");

  for (;;) {
    let updates = [];
    try {
      const res = await fetch(apiUrl(token, `getUpdates?timeout=30&offset=${offset}`));
      ({ result: updates } = await res.json());
    } catch (err) {
      console.error("Telegram poll failed:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;
      const text = update.message?.text?.trim();
      if (!text) continue;

      const chatId = update.message.chat.id;
      const owner = getOwnerChatId();
      if (owner === null) {
        claimOwner(chatId);
      } else if (chatId !== owner) {
        continue; // not the owner — ignore silently
      }

      const reply = handleText(text);
      await sendMessage(token, chatId, reply);
    }
  }
}
