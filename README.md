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
  credentials come from `.env` (`ADMIN_USER` / `ADMIN_PASSWORD`)

The left speech bubble is Maya. Click it, allow the mic, and she books against Cal.com event **Dental Clinic Test Call** (`7123087`).

## Deploy

- **Frontend (static):** GitHub Pages — https://toprmrproducer.github.io/west-high-dentist/ (auto-builds from `main` on the `west-high-dentist` repo).
- **Backend (full runtime: voice + admin):** Railway (supports WebSockets; Vercel does not). Two-minute deploy:
  ```bash
  npm i -g @railway/cli && railway login
  railway init        # create the project
  railway up          # deploys via the Dockerfile
  railway variables --set "GEMINI_API_KEY=... CAL_API_KEY=... CAL_EVENT_TYPE_ID=7123087 CAL_USERNAME=... CAL_EVENT_SLUG=... CAL_TIMEZONE=Europe/London ADMIN_USER=admin ADMIN_PASSWORD=... SESSION_SECRET=... CLINIC_NAME=Westside Dentist CLINIC_PHONE=... CLINIC_EMAIL=..."
  railway domain      # prints the public URL, e.g. https://xxx.up.railway.app
  ```
  (Dashboard route works too: New Project → Deploy from GitHub repo → it auto-detects the Dockerfile; add the same variables; Settings → Networking → Generate Domain. The volume at `/app/data` keeps call transcripts across restarts.)
  Then put that URL into `assets/js/backend-url.js` (`window.MOLA_BACKEND = "https://…up.railway.app"`), commit, and Pages rebuilds with the orb wired to it.

## What is wired

- Gemini Live native audio (`GEMINI_LIVE_MODEL`, falls back to `gemini-3.8-live` if 3.1 handshake fails)
- Cal.com slots + booking (Google Meet, 30 min)
- SQLite-less JSON store at `data/calls.json` — transcripts, booked / not booked
- Keys live in `.env` (never in the browser bundle)

Rotate the Gemini and Cal.com keys: they were pasted in chat.
