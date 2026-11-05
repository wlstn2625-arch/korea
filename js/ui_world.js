/* =========================================================
 *  세계지도 화면: 확대·축소·이동, 나라 선택, 외교·전쟁 패널
 * ========================================================= */
let selCountry = 'nk';
let mapView = null;          // 현재 보이는 영역 {x, y, w, h} (지도 좌표)
let mapBuilt = null;         // 만들어진 지도 SVG (다시 그리지 않고 색만 바꿈)

const relHue = v => Math.round(clamp(v, 0, 100) * 1.25);
let mapMode = 'rel';          // rel | camp | ideo | conflict
const CONFLICT_COLOR = { war: '#c4343b', border: '#e0812c', civil: '#8e2f2f', trade: '#d6b23a', cyber: '#8a5cc7' };
function landFill(k) {
  if (k === 'kr' || S.annexed[k]) return 'var(--kr-fill)';
  const own = S.world?.owner?.[k]; if (own) return landFill(own);
  if (mapMode === 'camp') return CAMPS[campOf(S, k)].color;
  if (mapMode === 'ideo') { const L = S.leaders?.[k]; return L ? IDEOLOGIES[L.gov].color : 'var(--land-neutral)'; }
  if (mapMode === 'conflict') { const c = S.world?.conflicts.find(x => x.a === k || x.b === k); return c ? CONFLICT_COLOR[c.type] : 'var(--land-neutral)'; }
  if (S.war && (S.war.k === k || S.war.enemyAllies.includes(k))) return 'var(--enemy-fill)';
  if (S.war && S.war.allies.includes(k)) return 'var(--ally-fill)';
  return `hsl(${relHue(relOf(S, k))} var(--land-s) var(--land-l))`;
}
const fmtPop = p => p >= 1e8 ? `${(p / 1e8).toFixed(1)}억` : p >= 1e4 ? `${Math.round(p / 1e4).toLocaleString('ko-KR')}만` : `${p}`;
const fmtGdp = g => g >= 1e6 ? `${(g / 1e6).toFixed(1)}조 달러` : `${Math.round(g / 100).toLocaleString('ko-KR')}억 달러`;
const QUICK = ['us', 'cn', 'jp', 'ru', 'nk', 'tw', 'eu', 'ind', 'deu', 'gbr', 'fra', 'vnm', 'aus', 'idn', 'sau', 'bra', 'ukr', 'irn'];

/* ---------------- 지도 만들기 (한 번만) ---------------- */
function buildGeoMap(container) {
  const M = MAP_DATA;
  const land = M.land.map(l => `<path d="${l.d}" class="land ${l.k === 'x' ? 'neutral' : ''}" ${l.k !== 'x' ? `data-c="${l.k}"` : ''}></path>`).join('');
  const provs = Object.entries(M.prov).map(([k, list]) => list.map(p => `<path d="${p.d}" class="prov" data-c="${k}" data-p="${p.id}"><title>${esc(p.n)}</title></path>`).join('')).join('');
  const labels = Object.entries(M.countries).map(([k, c]) => `<text x="${c.c[0]}" y="${c.c[1]}" class="clbl ${k === 'kr' ? 'kr' : ''}" data-k="${k}" data-a="${c.a}">${esc(k === 'kr' ? '대한민국' : cname(k))}</text>`).join('');
  const cities = Object.entries(M.cities).map(([n, [x, y]]) => `<g class="city"><circle cx="${x}" cy="${y}"></circle><text x="${x}" y="${y}" dx="0.6em" dy="-0.4em">${n}</text></g>`).join('');
  const [bx, by] = M.cities['브뤼셀'];
  container.innerHTML = `
    <div class="map-tools">
      <input id="map-search" list="map-countries" placeholder="🔍 나라 검색 (예: 독일, 브라질)" autocomplete="off">
      <datalist id="map-countries">${allCountryKeys().map(k => `<option value="${esc(cname(k))}">`).join('')}</datalist>
      <div class="map-btns"><button class="btn sm" data-z="in" aria-label="확대">＋</button><button class="btn sm" data-z="out" aria-label="축소">－</button><button class="btn sm" data-z="asia">🇰🇷 동아시아</button><button class="btn sm" data-z="world">🌍 세계</button></div>
      <div class="map-btns mode-btns">${[['rel', '관계'], ['camp', '진영'], ['ideo', '이념'], ['conflict', '분쟁']].map(([m, n]) => `<button class="btn sm ${m === mapMode ? 'primary' : ''}" data-mode="${m}">${n}</button>`).join('')}</div>
    </div>
    <div class="quick">${QUICK.map(k => `<button class="chip" data-q="${k}">${cflag(k)} ${esc(cname(k))}</button>`).join('')}</div>
    <svg id="geo" class="geo" viewBox="0 0 ${M.w} ${M.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="세계 외교 지도">
      <defs>
        <radialGradient id="seaGrad" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#1d3e5b"></stop><stop offset="1" stop-color="#0b1622"></stop></radialGradient>
        <pattern id="hatch-kr" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" style="fill:var(--enemy-fill)"></rect><rect width="1.5" height="3" style="fill:var(--kr-fill)"></rect></pattern>
        <pattern id="hatch-enemy" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" style="fill:var(--kr-fill)"></rect><rect width="1.5" height="3" style="fill:var(--enemy-fill)"></rect></pattern>
      </defs>
      <path d="${M.sphere}" class="sea"></path>
      <g class="g-land">${land}</g><g class="g-prov">${provs}</g>
      <g class="g-front"></g><g class="g-city">${cities}</g><g class="g-lbl">${labels}</g>
      <g class="eu-mark" data-c="eu"><circle cx="${bx}" cy="${by}"></circle><text x="${bx}" y="${by}" dx="0.7em" dy="0.35em">🇪🇺 EU</text></g>
    </svg>
    <div class="map-legend" id="map-legend"><span><i style="background:var(--kr-fill)"></i>대한민국·편입</span><span><i style="background:hsl(120 var(--land-s) var(--land-l))"></i>우호</span><span><i style="background:hsl(60 var(--land-s) var(--land-l))"></i>보통</span><span><i style="background:hsl(0 var(--land-s) var(--land-l))"></i>적대</span><span><i style="background:var(--enemy-fill)"></i>교전국</span><span><i style="background:var(--ally-fill)"></i>참전 우방</span><span>휠·드래그·두 손가락으로 확대/이동, 나라를 누르세요</span><span class="credit">지도: Natural Earth</span></div>`;
  const svg = container.querySelector('#geo');
  mapBuilt = { svg, land: [...svg.querySelectorAll('.land[data-c]')], prov: [...svg.querySelectorAll('.prov')], lbl: [...svg.querySelectorAll('.clbl')], front: svg.querySelector('.g-front') };
  bindMapInteraction(container, svg);
}

/* ---------------- 확대·이동 ---------------- */
function fitAspect(v, svg) {
  const r = svg.clientWidth / Math.max(1, svg.clientHeight) || (MAP_DATA.w / MAP_DATA.h);
  const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  let w = v.w, h = v.h;
  if (w / h > r) h = w / r; else w = h * r;
  w = clamp(w, 40, MAP_DATA.w * 1.05); h = w / r;
  return { x: clamp(cx - w / 2, -w * 0.3, MAP_DATA.w - w * 0.7), y: clamp(cy - h / 2, -h * 0.3, MAP_DATA.h - h * 0.7), w, h };
}
function applyView(svg) {
  mapView = fitAspect(mapView, svg);
  svg.setAttribute('viewBox', `${mapView.x} ${mapView.y} ${mapView.w} ${mapView.h}`);
  const unit = mapView.w / Math.max(1, svg.clientWidth);      // 화면 1px = 지도 몇 단위
  svg.style.setProperty('--u', unit);
  const z = MAP_DATA.w / mapView.w;
  svg.classList.toggle('zoomed', z > 3);
  // 화면에서 충분히 큰 나라만 이름 표시
  for (const t of mapBuilt.lbl) {
    const k = t.dataset.k, a = +t.dataset.a;
    const show = k === 'kr' || k === selCountry || Math.sqrt(a) * z > (z > 6 ? 9 : 20) || (z > 2.2 && isCore(k));
    t.classList.toggle('hide', !show);
  }
}
const viewAsia = () => { const [[x0, y0], [x1, y1]] = MAP_DATA.eastAsia; return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
const viewWorld = () => ({ x: 0, y: 0, w: MAP_DATA.w, h: MAP_DATA.h });
function zoomAt(svg, factor, px, py) { // px,py: 지도 좌표
  const w = mapView.w * factor, h = mapView.h * factor;
  mapView = { x: px - (px - mapView.x) * factor, y: py - (py - mapView.y) * factor, w, h };
  applyView(svg);
}
function zoomTo(k) {
  const svg = mapBuilt?.svg; if (!svg) return;
  if (k === 'eu') { const [x, y] = MAP_DATA.cities['브뤼셀']; mapView = { x: x - 150, y: y - 90, w: 300, h: 180 }; return applyView(svg); }
  const c = MAP_DATA.countries[k]; if (!c) return;
  const span = clamp(Math.sqrt(c.a) * 14, 70, 900);
  mapView = { x: c.c[0] - span / 2, y: c.c[1] - span / 3, w: span, h: span * 0.66 };
  applyView(svg);
}
function bindMapInteraction(container, svg) {
  const toMap = (cx, cy) => { const r = svg.getBoundingClientRect(); const ctm = svg.getScreenCTM().inverse(); const p = new DOMPoint(cx, cy).matrixTransform(ctm); return [p.x, p.y, r]; };
  svg.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = toMap(e.clientX, e.clientY); zoomAt(svg, Math.exp(e.deltaY * 0.0015), x, y); }, { passive: false });
  const ptrs = new Map(); let moved = 0, pinch0 = null;
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; pinch0 = null; });
  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const unit = mapView.w / svg.clientWidth;
    if (ptrs.size === 1) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy);
      mapView = { ...mapView, x: mapView.x - dx * unit, y: mapView.y - dy * unit }; applyView(svg);
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); moved += 10;
      if (pinch0) { const [x, y] = toMap((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); zoomAt(svg, pinch0 / d, x, y); }
      pinch0 = d;
    }
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('click', e => {
    if (moved > 6) return;
    const t = e.target.closest('[data-c]'); if (!t) return;
    const k = t.dataset.c; if (k === 'kr') return;
    selCountry = k; updateMap();
    if (openPanelName !== 'world') showTab('world'); else renderCountryPanel();
    $('cpanel-slot')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  container.querySelectorAll('[data-z]').forEach(b => b.onclick = () => {
    const z = b.dataset.z;
    if (z === 'in') zoomAt(svg, 0.6, mapView.x + mapView.w / 2, mapView.y + mapView.h / 2);
    else if (z === 'out') zoomAt(svg, 1.6, mapView.x + mapView.w / 2, mapView.y + mapView.h / 2);
    else { mapView = z === 'asia' ? viewAsia() : viewWorld(); applyView(svg); }
  });
  container.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    mapMode = b.dataset.mode;
    container.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('primary', x.dataset.mode === mapMode));
    updateMap();
  });
  container.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { selCountry = b.dataset.q; zoomTo(selCountry); updateMap(); showTab('world'); });
  const search = container.querySelector('#map-search');
  search.addEventListener('change', () => {
    const q = search.value.trim(); if (!q) return;
    const k = allCountryKeys().find(x => cname(x) === q) || allCountryKeys().find(x => cname(x).includes(q));
    if (!k) return toast('그런 나라를 찾을 수 없습니다.');
    selCountry = k; search.value = ''; zoomTo(k); updateMap(); showTab('world');
  });
  new ResizeObserver(() => { if (mapView && svg.clientWidth) applyView(svg); }).observe(svg);
}

/* ---------------- 지도 색칠 (상태가 바뀔 때마다) ---------------- */
function updateMap() {
  if (!mapBuilt) return;
  const occ = warOccupation(S), provK = new Set(Object.keys(MAP_DATA.prov));
  const whole = S.war && occ.wholeCountry ? S.war.k : null;
  for (const el of mapBuilt.land) {
    const k = el.dataset.c;
    el.style.fill = provK.has(k) ? 'var(--land-neutral)' : k === whole ? 'url(#hatch-kr)' : landFill(k);
    el.classList.toggle('gsel', k === selCountry);
  }
  for (const el of mapBuilt.prov) {
    const k = el.dataset.c, id = el.dataset.p;
    el.style.fill = occ.byUs.has(id) ? 'url(#hatch-kr)' : occ.byEnemy.has(id) ? 'url(#hatch-enemy)' : landFill(k);
    el.classList.toggle('gsel', k === selCountry);
  }
  for (const t of mapBuilt.lbl) {
    const k = t.dataset.k;
    t.textContent = k === 'kr' ? '대한민국' : `${S.war && (S.war.k === k || S.war.enemyAllies.includes(k)) ? '⚔️' : ''}${cname(k)}${S.annexed[k] ? ' (편입)' : ''}`;
  }
  mapBuilt.svg.querySelector('.eu-mark').classList.toggle('sel', selCountry === 'eu');
  const lg = $('map-legend');
  if (lg) lg.innerHTML = (mapMode === 'camp' ? Object.values(CAMPS).map(c => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join('')
    : mapMode === 'ideo' ? Object.values(IDEOLOGIES).map(c => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join('')
    : mapMode === 'conflict' ? Object.entries(CONFLICT_TYPES).map(([t, c]) => `<span><i style="background:${CONFLICT_COLOR[t]}"></i>${c.name}</span>`).join('')
    : `<span><i style="background:hsl(120 var(--land-s) var(--land-l))"></i>우호</span><span><i style="background:hsl(60 var(--land-s) var(--land-l))"></i>보통</span><span><i style="background:hsl(0 var(--land-s) var(--land-l))"></i>적대</span><span><i style="background:var(--enemy-fill)"></i>교전국</span><span><i style="background:var(--ally-fill)"></i>참전 우방</span>`)
    + `<span><i style="background:var(--kr-fill)"></i>대한민국·편입</span><span>휠·드래그·두 손가락으로 확대/이동, 나라를 누르세요</span><span class="credit">지도: Natural Earth · 지도자는 가상 인물</span>`;
  // 전쟁 중이면 서울과 상대 수도를 잇는 전선 화살표
  let front = '';
  if (S.war) {
    const a = MAP_DATA.cities['서울'], b = MAP_DATA.cities[CAPITAL[S.war.k]] || MAP_DATA.countries[S.war.k]?.c;
    if (b) front = `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="front"></line>`;
  }
  // 분쟁 지점: 맥박 치는 표시
  const hot = (k, type) => { const c = MAP_DATA.countries[k]?.c; return c ? `<g class="hot ${type}"><circle cx="${c[0]}" cy="${c[1]}" r="6"></circle><circle cx="${c[0]}" cy="${c[1]}" r="6" style="animation-delay:1s"></circle><circle class="core" cx="${c[0]}" cy="${c[1]}" r="1.6"></circle></g>` : ''; };
  for (const c of (S.world?.conflicts || [])) if (c.type !== 'cyber') front += hot(c.type === 'civil' ? c.a : c.b, c.type);
  if (S.war) front += hot(S.war.k, 'war') + hot('kr', 'war');
  mapBuilt.front.innerHTML = front;
  if (mapView) applyView(mapBuilt.svg);
}

/* ---------------- 탭 전체 ---------------- */
function renderWorld() {
  const el = $('tab-world'); if (!el) return;
  if (typeof MAP_DATA === 'undefined') { el.innerHTML = '<div class="empty">지도 데이터를 불러오지 못했습니다.</div>'; return; }
  // 지도는 화면 무대(stage)에 항상 깔려 있고, 외교 패널에는 정세·국가 정보만
  if (!$('geo')) buildGeoMap($('stage-map'));
  if (!el.querySelector('#situation-slot')) el.innerHTML = `<div id="war-slot"></div><div id="situation-slot"></div><div id="cpanel-slot"></div>`;
  if (!mapView && mapBuilt.svg.clientWidth) mapView = viewAsia();
  renderWarPanel(); renderSituation(); updateMap(); renderCountryPanel();
}

function renderWarPanel() {
  const w = S.war, slot = $('war-slot'); if (!slot) return;
  slot.innerHTML = w ? `<div class="warbox">
    <h3>⚔️ 전쟁 중: ${cflag(w.k)} ${esc(cname(w.k))} (${w.turns}분기째) · 목표 ${GOAL_NAMES[w.goal]}</h3>
    <div class="warbar"><i style="left:${50 + w.score / 2}%"></i><span>패전 -100</span><span>0</span><span>승리 +100</span></div>
    <div>전황 점수 <b>${w.score.toFixed(0)}</b> · 우리 편 ${['대한민국', ...w.allies.map(cname)].join(', ')} · 상대 편 ${[cname(w.k), ...w.enemyAllies.map(cname)].join(', ')}</div>
    <div class="muted small">분기마다 성장률·행복도·재정이 깎이고 채무가 늘어납니다. 점령당한 시·도만큼 피해가 커집니다. 10분기가 지나면 국제 중재로 정전됩니다.${nukeRisk(S) > 0 ? ` <b style="color:var(--bad)">☢️ 핵 사용 위험 분기당 ${(nukeRisk(S) * 100).toFixed(1)}%</b>` : ''}</div>
    ${w.log.length ? `<div class="muted small">${esc(w.log[w.log.length - 1])}</div>` : ''}
    <div class="row-btns"><button class="btn sm danger" data-war="offensive">🎖️ 총공세 ${won(15)}</button><button class="btn sm" data-war="peace">🕊️ 휴전·강화 제안</button><button class="btn sm ghost" data-wfocus="1">🗺️ 전선 보기</button></div>
  </div>` : '';
  slot.querySelectorAll('[data-war]').forEach(b => b.onclick = () => act(warAction)(S, b.dataset.war));
  slot.querySelectorAll('[data-wfocus]').forEach(b => b.onclick = () => zoomTo(S.war.k));
}

function renderCountryPanel() {
  const slot = $('cpanel-slot'); if (!slot) return;
  const k = selCountry, c = cinfo(k); if (!c) return;
  const d = dip(S, k), r = relOf(S, k);
  const owner = S.world?.owner?.[k];
  const L = S.leaders?.[k];
  const leaderCard = L && !owner && !S.annexed[k] ? (() => {
    const yrs = Math.max(0, (S.turn - L.since) / 4);
    const att = leaderRelDelta(S, k);
    const agg = leaderAgg(S, k);
    return `<div class="leader">
      <div class="avatar" style="background:hsl(${L.avatarHue} 45% 42%)">${esc(L.name.replace(/\s/g, '').slice(0, 1))}</div>
      <div class="lmain">
        <div><b class="lname">${esc(L.name)}</b> <span class="muted">${esc(L.title)} · 재임 ${yrs.toFixed(1)}년</span></div>
        <div class="ltags"><span class="tag" style="color:${IDEOLOGIES[L.gov].color};border-color:${IDEOLOGIES[L.gov].color}">${IDEOLOGIES[L.gov].name}</span><span class="tag">${CAMPS[campOf(S, k)].name}</span>${L.traits.map(t => `<span class="tag trait" title="${esc(TRAITS[t].desc)}">${TRAITS[t].name}</span>`).join('')}</div>
        <div class="muted small">대한 태도 ${att >= 4 ? '<b class="good-t">우호적</b>' : att <= -4 ? '<b class="bad-t">냉담</b>' : '중립'} · 대외 공격성 ${agg >= 55 ? '<b class="bad-t">높음</b>' : agg >= 35 ? '보통' : '낮음'} (${agg})</div>
      </div>
      <button class="btn sm primary" id="btn-talk">🗣️ 대화하기</button>
    </div>`;
  })() : owner ? `<div class="verdict bad">${cflag(owner)} ${esc(cname(owner))}에 강제 병합된 지역입니다. <button class="btn sm" id="btn-owner">${esc(cname(owner))} 보기</button></div>` : '';
  const conflicts = (S.world?.conflicts || []).filter(x => x.a === k || x.b === k);
  const confHtml = conflicts.length ? `<div class="box"><h4>진행 중인 분쟁</h4>${conflicts.map(x => `<div>${CONFLICT_TYPES[x.type].icon} ${CONFLICT_TYPES[x.type].name}: ${esc(cname(x.a))}${x.b !== x.a ? ' ↔ ' + esc(cname(x.b)) : ''} (${x.turns}분기째)</div>`).join('')}</div>` : '';
  const odds = !c.isBloc && !S.annexed[k] && !owner ? (() => {
    const o = warOdds(S, k);
    return `<div class="box"><h4>⚔️ 전쟁 시뮬레이션</h4>우리 편: ${['대한민국', ...o.allies.map(cname)].join(', ')} (전력 ${o.ours.toFixed(0)}${o.reach < 1 ? `, 원거리 투사 ${Math.round(o.reach * 100)}%` : ''})<br>상대 편: ${[c.name, ...o.en.map(cname)].join(', ')} (전력 ${o.theirs.toFixed(0)})<br>
      판정: <b style="color:${o.edge > 0.15 ? 'var(--good)' : o.edge > -0.05 ? 'var(--mid)' : 'var(--bad)'}">${o.edge > 0.25 ? '압도적 우세' : o.edge > 0.1 ? '우세' : o.edge > -0.05 ? '팽팽함' : o.edge > -0.2 ? '열세' : '절대 열세'}</b>${(c.nukes || o.en.some(x => cinfo(x).nukes)) ? ' · ☢️ 상대 진영 핵보유: 몰리면 핵 사용 위험' : ''}${!c.annex ? ' · 핵보유국이라 합병은 불가(배상만 가능)' : ''}</div>`;
  })() : '';
  const actions = S.annexed[k] ? '<div class="empty">합병된 지역입니다.</div>' : DIPLO_ACTIONS.map(a => {
    const why = a.can(S, k), cost = diploCost(S, a, k);
    return `<div class="dact ${why ? 'off' : ''}"><div><b>${a.icon} ${a.name}</b> <span class="tag">${won(cost)}</span><div class="muted small">${esc(why || a.desc)}</div></div>
      <button class="btn sm ${a.id === 'war' ? 'danger' : ''}" data-dact="${a.id}" ${why ? 'disabled' : ''}>실행</button></div>`;
  }).join('');
  slot.innerHTML = `<div class="cpanel">
    <h3>${c.flag} ${esc(c.name)} ${c.core ? '<span class="tag cur">핵심국</span>' : ''}${c.isBloc ? '<span class="tag">블록</span>' : ''}</h3>
    <div class="muted small">${[c.note, c.sub || c.reg, !c.isBloc ? `인구 ${fmtPop(c.pop)}` : '', !c.isBloc && c.gdp ? `GDP ${fmtGdp(c.gdp)}` : '', `서울에서 ${Math.round(c.km).toLocaleString('ko-KR')}km`].filter(Boolean).map(esc).join(' · ')}</div>
    <div class="cfacts"><span>관계 <b style="color:hsl(${relHue(r)} 60% 45%)">${r.toFixed(0)}</b></span><span>군사력 <b>${c.mil}</b></span><span>경제 규모 <b>${c.eco}</b></span><span>${c.nukes ? '☢️ 핵보유' : '비핵'}</span>${c.bloc ? `<span>블록 <b>${c.bloc === 'NATO' ? 'NATO' : { csto: '러시아 안보동맹', cnPartner: '중국 우방', usPartner: '미국 우방', ruPartner: '러시아 우방' }[c.bloc]}</b></span>` : ''}</div>
    <div class="cfacts">${d.alliance ? '<span class="tag cur">동맹</span>' : ''}${d.fta ? '<span class="tag">FTA</span>' : ''}${d.sanction ? '<span class="tag const">제재 중</span>' : ''}${d.casusBelli >= S.turn ? '<span class="tag const">전쟁 명분</span>' : ''}${d.offer >= S.turn ? '<span class="tag new">FTA 제안 받음</span>' : ''}${c.eu ? '<span class="tag">EU 회원국</span>' : ''}${!c.core && !c.isBloc ? '<span class="muted small">핵심국이 아닌 나라는 국가 지표에 주는 영향이 경제 규모에 비례합니다.</span>' : ''}</div>
    ${leaderCard}${confHtml}
    ${odds}
    <h4 class="sec">외교 행동</h4><div class="dacts">${actions}</div>
  </div>`;
  $('btn-talk') && ($('btn-talk').onclick = () => openTalk(k));
  $('btn-owner') && ($('btn-owner').onclick = () => { selCountry = owner; zoomTo(owner); updateMap(); renderCountryPanel(); });
  slot.querySelectorAll('[data-dact]').forEach(b => b.onclick = () => {
    if (b.dataset.dact === 'war') return confirmWar(k);
    act(diploAction)(S, b.dataset.dact, k);
  });
}

function confirmWar(k) {
  const c = cinfo(k), o = warOdds(S, k);
  const goals = k === 'nk' ? ['unify', 'concession'] : c.annex ? ['annex', 'concession'] : ['concession'];
  openModal(`<h2>⚔️ ${c.flag} ${esc(c.name)}에 선전포고</h2>
    <p class="lead">전력 비교: 우리 편 ${o.ours.toFixed(0)} vs 상대 편 ${o.theirs.toFixed(0)}${o.reach < 1 ? ` (서울에서 ${Math.round(c.km).toLocaleString('ko-KR')}km — 전력 투사 ${Math.round(o.reach * 100)}%)` : ''}. 상대 편 참전: ${o.en.map(cname).join(', ') || '없음'}. 침략 전쟁은 국제 사회와 같은 대륙 나라들의 반발을 부릅니다. 전쟁 중에는 매 분기 경제·행복도·재정이 타격을 입습니다.${c.nukes ? ' 상대는 핵보유국입니다. 몰리면 핵을 쓸 수 있습니다.' : ''}</p>
    <h3 class="sec">전쟁 목표</h3>
    ${goals.map(g => `<button class="btn ${g === 'concession' ? '' : 'danger'}" data-goal="${g}" style="margin:4px">${GOAL_NAMES[g]}${g === 'concession' ? ' (배상금·경제 이권)' : g === 'unify' ? ' (승리 시 한반도 통일)' : ' (승리 시 영토 편입)'}</button>`).join('')}
    <div class="modal-actions"><button class="btn" onclick="closeModal()">취소</button></div>`);
  document.querySelectorAll('[data-goal]').forEach(b => b.onclick = () => { closeModal(); act(diploAction)(S, 'war', k, b.dataset.goal); });
}

/* ---------------- 세계 정세 패널 ---------------- */
let showAllNews = false;
function renderSituation() {
  const slot = $('situation-slot'); if (!slot || !S.world) return;
  const W = S.world, T = W.tension;
  const tc = T >= 70 ? 'var(--bad)' : T >= 50 ? 'var(--mid)' : 'var(--good)';
  const list = W.conflicts.filter(c => c.type !== 'cyber').map(c => {
    const acts = INTERVENTIONS.filter(a => a.types.includes(c.type)).map(a => `<button class="btn sm ${a.id === 'join' ? 'danger' : ''}" data-iv="${a.id}" data-cid="${c.id}" ${c.krDone?.includes(a.id) ? 'disabled' : ''} title="${esc(a.desc)}">${a.icon} ${a.name} ${won(a.pc)}</button>`).join('');
    const ally = c.type === 'war' && dip(S, c.b).alliance;
    return `<div class="conf ${c.type}">
      <div class="conf-top"><b>${CONFLICT_TYPES[c.type].icon} ${CONFLICT_TYPES[c.type].name}</b> ${cflag(c.a)} ${esc(cname(c.a))}${c.b !== c.a ? ` ↔ ${cflag(c.b)} ${esc(cname(c.b))}` : ''} <span class="muted small">${c.turns}분기째${c.type === 'war' ? ` · 전황 ${c.score >= 0 ? cname(c.a) : cname(c.b)} 우세(${Math.abs(c.score).toFixed(0)})` : ''}${c.supportB.length ? ` · ${c.supportB.map(cname).join('·')} 무기 지원` : ''}</span>${ally ? ' <span class="tag const">우리 동맹국 피침</span>' : ''}</div>
      <div class="row-btns">${acts}<button class="btn sm ghost" data-goto="${c.b !== c.a ? c.b : c.a}">🗺️ 보기</button></div></div>`;
  }).join('') || '<div class="muted small">현재 큰 분쟁이 없습니다.</div>';
  const news = W.news.slice(0, showAllNews ? 40 : 6).map(n => { const t = turnLabel(n.turn); return `<div class="news ${n.type}"><span class="t">${t.year}.${t.q}Q</span>${esc(n.text)}</div>`; }).join('');
  slot.innerHTML = `<div class="situation">
    <div class="sit-head"><h3>🌐 세계 정세</h3><div class="tension"><span>세계 긴장도</span><div class="bar"><i style="width:${T}%;background:${tc}"></i></div><b style="color:${tc}">${T.toFixed(0)}</b></div></div>
    <div class="sit-grid"><div><h4 class="sec">진행 중인 분쟁 (${W.conflicts.filter(c => c.type !== 'cyber').length})</h4>${list}</div>
    <div><h4 class="sec">세계 뉴스</h4>${news || '<div class="muted small">아직 소식이 없습니다. 분기를 진행하세요.</div>'}${W.news.length > 6 ? `<button class="btn sm ghost" id="btn-news">${showAllNews ? '접기' : '더 보기'}</button>` : ''}</div></div>
  </div>`;
  slot.querySelectorAll('[data-iv]').forEach(b => b.onclick = () => act(intervene)(S, b.dataset.cid, b.dataset.iv));
  slot.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { selCountry = b.dataset.goto; zoomTo(selCountry); updateMap(); renderCountryPanel(); });
  $('btn-news') && ($('btn-news').onclick = () => { showAllNews = !showAllNews; renderSituation(); });
}

/* ---------------- 지도자와 대화 ---------------- */
const TALK_LIMIT = 3;
function talkLeft(k) { S.talkUsed = S.talkUsed || {}; return TALK_LIMIT - (S.talkUsed[`${k}@${S.turn}`] || 0); }
function openTalk(k) {
  const L = S.leaders[k]; S.talks = S.talks || {}; const hist = S.talks[k] = S.talks[k] || [];
  const render = () => {
    $('talk-log').innerHTML = hist.map(m => `<div class="msg ${m.role}">${m.role === 'them' ? `<b>${esc(L.name)}</b>` : '<b>나</b>'}<div>${esc(m.text)}</div>${m.note ? `<div class="muted small">${esc(m.note)}</div>` : ''}</div>`).join('') || `<div class="muted small">${esc(L.title)} ${esc(L.name)}에게 하고 싶은 말을 적어 보세요. 제안·설득·경고 무엇이든 됩니다. 말에 따라 관계가 달라집니다.</div>`;
    $('talk-log').scrollTop = 1e6;
    $('talk-left').textContent = `이번 분기 남은 대화 ${talkLeft(k)}회`;
  };
  openModal(`<h2>🗣️ ${cflag(k)} ${esc(L.title)} ${esc(L.name)}</h2>
    <p class="lead">${IDEOLOGIES[L.gov].name} · ${L.traits.map(t => TRAITS[t].name).join('·')} · 현재 관계 ${relOf(S, k).toFixed(0)} · ${ClaudeAI.enabled() ? 'Claude가 이 지도자를 연기합니다' : '내장 대화 AI'} <span class="muted small">(가상 인물)</span></p>
    <div id="talk-log" class="talk-log"></div>
    <div class="custom-row"><input id="talk-input" maxlength="300" placeholder="예) 반도체 공급망 협력을 제안합니다 / 국경 도발을 멈추십시오"><button class="btn primary" id="talk-send">보내기</button></div>
    <div class="muted small" id="talk-left"></div>
    <div id="talk-deal"></div>`);
  render();
  const send = async () => {
    const msg = $('talk-input').value.trim(); if (!msg) return;
    if (talkLeft(k) <= 0) return toast('이번 분기에는 더 대화할 수 없습니다. 다음 분기에 다시 시도하세요.');
    $('talk-send').disabled = true; $('talk-input').value = '';
    hist.push({ role: 'me', text: msg }); render();
    $('talk-log').insertAdjacentHTML('beforeend', '<div class="msg them" id="talk-wait"><span class="spinner"></span>생각하는 중…</div>');
    let r = null;
    try { if (ClaudeAI.enabled()) r = await ClaudeAI.leaderTalk(S, k, L, hist.slice(-8), msg); }
    catch (e) { toast('Claude 응답 실패 → 내장 대화 AI로 대체: ' + esc(e.message), 4000); }
    if (!r) r = ruleLeaderTalk(S, k, msg);
    const d = clamp(Math.round(r.relDelta || 0), -8, 8);
    relBump(S, k, d, d * 0.5);
    S.talkUsed[`${k}@${S.turn}`] = (S.talkUsed[`${k}@${S.turn}`] || 0) + 1;
    hist.push({ role: 'them', text: r.reply, note: `관계 ${d >= 0 ? '+' : ''}${d} · ${r.mood || ''}` });
    if (hist.length > 30) hist.splice(0, hist.length - 30);
    addLog(S, d >= 0 ? 'info' : 'bad', `🗣️ ${cname(k)} ${L.title} ${L.name}과(와) 대화 (관계 ${d >= 0 ? '+' : ''}${d})`);
    saveGame(S); render(); $('talk-send').disabled = false;
    const prop = r.proposal;
    if (prop && prop !== 'none') {
      const map = { fta: 'fta', alliance: 'alliance', aid: 'aid' };
      const aid = map[prop];
      $('talk-deal').innerHTML = aid ? `<div class="verdict good">${esc(L.name)}이(가) ${prop === 'fta' ? 'FTA 협상' : prop === 'alliance' ? '안보 동맹' : '원조'}에 긍정적입니다. <button class="btn sm primary" id="talk-do">${DIPLO_ACTIONS.find(a => a.id === aid).icon} 바로 추진</button></div>` : prop === 'ceasefire' ? `<div class="verdict">${esc(L.name)}이(가) 휴전 논의에 열려 있다고 말했습니다. 세계 정세의 '중재'를 시도해 보세요.</div>` : '';
      $('talk-do') && ($('talk-do').onclick = () => { const res = act(diploAction)(S, aid, k); if (res?.ok) $('talk-deal').innerHTML = ''; });
    }
    renderSystemsTabs();
  };
  $('talk-send').onclick = send;
  $('talk-input').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}
