import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { store } from "./data/store";

async function boot(): Promise<void> {
  await store.init();
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  createRoot(rootEl).render(<App />);
  requestAnimationFrame(() => {
    const boot = document.getElementById("boot");
    if (boot) {
      boot.classList.add("hide");
      window.setTimeout(() => boot.remove(), 600);
    }
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      // BASE_URL is "./" on GitHub Pages builds, so the worker resolves under
      // the repo subpath (e.g. /hvactemplate/sw.js) instead of the domain root.
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .catch(() => undefined);
    });
  }
}

void boot();
