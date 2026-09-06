import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Home, Music2, Gauge, Timer, Guitar, Settings as SettingsIcon } from "lucide-react";
import { store, useStore } from "./data/store";
import { NavContext, TABS, type TabId } from "./nav";
import { cx } from "./lib/utils";
import { Toaster } from "./ui/primitives";
import DiarioScreen from "./screens/DiarioScreen";
import BraniScreen from "./screens/studio/BraniScreen";
import SongScreen from "./screens/studio/SongScreen";
import MetronomeScreen from "./screens/MetronomeScreen";
import TunerScreen from "./screens/TunerScreen";
import CordeScreen from "./screens/CordeScreen";
import SettingsScreen from "./screens/SettingsScreen";

const TAB_ICONS: Record<TabId, typeof Home> = {
  diario: Home,
  studio: Music2,
  metronomo: Timer,
  accordatore: Gauge,
  corde: Guitar,
  impostazioni: SettingsIcon,
};

function isTab(v: string): v is TabId {
  return TABS.some((t) => t.id === v);
}

const ACCENTS: Record<string, { main: string; soft: string; hi: string }> = {
  blue: { main: "#0a84ff", soft: "rgba(10, 132, 255, 0.15)", hi: "#7dd3fc" },
  violet: { main: "#bf5af2", soft: "rgba(191, 90, 242, 0.16)", hi: "#d8b4fe" },
  green: { main: "#34c759", soft: "rgba(52, 199, 89, 0.16)", hi: "#86efac" },
  amber: { main: "#ff9f0a", soft: "rgba(255, 159, 10, 0.16)", hi: "#fcd34d" },
  rose: { main: "#ff375f", soft: "rgba(255, 55, 95, 0.16)", hi: "#fda4af" },
};

export default function App() {
  const st = useStore();
  const initial = isTab(st.settings.lastTab) ? st.settings.lastTab : "diario";
  const [tab, setTabState] = useState<TabId>(initial);
  const [songId, setSongId] = useState<string | null>(null);

  // appearance: light/dark mode + accent color + font + text size
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const ap = st.settings.appearance;
      const dark = ap.mode === "dark" || (ap.mode === "system" && media.matches);
      const root = document.documentElement;
      root.dataset.theme = dark ? "dark" : "light";
      root.dataset.accent = ap.accent;
      root.dataset.fs = ap.fontSize;
      root.dataset.font = ap.font;
      const acc = ACCENTS[ap.accent];
      root.style.setProperty("--acc", acc.main);
      root.style.setProperty("--acc-soft", acc.soft);
      root.style.setProperty("--acc-2", acc.hi);
      const meta = document.querySelector('meta[name="theme-color"]');
      meta?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [st.settings.appearance]);

  const openTab = useCallback((t: TabId) => {
    setTabState(t);
    if (t !== "studio") setSongId(null);
    store.setTab(t);
  }, []);

  const openSong = useCallback((id: string) => {
    setSongId(id);
    setTabState("studio");
    store.setTab("studio");
  }, []);

  const back = useCallback(() => {
    setSongId(null);
    store.setTab("studio");
  }, []);

  const api = useMemo(
    () => ({ tab, songId, openTab, openSong, back }),
    [tab, songId, openTab, openSong, back]
  );

  return (
    <NavContext.Provider value={api}>
      <div className="app">
        <div className="panes">
          <Pane id="diario" active={tab === "diario"}>
            <DiarioScreen />
          </Pane>
          <Pane key={`studio-${songId ?? "list"}`} id="studio" active={tab === "studio"}>
            {songId ? <SongScreen songId={songId} /> : <BraniScreen />}
          </Pane>
          <Pane id="metronomo" active={tab === "metronomo"}>
            <MetronomeScreen />
          </Pane>
          <Pane id="accordatore" active={tab === "accordatore"}>
            <TunerScreen />
          </Pane>
          <Pane id="corde" active={tab === "corde"}>
            <CordeScreen />
          </Pane>
          <Pane id="impostazioni" active={tab === "impostazioni"}>
            <SettingsScreen />
          </Pane>
        </div>
        <TabBar active={tab} onSelect={openTab} />
      </div>
      <Toaster />
    </NavContext.Provider>
  );
}

function Pane({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, []);
  return (
    <div ref={ref} className={cx("pane", id, active && "active")}>
      {children}
    </div>
  );
}

function TabBar({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Navigazione principale">
      {TABS.map((t) => {
        const Icon = TAB_ICONS[t.id];
        return (
          <button
            key={t.id}
            className={cx("tab-btn", active === t.id && "active")}
            onClick={() => onSelect(t.id)}
            aria-current={active === t.id ? "page" : undefined}
          >
            <Icon />
            <span className="lbl">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
