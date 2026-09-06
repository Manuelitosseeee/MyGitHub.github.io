import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type FocusEvent as RFocusEvent,
  type PointerEvent as RPointerEvent,
  type TouchEvent as RTouchEvent,
} from "react";
import { Smile, Meh, Frown, X, ZoomIn, ZoomOut, Download } from "lucide-react";
import { clamp, cx } from "../lib/utils";
import type { Mood } from "../data/types";

/** Height (px) of the on-screen keyboard, 0 when closed. On iOS Safari the
 *  layout viewport keeps its full height when the keyboard opens, so fixed
 *  sheets would hide behind it without this offset. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setInset(Math.max(0, window.innerHeight - vv.height));
      });
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/* ---------------- Sheet (bottom modal) ---------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional fixed footer row pinned at the bottom of the sheet (e.g. the
   *  Annulla/Salva actions) so it never hides behind the keyboard. */
  footer?: ReactNode;
}) {
  const kb = useKeyboardInset();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const focusTarget = useRef<HTMLElement | null>(null);

  // Scrolls the *sheet body* (never the page behind it) so the focused field
  // stays visible. Needs retries: on iOS the sheet is still sliding in and the
  // keyboard is still animating when focus fires.
  const reveal = () => {
    const body = bodyRef.current;
    const t = focusTarget.current;
    if (!body || !t) return;
    const b = body.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    if (r.top < b.top + 6) body.scrollTop -= b.top + 6 - r.top;
    else if (r.bottom > b.bottom - 6) body.scrollTop += r.bottom - (b.bottom - 6);
  };

  const onFocusCapture = (e: RFocusEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement | null;
    if (!t || t === bodyRef.current) return;
    const tag = t.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
    focusTarget.current = t;
    [60, 240, 480].forEach((ms) => window.setTimeout(reveal, ms));
  };

  if (!open) return null;
  return (
    <div className="sheet-mask" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        style={
          kb > 0
            ? {
                // iOS Safari keeps the layout viewport full height under the
                // keyboard, so a bottom-anchored sheet would hide behind it.
                // Lift the whole sheet above the keys and cap its height to
                // the remaining visible space.
                marginBottom: kb,
                maxHeight: `calc(100dvh - ${kb}px - 10px)`,
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grab" />
        {title ? <div className="sheet-title">{title}</div> : null}
        <div ref={bodyRef} className="sheet-body" onFocusCapture={onFocusCapture}>
          {children}
        </div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---------------- Segmented control ---------------- */

export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.id}
          className={cx("seg-item", o.id === value && "active")}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Switch ---------------- */

export function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      className={cx("switch", on && "on")}
      onClick={() => onChange(!on)}
    />
  );
}

/* ---------------- Range slider with iOS styling ---------------- */

export function BpmSlider({
  value,
  min,
  max,
  onChange,
  onChangeEnd,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onChangeEnd?: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const style = { "--fill": `${pct}%` } as CSSProperties;
  return (
    <input
      type="range"
      className="rng"
      min={min}
      max={max}
      step={1}
      value={value}
      style={style}
      aria-label="BPM"
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={() => onChangeEnd?.()}
      onTouchEnd={() => onChangeEnd?.()}
      onKeyUp={() => onChangeEnd?.()}
    />
  );
}

/* ---------------- Hold-to-repeat buttons (+/-) ---------------- */

export function HoldBtn({
  onPress,
  disabled,
  children,
  className,
  label,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };
  const down = (e: RPointerEvent) => {
    e.preventDefault();
    if (disabled) return;
    onPress();
    timer.current = window.setInterval(onPress, 90);
  };
  useEffect(() => stop, []);
  return (
    <button
      aria-label={label}
      disabled={disabled}
      className={className}
      onPointerDown={down}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/* ---------------- Mood faces ---------------- */

export function MoodPicker({
  value,
  onChange,
}: {
  value: Mood;
  onChange: (m: Mood) => void;
}) {
  const opts: Array<{ id: Mood; icon: ReactNode }> = [
    { id: "happy", icon: <Smile /> },
    { id: "neutral", icon: <Meh /> },
    { id: "sad", icon: <Frown /> },
  ];
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {opts.map((o) => (
        <button
          key={o.id}
          className={cx("face-btn", value === o.id && `on-${o.id}`)}
          onClick={() => onChange(o.id)}
          aria-label={o.id}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

export function MoodIcon({ mood, size = 20 }: { mood: Mood; size?: number }) {
  const cls = mood === "happy" ? "var(--ok)" : mood === "neutral" ? "var(--warn)" : "var(--bad)";
  const Icon = mood === "happy" ? Smile : mood === "neutral" ? Meh : Frown;
  return <Icon size={size} color={cls} />;
}

/* ---------------- Toast ---------------- */

type ToastFn = (msg: string) => void;
let toastSub: ((msg: string) => void) | null = null;

export function toast(msg: string): void {
  toastSub?.(msg);
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSub = (m) => {
      setMsg(m);
      window.setTimeout(() => setMsg(null), 2400);
    };
    return () => {
      toastSub = null;
    };
  }, []);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

/* ---------------- Confirm dialog ---------------- */

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Elimina",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ textAlign: "center", padding: "8px 4px 4px" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
        <p className="text2 small" style={{ lineHeight: 1.5, marginBottom: 18 }}>
          {message}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            className={cx("btn btn-lg", danger ? "btn-danger" : "btn-primary")}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
          <button className="btn btn-lg btn-ghost" onClick={onClose}>
            Annulla
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- Section header ---------------- */

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="section-title">{children}</div>;
}

/* ---------------- Card ---------------- */

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cx("card", className)} style={style}>
      {children}
    </div>
  );
}

/* ---------------- Image blob viewer ---------------- */

export function BlobImage({
  getBlob,
  alt,
  className,
}: {
  getBlob: () => Promise<Blob | null>;
  alt?: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    getBlob().then((b) => {
      if (cancelled || !b) return;
      revoke = URL.createObjectURL(b);
      setUrl(revoke);
    });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [getBlob]);
  if (!url) return <div className={className} style={{ background: "var(--field)" }} />;
  return <img className={className} src={url} alt={alt ?? ""} />;
}

/* ---------------- Full-screen viewer (image or PDF) ---------------- */

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export function Viewer({
  open,
  onClose,
  title,
  getBlob,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  getBlob: () => Promise<Blob | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<{ kind: "pan"; x0: number; y0: number } | { kind: "pinch"; dist: number; scale0: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    if (!open) return;
    let revoke: string | null = null;
    let cancelled = false;
    getBlob().then((b) => {
      if (cancelled || !b) return;
      revoke = URL.createObjectURL(b);
      setIsPdf(b.type === "application/pdf");
      setUrl(revoke);
    });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
      setUrl(null);
    };
  }, [open, getBlob]);

  // Reset zoom whenever a new blob is shown.
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [url]);

  const clampPan = (s: number, x: number, y: number): { x: number; y: number } => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage) return { x, y };
    const iw = img.naturalWidth || stage.clientWidth;
    const ih = img.naturalHeight || stage.clientHeight;
    const fit = Math.min(stage.clientWidth / iw, stage.clientHeight / ih);
    const dispW = iw * fit * s;
    const dispH = ih * fit * s;
    const maxX = Math.max(0, (dispW - stage.clientWidth) / 2);
    const maxY = Math.max(0, (dispH - stage.clientHeight) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const applyScale = (s: number) => {
    const ns = clamp(s, MIN_ZOOM, MAX_ZOOM);
    setScale(ns);
    setPan((p) => clampPan(ns, p.x, p.y));
  };

  const zoomIn = () => applyScale(scale * 1.4);
  const zoomOut = () => applyScale(scale / 1.4);
  const toggleZoom = () => (scale > 1 ? applyScale(1) : applyScale(2.4));

  const onTouchStart = (e: RTouchEvent<HTMLDivElement>) => {
    const t = e.touches;
    if (isPdf) return;
    if (t.length === 1) {
      gesture.current = {
        kind: "pan",
        x0: t[0].clientX - pan.x,
        y0: t[0].clientY - pan.y,
      };
    } else if (t.length === 2) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      gesture.current = { kind: "pinch", dist: Math.hypot(dx, dy), scale0: scale };
    }
  };

  const onTouchMove = (e: RTouchEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || isPdf) return;
    const t = e.touches;
    if (g.kind === "pan" && t.length === 1) {
      setPan(clampPan(scale, t[0].clientX - g.x0, t[0].clientY - g.y0));
    } else if (g.kind === "pinch" && t.length >= 2) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      const d = Math.hypot(dx, dy);
      const ns = clamp(g.scale0 * (d / Math.max(1, g.dist)), MIN_ZOOM, MAX_ZOOM);
      setScale(ns);
      setPan((p) => clampPan(ns, p.x, p.y));
    }
  };

  const onTouchEnd = (e: RTouchEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || isPdf) return;
    if (g.kind === "pan" && e.changedTouches.length === 1) {
      // Double-tap toggles the zoom.
      const now = Date.now();
      if (now - lastTap.current < 280) {
        lastTap.current = 0;
        toggleZoom();
      } else {
        lastTap.current = now;
      }
    }
  };

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = title || "spartito";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (!open) return null;
  return (
    <div className="lightbox-mask">
      <button className="lightbox-x" onClick={onClose} aria-label="Chiudi">
        <X size={22} />
      </button>
      <div
        ref={stageRef}
        className="lightbox-stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onClose}
      >
        {url && !isPdf ? (
          <img
            ref={imgRef}
            className="lightbox-img"
            src={url}
            alt={title}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              toggleZoom();
            }}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transition: gesture.current ? "none" : "transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        ) : url && isPdf ? (
          <iframe
            title={title}
            src={url}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "#fff",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="text2">Caricamento…</div>
        )}
      </div>
      {url && !isPdf ? (
        <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
          <button className="lb-btn" onClick={zoomOut} aria-label="Riduci">
            <ZoomOut />
          </button>
          <span className="lb-pct">{Math.round(scale * 100)}%</span>
          <button className="lb-btn" onClick={zoomIn} aria-label="Ingrandisci">
            <ZoomIn />
          </button>
          <span className="lb-sep" />
          <button className="lb-btn" onClick={download} aria-label="Scarica">
            <Download />
          </button>
          <button className="lb-close" onClick={onClose}>
            Chiudi
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Date field helper ---------------- */

export function todayInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

export function daysLabel(n: number): string {
  return n === 0 ? "oggi" : n === 1 ? "1 giorno" : `${n} giorni`;
}

export function clampBpm(n: number): number {
  return clamp(n, 20, 400);
}

/* ---------------- Empty state ---------------- */

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="ico">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function CloseX({ onClose }: { onClose: () => void }) {
  return (
    <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
      <X />
    </button>
  );
}
