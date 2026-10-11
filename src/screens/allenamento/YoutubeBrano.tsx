import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Repeat, X, Zap } from 'lucide-react';
import { Card, SectionTitle, Switch } from '../../ui/primitives';
import { formatDurationClock } from '../../lib/time';
import { loadYoutubeAPI, practiceRates, youtubeError } from '../../training/youtube';
import type { YoutubePlayer, YoutubeVideo } from '../../training/youtube';

export default function YoutubeBrano({ video, onClose }: { video: YoutubeVideo; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YoutubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rates, setRates] = useState<number[]>([1]);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(90);
  const [a, setA] = useState(video.start);
  const [b, setB] = useState(0);
  const [loop, setLoop] = useState(true);
  const [whole, setWhole] = useState(false);
  const [start, setStart] = useState(0.5);
  const [end, setEnd] = useState(1);
  const [reps, setReps] = useState(3);
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState({ step: 0, rep: 0 });
  const run = useRef<{ rates: number[]; step: number; rep: number; reps: number; a: number; b: number } | null>(null);
  const controls = useRef({ a, b, loop, whole, volume });
  controls.current = { a, b, loop, whole, volume };
  const rewind = useRef<{ at: number; target: number } | null>(null);

  const stopTraining = () => { run.current = null; setTraining(false); player.current?.pauseVideo(); };
  const seek = (t: number) => {
    player.current?.seekTo(t, true);
    setTime(t);
    rewind.current = { at: performance.now(), target: t };
  };

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;
    let timeout: number | undefined;
    let metadata = false;
    setReady(false); setError(''); setDuration(0); setPlaying(false);
    run.current = null; setTraining(false); rewind.current = null;
    const finishPass = () => {
      const p = player.current;
      if (!p || rewind.current) return;
      const r = run.current;
      if (r) {
        if (++r.rep >= r.reps) { r.rep = 0; r.step++; }
        if (r.step >= r.rates.length) { run.current = null; setTraining(false); setPlaying(false); p.pauseVideo(); return; }
        setProgress({ step: r.step, rep: r.rep });
        p.setPlaybackRate(r.rates[r.step]);
        rewind.current = { at: performance.now(), target: r.a };
        p.seekTo(r.a, true); p.playVideo();
      } else {
        const c = controls.current;
        if (c.whole || c.loop) {
          const target = c.whole ? 0 : c.a;
          rewind.current = { at: performance.now(), target };
          p.seekTo(target, true); p.playVideo();
        } else { p.pauseVideo(); setPlaying(false); }
      }
    };
    void loadYoutubeAPI().then(api => {
      if (cancelled || !host.current) return;
      const iframe = document.createElement('iframe');
      const params = new URLSearchParams({ enablejsapi: '1', origin: location.origin, playsinline: '1', start: String(Math.floor(video.start)) });
      iframe.src = `https://www.youtube.com/embed/${video.id}?${params}`;
      iframe.title = 'Video YouTube per lo studio';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.style.cssText = 'display:block;width:100%;height:100%;border:0';
      host.current.replaceChildren(iframe);
      timeout = window.setTimeout(() => { if (!cancelled) setError('Il lettore non risponde. Controlla la connessione e riprova.'); }, 20000);
      player.current = new api.Player(iframe, { events: {
        onReady: () => {
          if (cancelled) return;
          clearTimeout(timeout); setReady(true); setError('');
          const p = player.current!;
          const available = practiceRates(p.getAvailablePlaybackRates(), 0, Infinity);
          setRates(available.length ? available : [1]);
          setSpeed(p.getPlaybackRate()); p.setVolume(controls.current.volume);
          setStart(available.find(r => r >= 0.5) ?? 1);
          setEnd(available.includes(1) ? 1 : available.at(-1) ?? 1);
        },
        onStateChange: event => {
          if (cancelled) return;
          setPlaying(event.data === 1);
          if (event.data === 0) finishPass();
        },
        onPlaybackRateChange: event => { if (!cancelled) setSpeed(event.data); },
        onError: event => {
          if (cancelled) return;
          clearTimeout(timeout); setError(youtubeError(event.data)); setReady(false);
          run.current = null; setTraining(false); setPlaying(false);
        },
        onAutoplayBlocked: () => { if (!cancelled) { run.current = null; setTraining(false); setPlaying(false); setError('Premi Play direttamente nel video per avviare la riproduzione.'); } },
      } });
      interval = window.setInterval(() => {
        const p = player.current;
        if (!p || cancelled) return;
        const d = p.getDuration(), t = p.getCurrentTime();
        if (d > 0 && Number.isFinite(d)) {
          setDuration(d);
          if (!metadata) { metadata = true; setA(Math.min(video.start, Math.max(0, d - 0.4))); setB(d); }
        }
        if (!Number.isFinite(t)) return;
        setTime(t);
        if (rewind.current) {
          if (Math.abs(t - rewind.current.target) < 0.5) rewind.current = null;
          else if (performance.now() - rewind.current.at > 10000) {
            run.current = null; setTraining(false); p.pauseVideo(); rewind.current = null;
            setError('Il video non riesce a tornare al punto scelto. Riprova con un altro passaggio.');
          }
          return;
        }
        if (p.getPlayerState() !== 1) return; // Buffering and pauses never count as completed repetitions.
        const r = run.current, c = controls.current;
        const boundary = r ? r.b : c.whole ? d : c.b;
        if (boundary > 0 && t >= boundary - 0.04) finishPass();
      }, 100);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => {
      cancelled = true; clearInterval(interval); clearTimeout(timeout);
      run.current = null; player.current?.destroy(); player.current = null;
    };
  }, [video.id, video.start, retry]);

  useEffect(() => { if (ready) player.current?.setVolume(volume); }, [volume, ready]);
  const chooseRate = (rate: number) => {
    run.current = null; setTraining(false); player.current?.setPlaybackRate(rate);
  };
  const startTraining = () => {
    const path = practiceRates(rates, start, end);
    if (!player.current || path.length === 0 || b - a < 0.4) return;
    run.current = { rates: path, step: 0, rep: 0, reps, a, b };
    setTraining(true); setProgress({ step: 0, rep: 0 }); setError('');
    player.current.setPlaybackRate(path[0]); seek(a); player.current.playVideo();
  };
  const usable = ready && duration > 0;

  return <div className="train-body">
    <div className="harmony-keyline" style={{ marginBottom: 12 }}>
      <span style={{ flex: 1 }}>Video YouTube</span>
      <button className="harmony-act" aria-label="Cambia brano" onClick={onClose}><X size={16} /></button>
    </div>
    <div ref={host} style={{ width: '100%', aspectRatio: '16 / 9', minHeight: 200, background: '#101010', borderRadius: 12, overflow: 'hidden' }} />
    {!ready && !error && <p className="tiny text3" role="status">Caricamento del lettore YouTube…</p>}
    {error && <Card className="card-pad" style={{ marginTop: 12 }}><p role="alert">{error}</p>
      <button className="btn btn-soft" onClick={() => setRetry(n => n + 1)}>Riprova</button></Card>}
    <div className="brano-times"><span>{formatDurationClock(time)}</span><span>A {formatDurationClock(a)} · B {formatDurationClock(b)}</span><span>{formatDurationClock(duration)}</span></div>
    <input type="range" className="rng" aria-label="Posizione nel video" style={{ width: '100%' }} min={0} max={duration || 1} step={0.1} value={Math.min(time, duration)} disabled={!usable || training}
      onChange={e => seek(Number(e.target.value))} />
    <div className="brano-bar">
      <button className="brano-play" disabled={!usable} aria-label={playing ? 'Pausa video' : 'Riproduci video'} onClick={() => {
        if (playing) { player.current?.pauseVideo(); }
        else { setError(''); if (whole ? time >= duration : time < a || time >= b) seek(whole ? 0 : a); player.current?.playVideo(); }
      }}>{playing ? <Pause size={24} /> : <Play size={24} />}</button>
      <span className="brano-speed">{Math.round(speed * 100)}%</span>
    </div>
    <Card className="card-pad train-form" style={{ marginTop: 12 }}>
      <label className="train-label">Velocità</label>
      <div className="train-chips">{rates.map(rate => <button key={rate} className={`chip${speed === rate ? ' on' : ''}`} disabled={!ready} onClick={() => chooseRate(rate)}>{Math.round(rate * 100)}%</button>)}</div>
      <p className="tiny text3">Le velocità disponibili dipendono dal video YouTube.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label className="train-label">Inizio A (secondi)<input className="field" aria-label="Inizio del passaggio in secondi" type="number" min={0} max={Math.max(0, b - 0.4)} step={0.1} value={Math.round(a * 10) / 10} disabled={!usable || training} onChange={e => { setA(Math.min(Math.max(0, Number(e.target.value)), Math.max(0, b - 0.4))); rewind.current = null; }} /></label>
        <label className="train-label">Fine B (secondi)<input className="field" aria-label="Fine del passaggio in secondi" type="number" min={a + 0.4} max={duration} step={0.1} value={Math.round(b * 10) / 10} disabled={!usable || training} onChange={e => { setB(Math.min(duration, Math.max(a + 0.4, Number(e.target.value)))); rewind.current = null; }} /></label>
      </div>
      <div className="train-chips">
        <button className="chip" disabled={!usable || training || time >= b - 0.4} onClick={() => setA(time)}>Imposta A qui</button>
        <button className="chip" disabled={!usable || training || time <= a + 0.4} onClick={() => setB(time)}>Imposta B qui</button>
      </div>
      <div className="train-switch-row"><span className="train-switch-label">Ripeti il passaggio A–B<em>Riparte da A quando arriva a B</em></span><Switch on={loop} onChange={v => { setLoop(v); if (v) setWhole(false); }} /></div>
      <div className="train-switch-row"><span className="train-switch-label">Ripeti tutto il video</span><Switch on={whole} onChange={v => { setWhole(v); if (v) setLoop(false); }} /></div>
      <label className="train-label">Volume · {volume}%<input className="rng" aria-label="Volume video" type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))} /></label>
    </Card>
    <SectionTitle>Allenamento progressivo</SectionTitle>
    <Card className="card-pad train-form">
      <p className="tiny text3">Ripete il passaggio alle velocità supportate dal video, aumentando dopo le ripetizioni scelte.</p>
      <label className="train-label">Velocità iniziale<select className="field" aria-label="Velocità iniziale video" value={start} disabled={training} onChange={e => { const v = Number(e.target.value); setStart(v); setEnd(x => Math.max(x, v)); }}>{rates.map(r => <option key={r} value={r}>{Math.round(r * 100)}%</option>)}</select></label>
      <label className="train-label">Velocità finale<select className="field" aria-label="Velocità finale video" value={end} disabled={training} onChange={e => setEnd(Number(e.target.value))}>{rates.filter(r => r >= start).map(r => <option key={r} value={r}>{Math.round(r * 100)}%</option>)}</select></label>
      <label className="train-label">Ripetizioni per velocità<select className="field" aria-label="Ripetizioni per velocità video" value={reps} disabled={training} onChange={e => setReps(Number(e.target.value))}>{[1,2,3,4].map(r => <option key={r} value={r}>{r}</option>)}</select></label>
      {training ? <><p className="tiny text3"><Repeat size={12} /> {Math.round((run.current?.rates[progress.step] ?? speed) * 100)}% · ripetizione {progress.rep + 1} di {reps}</p><button className="btn btn-danger" onClick={stopTraining}><X size={16} /> Ferma allenamento</button></>
        : <button className="btn btn-primary" disabled={!usable || b - a < 0.4} onClick={startTraining}><Zap size={16} /> Da {Math.round(start * 100)}% a {Math.round(end * 100)}%</button>}
    </Card>
  </div>;
}
