import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "calls.json");
const settingsPath = path.join(dataDir, "settings.json");

function loadSettings() {
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

export function getSetting(key) {
  return loadSettings()[key] ?? null;
}

export function setSetting(key, value) {
  const settings = loadSettings();
  settings[key] = value;
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return settings;
}

function load() {
  if (!fs.existsSync(dbPath)) return { calls: [] };
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return { calls: [] };
  }
}

function save(state) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
}

export function createCall({ model }) {
  const state = load();
  const call = {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: "live",
    outcome: "unknown",
    patientName: null,
    patientEmail: null,
    patientPhone: null,
    slotStart: null,
    calBookingUid: null,
    calMeetingUrl: null,
    summary: null,
    model,
    transcript: [],
    recording: false,
  };
  state.calls.unshift(call);
  save(state);
  return call;
}

export function getCall(id) {
  return load().calls.find((c) => c.id === id) || null;
}

export function listCalls() {
  return load().calls;
}

export function patchCall(id, patch) {
  const state = load();
  const idx = state.calls.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  state.calls[idx] = { ...state.calls[idx], ...patch };
  save(state);
  return state.calls[idx];
}

export function appendTranscript(id, entry) {
  const state = load();
  const call = state.calls.find((c) => c.id === id);
  if (!call) return null;
  const last = call.transcript[call.transcript.length - 1];
  // Merge partials of the same turn only while the turn is actually ongoing —
  // after an interruption the model restarts the sentence, and merging that
  // into the old entry produced duplicated text like "Hey, this is Maya at
  // WestsideHey, this is Maya at Westside Dentist".
  const fresh = last && Date.now() - new Date(last.at).getTime() < 4000;
  if (last && last.role === entry.role && fresh && entry.partial) {
    last.text = (last.text || "") + entry.text;
    last.at = entry.at;
  } else if (last && last.role === entry.role && fresh && !entry.partial && last.partial) {
    last.text = (last.text || "") + entry.text;
    last.partial = false;
    last.at = entry.at;
  } else {
    call.transcript.push({
      role: entry.role,
      text: entry.text,
      at: entry.at,
      partial: Boolean(entry.partial),
    });
  }
  save(state);
  return call;
}

export function stats() {
  const calls = listCalls();
  const booked = calls.filter((c) => c.outcome === "booked").length;
  const notBooked = calls.filter((c) => c.outcome === "not_booked").length;
  return {
    total: calls.length,
    live: calls.filter((c) => c.status === "live").length,
    booked,
    notBooked,
    conversion: calls.length ? Math.round((booked / calls.length) * 100) : 0,
  };
}
