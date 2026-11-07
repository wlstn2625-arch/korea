/* =========================================================
 *  군단 지휘 화면: 지도에서 군단을 누르고 → 적 지역(공격)이나 아군 지역(이동)을 누름
 *  전쟁 패널의 군단 카드, 전투 결정 카드
 * ========================================================= */
let selArmy = null;
// 지도 위 군단 표식 (기존 전선 표시에 덧붙임)
const _warOverlay = warOverlay;
warOverlay = function (s) {
  let h = _warOverlay(s);
  const T = s.war.theater; if (!T.armies) return h;
  const by = Object.fromEntries(T.provs.map(p => [p.id, p]));
  let orders = '', marks = '';
  T.armies.forEach((a, i) => {
    if (a.str <= 0) return;
    const p = by[a.loc]; if (!p) return;
    const off = T.armies.filter((b, j) => j < i && b.loc === a.loc && b.str > 0).length; // 같은 곳이면 살짝 비켜 그림
    const x = p.c[0] + off * 1.4, y = p.c[1] - off * 1.1;
    if (a.order === 'attack' && a.target && by[a.target]) orders += `<line class="aord atk ${selArmy === a.id ? 'sel' : ''}" x1="${x}" y1="${y}" x2="${by[a.target].c[0]}" y2="${by[a.target].c[1]}" marker-end="url(#arr-kr)"></line>`;
    if (a.order === 'move' && a.path?.length) { const pts = [[x, y], ...a.path.map(id => by[String(id).replace('sea:', '')]?.c).filter(Boolean)]; orders += `<polyline class="aord mv" points="${pts.map(q => q.join(',')).join(' ')}"></polyline>`; }
    const num = a.name.match(/\d/)?.[0] || 'R';
    marks += unitG(x, y, `army ${selArmy === a.id ? 'sel' : ''} ${a.order}`, `<g class="army-hit" data-army="${a.id}"><rect x="-15" y="-11" width="30" height="22" rx="3"></rect><path d="M-15 -11 L15 11 M-15 11 L15 -11"></path><text class="an" y="4">${num}</text>
      <rect class="sb" x="-15" y="13" width="30" height="3.5"></rect><rect class="sf" x="-15" y="13" width="${(30 * a.str / 100).toFixed(1)}" height="3.5"></rect>
      <text class="ag" y="-15">${esc(a.gen.name)} ${'★'.repeat(Math.min(5, a.gen.skill))}${a.auto ? ' 🤖' : ''}</text></g>`);
  });
  return h + orders + marks;
};
// 지도 클릭: 군단 선택 → 목표 지정 (기존 주공 목표 클릭보다 먼저 처리)
document.addEventListener('click', e => {
  const T = S?.war?.theater; if (!T?.armies) return;
  const hit = e.target.closest?.('#geo .army-hit');
  if (hit) { e.stopImmediatePropagation(); selArmy = selArmy === hit.dataset.army ? null : hit.dataset.army; const a = T.armies.find(x => x.id === selArmy); toast(a ? `🎖️ ${esc(a.name)} 선택 — 공격할 적 지역(인접)이나 이동할 아군 지역을 누르세요.` : '선택 해제'); updateMap(); if (openPanelName === 'world') renderWarPanel(); return; }
  if (!selArmy) return;
  const el = e.target.closest?.('#geo .prov, #geo .vreg-hit'); if (!el) return;
  e.stopImmediatePropagation();
  const r = armyOrder(S, selArmy, 'go', el.dataset.p || el.dataset.vp);
  toast(esc(r.msg || '')); if (r.ok) { saveGame(S); if (typeof consumeWarFx === 'function') consumeWarFx(); }
  updateMap(); if (openPanelName === 'world') renderWarPanel();
  if (S.war?.theater?.pendingBattle) openBattleCard();
}, true);

// 전쟁 패널: 군단 카드
const _renderWarPanel = renderWarPanel;
renderWarPanel = function (force) {
  _renderWarPanel(force);
  const T = S?.war?.theater, box = document.querySelector('#war-slot .warbox.hoi'); if (!T?.armies || !box) return;
  const by = Object.fromEntries(T.provs.map(p => [p.id, p]));
  const ordTxt = a => a.str <= 0 ? `💀 궤멸 — 재편성 ${Math.max(0, 30 - (a.dead || 0))}일` : a.order === 'attack' && a.target ? `⚔️ ${by[a.target]?.n} 공격 중` : a.order === 'move' ? `🚚 ${by[String(a.path.at(-1)).replace('sea:', '')]?.n || ''}(으)로 이동 중${String(a.path[0]).startsWith('sea:') ? '(해상)' : ''}` : a.resting ? '😮‍💨 휴식·재정비' : '🛡️ 방어 중';
  const div = document.createElement('div'); div.className = 'army-sec';
  div.innerHTML = `<div class="wlabel">🎖️ 군단 지휘 <span class="muted">지도에서 군단 표식을 누른 뒤 → 인접한 적 지역(공격) 또는 아군 지역(이동)을 누르세요. 적을 사방에서 둘러싸면 포위 섬멸!</span></div>
    <div class="armies">${T.armies.map(a => `<div class="acard ${selArmy === a.id ? 'sel' : ''} ${a.str <= 0 ? 'dead' : ''}">
      <div class="ah"><b>${esc(a.name)}</b><span class="muted small">병력 ${Math.round(a.share * 100)}% · 전과 ${a.kills}</span></div>
      <div class="small">👤 ${esc(a.gen.name)} 대장 ${'★'.repeat(Math.min(5, a.gen.skill))} ${a.gen.traits.map(t => `<span class="tag" title="${esc(GEN_TRAITS[t].desc)}">${GEN_TRAITS[t].icon} ${GEN_TRAITS[t].name}</span>`).join('')}</div>
      <div class="wrow"><span>전투력</span>${meter(a.str, 'org')}<em>${a.str.toFixed(0)}</em></div>
      <div class="small">📍 ${esc(by[a.loc]?.n || '')} · ${ordTxt(a)}</div>
      <div class="row-btns"><button class="btn sm ${selArmy === a.id ? 'primary' : ''}" data-asel="${a.id}">${selArmy === a.id ? '✔ 선택됨' : '🎯 선택'}</button><button class="btn sm" data-ahold="${a.id}">🛡️ 방어</button><button class="btn sm ${a.auto ? 'primary' : 'ghost'}" data-aauto="${a.id}">🤖 자동 ${a.auto ? 'ON' : 'OFF'}</button>
        ${T.armies.length > 1 ? `<button class="btn sm ghost" data-ashare="${a.id}" title="가장 큰 다른 군단에서 병력 10%를 데려옵니다">➕ 증원</button>` : ''}</div>
    </div>`).join('')}</div>`;
  const anchor = box.querySelector('.wlabel'); box.insertBefore(div, anchor);
  div.querySelectorAll('[data-asel]').forEach(b => b.onclick = () => { selArmy = selArmy === b.dataset.asel ? null : b.dataset.asel; updateMap(); renderWarPanel(); if (selArmy) { const a = T.armies.find(x => x.id === selArmy); zoomToProv(a.loc); toast('지도에서 공격할 적 지역이나 이동할 아군 지역을 누르세요.'); } });
  div.querySelectorAll('[data-ahold]').forEach(b => b.onclick = () => act(armyOrder)(S, b.dataset.ahold, 'hold'));
  div.querySelectorAll('[data-aauto]').forEach(b => b.onclick = () => act(armyOrder)(S, b.dataset.aauto, 'auto'));
  div.querySelectorAll('[data-ashare]').forEach(b => b.onclick = () => { const to = b.dataset.ashare, from = [...T.armies].filter(x => x.id !== to && x.str > 0).sort((x, y) => y.share - x.share)[0]; if (from) act(shiftShare)(S, from.id, to); });
};
function zoomToProv(pid) {
  const p = S.war?.theater?.provs.find(x => x.id === pid); if (!p || !mapBuilt) return;
  const w = 40, h = 40 * (mapBuilt.svg.clientHeight / Math.max(1, mapBuilt.svg.clientWidth) || 0.6);
  mapView = { x: p.c[0] - w / 2, y: p.c[1] - h / 2, w, h }; applyView(mapBuilt.svg);
}

// 전투 결정 카드
function openBattleCard() {
  const T = S?.war?.theater, B = T?.pendingBattle; if (!B || !$('modal').classList.contains('hidden')) return;
  setSpeed(0);
  const p = T.provs.find(x => x.id === B.pid), a = T.armies?.find(x => x.id === B.aid);
  openModal(`<div class="event battle">
    <div class="ev-banner ev-security"><span class="ev-art">⚔️</span><span class="ev-kind">전투 결정</span><span class="ev-date">${esc(a?.name || '')}</span></div>
    <h2>${esc(p.n)} 공방전</h2>
    <p class="ev-desc">${esc(a?.gen.name || '')} 대장이 보고합니다. "${esc(p.n)}${p.vp >= 5 ? '은(는) 적의 핵심 거점입니다' : p.terrain > 1 ? '은(는) 험준한 산악 지대입니다' : '에 적이 요새를 쌓았습니다'}. 어떻게 공략할까요?"</p>
    <div class="ev-opts">${BATTLE_CHOICES.map(c => `<button class="ev-opt" data-bc="${c.id}" ${c.mod.cost && S.pcap < c.mod.cost ? 'disabled' : ''}><b>${c.icon} ${c.name}</b><span>${esc(c.desc)}</span></button>`).join('')}</div></div>`, { closable: false });
  document.querySelectorAll('[data-bc]').forEach(b => b.onclick = () => { const r = applyBattle(S, b.dataset.bc); if (r.ok === false) return toast(esc(r.msg)); saveGame(S); closeModal(); toast(esc(r.msg)); renderAll(); });
}
const _warTick2 = warTick;
warTick = function () { _warTick2(); if (S?.war?.theater?.pendingBattle) openBattleCard(); };
