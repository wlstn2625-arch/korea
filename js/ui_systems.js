/* =========================================================
 *  확장 시스템 화면: 국회·세력 / 경제 / 외교·전쟁
 * ========================================================= */

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
        <button class="btn sm" data-bill="${b.id}" data-act="lobby" ${b.lobby >= 3 ? 'disabled' : ''}>🤝 야당 협상 ${won(LOBBY_COST)}</button>
        <button class="btn sm" data-bill="${b.id}" data-act="fast" ${b.fast ? 'disabled' : ''}>⏩ 신속처리 지정 ${won(20)}</button>
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
      <div>${inC ? `<button class="btn sm ghost" data-leave="${k}">연합 제외</button>` : `<button class="btn sm" data-join="${k}" ${cj.ok ? '' : `disabled title="${esc(cj.why)}"`}>연합 영입 ${won(joinCost(S, k))}</button>`}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div id="dom-slot"></div>
    <h3 class="sec">👥 국정 연합</h3>
    <div class="sys-head">
      <div class="big-kpi"><span>국정 정당성</span><b style="color:${L >= 50 ? 'var(--good)' : L >= 35 ? 'var(--mid)' : 'var(--bad)'}">${L.toFixed(0)}%</b><small>연합 세력 영향력 합계</small></div>
      <div class="big-kpi"><span>국정 효율(수입 보정)</span><b>${S.pcapBonus >= 0 ? '+' : ''}${(S.pcapBonus || 0).toFixed(1)}</b><small>분기당 (정당성·마찰·충성)</small></div>
      <div class="big-kpi"><span>연합 내 마찰</span><b>${fr.length}</b><small>${fr.map(([a, b]) => FACTIONS[a].name + '↔' + FACTIONS[b].name).join(', ') || '없음'}</small></div>
    </div>
    <p class="muted">국정 연합에 든 세력은 자기에게 유리한 법안에 찬성표를 몰아주고(불리하면 반대), 정당성이 높을수록 국정 운영 효율이 올라 국고 수입이 늘어납니다. 지지도가 30 아래로 떨어진 연합 세력은 이탈할 수 있고, 20 아래인 세력은 급진화해 집단행동에 나섭니다.</p>
    <h3 class="sec">🏛️ 국회 계류 법안 (${S.bills.length})</h3>${bills}
    <h3 class="sec">👥 이익집단</h3><div class="grp-list">${groups}</div>`;
  if (typeof renderDomestic === 'function') renderDomestic();
  el.querySelectorAll('[data-bill]').forEach(b => b.onclick = () => act(billAction)(S, b.dataset.bill, b.dataset.act));
  el.querySelectorAll('[data-join]').forEach(b => b.onclick = () => act(joinCoalition)(S, b.dataset.join));
  el.querySelectorAll('[data-leave]').forEach(b => b.onclick = () => { leaveCoalition(S, b.dataset.leave); saveGame(S); renderAll(); });
}

/* ---------------- 경제 ---------------- */
function renderEconomy() {
  const el = $('tab-economy'); if (!el) return;
  const B = budgetIncome(S);
  const row = (label, v, hint) => `<div class="brow"><span>${label}${hint ? ` <small class="muted">${hint}</small>` : ''}</span><b class="${v >= 0 ? 'good-t' : 'bad-t'}">${v >= 0 ? '+' : '−'}${won(Math.abs(v))}</b></div>`;
  const ftaN = Object.values(S.diplo || {}).filter(d => d.fta).length;
  const cards = SECTORS.map(x => {
    const sec = S.sectors[x.id], g = sec.g, lv = S.buildings[x.id] || 0, building = S.construction.filter(c => c.id === x.id);
    const color = g >= x.base + 0.5 ? 'var(--good)' : g <= x.base - 0.5 ? 'var(--bad)' : 'var(--text)';
    const cost = buildCost(S, x.id), full = lv + building.length >= BUILD_MAX;
    return `<div class="fac">
      <div class="fac-top"><span class="fac-ic">${x.icon}</span><div><b>${x.name}</b><div class="muted small">GDP ${x.share}% · 고용 ${x.emp}%</div></div>
        <div class="fac-g" style="color:${color}">${g >= 0 ? '+' : ''}${g.toFixed(1)}%</div></div>
      <div class="fac-lv">${[...Array(BUILD_MAX)].map((_, i) => `<i class="${i < lv ? 'on' : i < lv + building.length ? 'wip' : ''}"></i>`).join('')}<span class="muted small">시설 ${lv}단계${building.length ? ` · 공사 중(${building[0].left}분기)` : ''}</span></div>
      <div class="fac-spark">${spark(sec.hist, color)}</div>
      <button class="btn sm ${full ? '' : 'primary'}" data-build="${x.id}" ${full || S.pcap < cost ? 'disabled' : ''}>${full ? '최대 단계' : `🏗️ 공장 건설 ${won(cost)}`}</button>
    </div>`;
  }).join('');
  const fin = FINANCE_ACTIONS.map(a => { const cd = (S.finCd?.[a.id] || 0) > S.turn; return `<button class="pact" data-fin="${a.id}" ${cd ? 'disabled' : ''} title="${esc(a.desc)}"><span class="pi">${a.icon}</span><b>${a.name}</b><small>${cd ? `${S.finCd[a.id] - S.turn}분기 후` : esc(a.desc)}</small></button>`; }).join('');
  el.innerHTML = `
    <div class="treasury">
      <div class="tr-main"><span>💰 국고</span><b>${won(S.pcap)}</b><small>분기 순수입 <b class="${B.total >= 0 ? 'good-t' : 'bad-t'}">${B.total >= 0 ? '+' : '−'}${won(Math.abs(B.total))}</b></small></div>
      <div class="tr-rows">
        ${row('🧾 세수', B.tax, `세율 수준 ${Math.round(taxLevel(S) * 100)}% · 성장률 연동`)}
        ${row('🚢 무역 이익', B.trade, `FTA ${ftaN}개국`)}
        ${row('🏭 산업 수익', B.industry, `시설 ${Object.values(S.buildings).reduce((a, b) => a + b, 0)}단계`)}
        ${B.annexed ? row('🚩 편입 지역', B.annexed) : ''}
        ${row('🏛️ 국정 효율', B.admin, '지지율·국정 연합')}
        ${row('🏦 국채 이자', B.interest, `채무비율 ${S.stats.debt.toFixed(1)}%`)}
        ${B.war ? row('⚔️ 전쟁 비용', B.war) : ''}${B.imf ? row('🆘 IMF 상환', B.imf) : ''}
      </div>
    </div>
    <h3 class="sec">💵 재원 마련</h3><div class="pacts">${fin}</div>
    <h3 class="sec">🏭 산업 시설 <span class="muted small">공장을 지으면 그 산업의 성장률(+0.6%p/단계)과 국고 수입(+${won(12)}/분기)이 오르고 일자리가 늘어납니다. 동시 공사 3곳.</span></h3>
    <div class="fac-grid">${cards}</div>
    <div class="sys-head" style="margin-top:12px">
      <div class="big-kpi"><span>경제성장률</span><b>${fmtStat('gdp', S.stats.gdp)}</b><small>산업 구조 기여 ${(S.econDelta || 0) >= 0 ? '+' : ''}${(S.econDelta || 0).toFixed(2)}%p</small></div>
      <div class="big-kpi"><span>실업률</span><b>${fmtStat('unemp', S.stats.unemp)}</b><small>산업 고용 기여 ${(S.econUnemp || 0) >= 0 ? '+' : ''}${(S.econUnemp || 0).toFixed(2)}%p</small></div>
    </div>`;
  el.querySelectorAll('[data-build]').forEach(b => b.onclick = () => act(buildFactory)(S, b.dataset.build));
  el.querySelectorAll('[data-fin]').forEach(b => b.onclick = () => act(financeAction)(S, b.dataset.fin));
}

/* 분기 보고서 추가 항목 */
function reportExtras(report) {
  const out = [];
  if (report.bills?.length) out.push(`<div class="box" style="margin-top:8px"><h4>🏛️ 국회 심의</h4><ul>${report.bills.map(b => `<li>${esc(b.name)} — ${esc(b.label)}: ${b.result === 'passed' ? '<b class="good-t">본회의 통과</b>' : b.result === 'failed' ? '<b class="bad-t">본회의 부결</b>' : b.result === 'expired' ? '<b class="bad-t">폐기</b>' : `${esc(b.stage)} ${Math.round(b.progress)}%`}${b.ev ? ` <span class="muted">(${esc(b.ev)})</span>` : ''}</li>`).join('')}</ul></div>`);
  const pol = report.politics;
  if (pol && (pol.left.length || pol.radical.length)) out.push(`<div class="verdict bad">${pol.left.length ? `연합 이탈: ${pol.left.map(esc).join(', ')}. ` : ''}${pol.radical.length ? `급진화 세력: ${pol.radical.map(esc).join(', ')}` : ''}</div>`);
  const w = report.world;
  if (w && (w.war || w.events.length)) out.push(`<div class="box" style="margin-top:8px"><h4>🌏 외교·안보</h4><ul>${[w.war, ...w.events].filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`);
  const wn = (report.worldNews || []).filter(n => n.type !== 'info' || /관세|침공|병합|휴전|G20|지원/.test(n.text)).slice(0, 8);
  if (wn.length) out.push(`<div class="box" style="margin-top:8px"><h4>🌐 세계 뉴스</h4><ul>${wn.map(n => `<li>${esc(n.text)}</li>`).join('')}</ul></div>`);
  return out.join('');
}
