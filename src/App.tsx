import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppGlyph, type AppGlyphName } from "./ui/AppGlyph";
import { ChevronRight, FileText } from "lucide-react";
import { store, useStore } from "./data/store";
import { skinBaseFont } from "./data/skins";
import { NavContext, TABS, type TabId } from "./nav";
import { cx } from "./lib/utils";
import { Toaster, UpdateBanner } from "./ui/primitives";
import { applyUpdate, checkForUpdate, hasPendingUpdate, watchForUpdates } from "./lib/updater";
import DiarioScreen from "./screens/DiarioScreen";
import BraniScreen from "./screens/studio/BraniScreen";
import SongScreen from "./screens/studio/SongScreen";
import MetronomeScreen from "./screens/MetronomeScreen";
import TunerScreen from "./screens/TunerScreen";
import CordeScreen from "./screens/CordeScreen";
import SettingsScreen from "./screens/SettingsScreen";
import AllenamentoScreen from "./screens/allenamento/AllenamentoScreen";

const PixelStory = lazy(() => import("./pixel/PixelStory"));

const WELCOME_KEY = "mygithub.welcome-complete";

const TAB_ICONS: Record<TabId, AppGlyphName> = {
  diario: "home",
  studio: "studio",
  allenamento: "training",
  metronomo: "metronome-tab",
  accordatore: "tuner",
  corde: "strings",
  impostazioni: "settings",
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
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return window.localStorage.getItem(WELCOME_KEY) !== "true";
    } catch {
      return true;
    }
  });

  const enterApp = useCallback(() => {
    try {
      window.localStorage.setItem(WELCOME_KEY, "true");
    } catch {
      // The welcome still works for this session when storage is unavailable.
    }
    setShowWelcome(false);
    setSongId(null);
    setTabState("diario");
    store.setTab("diario");
  }, []);

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
      root.dataset.skin = ap.skin;
      // "auto" means "follow the active Aspetto Totale design's base font".
      root.dataset.font =
        ap.font === "auto" ? skinBaseFont(ap.skin) : ap.font;
      const acc = ap.skin === "liquidglass"
        ? dark
          ? { main: "#f4f4f4", soft: "rgba(255, 255, 255, 0.12)", hi: "#ffffff" }
          : { main: "#242424", soft: "rgba(0, 0, 0, 0.09)", hi: "#111111" }
        : ACCENTS[ap.accent];
      root.style.setProperty("--acc", acc.main);
      root.style.setProperty("--acc-soft", acc.soft);
      root.style.setProperty("--acc-2", acc.hi);
      const meta = document.querySelector('meta[name="theme-color"]');
      meta?.setAttribute("content", dark ? "#080808" : "#f2f2f7");
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

  // A new version is downloaded in the background but applied only on request.
  const [updateReady, setUpdateReady] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  useEffect(() => watchForUpdates(() => setUpdateReady(hasPendingUpdate())), []);

  const api = useMemo(
    () => ({ tab, songId, openTab, openSong, back }),
    [tab, songId, openTab, openSong, back]
  );

  if (showWelcome) {
    return (
      <>
        <WelcomeScreen onStart={enterApp} />
        <Toaster />
      </>
    );
  }

  return (
    <NavContext.Provider value={api}>
      <div className="app">
        <div className="panes">
          <Pane id="diario" active={tab === "diario"}>
            <DiarioScreen />
          </Pane>
          <Pane key={`studio-${songId ?? "list"}`} id="studio" active={tab === "studio"}>
            {st.settings.pixelStory ? <Suspense fallback={<div className="screen">Preparo la tua stanza…</div>}><PixelStory active={tab === "studio"} /></Suspense> : songId ? <SongScreen songId={songId} /> : <BraniScreen />}
          </Pane>
          <Pane id="allenamento" active={tab === "allenamento"}>
            <AllenamentoScreen />
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
      {updateReady && !updateDismissed ? (
        <UpdateBanner
          onApply={() => {
            setUpdateDismissed(true);
            applyUpdate();
          }}
          onDismiss={() => {
            setUpdateDismissed(true);
            void checkForUpdate();
          }}
        />
      ) : null}
      <Toaster />
    </NavContext.Provider>
  );
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const features = [
    { icon: <AppGlyph name="metronome" size={27} />, text: <>Metronomo preciso<br />e personalizzabile</> },
    { icon: <FileText size={25} strokeWidth={1.6} />, text: <>Salva e organizza<br />le tue partiture</> },
    { icon: <AppGlyph name="tuner" size={27} />, text: <>Accordatore affidabile<br />per chitarra</> },
    { icon: <AppGlyph name="strings-coil" size={27} />, text: <>Registra il cambio corde<br />e tieni tutto sotto controllo</> },
  ];

  return (
    <main className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-pick" aria-hidden="true">
          <svg viewBox="0 0 220 220" role="presentation">
            <defs>
              <radialGradient id="pick-fill" cx="38%" cy="14%" r="92%">
                <stop offset="0" stopColor="#454545" />
                <stop offset=".24" stopColor="#272727" />
                <stop offset=".58" stopColor="#101010" />
                <stop offset=".88" stopColor="#030303" />
                <stop offset="1" stopColor="#000" />
              </radialGradient>
              <linearGradient id="pick-rim" x1=".13" y1=".08" x2=".91" y2=".88">
                <stop offset="0" stopColor="#858585" />
                <stop offset=".2" stopColor="#f7f7f7" />
                <stop offset=".48" stopColor="#777" />
                <stop offset=".72" stopColor="#f4f4f4" />
                <stop offset="1" stopColor="#8b8b8b" />
              </linearGradient>
              <radialGradient id="pick-glow" cx="78%" cy="10%" r="78%">
                <stop offset="0" stopColor="#fff" stopOpacity=".92" />
                <stop offset=".2" stopColor="#fff" stopOpacity=".38" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="pick-specular" cx="85%" cy="8%" r="85%">
                <stop offset="0" stopColor="#fff" stopOpacity=".54" />
                <stop offset=".28" stopColor="#fff" stopOpacity=".12" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <filter id="pick-blur" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="13" />
              </filter>
              <filter id="pick-soft-blur" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" />
              </filter>
              <filter id="pick-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
                <feOffset dy="5" result="offset" />
                <feComponentTransfer><feFuncA type="linear" slope=".65" /></feComponentTransfer>
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <path id="pick-shape" d="M110 18C78 18 47 26 37 55c-10 29 7 72 30 106 17 25 34 41 44 41 11 0 28-16 45-41 23-34 40-77 30-106-10-29-41-37-76-37Z" />
              <clipPath id="pick-clip"><use href="#pick-shape" /></clipPath>
            </defs>
            <ellipse cx="166" cy="30" rx="42" ry="36" fill="url(#pick-glow)" filter="url(#pick-blur)" />
            <use href="#pick-shape" fill="none" stroke="url(#pick-rim)" strokeWidth="3" opacity=".88" filter="url(#pick-blur)" />
            <use href="#pick-shape" fill="url(#pick-fill)" stroke="url(#pick-rim)" strokeWidth="1.35" filter="url(#pick-shadow)" />
            <g clipPath="url(#pick-clip)">
              <ellipse cx="161" cy="39" rx="58" ry="35" fill="url(#pick-specular)" />
              <path d="M43 58c17-25 53-36 87-35 26 1 47 9 58 24" fill="none" stroke="#fff" strokeOpacity=".32" strokeWidth="2.2" />
              <path d="M47 62c15-21 47-31 77-30" fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="5" filter="url(#pick-soft-blur)" />
            </g>
            <path d="M39 63c-7 32 11 72 34 104 9 12 18 22 26 28" fill="none" stroke="#f5bd83" strokeOpacity=".82" strokeWidth="1.65" />
            <path d="M148 26c18 2 34 11 41 25" fill="none" stroke="#fff" strokeOpacity=".82" strokeWidth="1.45" />
            <circle cx="181" cy="34" r="2.2" fill="#fff" filter="url(#pick-soft-blur)" />
            <circle cx="181" cy="34" r="1.1" fill="#fff" />
          </svg>
        </div>
        <h1>MyGitHub</h1>
        <p className="welcome-tagline">Made By Manuel</p>

        <div className="welcome-features">
          {features.map((feature, index) => (
            <div className="welcome-feature" key={index}>
              <span className="welcome-feature-icon">{feature.icon}</span>
              <span>{feature.text}</span>
            </div>
          ))}
        </div>

        <button className="welcome-start" onClick={onStart}>
          <span>Inizia</span>
          <ChevronRight size={20} strokeWidth={2} />
        </button>
      </div>
    </main>
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
        const icon = TAB_ICONS[t.id];
        return (
          <button
            key={t.id}
            className={cx("tab-btn", t.center && "tab-center", active === t.id && "active")}
            onClick={() => onSelect(t.id)}
            aria-current={active === t.id ? "page" : undefined}
          >
            <AppGlyph name={icon} size={22} strokeWidth={1.65} />
            <span className="lbl">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
