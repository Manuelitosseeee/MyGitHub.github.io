/** Music theory helpers shared by tuner, metronome display and data logic.
 *  A4 = 440 Hz reference, MIDI note numbers (69 = A4). */

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_NAMES_IT = [
  "Do",
  "Do#",
  "Re",
  "Re#",
  "Mi",
  "Fa",
  "Fa#",
  "Sol",
  "Sol#",
  "La",
  "La#",
  "Si",
];

export function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiName(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function midiLabelIT(midi: number): string {
  return `${NOTE_NAMES_IT[midi % 12]}${midiOctave(midi)}`;
}

export interface NoteResult {
  midi: number;
  name: string; // e.g. "E"
  nameIT: string; // e.g. "Mi"
  octave: number; // scientific pitch octave (E4 = 329.63 Hz)
  freq: number; // measured frequency (smoothed)
  targetFreq: number; // equal-tempered frequency of the note
  cents: number; // deviation from the target note, -50..+50
}

/** Standard guitar tuning (E2 A2 D3 G3 B3 E4), low to high. */
export const GUITAR_STRINGS: Array<{
  midi: number;
  octave: number;
  name: string;
  freq: number;
  label: string;
  short: string;
}> = [
  { midi: 40, name: "E", octave: 2, freq: 82.41, label: "6ª corda · Mi grave", short: "Mi2" },
  { midi: 45, name: "A", octave: 2, freq: 110.0, label: "5ª corda · La", short: "La2" },
  { midi: 50, name: "D", octave: 3, freq: 146.83, label: "4ª corda · Re", short: "Re3" },
  { midi: 55, name: "G", octave: 3, freq: 196.0, label: "3ª corda · Sol", short: "Sol3" },
  { midi: 59, name: "B", octave: 3, freq: 246.94, label: "2ª corda · Si", short: "Si3" },
  { midi: 64, name: "E", octave: 4, freq: 329.63, label: "1ª corda · Mi cantino", short: "Mi4" },
];

export interface DetectedNote extends NoteResult {
  stringIndex: number | null; // index in GUITAR_STRINGS when it matches a string
  stringLabel: string | null;
  clamped: boolean; // below or above the useful tuning range
}

const clampFreq = (f: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, f));

/** Convert a smoothed measured frequency to a note + cents + matching string. */
export function noteFromFreq(freq: number): DetectedNote {
  const midi = freqToMidi(freq);
  const target = midiToFreq(midi);
  const cents = Math.round(1200 * Math.log2(freq / target));
  let stringIndex: number | null = null;
  const clamped = freq < 30 || freq > 1800;
  const idx = GUITAR_STRINGS.findIndex((s) => s.midi === midi);
  if (idx >= 0) stringIndex = idx;
  return {
    midi,
    name: midiName(midi),
    nameIT: NOTE_NAMES_IT[midi % 12],
    octave: midiOctave(midi),
    freq: clampFreq(freq, 20, 4000),
    targetFreq: target,
    cents: clamp(cents, -50, 50),
    stringIndex,
    stringLabel: stringIndex !== null ? GUITAR_STRINGS[stringIndex].label : null,
    clamped,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Typical note frequency ranges used by the tuner's peak guard. */
export const TUNING_MIN_HZ = 30;
export const TUNING_MAX_HZ = 1500;
