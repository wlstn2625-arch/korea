/* =========================================================
 *  전쟁 연출: 지도 위 포격·폭발, 미사일·폭격기 궤적, 상륙정, 함락 배너, 화면 진동
 *  + 주공 목표 지정(지도에서 적 시·도를 누르거나 전쟁 패널에서 선택)
 * ========================================================= */
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function fxLayer() {
  if (!mapBuilt) return null;
  let g = mapBuilt.svg.querySelector('.g-fx');
  if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'g-fx'); mapBuilt.svg.appendChild(g); }
  return g;
}
function fxAdd(html, ms) {
  const g = fxLayer(); if (!g || reduceMotion()) return;
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'g'); t.innerHTML = html; g.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
const at = (c, inner, cls) => `<g transform="translate(${c[0].toFixed(2)} ${c[1].toFixed(2)})"><g class="${cls}">${inner}</g></g>`;
// 포격 섬광
function fxBurst(c, big) {
  fxAdd(at(c, `<circle class="b-ring" r="${big ? 14 : 8}"></circle><circle class="b-core" r="${big ? 6 : 3.5}"></circle>${big ? '<text class="b-txt" y="5">💥</text>' : ''}`, `fxb ${big ? 'big' : ''}`), 900);
}
// 미사일·폭격기 궤적: 출발지 → 목표, 끝나면 폭발
function fxStrike(from, to, kind) {
  if (!from || !to) return;
  const mx = (from[0] + to[0]) / 2, my = Math.min(from[1], to[1]) - Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.35;
  const d = `M${from[0]} ${from[1]} Q${mx} ${my} ${to[0]} ${to[1]}`, id = 'p' + Math.random().toString(36).slice(2, 8);
  const icon = { missile: '🚀', bomb: '✈️', cyber: '⚡', landing: '🚢', blockade: '⚓' }[kind] || '🚀';
  fxAdd(`<path id="${id}" d="${d}" class="fx-trail ${kind}"></path>
    <g class="fx-obj"><text class="fx-ic">${icon}<animateMotion dur="1.1s" fill="freeze" rotate="auto" path="${d}"></animateMotion></text></g>`, 1300);
  setTimeout(() => { fxBurst(to, true); fxBurst([to[0] + 1.2, to[1] - 0.8]); }, 1050);
}
// 함락 배너 + 화면 진동
function fxCapture(ev) {
  const stage = document.querySelector('.stage'); if (!stage) return;
  const b = document.createElement('div');
  b.className = `cap-banner ${ev.side === 'kr' ? 'win' : 'lose'} ${ev.vp >= 5 ? 'major' : ''}`;
  b.innerHTML = `<span class="cb-ic">${ev.side === 'kr' ? '🚩' : '🏴'}</span><div><b>${esc(ev.name)} ${ev.side === 'kr' ? '점령!' : '함락'}</b><small>${ev.side === 'kr' ? (ev.vp >= 5 ? '적 핵심 거점을 장악했습니다' : '아군이 진격합니다') : (ev.vp >= 5 ? '핵심 도시를 잃었습니다' : '적군이 밀고 들어옵니다')}</small></div>`;
  stage.appendChild(b); setTimeout(() => b.remove(), 3200);
  if (ev.c) { fxBurst(ev.c, true); setTimeout(() => fxBurst([ev.c[0] - 1, ev.c[1] + 0.6], true), 200); }
  if (ev.vp >= 3 && !reduceMotion()) { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
}
const KOREA_LAUNCH = () => MAP_DATA.cities['서울'] || MAP_DATA.countries.kr.c;
function consumeWarFx() {
  const T = S?.war?.theater; if (!T?.fx?.length) return;
  const list = T.fx.splice(0).slice(-3);
  list.forEach((ev, i) => setTimeout(() => {
    if (ev.type === 'capture') fxCapture(ev);
    else if (ev.type === 'op') {
      const from = ev.id === 'landing' || ev.id === 'blockade' ? [KOREA_LAUNCH()[0] + 4, KOREA_LAUNCH()[1] + 10] : KOREA_LAUNCH();
      if (ev.id === 'mobilize') { const st = document.querySelector('.stage'); st?.classList.remove('flashg'); void st?.offsetWidth; st?.classList.add('flashg'); }
      else fxStrike(from, ev.c, ev.id);
    }
  }, i * 500));
}
// 교전 중인 전선마다 포격 섬광
function warBattleFx() {
  const T = S?.war?.theater; if (!T || !mapBuilt || document.hidden) return;
  const byId = Object.fromEntries(T.provs.map(p => [p.id, p]));
  const act = frontEdges(T).filter(([a, b]) => T.edges[a + '>' + b]?.active);
  for (let i = 0; i < Math.min(3, act.length); i++) {
    const [a, b] = act[Math.floor(Math.random() * act.length)], A = byId[a].c, B = byId[b].c;
    const t = 0.35 + Math.random() * 0.3; fxBurst([A[0] + (B[0] - A[0]) * t + (Math.random() - 0.5) * 1.5, A[1] + (B[1] - A[1]) * t + (Math.random() - 0.5) * 1.5]);
  }
}
// 실시간 시계의 전쟁 틱에 연출을 붙임
const _warTick = warTick;
warTick = function () { _warTick(); consumeWarFx(); if (gameSpeed) warBattleFx(); };

// 지도에서 적 시·도를 누르면 주공 목표로 지정
document.addEventListener('click', e => {
  const T = S?.war?.theater; if (!T) return;
  const el = e.target.closest?.('#geo .prov, #geo .vreg-hit'); if (!el) return;
  const id = el.dataset.p || el.dataset.vp, p = T.provs.find(x => x.id === id);
  if (!p || p.owner === 'kr') return;
  const r = setTarget(S, id); toast(esc(r.msg)); saveGame(S); updateMap(); if (openPanelName === 'world') renderWarPanel();
});
