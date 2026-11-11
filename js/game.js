/* =========================================================
 *  게임 진행: 실시간 시계·속도 조절, 사건 카드, 분기 결산 카드, 속보 자막, 내각 장관
 * ========================================================= */

/* ---------------- 시계 ---------------- */
let gameSpeed = 0;                       // 0 일시정지, 1 보통, 2 빠름, 3 매우 빠름
const DAY_RATE = { 1: 0.9, 2: 2.2, 3: 5 }; // 0.1초마다 흐르는 날 수 (보통: 한 분기 약 10초)
const QUARTER_DAYS = 90;

function gameDateText() {
  const t = turnLabel(S.turn);
  const d = Math.floor(S.day || 0);
  return `${t.year}년 ${(t.q - 1) * 3 + 1 + Math.floor(d / 30)}월 ${(d % 30) + 1}일`;
}
function setSpeed(v) {
  gameSpeed = v;
  $('speed').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.speed === v));
  $('speed').classList.toggle('paused', v === 0);
}
$('speed').querySelectorAll('button').forEach(b => b.onclick = () => setSpeed(+b.dataset.speed));
document.addEventListener('keydown', e => {
  if (!S || $('game').classList.contains('hidden') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); setSpeed(gameSpeed ? 0 : 1); }
  else if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) setSpeed(+e.code.slice(-1));
  else if (e.key === 'Escape' && openPanelName) closePanel();
});
setInterval(() => {
  if (!S || S.over || busy || !gameSpeed || $('game').classList.contains('hidden')) return;
  if (S.pendingSuccession) { setSpeed(0); return openPresidentialCard(); }
  if (!$('modal').classList.contains('hidden')) return;      // 사건 카드·대화 중에는 시간이 멈춤
  const before = Math.floor(S.day || 0);
  S.day = (S.day || 0) + DAY_RATE[gameSpeed];
  if (typeof focusTick === 'function') focusTick(S, DAY_RATE[gameSpeed]);
  // 전쟁 중이면 하루하루 전투가 실시간으로 진행
  if (S.war?.theater) {
    const days = Math.min(Math.floor(S.day), QUARTER_DAYS) - before;
    if (days > 0) { runWarDays(S, days); warTick(); }
  }
  if (S.nukePending) { setSpeed(0); return openNukeCard(); }
  if (S.day >= QUARTER_DAYS) { S.day = 0; endQuarter(); return; }
  $('hdr-date').textContent = gameDateText();
  $('day-prog').style.width = `${(S.day / QUARTER_DAYS) * 100}%`;
}, 100);

/* ---------------- 분기 결산 후 ---------------- */
let eventQueue = [];
function afterQuarter(report, recs, newCrises) {
  closeModal();
  const hd = $('hdr-date'); hd.classList.remove('flip'); void hd.offsetWidth; hd.classList.add('flip');
  $('day-prog').style.width = '0%';
  refreshTicker();
  if (report.gameOver) { setSpeed(0); return showEnding(); }
  const blocking = [];
  if (report.presElection) blocking.push(() => openPresidentialCard());
  if (report.imf) blocking.push(() => openImfCard());
  if (S.nukePending) blocking.push(() => openNukeCard());
  if (S.peacePending) blocking.push(() => openPeaceCard());
  if (report.eraUp) blocking.push(() => openEraCard(report.eraUp));
  if (report.pmDone?.length) blocking.push(() => { toast(`🧑‍💼 국무총리가 국내 현안 ${report.pmDone.length}건을 처리했습니다.`, 3500); nextEvent(); });
  if (report.elections?.length) blocking.push(() => openElectionCard(report));
  for (const id of (report.domEvents || [])) blocking.push(() => openDomEventCard(id));
  for (const p of (S.world?.proposals || []).filter(p => p.turn === report.turn)) blocking.push(() => openProposalCard(p.id));
  if (S.autoAI && recs.length) blocking.push(() => openAiReportCard(recs));
  if (!S.autoAI) for (const c of newCrises) blocking.push(() => openEventCard(c.id));
  eventQueue.push(...blocking);
  showQuarterCard(report, recs);
  nextEvent();
}
function nextEvent() {
  if (!$('modal').classList.contains('hidden')) return;
  const f = eventQueue.shift(); if (f) f();
}
// 모달이 닫히면 다음 사건으로
new MutationObserver(() => { if ($('modal').classList.contains('hidden') && eventQueue.length) setTimeout(nextEvent, 250); })
  .observe($('modal'), { attributes: true, attributeFilter: ['class'] });

function showQuarterCard(report, recs) {
  const t = report.label, ap = report.approvalDiff;
  const moves = Object.entries(report.diff).map(([k, d]) => {
    const good = k === 'infl' ? Math.abs(S.stats.infl - 2) < Math.abs(S.stats.infl - d - 2) : d * STATS[k].good > 0;
    const th = STATS[k].dec >= 3 ? 0.0015 : STATS[k].dec === 2 ? 0.005 : STATS[k].dec === 1 ? 0.1 : 0.6;
    return { k, d, good, mag: Math.abs(d * STATS[k].w) , show: Math.abs(d) >= th };
  }).filter(x => x.show).sort((a, b) => b.mag - a.mag).slice(0, 4);
  const passed = (report.bills || []).filter(b => b.result === 'passed').map(b => b.name);
  const headline = (report.worldNews || []).find(n => n.type === 'bad') || (report.worldNews || [])[0];
  const el = $('qcard');
  el.innerHTML = `<div class="qc-head"><b>📋 ${t.year}년 ${t.q}분기 결산</b><button class="btn ghost sm" id="qc-x">✕</button></div>
    <div class="qc-appr">지지율 <b class="${ap >= 0 ? 'good-t' : 'bad-t'}">${ap >= 0 ? '▲' : '▼'} ${Math.abs(ap).toFixed(1)}%p</b> → ${S.approval.toFixed(1)}%</div>
    <div class="qc-moves">${moves.map(m => `<span class="${m.good ? 'good-t' : 'bad-t'}">${STATS[m.k].name} ${fmtStat(m.k, m.d, true)}</span>`).join('') || '<span class="muted">큰 변화 없음</span>'}</div>
    ${passed.length ? `<div class="small">🏛️ 국회 통과: ${passed.map(esc).join(', ')}</div>` : ''}
    ${report.autoRepaid ? `<div class="small">🏦 자동 상환: 국가채무비율 -${report.autoRepaid}%p</div>` : ''}
    ${report.built?.length ? `<div class="small">🏭 완공: ${report.built.map(esc).join(', ')}</div>` : ''}
    ${recs.length ? `<div class="small">🚨 위기 ${recs.length}건 처리 (${recs.filter(r => r.success).length}건 성공)</div>` : ''}
    ${headline ? `<div class="small qc-news">🌐 ${esc(headline.text)}</div>` : ''}
    ${(() => { const um = typeof urgentMetric === 'function' ? urgentMetric(S) : null; return um ? `<div class="small qc-tip">💡 참모: ${esc(ADV_TIP[um])}</div>` : ''; })()}
    <div class="row-btns"><button class="btn sm" id="qc-more">보고서 보기</button>${typeof urgentMetric === 'function' && urgentMetric(S) ? '<button class="btn sm primary" id="qc-adv">💡 해결 방법 보기</button>' : ''}</div>`;
  el.classList.remove('hidden', 'leave'); el.classList.add('enter');
  clearTimeout(showQuarterCard._t);
  showQuarterCard._t = setTimeout(() => el.classList.add('hidden'), 9000);
  $('qc-x').onclick = () => el.classList.add('hidden');
  $('qc-more').onclick = () => { el.classList.add('hidden'); showTab('report'); };
  if ($('qc-adv')) $('qc-adv').onclick = () => { el.classList.add('hidden'); openAdvisor(urgentMetric(S)); };
}

/* ---------------- 사건 카드 ---------------- */
const EV_ART = { fiscal: '💸', protest: '📢', market: '📉', diplomacy: '🌐', legal: '⚖️', security: '🚨', social: '🔥', brain: '🧳', inflation: '🛒', housing: '🏚️' };
function openEventCard(cid) {
  const c = S.crises.find(x => x.id === cid); if (!c) return nextEvent();
  setSpeed(0);
  const evals = aiEvaluate(S, c), best = evals[0].i;
  const p = c.pid && policyById(c.pid, S);
  const t = turnLabel(S.turn);
  openModal(`<div class="event">
    <div class="ev-banner ev-${c.tpl} ${c.good ? 'ev-good' : ''}"><span class="ev-art">${EV_ART[c.tpl] || c.icon}</span><span class="ev-kind">${esc(c.kind)}${c.good ? ' · 기회' : ` · 심각도 ${'●'.repeat(c.sev)}`}</span><span class="ev-date">${t.year}년 ${t.q}분기</span></div>
    <h2>${esc(c.title)}</h2>
    <p class="ev-desc">${esc(c.desc)}${p ? `<br><span class="muted small">원인: ${esc(p.name)} — ${esc(optionOf(p, c.oid)?.label || '')}</span>` : ''}</p>
    <div class="ev-opts">${c.options.map((o, i) => { const ev = evals.find(x => x.i === i); const fx = expandSolution(S, c, o, true); return `
      <button class="ev-opt ${i === best ? 'best' : ''}" data-i="${i}">
        <span class="ev-lbl">${esc(o.label)} ${i === best ? '<span class="tag new">참모 추천</span>' : ''}</span>
        <span class="muted small">${esc(o.desc)}</span>
        <span class="ev-fx">${fxList(fx.e, fx.rel, fx.f)}</span>
        <span class="ev-meta">성공 ${(ev.ok * 100).toFixed(0)}% · ${won(o.pc || 0)}${o.rollback ? ` · 원인 정책 ${(o.rollback * 100).toFixed(0)}% 후퇴` : ''}</span>
      </button>`; }).join('')}</div>
    <div class="modal-actions"><button class="btn" id="ev-ai">🤖 ${ClaudeAI.enabled() ? 'Claude' : 'AI 참모'}에게 맡기기</button></div>
  </div>`, { closable: false });
  const done = rec => { saveGame(S); renderAll(); showEventResult(rec); };
  document.querySelectorAll('.ev-opt').forEach(b => b.onclick = () => done(resolveCrisis(S, c.id, +b.dataset.i, 'player')));
  $('ev-ai').onclick = async () => { $('ev-ai').disabled = true; $('ev-ai').innerHTML = '<span class="spinner"></span>판단 중…'; done(await aiResolve(c)); };
}
function showEventResult(rec) {
  if (!rec) return closeModal();
  openModal(`<div class="event">
    <div class="ev-stamp ${rec.success ? 'ok' : 'fail'}">${rec.success ? '성공' : '실패'}</div>
    <h2>${rec.icon} ${esc(rec.title)}</h2>
    <p class="lead">${esc(rec.by)}: <b>${esc(rec.sol)}</b></p>
    <p>${esc(rec.outcome)}</p>
    <div class="ev-fx">${fxList(rec.fx.e, rec.fx.rel, rec.fx.f)}</div>
    ${rec.reasoning ? `<div class="ai-box"><span class="who">🧠 판단 근거</span>${esc(rec.reasoning)}</div>` : ''}
    <div class="modal-actions"><button class="btn primary" onclick="closeModal()">계속</button></div>
  </div>`);
}
function openAiReportCard(recs) {
  openModal(`<div class="event">
    <div class="ev-banner ev-security"><span class="ev-art">🤖</span><span class="ev-kind">${ClaudeAI.enabled() ? 'Claude' : 'AI 참모'} 위기 대응 보고</span></div>
    <h2>이번 분기 위기 ${recs.length}건을 처리했습니다</h2>
    ${recs.map(resolvedCard).join('')}
    <div class="modal-actions"><button class="btn primary" onclick="closeModal()">확인</button></div></div>`);
}
function openElectionCard(report) {
  setSpeed(0);
  openModal(`<div class="event">
    <div class="ev-banner ev-diplomacy"><span class="ev-art">🗳️</span><span class="ev-kind">선거 결과</span></div>
    <h2>국민이 심판했습니다</h2>${report.elections.map(e => `<p class="lead">${esc(e)}</p>`).join('')}
    <div class="modal-actions"><button class="btn primary" onclick="closeModal()">확인</button></div></div>`);
}

/* ---------------- 속보 자막 ---------------- */
function refreshTicker() {
  if (!S) return;
  const items = [...(S.world?.news || []).slice(0, 10).map(n => ({ t: n.text, type: n.type })), ...S.log.slice(0, 6).map(l => ({ t: l.text, type: l.type }))];
  const inner = $('ticker-inner');
  inner.innerHTML = items.map(i => `<span class="tk ${i.type}">${esc(i.t)}</span>`).join('<span class="tk-sep">◆</span>') || '<span class="tk">대한민국 정부 출범. 국정 운영이 시작됩니다.</span>';
  inner.style.animationDuration = `${Math.max(30, inner.textContent.length * 0.22)}s`;
  inner.style.animationName = 'none'; void inner.offsetWidth; inner.style.animationName = '';
}

/* ---------------- 내각 장관 ---------------- */
const MINISTRY = { const: '대통령실 정무수석', tax: '기획재정부 장관', econ: '산업통상부 장관', labor: '고용노동부 장관', welfare: '보건복지부 장관', house: '국토교통부 장관', edu: '교육부 장관',
  defense: '국방부 장관', diplo: '외교부 장관', justice: '법무부 장관', civil: '법제처장', env: '환경에너지부 장관', health: '보건의료 차관', global: '국가안보실장(국제전략)' };
const KOR_SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송'];
const KOR_GIVEN = ['민준', '서연', '도윤', '지우', '현우', '수빈', '정훈', '은영', '성민', '혜진', '재석', '미경', '동현', '유나', '상철', '지혜'];
function ministerOf(cat) {
  S.cabinet = S.cabinet || {};
  if (!S.cabinet[cat]) { const r = hashRnd(`${cat}:${S.seed || 1}`); S.cabinet[cat] = { name: KOR_SUR[Math.floor(r() * KOR_SUR.length)] + KOR_GIVEN[Math.floor(r() * KOR_GIVEN.length)], hue: Math.floor(r() * 360) }; }
  return { ...S.cabinet[cat], title: MINISTRY[cat] };
}
let ministerPick = 0;
function ministerProposals(cat) {
  const out = [];
  for (const p of allPolicies().filter(x => x.cat === cat)) {
    if (S.enactedThisTurn.includes(p.id) || S.bills?.some(b => b.pid === p.id) || (typeof policyLocked === 'function' && policyLocked(S, p))) continue;
    const cur = currentOption(p, S);
    for (const o of p.options) {
      if (o.id === cur.id || o.cur) continue;
      const pv = previewPolicy(S, p, o);
      if (pv.cost > S.pcap) continue;
      out.push({ p, o, net: pv.net - pv.cost * 0.05, prob: pv.vote.prob });
    }
  }
  return out.filter(x => x.net > 1.5 && x.prob > 0.25).sort((a, b) => b.net - a.net);
}
function renderMinister() {
  const el = $('minister'); if (!el || !S) return;
  const cat = activeCat, m = ministerOf(cat), props = ministerProposals(cat);
  const pick = props.length ? props[ministerPick % props.length] : null;
  const line = pick ? `대통령님, <b>${esc(pick.p.name)}</b>을(를) <b>'${esc(pick.o.label)}'</b>(으)로 바꾸실 것을 건의드립니다. ${pick.o.pro ? esc(pick.o.pro) : ''}`
    : '현재로서는 무리한 변화보다 기존 정책을 안착시키는 편이 낫다고 판단합니다. 국고를 아껴 두십시오.';
  el.innerHTML = `<div class="minister">
    <div class="avatar" style="background:hsl(${m.hue} 40% 40%)">${esc(m.name[0])}</div>
    <div class="bubble"><div class="m-name">${esc(m.title)} <b>${esc(m.name)}</b></div><div>${line}</div>
      <div class="row-btns">${pick ? `<button class="btn sm primary" id="m-review">검토하기</button>` : ''}${props.length > 1 ? `<button class="btn sm ghost" id="m-next">다른 건의 (${(ministerPick % props.length) + 1}/${props.length})</button>` : ''}</div></div>
  </div>`;
  $('m-review') && ($('m-review').onclick = () => openPreview(pick.p.id, pick.o.id));
  $('m-next') && ($('m-next').onclick = () => { ministerPick++; renderMinister(); });
}

/* ---------------- HOI4식 알림 아이콘 ---------------- */
let alertSeen = new Set();
function renderAlerts() {
  const el = $('alerts'); if (!el || !S) return;
  const list = [];
  if (S.crises.length) list.push({ k: 'crisis', icon: '🚨', n: S.crises.length, red: true, tip: `대응하지 않은 위기 ${S.crises.length}건`, go: () => S.crises[0] && openEventCard(S.crises[0].id) });
  if (S.dom?.pending.length) list.push({ k: 'dom', icon: '📌', n: S.dom.pending.length, red: true, tip: '결정을 기다리는 정치 현안', go: () => openDomEventCard(S.dom.pending[0].id) });
  if (S.world?.proposals?.length) list.push({ k: 'prop', icon: '📨', n: S.world.proposals.length, tip: '외국의 조약 제안이 와 있습니다', go: () => openProposalCard(S.world.proposals[0].id) });
  if (S.war) list.push({ k: 'war', icon: '⚔️', red: true, tip: `${cname(S.war.k)}과(와) 전쟁 중 · 전황 ${S.war.score.toFixed(0)}`, go: () => { showTab('world'); zoomTo(S.war.k); } });
  const ripe = (S.bills || []).filter(b => b.progress >= 75); if (ripe.length) list.push({ k: 'bill', icon: '🏛️', n: ripe.length, tip: '본회의 표결이 임박한 법안', go: () => showTab('politics') });
  const ally = (S.world?.conflicts || []).find(c => c.type === 'war' && dip(S, c.b).alliance); if (ally) list.push({ k: 'ally', icon: '🛡️', red: true, tip: `동맹국 ${cname(ally.b)}이(가) 침공당했습니다`, go: () => showTab('world') });
  const soon = typeof nextElections === 'function' ? nextElections(S).find(e => e.left <= 1) : null; if (soon) list.push({ k: 'elec', icon: '🗳️', tip: `${soon.name} ${soon.left ? '다음 분기' : '이번 분기'}`, go: () => showTab('politics') });
  if (S.pcap >= 200) list.push({ k: 'cash', icon: '💰', tip: `쓰지 않은 국고 ${won(S.pcap)} — 공장을 짓거나 정책에 투자하세요`, go: () => showTab('economy') });
  if (S.pcap < 15) list.push({ k: 'broke', icon: '🪙', red: true, tip: '국고가 바닥났습니다 — 눌러서 참모 조언 보기', go: () => openAdvisor('pcap') });
  if ((S.construction || []).length < 3 && S.pcap >= 60 && !list.some(x => x.k === 'cash')) list.push({ k: 'build', icon: '🏗️', tip: '공사할 수 있는 자리가 남았습니다', go: () => showTab('economy') });
  const manual = Object.values(S.terr || {}).filter(t => !t.auto);
  if (manual.length) list.push({ k: 'gov', icon: '🤖', tip: `직접 관리 중인 점령지 ${manual.length}곳 — 눌러서 총독부에 한 번에 맡기기`, go: () => { setGov(S, '*', 'auto', true); saveGame(S); renderAll(); toast('🤖 모든 점령지를 총독부에 맡겼습니다. 통치 방식 변경·봉기 같은 중요한 결정만 카드로 올라옵니다.', 4500); } });
  if (S.world?.tension >= 70) list.push({ k: 'tension', icon: '🌐', red: true, tip: `세계 긴장도 ${S.world.tension.toFixed(0)} — 위험. 눌러서 낮추는 방법 보기`, go: () => openAdvisor('tension') });
  const um = typeof urgentMetric === 'function' ? urgentMetric(S) : null;
  if (um && !(um === 'tension' && list.some(x => x.k === 'tension')) && !(um === 'pcap' && list.some(x => x.k === 'broke'))) list.push({ k: 'adv-' + um, icon: '💡', red: true, tip: `AI 참모: ${ADV_TIP[um]}`, go: () => openAdvisor(um) });
  const keys = list.map(x => x.k).join(',');
  if (el.dataset.keys === keys && !list.some(x => x.n)) return;
  el.dataset.keys = keys;
  el.innerHTML = list.map((x, i) => `<div class="alert ${x.red ? 'red' : ''}" data-i="${i}" style="${alertSeen.has(x.k) ? 'animation:none' : ''}">${x.icon}${x.n ? `<b>${x.n}</b>` : ''}<span class="tip">${esc(x.tip)}</span></div>`).join('');
  el.querySelectorAll('.alert').forEach(a => a.onclick = () => list[+a.dataset.i].go());
  alertSeen = new Set(list.map(x => x.k));
}

/* ---------------- 전쟁: 실시간 갱신, 핵 위기 카드 ---------------- */
let warTickAt = 0;
function warTick() {
  const now = Date.now(); if (now - warTickAt < 350) return; warTickAt = now;
  if (typeof updateMap === 'function') updateMap();
  // 버튼 위에 마우스가 있으면 덜 자주 다시 그려 클릭이 끊기지 않게
  const slot = $('war-slot'), hov = slot?.matches(':hover');
  if (openPanelName === 'world' && slot && (!hov || now - warPanelAt > 2500)) { warPanelAt = now; renderWarPanel(); }
  if (typeof renderWarHud === 'function') renderWarHud();
}
function openNukeCard() {
  const P = S.nukePending; if (!P || !$('modal').classList.contains('hidden')) return;
  const canRet = hasNukes(S, 'kr') || S.war?.allies.includes('us');
  const resolve = choice => { const msg = nukeResponse(S, choice); saveGame(S); closeModal(); toast(esc(msg), 5000); addLog(S, 'info', `☢️ ${msg}`); renderAll(); };
  openModal(`<div class="event nuke">
    <div class="ev-banner ev-nuke"><span class="ev-art">☢️</span><span class="ev-kind">국가 존망의 위기</span></div>
    <h2>${esc(P.city)} 핵 피격</h2>
    <p class="ev-desc">${esc(cname(P.k))} 진영이 ${esc(P.city)}에 핵무기를 사용했습니다. 도시 기능이 마비되고 대규모 사상자가 발생했습니다. 성장률·행복도·안전이 폭락했고 국가채무가 급증했습니다. 그러나 국민은 정부를 중심으로 결집하고 있습니다. 대한민국은 무너지지 않았습니다. 대통령의 결단이 필요합니다.</p>
    <div class="ev-opts">
      <button class="ev-opt" data-nk="retaliate" ${canRet ? '' : 'disabled'}><b>☢️ 핵 보복</b><span>${canRet ? (hasNukes(S, 'kr') ? '자체 핵전력으로 보복. 적군이 붕괴하지만 세계가 등을 돌립니다.' : '미국에 확장억제(핵우산) 발동을 요청합니다. 적군 붕괴, 국제 여론 악화.') : '핵무기도, 참전한 미국도 없어 불가능합니다.'}</span></button>
      <button class="ev-opt" data-nk="ceasefire"><b>🏳️ 즉시 휴전</b><span>현 전선에서 전쟁을 멈춥니다. 추가 핵 공격은 막지만 지지율이 떨어집니다.</span></button>
      <button class="ev-opt" data-nk="un"><b>🇺🇳 유엔 안보리 중재</b><span>60% 확률로 휴전과 국제 재건 지원. 실패하면 전쟁이 계속됩니다.</span></button>
    </div></div>`);
  document.querySelectorAll('[data-nk]').forEach(b => b.onclick = () => resolve(b.dataset.nk));
}
