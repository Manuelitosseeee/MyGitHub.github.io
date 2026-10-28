import { clamp } from "../lib/utils";
import { getAudioContext, configurePlaybackSession } from "./audio";
import { renderLoop, wavBuffer, clickSamples } from "./metroLoop";

export type MetroSound = "classic" | "digital" | "metallic" | "mechanical";
export type Subdivision = "none" | "eighth" | "triplet" | "sixteenth";
export type BeatWeight = 0 | 1 | 2; // silent / normal / accent

export interface MetronomeConfig {
  bpm: number;
  volume: number; // 0..1
  sound: MetroSound;
  subdivision: Subdivision;
  weights: BeatWeight[]; // per beat in the bar (length = beats per bar)
}

export const MIN_BPM = 20;
export const MAX_BPM = 400;

export const SUBDIVISIONS: Array<{ id: Subdivision; label: string; n: number }> = [
  { id: "none", label: "Semplice", n: 1 },
  { id: "eighth", label: "Ottavi", n: 2 },
  { id: "triplet", label: "Terzine", n: 3 },
  { id: "sixteenth", label: "Sedicesimi", n: 4 },
];

export function subdivisionsPerBeat(s: Subdivision): number {
  return SUBDIVISIONS.find((x) => x.id === s)?.n ?? 1;
}

export interface TickEvent {
  bar: number;
  beat: number; // 0-based beat index in bar
  sub: number; // subdivision index within the beat
  totalPulses: number; // pulses per bar
  pulseIndex: number; // global pulse index
  weight: BeatWeight;
  nextPulseSeconds: number;
}

export interface PatternInfo {
  beats: number;
  weights: BeatWeight[];
  subdivision: Subdivision;
  pulsesPerBar: number;
}

/** AudioWorklet owns the sample clock; an HTML audio stream preserves media
 * playback routing. Legacy browsers fall back to a PCM media loop. */
let workletReady: Promise<void> | null = null;
export class MetronomeEngine {
  private processor: AudioWorkletNode | null = null;
  private route: MediaStreamAudioDestinationNode | null = null;
  readonly kind: string;
  private cfg: MetronomeConfig;
  private media: HTMLAudioElement | null = null;
  private url: string | null = null;
  private timer: number | null = null;
  private revision = 0;
  private lastPulse = -1;
  private lastTime = 0;
  private bar = 0;
  private duration = 0;
  private renderedBpm = 100;
  private replacing = false;
  private stopScheduled = false;
  private _running = false;
  startedAt = 0;
  onTick: ((e: TickEvent) => void) | null = null;
  onExternalStop: (() => void) | null = null;
  constructor(kind: string, cfg: MetronomeConfig) { this.kind = kind; this.cfg = { ...cfg, weights: [...cfg.weights] }; }
  get running(): boolean { return this._running; }
  get bpm(): number { return this.cfg.bpm; }
  get config(): MetronomeConfig { return this.cfg; }
  get weights(): BeatWeight[] { return this.cfg.weights; }
  get pulsesPerBar(): number { return this.cfg.weights.length * subdivisionsPerBeat(this.cfg.subdivision); }
  setBpm(bpm: number): void { this.update({ bpm }); }
  update(patch: Partial<MetronomeConfig>): void {
    const previous = JSON.stringify(this.cfg);
    const previousPattern = JSON.stringify({...this.cfg, bpm:0});
    if (patch.bpm !== undefined) this.cfg.bpm = clamp(Math.round(patch.bpm), MIN_BPM, MAX_BPM);
    if (patch.volume !== undefined) this.cfg.volume = clamp(patch.volume, 0, 1);
    if (patch.sound !== undefined) this.cfg.sound = patch.sound;
    if (patch.subdivision !== undefined) this.cfg.subdivision = patch.subdivision;
    if (patch.weights?.length) this.cfg.weights = patch.weights.map(w => w === 0 ? 0 : w === 2 ? 2 : 1);

    if (this._running && this.processor) { this.updateProcessor(); return; }
    if (this._running && previous !== JSON.stringify(this.cfg)) {
      const rate = this.cfg.bpm / this.renderedBpm;
      if (this.media && previousPattern === JSON.stringify({...this.cfg,bpm:0}) && rate >= .25 && rate <= 4) {
        // No new element, source, seek or play(): timer-driven tempo changes
        // keep the existing authorized media timeline playing without a gap.
        this.media.playbackRate = rate;
        return;
      }
      const phase = this.duration ? ((this.media?.currentTime ?? 0) % this.duration) / this.duration : 0;
      // Called directly by the control gesture; do not defer play() to a timer.
      const pending = this.replaceLoop(phase);
      const revision = this.revision;
      void pending.catch(() => { if (revision === this.revision) this.forceStop(); });
    }
  }
  async start(): Promise<boolean> {
    if (this._running) return true;
    configurePlaybackSession();
    this._running = true;
    this.startedAt = performance.now();
    this.stopScheduled = false;
    this.bar = 0;
    const context = getAudioContext();
    const pending = context?.audioWorklet ? this.startProcessor(context) : this.replaceLoop(0), version = this.revision;
    try {
      await pending;
      if (!this._running || version !== this.revision) return false;
      if (!this.processor) this.timer = window.setInterval(() => this.visualTick(), 25);
      this.visualTick();
      this.registerMediaSession();
      return true;
    } catch { if (version === this.revision) this.stop(); return false; }
  }
  private updateProcessor(): void {
    const rate = getAudioContext()?.sampleRate ?? 44100;
    this.processor?.port.postMessage({cfg:this.cfg,samples:{beat:clickSamples(this.cfg.sound,'beat',rate),accent:clickSamples(this.cfg.sound,'accent',rate),sub:clickSamples(this.cfg.sound,'sub',rate)}});
  }
  private async startProcessor(context: AudioContext): Promise<void> {
    const version = ++this.revision;
    const route = context.createMediaStreamDestination();
    const audio = document.createElement('audio');
    audio.dataset.metronome=this.kind;audio.setAttribute('playsinline','');
    audio.style.display='none';audio.srcObject=route.stream;document.body.append(audio);
    this.route=route;this.media=audio;
    audio.onpause=()=>{if(this.media===audio&&audio.paused&&this._running)this.forceStop();};
    audio.onerror=()=>{if(this.media===audio)this.forceStop();};
    // Invoke both privileged operations within the original Play gesture.
    const resumed=context.resume(),playing=audio.play();
    if(!workletReady) workletReady=context.audioWorklet.addModule('/metronome-processor.js').catch(error=>{workletReady=null;throw error;});
    await Promise.all([resumed,playing,workletReady]);
    if(version!==this.revision||!this._running)return;
    const node=new AudioWorkletNode(context,'guitar-metronome',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});
    this.processor=node;
    node.port.onmessage=({data}:MessageEvent<TickEvent>)=>{
      if(!this._running)return;
      if(this.stopScheduled&&data.beat===0&&data.sub===0&&data.pulseIndex>0){this.forceStop();return;}
      this.onTick?.(data);
    };
    node.onprocessorerror=()=>this.forceStop();
    this.updateProcessor();node.connect(route);
  }
  private async replaceLoop(phase: number): Promise<void> {
    const version = ++this.revision;
    const rendered = renderLoop(this.cfg);
    // A longer PCM file minimizes media loop boundaries; the beat pattern is
    // still identical and does not depend on background JavaScript execution.
    const repeats = Math.max(1, Math.ceil(20 / rendered.duration));
    const samples = new Float32Array(rendered.samples.length * repeats);
    for (let i = 0; i < repeats; i++) samples.set(rendered.samples, i * rendered.samples.length);
    const url = URL.createObjectURL(new Blob([wavBuffer(samples)], { type: 'audio/wav' }));
    const audio = this.media ?? document.createElement('audio');
    this.replacing = true;
    this.renderedBpm = this.cfg.bpm;
    audio.dataset.metronome = this.kind;
    audio.loop = true;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.volume = 1;
    audio.src = url;
    audio.playbackRate = 1;
    audio.style.display = 'none';
    if (!audio.isConnected) document.body.append(audio);
    const offset = Math.max(0, Math.min(.999999, phase)) * rendered.duration;
    audio.onloadedmetadata = () => { if (version === this.revision && offset) audio.currentTime = offset; };
    const oldMedia = this.media, oldURL = this.url;
    this.media = audio; this.url = url; this.duration = rendered.duration;
    this.lastPulse = -1; this.lastTime = offset;
    // Detach the previous listener before pausing during a configuration change.
    if (oldMedia && oldMedia !== audio) { oldMedia.onpause = null; oldMedia.onerror = null; oldMedia.pause(); oldMedia.removeAttribute('src'); oldMedia.load(); oldMedia.remove(); }
    if (oldURL) URL.revokeObjectURL(oldURL);
    audio.onpause = () => { if (this.media === audio && this._running && audio.paused && !this.replacing) this.forceStop(); };
    audio.onerror = () => { if (this.media === audio) this.forceStop(); };
    // play() is deliberately invoked before the first await to retain iOS activation.
    await audio.play();
    if (version !== this.revision || !this._running) return;
    this.replacing = false;
  }
  private visualTick(): void {
    const audio = this.media;
    if (!this._running || !audio || audio.paused) return;
    const time = audio.currentTime % this.duration;
    if (time + .01 < this.lastTime) { this.bar++; if (this.stopScheduled) { this.forceStop(); return; } }
    this.lastTime = time;
    const per = subdivisionsPerBeat(this.cfg.subdivision), step = 60 / this.renderedBpm / per;
    const pulse = Math.min(this.pulsesPerBar - 1, Math.floor(time / step));
    if (pulse === this.lastPulse) return;
    this.lastPulse = pulse;
    const beat = Math.floor(pulse / per), sub = pulse % per;
    this.onTick?.({ bar: this.bar, beat, sub, totalPulses: this.pulsesPerBar,
      pulseIndex: this.bar * this.pulsesPerBar + pulse, weight: sub ? 1 : this.cfg.weights[beat], nextPulseSeconds: 60 / this.cfg.bpm / per });
  }
  private registerMediaSession(): void {
    if (!navigator.mediaSession) return;
    try {
      if (typeof MediaMetadata !== 'undefined') navigator.mediaSession.metadata = new MediaMetadata({ title: 'Metronomo', artist: 'MyGitHub' });
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.setActionHandler('pause', () => this.forceStop());
      navigator.mediaSession.setActionHandler('stop', () => this.forceStop());
    } catch { /* Optional platform controls. */ }
  }
  stop(): void {
    this._running = false;
    this.revision++;
    if(this.processor){this.processor.port.postMessage({stop:true});this.processor.port.onmessage=null;this.processor.disconnect();this.processor.port.close();this.processor=null;}
    if(this.route){this.route.stream.getTracks().forEach(track=>track.stop());this.route.disconnect();this.route=null;}
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    if (this.media) { this.media.onpause = null; this.media.onerror = null; this.media.pause(); this.media.removeAttribute('src'); this.media.load(); this.media.remove(); this.media = null; }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    if (exclusive === this && navigator.mediaSession) {
      try { navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.setActionHandler('pause', null); navigator.mediaSession.setActionHandler('stop', null); } catch { /* unsupported */ }
    }
  }
  preview(): void {
    configurePlaybackSession();
    const c = getAudioContext();
    if (!c) return;
    void c.resume();
    const data = clickSamples(this.cfg.sound, 'accent', c.sampleRate);
    const buffer = c.createBuffer(1, data.length, c.sampleRate); buffer.getChannelData(0).set(data);
    const source = c.createBufferSource(), gain = c.createGain();
    source.buffer = buffer; gain.gain.value = Math.max(.35, this.cfg.volume) * .9;
    source.connect(gain).connect(c.destination);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start();
  }
  forceStop(): void { const was = this._running; this.stop(); if (was) this.onExternalStop?.(); }
  stopAtBarEnd(): void { if (this._running) this.stopScheduled = true; }
}

/** Only one metronome can sound at a time app-wide. Starting a new engine
 *  force-stops the previous one (its owner is notified via onExternalStop). */
let exclusive: MetronomeEngine | null = null;

export function acquireExclusive(e: MetronomeEngine): void {
  if (exclusive && exclusive !== e && exclusive.running) exclusive.forceStop();
  exclusive = e;
}

export function releaseExclusive(e: MetronomeEngine): void {
  if (exclusive === e) exclusive = null;
}

export function getActiveEngine(): MetronomeEngine | null {
  return exclusive;
}

/** Short one-shot click so the user can hear a sound preset while choosing it. */
export function previewClick(sound: MetroSound, volume: number): void {
  const engine = new MetronomeEngine("preview", {
    bpm: 100,
    volume,
    sound,
    subdivision: "none",
    weights: [1],
  });
  engine.preview();
}
