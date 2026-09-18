import { useEffect, useMemo, useState } from "react";
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

type Tab = "calls" | "crm" | "calendar" | "prompt";

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

  useEffect(() => {
    loadMe().then((ok) => {
      if (ok) {
        loadDesk();
        loadPrompt();
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
    await api(`/api/bookings/${uid}/cancel`, { method: "POST" });
    loadDesk();
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

      <div className="px-5 flex flex-wrap gap-2 mb-4">
        {(
          [
            ["calls", "Voice calls"],
            ["crm", "Shreyas CRM"],
            ["calendar", "Cal.com bookings"],
            ["prompt", "Maya's prompt"],
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
                        <Button variant="ghost" onClick={() => cancelBooking(b.uid)}>
                          <CalendarX className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      ) : null}
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
