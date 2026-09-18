# ONE-SHOT PROMPT — "Westside Dentist" AI Voice Booking Platform

Copy everything below the line into a fresh coding-agent session (Codex / Claude Code / ZCode) in an empty directory. It rebuilds the entire platform from scratch: marketing site, Gemini Live voice receptionist, Cal.com booking, admin dashboard with CRM + call recordings + editable prompt, GitHub Pages frontend + Railway backend.

---

## ROLE

You are a senior full-stack engineer. Build a production-ready **dental clinic AI voice booking platform** called **Westside Dentist** in this directory. Work autonomously, do not ask questions, do not stop until the acceptance checklist at the bottom passes. Prefer boring, verifiable technology. Never invent slots, never leak secrets into browser code.

## PRODUCT (one paragraph)

A dental clinic website (static, multi-page) with a floating glowing orb. Clicking it starts a live voice call with "Maya", a Gemini Live–powered receptionist with a bubbly human personality. She checks real availability on Cal.com, books / cancels / reschedules walk-in appointments by voice, knows what part of the page the caller is pointing at, and never mentions being an AI unless asked. Every call is transcribed, recorded, and outcome-tagged into a private admin dashboard (login-protected) that also acts as a CRM. The static site deploys to GitHub Pages; the Node runtime (voice + admin) deploys to Railway; the Pages orb is wired to the Railway URL with one config file.

## STACK (fixed — do not substitute)

- **Frontend:** plain HTML/CSS/JS static pages (multi-page, no SPA framework needed for the marketing site) + a small Vite-built widget bundle (`src/widget/`) injected into every page.
- **Backend:** Node 22 + Express + `ws` (one process, `server/index.js`), ESM (`"type": "module"`).
- **Admin dashboard:** React 19 + Vite + Tailwind v4, built by Vite into `dist/admin/`, served by the same Express process at `/admin`.
- **Voice:** Gemini Live API over WebSocket (`wss://generativelanguage.googleapis.com/ws/...BidiGenerateContent`), model `gemini-3.1-flash-live-preview` with fallback chain. Native audio in/out, server-side function calling.
- **Calendar:** Cal.com API v2 (base `https://api.cal.com/v2`, booking endpoints need header `cal-api-version: 2026-02-25`, slots endpoint needs `2024-09-04`).
- **Storage:** JSON files under `data/` (calls, settings) + WAV files under `data/recordings/`. No SQL.
- **Hosting:** GitHub Pages (static site, `main` branch / root) + Railway (Dockerfile, WebSocket-capable; NEVER Vercel — its serverless cannot hold the Live WebSocket).

## ENVIRONMENT VARIABLES (server only, never in browser bundles)

```
PORT=8787
GEMINI_API_KEY=...            # Google AI Studio key
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
GEMINI_LIVE_FALLBACK=gemini-2.5-flash-native-audio-latest
GEMINI_VOICE=Aoede
CAL_API_KEY=...               # Cal.com API v2 key
CAL_EVENT_TYPE_ID=7123087
CAL_USERNAME=<cal username>
CAL_EVENT_SLUG=dental-clinic-test-call
CAL_TIMEZONE=Europe/London
ADMIN_USER=admin
ADMIN_PASSWORD=<strong password>
SESSION_SECRET=<random 32+ chars>
CLINIC_NAME=Westside Dentist
CLINIC_PHONE=0114 317 7002
CLINIC_EMAIL=hello@moladental.com
```

`.env` is gitignored and loaded with `dotenv.config({ override: true })`. Railway variables mirror these. `.gitignore` must cover `node_modules`, `dist`, `data`, `.env`.

## REPO LAYOUT

```
index.html about.html service.html blog.html privacy.html terms.html licenses.html cookies.html 404.html
assets/            (css, js incl. built mola-widget.js + backend-url.js, img/)
src/widget/        (Widget.tsx, audio.ts, widget.css, main.tsx)  -> builds assets/js/mola-widget.js
src/admin/         (App.tsx, main.tsx)                        -> builds dist/admin/
src/components/    (shadcn-style Button etc.)
server/            (index.js, gemini-live.js, cal.js, prompt.js, db.js, auth.js)
vite.widget.config.ts vite.admin.config.ts
Dockerfile  render.yaml (optional)  .nojekyll
```

`assets/js/mola-widget.js` (the built widget) and `assets/js/backend-url.js` MUST be committed, so clean clones and Docker builds always produce a working site.

`assets/js/backend-url.js`:
```js
// Public URL of the runtime server (Railway). Empty = same origin (local dev).
window.MOLA_BACKEND = "";
```

## MARKETING SITE

- Premium clinic look: deep teal `#011f23` / `#022f34`, accent teal `#24a3b1`, Sora font, generous whitespace, soft shadows, responsive.
- Pages: Home (hero, stats, treatments grid, story slider, testimonials slider, tips, CTA), About, Services (per-treatment sections with images + copy), Blog, Privacy, Terms, Licenses, Cookies, 404. Nav/footer on all pages, footer includes NAP (name/address/phone).
- Every "Book / Get Appointment" CTA links to the Cal.com booking page as a fallback path.
- Every page loads `/assets/js/backend-url.js` then `/assets/js/mola-widget.js?v=<datestamp>` before `</body>` (plus the widget CSS).

## VOICE WIDGET (`src/widget/Widget.tsx`)

States: `bubble → mic → connecting → live → error → bubble`.

1. **Bubble (idle):** fixed bottom-right glowing orb + pill label reading exactly `Talk to our AI & book a call`. Click starts a call.
2. **Mic first:** request `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })` BEFORE connecting, with status `Tap "Allow" on the microphone prompt to talk to Maya.` Header shows **Allow microphone**. On `NotAllowedError`: "Microphone blocked. Click the mic/lock icon in your address bar, set Microphone to "Allow", then tap Try again." This ordering is mandatory — never show "Connecting…" before the permission dialog.
3. **Connecting:** open WS to `${wss}://${backendHost}/ws/live?timezone=<IANA>` where backend = `window.MOLA_BACKEND || location.origin`.
4. **Live:** panel with header `LIVE WITH MAYA`, the orb, caption `Voice booking · Walk-in appointment`, stable status copy (NO live transcripts in the panel — transcripts go only to the admin dashboard), buttons End call + "Pick a time" (Cal.com link).
5. **Error:** friendly message + Try again / Close.

**Audio pipeline:** ScriptProcessor 4096 → downsample 48k→16k PCM16 → base64 → WS `{type:"audio"}`. Server streams back 24k PCM16 base64; `PcmPlayer` plays it. Barge-in: client-side RMS > 0.035 for 2 frames while player is playing → stop playback instantly, send `{type:"barge_in"}` + `activity_start`; silence ~7 frames → `activity_end`. **NaN guard:** if any mic sample is non-finite, skip the frame entirely (some drivers emit NaN; a NaN level turns the orb into a white rectangle).

**The orb — CRITICAL:** it is **pure CSS**, not WebGL. A rotating conic-gradient ring masked to an annulus plus a radial glow div, colored by `hsl(var(--vorb-hue) …)`, sized/glowing by `--vorb-lvl`. Widget updates two CSS variables from one 80 ms interval: level decays ×0.92, hue = `170 - min(level,1)*150` (teal→amber continuous, never binary color flips). Do NOT use a shader/WebGL orb (ogl/Three) — they produced strobing, white squares, and flicker. Keep the bundle lean (the widget should be ~230 KB unminified, ~74 KB gzip, with no 3D libs).

**Pointer awareness:** while `live`, throttle mousemove (300 ms). `document.elementFromPoint` → describe the target:
- explicit `data-maya="Title. Description"` ancestor wins;
- if over/inside an image: alt text, else humanised filename (strip `gen_`/`img_` prefixes, `-1024x768` suffixes, dashes→spaces), prefixed `an image of`, plus nearest heading;
- else nearest heading (h1–h4) walking ≤7 ancestors + first `<p>` snippet (~220 chars).
Send only `{type:"pointer", text}` — and **only while the PcmPlayer is not playing** (a pointer note mid-sentence would interrupt Maya; queue the last position and flush in the next gap). Skip the widget's own panel/bubble.

## BACKEND

### `server/index.js`
Express + `ws` on one port. Routes:
- `GET /api/health` → `{ok:true, clinic, eventTypeId}` (Railway healthcheck path).
- `POST /api/login` `POST /api/logout` `GET /api/me` — cookie session (signed, HttpOnly, SameSite=Lax; bcrypt compare; 7-day expiry).
- `GET /api/slots?timezone&days&date` → availability (booked-filtered, see cal.js).
- `GET /api/calls` (admin) → `{stats, calls}`; `GET /api/calls/:id` (admin); `GET /api/calls/:id/recording` (admin) → WAV with `Accept-Ranges`.
- `GET|PUT|DELETE /api/prompt` (admin) → read / override / reset the live system prompt (stored in `data/settings.json`, 40–20,000 char validation).
- `GET /api/bookings` (admin) → Cal.com bookings; `POST /api/bookings/:uid/cancel` (admin) → cancel + mark the matching call `cancelled`.
- Static: `/admin` → `dist/admin`; site files from repo root with `.html` extension fallback; `Cache-Control: no-cache` on HTML.

### `server/prompt.js` — Maya's system prompt (≈3.2k chars, keep it ≤5k tokens)
Persona: Maya, 22, bubbly/warm/cheeky, young-neighbour energy; short spoken sentences; sparse "um/uh/let me check"; light stutter when checking; laughs only at real jokes; flirt → one sweet beat then pivot to booking; emergencies → drop the act, empathise, soonest slot, clinic phone, 999/NHS 111 if life-threatening; never diagnoses; never says she's an AI unless asked.
Clinic: 24 Northwood Street, Sheffield S8 0LB (fictional-but-real-sounding), hours Mon–Thu 8:30–19:30, Fri 8:30–14:30, Sat 9:30–14:30, Sun closed.
Booking is a **WALK-IN appointment** (never "video consult"/"Google Meet"). Location answers: give the address warmly.
Pointer awareness: silent notes about the part of the page under the caller's cursor; answer "what is this?" about exactly that; never mention the notes.
Flow: greet → reason → name → when → **ALWAYS get_available_slots before offering times; missing time = already taken, say so kindly** → offer 2–3 real options → name + real email (phone preferred) → confirm → book → confirm out loud. Cancellations: confirm, then cancel_appointment. Reschedules: fresh slots, agree, reschedule_appointment. Wrap-up: save_call_outcome once.
LIVE_TOOLS declarations: `get_available_slots(timezone?, days_ahead?, preferred_date?)`, `book_appointment(name, email, phone?, start_iso, timezone?, notes?)` (required: name,email,start_iso), `cancel_appointment(email, start_iso?)`, `reschedule_appointment(email, new_start_iso, timezone?)`, `save_call_outcome(booked, summary, patient_name?, patient_email?, patient_phone?, slot_start?)`.

### `server/gemini-live.js`
- `setupPayload`: `{setup:{model:"models/"+model, generationConfig:{responseModalities:["AUDIO"], speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:GEMINI_VOICE}}}}, systemInstruction:{parts:[{text: ACTIVE_PROMPT}]}, tools:LIVE_TOOLS, realtimeInputConfig:{automaticActivityDetection:{disabled:true}, activityHandling:"START_OF_ACTIVITY_INTERRUPTS"}, inputAudioTranscription:{}, outputAudioTranscription:{}}}`.
- Model fallback chain: primary → `GEMINI_LIVE_FALLBACK` → `gemini-2.5-flash-native-audio-latest`; 8 s handshake timeout; first message that errors or confirms setup resolves/rejects.
- System prompt is read **per call** via `db.getSetting("systemPrompt") || MAYA_SYSTEM_PROMPT` so admin edits apply to the next call without redeploy.
- Message pump: forward `serverContent.modelTurn.parts[].inlineData` to the browser (24k PCM) **and** feed the recorder; forward input/output transcriptions to `db.appendTranscript` only (not to the widget); `toolCall.functionCalls` → `runTool` → send `{toolResponse:{functionResponses}}` and `{type:"tool"}` to the widget.
- Browser messages: `audio` → `realtimeInput.audio` (16k PCM, feeding the recorder too); `activity_start/end`; `barge_in` → emit local `interrupted`; `text`; **`pointer`** → send a silent `clientContent` user turn: `[Context — do not speak about this note itself] The caller's cursor is now pointing at: "…". If they ask "what is this?" explain that thing naturally…` (never announce it).
- On close (any side): patch call `completed` + `endedAt`, then if the recorder has audio, write `data/recordings/<callId>.wav`.
- Kickoff turn on connect: "A new website visitor just tapped the booking bubble. Timezone guess: … Greet them as Maya…".

### Recorder (stereo WAV)
Caller PCM (16k) = left channel; Maya PCM (24k, resampled to 16k by linear stepping) = right. Header 44-byte PCM stereo 16-bit; write at call end only. This gives synced playback ("Left: caller · Right: Maya") with no mixing/clipping math.

### `server/cal.js` (Cal.com v2 — the only place the CAL key is used)
- `headers(v)`: Bearer key + `cal-api-version` (v as above).
- `getSlots({timezone, daysAhead=7, preferredDate, excludeBooked=true})`: `GET /slots?eventTypeId&start&end&timeZone`; flatten `{day:[{start}]}`; **subtract every confirmed booking start** (`bookedStarts()` = all non-cancelled `/bookings`) plus any slot starting <29 min after a booked start (the event is 30 min). This is the double-booking guard — Maya must never offer a taken time even when Cal's availability feed is stale. Sort, cap 24.
- `createBooking({name,email,phone,startIso,timezone,notes})`: validate name ≥2 chars, email regex; `POST /bookings` with `{start, eventTypeId, attendee:{name,email,timeZone,language:"en",phoneNumber?}, metadata:{source:"maya-voice", notes}}` (api-version 2026-02-25); surface Cal's error messages verbatim (Maya repeats them naturally).
- `cancelBooking(uid)`: `DELETE /bookings/{uid}` (2026-02-25); treat 404 as success.
- `findBooking(bookings,{email,startIso})`: match attendee email (+ optional ±60 s start), skip cancelled.
- `formatSlotsForMaya`: humanise slots ("Thursday, 18 September, 10:30 am", Europe/London) into `{offer:[{start,say}], instruction}`.

### `server/db.js` (JSON store)
`data/calls.json` — call: `{id(uuid), startedAt, endedAt, status(live|completed), outcome(unknown|booked|not_booked|cancelled), patientName, patientEmail, patientPhone, slotStart, calBookingUid, calMeetingUrl, summary, model, recording:bool, transcript:[{role, text, at, partial?}]}`. Functions: createCall, getCall, listCalls, patchCall, appendTranscript (merges partials by role), stats (total/live/booked/notBooked/conversion), getSetting/setSetting (`data/settings.json`).

### `server/auth.js`
Cookie sessions: login (timing-safe-ish, constant bcrypt), `readSession`, `requireAdmin` middleware (401 JSON), logout. SESSION_SECRET signs the cookie.

## ADMIN DASHBOARD (`src/admin/App.tsx`)

Login screen ("Front desk"). After login: 4 stat cards (Calls / Live / Booked / Not booked), then tabs:
1. **Voice calls** — list (name, outcome badge, time) + detail pane: patient, email/phone, model, summary, walk-in slot, **recording player** (`<audio controls src="/api/calls/:id/recording">`, note "Left: caller · Right: Maya"), full colour-coded transcript (Maya=accent, Caller=ink). Polls every 4 s.
2. **Shreyas CRM** — patients grouped by email/phone (name, contact, #calls, #booked, last-5 clickable call links that jump to the call tab).
3. **Cal.com bookings** — table with When / Who / Status / Meet link / **Cancel button** per booking.
4. **Maya's prompt** — big monospace textarea, Save (PUT /api/prompt), Reset to default (DELETE), override indicator, live "~tokens" counter (chars/4). Edits affect the next call, no redeploy.
Style: dark panel, line borders, small caps labels, booked=green, missed/cancelled=red, accent teal.

## DOCKERFILE (Railway builds this)

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/assets/js ./assets/js
COPY --from=build /app/dist ./dist
COPY . .
RUN mkdir -p /app/data
EXPOSE 8787
CMD ["node", "server/index.js"]
```

**Do NOT include a `VOLUME` directive — the Railway builder hard-fails on `docker VOLUME`.** Railway respects `PORT`; the server listens on `process.env.PORT || 8787`. Healthcheck `/api/health`. Mount a volume at `/app/data` in the dashboard (CLI/API) to keep recordings + transcripts across deploys.

## DEPLOY (end state)

1. **GitHub repo public** (e.g. `west-high-dentist`). GitHub Pages: Settings → Pages → Deploy from branch `main` `/` (include `.nojekyll`). URL: `https://<user>.github.io/<repo>/`.
2. **Railway:** `railway init` → `railway up` (or dashboard: Deploy from GitHub repo, auto-detects Dockerfile) → set all env vars → Settings → Networking → Generate Domain (e.g. `https://westside-backend-production.up.railway.app`) → add the `/app/data` volume.
3. **Wire:** put the Railway domain into `assets/js/backend-url.js` (`window.MOLA_BACKEND = "https://…"`), commit → Pages rebuilds → the orb on Pages talks to Railway. (If a Pages build is stuck "building" for >10 min, `POST /repos/:owner/:repo/pages/builds` via API re-kicks it.)
4. Local run: `npm install && npm run build && npm start` → site `http://127.0.0.1:8787`, admin `/admin`.

## KNOWN TRAPS (each of these cost real debugging — respect them)

- **Vercel cannot host the runtime** (no persistent WebSocket). Railway/Render/Fly/VPS only.
- Cal.com **API v1 is decommissioned**; v2 needs the exact `cal-api-version` headers per endpoint (bookings `2026-02-25`, slots `2024-09-04`).
- Shallow git clones cannot push ("did not receive expected object") — `git fetch --unshallow` first.
- GitHub Pages builds randomly hang on "building" or error with no message — re-`POST /pages/builds` and move on; check the CDN, not just the API.
- ScriptProcessor audio can be NaN when tabs/drivers misbehave — the NaN frame guard is not optional.
- A `clientContent` turn (pointer note) interrupts whatever Gemini is saying — the widget must gate pointer sends to gaps in playback.
- Admin login must survive inherited shell vars: `dotenv.config({ override: true })`.
- Never put GEMINI/CAL/SESSION values in the widget bundle; the browser only ever gets the WS URL.

## ACCEPTANCE CHECKLIST (verify all, in order)

1. `npm run build` succeeds; `assets/js/mola-widget.js` + `dist/admin` produced; committed.
2. `npm start` → `/api/health` ok; `/` serves the site; `/admin` serves the dashboard.
3. Admin login with ADMIN_USER/ADMIN_PASSWORD works; `/api/calls` returns stats.
4. `GET /api/prompt` returns the default; `PUT` overrides; a new WS call uses the override (server logs / behaviour); `DELETE` resets.
5. Simulated WS client: connect, send 0.5 s of 16k PCM tone + `{type:"end"}` → `data/recordings/<callId>.wav` exists, valid 2-channel 16 kHz WAV.
6. Pointer: `{type:"pointer", text:"Root Canal Treatment"}` mid-session does not error; when gated (player playing) it is deferred client-side.
7. `/api/slots` excludes already-booked starts (count drops after a real booking).
8. Real voice call on the live URL: mic prompt appears BEFORE connecting; Maya greets aloud; offers real slots; books one → Cal.com shows it, `/api/slots` no longer offers it, admin shows booked + transcript + recording; she can cancel/reschedule by voice; say "what is this?" while hovering a treatment → she explains it.
9. Orb: zero flicker — continuous teal→amber, CSS-only.
10. Both URLs live: Pages (static + wired orb) and Railway (site + voice + admin).

Build it all now. When every checklist item passes, print the final URLs, the admin credentials location (env, never hardcoded), and stop.
