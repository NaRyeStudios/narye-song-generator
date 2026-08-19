# NaRye Song Generator — V1

## What this version does

- Mobile-first NaRye Song Generator UI.
- Smart Prompt and Quick Create modes.
- Accepts long, detailed production prompts like:
  - lyrics
  - section labels
  - pauses
  - spoken moments
  - vocal performance direction
  - instrumentation
  - arrangement
  - tempo/key
  - mood
  - production notes
  - negative instructions
- Uses Gemini structured output to convert the prompt into a Song DNA-style production brief.
- Sends that brief to Google Lyria 3 Pro for full-song generation.
- Plays the returned MP3 in the browser.
- Downloads MP3.
- Saves the latest generations in browser localStorage.
- Shows the interpreted Song DNA.

## Setup

1. Create a Google Gemini API key.
2. Copy `.env.example` to `.env`.
3. Put the key in `GEMINI_API_KEY`.
4. Run:

   npm install
   npm start

5. Open http://localhost:3000

## Render

Use:
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `GEMINI_API_KEY`

The current V1 uses browser localStorage for saved songs. Render's filesystem is not used for permanent song storage.

## Important

The browser never receives the Gemini API key. All model calls happen on the server.

This V1 deliberately keeps the architecture open for:
- Song DNA locking
- multiple takes
- partial regeneration
- custom voice workflows
- stems
- recording
- cloud project storage
- NaRye Legacy OS integration
