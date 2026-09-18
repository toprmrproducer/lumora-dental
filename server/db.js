import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "calls.json");

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
  if (last && last.role === entry.role && entry.partial) {
    last.text = (last.text || "") + entry.text;
    last.at = entry.at;
  } else if (last && last.role === entry.role && !entry.partial && last.partial) {
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
