import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Phone, CheckCircle2, XCircle, Radio } from "lucide-react";

type Call = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  outcome: "booked" | "not_booked" | "unknown";
  patientName: string | null;
  patientEmail: string | null;
  patientPhone: string | null;
  slotStart: string | null;
  calBookingUid: string | null;
  calMeetingUrl: string | null;
  summary: string | null;
  model: string;
  transcript: { role: string; text: string; at: string }[];
};

type Stats = {
  total: number;
  live: number;
  booked: number;
  notBooked: number;
  conversion: number;
};

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
  const [bookings, setBookings] = useState<unknown[]>([]);
  const [tab, setTab] = useState<"calls" | "calendar">("calls");

  const active = useMemo(
    () => calls.find((c) => c.id === activeId) || null,
    [calls, activeId]
  );

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

  useEffect(() => {
    loadMe().then((ok) => {
      if (ok) loadDesk();
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(loadDesk, 4000);
    return () => window.clearInterval(id);
  }, [user]);

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
  }

  async function onLogout() {
    await api("/api/logout", { method: "POST" });
    setUser(null);
    setCalls([]);
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
            Call transcripts, bookings, and whether Maya closed the appointment.
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

      <div className="px-5 flex gap-2 mb-4">
        <Button
          variant={tab === "calls" ? "default" : "ghost"}
          onClick={() => setTab("calls")}
        >
          Voice calls
        </Button>
        <Button
          variant={tab === "calendar" ? "default" : "ghost"}
          onClick={() => setTab("calendar")}
        >
          Cal.com bookings
        </Button>
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
                </tr>
              </thead>
              <tbody>
                {(bookings as Array<Record<string, unknown>>).map((b, i) => (
                  <tr key={String(b.uid || i)} className="border-t border-line">
                    <td className="p-3">{formatWhen(String(b.start || ""))}</td>
                    <td className="p-3">
                      {String(
                        (b.attendees as Array<{ name?: string }>)?.[0]?.name ||
                          b.title ||
                          "—"
                      )}
                    </td>
                    <td className="p-3">{String(b.status || "—")}</td>
                    <td className="p-3">
                      {typeof b.location === "string" ? (
                        <a className="text-accent" href={b.location} target="_blank" rel="noreferrer">
                          Join
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {!bookings.length ? (
                  <tr>
                    <td className="p-6 text-muted" colSpan={4}>
                      No Cal.com bookings yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
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
                    Slot {formatWhen(active.slotStart)}
                    {active.calMeetingUrl ? (
                      <>
                        {" · "}
                        <a className="text-accent" href={active.calMeetingUrl} target="_blank" rel="noreferrer">
                          Meet link
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <div className="space-y-3 max-h-[58vh] overflow-auto pr-2">
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
