/* =========================================================
 *  지도에서 바로 플레이
 *  - 나라를 누르면 그 자리에 팝업: 정보 + 외교·전쟁 버튼
 *  - 외교 행동·선전포고·미사일·핵을 지도 위에서 바로
 *  - 지도 위 애니메이션: 특사기·화물기·미사일·함대·전투기가 실제로 날아가고 항해함
 * ========================================================= */
const NS = 'http://www.w3.org/2000/svg';
const mapXY = k => k === 'kr' ? (MAP_DATA.cities?.['서울'] || MAP_DATA.countries.kr.c) : (k === 'eu' ? MAP_DATA.cities?.['브뤼셀'] : MAP_DATA.countries?.[k]?.c);
const isSeaFar = k => { const c = cinfo(k); return c && !['nk', 'cn', 'ru', 'mng'].includes(k); };

/* ---------------- 지도 애니메이션 ---------------- */
function animLayer() {
  const svg = mapBuilt?.svg; if (!svg) return null;
  let g = svg.querySelector('.g-anim'); if (!g) { g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'g-anim'); svg.appendChild(g); }
  return g;
}
const mapUnit = () => (mapView?.w || 400) / 400;   // 화면 크기에 맞춘 아이콘 크기
// from → to 로 아이콘이 날아감. arc: 곡선 높이(0~1), trail: 꼬리 색
function mapFly(from, to, icon, { dur = 1600, arc = 0.25, trail = '#ffd86b', size = 1, rotate = true, boom = null, onEnd = null, dash = false } = {}) {
  const g = animLayer(); if (!g || !from || !to) return;
  const u = mapUnit() * size, [x1, y1] = from, [x2, y2] = to;
  const L = Math.hypot(x2 - x1, y2 - y1), mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - L * arc;
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', `M${x1},${y1} Q${mx},${my} ${x2},${y2}`); path.setAttribute('class', 'an-trail' + (dash ? ' dash' : ''));
  path.style.stroke = trail; path.style.strokeWidth = (1.4 * u).toFixed(2);
  const len = path.getTotalLength ? 0 : 0; g.appendChild(path);
  const total = path.getTotalLength(); path.style.strokeDasharray = dash ? `${3 * u} ${3 * u}` : `${total}`; if (!dash) path.style.strokeDashoffset = total;
  const ic = document.createElementNS(NS, 'text'); ic.setAttribute('class', 'an-ic'); ic.textContent = icon; ic.style.fontSize = (9 * u) + 'px'; g.appendChild(ic);
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const p = path.getPointAtLength(total * e), p2 = path.getPointAtLength(Math.min(total, total * e + 1));
    const ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
    ic.setAttribute('x', p.x); ic.setAttribute('y', p.y);
    if (rotate) ic.setAttribute('transform', `rotate(${ang + 45} ${p.x} ${p.y})`);
    if (!dash) path.style.strokeDashoffset = total * (1 - e);
    if (k < 1) requestAnimationFrame(step);
    else { ic.remove(); path.classList.add('fade'); setTimeout(() => path.remove(), 900); if (boom) mapBoom(to, boom); onEnd && onEnd(); }
  };
  requestAnimationFrame(step);
}
function mapBoom(at, kind = 'hit') {
  const g = animLayer(); if (!g) return; const u = mapUnit();
  const big = kind === 'nuke' ? 6 : kind === 'big' ? 2.2 : 1;
  for (let i = 0; i < (kind === 'nuke' ? 3 : 2); i++) {
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', at[0]); c.setAttribute('cy', at[1]); c.setAttribute('r', 1);
    c.setAttribute('class', 'an-ring ' + kind); c.style.setProperty('--R', (14 * u * big) + 'px'); c.style.animationDelay = i * 0.18 + 's'; c.style.strokeWidth = (1.5 * u) + 'px';
    g.appendChild(c); setTimeout(() => c.remove(), 1600);
  }
  const t = document.createElementNS(NS, 'text'); t.setAttribute('x', at[0]); t.setAttribute('y', at[1]); t.setAttribute('class', 'an-boom');
  t.textContent = kind === 'nuke' ? '☢️' : kind === 'shield' ? '🛡️' : '💥'; t.style.fontSize = (12 * u * Math.min(big, 2.5)) + 'px'; g.appendChild(t); setTimeout(() => t.remove(), 1200);
  if (kind !== 'shield' && typeof SFX !== 'undefined') SFX.play(kind === 'nuke' ? 'stamp' : 'click');
  if (kind === 'nuke' || kind === 'big') { const st = document.querySelector('.stage'); st?.classList.remove('shake-mini'); void st?.offsetWidth; st?.classList.add('shake-mini'); }
}
// 함대: 여러 척이 줄지어 항해(낮은 곡선, 회전 없음)
function mapFleet(from, to, n = 3, icon = '🚢', dur = 4200) {
  for (let i = 0; i < n; i++) setTimeout(() => mapFly([from[0] + i * 1.2, from[1] + i * 0.8], to, icon, { dur, arc: 0.06, trail: '#6fb7ff', rotate: false, dash: true, size: 0.9 }), i * 260);
}

/* ---------------- 외교 행동 → 지도 연출 ---------------- */
const DIPLO_FX = { summit: ['✈️', '#ffd86b'], envoy: ['✈️', '#ffd86b'], aid: ['📦', '#7ee37a'], fta: ['🚢', '#6fb7ff'], arms: ['🚀', '#ff9f1c'], culture: ['🎤', '#ff7eb6'],
  techco: ['🔬', '#7fb2ff'], swap: ['💱', '#7ee37a'], visa: ['🛂', '#ffd86b'], loan: ['🏦', '#7ee37a'], students: ['🎓', '#7fb2ff'], resource: ['⛏️', '#ffd86b'],
  sanction: ['🚫', '#ff5a4a'], recall: ['📤', '#ff5a4a'], ultimatum: ['📜', '#ff5a4a'], drill: ['🎯', '#ff9f1c'], mediate: ['🕊️', '#ffffff'], alliance: ['🛡️', '#7fb2ff'], unally: ['✂️', '#ff5a4a'] };
if (typeof diploAction === 'function') {
  const _da2 = diploAction;
  diploAction = function (s, aid, k, ...rest) {
    const r = _da2(s, aid, k, ...rest);
    if (s === S && r?.ok !== false) {
      const a = mapXY('kr'), b = mapXY(k);
      if (aid === 'war') warOpeningFx(k);
      else if (DIPLO_FX[aid] && a && b) { const [ic, col] = DIPLO_FX[aid]; mapFly(a, b, ic, { trail: col, dur: 1700, boom: aid === 'sanction' ? 'hit' : null }); if (aid === 'drill') mapFleet(a, b, 2, '⚓', 3000); }
    }
    return r;
  };
}
function warOpeningFx(k) {
  const a = mapXY('kr'), b = mapXY(k); if (!a || !b) return;
  zoomFit(a, b);
  for (let i = 0; i < 4; i++) setTimeout(() => mapFly([a[0] + (Math.random() - .5) * 3, a[1]], b, '🚀', { dur: 1300, arc: 0.35, trail: '#ff9f1c', boom: 'big' }), 300 + i * 220);
  setTimeout(() => { for (let i = 0; i < 3; i++) setTimeout(() => mapFly(a, b, '✈️', { dur: 1800, arc: 0.12, trail: '#cfe3ff', size: 1.1 }), i * 180); }, 900);
  if (isSeaFar(k)) setTimeout(() => mapFleet(a, b, 4, '🚢', 4800), 600);
}
// 두 지점이 다 보이게 확대
function zoomFit(a, b) {
  const svg = mapBuilt?.svg; if (!svg) return;
  const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.max(40, Math.abs(a[0] - b[0])) * 1.6, h = Math.max(30, Math.abs(a[1] - b[1])) * 1.8;
  mapView = { x: x - w * 0.18, y: y - h * 0.22, w, h }; applyView(svg);
}

/* ---------------- 전쟁 중 지도 위 상시 교전 ---------------- */
let warAmbT = 0;
setInterval(() => {
  if (!S?.war || !mapBuilt?.svg || document.hidden || $('game')?.classList.contains('hidden')) return;
  if (document.querySelector('.trailer, .clipfx, .splash')) return;
  const k = S.war.k, a = mapXY('kr'), b = mapXY(k); if (!a || !b) return;
  warAmbT++;
  const T = S.war.theater, enemyProvs = T ? T.provs.filter(p => p.owner !== 'kr' && p.c) : [], myProvs = T ? T.provs.filter(p => p.owner === 'kr' && p.c) : [];
  const tgt = () => enemyProvs.length ? enemyProvs[Math.floor(Math.random() * enemyProvs.length)].c : [b[0] + (Math.random() - .5) * 6, b[1] + (Math.random() - .5) * 4];
  const mine = () => myProvs.length ? myProvs[Math.floor(Math.random() * myProvs.length)].c : a;
  const r = Math.random();
  if (r < 0.35) mapFly(mine(), tgt(), '🚀', { dur: 1200, arc: 0.3, trail: '#ff9f1c', boom: 'hit', size: 0.8 });
  else if (r < 0.55) mapFly(mine(), tgt(), '✈️', { dur: 1500, arc: 0.1, trail: '#cfe3ff', boom: 'hit', size: 0.8 });
  else if (r < 0.75) { const from = tgt(); mapFly(from, mine(), '🚀', { dur: 1300, arc: 0.3, trail: '#ff4b4b', size: 0.8, boom: Math.random() < 0.55 ? 'shield' : 'hit' }); }
  else if (warAmbT % 3 === 0 && isSeaFar(k)) mapFleet(a, b, 2, '🚢', 4000);
}, 1400);

/* ---------------- 나라 팝업 ---------------- */
let popDown = null;
function closeCountryPop() { document.querySelector('.cpop')?.remove(); }
document.addEventListener('pointerdown', e => { popDown = [e.clientX, e.clientY]; if (!e.target.closest('.cpop')) closeCountryPop(); }, true);
document.addEventListener('click', e => {
  const svg = mapBuilt?.svg; if (!svg || !svg.contains(e.target)) return;
  if (popDown && Math.hypot(e.clientX - popDown[0], e.clientY - popDown[1]) > 6) return;
  if (typeof strikeMode !== 'undefined' && strikeMode) return;                 // 미사일 목표 지정 중이면 원래 동작
  if (e.target.closest('.army-hit, [data-pin], .mpin')) return;                 // 군단·핀은 원래 동작
  const t = e.target.closest('[data-c]'); if (!t) return;
  const k = t.dataset.c; if (!k || k === 'kr' || !cinfo(k)) return;
  // 전쟁 중인 적의 시·도를 누르면: 그 지역 공격 메뉴
  const pid = t.dataset.p;
  e.stopPropagation(); e.preventDefault();
  selCountry = k; updateMap();
  openCountryPop(k, e.clientX, e.clientY, pid);
}, true);

function popBtn(id, icon, name, sub, cls = '', dis = '') { return `<button class="cp-b ${cls}" data-cp="${id}" ${dis ? `disabled title="${esc(dis)}"` : ''}><span>${icon}</span><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</button>`; }
function openCountryPop(k, x, y, pid) {
  closeCountryPop();
  const c = cinfo(k), annexed = S.annexed?.[k] || (typeof isGone === 'function' && isGone(S, k)), owner = S.world?.owner?.[k];
  const r = relOf(S, k), L = S.leaders?.[k], atWar = S.war?.k === k, d = dip(S, k);
  const act = id => { const a = DIPLO_ACTIONS.find(x => x.id === id); if (!a) return ''; let why = null; try { why = a.can(S, k); } catch { why = '불가'; } return popBtn('d:' + id, a.icon, a.name, won(diploCost(S, a, k)), id === 'war' ? 'war' : '', why); };
  let body;
  if (annexed) {
    const t = S.terr?.[k];
    body = `<div class="cp-tag gold">🗺️ 대한민국 영토${t ? ` · ${RULES[t.rule]?.icon || ''} ${RULES[t.rule]?.name || ''}` : ''}</div>
      ${t ? `<div class="cp-stats"><span>✊ 저항 <b>${Math.round(t.resist)}</b></span><span>🤝 통합 <b>${Math.round(t.integ)}</b></span><span>🏗️ 개발 <b>${Math.round(t.dev)}</b></span></div>` : ''}
      <div class="cp-acts">${popBtn('terr', '🗺️', '통치 방식', '')}${popBtn('detail', '📋', '영토 관리', '')}</div>`;
  } else if (owner) {
    body = `<div class="cp-tag">${cflag(owner)} ${esc(cname(owner))}에 병합됨</div><div class="cp-acts">${popBtn('detail', '📋', '상세', '')}</div>`;
  } else if (atWar) {
    const ms = typeof missileStock === 'function' ? missileStock(S) : 0, nk = typeof hasNukes === 'function' && hasNukes(S, 'kr') ? (typeof nukeStock === 'function' ? nukeStock(S) : 0) : 0;
    const st = S.war.theater?.kr?.stance;
    body = `<div class="cp-tag red">⚔️ 전쟁 중 · 전황 ${Math.round(S.war.score)}%</div>
      <div class="cp-acts">
        ${popBtn('missile', '🚀', '미사일 타격', `재고 ${ms}발`, '', ms < 1 ? '미사일이 없습니다' : '')}
        ${popBtn('nuke', '☢️', '핵 공격', nk ? `${nk}발` : '없음', 'war', nk < 1 ? '핵무기가 없습니다' : '')}
        ${popBtn('st:all', '⚡', '총공세', '', st === 'all' ? 'on' : '')}
        ${popBtn('st:attack', '🗡️', '공세', '', st === 'attack' ? 'on' : '')}
        ${popBtn('st:hold', '🛡️', '방어', '', st === 'hold' ? 'on' : '')}
        ${popBtn('fleet', '🚢', '함대 출격', '', '', isSeaFar(k) ? '' : '육지로 붙어 있어 함대가 필요 없습니다')}
        ${popBtn('detail', '📋', '전황', '')}
      </div>`;
  } else {
    body = `<div class="cp-rel"><span>관계</span><div class="cp-bar"><i style="width:${r}%;background:hsl(${relHue(r)} 65% 50%)"></i></div><b>${Math.round(r)}</b></div>
      <div class="cp-stats"><span>🪖 군사 <b>${c.mil}</b></span><span>💰 경제 <b>${c.eco}</b></span><span>${c.nukes ? '☢️ 핵보유' : '비핵'}</span>${d.alliance ? '<span class="tag cur">동맹</span>' : ''}${d.fta ? '<span class="tag">FTA</span>' : ''}${d.sanction ? '<span class="tag const">제재 중</span>' : ''}</div>
      ${L ? `<div class="cp-leader">👤 ${esc(L.title || '')} <b>${esc(L.name)}</b>${L.traits?.length ? ` · ${esc(L.traits.slice(0, 2).map(t => (typeof TRAITS !== 'undefined' && TRAITS[t]?.name) || t).join('·'))}` : ''}</div>` : ''}
      <div class="cp-acts">${act('summit')}${act('envoy')}${act('aid')}${act('fta')}${act('arms')}${act('alliance')}${act('sanction')}${act('ultimatum')}${act('war')}${popBtn('detail', '📋', '상세', '')}</div>`;
  }
  const el = document.createElement('div'); el.className = 'cpop';
  el.innerHTML = `<div class="cp-h"><span class="cp-flag">${c.flag || '🏳️'}</span><div><b>${esc(c.name)}</b><small>${esc([c.sub || c.reg, c.km ? `서울에서 ${Math.round(c.km).toLocaleString('ko-KR')}km` : ''].filter(Boolean).join(' · '))}</small></div><button class="cp-x">✕</button></div>${body}`;
  document.body.appendChild(el);
  // 위치: 누른 곳 근처, 화면 안으로
  const W = el.offsetWidth, H = el.offsetHeight, m = 8;
  let left = x + 14, top = y - H / 2;
  if (left + W > innerWidth - m) left = x - W - 14; if (left < m) left = Math.max(m, (innerWidth - W) / 2);
  top = clamp(top, 60, innerHeight - H - m);
  if (innerWidth < 600) { left = m; top = innerHeight - H - 70; el.classList.add('sheet'); }
  el.style.left = left + 'px'; el.style.top = top + 'px';
  if (typeof SFX !== 'undefined') SFX.play('open');
  el.querySelector('.cp-x').onclick = closeCountryPop;
  el.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => {
    const id = b.dataset.cp;
    if (id === 'detail') { closeCountryPop(); if (annexed) return showTab('defense'); showTab('world'); renderCountryPanel?.(); return; }
    if (id === 'terr') { closeCountryPop(); return typeof openRuleHand === 'function' ? openRuleHand(k) : showTab('defense'); }
    if (id.startsWith('d:')) {
      const aid = id.slice(2);
      if (aid === 'war' && !b.dataset.sure) { b.dataset.sure = 1; b.querySelector('b').textContent = '한 번 더 누르면 전쟁'; b.classList.add('arm'); return; }
      const res = diploAction(S, aid, k);
      toast(esc(res.msg || ''), 3500); saveGame(S); closeCountryPop(); renderAll(); updateMap();
      return;
    }
    if (id.startsWith('st:')) { setStance(S, id.slice(3)); toast(`태세: ${STANCES[id.slice(3)].name}`); saveGame(S); openCountryPop(k, x, y, pid); renderAll(); return; }
    if (id === 'fleet') { closeCountryPop(); mapFleet(mapXY('kr'), mapXY(k), 4, '🚢', 4600); if (S.war.theater) S.war.theater.kr.org = Math.min(100, S.war.theater.kr.org + 3); toast('🚢 함대가 출격했습니다. 해상 지원으로 아군 조직력 +3'); return; }
    if (id === 'missile' || id === 'nuke') {
      closeCountryPop();
      const T = S.war.theater, target = pid && T?.provs.find(p => p.id === pid && p.owner !== 'kr') ? pid : T?.provs.filter(p => p.owner !== 'kr').sort((a, b) => (b.vp || 0) - (a.vp || 0))[0]?.id;
      if (!target) return toast('타격할 적 지역이 없습니다.');
      if (id === 'nuke' && typeof openNukeConfirm === 'function') return openNukeConfirm(target);
      return openStrikeMenu(target);
    }
  });
}

// 미사일·핵 타격이 실제로 일어나면 지도 위로 날아감
if (typeof missileStrike === 'function') {
  const _ms = missileStrike;
  missileStrike = function (s, pid, type) { const r = _ms(s, pid, type); try { const p = s.war?.theater?.provs.find(x => x.id === pid); if (r?.ok !== false && p?.c) { const from = mapXY('kr'); zoomFit(from, p.c); mapFly(from, p.c, '🚀', { dur: 1400, arc: 0.35, trail: '#ff9f1c', boom: /요격당했습니다/.test(r.msg || '') ? 'shield' : 'big', size: 1.3 }); } } catch {} return r; };
}
if (typeof playerNuke === 'function') {
  const _pn2 = playerNuke;
  playerNuke = function (s, pid) { const r = _pn2(s, pid); try { const p = s.war?.theater?.provs.find(x => x.id === pid); if (r?.ok && p?.c) { const from = mapXY('kr'); zoomFit(from, p.c); mapFly(from, p.c, '🚀', { dur: 1800, arc: 0.45, trail: '#ff3b30', boom: 'nuke', size: 1.6 }); } } catch {} return r; };
}
