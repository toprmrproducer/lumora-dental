const CAL_BASE = "https://api.cal.com/v2";

function headers(apiVersion = "2024-09-04") {
  return {
    Authorization: `Bearer ${process.env.CAL_API_KEY}`,
    "cal-api-version": apiVersion,
    "Content-Type": "application/json",
  };
}

function eventTypeId() {
  return Number(process.env.CAL_EVENT_TYPE_ID || "7123087");
}

export async function getSlots({ timezone, daysAhead = 7, preferredDate } = {}) {
  const tz = timezone || process.env.CAL_TIMEZONE || "Europe/London";
  const start = preferredDate ? new Date(`${preferredDate}T00:00:00Z`) : new Date();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Number(daysAhead || 7));
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    eventTypeId: String(eventTypeId()),
    start: startStr,
    end: endStr,
    timeZone: tz,
  });
  const res = await fetch(`${CAL_BASE}/slots?${params}`, { headers: headers("2024-09-04") });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || json?.message || `Cal slots ${res.status}`);
  }
  const byDay = json.data || {};
  const slots = [];
  for (const [day, list] of Object.entries(byDay)) {
    for (const item of list || []) {
      slots.push({ day, start: item.start, timezone: tz });
    }
  }
  slots.sort((a, b) => a.start.localeCompare(b.start));
  return { timezone: tz, count: slots.length, slots: slots.slice(0, 24) };
}

export async function createBooking({ name, email, phone, startIso, timezone, notes }) {
  if (typeof name !== "string" || name.trim().length < 2) throw new Error("A patient name is required");
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("A valid email is required");
  const tz = timezone || process.env.CAL_TIMEZONE || "Europe/London";
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid start time");
  const body = {
    start: start.toISOString(),
    eventTypeId: eventTypeId(),
    attendee: {
      name: name.trim(),
      email: email.trim(),
      timeZone: tz,
      language: "en",
      ...(phone ? { phoneNumber: phone } : {}),
    },
    metadata: {
      source: "mola-voice-maya",
      notes: String(notes || "").slice(0, 500),
    },
  };
  const res = await fetch(`${CAL_BASE}/bookings`, {
    method: "POST",
    headers: headers("2026-02-25"),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      json?.data?.message ||
      `Cal booking ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  const data = json.data || json;
  return {
    uid: data.uid,
    id: data.id,
    status: data.status,
    start: data.start,
    end: data.end,
    meetingUrl: data.location || data.meetingUrl || null,
    title: data.title,
    attendee: name,
    email,
  };
}

export async function listBookings() {
  const res = await fetch(`${CAL_BASE}/bookings?take=50`, {
    headers: headers("2026-02-25"),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || json?.message || `Cal bookings ${res.status}`);
  }
  const data = json.data;
  return Array.isArray(data) ? data : data?.bookings || [];
}

export function formatSlotsForMaya(result) {
  if (!result.slots.length) {
    return {
      ok: true,
      message: "No open slots in that window. Try another day or a wider range.",
      slots: [],
    };
  }
  const lines = result.slots.slice(0, 10).map((s) => {
    const d = new Date(s.start);
    const human = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: result.timezone,
    }).format(d);
    return { start: s.start, say: human };
  });
  return {
    ok: true,
    timezone: result.timezone,
    offer: lines,
    instruction:
      "Offer 2–4 of these times in natural speech. Use the exact `start` value when booking.",
  };
}
