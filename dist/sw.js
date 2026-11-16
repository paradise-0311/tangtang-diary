const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `tangtang-shell:${SCOPE.href}:`;
const REVISION = "__SHELL_REVISION__";
const CACHE = CACHE_PREFIX + REVISION;
const urls = ["./", "index.html", "styles.css", "backup.js", "app.js",
  "manifest.webmanifest", "icon.svg", "icon-apple.png", "icon-192.png", "icon-512.png"]
  .map(path => new URL(path, SCOPE).href);
const entry = urls[0];
const documentPaths = new Set([SCOPE.pathname, new URL("index.html", SCOPE).pathname]);
const versioned = new Map(urls.map(url => {
  const key = new URL(url);
  key.searchParams.set("shell", REVISION);
  return [url, key.href];
}));

self.addEventListener("install", event => {
  // Install one complete release. Let open pages finish recording before it takes over.
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll([...versioned.values()].map(url => new Request(url, {cache:"reload"})))));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const {request} = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin) return;
  const isLaunch = request.mode === "navigate" && documentPaths.has(url.pathname);
  if (!isLaunch && !urls.includes(url.href)) return;
  // In particular, the manifest launch query uses the same cached page when offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(versioned.get(isLaunch ? entry : url.href))) || fetch(request);
  })());
});
