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
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }
}

void boot();
