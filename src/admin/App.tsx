import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Phone,
  CheckCircle2,
  XCircle,
  Radio,
  Users,
  CalendarX,
  Save,
  RotateCcw,
} from "lucide-react";

type Call = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  outcome: "booked" | "not_booked" | "unknown" | "cancelled";
  patientName: string | null;
  patientEmail: string | null;
  patientPhone: string | null;
  slotStart: string | null;
  calBookingUid: string | null;
  calMeetingUrl: string | null;
  summary: string | null;
  model: string;
  recording: boolean;
  transcript: { role: string; text: string; at: string }[];
};

type Stats = {
  total: number;
  live: number;
  booked: number;
  notBooked: number;
  conversion: number;
};

type Booking = {
  uid: string;
  start: string;
  status: string;
  title?: string;
  location?: string;
  attendees?: { name?: string; email?: string }[];
};

type Tab = "calls" | "crm" | "calendar" | "prompt" | "keys";

type KeyStatus = { set: boolean; source: string; tail: string | null };

const api = (path: string, init?: RequestInit) =>
  fetch(path, { credentials: "include", ...init });

export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<Tab>("calls");
  const [prompt, setPrompt] = useState("");
  const [promptOverridden, setPromptOverridden] = useState(false);
  const [promptState, setPromptState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cancellingUid, setCancellingUid] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [keys, setKeys] = useState<{
    gemini: KeyStatus;
    cal: KeyStatus;
  } | null>(null);
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [calKeyInput, setCalKeyInput] = useState("");
  const [keyState, setKeyState] = useState<"idle" | "saving" | "error">("idle");
  const [keyError, setKeyError] = useState("");
  const [keySavedMsg, setKeySavedMsg] = useState("");

  const active = useMemo(
    () => calls.find((c) => c.id === activeId) || null,
    [calls, activeId]
  );

  // Shreyas CRM: group calls into patient records.
  const patients = useMemo(() => {
    const byKey = new Map<
      string,
      { name: string; email: string | null; phone: string | null; calls: Call[]; booked: number }
    >();
    for (const c of calls) {
      const key = (c.patientEmail || c.patientPhone || `anon:${c.id}`).toLowerCase();
      let p = byKey.get(key);
      if (!p) {
        p = { name: c.patientName || "Unknown", email: c.patientEmail, phone: c.patientPhone, calls: [], booked: 0 };
        byKey.set(key, p);
      }
      if (c.patientName) p.name = c.patientName;
      if (c.patientEmail) p.email = c.patientEmail;
      if (c.patientPhone) p.phone = c.patientPhone;
      p.calls.push(c);
      if (c.outcome === "booked") p.booked += 1;
    }
    return [...byKey.values()].sort((a, b) => b.calls.length - a.calls.length);
  }, [calls]);

  async function loadMe() {
    const res = await api("/api/me");
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      return true;
    }
    setUser(null);
    return false;
  }

  async function loadDesk() {
    const res = await api("/api/calls");
    if (!res.ok) return;
    const data = await res.json();
    setStats(data.stats);
    setCalls(data.calls);
    if (!activeId && data.calls[0]) setActiveId(data.calls[0].id);
    const b = await api("/api/bookings");
    if (b.ok) {
      const json = await b.json();
      setBookings(json.bookings || []);
    }
  }

  async function loadPrompt() {
    const res = await api("/api/prompt");
    if (!res.ok) return;
    const json = await res.json();
    setPrompt(json.prompt);
    setPromptOverridden(json.overridden);
  }

  async function loadKeys() {
    const res = await api("/api/keys");
    if (!res.ok) return;
    setKeys(await res.json());
  }

  async function saveKeys() {
    setKeyState("saving");
    setKeyError("");
    setKeySavedMsg("");
    const body: Record<string, string> = {};
    if (geminiKeyInput.trim()) body.geminiApiKey = geminiKeyInput.trim();
    if (calKeyInput.trim()) body.calApiKey = calKeyInput.trim();
    if (!Object.keys(body).length) {
      setKeyState("error");
      setKeyError("Paste at least one key first.");
      return;
    }
    await putKeys(body);
    setGeminiKeyInput("");
    setCalKeyInput("");
  }

  async function saveOne(field: "geminiApiKey" | "calApiKey") {
    setKeyState("saving");
    setKeyError("");
    setKeySavedMsg("");
    const value = (field === "geminiApiKey" ? geminiKeyInput : calKeyInput).trim();
    if (!value) return;
    await putKeys({ [field]: value });
    if (field === "geminiApiKey") setGeminiKeyInput("");
    else setCalKeyInput("");
  }

  async function putKeys(body: Record<string, string>) {
    const res = await api("/api/keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setKeyState("error");
      setKeyError(json.error || "Save failed.");
      return;
    }
    setKeys({ gemini: json.gemini, cal: json.cal });
    setKeyState("idle");
    setKeySavedMsg("Saved and validated — the next call uses it.");
    window.setTimeout(() => setKeySavedMsg(""), 6000);
  }

  useEffect(() => {
    loadMe().then((ok) => {
      if (ok) {
        loadDesk();
        loadPrompt();
        loadKeys();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user || tab === "prompt") return;
    const id = window.setInterval(loadDesk, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      setLoginError("Wrong username or password.");
      return;
    }
    const data = await res.json();
    setUser(data.user);
    loadDesk();
    loadPrompt();
    loadKeys();
  }

  async function onLogout() {
    await api("/api/logout", { method: "POST" });
    setUser(null);
    setCalls([]);
  }

  async function savePrompt() {
    setPromptState("saving");
    const res = await api("/api/prompt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      setPromptState("error");
      return;
    }
    setPromptState("saved");
    setPromptOverridden(true);
    window.setTimeout(() => setPromptState("idle"), 2500);
  }

  async function resetPrompt() {
    await api("/api/prompt", { method: "DELETE" });
    await loadPrompt();
    setPromptState("idle");
  }

  async function cancelBooking(uid: string) {
    if (!window.confirm("Cancel this booking on Cal.com? This cannot be undone.")) return;
    setCancellingUid(uid);
    setCancelError("");
    try {
      const res = await api(`/api/bookings/${uid}/cancel`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Cancel failed" }));
        setCancelError(json.error || "Cancel failed — try again in a moment.");
      }
    } catch {
      setCancelError("Network error — the booking was not cancelled.");
    } finally {
      setCancellingUid(null);
      loadDesk();
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <form
          onSubmit={onLogin}
          className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl"
        >
          <p className="text-[11px] tracking-[0.2em] uppercase text-accent mb-2">
            Westside Dentist
          </p>
          <h1 className="text-2xl font-semibold mb-1">Front desk</h1>
          <p className="text-sm text-muted mb-6">
            Call recordings, transcripts, CRM, and Maya's brain.
          </p>
          <label className="block text-xs text-muted mb-1">Username</label>
          <input
            className="w-full mb-3 h-10 rounded-md bg-canvas border border-line px-3"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <label className="block text-xs text-muted mb-1">Password</label>
          <input
            type="password"
            className="w-full mb-4 h-10 rounded-md bg-canvas border border-line px-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {loginError ? <p className="text-sm text-missed mb-3">{loginError}</p> : null}
          <Button type="submit" className="w-full bg-accent text-primary-foreground">
            Sign in
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="h-14 border-b border-line flex items-center justify-between px-5">
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-accent">Westside Dentist</p>
          <p className="text-sm text-muted">Voice desk · signed in as {user}</p>
        </div>
        <Button variant="ghost" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
        <Stat label="Calls" value={stats?.total ?? 0} icon={<Phone className="w-4 h-4" />} />
        <Stat label="Live" value={stats?.live ?? 0} icon={<Radio className="w-4 h-4" />} />
        <Stat
          label="Booked"
          value={stats?.booked ?? 0}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <Stat
          label="Not booked"
          value={stats?.notBooked ?? 0}
          icon={<XCircle className="w-4 h-4" />}
        />
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_240px]">
        <ChartCard title="Calls — last 14 days">
          <CallsBars calls={calls} />
        </ChartCard>
        <ChartCard title="Outcomes">
          <OutcomeDonut calls={calls} />
        </ChartCard>
        <ChartCard title="Conversion">
          <div className="h-full grid place-items-center">
            <div className="text-center">
              <p className="text-5xl font-semibold text-accent">{stats?.conversion ?? 0}%</p>
              <p className="text-xs text-muted mt-2">
                of calls ended booked
              </p>
              <p className="text-xs text-muted mt-1">
                {patients.length} contact{patients.length === 1 ? "" : "s"} on file
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="px-5 flex flex-wrap gap-2 mb-4">
        {(
          [
            ["calls", "Voice calls"],
            ["crm", "CRM"],
            ["calendar", "Cal.com bookings"],
            ["prompt", "Maya's prompt"],
            ["keys", "API keys"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <Button key={key} variant={tab === key ? "default" : "ghost"} onClick={() => setTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "calendar" ? (
        <div className="px-5 pb-10">
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-panel text-muted text-left">
                <tr>
                  <th className="p-3 font-medium">When</th>
                  <th className="p-3 font-medium">Who</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Meet</th>
                  <th className="p-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => (
                  <tr key={b.uid || i} className="border-t border-line">
                    <td className="p-3">{formatWhen(b.start)}</td>
                    <td className="p-3">{b.attendees?.[0]?.name || b.title || "—"}</td>
                    <td className="p-3">{b.status || "—"}</td>
                    <td className="p-3">
                      {b.location ? (
                        <a className="text-accent" href={b.location} target="_blank" rel="noreferrer">
                          Join
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      {b.status !== "cancelled" ? (
                        <Button
                          variant="ghost"
                          disabled={cancellingUid === b.uid}
                          onClick={() => cancelBooking(b.uid)}
                        >
                          <CalendarX className="w-4 h-4 mr-1" />
                          {cancellingUid === b.uid ? "Cancelling…" : "Cancel"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">cancelled</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!bookings.length ? (
                  <tr>
                    <td className="p-6 text-muted" colSpan={5}>
                      No Cal.com bookings yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {cancelError ? (
            <p className="text-sm text-missed mt-3">{cancelError}</p>
          ) : null}
        </div>
      ) : tab === "crm" ? (
        <div className="px-5 pb-10 space-y-3">
          <p className="text-sm text-muted">
            Every caller, grouped into patient records. {patients.length} contact
            {patients.length === 1 ? "" : "s"} on file.
          </p>
          {patients.map((p) => (
            <div key={p.email || p.phone || p.name} className="rounded-xl border border-line bg-panel p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-sm text-muted">
                    {p.email || "no email"} · {p.phone || "no phone"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>{p.calls.length} call{p.calls.length === 1 ? "" : "s"}</p>
                  <p className="text-booked">{p.booked} booked</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {p.calls.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="block text-sm text-accent hover:underline"
                    onClick={() => {
                      setActiveId(c.id);
                      setTab("calls");
                    }}
                  >
                    {formatWhen(c.startedAt)} — {c.outcome}
                    {c.slotStart ? ` · appt ${formatWhen(c.slotStart)}` : ""}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!patients.length ? <p className="text-sm text-muted">No patients yet.</p> : null}
        </div>
      ) : tab === "keys" ? (
        <div className="px-5 pb-10 max-w-3xl space-y-5">
          <p className="text-sm text-muted">
            Paste a key, press its Save button, and it is validated live against
            Google / Cal.com, then stored server-side on the platform volume. Every new
            call and booking uses the saved key immediately. Keys are never shown in
            full — only the last 4 characters.
          </p>
          {keySavedMsg ? (
            <p className="text-sm text-booked">✓ {keySavedMsg}</p>
          ) : null}
          {keyError ? <p className="text-sm text-missed">✗ {keyError}</p> : null}
          <div className="rounded-xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Google Gemini (voice agent)</h3>
              <KeyBadge status={keys?.gemini} />
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder="paste new AIza… key to replace"
                className="flex-1 h-10 rounded-md bg-canvas border border-line px-3 font-mono text-sm"
                autoComplete="off"
              />
              <Button
                onClick={() => saveOne("geminiApiKey")}
                disabled={keyState === "saving" || !geminiKeyInput.trim()}
              >
                {keyState === "saving" ? "Validating…" : "Save"}
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Cal.com (calendar booking)</h3>
              <KeyBadge status={keys?.cal} />
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={calKeyInput}
                onChange={(e) => setCalKeyInput(e.target.value)}
                placeholder="paste new cal_live_… key to replace"
                className="flex-1 h-10 rounded-md bg-canvas border border-line px-3 font-mono text-sm"
                autoComplete="off"
              />
              <Button
                onClick={() => saveOne("calApiKey")}
                disabled={keyState === "saving" || !calKeyInput.trim()}
              >
                {keyState === "saving" ? "Validating…" : "Save"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted">
            After saving, the badge above the box turns green: “saved via admin panel”.
            That is your confirmation it is stored and live for the next call.
          </p>
        </div>
      ) : tab === "prompt" ? (
        <div className="px-5 pb-10 max-w-4xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted">
              Maya's system prompt. Edits go live for the <strong>next call</strong> — no redeploy
              needed.
              {promptOverridden ? " (custom override active)" : " (built-in default)"}
            </p>
            <div className="flex gap-2">
              {promptOverridden ? (
                <Button variant="ghost" onClick={resetPrompt}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reset to default
                </Button>
              ) : null}
              <Button onClick={savePrompt} disabled={promptState === "saving"}>
                <Save className="w-4 h-4 mr-1" />
                {promptState === "saving" ? "Saving…" : "Save prompt"}
              </Button>
            </div>
          </div>
          {promptState === "saved" ? (
            <p className="text-sm text-booked mb-2">Saved — live from the next call.</p>
          ) : null}
          {promptState === "error" ? (
            <p className="text-sm text-missed mb-2">Save failed (40–20,000 characters).</p>
          ) : null}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            spellCheck={false}
            className="w-full h-[62vh] rounded-xl border border-line bg-panel p-4 text-sm leading-6 font-mono"
          />
          <p className="text-xs text-muted mt-2">{prompt.length} characters (~{Math.round(prompt.length / 4)} tokens)</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[340px_1fr] gap-4 px-5 pb-10">
          <div className="rounded-xl border border-line overflow-hidden bg-panel">
            {calls.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-line ${
                  c.id === activeId ? "bg-canvas" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {c.patientName || "Unknown caller"}
                  </span>
                  <OutcomeBadge outcome={c.outcome} live={c.status === "live"} />
                </div>
                <p className="text-xs text-muted mt-1">{formatWhen(c.startedAt)}</p>
              </button>
            ))}
            {!calls.length ? (
              <p className="p-6 text-sm text-muted">
                No voice calls yet. The bubble on the public site creates them.
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-line bg-panel p-5 min-h-[420px]">
            {!active ? (
              <p className="text-muted">Select a call.</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {active.patientName || "Unknown caller"}
                    </h2>
                    <p className="text-sm text-muted">
                      {active.patientEmail || "no email"} · {active.patientPhone || "no phone"}
                    </p>
                    <p className="text-xs text-muted mt-1">Model {active.model}</p>
                  </div>
                  <OutcomeBadge outcome={active.outcome} live={active.status === "live"} />
                </div>
                {active.summary ? (
                  <p className="text-sm mb-4 text-ink/90">{active.summary}</p>
                ) : null}
                {active.status === "live" ? <LiveMonitor key={active.id} callId={active.id} /> : null}
                {active.slotStart ? (
                  <p className="text-sm mb-4">
                    Walk-in slot {formatWhen(active.slotStart)}
                    {active.calMeetingUrl ? (
                      <>
                        {" · "}
                        <a className="text-accent" href={active.calMeetingUrl} target="_blank" rel="noreferrer">
                          Details
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {active.recording ? (
                  <div className="mb-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted mb-1">
                      Call recording
                    </p>
                    <audio controls preload="none" className="w-full" src={`/api/calls/${active.id}/recording`} />
                    <p className="text-[11px] text-muted mt-1">Left: caller · Right: Maya</p>
                  </div>
                ) : active.status === "completed" ? (
                  <p className="text-xs text-muted mb-4">No recording for this call (recordings start with calls made after this update).</p>
                ) : null}
                <div className="space-y-3 max-h-[52vh] overflow-auto pr-2">
                  {active.transcript.map((t, i) => (
                    <div key={i} className={t.role === "maya" ? "text-accent" : "text-ink"}>
                      <p className="text-[11px] uppercase tracking-wider text-muted mb-0.5">
                        {t.role === "maya" ? "Maya" : "Caller"}
                      </p>
                      <p className="text-sm leading-6">{t.text}</p>
                    </div>
                  ))}
                  {!active.transcript.length ? (
                    <p className="text-sm text-muted">Transcript will land here as the call runs.</p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type LiveChunk = { channel?: string; base64?: string; rate?: number };

// "Listen live" for calls with status "live": opens /ws/monitor for the call,
// decodes base64 PCM chunks (16k caller / 24k Maya) and plays them through one
// AudioContext with a small per-channel scheduler. Keyed by callId so picking
// another call tears the socket + context down cleanly.
function LiveMonitor({ callId }: { callId: string }) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${proto}//${window.location.host}/ws/monitor?callId=${encodeURIComponent(callId)}`
    );
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    // Next scheduled start time per channel, relative to ctx.currentTime.
    const nextTime: Record<string, number> = { maya: 0, caller: 0 };

    const decode = (b64: string) => {
      const bin = window.atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Int16Array(bytes.buffer);
    };

    ws.onmessage = (ev: MessageEvent) => {
      let chunk: LiveChunk;
      try {
        chunk = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (!chunk?.base64 || !chunk.rate) return;
      const channel = chunk.channel === "maya" ? "maya" : "caller";
      let samples: Int16Array;
      try {
        samples = decode(chunk.base64);
      } catch {
        return;
      }
      if (!samples.length || ctx.state === "closed") return;
      const buffer = ctx.createBuffer(1, samples.length, chunk.rate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) data[i] = samples[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const now = ctx.currentTime;
      // Cap queued audio: if this channel drifts >1.5s behind realtime,
      // drop the backlog and resync instead of lagging forever.
      if (nextTime[channel] > now + 1.5) nextTime[channel] = now + 0.05;
      const startAt = Math.max(now + 0.05, nextTime[channel]);
      nextTime[channel] = startAt + buffer.duration;
      src.start(startAt);
    };
    ws.onclose = () => setListening(false);

    return () => {
      ws.onmessage = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      void ctx.close().catch(() => {});
    };
  }, [listening, callId]);

  return (
    <div className="flex items-center gap-3 mb-4">
      <Button
        variant={listening ? "ghost" : "default"}
        className={listening ? "" : "bg-accent text-primary-foreground"}
        onClick={() => setListening((v) => !v)}
      >
        <Radio className="w-4 h-4 mr-1" />
        {listening ? "Stop listening" : "Listen live"}
      </Button>
      {listening ? (
        <span className="text-[11px] uppercase tracking-wider text-accent animate-pulse">
          ● live audio
        </span>
      ) : null}
    </div>
  );
}

function KeyBadge({ status }: { status?: KeyStatus }) {
  if (!status) return <span className="text-xs text-muted">checking…</span>;
  if (!status.set) return <span className="text-xs text-missed">not set</span>;
  if (status.source === "admin panel") {
    return (
      <span className="text-xs text-booked">✓ saved · via admin panel · …{status.tail}</span>
    );
  }
  return (
    <span className="text-xs text-muted">active · via {status.source} · …{status.tail}</span>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted mb-3">{title}</p>
      <div className="h-[130px]">{children}</div>
    </div>
  );
}

function CallsBars({ calls }: { calls: Call[] }) {
  const days: { label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      count: calls.filter((c) => c.startedAt.slice(0, 10) === key).length,
    });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="flex items-end gap-1.5 h-full">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${d.label}: ${d.count}`}>
          <div
            className={`w-full rounded-t ${d.count ? "bg-accent" : "bg-line"}`}
            style={{ height: `${(d.count / max) * 82}%`, minHeight: d.count ? 4 : 2 }}
          />
          <span className="text-[9px] text-muted">{i % 2 === 0 ? d.label.split(" ")[0] : ""}</span>
        </div>
      ))}
    </div>
  );
}

function OutcomeDonut({ calls }: { calls: Call[] }) {
  const counts = {
    booked: calls.filter((c) => c.outcome === "booked").length,
    not_booked: calls.filter((c) => c.outcome === "not_booked").length,
    cancelled: calls.filter((c) => c.outcome === "cancelled").length,
    unknown: calls.filter((c) => c.outcome === "unknown" || c.status === "live").length,
  };
  const colors: Record<string, string> = {
    booked: "#34b39a",
    not_booked: "#e05d5d",
    cancelled: "#8a8fa3",
    unknown: "#24a3b1",
  };
  const total = Math.max(1, calls.length);
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-4 h-full">
      <svg viewBox="0 0 110 110" className="w-[104px] h-[104px] -rotate-90">
        <circle cx="55" cy="55" r={R} fill="none" stroke="#232a33" strokeWidth="14" />
        {Object.entries(counts).map(([k, v]) => {
          const seg = (v / total) * C;
          const el = v ? (
            <circle
              key={k}
              cx="55"
              cy="55"
              r={R}
              fill="none"
              stroke={colors[k]}
              strokeWidth="14"
              strokeDasharray={`${seg} ${C - seg}`}
              strokeDashoffset={-offset}
            />
          ) : null;
          offset += seg;
          return el;
        })}
      </svg>
      <div className="text-xs space-y-1.5">
        {Object.entries(counts).map(([k, v]) => (
          <p key={k} className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colors[k] }} />
            <span className="text-muted capitalize">{k.replace("_", " ")}</span>
            <span className="font-medium">{v}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between text-muted text-xs uppercase tracking-wider">
        {label}
        {icon}
      </div>
      <p className="text-3xl font-semibold mt-2">{value}</p>
    </div>
  );
}

function OutcomeBadge({
  outcome,
  live,
}: {
  outcome: Call["outcome"];
  live?: boolean;
}) {
  if (live) {
    return (
      <span className="text-[11px] uppercase tracking-wider text-accent">Live</span>
    );
  }
  if (outcome === "booked") {
    return (
      <span className="text-[11px] uppercase tracking-wider text-booked">Booked</span>
    );
  }
  if (outcome === "cancelled") {
    return (
      <span className="text-[11px] uppercase tracking-wider text-missed">Cancelled</span>
    );
  }
  if (outcome === "not_booked") {
    return (
      <span className="text-[11px] uppercase tracking-wider text-missed">Not booked</span>
    );
  }
  return (
    <span className="text-[11px] uppercase tracking-wider text-muted">Open</span>
  );
}

function formatWhen(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(d);
}
