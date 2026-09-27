import { createRoot } from "react-dom/client";
import "./index.css";
import "./skins.css";
import "./essential.css";
import App from "./App";
import { store } from "./data/store";

async function boot(): Promise<void> {
  const splashStartedAt = performance.now();
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  const root = createRoot(rootEl);
  let isFirstLaunch = true;
  try {
    isFirstLaunch = window.localStorage.getItem("mygithub.welcome-complete") !== "true";
  } catch {
    // Show the welcome screen on this launch when local storage is unavailable.
  }

  if (isFirstLaunch) {
    // Render the actual first-launch screen before waiting on IndexedDB.
    root.render(<App />);
    void store.init();
  } else {
    await store.init();
    root.render(<App />);
  }
  const revealApp = () => {
    requestAnimationFrame(() => {
      const boot = document.getElementById("boot");
      if (boot) {
        boot.classList.add("hide");
        window.setTimeout(() => boot.remove(), 600);
      }
    });
  };
  const splashDelay = Math.max(0, 620 - (performance.now() - splashStartedAt));
  window.setTimeout(revealApp, splashDelay);
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }
}

void boot();
