/* =========================================================
 *  국정 운영 편의
 *  1) 자동 국정 모드: 위기 AI 참모 + 내정 총리 + 점령지 총독부 + 총독 자동 임명을 한 번에
 *  2) 지역 총독: 점령지를 지역(동남아·중앙아…)별로 묶어 총독 한 명에게. 능력·청렴·성향·충성도가 있음
 *  3) 분기 결재판: 카드가 줄줄이 뜨는 대신, 자동 처리 결과와 '결재 필요' 목록을 한 장으로
 * ========================================================= */

/* ---------------- 2) 지역 총독 ---------------- */
const GOV_TRAITS = {
  honest: { name: '청렴', icon: '🤍', desc: '횡령하지 않습니다.' },
  corrupt: { name: '부패', icon: '💸', desc: '수입의 15%를 빼돌립니다.', hidden: true },
  harsh: { name: '강경', icon: '✊', desc: '수입 +10%, 저항 +0.6/분기.' },
  mild: { name: '온건', icon: '🕊️', desc: '저항 -0.6/분기, 수입 -5%.' },
  builder: { name: '개발형', icon: '🏗️', desc: '개발 +0.6/분기.' },
  scholar: { name: '학자형', icon: '📚', desc: '통합 +0.6/분기.' },
  general: { name: '군 출신', icon: '🎖️', desc: '국방력 +20%, 저항 -0.3, 통합 -0.3.' },
  loyal: { name: '충직', icon: '🫡', desc: '충성도가 잘 오릅니다.' },
  ambitious: { name: '야심가', icon: '👑', desc: '능력 +1, 충성도가 떨어집니다. 독자 노선 위험.' },
};
const regionOf = k => cinfo(k)?.sub || cinfo(k)?.reg || '기타';
function govRegions(s) {
  const r = {}; for (const k of Object.keys(s.terr || {})) (r[regionOf(k)] = r[regionOf(k)] || []).push(k); return r;
}
function genGovernor() {
  const pool = Object.keys(GOV_TRAITS).filter(t => t !== 'corrupt' && t !== 'honest');
  const traits = [pool[Math.floor(Math.random() * pool.length)]];
  if (Math.random() < 0.45) { const t2 = pool[Math.floor(Math.random() * pool.length)]; if (!traits.includes(t2) && !(t2 === 'harsh' && traits[0] === 'mild') && !(t2 === 'mild' && traits[0] === 'harsh')) traits.push(t2); }
  traits.push(Math.random() < 0.3 ? 'corrupt' : 'honest');
  let skill = 1 + Math.floor(Math.random() * 4) + (Math.random() < 0.35 ? 1 : 0);
  if (traits.includes('ambitious')) skill = Math.min(5, skill + 1);
  return { name: typeof randName === 'function' ? randName() : '총독', skill: Math.min(5, skill), traits, loyalty: 50 + Math.floor(Math.random() * 35), vetted: false, since: null, exposed: false };
}
// 총독이 점령지 산출·변화에 주는 보정 (territory.js의 terrMods가 더함)
function govMods(s, k) {
  const g = s?.govs?.[regionOf(k)]; if (!g) return null;
  const has = t => g.traits.includes(t), m = { cap: 0.06 * (g.skill - 3), resist: -0.25 * (g.skill - 3), dev: 0, integ: 0, mil: 0 };
  if (has('corrupt')) m.cap -= 0.15;
  if (has('harsh')) { m.cap += 0.1; m.resist += 0.6; }
  if (has('mild')) { m.cap -= 0.05; m.resist -= 0.6; }
  if (has('builder')) m.dev += 0.6;
  if (has('scholar')) m.integ += 0.6;
  if (has('general')) { m.mil += 0.2; m.resist -= 0.3; m.integ -= 0.3; }
  return m;
}
function govCandidates(s, region) {
  s.govCand = s.govCand || {};
  if (!s.govCand[region] || s.govCand[region].turn !== s.turn) s.govCand[region] = { turn: s.turn, list: [genGovernor(), genGovernor(), genGovernor()] };
  return s.govCand[region].list;
}
function vetCandidate(s, region, i) {
  const c = s.govCand?.[region]?.list?.[i]; if (!c) return { ok: false };
  if (s.pcap < 5) return { ok: false, msg: `국고 ${won(5)}이(가) 필요합니다.` };
  s.pcap -= 5; c.vetted = true;
  return { ok: true, msg: c.traits.includes('corrupt') ? `🔍 인사 검증 결과: ${c.name} 후보에게 비리 전력이 있습니다!` : `🔍 인사 검증 결과: ${c.name} 후보는 깨끗합니다.` };
}
function appointGovernor(s, region, i) {
  const c = s.govCand?.[region]?.list?.[i]; if (!c) return { ok: false, msg: '후보가 없습니다.' };
  if (s.pcap < 10) return { ok: false, msg: `국고 ${won(10)}이(가) 필요합니다.` };
  s.pcap -= 10; s.govs = s.govs || {}; s.govs[region] = { ...c, since: s.turn, exposed: c.vetted && c.traits.includes('corrupt') };
  s.govCand[region].list.splice(i, 1);
  addLog(s, 'info', `🧑‍✈️ ${region} 총독에 ${c.name}(능력 ${'★'.repeat(c.skill)}) 임명`);
  return { ok: true, msg: `🧑‍✈️ ${c.name}을(를) ${region} 총독에 임명했습니다.` };
}
function dismissGovernor(s, region) {
  const g = s.govs?.[region]; if (!g) return { ok: false };
  delete s.govs[region];
  for (const k of govRegions(s)[region] || []) if (s.terr[k]) s.terr[k].resist = clamp(s.terr[k].resist + 2, 0, 100);
  return { ok: true, msg: `${region} 총독 ${g.name}을(를) 경질했습니다.` };
}
// 자동 국정 모드에서 빈 지역에 가장 나은 후보를 임명
function autoAppoint(s) {
  for (const region of Object.keys(govRegions(s))) {
    if (s.govs?.[region]) continue;
    const list = govCandidates(s, region);
    const score = c => c.skill + (c.traits.includes('loyal') ? 1 : 0) - (c.traits.includes('ambitious') ? 0.5 : 0);
    const best = list.map((c, i) => [score(c), i]).sort((a, b) => b[0] - a[0])[0];
    if (best && s.pcap >= 60) appointGovernor(s, region, best[1]);
  }
}
function governorTurn(s, report) {
  const regs = govRegions(s); report.gov = [];
  for (const region of Object.keys(s.govs || {})) {
    const g = s.govs[region], ks = regs[region] || [];
    if (!ks.length) { delete s.govs[region]; continue; }
    s.pcap -= 2; // 총독부 운영비
    const avgRes = ks.reduce((a, k) => a + s.terr[k].resist, 0) / ks.length;
    g.loyalty = clamp(g.loyalty + 0.6 + (g.traits.includes('loyal') ? 1 : 0) - (g.traits.includes('ambitious') ? 1.6 : 0) - (avgRes > 70 ? 0.6 : 0) + gauss() * 0.8, 0, 100);
    if (g.traits.includes('corrupt') && !g.exposed && Math.random() < 0.1) { g.exposed = true; (s.govAlerts = s.govAlerts || []).push({ type: 'corrupt', region }); }
    if (g.traits.includes('ambitious') && g.loyalty < 25 && !g.warned && Math.random() < 0.3) { g.warned = true; (s.govAlerts = s.govAlerts || []).push({ type: 'defy', region }); }
  }
  if (s.autoMode) autoAppoint(s);
}
if (typeof DOM_EVENTS !== 'undefined') Object.assign(DOM_EVENTS, {
  govCorrupt: { w: 40, kind: 'politics', icon: '💸', cond: s => (s.govAlerts || []).some(a => a.type === 'corrupt' && s.govs?.[a.region]),
    make: s => { const i = s.govAlerts.findIndex(a => a.type === 'corrupt'); const a = s.govAlerts.splice(i, 1)[0]; const g = s.govs[a.region];
      return { title: `감찰 보고: ${a.region} 총독 ${g.name} 횡령`, desc: `감사원이 ${a.region} 총독부의 이권 수입 일부가 ${g.name} 총독 일가의 해외 계좌로 흘러간 정황을 찾아냈습니다. 현지 언론도 냄새를 맡았습니다.`, region: a.region }; },
    choices: [
      { label: '경질·처벌하고 환수', desc: '국고 +₩2조 환수, 지지율 +1. 새 총독을 임명해야 합니다.', run: (s, ev) => { dismissGovernor(s, ev.region); s.pcap += 20; s.approval += 1; return '총독을 해임하고 빼돌린 돈을 환수했습니다.'; } },
      { label: '조용히 경고만', desc: '충성도 +15, 계속 빼돌림. 측근 비리 위험 +5.', run: (s, ev) => { const g = s.govs[ev.region]; if (g) g.loyalty = clamp(g.loyalty + 15, 0, 100); if (s.dom) s.dom.scandal += 5; return '경고만 하고 덮었습니다.'; } },
    ] },
  govDefy: { w: 40, kind: 'security', extreme: true, icon: '👑', cond: s => (s.govAlerts || []).some(a => a.type === 'defy' && s.govs?.[a.region]),
    make: s => { const i = s.govAlerts.findIndex(a => a.type === 'defy'); const a = s.govAlerts.splice(i, 1)[0]; const g = s.govs[a.region];
      return { title: `${a.region} 총독 ${g.name}, 독자 노선`, desc: `야심가 ${g.name} 총독이 본국 지시를 무시하고 현지 군벌·엘리트와 손잡기 시작했습니다. 충성도 ${g.loyalty.toFixed(0)}. 방치하면 지역이 통째로 떨어져 나갈 수 있습니다.`, region: a.region }; },
    choices: [
      { label: '즉시 소환', desc: '총독 해임, 해당 지역 저항 +8.', run: (s, ev) => { dismissGovernor(s, ev.region); for (const k of govRegions(s)[ev.region] || []) s.terr[k].resist = clamp(s.terr[k].resist + 6, 0, 100); return '총독을 본국으로 소환했습니다. 현지가 술렁입니다.'; } },
      { label: '회유', desc: '국고 ₩3조, 충성도 +35.', pc: 30, run: (s, ev) => { const g = s.govs[ev.region]; if (g) { g.loyalty = clamp(g.loyalty + 35, 0, 100); g.warned = false; } return '훈장과 특별 예산으로 총독을 달랬습니다.'; } },
      { label: '방치', desc: '50% 확률로 지역 점령지 하나가 이탈합니다.', run: (s, ev) => { if (Math.random() < 0.5) { const k = (govRegions(s)[ev.region] || [])[0]; if (k) { releaseTerritory(s, k, true); delete s.govs[ev.region]; return `${cname(k)}이(가) 총독과 함께 떨어져 나갔습니다!`; } } return '다행히 총독이 선을 넘지는 않았습니다.'; } },
    ] },
});

/* ---------------- 1) 자동 국정 모드 ---------------- */
function setAutoMode(s, on) {
  s.autoMode = on;
  if (on) { s.autoAI = true; s.pmAuto = true; s.briefMode = true; for (const t of Object.values(s.terr || {})) t.auto = true; if (typeof govSettings === 'function') govSettings(s).autoNew = true; autoAppoint(s); }
  return { ok: true, msg: on ? '⚙️ 자동 국정 모드 ON — 위기·내정·점령지·총독 인사는 참모들이 맡고, 전쟁·외교·국가 비상만 대통령이 결재합니다.' : '⚙️ 자동 국정 모드 OFF — 개별 위임 설정은 그대로 유지됩니다.' };
}

/* ---------------- 3) 분기 결재판 ---------------- */
function briefItems() {
  const items = [];
  for (const ev of (S.dom?.pending || [])) { const d = DOM_EVENTS[ev.key]; if (d) items.push({ icon: d.icon, title: ev.title, tag: d.extreme ? '🚨 국가 비상' : (typeof EVENT_KINDS !== 'undefined' && EVENT_KINDS[d.kind]?.name) || '국내 정치', red: !!d.extreme, open: () => openDomEventCard(ev.id) }); }
  for (const p of (S.world?.proposals || [])) items.push({ icon: '📨', title: `${cname(p.k)}의 조약 제안`, tag: '외교', open: () => openProposalCard(p.id) });
  if (!S.autoAI) for (const c of S.crises || []) items.push({ icon: '🚨', title: c.title, tag: '위기 대응', red: c.sev >= 3, open: () => openEventCard(c.id) });
  return items;
}
let briefCtx = null;
function openBriefing(report, recs) {
  if (report) briefCtx = { report, recs };
  const R = briefCtx?.report || {}, rc = briefCtx?.recs || [];
  const auto = [
    ...(R.pmDone || []).map(x => `🧑‍💼 총리: ${x}`),
    ...rc.map(r => `🤖 위기 참모: ${r.title} → ${r.sol} (${r.success ? '성공' : '실패'})`),
    ...(R.terr || []).map(x => x), ...(R.heg || []), ...(R.geo || []).map(x => `🌐 ${x}`),
    ...(R.techDone || []).map(x => `🔬 개발 완료: ${x}`), ...(R.built || []).map(x => `🏭 완공: ${x}`),
    ...(R.autoRepaid ? [`🏦 자동 상환: 국가채무비율 -${R.autoRepaid}%p`] : []),
  ];
  const items = briefItems();
  const t = turnLabel(S.turn - 1);
  openModal(`<div class="brief">
    <div class="ev-banner ev-politics"><span class="ev-art">📋</span><span class="ev-kind">분기 결재판</span><span class="ev-date">${t.year}년 ${t.q}분기 결산</span></div>
    <h2>대통령님, 결재하실 일이 ${items.length ? `${items.length}건` : '없습니다'}</h2>
    ${auto.length ? `<details class="brief-auto" ${auto.length <= 4 ? 'open' : ''}><summary>🤖 참모들이 자동 처리한 일 ${auto.length}건</summary><ul>${auto.slice(0, 30).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '<p class="muted small">이번 분기 자동 처리한 일은 없습니다.</p>'}
    ${items.length ? `<div class="wlabel">✍️ 결재 필요</div><div class="brief-items">${items.map((it, i) => `<div class="bi ${it.red ? 'red' : ''}"><span class="ic">${it.icon}</span><div><b>${esc(it.title)}</b><small>${esc(it.tag)}</small></div><button class="btn sm primary" data-bi="${i}">결재</button></div>`).join('')}</div>` : ''}
    <div class="modal-actions">
      ${items.some(it => !it.red) ? '<button class="btn" id="brief-delegate">🧑‍💼 일반 안건은 참모에게 맡기기</button>' : ''}
      <button class="btn ${items.length ? '' : 'primary'}" id="brief-later">${items.length ? '나중에 (알림에 남김)' : '확인'}</button>
    </div></div>`);
  document.querySelectorAll('[data-bi]').forEach(b => b.onclick = () => {
    const it = items[+b.dataset.bi]; closeModal();
    eventQueue.unshift(() => { if (briefItems().length) openBriefing(); });
    setTimeout(() => it.open(), 50);
  });
  $('brief-later').onclick = () => { closeModal(); };
  const del = $('brief-delegate'); if (del) del.onclick = () => {
    let n = 0;
    for (const ev of [...(S.dom?.pending || [])]) { const d = DOM_EVENTS[ev.key]; if (!d || d.extreme) continue; const i = typeof pmPick === 'function' ? pmPick(S, ev) : d.choices.findIndex(c => !c.pc); if (i >= 0 && resolveDomEvent(S, ev.id, i)?.ok) n++; }
    if (!S.autoAI) for (const c of [...(S.crises || [])]) { if (c.sev >= 3) continue; const e = aiEvaluate(S, c); resolveCrisis(S, c.id, e[0].i, 'ai', ''); n++; }
    saveGame(S); renderAll(); closeModal(); toast(`🧑‍💼 참모들이 일반 안건 ${n}건을 처리했습니다.`, 3500);
    if (briefItems().length) setTimeout(() => openBriefing(), 300);
  };
}
// 분기 결산 흐름 교체: 큰 사건(대선·IMF·핵·강화·단계 승격·선거)은 카드 그대로, 나머지는 결재판 한 장
if (typeof afterQuarter === 'function') (function () {
  const f = afterQuarter;
  afterQuarter = function (report, recs, newCrises) {
    if (S.briefMode === false) return f(report, recs, newCrises);
    closeModal();
    const hd = $('hdr-date'); hd.classList.remove('flip'); void hd.offsetWidth; hd.classList.add('flip');
    $('day-prog').style.width = '0%'; refreshTicker();
    if (report.gameOver) { setSpeed(0); return showEnding(); }
    const big = [];
    if (report.presElection) big.push(() => openPresidentialCard());
    if (report.imf) big.push(() => openImfCard());
    if (S.nukePending) big.push(() => openNukeCard());
    if (S.peacePending) big.push(() => openPeaceCard());
    if (report.eraUp) big.push(() => openEraCard(report.eraUp));
    if (report.elections?.length) big.push(() => openElectionCard(report));
    const hasWork = briefItems().length || (report.pmDone || []).length || recs.length || (report.terr || []).length || (report.heg || []).length || (report.geo || []).length;
    if (hasWork) big.push(() => { setSpeed(0); openBriefing(report, recs); });
    eventQueue.push(...big);
    showQuarterCard(report, recs);
    nextEvent();
  };
})();

/* ---------------- 화면: 지역 총독부 패널 ---------------- */
function govPanel2HTML() {
  const regs = govRegions(S); const names = Object.keys(regs); if (!names.length) return '';
  return `<div class="gov-box"><div class="gov-h"><b>🧑‍✈️ 지역 총독</b><span class="muted small">같은 지역 점령지를 총독 한 명이 맡습니다. 능력(★)이 높을수록 수입·안정이 좋고, 성향에 따라 저항·개발·통합이 달라집니다. 부패는 인사 검증이나 감찰로만 드러납니다. 총독부 운영비 ${won(2)}/분기.</span></div>
    ${names.map(r => { const g = S.govs?.[r], ks = regs[r];
      const tr = g ? g.traits.filter(t => !GOV_TRAITS[t].hidden || g.exposed).map(t => `<span class="tag" title="${esc(GOV_TRAITS[t].desc)}">${GOV_TRAITS[t].icon} ${GOV_TRAITS[t].name}</span>`).join('') : '';
      return `<div class="greg"><div class="greg-h"><b>${esc(r)}</b> <span>${ks.map(cflag).join('')}</span>
        ${g ? `<span class="muted small">총독 <b>${esc(g.name)}</b> ${'★'.repeat(g.skill)}${'☆'.repeat(5 - g.skill)}</span>` : '<span class="tag const">공석</span>'}</div>
        ${g ? `<div class="greg-b">${tr}${g.traits.includes('corrupt') && !g.exposed ? '' : ''}<span class="muted small">청렴도 ${g.exposed ? (g.traits.includes('corrupt') ? '❌ 부패' : '✅') : g.vetted ? '✅ 검증됨' : '❔ 미확인'}</span></div>
          <div class="wrow"><span>충성도</span>${meter(g.loyalty, 'mp', 25)}<em>${g.loyalty.toFixed(0)}</em></div>
          <div class="row-btns"><select data-rdir="${esc(r)}">${Object.entries(GOV_DIRECTIVES).map(([id, x]) => `<option value="${id}" ${ks.every(k => (S.terr[k].dir || 'balance') === id) ? 'selected' : ''}>${x.icon} 지역 방침: ${x.name}</option>`).join('')}</select><button class="btn sm ghost" data-gfire="${esc(r)}">경질</button></div>`
        : `<div class="row-btns"><button class="btn sm primary" data-gpick="${esc(r)}">총독 임명 (후보 3명)</button></div>`}
      </div>`; }).join('')}</div>`;
}
function openGovPick(region) {
  const list = govCandidates(S, region);
  openModal(`<h2>🧑‍✈️ ${esc(region)} 총독 후보</h2><p class="lead">임명비 ${won(10)}. 인사 검증(${won(5)})을 하면 숨은 비리를 알 수 있습니다. 후보는 분기마다 바뀝니다.</p>
    <div class="gcands">${list.map((c, i) => `<div class="gcand"><b>${esc(c.name)}</b><div>${'★'.repeat(c.skill)}${'☆'.repeat(5 - c.skill)} <span class="muted small">충성 ${c.loyalty}</span></div>
      <div>${c.traits.filter(t => !GOV_TRAITS[t].hidden && t !== 'honest').map(t => `<span class="tag" title="${esc(GOV_TRAITS[t].desc)}">${GOV_TRAITS[t].icon} ${GOV_TRAITS[t].name}</span>`).join('')}</div>
      <div class="muted small">${c.traits.filter(t => !GOV_TRAITS[t].hidden && t !== 'honest').map(t => GOV_TRAITS[t].desc).join(' ')}</div>
      <div class="small">청렴도: ${c.vetted ? (c.traits.includes('corrupt') ? '❌ 비리 전력 있음' : '✅ 깨끗함') : '❔ 미확인'}</div>
      <div class="row-btns">${c.vetted ? '' : `<button class="btn sm ghost" data-vet="${i}">🔍 인사 검증 ${won(5)}</button>`}<button class="btn sm primary" data-appoint="${i}">임명</button></div></div>`).join('')}</div>`);
  document.querySelectorAll('[data-vet]').forEach(b => b.onclick = () => { const r = vetCandidate(S, region, +b.dataset.vet); toast(esc(r.msg || '')); saveGame(S); openGovPick(region); });
  document.querySelectorAll('[data-appoint]').forEach(b => b.onclick = () => { const r = appointGovernor(S, region, +b.dataset.appoint); toast(esc(r.msg || '')); if (r.ok) { saveGame(S); closeModal(); renderAll(); } });
}
if (typeof terrHTML === 'function') (function () {
  const f = terrHTML;
  terrHTML = function () { const h = f(); const g = govPanel2HTML(); return g ? h.replace('<div class="terr-table">', g + '<div class="terr-table">') : h; };
  const r = renderDefense;
  renderDefense = function () {
    r(); const el = $('tab-defense'); if (!el) return;
    el.querySelectorAll('[data-gpick]').forEach(b => b.onclick = () => openGovPick(b.dataset.gpick));
    el.querySelectorAll('[data-gfire]').forEach(b => b.onclick = () => { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = '한 번 더 누르면 경질'; return; } act(dismissGovernor)(S, b.dataset.gfire); });
    el.querySelectorAll('[data-rdir]').forEach(x => x.onchange = () => { for (const k of govRegions(S)[x.dataset.rdir] || []) { S.terr[k].dir = x.value; S.terr[k].auto = true; } saveGame(S); renderDefense(); toast(`${x.dataset.rdir} 지역 방침: ${GOV_DIRECTIVES[x.value].name}`); });
  };
})();

HOOKS.postTurn.unshift(governorTurn);
HOOKS.migrate.push(s => { if (s.briefMode == null) s.briefMode = true; });
