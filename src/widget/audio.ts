export function downsampleTo16k(float32: Float32Array, inputRate: number): Int16Array {
  const ratio = inputRate / 16000;
  const outLen = Math.floor(float32.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const sample = float32[Math.floor(i * ratio)] || 0;
    const s = Math.max(-1, Math.min(1, sample));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function int16ToBase64(data: Int16Array): string {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export class PcmPlayer {
  ctx: AudioContext;
  nextTime = 0;
  level = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private playingUntil = 0;

  constructor(sampleRate = 24000) {
    this.ctx = new AudioContext({ sampleRate });
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  interrupt() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextTime = this.ctx.currentTime;
    this.playingUntil = this.ctx.currentTime;
    this.level = 0;
  }

  isPlaying() {
    return this.ctx.currentTime < this.playingUntil - 0.03;
  }

  enqueue(int16: Int16Array, sampleRate = 24000) {
    if (!int16.length) return;
    const buffer = this.ctx.createBuffer(1, int16.length, sampleRate);
    const ch = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < int16.length; i++) {
      const v = int16[i] / 0x8000;
      ch[i] = v;
      sum += v * v;
    }
    this.level = Math.min(Math.sqrt(sum / int16.length) * 4, 1);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    const start = Math.max(this.ctx.currentTime, this.nextTime);
    src.start(start);
    this.nextTime = start + buffer.duration;
    this.playingUntil = this.nextTime;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  close() {
    this.interrupt();
    this.ctx.close().catch(() => undefined);
  }
}
