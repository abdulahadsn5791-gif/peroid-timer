import { write } from "bun";

const SAMPLE_RATE = 44100;

function tone(freq: number, startSec: number, durSec: number, buf: Float32Array): void {
  const start = Math.round(startSec * SAMPLE_RATE);
  const n = Math.round(durSec * SAMPLE_RATE);
  const attack = Math.max(1, Math.round(SAMPLE_RATE * 0.02));
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env =
      i < attack
        ? i / attack
        : Math.max(0, 1 - Math.pow((i / n - 0.5) * 2, 6));
    buf[start + i] += Math.sin(2 * Math.PI * freq * t) * 0.32 * env;
  }
}

function buildWav(beats: Array<[number, number, number]>): Uint8Array {
  const totalDur = 1.3;
  const total = Math.round(totalDur * SAMPLE_RATE);
  const samples = new Float32Array(total);
  for (const [freq, start, dur] of beats) tone(freq, start, dur, samples);

  const dataLen = total * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);

  let off = 44;
  for (let i = 0; i < total; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, Math.round(v * 32767), true);
    off += 2;
  }
  return new Uint8Array(buf);
}

const wav = buildWav([
  [880, 0, 0.18],
  [880, 0.25, 0.18],
  [880, 0.5, 0.3],
]);

await write(new URL("../assets/period-end.wav", import.meta.url), wav);
console.log(`assets/period-end.wav written (${wav.length} bytes)`);