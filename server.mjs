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
VOICE RULE: If user says "voice", "audio", "speak", "sound", "talk" → respond with audio using TTS.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const last = messages[messages.length - 1].content.toLowerCase();

    const wantsVoice = last.includes("voice") || last.includes("audio") || last.includes("speak") || last.includes("sound") || last.includes("talk");

    const completion = await client.chat.completions.create({
      model: "gpt-4-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.9,
      max_tokens: 150
    });

    const textReply = completion.choices[0].message.content.trim();

    if (!wantsVoice) {
      return res.json({ reply: textReply, audio: null });
    }

    const speech = await client.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: textReply
    });

    const filePath = "./violet_voice.mp3";
    await fs.writeFile(filePath, Buffer.from(await speech.arrayBuffer()));

    res.json({ reply: textReply, audio: "/violet_voice.mp3" });
  } catch (err) {
    res.json({ reply: "mm… something glitched babe… try again?", audio: null });
  }
});

app.use(express.static("./"));

app.listen(process.env.PORT || 3000, () =>
  console.log("Violet backend with voice running.")
);
