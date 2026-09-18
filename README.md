# West High Dentist

Cloned Lumora static clinic site, rebranded to West High Dentist, plus Maya (Gemini Live voice receptionist) and a front-desk admin.

## Run

```bash
cd ~/Desktop/website/mola-dental
npm install
npm run build
npm start
```

- Public site: http://127.0.0.1:8787
- Admin desk: http://127.0.0.1:8787/admin  
  `admin` / `mola-admin-2026` (override in `.env`)

The left speech bubble is Maya. Click it, allow the mic, and she books against Cal.com event **Dental Clinic Test Call** (`7123087`).

## What is wired

- Gemini Live native audio (`GEMINI_LIVE_MODEL`, falls back to `gemini-3.8-live` if 3.1 handshake fails)
- Cal.com slots + booking (Google Meet, 30 min)
- SQLite-less JSON store at `data/calls.json` — transcripts, booked / not booked
- Keys live in `.env` (never in the browser bundle)

Rotate the Gemini and Cal.com keys: they were pasted in chat.
