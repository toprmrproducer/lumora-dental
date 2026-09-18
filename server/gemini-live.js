import { WebSocket } from "ws";
import { MAYA_SYSTEM_PROMPT, LIVE_TOOLS } from "./prompt.js";
import * as db from "./db.js";
import * as cal from "./cal.js";

const GEMINI_WS =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

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
      systemInstruction: { parts: [{ text: MAYA_SYSTEM_PROMPT }] },
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
  const key = process.env.GEMINI_API_KEY;
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
      message: "Booked. Confirm the time out loud and mention the Google Meet invite email.",
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

export async function attachLiveSession(clientWs, { timezone } = {}) {
  const { ws: gemini, model } = await connectWithFallback();
  const call = db.createCall({ model });
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
