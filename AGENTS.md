# Mola Dental — AGENTS.md

## Goal
Ship the cloned clinic site with Maya voice booking and an admin transcript desk.

## Stack
Static HTML (cloned Lumora) + Express + Gemini Live WebSocket proxy + Cal.com v2 + Vite/React widget & admin.

## Folder structure
- `index.html` and siblings — public clinic site
- `assets/js/mola-widget.js` — built voice bubble
- `server/` — API, Cal.com, Gemini proxy
- `src/widget` — React IIFE widget
- `src/admin` — desk UI
- `src/components/ui/voice-powered-orb.tsx` — orb

## Deploy
`npm run build && npm start` (port 8787)

## Project rules
- Do not rebuild the marketing site in React
- Keep secrets in `.env`
- Maya books only real Cal.com slots
