import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const musicBriefSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    lyrics: { type: "string" },
    style: { type: "string" },
    vocal: { type: "string" },
    mood: { type: "string" },
    tempo: { type: "string" },
    key: { type: "string" },
    structure: { type: "string" },
    production: { type: "string" },
    performance: { type: "string" },
    arrangement: { type: "string" },
    negative_instructions: { type: "string" },
    instrumental: { type: "boolean" }
  },
  required: [
    "title","lyrics","style","vocal","mood","tempo","key",
    "structure","production","performance","arrangement",
    "negative_instructions","instrumental"
  ]
};

function cleanForMusicModel(brief, rawPrompt) {
  const lyricBlock = brief.instrumental
    ? "Instrumental only. Do not sing vocals."
    : `Use these lyrics as the primary lyric text. Preserve the wording and section order unless a tiny adjustment is necessary for musical phrasing:

${brief.lyrics}`;

  return `NA RYE SONG GENERATION BRIEF

Create a complete, cohesive song from this production brief.

TITLE:
${brief.title}

STYLE / GENRE:
${brief.style}

MOOD / ATMOSPHERE:
${brief.mood}

TEMPO:
${brief.tempo}

KEY / TONALITY:
${brief.key}

VOCAL:
${brief.vocal}

PERFORMANCE DIRECTION:
${brief.performance}

ARRANGEMENT / STRUCTURE:
${brief.structure}

INSTRUMENTATION / ARRANGEMENT:
${brief.arrangement}

PRODUCTION:
${brief.production}

IMPORTANT NEGATIVE INSTRUCTIONS:
${brief.negative_instructions}

LYRIC HANDLING:
${lyricBlock}

CRITICAL:
- Treat parenthetical or descriptive text as production/performance direction, not lyrics to sing.
- Do not sing labels such as "(Intro)", "(Verse 1)", "(Pause)", "(Wait 4 counts)", or stage directions.
- Preserve intentional pauses, breath space, spoken moments, and section order when musically possible.
- Do not rush the vocal phrasing.
- Favor musical coherence, natural phrasing, and an intentional arrangement over stuffing every instruction into the vocal.
- The supplied lyrics are the user's creative material; do not replace them with generic lyrics.
- Follow the requested genre and vocal character closely.
- Generate a polished full-length song, not a short jingle.

ORIGINAL USER PROMPT:
${rawPrompt}`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "NaRye Song Generator", musicModel: "lyria-3-pro-preview" });
});

app.post("/api/interpret", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });

    const { prompt = "", lyrics = "", style = "", title = "", voice = "Female", mode = "smart" } = req.body;
    const combined = [
      `MODE: ${mode}`,
      `TITLE: ${title}`,
      `VOICE: ${voice}`,
      `STYLE FIELD: ${style}`,
      `LYRICS FIELD: ${lyrics}`,
      `PROMPT: ${prompt}`
    ].join("\n\n");

    const instruction = `You are NaRye Song Engine, a professional music-production prompt interpreter.
Turn the user's request into a precise music-generation brief.

The user may paste highly structured prompts containing:
- lyrics
- section labels
- parenthetical stage directions
- spoken-word instructions
- vocal performance direction
- instrumental cues
- tempo/key
- genre/style
- production/mixing language
- negative instructions

Do NOT turn stage directions into lyrics. Extract them into performance, arrangement, production, or negative instructions.
If lyrics are supplied, preserve them faithfully. Keep section headings such as [Verse], [Chorus], [Bridge], [Outro] useful to the music model, but do not add generic lyrics.
If the user supplies explicit BPM/key, preserve them.
If information is missing, infer musically sensible values from the user's style instead of inventing unrelated details.
The result will be passed to a music generation model, so be concrete and production-oriented.
Do not mention copyrighted living artists as style targets; translate any such references into descriptive musical characteristics.

Return ONLY JSON matching the provided schema.

USER MATERIAL:
${combined}`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: instruction,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: musicBriefSchema
      }
    });

    const brief = JSON.parse(interaction.output_text);
    res.json({ brief, generationPrompt: cleanForMusicModel(brief, prompt || lyrics || style) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Prompt interpretation failed." });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });

    const {
      prompt = "",
      lyrics = "",
      style = "",
      title = "",
      voice = "Female",
      mode = "smart",
      instrumental = false
    } = req.body;

    if (!prompt && !lyrics && !style) {
      return res.status(400).json({ error: "Give the generator a prompt, lyrics, or style." });
    }

    const combined = [
      `MODE: ${mode}`,
      `TITLE: ${title}`,
      `VOICE: ${voice}`,
      `STYLE FIELD: ${style}`,
      `LYRICS FIELD: ${lyrics}`,
      `PROMPT: ${prompt}`
    ].join("\n\n");

    const parseInstruction = `You are NaRye Song Engine, an expert music producer and prompt engineer.
Convert the user's material into a structured brief for Lyria 3 Pro.
Preserve supplied lyrics. Extract stage directions instead of singing them.
Respect explicit BPM, key, genre, vocal character, arrangement, and production instructions.
Do not replace the user's lyrics with generic lyrics.
Translate any artist-name references into descriptive musical traits.
Return only JSON matching this schema.

USER MATERIAL:
${combined}`;

    const interpreted = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: parseInstruction,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: musicBriefSchema
      }
    });

    const brief = JSON.parse(interpreted.output_text);
    brief.instrumental = Boolean(instrumental || brief.instrumental);

    const musicPrompt = cleanForMusicModel(brief, prompt || lyrics || style);

    const music = await ai.interactions.create({
      model: "lyria-3-pro-preview",
      input: musicPrompt
    });

    // Lyria 3 Pro returns MP3 by default. The Interactions API exposes the
    // generated audio via the `output_audio` convenience property; fall back
    // to manually walking `steps` (documented for interleaved responses) in
    // case a given SDK version doesn't populate the convenience property.
    let audioData = null;
    let mimeType = "audio/mpeg";

    if (music.output_audio?.data) {
      audioData = music.output_audio.data;
      mimeType = music.output_audio.mimeType || "audio/mpeg";
    }

    if (!audioData) {
      for (const step of (music.steps || [])) {
        if (step.type !== "model_output") continue;
        for (const block of (step.content || [])) {
          if (block.type === "audio" && block.data) {
            audioData = block.data;
            mimeType = block.mimeType || block.mime_type || "audio/mpeg";
          }
        }
      }
    }

    if (!audioData) {
      return res.status(502).json({
        error: "The music model returned no audio. Try generating again.",
        brief
      });
    }

    res.json({
      title: brief.title,
      brief,
      lyrics: brief.lyrics,
      audio: `data:${mimeType};base64,${audioData}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Song generation failed." });
  }
});

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`NaRye Song Generator running on port ${PORT}`);
});
