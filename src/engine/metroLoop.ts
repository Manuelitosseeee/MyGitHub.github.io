import { mechanicalClickSamples } from './mechanicalClick';
import type { MetronomeConfig } from './metronome';

/** A real, audible PCM loop. Playback belongs to the media subsystem, not a
 * JavaScript timer (which Safari throttles when the screen is locked). */
export const LOOP_SAMPLE_RATE = 44100;
export const subdivisionCount = (sub: MetronomeConfig['subdivision']) =>
  ({ none: 1, eighth: 2, triplet: 3, sixteenth: 4 })[sub];

export function clickSamples(sound: MetronomeConfig['sound'], role: 'beat'|'accent'|'sub', rate = LOOP_SAMPLE_RATE): Float32Array {
  if (sound === 'mechanical') return mechanicalClickSamples(rate, role === 'accent');
  const dur = sound === 'classic' ? .045 : .07;
  const out = new Float32Array(Math.ceil(rate * (dur + .02)));
  const freq = role === 'accent' ? (sound === 'digital' ? 1568 : 1900) : sound === 'digital' ? 1046 : 1400;
  for (let i = 0; i < out.length; i++) {
    const sec = i / rate;
    if (sound === 'digital') {
      const envelope = sec < .002 ? .0001 * Math.pow(3500, sec / .002)
        : sec < dur ? .35 * Math.pow(.0001 / .35, (sec - .002) / (dur - .002)) : .0001;
      out[i] = (Math.sin(2 * Math.PI * (role === 'sub' ? 660 : freq) * sec) >= 0 ? 1 : -1) * envelope;
    } else {
      const len = Math.floor(rate * dur), t = i / len;
      if (i < len) out[i] = ((sound === 'classic' ? .65 : .3) * Math.sin(2 * Math.PI * freq * t * (sound === 'classic' ? 1 : .5))
        + (sound === 'classic' ? .35 : .7) * (Math.random() * 2 - 1)) * Math.pow(1 - t, 2.4);
      if (role === 'accent' && sec < .06) {
        const env = sec < .002 ? .0001 * Math.pow(1200, sec / .002)
          : sec < .05 ? .12 * Math.pow(.0001 / .12, (sec - .002) / .048) : .0001;
        out[i] += Math.sin(2 * Math.PI * 2400 * sec) * env;
      }
    }
  }
  return out;
}

export function renderLoop(config: MetronomeConfig, rate = LOOP_SAMPLE_RATE): { samples: Float32Array; duration: number } {
  const per = subdivisionCount(config.subdivision);
  const step = 60 / config.bpm / per;
  const duration = 60 / config.bpm * config.weights.length;
  const samples = new Float32Array(Math.round(duration * rate));
  const clicks = { beat: clickSamples(config.sound, 'beat', rate), accent: clickSamples(config.sound, 'accent', rate), sub: clickSamples(config.sound, 'sub', rate) };
  for (let pulse = 0; pulse < config.weights.length * per; pulse++) {
    const beat = Math.floor(pulse / per), sub = pulse % per;
    const weight = sub === 0 ? config.weights[beat] : 1;
    if (weight === 0) continue;
    const role = sub > 0 ? 'sub' : weight === 2 || beat === 0 ? 'accent' : 'beat';
    const gain = (sub > 0 ? .55 : weight === 2 ? (beat === 0 && per > 1 ? 1 : .95) : beat === 0 ? .8 : .9) * .9 * config.volume;
    const start = Math.round(pulse * step * rate), data = clicks[role];
    for (let i = 0; i < data.length; i++) samples[(start + i) % samples.length] += data[i] * gain;
  }
  return { samples, duration: samples.length / rate };
}

export function wavBuffer(samples: Float32Array, rate = LOOP_SAMPLE_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const sample = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true); }
  return buffer;
}
