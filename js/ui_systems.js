/* =========================================================
 *  확장 시스템 화면: 국회·세력 / 경제 / 외교·전쟁
 * ========================================================= */
let selCountry = 'nk';

function renderSystemsTabs() {
  if (!S) return;
  renderPolitics(); renderEconomy(); renderWorld();
  const wb = $('war-badge'); if (wb) wb.classList.toggle('hidden', !S.war);
  const bb = $('bill-badge'); if (bb) { bb.textContent = S.bills.length; bb.classList.toggle('hidden', !S.bills.length); }
}

const pbar = (v, color, max = 100) => `<div class="bar"><i style="width:${clamp(v / max * 100, 0, 100)}%;background:${color}"></i></div>`;
function act(fn) { return (...a) => { const r = fn(...a); if (r && r.ok === false) toast(esc(r.msg || r.why)); else if (r && r.msg) toast(esc(r.msg), 3500); saveGame(S); renderAll(); return r; }; }

/* ---------------- 국회·세력 ---------------- */
function renderPolitics() {
  const el = $('tab-politics'); if (!el) return;
  const L = legitimacy(S), fr = coalitionFriction(S);
  const bills = S.bills.map(b => {
    const p = policyById(b.pid, S), o = optionOf(p, b.oid);
    const prob = voteModel(S, o, b.lobby).prob, left = Math.max(0, Math.ceil((100 - b.progress) / billSpeed(S, b)));
    return `<div class="bill">
      <div class="bill-top"><b>${esc(p.name)}</b> → ${esc(o.label)} <span class="tag ${b.lt}">${b.lt === 'const' ? '개헌안' : '법률안'}</span>${b.fast ? '<span class="tag new">신속처리</span>' : ''}${b.lobby ? `<span class="tag">협상 ${b.lobby}단계</span>` : ''}</div>
      <div class="bill-stage">${esc(billStage(b))} · ${b.turns}분기째 · 남은 기간 약 ${left}분기 · 본회의 통과 가능성 <b>${Math.round(prob * 100)}%</b></div>
      ${pbar(b.progress, 'var(--accent)')}
      ${b.log.length ? `<div class="muted small">${esc(b.log[b.log.length - 1])}</div>` : ''}
      <div class="row-btns">
        <button class="btn sm" data-bill="${b.id}" data-act="lobby" ${b.lobby >= 3 ? 'disabled' : ''}>🤝 야당 협상 ⚡${LOBBY_COST}</button>
        <button class="btn sm" data-bill="${b.id}" data-act="fast" ${b.fast ? 'disabled' : ''}>⏩ 신속처리 지정 ⚡20</button>
        <button class="btn sm ghost" data-bill="${b.id}" data-act="withdraw">↩️ 철회</button>
      </div></div>`;
  }).join('') || '<div class="empty">국회에 계류 중인 법안이 없습니다. 법률·개헌 정책을 추진하면 이곳에서 심의가 진행됩니다.</div>';

  const groups = Object.entries(FACTIONS).sort((a, b) => S.clout[b[0]] - S.clout[a[0]]).map(([k, f]) => {
    const inC = S.coalition.includes(k), sup = S.factions[k], cl = S.clout[k];
    const chips = [inC ? '<span class="tag cur">국정 연합</span>' : '', S.radical?.includes(k) ? '<span class="tag const">급진화</span>' : '', inC && sup >= 70 ? '<span class="tag new">충성</span>' : '', inC && sup < 30 ? '<span class="tag const">이탈 위기</span>' : ''].join('');
    const cj = canJoin(S, k);
    return `<div class="grp">
      <div class="grp-name">${f.icon} <b>${f.name}</b> ${chips}</div>
      <div class="grp-bars"><span class="muted small">영향력 ${cl.toFixed(1)}%</span>${pbar(cl, 'var(--accent)', 25)}<span class="muted small">지지도 ${sup.toFixed(0)}</span>${pbar(sup, sup >= 60 ? 'var(--good)' : sup >= 35 ? 'var(--mid)' : 'var(--bad)')}</div>
      <div>${inC ? `<button class="btn sm ghost" data-leave="${k}">연합 제외</button>` : `<button class="btn sm" data-join="${k}" ${cj.ok ? '' : `disabled title="${esc(cj.why)}"`}>연합 영입 ⚡${joinCost(S, k)}</button>`}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="sys-head">
      <div class="big-kpi"><span>국정 정당성</span><b style="color:${L >= 50 ? 'var(--good)' : L >= 35 ? 'var(--mid)' : 'var(--bad)'}">${L.toFixed(0)}%</b><small>연합 세력 영향력 합계</small></div>
      <div class="big-kpi"><span>정치자본 보정</span><b>${S.pcapBonus >= 0 ? '+' : ''}${(S.pcapBonus || 0).toFixed(1)}</b><small>분기당 (정당성·마찰·충성)</small></div>
      <div class="big-kpi"><span>연합 내 마찰</span><b>${fr.length}</b><small>${fr.map(([a, b]) => FACTIONS[a].name + '↔' + FACTIONS[b].name).join(', ') || '없음'}</small></div>
    </div>
    <p class="muted">국정 연합에 든 세력은 자기에게 유리한 법안에 찬성표를 몰아주고(불리하면 반대), 정당성이 높을수록 정치자본이 더 많이 회복됩니다. 지지도가 30 아래로 떨어진 연합 세력은 이탈할 수 있고, 20 아래인 세력은 급진화해 집단행동에 나섭니다.</p>
    <h3 class="sec">🏛️ 국회 계류 법안 (${S.bills.length})</h3>${bills}
    <h3 class="sec">👥 이익집단</h3><div class="grp-list">${groups}</div>`;
  el.querySelectorAll('[data-bill]').forEach(b => b.onclick = () => act(billAction)(S, b.dataset.bill, b.dataset.act));
  el.querySelectorAll('[data-join]').forEach(b => b.onclick = () => act(joinCoalition)(S, b.dataset.join));
  el.querySelectorAll('[data-leave]').forEach(b => b.onclick = () => { leaveCoalition(S, b.dataset.leave); saveGame(S); renderAll(); });
}

/* ---------------- 경제 ---------------- */
function renderEconomy() {
  const el = $('tab-economy'); if (!el) return;
  const rows = SECTORS.map(x => {
    const sec = S.sectors[x.id], g = sec.g, inv = S.sectorInvest.find(i => i.id === x.id);
    const color = g >= x.base + 0.5 ? 'var(--good)' : g <= x.base - 0.5 ? 'var(--bad)' : 'var(--text)';
    return `<tr>
      <td>${x.icon} <b>${x.name}</b></td>
      <td class="num">${x.share}%</td><td class="num">${x.emp}%</td>
      <td class="num" style="color:${color}">${g >= 0 ? '+' : ''}${g.toFixed(1)}%</td>
      <td class="num">${sec.idx.toFixed(1)}</td>
      <td class="spark-cell">${spark(sec.hist, color)}</td>
      <td>${inv ? `<span class="tag new">육성 중 ${inv.left}분기</span>` : `<button class="btn sm" data-invest="${x.id}">집중 육성 ⚡${INVEST_COST}</button>`}</td>
    </tr>`;
  }).join('');
  const contrib = S.econDelta || 0;
  el.innerHTML = `
    <div class="sys-head">
      <div class="big-kpi"><span>경제성장률</span><b>${fmtStat('gdp', S.stats.gdp)}</b><small>산업 구조 기여 ${contrib >= 0 ? '+' : ''}${contrib.toFixed(2)}%p</small></div>
      <div class="big-kpi"><span>실업률</span><b>${fmtStat('unemp', S.stats.unemp)}</b><small>산업 고용 기여 ${(S.econUnemp || 0) >= 0 ? '+' : ''}${(S.econUnemp || 0).toFixed(2)}%p</small></div>
      <div class="big-kpi"><span>집중 육성</span><b>${S.sectorInvest.length}/3</b><small>8분기간 성장률 +2.5%p, 재정 부담</small></div>
    </div>
    <p class="muted">각 산업의 성장률은 산업 경쟁력·외교관계·제도 변화에 따라 달라지고, 비중만큼 GDP 성장률과 고용에 반영됩니다. 예: 반도체는 미·중 관계와 반도체 지원책, 건설은 주택 공급·대출 규제, 농어업은 FTA·CPTPP에 민감합니다.</p>
    <div class="table-wrap"><table class="sector">
      <thead><tr><th>산업</th><th>GDP 비중</th><th>고용 비중</th><th>성장률(연)</th><th>규모 지수</th><th>추이</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  el.querySelectorAll('[data-invest]').forEach(b => b.onclick = () => act(investSector)(S, b.dataset.invest));
}

/* ---------------- 외교·전쟁 ---------------- */
function renderWorld() {
  const el = $('tab-world'); if (!el) return;
  const krPos = [60, 46];
  const relColor = v => v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--accent)' : v >= 25 ? 'var(--mid)' : 'var(--bad)';
  const lines = Object.entries(COUNTRIES).map(([k, c]) => {
    if (S.annexed[k]) return '';
    const d = S.diplo[k], atWar = S.war && (S.war.k === k || S.war.enemyAllies.includes(k));
    const color = atWar ? 'var(--bad)' : d.alliance ? 'var(--good)' : relColor(S.rel[k]);
    return `<line x1="${krPos[0]}" y1="${krPos[1]}" x2="${c.pos[0]}" y2="${c.pos[1]}" stroke="${color}" stroke-width="${d.alliance || atWar ? 0.9 : 0.4}" ${d.alliance || atWar ? '' : 'stroke-dasharray="1.5 1.5"'} opacity="0.8"/>`;
  }).join('');
  const tiles = Object.entries(COUNTRIES).map(([k, c]) => {
    const r = RELATIONS[k], d = S.diplo[k], an = S.annexed[k];
    const atWar = S.war && (S.war.k === k || S.war.enemyAllies.includes(k));
    const ally = S.war && S.war.allies.includes(k);
    return `<button class="ctile ${selCountry === k ? 'sel' : ''} ${atWar ? 'war' : ''} ${an ? 'annexed' : ''}" style="left:${c.pos[0]}%;top:${c.pos[1]}%" data-c="${k}">
      <span class="cflag">${r.flag}</span><span class="cname">${r.name}</span>
      ${an ? '<span class="cstat">🇰🇷 합병</span>' : `<span class="crel" style="color:${relColor(S.rel[k])}">${S.rel[k].toFixed(0)}</span>`}
      <span class="cicons">${d.alliance ? '🛡️' : ''}${d.fta ? '📦' : ''}${d.sanction ? '🚫' : ''}${atWar ? '⚔️' : ''}${ally ? '🤝' : ''}${c.nukes ? '☢️' : ''}</span>
    </button>`;
  }).join('');
  const kr = `<div class="ctile kr" style="left:${krPos[0]}%;top:${krPos[1]}%"><span class="cflag">🇰🇷</span><span class="cname">대한민국</span><span class="crel">군사력 ${milPower(S).toFixed(0)}</span></div>`;

  const k = selCountry, c = COUNTRIES[k], d = S.diplo[k];
  const odds = !c.far && !S.annexed[k] ? (() => { const o = warOdds(S, k); const allies = warAllies(S, k, 'kr'), en = warAllies(S, k, 'them');
    return `<div class="box"><h4>⚔️ 전쟁 시뮬레이션</h4>우리 편: ${['대한민국', ...allies.map(x => RELATIONS[x].name)].join(', ')} (전력 ${o.ours.toFixed(0)})<br>상대 편: ${[RELATIONS[k].name, ...en.map(x => RELATIONS[x].name)].join(', ')} (전력 ${o.theirs.toFixed(0)})<br>
      판정: <b style="color:${o.edge > 0.15 ? 'var(--good)' : o.edge > -0.05 ? 'var(--mid)' : 'var(--bad)'}">${o.edge > 0.25 ? '압도적 우세' : o.edge > 0.1 ? '우세' : o.edge > -0.05 ? '팽팽함' : o.edge > -0.2 ? '열세' : '절대 열세'}</b>${(c.nukes || en.some(x => COUNTRIES[x].nukes)) ? ' · ☢️ 상대 진영 핵보유: 몰리면 핵 사용 위험' : ''}</div>`; })() : '';
  const actions = S.annexed[k] ? '<div class="empty">합병된 지역입니다.</div>' : DIPLO_ACTIONS.map(a => {
    const why = a.can(S, k), cost = diploCost(S, a, k);
    return `<div class="dact ${why ? 'off' : ''}"><div><b>${a.icon} ${a.name}</b> <span class="tag">⚡${cost}</span><div class="muted small">${esc(why || a.desc)}</div></div>
      <button class="btn sm ${a.id === 'war' ? 'danger' : ''}" data-dact="${a.id}" ${why ? 'disabled' : ''}>실행</button></div>`;
  }).join('');

  const w = S.war;
  const warPanel = w ? `<div class="warbox">
    <h3>⚔️ 전쟁 중: ${RELATIONS[w.k].name} (${w.turns}분기째) · 목표 ${GOAL_NAMES[w.goal]}</h3>
    <div class="warbar"><i style="left:${50 + w.score / 2}%"></i><span>패전 -100</span><span>0</span><span>승리 +100</span></div>
    <div>전황 점수 <b>${w.score.toFixed(0)}</b> · 우리 편 ${['대한민국', ...w.allies.map(x => RELATIONS[x].name)].join(', ')} · 상대 편 ${[RELATIONS[w.k].name, ...w.enemyAllies.map(x => RELATIONS[x].name)].join(', ')}</div>
    <div class="muted small">분기마다 성장률·행복도·재정이 깎이고 채무가 늘어납니다. 8분기가 지나면 국제 중재로 정전됩니다.${nukeRisk(S) > 0 ? ` <b style="color:var(--bad)">☢️ 핵 사용 위험 분기당 ${(nukeRisk(S) * 100).toFixed(1)}%</b>` : ''}</div>
    ${w.log.length ? `<div class="muted small">${esc(w.log[w.log.length - 1])}</div>` : ''}
    <div class="row-btns"><button class="btn sm danger" data-war="offensive">🎖️ 총공세 ⚡15</button><button class="btn sm" data-war="peace">🕊️ 휴전·강화 제안</button></div>
  </div>` : '';

  el.innerHTML = `${warPanel}
    <div class="world-grid">
      <div class="map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" class="map-lines">${lines}</svg>${tiles}${kr}
        <div class="map-legend">🛡️동맹 📦FTA 🚫제재 ⚔️전쟁 ☢️핵보유 · 숫자=관계</div></div>
      <div class="cpanel">
        <h3>${RELATIONS[k].flag} ${RELATIONS[k].name}</h3>
        <div class="muted small">${esc(c.note)} · 인구 ${c.pop}</div>
        <div class="cfacts"><span>관계 <b>${S.rel[k].toFixed(0)}</b></span><span>군사력 <b>${c.mil}</b></span><span>경제 규모 <b>${c.eco}</b></span><span>${c.nukes ? '☢️ 핵보유' : '비핵'}</span></div>
        <div class="cfacts">${d.alliance ? '<span class="tag cur">동맹</span>' : ''}${d.fta ? '<span class="tag">FTA</span>' : ''}${d.sanction ? '<span class="tag const">제재 중</span>' : ''}${d.casusBelli >= S.turn ? '<span class="tag const">전쟁 명분</span>' : ''}${d.offer >= S.turn ? '<span class="tag new">FTA 제안 받음</span>' : ''}</div>
        ${odds}
        <h4 class="sec">외교 행동</h4><div class="dacts">${actions}</div>
      </div>
    </div>`;
  el.querySelectorAll('.ctile[data-c]').forEach(b => b.onclick = () => { selCountry = b.dataset.c; renderWorld(); });
  el.querySelectorAll('[data-dact]').forEach(b => b.onclick = () => {
    if (b.dataset.dact === 'war') return confirmWar(k);
    act(diploAction)(S, b.dataset.dact, k);
  });
  el.querySelectorAll('[data-war]').forEach(b => b.onclick = () => act(warAction)(S, b.dataset.war));
}

function confirmWar(k) {
  const c = COUNTRIES[k], o = warOdds(S, k);
  const goals = k === 'nk' ? ['unify', 'concession'] : c.annex ? ['annex', 'concession'] : ['concession'];
  openModal(`<h2>⚔️ ${RELATIONS[k].name}에 선전포고</h2>
    <p class="lead">전력 비교: 우리 편 ${o.ours.toFixed(0)} vs 상대 편 ${o.theirs.toFixed(0)}. 침략 전쟁은 국제 사회의 강한 반발(미국·EU·중국 관계 하락)을 부릅니다. 전쟁 중에는 매 분기 경제·행복도·재정이 타격을 입습니다.${c.nukes ? ' 상대는 핵보유국입니다. 몰리면 핵을 쓸 수 있습니다.' : ''}</p>
    <h3 class="sec">전쟁 목표</h3>
    ${goals.map(g => `<button class="btn ${g === 'concession' ? '' : 'danger'}" data-goal="${g}" style="margin:4px">${GOAL_NAMES[g]}${g === 'concession' ? ' (배상금·경제 이권)' : g === 'unify' ? ' (승리 시 한반도 통일)' : ' (승리 시 영토 편입)'}</button>`).join('')}
    <div class="modal-actions"><button class="btn" onclick="closeModal()">취소</button></div>`);
  document.querySelectorAll('[data-goal]').forEach(b => b.onclick = () => { closeModal(); act(diploAction)(S, 'war', k, b.dataset.goal); });
}

/* 분기 보고서 추가 항목 */
function reportExtras(report) {
  const out = [];
  if (report.bills?.length) out.push(`<div class="box" style="margin-top:8px"><h4>🏛️ 국회 심의</h4><ul>${report.bills.map(b => `<li>${esc(b.name)} — ${esc(b.label)}: ${b.result === 'passed' ? '<b class="good-t">본회의 통과</b>' : b.result === 'failed' ? '<b class="bad-t">본회의 부결</b>' : b.result === 'expired' ? '<b class="bad-t">폐기</b>' : `${esc(b.stage)} ${Math.round(b.progress)}%`}${b.ev ? ` <span class="muted">(${esc(b.ev)})</span>` : ''}</li>`).join('')}</ul></div>`);
  const pol = report.politics;
  if (pol && (pol.left.length || pol.radical.length)) out.push(`<div class="verdict bad">${pol.left.length ? `연합 이탈: ${pol.left.map(esc).join(', ')}. ` : ''}${pol.radical.length ? `급진화 세력: ${pol.radical.map(esc).join(', ')}` : ''}</div>`);
  const w = report.world;
  if (w && (w.war || w.events.length)) out.push(`<div class="box" style="margin-top:8px"><h4>🌏 외교·안보</h4><ul>${[w.war, ...w.events].filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`);
  return out.join('');
}
