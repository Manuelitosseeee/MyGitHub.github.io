/* Scala service worker — cache-first runtime caching for offline PWA use.
 *
 * Update policy: a new version is downloaded in the background but it NEVER
 * takes over on its own. The new worker stays in "waiting" until the app asks
 * for it (message SKIP_WAITING), so the running metronome is never interrupted
 * by an update the user did not request.
 */
const CACHE = "mygithub-pixel-v9";
const PRECACHE = [
  "./pixel/items/home-rug.png",
  "./pixel/items/home-desk.png",
  "./pixel/items/home-shelf.png",
  "./pixel/items/home-guitar.png",
  "./pixel/items/home-art-note.png",
  "./pixel/items/home-art-guitar.png",
  "./pixel/items/home-art-score.png",
  "./pixel/items/home-records.png",
  "./pixel/items/home-curtains.png",
  "./pixel/items/home-cat.png",
  "./pixel/items/studio-console.png",
  "./pixel/items/studio-rug.png",
  "./pixel/items/studio-monitor-left.png",
  "./pixel/items/studio-monitor-screen.png",
  "./pixel/items/studio-monitor-right.png",
  "./pixel/items/studio-headphones.png",
  "./pixel/items/studio-rack.png",
  "./pixel/items/studio-mic.png",
  "./pixel/items/studio-guitar.png",
  "./pixel/items/studio-cases.png",
  "./pixel/items/studio-lamp.png",
  "./pixel/items/shop-counter.png",
  "./pixel/items/shop-rug.png",
  "./pixel/items/shop-wall.png",
  "./pixel/items/shop-cabinet.png",
  "./pixel/items/shop-shelf-1.png",
  "./pixel/items/shop-shelf-2.png",
  "./pixel/items/shop-shelf-3.png",
  "./pixel/items/shop-guitars.png",
  "./pixel/items/shop-art-note.png",
  "./pixel/items/shop-art-violin.png",
  "./pixel/items/shop-art-guitar.png",
  "./pixel/items/rehearsal-drums.png",
  "./pixel/items/rehearsal-rug-small.png",
  "./pixel/items/rehearsal-rug-large.png",
  "./pixel/items/rehearsal-keys.png",
  "./pixel/items/rehearsal-amp-left.png",
  "./pixel/items/rehearsal-amp-right.png",
  "./pixel/items/rehearsal-bass.png",
  "./pixel/items/rehearsal-pedals.png",
  "./pixel/items/rehearsal-cases.png",
  "./pixel/items/rehearsal-art-player.png",
  "./pixel/items/rehearsal-art-sunset.png",
  "./pixel/items/rehearsal-art-neck.png",
  "./pixel/items/stage-mic.png",
  "./pixel/items/stage-lights.png",
  "./pixel/items/stage-piano.png",
  "./pixel/items/stage-amp.png",
  "./pixel/items/stage-guitar.png",
  "./pixel/items/stage-wedge-left.png",
  "./pixel/items/stage-wedge-right.png",
  "./pixel/items/plant.png",
  "./pixel/items/character.png",


  "./pixel/plectri.png",
  "./pixel/map-thumbnails.png",
  "./pixel/nunito-variable.ttf",
  "./pixel/studio-full.webp",
  "./pixel/studio-base.webp",
  "./pixel/shop-full.webp",
  "./pixel/shop-base.webp",
  "./pixel/rehearsal-full.webp",
  "./pixel/rehearsal-base.webp",
  "./pixel/stage-full.webp",
  "./pixel/stage-base.webp",

  "./pixel/approved-v2.webp",
  "./pixel/neutral-v2.webp",
  "./pixel/furniture-v2.webp",
  "./pixel/empty-v2.webp",
  "./pixel/room.webp",
  "./pixel/guitarist.webp",
  "./pixel/objects.webp",
  "./pixel/clock.png",
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png?v=pick-1",
  "./icons/icon-512.png?v=pick-1",
  "./icons/icon-maskable-512.png?v=pick-1",
  "./icons/apple-touch-icon.png?v=pick-1",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
    // No skipWaiting(): the update waits until the user applies it.
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations so new deploys are picked up; fall back to cache offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Stale-while-revalidate for the rest: the page keeps running on the assets
  // it loaded, and the fresh ones are stored for the next launch.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
