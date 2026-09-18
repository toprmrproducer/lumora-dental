import { useEffect, useRef, useState } from "react";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import { PcmPlayer, base64ToInt16, downsampleTo16k, int16ToBase64 } from "./audio";

type Phase = "bubble" | "connecting" | "live" | "error";

export function Widget() {
  const [phase, setPhase] = useState<Phase>("bubble");
  const [status, setStatus] = useState("Maya is listening…");
  const [level, setLevel] = useState(0);
  const [hue, setHue] = useState(170);
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const recRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const levelRef = useRef(0);
  const bargeFramesRef = useRef(0);
  const silenceFramesRef = useRef(0);
  const callerSpeakingRef = useRef(false);
  const suppressAudioUntilRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => setLevel(levelRef.current * 0.92), 80);
    return () => window.clearInterval(id);
  }, []);

  const stopAll = () => {
    try {
      wsRef.current?.send(JSON.stringify({ type: "end" }));
    } catch {
      /* ignore */
    }
    wsRef.current?.close();
    wsRef.current = null;
    procRef.current?.disconnect();
    procRef.current = null;
    recRef.current?.close().catch(() => undefined);
    recRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    levelRef.current = 0;
    setLevel(0);
  };

  const startCall = async () => {
    setError("");
    setPhase("connecting");
    setStatus("One sec — putting you through to Maya…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      streamRef.current = stream;
      const rec = new AudioContext({ sampleRate: 48000 });
      recRef.current = rec;
      const src = rec.createMediaStreamSource(stream);
      const proc = rec.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      const mute = rec.createGain();
      mute.gain.value = 0;
      src.connect(proc);
      proc.connect(mute);
      mute.connect(rec.destination);

      // Static hosts (GitHub Pages) set window.MOLA_BACKEND to the runtime
      // server URL; when unset the widget is served same-origin by Node.
      const backend = (window as any).MOLA_BACKEND || location.origin;
      const backendUrl = new URL(backend);
      const proto = backendUrl.protocol === "https:" ? "wss" : "ws";
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
      const ws = new WebSocket(
        `${proto}://${backendUrl.host}/ws/live?timezone=${encodeURIComponent(tz)}`
      );
      wsRef.current = ws;
      const player = new PcmPlayer(24000);
      playerRef.current = player;
      await player.resume();

      proc.onaudioprocess = (ev) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = ev.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        const next = Math.min(rms * 6, 1);
        levelRef.current = Math.max(levelRef.current * 0.6, next, player.level);
        setHue(player.level > 0.08 ? 20 : 170);
        // Keep upstream audio flowing during model speech. Two consecutive voiced
        // frames are enough to cut local playback before remote VAD catches up.
        if (player.isPlaying() && rms > 0.035) {
          bargeFramesRef.current += 1;
          if (bargeFramesRef.current === 2) {
            suppressAudioUntilRef.current = Date.now() + 900;
            player.interrupt();
            setStatus("I’m listening.");
            ws.send(JSON.stringify({ type: "barge_in" }));
          }
        } else if (rms < 0.018) {
          bargeFramesRef.current = 0;
        }
        if (rms > 0.028 && !callerSpeakingRef.current) {
          callerSpeakingRef.current = true;
          silenceFramesRef.current = 0;
          ws.send(JSON.stringify({ type: "activity_start" }));
        } else if (callerSpeakingRef.current && rms < 0.014) {
          silenceFramesRef.current += 1;
          if (silenceFramesRef.current >= 7) {
            callerSpeakingRef.current = false;
            silenceFramesRef.current = 0;
            ws.send(JSON.stringify({ type: "activity_end" }));
          }
        } else if (rms >= 0.014) {
          silenceFramesRef.current = 0;
        }
        const pcm = downsampleTo16k(input, rec.sampleRate);
        ws.send(JSON.stringify({ type: "audio", data: int16ToBase64(pcm) }));
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "ready") {
          setPhase("live");
          setStatus("Maya just picked up. Go ahead, talk like you would on the phone.");
        }
        if (msg.type === "audio") {
          if (Date.now() < suppressAudioUntilRef.current) return;
          const rate = /rate=(\d+)/.exec(msg.mimeType || "")?.[1];
          player.enqueue(base64ToInt16(msg.data), rate ? Number(rate) : 24000);
          levelRef.current = Math.max(levelRef.current, 0.55);
          setHue(18);
        }
        if (msg.type === "transcript" && msg.role === "maya") {
          setStatus(msg.text);
        }
        if (msg.type === "interrupted") {
          player.interrupt();
          suppressAudioUntilRef.current = Date.now() + 250;
          setStatus("I’m listening.");
        }
        if (msg.type === "tool" && msg.name === "book_appointment" && msg.result?.ok) {
          setStatus("Booked. Maya will confirm the time out loud.");
        }
        if (msg.type === "error") {
          setError(msg.message);
          setPhase("error");
        }
        if (msg.type === "ended") {
          stopAll();
          setPhase("bubble");
        }
      };
      ws.onerror = () => {
        setError("Could not reach Maya. Is the Westside Dentist server running?");
        setPhase("error");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone blocked");
      setPhase("error");
    }
  };

  const hangUp = () => {
    stopAll();
    setPhase("bubble");
    setStatus("Maya is listening…");
  };

  if (phase === "bubble") {
    return (
      <button
        className="mola-bubble"
        type="button"
        onClick={startCall}
        aria-label="Click now and do shit. Start a voice booking with Maya."
      >
        <span className="mola-orb-core" aria-hidden="true">
          <span className="mola-orb-shine" />
        </span>
        <span className="mola-orb-prompt">Click now and do shit.</span>
      </button>
    );
  }

  return (
    <div className="mola-panel">
      <div className="mola-live">
        <span className="mola-dot" />
        {phase === "live" ? "Live with Maya" : "Connecting"}
      </div>
      <div className="mola-orb-wrap">
        <VoicePoweredOrb
          enableVoiceControl={false}
          externalLevel={Math.max(level, levelRef.current)}
          hue={hue}
          maxHoverIntensity={1}
        />
      </div>
      <div className="mola-caption">Voice booking · 30 min video consult</div>
      <div className="mola-status">{error || status}</div>
      <div className="mola-actions">
        {phase === "error" ? (
          <>
            <button className="mola-btn primary" type="button" onClick={startCall}>
              Try again
            </button>
            <button className="mola-btn ghost" type="button" onClick={hangUp}>
              Close
            </button>
          </>
        ) : (
          <>
            <button className="mola-btn danger" type="button" onClick={hangUp}>
              End call
            </button>
            <a
              className="mola-btn ghost"
              href="https://cal.com/shreyasrajsony11-ukmj10/dental-clinic-test-call"
              target="_blank"
              rel="noreferrer"
            >
              Pick a time
            </a>
          </>
        )}
      </div>
    </div>
  );
}
