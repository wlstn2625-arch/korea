/* =========================================================
 *  새로운 대한민국 — UI
 * ========================================================= */
let S = null;
let activeCat = 'const';
let selectedParty = 'lib';
let selectedDiff = 'normal';
let busy = false;

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- 공통 ---------------- */
function toast(msg, ms = 2600) {
  const t = $('toast'); t.innerHTML = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function openModal(html, { closable = true } = {}) {
  $('modal-body').innerHTML = html; $('modal').classList.remove('hidden');
  $('modal-x').classList.toggle('hidden', !closable);
  $('modal').dataset.closable = closable ? '1' : '';
  $('modal').scrollTop = 0;
}
function closeModal() { $('modal').classList.add('hidden'); }
$('modal-x').onclick = closeModal;
$('modal').addEventListener('click', e => { if (e.target.id === 'modal' && $('modal').dataset.closable) closeModal(); });

function deltaClass(k, d) { const g = STATS[k] ? STATS[k].good : 1; if (k === 'infl') return Math.abs(S.stats.infl - 2) < Math.abs(S.stats.infl - d - 2) ? 'good' : 'bad'; return d * g > 0 ? 'good' : 'bad'; }
function fxList(e = {}, rel = {}, f = {}) {
  const out = [];
  for (const k in e) { if (!STATS[k] || Math.abs(e[k]) < Math.pow(10, -STATS[k].dec) / 2) continue; const cls = (k === 'infl' ? -e[k] : e[k] * STATS[k].good) > 0 ? 'good' : 'bad'; out.push(`<span class="delta ${cls}">${STATS[k].name} ${fmtStat(k, e[k], true)}</span>`); }
  for (const k in rel) { if (!RELATIONS[k] || Math.abs(rel[k]) < 0.5) continue; out.push(`<span class="delta ${rel[k] > 0 ? 'good' : 'bad'}">${RELATIONS[k].flag}${rel[k] > 0 ? '+' : ''}${rel[k].toFixed(0)}</span>`); }
  for (const k in f) { if (!FACTIONS[k] || Math.abs(f[k]) < 0.5) continue; out.push(`<span class="delta ${f[k] > 0 ? 'good' : 'bad'}">${FACTIONS[k].icon}${FACTIONS[k].name} ${f[k] > 0 ? '+' : ''}${f[k].toFixed(0)}</span>`); }
  return out.join(' ');
}
const LT_NAME = { decree: '행정', law: '법률', const: '개헌' };
function ltTag(o) { const lt = o.lt || 'decree'; return `<span class="tag ${lt}">${LT_NAME[lt]}</span>`; }

/* ---------------- 시작 화면 ---------------- */
function renderStart() {
  $('party-pick').innerHTML = Object.entries(PARTIES).map(([k, p]) =>
    `<div class="party-opt ${k === selectedParty ? 'sel' : ''}" data-p="${k}"><b>${p.name}</b><span>${p.desc}</span></div>`).join('');
  $('party-pick').querySelectorAll('.party-opt').forEach(el => el.onclick = () => { selectedParty = el.dataset.p; renderStart(); });
  $('diff-pick').innerHTML = Object.entries(DIFFICULTY).map(([k, d]) =>
    `<div class="party-opt ${k === selectedDiff ? 'sel' : ''}" data-d="${k}"><b>${d.name}</b><span>${d.desc} 시작 ⚡${d.start}, 분기마다 약 ⚡${d.base}씩 회복</span></div>`).join('');
  $('diff-pick').querySelectorAll('.party-opt').forEach(el => el.onclick = () => { selectedDiff = el.dataset.d; renderStart(); });
  const sv = loadGame();
  $('btn-continue').classList.toggle('hidden', !sv || sv.over);
  if (sv && !sv.over) { const t = turnLabel(sv.turn); $('btn-continue').textContent = `이어하기 (${sv.name}, ${t.year}년 ${t.q}분기)`; }
}
$('btn-start').onclick = () => {
  const name = $('pres-name').value.trim() || '대통령';
  S = newGame(selectedParty, name, selectedDiff);
  saveGame(S); enterGame();
  openModal(`<h2>🇰🇷 취임을 축하합니다, ${esc(name)} 대통령님</h2>
    <p class="lead">${esc(PARTIES[selectedParty].name)} · 난이도 ${DIFFICULTY[selectedDiff].name} · 임기 5년(20분기) · ${turnLabel(0).year}년 ${turnLabel(0).q}분기 시작</p>
    <div class="box"><h4>게임 방법</h4><ul>
      <li><b>📜 정책 결정</b>: 헌법·세제·국방·외교·교육·검경·민법 등 13개 분야 ${POLICIES.length}개 제도가 <b>현재 대한민국 그대로</b> 설정되어 있습니다. 원하는 제도를 바꾸세요.</li>
      <li>바꾸기 전에 <b>AI 참모가 이득·손해·부작용·국회 통과 가능성</b>을 분석해 줍니다.</li>
      <li>법률은 국회 과반, <b>개헌은 국회 2/3 + 국민투표</b>가 필요합니다. 행정조치는 즉시 시행됩니다.</li>
      <li>정책을 바꾸면 효과가 몇 분기에 걸쳐 나타나고, <b>부작용(위기)</b>이 터질 수 있습니다. 위기가 오면 <b>AI가 해결책을 판단해 결과를 도출</b>합니다. (직접 결정 모드도 가능)</li>
      <li>목록에 없는 정책은 <b>✍️ 새 정책 직접 입안</b>으로 무엇이든 만들 수 있습니다.</li>
      <li><b>🏛️ 국회·세력</b>: 법률·개헌은 여러 분기에 걸쳐 국회 심의를 거칩니다. 협상·신속처리로 밀어붙이고, 재계·노동계 등 이익집단을 국정 연합에 영입해 정당성을 높이세요.</li>
      <li><b>🏭 경제</b>: 반도체·자동차·조선 등 12개 산업이 각자 성장하며 GDP를 만듭니다. 전략 산업을 집중 육성할 수 있습니다.</li>
      <li><b>🌏 외교·전쟁</b>: 세계지도 위 약 200개국. 나라마다 <b>지도자(가상 인물)</b>가 있고 성향대로 움직입니다. 관세 전쟁·사이버 공격·국경 분쟁·전쟁·내전이 실시간으로 일어나고, 중재·인도적 지원·무기 지원·제재·참전으로 개입할 수 있습니다. 지도자와 직접 대화도 할 수 있습니다.</li>
      <li><b>🏛️ 대통령 권한</b>: 국회가 막으면 <b>긴급재정경제명령</b>(헌법 76조)이나 <b>국민투표</b>(72조)로 돌파할 수 있습니다. 대가는 따릅니다.</li>
      <li>정치자본은 정책 추진에 쓰이고 지지율이 높을수록 많이 회복됩니다. 지지율이 바닥나면 <b>탄핵</b>될 수 있습니다.</li>
      <li>⚙️ 설정에서 <b>Claude API 키</b>를 넣으면 실제 AI(Claude)가 위기 판단·정책 분석·분기 논평을 수행합니다.</li>
    </ul></div>
    <div class="modal-actions"><button class="btn primary" onclick="closeModal()">국정 시작</button></div>`);
};
$('btn-continue').onclick = () => { S = loadGame(); if (S) enterGame(); };

function enterGame() {
  migrateState(S);
  ClaudeAI.setWorldview(S.worldview);
  hydrateUserOptions(S);
  $('start').classList.add('hidden'); $('game').classList.remove('hidden');
  $('auto-ai').checked = S.autoAI;
  closePanel();
  renderAll();
  if (typeof refreshTicker === 'function') { refreshTicker(); setSpeed(0); }
  setTimeout(() => toast('⏯ 위쪽 ▶ 버튼이나 <b>스페이스바</b>로 시간을 흐르게 하세요. 메뉴에서 정책·외교·국회를 다루고, 지도에서 나라를 눌러 보세요.', 6000), 400);
}

/* ---------------- 탭 ---------------- */
$('tabs').querySelectorAll('button').forEach(b => b.onclick = () => showTab(b.dataset.tab, true));
const PANEL_TITLES = { status: '📊 국정 현황', policy: '📜 정책 결정', politics: '🏛️ 국회·세력', economy: '🏭 산업 경제', world: '🌏 외교·세계 정세', crisis: '🚨 위기 대응', report: '🗞️ 국정 보고서', trend: '📈 지표 추이', log: '🗂️ 국정 기록' };
let openPanelName = null;
// 지도 위에 패널을 엽니다. 같은 버튼을 다시 누르면 닫힘
function showTab(name, toggle = false) {
  if (toggle && openPanelName === name) return closePanel();
  openPanelName = name;
  $('panel-wrap').classList.remove('hidden');
  $('panel-title').textContent = PANEL_TITLES[name] || '';
  $('tabs').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  $('panel-wrap').querySelector('.panel-body').scrollTop = 0;
  if (name === 'trend') renderTrend();
  if (name === 'world' && typeof renderWorld === 'function') renderWorld();
}
function closePanel() {
  openPanelName = null;
  $('panel-wrap').classList.add('hidden');
  $('tabs').querySelectorAll('button').forEach(b => b.classList.remove('active'));
}
$('panel-x').onclick = closePanel;

/* ---------------- 렌더링 ---------------- */
function renderAll() {
  renderHeader(); renderSide(); renderPolicies(); renderCrises(); renderReport(); renderLog();
  if (typeof renderSystemsTabs === 'function') renderSystemsTabs();
  if ($('tab-trend').classList.contains('active')) renderTrend();
}
function renderHeader() {
  const t = turnLabel(Math.min(S.turn, TERM_TURNS - 1));
  $('hdr-date').textContent = typeof gameDateText === 'function' ? gameDateText() : `${t.year}년 ${t.q}분기`;
  $('hdr-term').textContent = `임기 ${t.termYear}년차 · ${Math.min(S.turn + 1, TERM_TURNS)}/${TERM_TURNS}분기`;
  hudFloat('hdr-appr', S.approval, 1, '%p'); hudFloat('hdr-pcap', S.pcap, 0, ''); hudFloat('hdr-gdp', S.stats.gdp, 1, '%p');
  const a = $('hdr-appr'); a.textContent = S.approval.toFixed(1) + '%'; a.style.color = S.approval >= 50 ? 'var(--good)' : S.approval >= 30 ? 'var(--mid)' : 'var(--bad)';
  { const g = pcapGain(S); $('hdr-pcap').innerHTML = `${Math.floor(S.pcap)}<small class="gain">${g >= 0 ? '+' : ''}${Math.round(g)}/분기</small>`; }
  const rs = S.ruling === 'P' ? S.seats.P : S.seats[S.ruling];
  const se = $('hdr-seats'); se.textContent = `${rs}/300`; se.style.color = rs >= 151 ? 'var(--good)' : 'var(--mid)';
  $('btn-end').disabled = S.over;
  const gd = $('hdr-gdp'); gd.textContent = fmtStat('gdp', S.stats.gdp); gd.style.color = S.stats.gdp >= 1.5 ? 'var(--good)' : S.stats.gdp >= 0 ? 'var(--mid)' : 'var(--bad)';
  const db = $('hdr-debt'); db.textContent = fmtStat('debt', S.stats.debt); db.style.color = S.stats.debt < 60 ? 'var(--text)' : S.stats.debt < 80 ? 'var(--mid)' : 'var(--bad)';
  const tn = $('hdr-tension'); const T = S.world?.tension ?? 35; tn.textContent = T.toFixed(0); tn.style.color = T >= 70 ? 'var(--bad)' : T >= 50 ? 'var(--mid)' : 'var(--good)';
}
// 상단 수치가 바뀌면 +/- 숫자가 떠올랐다 사라짐
const hudPrev = {};
function hudFloat(id, v, dec, unit) {
  const prev = hudPrev[id]; hudPrev[id] = v;
  if (prev == null || Math.abs(v - prev) < Math.pow(10, -dec) / 2) return;
  const d = v - prev, host = $(id)?.closest('.res'); if (!host) return;
  const f = document.createElement('span'); f.className = 'floater ' + (d > 0 ? 'up' : 'down');
  f.textContent = `${d > 0 ? '+' : ''}${d.toFixed(dec)}${unit}`;
  host.appendChild(f); setTimeout(() => f.remove(), 1800);
}
function renderSide() {
  const prev = S.history.length > 1 ? S.history[S.history.length - 2] : S.history[0];
  $('stat-list').innerHTML = Object.entries(STATS).map(([k, m]) => {
    const v = S.stats[k], d = v - prev.stats[k];
    const show = Math.abs(d) >= Math.pow(10, -m.dec) / 2;
    return `<div class="stat-row"><span>${m.name}</span><span><span class="v">${fmtStat(k, v)}</span>${show ? `<span class="delta ${deltaClass(k, d)}">${d > 0 ? '▲' : '▼'}${Math.abs(d).toFixed(m.dec)}</span>` : ''}</span></div>`;
  }).join('');
  $('rel-list').innerHTML = Object.entries(RELATIONS).map(([k, m]) => bar(`${m.flag} ${m.name}`, S.rel[k])).join('');
  $('fac-list').innerHTML = Object.entries(FACTIONS).map(([k, m]) => bar(`${m.icon} ${m.name}`, S.factions[k])).join('');
}
function bar(label, v) {
  const c = v >= 60 ? 'var(--good)' : v >= 40 ? 'var(--accent)' : v >= 25 ? 'var(--mid)' : 'var(--bad)';
  return `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${c}"></i></div><span class="n">${v.toFixed(0)}</span></div>`;
}

function allPolicies() { return [...POLICIES, ...S.customPolicies]; }
function renderPolicies() {
  $('cat-chips').innerHTML = CATEGORIES.map(c => {
    const changed = allPolicies().filter(p => p.cat === c.id && !currentOption(p, S).cur).length;
    return `<button class="chip ${c.id === activeCat ? 'active' : ''}" data-c="${c.id}">${c.icon} ${c.name}${changed ? `<span class="cnt">●${changed}</span>` : ''}</button>`;
  }).join('');
  $('cat-chips').querySelectorAll('.chip').forEach(b => b.onclick = () => { activeCat = b.dataset.c; if (typeof ministerPick !== 'undefined') ministerPick = 0; renderPolicies(); });
  if (typeof renderMinister === 'function') renderMinister();
  const list = allPolicies().filter(p => p.cat === activeCat);
  $('policy-list').innerHTML = list.map(p => {
    const cur = currentOption(p, S);
    const locked = S.enactedThisTurn.includes(p.id);
    const pend = S.pending.find(x => x.pid === p.id);
    const bill = S.bills && S.bills.find(x => x.pid === p.id);
    return `<div class="pcard ${!cur.cur ? 'changed' : ''}">
      <div class="phead"><h4>${esc(p.name)} ${p.custom ? '<span class="tag new">직접 입안</span>' : ''} ${!cur.cur ? '<span class="tag new">변경됨</span>' : ''}</h4>${p.bg || p.options.some(o => o.pro) ? `<button class="btn sm ghost" data-explain="${p.id}">📖 해설</button>` : ''}</div>
      <p class="pdesc">${esc(p.desc)}</p>
      ${bill ? `<p class="pdesc">🏛️ 국회 심의 중: '${esc(optionOf(p, bill.oid).label)}' ${Math.round(bill.progress)}% (${esc(billStage(bill))})</p>` : ''}
      ${pend ? `<p class="pdesc">⏳ 효과 반영 중: ${Math.round((1 - pend.left / pend.lag) * 100)}%</p>` : ''}
      <div class="opts">${p.options.map(o => {
        const isCur = o.id === cur.id;
        return `<button class="opt ${isCur ? 'current' : ''} ${locked && !isCur ? 'disabled' : ''}" data-p="${p.id}" data-o="${o.id}" ${isCur ? 'disabled' : ''}>
          <span>${isCur ? '✔ ' : ''}${esc(o.label)}${o.user ? ' <span class="tag new">직접 입력</span>' : ''}</span>
          <span class="meta">${o.cur ? '<span class="tag cur">현행</span>' : ''}${!isCur && !o.cur ? ltTag(o) + `<span class="tag">⚡${policyCost(S, o)}</span>` : ''}${!isCur && o.cur ? ltTag({ lt: cur.lt || 'law' }) + `<span class="tag">⚡${policyCost(S, { pc: 20 })}</span>` : ''}</span>
        </button>`;
      }).join('')}</div>
      <div class="custom-row own"><input id="own-${p.id}" data-own="${p.id}" placeholder="✍️ 직접 입력: ${esc(ownHint(p))}" maxlength="80"><button class="btn sm" data-ownbtn="${p.id}">AI 분석</button></div>
    </div>`;
  }).join('') || '<div class="empty">이 분야에 정책이 없습니다.</div>';
  $('policy-list').querySelectorAll('.opt:not(.current)').forEach(b => b.onclick = () => openPreview(b.dataset.p, b.dataset.o));
  $('policy-list').querySelectorAll('[data-explain]').forEach(b => b.onclick = () => openExplain(b.dataset.explain));
  $('policy-list').querySelectorAll('[data-ownbtn]').forEach(b => b.onclick = () => submitOwn(b.dataset.ownbtn));
  $('policy-list').querySelectorAll('[data-own]').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submitOwn(i.dataset.own); }));
}

// 주관식 입력 예시: 현행 수치가 있으면 다른 수치를 제안
function ownHint(p) {
  const cur = p.options.find(o => o.cur); const n = numIn(cur.label);
  if (n != null) {
    const alt = Number.isInteger(n) ? (n >= 100 ? Math.round(n * 1.1 / 10) * 10 : n + (n >= 10 ? 3 : 1)) : +(n * 1.2).toFixed(1);
    return '예) ' + cur.label.replace(/[\d,]+(\.\d+)?/, alt.toLocaleString('ko-KR'));
  }
  return '내가 원하는 방식을 문장으로';
}

async function submitOwn(pid) {
  const inp = $('own-' + pid); const text = inp.value.trim();
  if (!text) return toast('원하는 안을 입력하세요.');
  if (S.over || busy) return;
  const p = policyById(pid, S);
  busy = true;
  openModal(`<h2>✍️ 직접 입력 분석 중</h2><p><span class="spinner"></span>${ClaudeAI.enabled() ? 'Claude가' : 'AI 참모가'} [${esc(p.name)}] "${esc(text)}"의 효과를 분석하고 있습니다…</p>`, { closable: false });
  let a = null, by = 'rule';
  try { if (ClaudeAI.enabled()) { a = await ClaudeAI.analyzeOption(p, text, S); by = 'claude'; } }
  catch (e) { toast('Claude 분석 실패 → 규칙 기반 분석으로 대체: ' + esc(e.message), 4000); }
  if (!a) a = analyzeOptionRule(S, p, text);
  const o = addUserOption(S, pid, a);
  busy = false; saveGame(S); closeModal(); renderPolicies();
  toast(`${by === 'claude' ? '🤖 Claude' : 'AI 참모'} 분석 완료: '${esc(o.label)}' 선택지가 추가되었습니다.`);
  openPreview(pid, o.id);
}

function argBox(o) {
  if (!o.pro && !o.con && !o.ex) return '';
  return `<div class="args">${o.pro ? `<div><b class="good-t">찬성</b> ${esc(o.pro)}</div>` : ''}${o.con ? `<div><b class="bad-t">반대</b> ${esc(o.con)}</div>` : ''}${o.ex ? `<div><b class="muted">사례</b> ${esc(o.ex)}</div>` : ''}</div>`;
}

function openExplain(pid) {
  const p = policyById(pid, S); const cur = currentOption(p, S);
  openModal(`<h2>📖 ${esc(p.name)}</h2>
    <p class="lead">${esc(p.desc)}</p>
    ${p.bg ? `<div class="box"><h4>배경</h4><p class="ptext">${esc(p.bg)}</p></div>` : ''}
    ${p.issue ? `<div class="box" style="margin-top:8px"><h4>쟁점</h4><p class="ptext">${esc(p.issue)}</p></div>` : ''}
    <h3 class="sec">선택지 ${p.options.length}개</h3>
    ${p.options.map(o => { const isCur = o.id === cur.id; return `<div class="xopt ${isCur ? 'is-cur' : ''}">
      <div class="xhead"><b>${isCur ? '✔ ' : ''}${esc(o.label)}</b> <span class="meta">${o.cur ? '<span class="tag cur">현행</span>' : ltTag(o) + `<span class="tag">⚡${policyCost(S, o)}</span>`}${o.user ? '<span class="tag new">직접 입력</span>' : ''}</span>
      ${isCur ? '' : `<button class="btn sm" data-review="${o.id}">이 안 검토</button>`}</div>
      ${o.desc && !o.cur ? `<div class="muted">${esc(o.desc)}</div>` : ''}${argBox(o)}</div>`; }).join('')}
    <div class="modal-actions"><button class="btn primary" onclick="closeModal()">닫기</button></div>`);
  document.querySelectorAll('[data-review]').forEach(b => b.onclick = () => openPreview(pid, b.dataset.review));
}

// 현행 복귀 옵션은 비용·표결 정보가 없으므로 기본값 부여
function normalizeOpt(p, o) {
  if (o.cur && !o.lt) return { ...o, lt: currentOption(p, S).lt || 'law', lean: 'N', pc: 20, lag: 4, e: {}, f: {} };
  return o;
}

function openPreview(pid, oid, lobby = 0) {
  if (S.over) return;
  const p = policyById(pid, S); const o0 = optionOf(p, oid); const o = normalizeOpt(p, o0);
  const cur = currentOption(p, S);
  if (S.enactedThisTurn.includes(pid)) return toast('이 분야는 이번 분기에 이미 손댔습니다. 다음 분기에 다시 시도하세요.');
  if (S.bills && S.bills.some(b => b.pid === pid)) return toast('이 분야 법안이 국회에서 심의 중입니다. [🏛️ 국회·세력] 탭에서 철회 후 다시 추진할 수 있습니다.');
  const pv = previewPolicy(S, p, o, lobby);
  const fmtPart = x => x.rel ? `${x.name} ${x.delta > 0 ? '+' : ''}${x.delta.toFixed(0)}` : x.k === 'approval' ? `지지율 ${x.delta > 0 ? '+' : ''}${x.delta.toFixed(1)}%p (세력 반응)` : `${x.name} ${fmtStat(x.k, x.delta, true)}`;
  const voteTxt = pv.vote.type === 'decree' ? '대통령령·행정조치 — 국회 표결 없이 즉시 시행'
    : `${pv.vote.type === 'const' ? '개헌: 국회 2/3(200석) + 국민투표 과반' : '법률: 국회 과반(151석)'} · 국회 심의 약 ${typeof estimateBillTurns === 'function' ? estimateBillTurns(S, o, lobby) : 1}분기 후 본회의 표결 · 예상 찬성 ${pv.vote.exp}석${pv.vote.type === 'const' ? ` · 국민투표 통과 ${(pv.vote.refProb * 100).toFixed(0)}%` : ''}`;
  const probPct = Math.round(pv.vote.prob * 100);
  const probColor = probPct >= 70 ? 'var(--good)' : probPct >= 40 ? 'var(--mid)' : 'var(--bad)';
  openModal(`<h2>${esc(p.name)}</h2>
    <p class="lead">${esc(cur.label)} → <b>${esc(o.label)}</b><br>${esc(o.desc || '')}</p>
    ${argBox(o0)}
    <div class="vote"><span>${voteTxt}</span><span>정치자본 <b>⚡${pv.cost}</b> (보유 ${Math.floor(S.pcap)})</span><span>효과 완성까지 <b>${pv.lag}분기</b></span></div>
    <div>통과 가능성 <b style="color:${probColor}">${probPct}%</b><div class="prob"><i style="width:${probPct}%;background:${probColor}"></i></div></div>
    ${pv.vote.type !== 'decree' ? `<div class="vote" style="margin-top:10px"><span>🤝 야당 협상(협치):</span>${[0, 1, 2, 3].map(l => `<button class="btn sm ${l === lobby ? 'primary' : ''}" data-lobby="${l}">${l ? `${l}단계 ⚡+${l * LOBBY_COST}` : '없음'}</button>`).join('')}<span>1단계당 찬성 약 +16석</span></div>` : ''}
    <h3 class="sec">🤖 AI 참모 사전 분석</h3>
    <div class="two">
      <div class="box gain"><h4>예상 이득</h4>${pv.gains.length ? `<ul>${pv.gains.map(x => `<li>${fmtPart(x)}</li>`).join('')}</ul>` : '<span class="muted">뚜렷한 이득 없음</span>'}</div>
      <div class="box loss"><h4>예상 손해</h4>${pv.losses.length ? `<ul>${pv.losses.map(x => `<li>${fmtPart(x)}</li>`).join('')}</ul>` : '<span class="muted">뚜렷한 손해 없음</span>'}</div>
    </div>
    <div class="box" style="margin-top:10px"><h4>세력 반응</h4>${fxList({}, {}, pv.diff.f) || '<span class="muted">반응 미미</span>'}</div>
    ${pv.risks.length ? `<div class="box" style="margin-top:10px"><h4>⚠️ 예상 부작용</h4>${pv.risks.map(r => `<div class="risk">${RISK_TEMPLATES[r.tpl].icon} <b>${esc(r.title)}</b> — 발생 확률 ${(r.prob * 100).toFixed(0)}%, 심각도 ${'●'.repeat(r.sev)}${'○'.repeat(3 - r.sev)}<br><span class="muted">${esc(r.desc)}</span></div>`).join('')}</div>` : ''}
    <div class="verdict ${pv.verdict.cls}"><b>AI 종합 판단</b> (점수 ${pv.net.toFixed(1)}): ${pv.verdict.text}</div>
    <div id="claude-advice"></div>
    ${o0.lt === 'law' ? (() => {
      const ce = canEmergency(S, p, o0), cr = canReferendum(S, p, o0), ro = referendumOdds(S, o0);
      return `<div class="box powers"><h4>🏛️ 대통령 권한으로 국회 우회</h4>
        <div class="pw"><div><b>⚡ 긴급재정경제명령</b> (헌법 76조) <span class="tag">⚡${emergencyCost(S, o0)}</span><div class="muted small">${esc(ce || '즉시 시행. 다음 분기 국회 승인 필요(승인 확률 약 ' + Math.round(clamp(voteModel(S, o0).prob + 0.15, 0.05, 0.97) * 100) + '%), 거부되면 효력 상실. 법조계·야권 반발, 지지율 -2.')}</div></div><button class="btn sm" id="btn-emerg" ${ce || S.pcap < emergencyCost(S, o0) ? 'disabled' : ''}>발동</button></div>
        <div class="pw"><div><b>🗳️ 국민투표 부의</b> (헌법 72조) <span class="tag">⚡${referendumCost(S, o0)}</span><div class="muted small">${esc(cr || '국회 대신 국민에게 직접 묻습니다. 예상 찬성 ' + ro.sup.toFixed(0) + '% (가결 확률 ' + Math.round(ro.prob * 100) + '%). 부결되면 지지율 -4. 1년에 한 번.')}</div></div><button class="btn sm" id="btn-refer" ${cr || S.pcap < referendumCost(S, o0) ? 'disabled' : ''}>부의</button></div>
      </div>`; })() : ''}
    <div class="modal-actions">
      ${ClaudeAI.enabled() ? `<button class="btn" id="btn-ask-claude">🤖 Claude 의견 듣기</button>` : ''}
      <button class="btn" onclick="closeModal()">취소</button>
      <button class="btn primary" id="btn-enact" ${S.pcap < pv.cost ? 'disabled' : ''}>${pv.vote.type === 'decree' ? '즉시 시행' : pv.vote.type === 'const' ? '개헌안 발의' : '법안 제출'}</button>
    </div>`);
  document.querySelectorAll('[data-lobby]').forEach(b => b.onclick = () => openPreview(pid, oid, +b.dataset.lobby));
  const powerResult = (r, title) => {
    if (!r.ok) return toast(esc(r.msg));
    closeModal(); saveGame(S); renderAll();
    openModal(`<h2>${r.passed ? '✅' : '❌'} ${title}</h2><p class="lead">${esc(p.name)}: ${esc(o.label)}</p><p>${esc(r.detail)}</p><div class="modal-actions"><button class="btn primary" onclick="closeModal()">확인</button></div>`);
  };
  $('btn-emerg') && ($('btn-emerg').onclick = () => powerResult(emergencyDecree(S, pid, oid), '긴급재정경제명령'));
  $('btn-refer') && ($('btn-refer').onclick = () => powerResult(referendumPolicy(S, pid, oid), '국민투표'));
  $('btn-enact').onclick = () => {
    const tmp = o0.cur && !o0.lt ? Object.assign(o0, { lt: o.lt, lean: o.lean, pc: o.pc, lag: o.lag }) : o0;
    const r = enactPolicy(S, pid, tmp.id, lobby);
    if (o0.cur) { delete o0.lt; delete o0.lean; delete o0.pc; delete o0.lag; }
    if (!r.ok) return toast(r.msg);
    closeModal(); saveGame(S); renderAll();
    if (r.bill) return openModal(`<h2>📨 국회 제출</h2><p class="lead">${esc(p.name)}: ${esc(o.label)}</p><p>${esc(r.detail)}</p><p class="muted">심의 진행과 협상·신속처리·철회는 [🏛️ 국회·세력] 탭에서 관리할 수 있습니다.</p><div class="modal-actions"><button class="btn" onclick="closeModal();showTab('politics')">국회 탭 보기</button><button class="btn primary" onclick="closeModal()">확인</button></div>`);
    openModal(`<h2>${r.passed ? '✅ 시행 확정' : '❌ 부결'}</h2><p class="lead">${esc(p.name)}: ${esc(o.label)}</p><p>${esc(r.detail)}</p>
      ${r.passed ? `<p class="muted">효과는 ${pv.lag}분기에 걸쳐 나타납니다. 세력 반응은 즉시 반영되었습니다.${pv.risks.length ? ' 부작용이 잠복 중이니 주의하세요.' : ''}</p>` : '<p class="muted">정치자본의 절반이 소모되었고 지지율이 소폭 하락했습니다. 다음 분기에 다시 시도할 수 있습니다.</p>'}
      <div class="modal-actions"><button class="btn primary" onclick="closeModal()">확인</button></div>`);
  };
  const ask = $('btn-ask-claude');
  if (ask) ask.onclick = async () => {
    ask.disabled = true; $('claude-advice').innerHTML = `<div class="ai-box"><span class="spinner"></span>Claude가 분석 중입니다…</div>`;
    try {
      const txt = await ClaudeAI.advise(S, p, o, pv);
      $('claude-advice').innerHTML = `<div class="ai-box"><span class="who">🤖 Claude 국정자문</span>${esc(txt)}</div>`;
    } catch (e) { $('claude-advice').innerHTML = `<div class="ai-box">Claude 호출 실패: ${esc(e.message)}</div>`; }
  };
}

/* ---------------- 자유 입안 ---------------- */
$('btn-custom').onclick = async () => {
  const text = $('custom-text').value.trim();
  if (!text) return toast('정책 내용을 입력하세요.');
  if (S.over || busy) return;
  busy = true; $('btn-custom').disabled = true;
  openModal(`<h2>✍️ 정책 분석 중</h2><p><span class="spinner"></span>${ClaudeAI.enabled() ? 'Claude가' : 'AI 참모가'} "${esc(text)}"의 효과를 분석하고 있습니다…</p>`, { closable: false });
  let a, by = 'rule';
  try {
    if (ClaudeAI.enabled()) { a = await ClaudeAI.analyzePolicy(text, S); by = 'claude'; }
  } catch (e) { toast('Claude 분석 실패 → 규칙 기반 분석으로 대체: ' + esc(e.message), 4000); }
  if (!a) a = analyzeCustomRule(text);
  const p = registerCustomPolicy(S, text, a);
  busy = false; $('btn-custom').disabled = false; $('custom-text').value = '';
  activeCat = p.cat; saveGame(S); renderPolicies(); closeModal();
  toast(`${by === 'claude' ? '🤖 Claude' : 'AI 참모'} 분석 완료: '${esc(p.name)}'이(가) ${CATEGORIES.find(c => c.id === p.cat).name} 분야에 추가되었습니다.`);
  openPreview(p.id, 'new');
};
$('custom-text').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-custom').click(); });

/* ---------------- 위기 대응 ---------------- */
$('auto-ai').onchange = e => { S.autoAI = e.target.checked; saveGame(S); renderCrises(); };
function renderCrises() {
  $('crisis-badge').textContent = S.crises.length; $('crisis-badge').classList.toggle('hidden', !S.crises.length);
  $('ai-mode-label').textContent = S.autoAI
    ? `위기가 발생하면 ${ClaudeAI.enabled() ? 'Claude' : 'AI 참모'}가 즉시 판단해 해결합니다.`
    : '직접 결정 모드: 위기마다 해법을 고르거나 AI에게 맡기세요. 미처리 위기는 분기 종료 시 AI가 처리합니다.';
  $('crisis-list').innerHTML = S.crises.length ? S.crises.map(c => {
    const evals = aiEvaluate(S, c); const best = evals[0].i;
    const p = c.pid && policyById(c.pid, S);
    return `<div class="ccard ${c.good ? 'good' : ''}">
      <h4>${c.icon} ${esc(c.title)} <span class="tag">${esc(c.kind)}</span> <span class="tag">심각도 ${'●'.repeat(c.sev)}</span></h4>
      <p>${esc(c.desc)}${p ? `<br>원인 정책: <b>${esc(p.name)} — ${esc(optionOf(p, c.oid).label)}</b>` : ''}</p>
      ${c.options.map((o, i) => { const ev = evals.find(x => x.i === i); const fx = expandSolution(S, c, o, true); return `<div class="sol ${i === best ? 'best' : ''}">
        <div><b>${esc(o.label)}</b> ${i === best ? '<span class="tag new">AI 추천</span>' : ''} <span class="tag">성공 ${(ev.ok * 100).toFixed(0)}%</span> <span class="tag">⚡${o.pc || 0}</span>${o.rollback ? `<span class="tag">정책 ${(o.rollback * 100).toFixed(0)}% 후퇴</span>` : ''}
          <div class="sd">${esc(o.desc)}</div><div class="fx">${fxList(fx.e, fx.rel, fx.f)}</div></div>
        <button class="btn sm" data-c="${c.id}" data-i="${i}">선택</button></div>`; }).join('')}
      <div class="modal-actions"><button class="btn primary sm" data-ai="${c.id}">🤖 AI에게 맡기기</button></div>
    </div>`;
  }).join('') : '<div class="empty">현재 대응이 필요한 위기가 없습니다. 평화로운 분기입니다.</div>';
  $('crisis-list').querySelectorAll('button[data-i]').forEach(b => b.onclick = () => {
    const rec = resolveCrisis(S, b.dataset.c, +b.dataset.i, 'player');
    afterResolve([rec]);
  });
  $('crisis-list').querySelectorAll('button[data-ai]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>판단 중…';
    const rec = await aiResolve(S.crises.find(c => c.id === b.dataset.ai));
    afterResolve([rec]);
  });
  $('resolved-list').innerHTML = S.resolved.slice(0, 12).map(resolvedCard).join('') || '<div class="empty">아직 처리한 위기가 없습니다.</div>';
}
function resolvedCard(r) {
  const t = turnLabel(r.turn);
  return `<div class="rcard"><div>${r.icon} <b>${esc(r.title)}</b> <span class="muted">· ${t.year}년 ${t.q}분기 · ${esc(r.by)}</span></div>
    <div>해법: <b>${esc(r.sol)}</b> → <span class="res ${r.success ? 'ok' : 'fail'}">${r.success ? '성공' : '실패'}</span> — ${esc(r.outcome)}</div>
    <div class="fx">${fxList(r.fx.e, r.fx.rel, r.fx.f)}</div>
    ${r.reasoning ? `<div class="why">🧠 ${esc(r.reasoning)}</div>` : ''}</div>`;
}
function afterResolve(recs) {
  saveGame(S); renderAll();
  const r = recs.filter(Boolean);
  if (r.length) openModal(`<h2>위기 대응 결과</h2>${r.map(resolvedCard).join('')}<div class="modal-actions"><button class="btn primary" onclick="closeModal()">확인</button></div>`);
}

// AI가 위기를 판단·해결 (Claude 사용 가능 시 Claude, 실패 시 규칙 기반)
async function aiResolve(c) {
  if (!c) return null;
  const evals = aiEvaluate(S, c);
  if (ClaudeAI.enabled()) {
    try {
      const r = await ClaudeAI.resolveCrisis(c, S, evals);
      return resolveCrisis(S, c.id, r.choice, 'claude', r.reasoning);
    } catch (e) { toast('Claude 판단 실패 → AI 참모가 대신 판단합니다: ' + esc(e.message), 4000); }
  }
  return resolveCrisis(S, c.id, evals[0].i, 'ai', explainChoice(S, c, evals));
}

/* ---------------- 분기 종료 ---------------- */
$('btn-end').onclick = () => endQuarter();
async function endQuarter() {
  if (busy || S.over) return;
  busy = true; $('btn-end').disabled = true;
  if (typeof setSpeed === 'function') S.day = 0;
  const hadModal = !$('modal').classList.contains('hidden');
  if (!hadModal) openModal(`<h2>⏳ 분기 결산 중</h2><p><span class="spinner"></span>정책 효과를 반영하고 국내외 정세를 시뮬레이션하고 있습니다…</p>`, { closable: false });
  const recs = [];
  // 직접 결정 모드에서 미처리 위기는 AI가 처리
  for (const c of [...S.crises]) recs.push(await aiResolve(c));
  const report = endTurn(S);
  const newCrises = S.crises.filter(c => report.crises.includes(c.id));
  if (S.autoAI) {
    for (const c of newCrises) {
      $('modal-body').innerHTML = `<h2>🚨 위기 대응 중</h2><p><span class="spinner"></span>${ClaudeAI.enabled() ? 'Claude' : 'AI 참모'}가 '${esc(c.title)}'에 대한 해법을 판단하고 있습니다…</p>`;
      recs.push(await aiResolve(c));
    }
  }
  report.resolvedIds = recs.filter(Boolean).map(r => r.id);
  report.pendingCrises = S.autoAI ? 0 : newCrises.length;
  saveGame(S);
  busy = false; renderAll();
  if (typeof afterQuarter === 'function') afterQuarter(report, recs.filter(Boolean), newCrises);
  else showReportModal(report, recs.filter(Boolean));
  if (ClaudeAI.enabled() && !report.gameOver) {
    try {
      const txt = await ClaudeAI.briefing(S, report);
      report.brief = txt; saveGame(S);
      const el = $('brief-slot'); if (el) el.innerHTML = `<div class="ai-box"><span class="who">🤖 Claude 분기 논평</span>${esc(txt)}</div>`;
      renderReport();
    } catch (e) { const el = $('brief-slot'); if (el) el.innerHTML = `<div class="ai-box">Claude 논평 실패: ${esc(e.message)}</div>`; }
  }
}

function reportHTML(report, recs) {
  const t = report.label;
  const gains = [], losses = [];
  for (const k in report.diff) {
    const d = report.diff[k]; const th = STATS[k].dec >= 3 ? 0.0015 : STATS[k].dec === 2 ? 0.005 : STATS[k].dec === 1 ? 0.1 : 0.6;
    if (Math.abs(d) < th) continue;
    const good = k === 'infl' ? Math.abs(S.stats.infl - 2) < Math.abs(S.stats.infl - d - 2) : d * STATS[k].good > 0;
    (good ? gains : losses).push(`${STATS[k].name} ${fmtStat(k, d, true)} <span class="muted">(${fmtStat(k, S.history[report.turn + 1]?.stats[k] ?? S.stats[k])})</span>`);
  }
  for (const k in report.relDiff) { const d = report.relDiff[k]; if (Math.abs(d) < 2) continue; (d > 0 ? gains : losses).push(`${RELATIONS[k].flag} ${RELATIONS[k].name} 관계 ${d > 0 ? '+' : ''}${d.toFixed(0)}`); }
  const ap = report.approvalDiff;
  return `<p class="lead">${t.year}년 ${t.q}분기 결과 · 지지율 <b style="color:${ap >= 0 ? 'var(--good)' : 'var(--bad)'}">${ap >= 0 ? '+' : ''}${ap.toFixed(1)}%p</b></p>
    ${report.elections.length ? `<div class="verdict">${report.elections.map(esc).join('<br>')}</div>` : ''}
    ${report.enacted.length ? `<div class="box"><h4>이번 분기 시행 정책</h4><ul>${report.enacted.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${report.applied.length ? `<div class="box" style="margin-top:8px"><h4>효과 반영 중인 정책</h4><ul>${report.applied.map(a => `<li>${esc(a.src)} <span class="muted">(${Math.round(a.progress * 100)}%)</span></li>`).join('')}</ul></div>` : ''}
    <div class="two" style="margin-top:8px">
      <div class="box gain"><h4>📈 이득</h4>${gains.length ? `<ul>${gains.map(x => `<li>${x}</li>`).join('')}</ul>` : '<span class="muted">없음</span>'}</div>
      <div class="box loss"><h4>📉 손해</h4>${losses.length ? `<ul>${losses.map(x => `<li>${x}</li>`).join('')}</ul>` : '<span class="muted">없음</span>'}</div>
    </div>
    <h3 class="sec">🚨 발생한 위기와 AI 해결 결과</h3>
    ${recs && recs.length ? recs.map(resolvedCard).join('') : report.pendingCrises ? `<div class="verdict bad">새 위기 ${report.pendingCrises}건이 대통령의 결정을 기다립니다. [위기 대응] 탭을 확인하세요.</div>` : '<div class="empty">이번 분기에는 특별한 위기가 없었습니다.</div>'}
    ${typeof reportExtras === 'function' ? reportExtras(report) : ''}
    <div id="brief-slot">${report.brief ? `<div class="ai-box"><span class="who">🤖 Claude 분기 논평</span>${esc(report.brief)}</div>` : ''}</div>`;
}
function showReportModal(report, recs) {
  if (report.gameOver) return showEnding();
  openModal(`<h2>📊 분기 국정 보고서</h2>${reportHTML(report, recs)}
    <div class="modal-actions">${report.pendingCrises ? `<button class="btn" onclick="closeModal();showTab('crisis')">위기 대응하러 가기</button>` : ''}<button class="btn primary" onclick="closeModal()">다음 분기 국정 운영</button></div>`);
  if (ClaudeAI.enabled() && !report.brief) $('brief-slot').innerHTML = `<div class="ai-box"><span class="spinner"></span>Claude가 분기 논평을 작성하고 있습니다…</div>`;
}
function renderReport() {
  const r = S.reports[0];
  if (!r) { $('report-body').innerHTML = '<div class="empty">첫 분기를 마치면 보고서가 작성됩니다.</div>'; return; }
  const recs = S.resolved.filter(x => (r.resolvedIds || []).includes(x.id));
  $('report-body').innerHTML = `<h2>📊 최근 분기 국정 보고서</h2>${reportHTML(r, recs)}
    <h3 class="sec">지난 보고서</h3>${S.reports.slice(1, 8).map(x => `<div class="log-item"><span class="t">${x.label.year}년 ${x.label.q}분기</span>지지율 ${x.approvalDiff >= 0 ? '+' : ''}${x.approvalDiff.toFixed(1)}%p · 시행 ${x.enacted.length}건 · 위기 ${x.crises.length}건</div>`).join('') || '<span class="muted">없음</span>'}`;
}

/* ---------------- 추이 ---------------- */
function spark(values, color) {
  if (values.length < 2) values = [values[0], values[0]];
  const min = Math.min(...values), max = Math.max(...values), r = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1) * 100).toFixed(2)},${(55 - (v - min) / r * 50).toFixed(2)}`).join(' ');
  return `<svg viewBox="0 0 100 60" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}
function renderTrend() {
  const H = S.history;
  const items = [{ name: '지지율', unit: '%', vals: H.map(h => h.approval), good: 1, dec: 1 },
    ...Object.entries(STATS).map(([k, m]) => ({ name: m.name, unit: m.unit, vals: H.map(h => h.stats[k]), good: m.good, dec: m.dec, k }))];
  $('trend-body').innerHTML = items.map(it => {
    const first = it.vals[0], last = it.vals[it.vals.length - 1], d = last - first;
    const good = it.k === 'infl' ? Math.abs(last - 2) <= Math.abs(first - 2) : d * it.good >= 0;
    return `<div class="tcard"><div class="tt"><span>${it.name}</span><b>${last.toFixed(it.dec)}${it.unit} <span class="delta ${good ? 'good' : 'bad'}">${d >= 0 ? '+' : ''}${d.toFixed(it.dec)}</span></b></div>${spark(it.vals, good ? 'var(--good)' : 'var(--bad)')}</div>`;
  }).join('');
}

function renderLog() {
  $('log-body').innerHTML = S.log.slice(0, 200).map(l => { const t = turnLabel(l.turn); return `<div class="log-item ${l.type}"><span class="t">${t.year}.${t.q}Q</span>${esc(l.text)}</div>`; }).join('');
}

/* ---------------- 엔딩 ---------------- */
function showEnding() {
  const e = S.ending, sc = e.score;
  const changed = allPolicies().filter(p => !currentOption(p, S).cur);
  const H = S.history, first = H[0];
  openModal(`<div class="ending">
    <h2>${e.type === 'term' ? '🎖️ 임기 만료 — 퇴임' : e.type === 'impeach' ? '⚖️ 탄핵' : e.type === 'default' ? '💥 국가 부도' : e.type === 'nuke' ? '☢️ 핵 공격' : e.type === 'defeat' ? '🏳️ 패전' : '🚨 안보 붕괴'}</h2>
    ${e.desc ? `<p class="lead">${esc(e.desc)}</p>` : ''}
    <div class="grade" style="color:${sc.total >= 70 ? 'var(--good)' : sc.total >= 50 ? 'var(--mid)' : 'var(--bad)'}">${sc.grade}</div>
    <h3>${esc(sc.title)}</h3><p class="muted">${esc(sc.desc)}</p>
    <p>종합 ${sc.total.toFixed(1)}점 · 국가지표 ${sc.indexScore.toFixed(1)}점 · 최종 지지율 ${sc.approval.toFixed(1)}%</p></div>
    <div class="rep-grid">${Object.entries(STATS).map(([k, m]) => { let d = S.stats[k] - first.stats[k]; if (Math.abs(d) < Math.pow(10, -m.dec) / 2) d = 0; return `<div class="rep-item">${m.name}<b>${fmtStat(k, S.stats[k])}</b><span class="delta ${deltaClass(k, d)}">${d >= 0 ? '+' : ''}${d.toFixed(m.dec)}</span></div>`; }).join('')}</div>
    <div class="box"><h4>당신이 바꾼 대한민국 (${changed.length}개 제도)</h4>${changed.length ? `<ul>${changed.map(p => `<li>${esc(p.name)}: ${esc(currentOption(p, S).label)}</li>`).join('')}</ul>` : '<span class="muted">아무것도 바꾸지 않았습니다.</span>'}</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">기록 둘러보기</button><button class="btn primary" onclick="restart()">새 게임</button></div>`);
}
function restart() { clearSave(); S = null; closeModal(); $('game').classList.add('hidden'); $('start').classList.remove('hidden'); renderStart(); }

/* ---------------- 설정 ---------------- */
$('btn-settings').onclick = () => {
  const c = ClaudeAI.cfg();
  const host = ClaudeAI.hostMode();
  openModal(`<h2>⚙️ 설정</h2>
    <h3 class="sec">🤖 Claude AI 연동</h3>
    ${host ? `<p class="muted">claude.ai에서 열린 페이지라 <b>API 키 없이 내 Claude 계정</b>으로 실제 Claude가 위기 해결 판단, 직접 입안 정책 분석, 분기 논평, 정책 자문을 수행합니다. 처음 호출할 때 허용 여부를 묻고, 내 Claude 사용량이 쓰입니다.</p>
    <label class="switch"><input type="checkbox" id="cfg-host" ${c.useHost !== false ? 'checked' : ''}><span></span> Claude 사용</label>`
    : `<p class="muted">API 키를 넣으면 실제 Claude가 위기 해결 판단, 직접 입안 정책 분석, 분기 논평, 정책 자문을 수행합니다. 키가 없으면 내장 AI 참모(규칙 기반)가 판단합니다. 키는 이 브라우저(localStorage)에만 저장되고 Anthropic API로만 전송됩니다. API 사용량에 따라 요금이 발생합니다.</p>
    <div class="settings-row"><label for="cfg-key">Anthropic API 키</label><input id="cfg-key" type="password" placeholder="sk-ant-..." value="${esc(c.apiKey || '')}"></div>
    <div class="settings-row"><label for="cfg-model">모델</label><select id="cfg-model">${ClaudeAI.MODELS.map(m => `<option value="${m.id}" ${m.id === c.model ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>
    <div class="settings-row"><label for="cfg-effort">사고 깊이(effort)</label><select id="cfg-effort">${['low', 'medium', 'high'].map(x => `<option ${x === c.effort ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`}
    <div class="modal-actions" style="justify-content:flex-start"><button class="btn" id="cfg-test">연결 테스트</button><span id="cfg-msg" class="muted" style="align-self:center"></span></div>
    <h3 class="sec">게임</h3>
    <div class="modal-actions" style="justify-content:flex-start">
      <button class="btn" id="cfg-theme">🌓 테마 전환</button>
      <button class="btn danger" id="cfg-reset">새 게임 시작(현재 진행 삭제)</button>
    </div>
    <div class="modal-actions"><button class="btn primary" id="cfg-save">저장</button></div>`);
  const read = () => host ? { ...c, useHost: $('cfg-host').checked } : { ...c, apiKey: $('cfg-key').value.trim(), model: $('cfg-model').value, effort: $('cfg-effort').value };
  $('cfg-save').onclick = () => { ClaudeAI.setCfg(read()); closeModal(); renderCrises(); toast(ClaudeAI.enabled() ? '🤖 Claude 연동이 켜졌습니다.' : '내장 AI 참모 모드입니다.'); };
  $('cfg-test').onclick = async () => {
    ClaudeAI.setCfg(read()); $('cfg-msg').innerHTML = '<span class="spinner"></span>확인 중…';
    try { const r = await ClaudeAI.test(); $('cfg-msg').textContent = '✅ 연결 성공: ' + r.slice(0, 30); }
    catch (e) { $('cfg-msg').textContent = '❌ 실패: ' + e.message; }
  };
  $('cfg-theme').onclick = () => {
    const root = document.documentElement; const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    root.dataset.theme = cur === 'light' ? 'dark' : 'light'; try { localStorage.setItem('newkorea_theme', root.dataset.theme); } catch {}
  };
  $('cfg-reset').onclick = e => {
    const b = e.currentTarget;
    if (b.dataset.armed) return restart();
    b.dataset.armed = '1'; b.textContent = '정말 삭제하고 새로 시작합니다 (한 번 더 클릭)';
  };
};

/* ---------------- 초기화 ---------------- */
try { const th = localStorage.getItem('newkorea_theme'); if (th) document.documentElement.dataset.theme = th; } catch {}
renderStart();
ClaudeAI.whenReady(() => { if (S) renderCrises(); });
