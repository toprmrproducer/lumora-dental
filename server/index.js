import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import * as db from "./db.js";
import * as cal from "./cal.js";
import * as auth from "./auth.js";
import { attachLiveSession } from "./gemini-live.js";
import { MAYA_SYSTEM_PROMPT as defaultPromptText } from "./prompt.js";

// The clinic's local runtime must prefer this project's ignored .env file over
// inherited shell variables, otherwise an old admin session can reject its own credentials.
dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    clinic: process.env.CLINIC_NAME || "Westside Dentist",
    eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
  });
});

app.post("/api/login", auth.login);
app.post("/api/logout", auth.logout);
app.get("/api/me", (req, res) => {
  const session = auth.readSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user: session.sub });
});

app.get("/api/slots", async (req, res) => {
  try {
    const result = await cal.getSlots({
      timezone: req.query.timezone,
      daysAhead: req.query.days ? Number(req.query.days) : 7,
      preferredDate: req.query.date,
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/book", async (req, res) => {
  try {
    const booking = await cal.createBooking(req.body || {});
    res.json({ ok: true, booking });
  } catch (err) {
    const status = /required|valid|invalid/i.test(err.message) ? 400 : 502;
    res.status(status).json({ error: err.message });
  }
});

app.get("/api/calls", auth.requireAdmin, (_req, res) => {
  res.json({ stats: db.stats(), calls: db.listCalls() });
});

app.get("/api/calls/:id", auth.requireAdmin, (req, res) => {
  const call = db.getCall(req.params.id);
  if (!call) return res.status(404).json({ error: "Not found" });
  res.json(call);
});

app.get("/api/calls/:id/recording", auth.requireAdmin, (req, res) => {
  const call = db.getCall(req.params.id);
  if (!call) return res.status(404).json({ error: "Not found" });
  const file = path.join(root, "data", "recordings", `${call.id}.wav`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "No recording" });
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Accept-Ranges", "bytes");
  res.sendFile(file);
});

app.get("/api/prompt", auth.requireAdmin, (_req, res) => {
  res.json({
    prompt: db.getSetting("systemPrompt") || defaultPromptText,
    overridden: Boolean(db.getSetting("systemPrompt")),
  });
});

app.put("/api/prompt", auth.requireAdmin, (req, res) => {
  const text = String(req.body?.prompt || "").trim();
  if (text.length < 40) return res.status(400).json({ error: "Prompt too short to be usable" });
  if (text.length > 20000) return res.status(400).json({ error: "Prompt too long (20k char cap)" });
  db.setSetting("systemPrompt", text);
  res.json({ ok: true, chars: text.length });
});

app.delete("/api/prompt", auth.requireAdmin, (_req, res) => {
  db.setSetting("systemPrompt", null);
  res.json({ ok: true });
});

app.post("/api/bookings/:uid/cancel", auth.requireAdmin, async (req, res) => {
  try {
    await cal.cancelBooking(req.params.uid);
    const call = db.listCalls().find((c) => c.calBookingUid === req.params.uid);
    if (call) {
      db.patchCall(call.id, { outcome: "cancelled", calBookingUid: null, slotStart: null });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/bookings", auth.requireAdmin, async (_req, res) => {
  try {
    const bookings = await cal.listBookings();
    res.json({ bookings });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const adminDist = path.join(root, "dist", "admin");
if (fs.existsSync(adminDist)) {
  app.use("/admin", express.static(adminDist));
  app.get(/^\/admin\/.*/, (_req, res) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });
} else {
  app.get(/^\/admin\/?$/, (_req, res) => {
    res
      .status(503)
      .type("html")
      .send(
        `<p>Admin UI is not built yet. Run <code>npm run build</code>. API is up on this port.</p>`
      );
  });
}

app.use(
  express.static(root, {
    extensions: ["html"],
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/live" });

wss.on("connection", (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const timezone = url.searchParams.get("timezone") || "Europe/London";
  attachLiveSession(socket, { timezone }).catch((err) => {
    try {
      socket.send(JSON.stringify({ type: "error", message: err.message }));
    } catch {
      /* ignore */
    }
    socket.close();
  });
});

server.listen(PORT, () => {
  console.log(`Westside Dentist running on http://127.0.0.1:${PORT}`);
  console.log(`Admin        http://127.0.0.1:${PORT}/admin`);
  console.log(`Voice Maya   bottom-right booking orb on the public site`);
});
