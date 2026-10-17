export type CaptureStatus = "idle" | "requesting" | "recording" | "paused" | "finishing" | "review";
export interface CaptureSnapshot {
  status: CaptureStatus;
  seconds: number;
  level: number;
  blob: Blob | null;
  error: string;
}

export function microphoneError(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Accesso al microfono non consentito. Riabilitalo nei permessi del sito o nelle impostazioni del browser, poi riprova.";
  if (name === "NotFoundError") return "Nessun microfono trovato. Collega un microfono e riprova.";
  if (name === "NotReadableError") return "Il microfono non è disponibile. Chiudi le altre app che lo stanno usando e riprova.";
  return "Impossibile avviare la registrazione. Controlla il microfono e riprova.";
}

/** A single take. No audio is routed to speakers; pauses never add recorded time. */
export class RecordingCapture {
  snapshot: CaptureSnapshot = { status: "idle", seconds: 0, level: 0, blob: null, error: "" };
  private listeners = new Set<() => void>();
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private samples: Uint8Array | null = null;
  private chunks: Blob[] = [];
  private elapsed = 0;
  private startedAt: number | null = null;
  private generation = 0;
  private timer: number | null = null;

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;

  private update(patch: Partial<CaptureSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private seconds() { return (this.elapsed + (this.startedAt === null ? 0 : performance.now() - this.startedAt)) / 1000; }
  private freezeClock() { if (this.startedAt !== null) this.elapsed += performance.now() - this.startedAt; this.startedAt = null; }

  async start(): Promise<void> {
    if (["requesting", "recording", "paused", "finishing"].includes(this.snapshot.status)) return;
    this.cancel();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      this.update({ error: "La registrazione richiede un browser compatibile e una connessione HTTPS. Prova Safari o Chrome aggiornato." });
      return;
    }
    this.update({ status: "requesting", error: "" });
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (generation !== this.generation) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.stream = stream;
      const mimeType = ["audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 192000 });
      this.recorder = recorder;
      recorder.ondataavailable = (event) => { if (generation === this.generation && event.data.size) this.chunks.push(event.data); };
      recorder.onstop = () => {
        if (generation !== this.generation) return;
        this.freezeClock();
        const blob = new Blob(this.chunks, { type: recorder.mimeType || this.chunks[0]?.type || "audio/webm" });
        this.chunks = [];
        this.release();
        if (!blob.size) { this.update({ status: "idle", blob: null, level: 0, error: "Non è stato registrato audio. Controlla il microfono e riprova." }); return; }
        this.update({ status: "review", seconds: this.seconds(), level: 0, blob });
      };
      recorder.onerror = () => {
        if (generation !== this.generation) return;
        this.update({ error: "La registrazione è stata interrotta. Puoi riascoltare e salvare la parte acquisita, se disponibile." });
        if (recorder.state !== "inactive") this.stop();
      };
      stream.getAudioTracks().forEach((track) => { track.onended = () => {
        if (generation !== this.generation) return;
        this.update({ error: "Il microfono si è scollegato. Riascolta la parte acquisita prima di salvarla." });
        this.stop();
      }; });
      // The meter is optional: an AudioContext failure must not lose a take.
      try {
        const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.context = new Context();
        this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256;
        this.samples = new Uint8Array(256);
        this.context.createMediaStreamSource(stream).connect(this.analyser);
        void this.context.resume().catch(() => undefined);
      } catch { /* Recording still works without a level meter. */ }
      recorder.start(1000);
      this.startedAt = performance.now();
      this.update({ status: "recording" });
      this.timer = window.setInterval(() => {
        let level = 0;
        if (this.snapshot.status === "recording" && this.analyser && this.samples) {
          this.analyser.getByteTimeDomainData(this.samples);
          level = Math.min(1, Math.sqrt(this.samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / this.samples.length) * 4);
        }
        this.update({ seconds: this.seconds(), level });
      }, 100);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (generation !== this.generation) return;
      this.release(); this.update({ status: "idle", error: microphoneError(error) });
    }
  }

  pause(): void {
    if (this.recorder?.state !== "recording") return;
    try { this.recorder.pause(); this.freezeClock(); this.update({ status: "paused", seconds: this.seconds(), level: 0 }); }
    catch { this.update({ error: "Impossibile mettere in pausa. Termina la registrazione per conservare l’audio." }); }
  }
  resume(): void {
    if (this.recorder?.state !== "paused") return;
    try { this.recorder.resume(); this.startedAt = performance.now(); this.update({ status: "recording" }); }
    catch { this.update({ error: "Impossibile riprendere. Termina la registrazione per conservare l’audio." }); }
  }
  stop(): void {
    if (!this.recorder || this.recorder.state === "inactive") return;
    this.freezeClock(); this.update({ status: "finishing", seconds: this.seconds(), level: 0 });
    this.recorder.stop();
  }
  cancel(): void {
    this.generation++;
    if (this.recorder) {
      this.recorder.ondataavailable = null; this.recorder.onstop = null; this.recorder.onerror = null;
      if (this.recorder.state !== "inactive") this.recorder.stop();
    }
    this.release(); this.chunks = []; this.elapsed = 0; this.startedAt = null;
    this.update({ status: "idle", seconds: 0, blob: null, level: 0, error: "" });
  }
  private release(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    this.stream = null; this.recorder = null;
    void this.context?.close().catch(() => undefined);
    this.context = null; this.analyser = null; this.samples = null;
  }
}
