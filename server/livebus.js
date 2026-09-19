// Tiny pub/sub bus that carries live call audio between the voice session
// (gemini-live.js publishes) and admin monitors (index.js /ws/monitor
// subscribes). Chunks are base64 PCM with their native sample rate.
import { EventEmitter } from "node:events";

const bus = new EventEmitter();
bus.setMaxListeners(100);

export function publish(callId, channel, base64, rate) {
  bus.emit(callId, { channel, base64, rate });
}

export function subscribe(callId, fn) {
  bus.on(callId, fn);
  return () => bus.off(callId, fn);
}
