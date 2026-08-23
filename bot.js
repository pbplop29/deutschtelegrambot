const apiUrl = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

export async function sendMessage(token, chatId, text) {
  await fetch(apiUrl(token, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function handleText(db, text) {
  if (/^gk$/i.test(text)) {
    const words = await db.listKnownWords(10);
    return words.length ? words.map((w) => w.word).join("\n") : "No known words yet.";
  }

  if (/^gu$/i.test(text)) {
    const words = await db.listWordsByScore();
    return words.length ? words.map((w) => `${w.word} (${w.score})`).join("\n") : "No unknown words yet.";
  }

  const rm = text.match(/^rm\s+(.+)$/i);
  if (rm) {
    const word = rm[1].trim().toLowerCase();
    return (await db.removeWord(word)) ? `Removed "${word}".` : `"${word}" wasn't there.`;
  }

  const know = text.match(/^k\s+(.+)$/i);
  if (know) {
    const word = know[1].trim().toLowerCase();
    return `"${word}" → ${await db.bumpWord(word, -1)}`;
  }

  const word = text.trim().toLowerCase();
  return `"${word}" → ${await db.bumpWord(word, 1)}`;
}

// handles one incoming Telegram message: owner-lock + command dispatch + reply.
// shared by the local Node long-poll loop and the Cloudflare webhook function.
export async function handleUpdate(db, token, update) {
  const text = update.message?.text?.trim();
  if (!text) return;

  const chatId = update.message.chat.id;
  const owner = await db.getOwnerChatId();
  if (owner === null) {
    await db.claimOwner(chatId);
  } else if (chatId !== owner) {
    return; // not the owner — ignore silently
  }

  const reply = await handleText(db, text);
  await sendMessage(token, chatId, reply);
}

// ponytail: single global long-poll loop, one bot/chat at a time is fine for personal use
export async function startBot(token, db) {
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
      await handleUpdate(db, token, update);
    }
  }
}
