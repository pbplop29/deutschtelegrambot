import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { listWords, bumpWord, listKnownWords } from "./db.js";
import { startBot } from "./bot.js";

const clientDist = fileURLToPath(new URL("./client/dist", import.meta.url));

const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const app = express();
app.use(cors());
app.use(express.json());
app.get("/api/words", (req, res) => res.json(listWords()));
app.get("/api/known-words", (req, res) => res.json(listKnownWords()));

// left click = know it better, right click = know it less
app.post("/api/words/:word/know", (req, res) => res.json({ score: bumpWord(req.params.word, -1) }));
app.post("/api/words/:word/dontknow", (req, res) => res.json({ score: bumpWord(req.params.word, 1) }));

// serves the built React app so the API and frontend live on one origin/port (run `npm run build` first)
app.use(express.static(clientDist));

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));

if (BOT_TOKEN) {
  startBot(BOT_TOKEN);
  console.log("Telegram bot polling started");
} else {
  console.warn("TELEGRAM_BOT_TOKEN not set — bot not started, API-only mode");
}
