export interface YoutubeVideo { id: string; start: number }

export function parseYoutubeLink(text: string): YoutubeVideo | null {
  try {
    const url = new URL(text.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    let id: string | null = null;
    if (host === 'youtu.be') id = parts.length === 1 ? parts[0] : null;
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (['shorts', 'embed', 'live'].includes(parts[0]) && parts.length === 2) id = parts[1];
    }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    const raw = url.searchParams.get('t') || url.searchParams.get('start') || new URLSearchParams(url.hash.slice(1)).get('t') || '0';
    let start = 0;
    if (/^\d+(?:\.\d+)?$/.test(raw)) start = Number(raw);
    else if (/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.test(raw)) {
      const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)!;
      start = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
    }
    return { id, start: Math.min(86400, Math.max(0, start)) };
  } catch { return null; }
}

export interface YoutubePlayer {
  playVideo(): void; pauseVideo(): void; seekTo(seconds: number, ahead: boolean): void;
  getCurrentTime(): number; getDuration(): number; getPlayerState(): number;
  getPlaybackRate(): number; getAvailablePlaybackRates(): number[];
  setPlaybackRate(rate: number): void; setVolume(volume: number): void; destroy(): void;
}
export interface YoutubeAPI {
  Player: new (element: HTMLElement, options: {
    events: { onReady: () => void; onStateChange: (event: { data: number }) => void;
      onPlaybackRateChange: (event: { data: number }) => void; onError: (event: { data: number }) => void;
      onAutoplayBlocked: () => void };
  }) => YoutubePlayer;
}
type YoutubeWindow = Window & { YT?: YoutubeAPI; onYouTubeIframeAPIReady?: () => void };
let loading: Promise<YoutubeAPI> | null = null;

export function loadYoutubeAPI(): Promise<YoutubeAPI> {
  const win = window as YoutubeWindow;
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previous = win.onYouTubeIframeAPIReady;
    const cleanup = () => { clearTimeout(timeout); win.onYouTubeIframeAPIReady = previous; };
    const fail = () => { cleanup(); script.remove(); loading = null; reject(new Error('YouTube non disponibile. Controlla la connessione e riprova.')); };
    const timeout = window.setTimeout(fail, 15000);
    win.onYouTubeIframeAPIReady = () => {
      cleanup(); previous?.();
      if (win.YT?.Player) resolve(win.YT); else fail();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}

export function youtubeError(code: number): string {
  if (code === 100) return 'Video non disponibile: potrebbe essere privato o eliminato.';
  if (code === 101 || code === 150) return 'Questo video non consente la riproduzione dentro altre app. Prova un altro video o carica il file audio.';
  if (code === 153) return 'YouTube non riesce a identificare il lettore. Prova ad aprire MyGitHub in Safari o nel browser.';
  if (code === 2) return 'Il link del video non è valido.';
  return 'YouTube non riesce a riprodurre il video. Riprova o scegli un altro video.';
}

export function practiceRates(rates: number[], start: number, end: number): number[] {
  return [...new Set(rates)].filter(r => Number.isFinite(r) && r > 0 && r >= start && r <= end).sort((a, b) => a - b);
}
