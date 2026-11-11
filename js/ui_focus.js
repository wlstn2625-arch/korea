/* =========================================================
 *  국가 중점 화면 (하츠식 트리) + 진행 표시·완료 연출
 * ========================================================= */
const FC_W = 124, FC_H = 104; // 칸 크기(px)
function renderFocus() {
  const el = $('tab-focus'); if (!el || !S) return;
  const F = focusState(S), cur = F.cur && focusById(F.cur);
  const head = cur
    ? `<div class="fc-cur"><span class="fc-ic">${cur.icon}</span><div><b>진행 중: ${esc(cur.name)}</b><div class="small muted">${esc(cur.fx)}</div>${meter(F.prog / cur.days * 100, 'eq')}<small>${Math.floor(F.prog)} / ${cur.days}일</small></div></div>`
    : `<div class="fc-cur none"><span class="fc-ic">🎯</span><div><b>국가 중점을 고르세요</b><div class="small muted">하츠 오브 아이언처럼 한 번에 하나씩, 정해진 날수가 지나면 효과가 발동합니다. 갈림길(택일)에서는 한쪽만 고를 수 있습니다. 진행 중에 바꾸면 쌓인 날수는 사라집니다.</div></div></div>`;
  const tree = FOCUS_BRANCHES.map(B => {
    const list = FOCUSES.filter(f => f.br === B.id), rows = Math.max(...list.map(f => f.y)) + 1;
    const pos = f => ({ x: Math.round(f.x * 2) * FC_W + FC_W / 2, y: f.y * FC_H + 34 });
    const lines = list.flatMap(f => [...(f.req || []), ...(f.any || [])].map(r => { const a = pos(focusById(r)), b = pos(f); return `<path class="fc-ln ${F.done.includes(r) ? 'on' : ''} ${f.any ? 'any' : ''}" d="M${a.x} ${a.y + 30} C${a.x} ${a.y + 55},${b.x} ${b.y - 40},${b.x} ${b.y - 18}"></path>`; })).join('');
    const nodes = list.map(f => {
      const why = focusWhyNot(S, f), st = F.done.includes(f.id) ? 'done' : F.cur === f.id ? 'run' : why === '다른 노선을 택함' ? 'excl' : why ? 'lock' : 'open', p = pos(f);
      return `<button class="fc-node ${st}" style="left:${p.x - 56}px;top:${p.y - 18}px" data-fc="${f.id}" title="${esc(f.name)} — ${esc(f.fx)}">
        <span class="fc-badge">${f.icon}</span><b>${esc(f.name)}</b><small>${st === 'done' ? '✅ 완료' : st === 'run' ? `${Math.floor(F.prog)}/${f.days}일` : st === 'excl' ? '✖ 택하지 않은 노선' : `${f.days}일`}${f.excl ? ' · 택일' : ''}</small>
        ${st === 'run' ? `<i class="fc-prog" style="width:${F.prog / f.days * 100}%"></i>` : ''}</button>`;
    }).join('');
    return `<div class="fc-br"><div class="fc-bh">${B.icon} ${B.name}</div><div class="fc-area" style="width:${FC_W * 3}px;height:${rows * FC_H + 20}px"><svg class="fc-svg" width="${FC_W * 3}" height="${rows * FC_H + 20}">${lines}</svg>${nodes}</div></div>`;
  }).join('');
  const sel = F.sel && focusById(F.sel);
  el.innerHTML = `${head}
    ${sel ? `<div class="fc-detail"><span class="fc-ic">${sel.icon}</span><div><b>${esc(sel.name)}</b> <span class="muted small">${sel.days}일</span><div class="small">효과: ${esc(sel.fx)}</div>
      ${sel.excl ? `<div class="small bad-t">택일: ${sel.excl.map(x => esc(focusById(x).name)).join(', ')}과(와) 함께 할 수 없습니다.</div>` : ''}
      <div class="row-btns">${(() => { const why = focusWhyNot(S, sel); return why ? `<span class="tag">${esc(why)}</span>` : `<button class="btn sm primary" data-fcgo="${sel.id}">🎯 이 중점 추진${F.cur ? ' (현재 중점 교체)' : ''}</button>`; })()}</div></div></div>` : ''}
    <div class="fc-tree">${tree}</div>
    <div class="muted small">완료 ${F.done.length}/${FOCUSES.length} · 최종 중점 '조국과 민족을 위하여'(자주국방)는 총력 국가 체제를 엽니다.</div>`;
  el.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { F.sel = b.dataset.fc; renderFocus(); });
  el.querySelectorAll('[data-fcgo]').forEach(b => b.onclick = () => { const r = startFocus(S, b.dataset.fcgo); toast(esc(r.msg || '')); if (r.ok) { F.sel = null; saveGame(S); renderAll(); renderFocus(); } });
}
function focusDoneFx(f) { if (typeof rewardPop === 'function' && typeof S !== 'undefined' && S) rewardPop(`🎯 ${f.name}`, f.fx, f.id === 'd_final'); }

// 메뉴·패널 연결
(function () {
  const dock = $('tabs'); if (dock && !dock.querySelector('[data-tab="focus"]')) {
    const b = document.createElement('button'); b.dataset.tab = 'focus'; b.innerHTML = '<span>🎯</span>국가 중점<i id="focus-badge" class="badge hidden">!</i>';
    dock.insertBefore(b, dock.querySelector('[data-tab="politics"]'));
    b.onclick = () => showTab('focus', true);
  }
  const body = document.querySelector('#panel-wrap .panel-body');
  if (body && !$('tab-focus')) { const d = document.createElement('div'); d.id = 'tab-focus'; d.className = 'tab'; body.appendChild(d); }
  if (typeof PANEL_TITLES !== 'undefined') PANEL_TITLES.focus = '🎯 국가 중점';
  const st = showTab; showTab = function (name, toggle) { st(name, toggle); if (name === 'focus') renderFocus(); };
  const ra = renderAll; renderAll = function () { ra(); const bd = $('focus-badge'); if (bd && S) bd.classList.toggle('hidden', !!focusState(S).cur); if (openPanelName === 'focus') renderFocus(); };
})();
// 임무 창 위에 진행 중인 중점 표시
if (typeof renderQuest === 'function') (function () {
  const f = renderQuest;
  renderQuest = function () {
    f(); const q = $('quest'); if (!q || !S) return;
    const F = focusState(S), cur = F.cur && focusById(F.cur);
    const d = document.createElement('button'); d.className = `q-focus ${cur ? '' : 'none'}`;
    d.innerHTML = cur ? `<span>${cur.icon}</span><span class="t">${esc(cur.name)}</span><span class="b"><i style="width:${F.prog / cur.days * 100}%"></i></span><small>${Math.floor(F.prog)}/${cur.days}일</small>` : '<span>🎯</span><span class="t">국가 중점을 고르세요!</span>';
    d.onclick = () => showTab('focus');
    q.insertBefore(d, q.children[1] || null);
  };
})();
// 시간이 흐르는 동안 진행 막대만 가볍게 갱신
setInterval(() => {
  if (typeof S === 'undefined' || !S || typeof gameSpeed === 'undefined' || !gameSpeed) return;
  const F = focusState(S), cur = F.cur && focusById(F.cur), q = document.querySelector('.q-focus');
  if (q && cur) { const i = q.querySelector('.b i'), sm = q.querySelector('small'); if (i) i.style.width = `${F.prog / cur.days * 100}%`; if (sm) sm.textContent = `${Math.floor(F.prog)}/${cur.days}일`; }
  if (q && !cur && !q.classList.contains('none')) renderQuest();
  if (openPanelName === 'focus' && cur) { const fi = document.querySelector('.fc-node.run .fc-prog'); if (fi) fi.style.width = `${F.prog / cur.days * 100}%`; }
}, 1000);
if (typeof ACHIEVEMENTS !== 'undefined') ACHIEVEMENTS.push(
  { id: 'f21', icon: '🎯', name: '국가 백년대계', desc: '국가 중점 10개 완료', ok: s => (s.focus?.done || []).length >= 10 },
  { id: 'f22', icon: '🇰🇷', name: '조국과 민족을 위하여', desc: '최종 중점 완료', ok: s => (s.focus?.done || []).includes('d_final') });
