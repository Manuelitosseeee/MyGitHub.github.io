import { useMemo } from "react";
import { ChevronRight, Home, Music2, Sparkles } from "lucide-react";
import { useStore } from "../data/store";
import { buildDays, type DayEntry, type SongDayEntry } from "../data/selectors";
import { useNav } from "../nav";
import { Card, Empty, SectionTitle } from "../ui/primitives";
import { relativeDayLabel, todayKey, addDays, formatDuration } from "../lib/time";
import { cx } from "../lib/utils";

export default function DiarioScreen() {
  const st = useStore();
  const nav = useNav();
  const days = useMemo(() => buildDays(st), [st]);
  const today = todayKey();
  const todayEntry = days.find((d) => d.date === today) ?? null;
  const history = days.filter((d) => d.date !== today);
  const hour = new Date().getHours();
  const greeting = hour < 6 ? "Buonanotte" : hour < 13 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
  const totalTodaySec = todayEntry?.totalSeconds ?? 0;
  const streak = calcStreak(days);
  const week = weekBars(st, 7);

  const empty = days.length === 0;
  const anyToday = !!todayEntry;

  return (
    <div className="screen">
      <div className="screen-title" style={{ fontSize: 26 }}>{greeting}</div>
      <p className="screen-sub" style={{ textTransform: "capitalize" }}>
        {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div className="stat-row">
        <div className="stat">
          <div className="v">{formatShort(totalTodaySec)}</div>
          <div className="k">minuti oggi</div>
        </div>
        <div className="stat">
          <div className="v">{todayEntry?.songCount ?? 0}</div>
          <div className="k">brani oggi</div>
        </div>
        <div className="stat">
          <div className="v">{streak}</div>
          <div className="k">giorni di fila</div>
        </div>
      </div>

      <SectionTitle>Questa settimana</SectionTitle>
      <Card className="card-pad">
        <WeekChart bars={week} />
        {empty ? (
          <p className="tiny text3" style={{ marginTop: 8 }}>
            Ancora nessuna attività: aggiungi un brano e inizia a suonare col
            metronomo.
          </p>
        ) : null}
      </Card>

      {empty ? (
        <Empty
          icon={<Home />}
          title="Il tuo diario di studio"
          body="Qui MyGitHub ti racconta cosa hai suonato ogni giorno: quali brani, a quali BPM e per quanto tempo. Tutto in automatico, senza fare nulla."
          action={
            <button className="btn btn-primary" onClick={() => nav.openTab("studio")}>
              Vai ai brani
            </button>
          }
        />
      ) : (
        <>
          <SectionTitle>Oggi</SectionTitle>
          {todayEntry ? (
            <DayCard entry={todayEntry} highlight />
          ) : (
            <Card className="card-pad">
              <div className="row-sub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Music2 size={16} className="text3" />
                Nessuna attività registrata oggi. Apri un brano e usa il suo
                metronomo: anche un solo cambio di BPM finirà qui.
              </div>
            </Card>
          )}

          {history.length > 0 ? (
            <>
              <SectionTitle>Storico</SectionTitle>
              {history.map((d) => (
                <DayCard key={d.date} entry={d} />
              ))}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function DayCard({ entry, highlight }: { entry: DayEntry; highlight?: boolean }) {
  const nav = useNav();
  return (
    <Card>
      <div className="day-header">
        <div className="d" style={{ color: highlight ? "var(--acc)" : undefined }}>
          {relativeDayLabel(entry.date)}
        </div>
        <div className="m">
          {entry.songCount} {entry.songCount === 1 ? "brano" : "brani"} ·{" "}
          {formatDuration(entry.totalSeconds)}
        </div>
      </div>
      {entry.entries.map((e) => (
        <button
          key={e.songId}
          className="list-item"
          style={{
            width: "100%",
            display: "block",
            textAlign: "left",
            padding: "11px 16px 12px",
          }}
          onClick={() => nav.openSong(e.songId)}
        >
          <div className="song-mini-top">
            <span className="row-title" style={{ fontSize: 15.5 }}>
              {e.title}
            </span>
            {e.seconds > 0 ? (
              <span className={cx("minute-pill", e.seconds >= 60 && "active")}>
                {formatDuration(e.seconds)}
              </span>
            ) : null}
            {e.goalBpm !== null && e.bestBpm >= e.goalBpm ? (
              <span className="goal-tag" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                traguardo!
              </span>
            ) : null}
            <ChevronRight size={16} className="chev" style={{ marginLeft: "auto" }} />
          </div>
          {e.bpmPath.length > 0 ? (
            <Journey points={e.bpmPath} />
          ) : (
            <span className="tiny text3">
              {formatDuration(e.seconds)} di pratica con il metronomo
            </span>
          )}
          {e.goalBpm !== null && e.bestBpm > 0 && e.bestBpm < e.goalBpm ? (
            <div className="tiny text3" style={{ marginTop: 6 }}>
              <Sparkles size={11} style={{ verticalAlign: "-1px" }} /> record {e.bestBpm}{" "}
              BPM · obiettivo {e.goalBpm} BPM
            </div>
          ) : null}
        </button>
      ))}
    </Card>
  );
}

function Journey({ points }: { points: SongDayEntry["bpmPath"] }) {
  const shown: typeof points = [];
  for (const p of points) {
    if (shown.length === 0 || shown[shown.length - 1].bpm !== p.bpm) shown.push(p);
  }
  if (shown.length === 1) {
    return (
      <div className="bpm-journey" style={{ marginTop: 6 }}>
        <span className="bpm-chip start">{shown[0].bpm} BPM</span>
        <span className="tiny text3">da {new Date(shown[0].at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    );
  }
  return (
    <div className="bpm-journey" style={{ marginTop: 6 }}>
      <span className="tiny text3" style={{ alignSelf: "center" }}>
        percorso BPM:
      </span>
      {shown.map((p, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {i > 0 ? <span className="bpm-arrow">→</span> : null}
          <span className={cx("bpm-chip", i === 0 && "start")}>{p.bpm}</span>
        </span>
      ))}
    </div>
  );
}

function WeekChart({ bars }: { bars: Array<{ label: string; secs: number; isToday: boolean }> }) {
  const max = Math.max(60, ...bars.map((b) => b.secs));
  return (
    <div className="week-chart">
      {bars.map((b, i) => {
        const h = Math.max(b.secs > 0 ? 12 : 3, (b.secs / max) * 56);
        return (
          <div className="wbar-col" key={i}>
            <div className="wl" style={{ fontSize: 9 }}>
              {b.secs > 0 ? formatDuration(b.secs) : ""}
            </div>
            <div className={cx("wbar", b.isToday && "today")} style={{ height: h }} />
            <div className="wl">{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function weekBars(
  st: ReturnType<typeof useStore>,
  n: number
): Array<{ label: string; secs: number; isToday: boolean }> {
  const out: Array<{ label: string; secs: number; isToday: boolean }> = [];
  const days = buildDays(st);
  const map = new Map(days.map((d) => [d.date, d.totalSeconds]));
  for (let i = n - 1; i >= 0; i--) {
    const key = addDays(todayKey(), -i);
    const d = new Date(key + "T00:00:00");
    out.push({
      label: d.toLocaleDateString("it-IT", { weekday: "narrow" }),
      secs: map.get(key) ?? 0,
      isToday: i === 0,
    });
  }
  return out;
}

function calcStreak(days: DayEntry[]): number {
  const set = new Set(days.map((d) => d.date));
  let cursor = todayKey();
  if (!set.has(cursor)) cursor = addDays(cursor, -1);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

function formatShort(secs: number): string {
  const m = Math.floor(secs / 60);
  return `${m}`;
}

