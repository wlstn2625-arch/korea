/* =========================================================
 *  미사일 타격 화면·연출, 군단 이동 애니메이션·사단 수, 사단 재편 버튼
 * ========================================================= */
let strikeMode = false;
const armyShown = {}; // 군단 표식이 화면에서 미끄러지듯 움직이도록 직전 위치 기억
function armyPos(T, a, by) {
  let x = by[a.loc]?.c[0], y = by[a.loc]?.c[1];
  if (a.order === 'move' && a.path?.length) { // 다음 지역 쪽으로 이동한 만큼
    const nx = by[String(a.path[0]).replace('sea:', '')]; const sea = String(a.path[0]).startsWith('sea:');
    const steps = sea ? 12 : (a.gen.traits.includes('armor') ? 3 : 5), f = clamp((a.moveT || 0) / steps, 0, 1);
    if (nx) { x += (nx.c[0] - x) * f; y += (nx.c[1] - y) * f; }
  }
  const prev = armyShown[a.id]; const cur = prev ? [prev[0] + (x - prev[0]) * 0.45, prev[1] + (y - prev[1]) * 0.45] : [x, y];
  armyShown[a.id] = cur; return cur;
}
// 군단 표식을 부드러운 위치·사단 수로 다시 그림 (ui_armies의 표식을 대체)
const _warOverlayS = warOverlay;
warOverlay = function (s) {
  let h = _warOverlayS(s);
  const T = s.war.theater, by = Object.fromEntries(T.provs.map(p => [p.id, p]));
  // 맞은 지역 표시
  for (const [pid, x] of Object.entries(T.strikes || {})) if (T.days <= x.until && by[pid]) h += unitG(by[pid].c[0] + 1.2, by[pid].c[1] + 1, 'crater', `<circle r="7"></circle><text y="4">${x.icon}</text><text class="cd" y="17">${x.until - T.days}일</text>`);
  if (!T.armies) return h;
  // ui_armies가 그린 군단 표식을 이동 보간 위치로 교체
  h = h.replace(/<g transform="translate\([^)]*\)"><g class="army [^"]*">[\s\S]*?<\/g><\/g><\/g>/g, '');
  let marks = '';
  T.armies.forEach((a, i) => {
    if (a.str <= 0) return;
    const off = T.armies.filter((b, j) => j < i && b.loc === a.loc && b.str > 0 && b.order !== 'move').length;
    const [x0, y0] = armyPos(T, a, by), x = x0 + off * 1.4, y = y0 - off * 1.1;
    const num = a.name.match(/\d/)?.[0] || '★', dv = typeof armyDivs === 'function' ? armyDivs(s, a) : '';
    marks += unitG(x, y, `army ${selArmy === a.id ? 'sel' : ''} ${a.order}`, `<g class="army-hit" data-army="${a.id}"><rect x="-15" y="-11" width="30" height="22" rx="3"></rect><path d="M-15 -11 L15 11 M-15 11 L15 -11"></path><text class="an" y="4">${num}</text>
      <rect class="sb" x="-15" y="13" width="30" height="3.5"></rect><rect class="sf" x="-15" y="13" width="${(30 * a.str / 100).toFixed(1)}" height="3.5"></rect>
      <text class="ag" y="-15">${esc(a.gen.name)} ${'★'.repeat(Math.min(5, a.gen.skill))}${a.auto ? ' 🤖' : ''}</text><text class="dv" y="27">${dv}개 사단</text></g>`);
  });
  return h + marks;
};

// 미사일 타격 모드: 지도에서 적 지역을 누르면 목표 선택 창
document.addEventListener('click', e => {
  if (!strikeMode || !S?.war?.theater) return;
  const el = e.target.closest?.('#geo .prov, #geo .vreg-hit'); if (!el) return;
  e.stopImmediatePropagation();
  const pid = el.dataset.p || el.dataset.vp, T = S.war.theater, p = T.provs.find(x => x.id === pid);
  if (!p || p.owner === 'kr') return toast('적이 장악한 지역을 누르세요.');
  openStrikeMenu(pid);
}, true);
function openStrikeMenu(pid) {
  const T = S.war.theater, p = T.provs.find(x => x.id === pid), opts = strikeOptions(S, pid);
  setSpeed(0);
  openModal(`<div class="event">
    <div class="ev-banner ev-security"><span class="ev-art">🚀</span><span class="ev-kind">미사일 정밀 타격</span><span class="ev-date">남은 미사일 ${missileStock(S)}/${T.missileCap}발</span></div>
    <h2>${esc(p.n)} — 무엇을 칠까요?</h2>
    <p class="ev-desc">발사 비용 ${won(8)}. 적 방공에 요격될 수 있습니다(미사일 기술·적 공군 피해가 클수록 잘 뚫림). 맞은 지역은 한동안 방어가 약해져 군단이 공략하기 쉬워집니다.</p>
    <div class="ev-opts">${opts.map(o => `<button class="ev-opt" data-st="${o.id}" ${missileStock(S) < 1 || S.pcap < 8 ? 'disabled' : ''}><b>${o.icon} ${o.name}</b><span>${esc(o.desc)}</span></button>`).join('')}</div>
    <div class="modal-actions"><button class="btn ghost" id="st-cancel">취소</button></div></div>`);
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const r = missileStrike(S, pid, b.dataset.st); closeModal(); toast(esc(r.msg || '')); saveGame(S); consumeWarFx(); updateMap(); if (openPanelName === 'world') renderWarPanel(); if (missileStock(S) < 1) strikeMode = false; });
  $('st-cancel').onclick = () => closeModal();
}

// 연출: 우리 미사일(명중/요격), 적 미사일(요격 장면 포함)
const _consumeWarFx = consumeWarFx;
consumeWarFx = function () {
  const T = S?.war?.theater; if (!T?.fx?.length) return;
  const mine = T.fx.filter(e => e.type === 'strike' || e.type === 'enemyStrike'); T.fx = T.fx.filter(e => !mine.includes(e));
  mine.slice(-3).forEach((ev, i) => setTimeout(() => {
    if (ev.type === 'strike') {
      const from = KOREA_LAUNCH();
      if (ev.ok) fxStrike(from, ev.c, 'missile');
      else { fxStrike(from, [from[0] + (ev.c[0] - from[0]) * 0.7, from[1] + (ev.c[1] - from[1]) * 0.7], 'missile'); }
    } else if (ev.type === 'enemyStrike' && ev.from && ev.c) {
      if (ev.intercepted) {
        const mid = [ev.from[0] + (ev.c[0] - ev.from[0]) * 0.65, ev.from[1] + (ev.c[1] - ev.from[1]) * 0.65];
        fxEnemyTrail(ev.from, mid); setTimeout(() => fxIntercept(ev.c, mid), 350);
      } else { fxEnemyTrail(ev.from, ev.c); setTimeout(() => { fxBurst(ev.c, true); const st = document.querySelector('.stage'); st?.classList.remove('shake'); void st?.offsetWidth; st?.classList.add('shake'); }, 1050); }
    }
  }, i * 400));
  _consumeWarFx();
};
function fxEnemyTrail(from, to) {
  const mx = (from[0] + to[0]) / 2, my = Math.min(from[1], to[1]) - Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.35, d = `M${from[0]} ${from[1]} Q${mx} ${my} ${to[0]} ${to[1]}`;
  fxAdd(`<path d="${d}" class="fx-trail enemy"></path><g class="fx-obj"><text class="fx-ic">☄️<animateMotion dur="1.1s" fill="freeze" rotate="auto" path="${d}"></animateMotion></text></g>`, 1300);
}
function fxIntercept(from, at) {
  const d = `M${from[0]} ${from[1]} L${at[0]} ${at[1]}`;
  fxAdd(`<path d="${d}" class="fx-trail intercept"></path><g class="fx-obj"><text class="fx-ic">🛡️<animateMotion dur="0.7s" fill="freeze" path="${d}"></animateMotion></text></g>`, 900);
  setTimeout(() => { fxBurst(at, true); fxAdd(at && `<g transform="translate(${at[0]} ${at[1]})"><g class="fxb big"><text class="b-txt intercept-t" y="-14">요격!</text></g></g>`, 1200); }, 700);
}

// 전쟁 패널: 미사일 칸 + 군단 카드에 사단 수·분할·합치기
const _renderWarPanelS = renderWarPanel;
renderWarPanel = function (force) {
  _renderWarPanelS(force);
  const T = S?.war?.theater, box = document.querySelector('#war-slot .warbox.hoi'); if (!T || !box) return;
  const ms = document.createElement('div'); ms.className = 'missile-sec';
  ms.innerHTML = `<div class="wlabel">🚀 미사일 정밀 타격 <span class="muted">적 내륙 어디든 · 10일마다 1발 보충</span></div>
    <div class="ms-row"><span class="ms-ammo">${Array.from({ length: T.missileCap || 6 }, (_, i) => `<i class="${i < missileStock(S) ? 'on' : ''}"></i>`).join('')}</span><b>${missileStock(S)}/${T.missileCap}발</b>
      <button class="btn sm ${strikeMode ? 'primary' : ''}" id="ms-mode">${strikeMode ? '🎯 목표 지정 중… (지도에서 적 지역 누르기)' : '🎯 목표 지정'}</button></div>`;
  const army = box.querySelector('.army-sec'); box.insertBefore(ms, army || box.querySelector('.wlabel'));
  $('ms-mode').onclick = () => { strikeMode = !strikeMode; selArmy = null; renderWarPanel(); toast(strikeMode ? '🚀 지도에서 칠 적 지역을 누르세요. 내륙 깊숙한 곳도 됩니다.' : '타격 모드를 껐습니다.'); if (strikeMode) zoomTo(S.war.k); };
  // 군단 카드 보강
  box.querySelectorAll('.acard').forEach(card => {
    const id = card.querySelector('[data-asel]')?.dataset.asel, a = T.armies?.find(x => x.id === id); if (!a) return;
    const h = card.querySelector('.ah span'); if (h) h.textContent = `${armyDivs(S, a)}개 사단 · 전과 ${a.kills}`;
    const row = card.querySelector('.row-btns'); if (!row || a.str <= 0) return;
    row.insertAdjacentHTML('beforeend', `<button class="btn sm ghost" data-asplit="${a.id}" title="사단 40%를 떼어 새 군단 편성">✂️ 분할</button><button class="btn sm ghost" data-amerge="${a.id}" title="같은 지역의 다른 군단에 합치기">🔗 합치기</button>`);
  });
  box.querySelectorAll('[data-asplit]').forEach(b => b.onclick = () => act(splitArmy)(S, b.dataset.asplit));
  box.querySelectorAll('[data-amerge]').forEach(b => b.onclick = () => act(mergeArmy)(S, b.dataset.amerge));
};
// 군단을 고르면 타격 모드는 끔
document.addEventListener('click', e => { if (e.target.closest?.('#geo .army-hit, [data-asel]')) strikeMode = false; }, true);
