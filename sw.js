/* 오프라인 실행용 서비스 워커: 처음 한 번 접속하면 게임 파일을 모두 저장해 두고, 이후엔 인터넷 없이 실행 */
const CACHE = 'newkorea-9d7611df75';
const ASSETS = ["./", "index.html", "manifest.webmanifest", "css/style.css", "js/vendor/anthropic-sdk.mjs", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/icon-maskable-512.png", "js/data.js", "js/details/a.js", "js/details/b.js", "js/details/c.js", "js/mapdata.js", "js/engine.js", "js/politics.js", "js/powers.js", "js/domestic.js", "js/dom_events.js", "js/economy.js", "js/world.js", "js/military.js", "js/armies.js", "js/strikes.js", "js/arsenal.js", "js/territory.js", "js/leaders.js", "js/worldai.js", "js/treaty.js", "js/geopolitics.js", "js/eras.js", "js/claude.js", "js/ui.js", "js/ui_systems.js", "js/ui_world.js", "js/game.js", "js/ui_domestic.js", "js/advisor.js", "js/ui_defense.js", "js/warfx.js", "js/ui_armies.js", "js/ui_strikes.js", "js/missions.js", "js/hegemony.js", "js/governance.js", "js/balance.js", "js/focus.js", "js/ui_focus.js", "js/accounts.js", "js/dynamics.js", "js/victory.js", "js/ui_dynamics.js", "js/gamefx.js", "js/scenes.js", "js/ui_cards.js", "js/ui_victory.js"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // 게임 파일: 캐시 우선, 없으면 네트워크 후 저장 / 글꼴 등 외부: 네트워크 우선, 실패하면 캐시
  if (u.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match('index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com/.test(u.host)) {
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
  }
});
