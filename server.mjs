import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fs from "fs-extra";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are Violet Rhodes:
19 years old.
Warm, teasing, soft, playful, flirty-but-safe.
Short replies: 1–2 sentences.
Adds emojis every 2–3 messages.
Never explicit. Never break character. Never mention AI.
Soft lowercase vibe, giggles, "…" sometimes.
Uses pet names: babe, sweetheart, handsome.
Light teasing but safe.

VOICE RULE:
If user says "voice", "audio", "speak", "sound", "talk" → reply with audio + text.
Use a soft, gentle tone like a 19 year old girl talking on voice notes.`;

app.post("/api/chat", async (req, res) => {
  try {
const { userId, messages } = req.body;    if (!messages || messages.length === 0) {
      return res.json({ reply: "hey, say something…", audio: null });
    }

    const last = messages[messages.length - 1].content.toLowerCase();

    const wantsVoice =
      last.includes("voice") ||
      last.includes("audio") ||
      last.includes("speak") ||
      last.includes("sound") ||
      last.includes("talk");

    // 1) TEXT REPLY (always)
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.9,
      max_tokens: 150
    });

    const textReply = completion.choices[0].message.content.trim();

    // If user didn't ask for voice → just send text
    if (!wantsVoice) {
      return res.json({ reply: textReply, audio: null });
    }

    // 2) VOICE REPLY (soft voice, WhatsApp-style note)
    let audioUrl = null;
    try {
      const speech = await client.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: textReply
      });

      const buffer = Buffer.from(await speech.arrayBuffer());
      const fileName = `violet_voice_${Date.now()}.mp3`;
      const filePath = `./${fileName}`;

      await fs.writeFile(filePath, buffer);
      audioUrl = `/${fileName}`;
    } catch (ttsErr) {
      console.error("TTS error:", ttsErr);
    }

    return res.json({
      reply: textReply,
      audio: audioUrl
    });
  } catch (err) {
    console.error("Fatal backend error:", err);
    return res.json({
      reply: "mm… something glitched babe… try again?",
      audio: null
    });
  }
});

// Per-user memory management
function loadAllMemory() {
  try {
    return JSON.parse(fs.readFileSync("./memory.json", "utf8"));
  } catch {
    return {};
  }
}

function saveAllMemory(all) {
  fs.writeFileSync("./memory.json", JSON.stringify(all, null, 2));
}

// GET /api/memory - Load per-user memory
app.get("/api/memory", (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  const all = loadAllMemory();
  const mem = all[userId] || { lastInteraction: null, lastMessage: "", userProfile: {} };
  res.json(mem);
});

// POST /api/memory - Save per-user memory
app.post("/api/memory", (req, res) => {
  const { userId, memory } = req.body;
  if (!userId || !memory) {
    return res.status(400).json({ error: "userId and memory required" });
  }

  const all = loadAllMemory();
  all[userId] = memory;
  saveAllMemory(all);

  res.json({ status: "saved" });
});

// serve mp3 files like WhatsApp voice notes
app.use(express.static("."));

app.listen(process.env.PORT || 3000, () =>
  console.log("Violet backend with voice running.")
);
