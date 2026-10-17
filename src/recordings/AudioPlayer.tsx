import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, Repeat2, RotateCcw, SkipBack, SkipForward, Square } from "lucide-react";

export function audioTime(seconds: number, precise = false): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const fraction = precise ? `,${Math.floor((Math.max(0, seconds) % 1) * 10)}` : "";
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}${fraction}`;
}

export function AudioPlayer({ blob, duration, active = true, filename = "registrazione" }: {
  blob: Blob; duration: number; active?: boolean; filename?: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [length, setLength] = useState(duration);
  const [error, setError] = useState("");
  const [segment, setSegment] = useState(false);
  const [a, setA] = useState(0);
  const [b, setB] = useState(duration);
  const [loop, setLoop] = useState(false);
  const [segmentPlayback, setSegmentPlayback] = useState(false);
  const validSegment = b - a >= 0.1;

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => { URL.revokeObjectURL(objectUrl); };
  }, [blob]);
  useEffect(() => { if (!active) audio.current?.pause(); }, [active]);
  // A ref keeps cleanup tied to the actual audio element even after unmount.
  useEffect(() => { const element = audio.current; return () => { element?.pause(); element?.removeAttribute("src"); element?.load(); }; }, []);

  const seek = (seconds: number) => {
    const element = audio.current;
    if (!element) return;
    const next = Math.max(0, Math.min(length, seconds));
    try { element.currentTime = next; setPosition(next); setError(""); }
    catch { setError("Attendi il caricamento dell’audio e riprova."); }
  };
  const play = async (fromSegment = false) => {
    const element = audio.current;
    if (!element) return;
    setSegmentPlayback(fromSegment);
    if (fromSegment || (loop && validSegment && (element.currentTime < a || element.currentTime >= b))) seek(a);
    else if (element.ended || element.currentTime >= length) seek(0);
    try { await element.play(); setError(""); }
    catch { setPlaying(false); setError("Impossibile riprodurre l’audio. Riprova o scaricalo sul dispositivo."); }
  };
  const stop = () => { audio.current?.pause(); setSegmentPlayback(false); seek(0); };
  useEffect(() => {
    if (!playing || (!loop && !segmentPlayback) || !validSegment) return;
    let frame = 0;
    const tick = () => {
      const element = audio.current;
      if (element && (element.currentTime >= b || (loop && element.currentTime < a - 0.05))) {
        if (loop) { element.currentTime = a; setPosition(a); }
        else { element.pause(); setSegmentPlayback(false); }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, loop, segmentPlayback, validSegment, a, b]);

  const updateDuration = () => {
    const measured = audio.current?.duration;
    // Some MediaRecorder WebM containers report Infinity. The capture clock is
    // the trustworthy fallback, excluding all paused intervals.
    if (measured && Number.isFinite(measured)) {
      setLength(measured); setA((value) => Math.min(value, Math.max(0, measured - .1)));
      setB((value) => Math.min(value, measured));
    }
  };
  const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("wav") ? "wav" : "webm";
  return <div className="recording-player">
    <audio ref={audio} src={url || undefined} preload="metadata"
      onLoadedMetadata={updateDuration} onDurationChange={updateDuration}
      onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onEnded={() => { if (loop && validSegment && active) void play(true); else { setPlaying(false); setSegmentPlayback(false); seek(0); } }}
      onError={() => { if (url) setError("L’audio non è riproducibile in questo browser. Puoi scaricarlo e aprirlo sul dispositivo."); }} />
    <div className="recording-timeline">
      <input aria-label="Posizione nella registrazione" type="range" min={0} max={length || 1} step="0.01"
        value={Math.min(position, length)} disabled={!url} onChange={(event) => seek(Number(event.target.value))} />
      <div className="recording-time-labels"><span>{audioTime(position)}</span><span>{audioTime(length)}</span></div>
    </div>
    <div className="recording-transport">
      <button className="icon-btn" aria-label="Indietro di 10 secondi" onClick={() => seek(position - 10)} disabled={!url}><SkipBack size={19} /><small>10</small></button>
      <button className="btn btn-primary recording-play" aria-label={playing ? "Pausa riascolto" : "Riproduci registrazione"} disabled={!url || !active}
        onClick={() => playing ? audio.current?.pause() : void play()}>{playing ? <Pause size={23} /> : <Play size={23} />}</button>
      <button className="icon-btn" aria-label="Stop e torna all’inizio" onClick={stop} disabled={!url}><Square size={19} /></button>
      <button className="icon-btn" aria-label="Avanti di 10 secondi" onClick={() => seek(position + 10)} disabled={!url}><SkipForward size={19} /><small>10</small></button>
    </div>
    <div className="recording-player-links">
      <button className="btn btn-soft btn-sm" aria-expanded={segment} onClick={() => { setSegment(!segment); if (segment) setLoop(false); }}><Repeat2 size={16} /> Riascolta un passaggio</button>
      <a className="icon-btn" aria-label="Scarica audio" href={url || undefined} download={`${filename.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 90) || "registrazione"}.${extension}`}><Download size={18} /></a>
    </div>
    {segment && <div className="recording-segment">
      <div className="recording-segment-times"><span>Da <b>{audioTime(a, true)}</b></span><span>a <b>{audioTime(b, true)}</b></span></div>
      <div className="recording-actions">
        <button className="btn btn-soft btn-sm" onClick={() => setA(Math.max(0, Math.min(position, b - .1)))}>Inizio qui</button>
        <button className="btn btn-soft btn-sm" onClick={() => setB(Math.min(length, Math.max(position, a + .1)))}>Fine qui</button>
        <button className={`btn btn-sm ${loop ? "btn-primary" : "btn-soft"}`} aria-pressed={loop} disabled={!validSegment} onClick={() => setLoop(!loop)}><Repeat2 size={15} /> Ripeti A–B</button>
      </div>
      <button className="btn btn-soft btn-sm" onClick={() => void play(true)} disabled={!validSegment || !active}><RotateCcw size={16} /> Ascolta da qui</button>
      <p className="tiny text3">Sposta il cursore e segna inizio e fine del passaggio. L’audio originale rimane intero.</p>
    </div>}
    {error && <p className="recording-error" role="alert">{error}</p>}
  </div>;
}
