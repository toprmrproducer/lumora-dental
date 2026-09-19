import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";
import { MAYA_SYSTEM_PROMPT, LIVE_TOOLS } from "./prompt.js";
import * as db from "./db.js";
import * as cal from "./cal.js";

const GEMINI_WS =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

function activeSystemPrompt() {
  // The admin dashboard can override the built-in prompt at runtime; falling
  // back keeps calls working if the override is deleted or corrupted.
  return db.getSetting("systemPrompt") || MAYA_SYSTEM_PROMPT;
}

function setupPayload(model) {
  return {
    setup: {
      model: `models/${model}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: process.env.GEMINI_VOICE || "Aoede",
            },
          },
        },
      },
      systemInstruction: { parts: [{ text: activeSystemPrompt() }] },
      tools: LIVE_TOOLS,
      realtimeInputConfig: {
        automaticActivityDetection: { disabled: true },
        activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };
}

function connectGemini(model) {
  // Admin panel override first (data/settings.json), env var as fallback.
  const key = db.getSetting("geminiApiKey") || process.env.GEMINI_API_KEY;
  const url = `${GEMINI_WS}?key=${encodeURIComponent(key)}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`Gemini handshake timeout for ${model}`));
    }, 8000);
    ws.once("open", () => {
      ws.send(JSON.stringify(setupPayload(model)));
    });
    ws.once("message", (raw) => {
      clearTimeout(timer);
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch (err) {
        ws.close();
        reject(err);
        return;
      }
      if (data.error) {
        ws.close();
        reject(new Error(data.error.message || "Gemini setup error"));
        return;
      }
      resolve(ws);
    });
    ws.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function connectWithFallback() {
  const primary = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
  const fallback = process.env.GEMINI_LIVE_FALLBACK || "gemini-3.8-live";
  const tried = [];
  for (const model of [primary, fallback, "gemini-2.5-flash-native-audio-latest"]) {
    if (!model || tried.includes(model)) continue;
    tried.push(model);
    try {
      const ws = await connectGemini(model);
      return { ws, model };
    } catch (err) {
      console.warn(`[maya] ${model} failed: ${err.message}`);
    }
  }
  throw new Error("Could not open a Gemini Live session");
}

async function runTool(name, args, callId) {
  if (name === "get_available_slots") {
    const result = await cal.getSlots({
      timezone: args.timezone,
      daysAhead: args.days_ahead,
      preferredDate: args.preferred_date,
    });
    return cal.formatSlotsForMaya(result);
  }
  if (name === "cancel_appointment") {
    const bookings = await cal.listBookings();
    const booking = cal.findBooking(bookings, {
      email: args.email,
      startIso: args.start_iso,
    });
    if (!booking) {
      return {
        ok: false,
        message:
          "No upcoming appointment found for that email. Ask the caller to double-check the email they booked with.",
      };
    }
    await cal.cancelBooking(booking.uid);
    const call = db.listCalls().find((c) => c.calBookingUid === booking.uid);
    if (call) {
      db.patchCall(call.id, { outcome: "cancelled", calBookingUid: null, slotStart: null });
    }
    const when = booking.start ? new Date(booking.start).toUTCString().slice(0, 22) : "that time";
    return {
      ok: true,
      message: `Cancelled the appointment for ${when}. Tell the caller it's done and they're welcome back anytime.`,
      cancelled: booking.uid,
    };
  }
  if (name === "reschedule_appointment") {
    const bookings = await cal.listBookings();
    const booking = cal.findBooking(bookings, { email: args.email });
    if (!booking) {
      return {
        ok: false,
        message: "No existing appointment found for that email. Offer to book a fresh one instead.",
      };
    }
    const newStart = new Date(args.new_start_iso);
    if (Number.isNaN(newStart.getTime())) throw new Error("Invalid new time");
    const taken = await cal.bookedStarts();
    for (const b of taken) {
      if (Math.abs(b - newStart.getTime()) < 60_000 && booking.uid) {
        // their own old slot is fine; anything else at the exact time is a clash
        const own = Math.abs(new Date(booking.start).getTime() - newStart.getTime()) < 60_000;
        if (!own) {
          return { ok: false, message: "That time was just taken. Please offer another slot." };
        }
      }
    }
    const attendees = booking.attendees || [];
    const created = await cal.createBooking({
      name: attendees[0]?.name || "Patient",
      email: args.email,
      startIso: args.new_start_iso,
      timezone: args.timezone,
      notes: "rescheduled by Maya (voice)",
    });
    await cal.cancelBooking(booking.uid);
    const call = db.listCalls().find((c) => c.calBookingUid === booking.uid);
    if (call) {
      db.patchCall(call.id, {
        slotStart: created.start,
        calBookingUid: created.uid,
        calMeetingUrl: created.meetingUrl,
      });
    }
    return {
      ok: true,
      message:
        "Moved. Confirm the new time out loud and say a fresh confirmation email is on its way.",
      booking: created,
    };
  }
  if (name === "book_appointment") {
    const booking = await cal.createBooking({
      name: args.name,
      email: args.email,
      phone: args.phone,
      startIso: args.start_iso,
      timezone: args.timezone,
      notes: args.notes,
    });
    db.patchCall(callId, {
      outcome: "booked",
      patientName: args.name,
      patientEmail: args.email,
      patientPhone: args.phone || null,
      slotStart: booking.start || args.start_iso,
      calBookingUid: booking.uid,
      calMeetingUrl: booking.meetingUrl,
      summary: args.notes || db.getCall(callId)?.summary,
    });
    return {
      ok: true,
      message: "Booked. Confirm the walk-in time out loud and say they will get a confirmation email.",
      booking,
    };
  }
  if (name === "save_call_outcome") {
    db.patchCall(callId, {
      outcome: args.booked ? "booked" : "not_booked",
      summary: args.summary,
      patientName: args.patient_name || db.getCall(callId)?.patientName,
      patientEmail: args.patient_email || db.getCall(callId)?.patientEmail,
      patientPhone: args.patient_phone || db.getCall(callId)?.patientPhone,
      slotStart: args.slot_start || db.getCall(callId)?.slotStart,
    });
    return { ok: true };
  }
  return { ok: false, error: `Unknown tool ${name}` };
}

const TARGET_RATE = 16000;

// Captures both sides of the call as raw PCM and writes a synced stereo WAV:
// caller on the left channel, Maya on the right. Playable from the admin desk.
function createRecorder() {
  const caller = [];
  const maya = [];
  let callerSamples = 0; // at 16k
  let mayaSamples = 0; // at 24k
  return {
    caller(base64) {
      const buf = Buffer.from(base64, "base64");
      caller.push(buf);
      callerSamples += buf.length / 2;
    },
    maya(base64, mimeType) {
      const rate = /rate=(\d+)/.exec(mimeType || "")?.[1] || 24000;
      const buf = Buffer.from(base64, "base64");
      maya.push({ buf, rate: Number(rate) });
      mayaSamples += buf.length / 2 / (Number(rate) / TARGET_RATE);
    },
    hasAudio: () => callerSamples > 0 || mayaSamples > 0,
    writeWav(filePath) {
      const total = Math.max(callerSamples, Math.round(mayaSamples)) | 0;
      const left = Buffer.alloc(total * 2);
      let off = 0;
      for (const b of caller) {
        b.copy(left, off);
        off += b.length;
      }
      const right = Buffer.alloc(total * 2);
      let pos = 0; // float write position in samples
      for (const { buf, rate } of maya) {
        const step = rate / TARGET_RATE;
        const samples = buf.length / 2;
        for (let i = 0; i < samples; i++) {
          const idx = Math.round(pos) * 2;
          if (idx + 1 >= right.length) break;
          buf.copy(right, idx, i * 2, i * 2 + 2);
          pos += step;
        }
      }
      const dataLength = total * 4;
      const header = Buffer.alloc(44);
      header.write("RIFF", 0);
      header.writeUInt32LE(36 + dataLength, 4);
      header.write("WAVE", 8);
      header.write("fmt ", 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20); // PCM
      header.writeUInt16LE(2, 22); // stereo
      header.writeUInt32LE(TARGET_RATE, 24);
      header.writeUInt32LE(TARGET_RATE * 4, 28);
      header.writeUInt16LE(4, 32);
      header.writeUInt16LE(16, 34);
      header.write("data", 36);
      header.writeUInt32LE(dataLength, 40);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, Buffer.concat([header, left, right]));
    },
  };
}

export async function attachLiveSession(clientWs, { timezone } = {}) {
  const { ws: gemini, model } = await connectWithFallback();
  const call = db.createCall({ model });
  const recorder = createRecorder();
  clientWs.send(JSON.stringify({ type: "ready", callId: call.id, model }));

  const kickoff = {
    clientContent: {
      turns: [
        {
          role: "user",
          parts: [
            {
              text: `A new website visitor just tapped the booking bubble. Timezone guess: ${timezone || "Europe/London"}. Greet them as Maya and start helping. Do not wait for more text.`,
            },
          ],
        },
      ],
      turnComplete: true,
    },
  };
  gemini.send(JSON.stringify(kickoff));

  let closed = false;
  const closeBoth = (reason) => {
    if (closed) return;
    closed = true;
    db.patchCall(call.id, {
      status: "completed",
      endedAt: new Date().toISOString(),
    });
    if (recorder.hasAudio()) {
      try {
        const file = path.join(process.cwd(), "data", "recordings", `${call.id}.wav`);
        recorder.writeWav(file);
        db.patchCall(call.id, { recording: true });
      } catch (err) {
        console.warn(`[maya] recording save failed: ${err.message}`);
      }
    }
    try {
      clientWs.send(JSON.stringify({ type: "ended", reason: reason || "done" }));
    } catch {
      /* ignore */
    }
    try {
      gemini.close();
    } catch {
      /* ignore */
    }
    try {
      clientWs.close();
    } catch {
      /* ignore */
    }
  };

  gemini.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.error) {
      clientWs.send(JSON.stringify({ type: "error", message: msg.error.message }));
      return;
    }
    const sc = msg.serverContent;
    if (sc?.interrupted) {
      clientWs.send(JSON.stringify({ type: "interrupted" }));
    }
    if (sc?.modelTurn?.parts) {
      for (const part of sc.modelTurn.parts) {
        if (part.inlineData?.data) {
          recorder.maya(part.inlineData.data, part.inlineData.mimeType);
          clientWs.send(
            JSON.stringify({
              type: "audio",
              mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
              data: part.inlineData.data,
            })
          );
        }
        if (part.text) {
          db.appendTranscript(call.id, {
            role: "maya",
            text: part.text,
            at: new Date().toISOString(),
          });
          clientWs.send(JSON.stringify({ type: "transcript", role: "maya", text: part.text }));
        }
      }
    }
    if (sc?.inputTranscription?.text) {
      db.appendTranscript(call.id, {
        role: "caller",
        text: sc.inputTranscription.text,
        at: new Date().toISOString(),
        partial: !sc.inputTranscription.finished,
      });
      clientWs.send(
        JSON.stringify({
          type: "transcript",
          role: "caller",
          text: sc.inputTranscription.text,
        })
      );
    }
    if (sc?.outputTranscription?.text) {
      db.appendTranscript(call.id, {
        role: "maya",
        text: sc.outputTranscription.text,
        at: new Date().toISOString(),
        partial: !sc.outputTranscription.finished,
      });
      clientWs.send(
        JSON.stringify({
          type: "transcript",
          role: "maya",
          text: sc.outputTranscription.text,
        })
      );
    }
    if (sc?.turnComplete) {
      clientWs.send(JSON.stringify({ type: "turnComplete" }));
    }
    if (msg.toolCall?.functionCalls) {
      const functionResponses = [];
      for (const fc of msg.toolCall.functionCalls) {
        let result;
        try {
          result = await runTool(fc.name, fc.args || {}, call.id);
        } catch (err) {
          result = { ok: false, error: err.message };
        }
        clientWs.send(JSON.stringify({ type: "tool", name: fc.name, result }));
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result },
        });
      }
      gemini.send(JSON.stringify({ toolResponse: { functionResponses } }));
    }
  });

  gemini.on("close", () => closeBoth("gemini_closed"));
  gemini.on("error", (err) => {
    try {
      clientWs.send(JSON.stringify({ type: "error", message: err.message }));
    } catch {
      /* ignore */
    }
    closeBoth("gemini_error");
  });

  clientWs.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === "audio" && msg.data) {
      recorder.caller(msg.data);
      gemini.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: msg.data,
              mimeType: "audio/pcm;rate=16000",
            },
          },
        })
      );
    }
    if (msg.type === "text" && msg.text) {
      gemini.send(JSON.stringify({ realtimeInput: { text: String(msg.text).slice(0, 500) } }));
    }
    if (msg.type === "pointer" && msg.text) {
      // Silent context: what the caller's cursor is hovering over on the page.
      // Never acknowledged aloud unless the caller asks about it.
      gemini.send(
        JSON.stringify({
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: `[Context — do not speak about this note itself] The caller's cursor is now pointing at this part of the website: "${String(msg.text).slice(0, 400)}". If they ask "what is this?" or similar about what they're looking at, explain that thing naturally, briefly, in your own words as Maya. If it's a treatment, describe it simply and offer to book it. Do not interrupt the conversation to announce this.`,
                  },
                ],
              },
            ],
            turnComplete: true,
          },
        })
      );
    }
    if (msg.type === "activity_start") {
      gemini.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
    }
    if (msg.type === "activity_end") {
      gemini.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
    }
    if (msg.type === "barge_in") {
      // Browser playback has already stopped. Audio packets continue immediately,
      // so Gemini's server-side VAD receives the interruption and cancels its turn.
      try {
        clientWs.send(JSON.stringify({ type: "interrupted", source: "local_vad" }));
      } catch {
        /* ignore */
      }
    }
    if (msg.type === "end") closeBoth("client_end");
  });

  clientWs.on("close", () => closeBoth("client_closed"));
  clientWs.on("error", () => closeBoth("client_error"));
}
