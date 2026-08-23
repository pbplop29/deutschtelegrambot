import { useEffect, useState } from "react";
import "./App.css";

// same-origin by default: Express serves this build, and vite dev proxies /api to it
const API_URL = import.meta.env.VITE_API_URL || "";
const MAX = 7;
const GRAY = { r: 156, g: 163, b: 175 };
const RED = { r: 239, g: 68, b: 68 };

function colorFor(score) {
  const t = score / MAX; // 0..1
  return `rgb(${Math.round(GRAY.r + (RED.r - GRAY.r) * t)}, ${Math.round(GRAY.g + (RED.g - GRAY.g) * t)}, ${Math.round(GRAY.b + (RED.b - GRAY.b) * t)})`;
}

function sizeFor(score) {
  return 16 + (score / MAX) * 56; // 16px .. 72px
}

function WordCloud({ words, bump }) {
  return (
    <div className="cloud">
      {words.map(({ word, score }) => (
        <span
          key={word}
          className="cloud-word"
          style={{ fontSize: `${sizeFor(score)}px`, color: colorFor(score) }}
          onClick={() => bump(word, "know")}
          onContextMenu={(e) => {
            e.preventDefault();
            bump(word, "dontknow");
          }}
        >
          {word}
        </span>
      ))}
    </div>
  );
}

function KnownWords({ words }) {
  return (
    <ul className="known-list">
      {words.map(({ word }) => (
        <li key={word}>{word}</li>
      ))}
    </ul>
  );
}

export default function App() {
  const [view, setView] = useState("cloud");
  const [words, setWords] = useState([]);
  const [known, setKnown] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/words`)
      .then((res) => res.json())
      .then(setWords)
      .catch(() => setWords([]));
  }, []);

  useEffect(() => {
    if (view !== "known") return;
    fetch(`${API_URL}/api/known-words`)
      .then((res) => res.json())
      .then(setKnown)
      .catch(() => setKnown([]));
  }, [view]);

  function bump(word, path) {
    fetch(`${API_URL}/api/words/${encodeURIComponent(word)}/${path}`, { method: "POST" })
      .then((res) => res.json())
      .then(({ score }) => setWords((ws) => ws.map((w) => (w.word === word ? { ...w, score } : w))));
  }

  return (
    <>
      <button
        className="nav-dot"
        onClick={() => setView(view === "cloud" ? "known" : "cloud")}
        aria-label={view === "cloud" ? "Show known words" : "Back to word cloud"}
      >
        {view === "known" ? "×" : "•"}
      </button>
      {view === "cloud" ? <WordCloud words={words} bump={bump} /> : <KnownWords words={known} />}
    </>
  );
}
