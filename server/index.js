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

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    clinic: process.env.CLINIC_NAME || "West High Dentist",
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
  console.log(`West High Dentist running on http://127.0.0.1:${PORT}`);
  console.log(`Admin        http://127.0.0.1:${PORT}/admin`);
  console.log(`Voice Maya   left-side bubble on the public site`);
});
