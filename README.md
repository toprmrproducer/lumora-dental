# Westside Dentist

Cloned Lumora static clinic site, rebranded to Westside Dentist, plus Maya (Gemini Live voice receptionist) and a front-desk admin.

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

## Deploy

- **Frontend (static):** GitHub Pages — https://toprmrproducer.github.io/west-high-dentist/ (auto-builds from `main` on the `west-high-dentist` repo).
- **Backend (full runtime: voice + admin):** Render — one click:
  [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/topmrproducer/west-high-dentist)
  After the service exists, set these env vars in the Render dashboard (values from local `.env`):
  `GEMINI_API_KEY`, `CAL_API_KEY`, `CAL_EVENT_TYPE_ID=7123087`, `CAL_USERNAME`, `CAL_EVENT_SLUG`, `CAL_TIMEZONE`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `CLINIC_NAME`, `CLINIC_PHONE`, `CLINIC_EMAIL`.
  Then put the Render URL (e.g. `https://mola-dental.onrender.com`) into `assets/js/backend-url.js`, commit, and Pages rebuilds with the orb wired to it.
- The Render disk at `/app/data` persists call transcripts across restarts.

## What is wired

- Gemini Live native audio (`GEMINI_LIVE_MODEL`, falls back to `gemini-3.8-live` if 3.1 handshake fails)
- Cal.com slots + booking (Google Meet, 30 min)
- SQLite-less JSON store at `data/calls.json` — transcripts, booked / not booked
- Keys live in `.env` (never in the browser bundle)

Rotate the Gemini and Cal.com keys: they were pasted in chat.
