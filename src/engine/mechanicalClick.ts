/** Deterministic, dry mechanical tick; time is expressed in seconds. */
export function mechanicalClickSamples(sampleRate: number, accent = false): Float32Array {
  const duration = 0.06;
  const data = new Float32Array(Math.ceil(sampleRate * duration));
  const pitch = accent ? 1.1 : 1;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const attack = 1 - Math.exp(-t / 0.00018);
    const body = 0.64 * Math.sin(2 * Math.PI * 920 * pitch * t) * Math.exp(-t / 0.009)
      + 0.28 * Math.sin(2 * Math.PI * 1730 * pitch * t) * Math.exp(-t / 0.005)
      + 0.16 * Math.sin(2 * Math.PI * 2870 * pitch * t) * Math.exp(-t / 0.0025);
    const release = Math.min(1, (duration - t) / 0.004);
    data[i] = body * attack * release;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  for (let i = 0; i < data.length; i++) data[i] *= 0.86 / peak;
  return data;
}

const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
export function mechanicalBuffer(context: BaseAudioContext, role: "beat" | "accent" | "sub"): AudioBuffer {
  let cache = buffers.get(context);
  if (!cache) { cache = new Map(); buffers.set(context, cache); }
  const key = role === "accent" ? "accent" : "beat";
  let buffer = cache.get(key);
  if (!buffer) {
    const samples = mechanicalClickSamples(context.sampleRate, key === "accent");
    buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.getChannelData(0).set(samples);
    cache.set(key, buffer);
  }
  return buffer;
}
