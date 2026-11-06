/* =========================================================
 *  AI 참모 조언: 지표마다 "왜 이런가"와 "어떻게 올리고 내릴까"
 *  - 상단 자원 칸을 누르면 열림
 *  - 지표가 위험해지면 알림(💡)과 분기 결산 카드로 먼저 유도
 *  - 추천 행동은 버튼 하나로 바로 실행하거나 해당 화면으로 이동
 * ========================================================= */

// 정책 가운데 목표 지표를 가장 잘 움직이는 것 (전체 손익이 크게 나쁘지 않은 것만)
function topPolicies(s, scoreFn, n = 3) {
  const out = [];
  for (const p of allPolicies()) {
    if ((s.bills || []).some(b => b.pid === p.id) || (typeof policyLocked === 'function' && policyLocked(s, p))) continue;
    for (const o of p.options) {
      if (o.id === s.policies[p.id] || o.cur) continue;
      let pv; try { pv = previewPolicy(s, p, o); } catch { continue; }
      const sc = scoreFn(pv.diff, pv);
      if (sc > 0.01 && pv.net > -3) out.push({ p, o, sc, pv });
    }
  }
  return out.sort((a, b) => (b.sc + b.pv.net * 0.02) - (a.sc + a.pv.net * 0.02)).slice(0, n);
}
const polRec = (r, what) => ({ icon: '📜', label: `${r.p.name} → ${r.o.label}`, desc: `${what} · 대가: ${r.pv.losses.slice(0, 2).map(x => x.name).join('·') || '거의 없음'} · 국회 통과 ${Math.round(r.pv.vote.prob * 100)}%`, go: () => { closeModal(); openPreview(r.p.id, r.o.id); } });
const polActRec = id => { const a = POL_ACTIONS.find(x => x.id === id); return { icon: a.icon, label: a.name, desc: a.desc, cost: a.pc, run: () => polAction(S, id) }; };
const finRec = id => { const a = FINANCE_ACTIONS.find(x => x.id === id); return { icon: a.icon, label: a.name, desc: a.desc, cost: a.cost, run: () => financeAction(S, id) }; };
function bestFactory(s) {
  const busy = id => (s.buildings?.[id] || 0) + (s.construction || []).filter(c => c.id === id).length;
  const x = [...SECTORS].filter(z => busy(z.id) < BUILD_MAX).sort((a, b) => b.share * Math.max(0.5, b.base) - a.share * Math.max(0.5, a.base))[0];
  return x && { icon: '🏭', label: `${x.name} 공장 건설`, desc: `GDP 비중 ${x.share}%로 가장 큰 산업. 성장률·국고 수입이 함께 오릅니다.`, cost: buildCost(s, x.id), run: () => buildFactory(S, x.id) };
}
function ftaRecs(s, n = 2) {
  const a = DIPLO_ACTIONS.find(x => x.id === 'fta');
  return allCountryKeys().filter(k => cinfo(k) && !cinfo(k).isBloc || k === 'eu').filter(k => { try { return !a.can(s, k) && !s.annexed[k]; } catch { return false; } })
    .sort((x, y) => cinfo(y).eco - cinfo(x).eco).slice(0, n)
    .map(k => ({ icon: '📦', label: `${cflag(k)} ${cname(k)}과(와) FTA`, desc: '무역 이익으로 성장률과 국고 수입이 오릅니다. 농어민은 반발합니다.', cost: diploCost(s, a, k), run: () => diploAction(S, 'fta', k) }));
}

const ADVICE = {
  appr: {
    name: '지지율', icon: '📣', value: s => `${s.approval.toFixed(1)}%`,
    level: s => s.approval < 30 ? 'bad' : s.approval < 42 ? 'mid' : 'good',
    explain: '지지율은 12개 사회 세력의 지지(인구 비중만큼)와 국민 행복도·성장률·실업·물가로 정해지고, 임기 3년차부터는 레임덕으로 조금씩 깎입니다. 30% 아래로 떨어지면 탄핵 위험이 생깁니다.',
    factors: s => {
      const f = Object.entries(FACTIONS).map(([k, v]) => ({ k, v, val: s.factions[k], w: v.pop })).sort((a, b) => (a.val - 50) * a.w - (b.val - 50) * b.w);
      return [
        ...f.slice(0, 3).map(x => ({ t: `${x.v.icon} ${x.v.name} 지지 ${x.val.toFixed(0)}`, good: x.val >= 50, note: `인구 비중 ${(x.w * 100).toFixed(0)}%` })),
        { t: `행복도 ${s.stats.happiness.toFixed(0)}`, good: s.stats.happiness >= 42 },
        { t: `실업률 ${s.stats.unemp.toFixed(1)}% · 물가 ${s.stats.infl.toFixed(1)}%`, good: s.stats.unemp < 3.2 && s.stats.infl < 3 },
        { t: `임기 ${termInfo(s).year}년차${termInfo(s).year >= 4 ? ' (레임덕)' : ''}`, good: termInfo(s).year < 4 },
      ];
    },
    actions: s => {
      const worst = Object.entries(FACTIONS).sort((a, b) => (s.factions[a[0]] - 50) * a[1].pop - (s.factions[b[0]] - 50) * b[1].pop)[0];
      return [polActRec('speech'), polActRec('tour'), s.dom?.scandal > 15 ? polActRec('reshuffle') : null,
        ...topPolicies(s, d => approvalDeltaFromFactions(d.f || {}) + (d.e.happiness || 0) * 0.3, 2).map(r => polRec(r, `지지율 약 ${(approvalDeltaFromFactions(r.pv.diff.f || {}) + (r.pv.diff.e.happiness || 0) * 0.3).toFixed(1)}%p`)),
        ...topPolicies(s, d => (d.f || {})[worst[0]] || 0, 1).map(r => polRec(r, `가장 불만이 큰 ${worst[1].name} 지지 +${(r.pv.diff.f[worst[0]] || 0).toFixed(0)}`)),
      ].filter(Boolean);
    } },
  pcap: {
    name: '국고', icon: '💰', value: s => won(s.pcap),
    level: s => s.pcap < 15 ? 'bad' : s.pcap < 40 ? 'mid' : 'good',
    explain: '국고는 매 분기 세수·무역 이익·산업 수익·국정 효율에서 들어오고, 국채 이자·전쟁으로 나갑니다. 정책·외교·전쟁·공장에 씁니다. 바닥나면 적자 국채가 자동으로 발행돼 나랏빚이 늘어납니다.',
    factors: s => { const b = budgetIncome(s); return [
      { t: `분기 순수입 ${won(b.total)}`, good: b.total > 20 },
      { t: `세수 ${won(b.tax)} (세율·성장률)`, good: true }, { t: `무역 이익 ${won(b.trade)} (FTA)`, good: b.trade > 5 },
      { t: `산업 수익 ${won(b.industry)} (공장)`, good: b.industry > 6 }, { t: `국채 이자 ${won(b.interest)}`, good: b.interest > -3 },
      ...(b.war ? [{ t: `전쟁 비용 ${won(b.war)}`, good: false }] : []),
    ]; },
    actions: s => [bestFactory(s), ...ftaRecs(s), s.pcap < 30 ? finRec('levy') : null, s.pcap < 30 ? finRec('sell') : null].filter(Boolean) },
  seats: {
    name: '여당 의석', icon: '🏛️', value: s => `${rulingSeats(s)}/300`,
    level: s => rulingSeats(s) < 120 ? 'bad' : rulingSeats(s) < 151 ? 'mid' : 'good',
    explain: '의석은 4년마다 총선에서 지지율과 선거 지원으로 정해집니다. 그 사이에는 당 장악력이 낮으면 탈당으로 줄어듭니다. 과반(151)이면 법률, 2/3(200)이면 개헌 표결이 쉬워집니다. 의석이 모자라면 야당 협조도와 국정 연합으로 표를 채우세요.',
    factors: s => { const e = nextElections(s).find(x => /총선/.test(x.name)); return [
      { t: `다음 총선 ${e ? (e.left ? `${e.left}분기 뒤` : '이번 분기') : '-'}`, good: true },
      { t: `지지율 ${s.approval.toFixed(0)}% (총선 득표를 좌우)`, good: s.approval >= 45 },
      { t: `당 장악력 ${s.dom.unity.toFixed(0)} (낮으면 이탈표·탈당)`, good: s.dom.unity >= 50 },
      { t: `야당 협조도 ${s.dom.oppMood.toFixed(0)}`, good: s.dom.oppMood >= 45 },
    ]; },
    actions: s => [polActRec('campaign'), polActRec('party'), polActRec('summit'), { icon: '👥', label: '국정 연합 정비', desc: '세력을 연합에 넣으면 법안 표결에 힘이 실립니다.', go: () => { closeModal(); showTab('politics'); } }] },
  gdp: {
    name: '성장률', icon: '📈', value: s => `${s.stats.gdp.toFixed(1)}%`,
    level: s => s.stats.gdp < 0.8 ? 'bad' : s.stats.gdp < 1.8 ? 'mid' : 'good',
    explain: '성장률은 12개 산업의 성장을 합친 값입니다. 공장, FTA, 혁신, 주요국 관계가 끌어올리고, 국가채무 90% 초과, 세계 긴장, 전쟁, 일부 규제는 끌어내립니다. 정책 효과는 몇 분기에 걸쳐 나타납니다.',
    factors: s => [
      { t: `혁신 지수 ${s.stats.innovation.toFixed(0)}`, good: s.stats.innovation >= 72 },
      { t: `FTA ${Object.values(s.diplo || {}).filter(d => d.fta).length}건`, good: true },
      { t: `국가채무 ${s.stats.debt.toFixed(0)}%${s.stats.debt > 90 ? ' (성장을 갉아먹는 중)' : ''}`, good: s.stats.debt <= 90 },
      { t: `세계 긴장도 ${s.world?.tension.toFixed(0)}${s.world?.tension > 65 ? ' (경기 위축)' : ''}`, good: (s.world?.tension || 0) <= 65 },
      ...(s.war ? [{ t: '전쟁 중', good: false }] : []),
    ],
    actions: s => [bestFactory(s), ...ftaRecs(s, 1), ...topPolicies(s, d => d.e.gdp || 0, 3).map(r => polRec(r, `성장률 +${(r.pv.diff.e.gdp || 0).toFixed(2)}%p`))].filter(Boolean) },
  debt: {
    name: '국가채무비율', icon: '🏦', value: s => `${s.stats.debt.toFixed(1)}%`,
    level: s => s.stats.debt > 100 ? 'bad' : s.stats.debt > 70 ? 'mid' : 'good',
    explain: '나랏빚은 재정 적자만큼 늘고, 경제가 커지면(성장률+물가) 비율이 줄어듭니다. 재정을 흑자로 돌리고 성장률을 올리면 저절로 내려가고, 국채 상환으로 바로 갚을 수도 있습니다. 130%를 넘으면 IMF, 180%면 국가 부도입니다.',
    factors: s => [
      { t: `재정수지 ${s.stats.fiscal.toFixed(1)}%${s.stats.fiscal < 0 ? ' (적자 → 빚 증가)' : ' (흑자 → 빚 감소)'}`, good: s.stats.fiscal >= -1 },
      { t: `성장률 ${s.stats.gdp.toFixed(1)}% · 물가 ${s.stats.infl.toFixed(1)}%`, good: s.stats.gdp >= 1.8 },
      { t: `국채 이자 분기 ${won(-budgetIncome(s).interest)}`, good: s.stats.debt < 60 },
      ...(s.war ? [{ t: '전쟁 비용', good: false }] : []),
    ],
    actions: s => [{ icon: '🏦', label: `국고로 최대 상환 (-${Math.min(Math.floor(s.stats.debt), Math.floor(s.pcap / REPAY_UNIT))}%p)`, desc: '쓰고 남는 국고로 나랏빚을 한꺼번에 갚습니다. ₩5조 = 1%p.', run: () => repayDebt(S, 999) },
      { icon: '🔁', label: '자동 상환 켜기 (₩15조 초과분)', desc: '매 분기 결산 때 국고가 ₩15조를 넘는 만큼 자동으로 갚습니다.', run: () => { S.autoRepay = 150; return { ok: true, msg: '자동 상환을 켰습니다.' }; } }, ...topPolicies(s, d => (d.e.fiscal || 0) - (d.e.debt || 0) * 0.3, 3).map(r => polRec(r, `재정수지 ${(r.pv.diff.e.fiscal || 0) >= 0 ? '+' : ''}${(r.pv.diff.e.fiscal || 0).toFixed(2)}%p`)),
      { icon: '🚫', label: '국채 발행은 피하기', desc: '찍을수록 채무가 늘고 이자 부담이 커집니다. 국고가 0 밑으로 떨어져도 자동 발행됩니다.', go: () => { closeModal(); showTab('economy'); } }] },
  tension: {
    name: '세계 긴장도', icon: '🌐', value: s => (s.world?.tension || 0).toFixed(0),
    level: s => s.world?.tension > 70 ? 'bad' : s.world?.tension > 50 ? 'mid' : 'good',
    explain: '세계 긴장도는 각국 분쟁이 터질 때 오르고(전쟁 +10, 무역·국경 분쟁 +3), 분쟁이 끝나면 내려가며, 평소에는 35 쪽으로 서서히 돌아갑니다. 65를 넘으면 우리 안보와 성장률이 깎이고, 높을수록 각국이 전쟁을 더 쉽게 일으킵니다. 한국이 중재해 분쟁을 끝내면 크게 내려갑니다.',
    factors: s => { const cs = (s.world?.conflicts || []).filter(c => c.type !== 'cyber'); return [
      { t: `진행 중인 분쟁 ${cs.length}건 (전쟁 ${cs.filter(c => c.type === 'war').length}건)`, good: cs.length < 3 },
      ...(s.war ? [{ t: `우리나라가 ${cname(s.war.k)}과(와) 전쟁 중`, good: false }] : []),
      ...cs.slice(0, 3).map(c => ({ t: `${CONFLICT_TYPES[c.type].name}: ${cname(c.a)} ↔ ${cname(c.b)}`, good: false })),
    ]; },
    actions: s => {
      const cs = (s.world?.conflicts || []).filter(c => c.type !== 'cyber' && !c.krDone?.includes('mediate'));
      const chance = c => clamp(0.25 + (Math.min(relOf(s, c.a), relOf(s, c.b)) - 50) / 80 + (s.world.tension < 50 ? 0.1 : 0), 0.05, 0.85);
      const recs = cs.sort((a, b) => ({ war: 3, border: 2, civil: 1.5, trade: 1 }[b.type] * chance(b)) - ({ war: 3, border: 2, civil: 1.5, trade: 1 }[a.type] * chance(a))).slice(0, 3)
        .map(c => ({ icon: '🕊️', label: `${cname(c.a)}·${cname(c.b)} ${CONFLICT_TYPES[c.type].name} 중재`, desc: `성공 확률 ${Math.round(chance(c) * 100)}% · 성공하면 긴장도 크게 하락, 지지율 +2`, cost: 20, run: () => intervene(S, c.id, 'mediate') }));
      if (s.war) recs.unshift({ icon: '🏳️', label: `${cname(s.war.k)}과(와) 휴전·강화 제안`, desc: '우리가 전쟁 중이면 긴장도와 경제가 계속 나빠집니다.', run: () => warAction(S, 'peace') });
      if (!recs.length) recs.push({ icon: '✅', label: '지금은 큰 분쟁이 없습니다', desc: '긴장도는 시간이 지나면 35 근처로 돌아갑니다. 호전적인 나라와 정상회담으로 관계를 다져 두세요.', go: () => { closeModal(); showTab('world'); } });
      return recs;
    } },
};

/* ---------------- 조언 창 ---------------- */
function openAdvisor(key) {
  const A = ADVICE[key]; if (!A || !S) return;
  setSpeed(0);
  const acts = A.actions(S);
  openModal(`<div class="advisor">
    <div class="adv-head"><span class="adv-ic">${A.icon}</span><div><div class="muted small">💡 AI 참모 조언</div><h2>${A.name} <b class="adv-val ${A.level(S)}">${A.value(S)}</b></h2></div></div>
    <p class="adv-ex">${esc(A.explain)}</p>
    <div class="adv-sec">지금 무엇이 움직이고 있나</div>
    <div class="adv-factors">${A.factors(S).map(f => `<div class="${f.good ? 'good' : 'bad'}">${f.good ? '▲' : '▼'} ${esc(f.t)}${f.note ? ` <span class="muted small">${esc(f.note)}</span>` : ''}</div>`).join('')}</div>
    <div class="adv-sec">참모 추천</div>
    <div class="adv-acts">${acts.map((a, i) => `<button class="adv-act" data-i="${i}" ${a.cost && S.pcap < a.cost ? 'disabled' : ''}><span class="ic">${a.icon}</span><span class="tx"><b>${esc(a.label)}</b><small>${esc(a.desc)}</small></span><span class="go">${a.run ? `실행${a.cost ? ` · ${won(a.cost)}` : ''}` : '보기 ›'}</span></button>`).join('')}</div>
    <div class="adv-sec">다른 지표</div>
    <div class="adv-tabs">${Object.entries(ADVICE).map(([k, x]) => `<button class="chip ${k === key ? 'on' : ''}" data-k="${k}">${x.icon} ${x.name} <b class="${x.level(S)}">${x.value(S)}</b></button>`).join('')}</div>
    ${typeof ClaudeAI !== 'undefined' && ClaudeAI.enabled() ? `<div class="row-btns"><button class="btn sm" id="adv-claude">🤖 Claude 참모에게 자세히 묻기</button></div><div id="adv-claude-out" class="adv-claude"></div>` : ''}
  </div>`);
  document.querySelectorAll('.adv-act').forEach(b => b.onclick = () => {
    const a = acts[+b.dataset.i];
    if (a.go) return a.go();
    const r = a.run(); if (r && r.ok === false) return toast(esc(r.msg || '실행할 수 없습니다.'));
    if (r?.msg) toast(esc(r.msg), 3500);
    saveGame(S); renderAll(); openAdvisor(key);
  });
  document.querySelectorAll('.adv-tabs [data-k]').forEach(b => b.onclick = () => openAdvisor(b.dataset.k));
  const cb = $('adv-claude');
  if (cb) cb.onclick = async () => {
    cb.disabled = true; $('adv-claude-out').textContent = 'Claude가 분석하고 있습니다…';
    try { $('adv-claude-out').textContent = await ClaudeAI.metricAdvice(S, A.name, A.value(S), A.factors(S).map(f => f.t).join(', '), acts.map(a => a.label).join(', ')); }
    catch (e) { $('adv-claude-out').textContent = 'Claude 호출에 실패했습니다. 위의 내장 참모 추천을 참고하세요.'; }
  };
}

// 가장 급한 지표 (없으면 null)
function urgentMetric(s) {
  const order = ['appr', 'debt', 'tension', 'pcap', 'gdp', 'seats'];
  return order.find(k => ADVICE[k].level(s) === 'bad') || null;
}
const ADV_TIP = {
  appr: '지지율이 위험합니다. 대국민 담화나 불만 세력을 달래는 정책을 검토하세요.',
  debt: '나랏빚이 너무 많습니다. 국채 상환과 재정 흑자 정책을 검토하세요.',
  tension: '세계가 불안합니다. 분쟁 중재로 긴장도를 낮출 수 있습니다.',
  pcap: '국고가 바닥났습니다. 공장·FTA로 수입원을 늘리세요.',
  gdp: '경기가 식고 있습니다. 공장 건설과 성장 정책을 검토하세요.',
  seats: '여당 의석이 부족합니다. 야당 협조와 국정 연합을 챙기세요.',
};

// 상단 자원 칸을 누르면 그 지표의 조언
const HUD_KEY = { 'hdr-appr': 'appr', 'hdr-pcap': 'pcap', 'hdr-seats': 'seats', 'hdr-gdp': 'gdp', 'hdr-debt': 'debt', 'hdr-tension': 'tension' };
document.querySelectorAll('.hud-res .res').forEach(el => {
  const k = HUD_KEY[el.querySelector('b')?.id]; if (!k) return;
  el.classList.add('clickable'); el.title = `${el.title} — 누르면 AI 참모가 올리고 내리는 방법을 알려줍니다`;
  el.onclick = () => openAdvisor(k);
});
