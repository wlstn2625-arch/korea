/* =========================================================
 *  국가 발전 단계(시대): 국가 기반 → 지역 강국 → 세계 강국 → 초강대국
 *  - 대통령 레벨과 국력 순위로 승격, 단계마다 새 정책·외교 수단이 열림
 *  - 지역 강국부터 '국무총리 내정 위임'으로 국내 정치는 자동 처리, 세계 무대에 집중
 * ========================================================= */
const ERAS = [
  { n: 1, name: '국가 기반 다지기', icon: '🏗️', need: null, desc: '국내 정치·경제의 기반을 다지는 시기.' },
  { n: 2, name: '지역 강국', icon: '🌏', need: { lv: 4, rank: 12 }, desc: '동아시아 질서를 주도합니다. 지역 정책, 안보 보장·압박 외교, 국무총리 내정 위임이 열립니다.' },
  { n: 3, name: '세계 강국', icon: '🌐', need: { lv: 8, rank: 6 }, desc: '세계 질서의 한 축. 정권 교체 공작, 세력권 선언, 기축통화·우주 정책이 열립니다.' },
  { n: 4, name: '초강대국', icon: '👑', need: { lv: 12, rank: 2 }, desc: '팍스 코리아나. 국제 질서를 새로 씁니다.' },
];
const eraOf = s => s.era || 1;
function eraProgress(s) {
  const nx = ERAS[eraOf(s)]; if (!nx) return null;
  const rank = typeof powerRank === 'function' ? powerRank(s).rank : 99;
  return { next: nx, lvOk: (s.lv || 1) >= nx.need.lv, rankOk: rank <= nx.need.rank, rank };
}
function eraTurn(s, report) {
  const p = eraProgress(s); if (!p || !p.lvOk || !p.rankOk) return;
  s.era = p.next.n; s.pcap += 50 * s.era; s.approval = clamp(s.approval + 4, 0, 100);
  report.eraUp = s.era;
  addLog(s, 'good', `${p.next.icon} 대한민국이 '${p.next.name}' 단계에 올라섰습니다! 새 정책과 외교 수단이 열렸습니다.`);
  if (typeof worldNews === 'function' && s.world) worldNews(s, `${p.next.icon} 대한민국, ${p.next.name}으로 부상`, 'good');
}

/* ---------------- 단계별 새 정책 (패권·국제질서) ---------------- */
CATEGORIES.push({ id: 'global', name: '패권·국제질서', icon: '👑' });
if (typeof MINISTRY !== 'undefined') MINISTRY.global = '국가안보실장(국제전략)';
const ERA_POLICIES = [
  // 지역 강국
  { id: 'dev_bank', era: 2, cat: 'global', name: '지역 개발은행', desc: '아시아 개발 금융을 누가 주도할까.', options: [
    { id: 'cur', label: '기존 국제기구 참여', cur: true, desc: '현행.' },
    { id: 'akdb', label: '한국 주도 아시아개발기금 창설', lt: 'law', lean: 'N', pc: 40, lag: 4, desc: '동남아 인프라를 우리 기업이 짓습니다.', e: { gdp: 0.08, fiscal: -0.15 }, rel: { cn: -4, us: 2 }, f: { biz: 6 } },
    { id: 'aiib', label: '중국 주도 AIIB 증자', lt: 'decree', lean: 'N', pc: 20, lag: 2, desc: '중국과 협력, 미국은 불편.', e: { gdp: 0.04 }, rel: { cn: 8, us: -4 }, f: { biz: 3 } } ] },
  { id: 'econ_union', era: 2, cat: 'global', name: '동아시아 경제 통합', desc: '역내 시장을 하나로 묶을까.', options: [
    { id: 'cur', label: '양자 FTA 중심', cur: true, desc: '현행.' },
    { id: 'kcj', label: '한중일 FTA', lt: 'law', lean: 'N', pc: 35, lag: 4, desc: '거대 단일시장. 농민 반발.', e: { gdp: 0.12 }, rel: { cn: 8, jp: 8 }, f: { biz: 6, farm: -10 }, r: [['protest', '농민 대규모 반발', '농어민이 FTA 반대 상경 투쟁에 나섰습니다.', 0.4, 2, 'farm']] },
    { id: 'market', label: '동아시아 공동시장·단일 관세', lt: 'const', lean: 'N', pc: 70, lag: 8, desc: 'EU식 통합. 주권 일부 이양.', e: { gdp: 0.2, freedom: 1 }, rel: { cn: 10, jp: 10, us: -5 }, f: { biz: 8, farm: -14, con: -6 } } ] },
  { id: 'overseas_base', era: 2, cat: 'global', name: '해외 군사 거점', desc: '한반도 밖에 군사력을 둘까.', options: [
    { id: 'cur', label: 'PKO·소규모 파견', cur: true, desc: '현행.' },
    { id: 'sea', label: '동남아 해군 거점', lt: 'decree', lean: 'R', pc: 35, lag: 3, desc: '해상 교통로 확보.', e: { security: 3, fiscal: -0.1 }, rel: { cn: -8, us: 4 }, f: { mil: 6 } },
    { id: 'global', label: '인도양·중동 원정 기지망', lt: 'law', lean: 'R', pc: 55, lag: 4, desc: '세계 어디든 전력 투사.', e: { security: 5, fiscal: -0.25 }, rel: { cn: -10, ru: -6, us: 6 }, f: { mil: 8, lib: -5 } } ] },
  { id: 'immig_power', era: 2, cat: 'global', name: '이민 대국 전략', desc: '인구 절벽을 이민으로 넘을까.', options: [
    { id: 'cur', label: '제한적 이민', cur: true, desc: '현행.' },
    { id: 'skilled', label: '기술 이민 연 10만 명', lt: 'law', lean: 'N', pc: 30, lag: 4, desc: '세계 인재 흡수.', e: { gdp: 0.08, innovation: 2, tfr: 0.02 }, f: { biz: 6, youth: -2 } },
    { id: 'mass', label: '연 50만 명 이민 개방', lt: 'law', lean: 'L', pc: 50, lag: 6, desc: '인구 1억을 향해. 사회 갈등.', e: { gdp: 0.2, tfr: 0.06, safety: -2 }, f: { biz: 8, con: -8, youth: -5 }, r: [['social', '이민 갈등 폭발', '이민자 밀집 지역에서 충돌이 일어났습니다.', 0.45, 2, 'youth']] } ] },
  // 세계 강국
  { id: 'un_seat', era: 3, cat: 'global', name: '유엔 안보리 상임이사국', desc: '거부권을 가진 나라가 될까.', options: [
    { id: 'cur', label: '비상임이사국 진출 노력', cur: true, desc: '현행.' },
    { id: 'g4', label: '상임이사국 진출 추진', lt: 'decree', lean: 'N', pc: 60, lag: 6, desc: '성공하면 유엔 결의에 거부권. 중국·일본 반발.', e: { security: 3 }, rel: { cn: -8, jp: -6, us: 4, eu: 4 }, f: { con: 4, lib: 2 } },
    { id: 'reform', label: '거부권 폐지 안보리 개혁안', lt: 'decree', lean: 'L', pc: 40, lag: 4, desc: '글로벌 사우스의 지지.', e: { justice: 1 }, rel: { us: -6, cn: -6, ru: -6, eu: 4 }, f: { lib: 6 } } ] },
  { id: 'krw_reserve', era: 3, cat: 'global', name: '원화 기축통화', desc: '원화를 세계가 쓰게 할까.', options: [
    { id: 'cur', label: '달러 결제 체제', cur: true, desc: '현행.' },
    { id: 'swap', label: '통화스와프 네트워크', lt: 'decree', lean: 'N', pc: 30, lag: 3, desc: '외환위기 방파제.', e: { infl: -0.1, fiscal: 0.1 }, f: { biz: 4 } },
    { id: 'krw', label: '원화 무역결제·디지털 원화 국제망', lt: 'law', lean: 'N', pc: 70, lag: 8, desc: '조폐 이익(시뇨리지)과 금융 패권. 미국 견제.', e: { gdp: 0.15, fiscal: 0.4, infl: 0.2 }, rel: { us: -8 }, f: { biz: 6 } } ] },
  { id: 'alliance_sys', era: 3, cat: 'global', name: '동맹 체제', desc: '어떤 진영 구조를 만들까.', options: [
    { id: 'cur', label: '한미동맹 중심', cur: true, desc: '현행.' },
    { id: 'quad', label: '쿼드 정식 가입', lt: 'decree', lean: 'R', pc: 30, lag: 2, desc: '미·일·호·인과 안보 협력.', e: { security: 4 }, rel: { us: 8, jp: 6, cn: -12 }, f: { con: 6, lib: -3 } },
    { id: 'knato', label: '아시아판 NATO 창설 주도', lt: 'law', lean: 'R', pc: 60, lag: 6, desc: '우리가 맹주가 되는 집단 안보 체제.', e: { security: 7, fiscal: -0.2 }, rel: { us: 6, cn: -18, ru: -10 }, f: { mil: 8, lib: -6 } },
    { id: 'neutral', label: '무장 중립국 선언', lt: 'const', lean: 'N', pc: 70, lag: 6, desc: '어느 진영에도 서지 않습니다.', e: { security: -3 }, rel: { us: -15, cn: 10, ru: 8 }, f: { lib: 6, con: -10, mil: -6 } } ] },
  { id: 'space_power', era: 3, cat: 'global', name: '우주 패권', desc: '우주를 누가 지배할까.', options: [
    { id: 'cur', label: '위성 발사 수준', cur: true, desc: '현행.' },
    { id: 'moon', label: '달 기지·자원 탐사', lt: 'law', lean: 'N', pc: 50, lag: 8, desc: '헬륨-3와 희토류.', e: { innovation: 4, gdp: 0.06, fiscal: -0.2 }, f: { youth: 4 } },
    { id: 'force', label: '우주군 창설', lt: 'law', lean: 'R', pc: 45, lag: 4, desc: '위성 방어·요격.', e: { security: 5, fiscal: -0.15 }, rel: { cn: -6, ru: -6 }, f: { mil: 6 } } ] },
  // 초강대국
  { id: 'world_order', era: 4, cat: 'global', name: '국제 질서 구상', desc: '세계를 어떻게 이끌까.', options: [
    { id: 'cur', label: '기존 질서 존중', cur: true, desc: '현행.' },
    { id: 'pax', label: '팍스 코리아나 선언', lt: 'decree', lean: 'R', pc: 80, lag: 4, desc: '대한민국이 세계 질서의 보증인. 위협도 상승.', e: { security: 6, gdp: 0.1 }, rel: { us: -6, cn: -12, ru: -10 }, f: { con: 8, mil: 6, lib: -6 } },
    { id: 'concert', label: '강대국 협조 체제', lt: 'decree', lean: 'N', pc: 50, lag: 4, desc: '미·중·한 3극 협조로 전쟁을 막습니다.', e: { security: 3 }, rel: { us: 6, cn: 8, ru: 4 }, f: { lib: 4 } },
    { id: 'liberal', label: '자유주의 국제질서 수호', lt: 'decree', lean: 'N', pc: 50, lag: 4, desc: '민주주의 동맹과 인권 외교.', e: { justice: 2, freedom: 2 }, rel: { us: 8, eu: 10, cn: -10, ru: -10 }, f: { lib: 6 } } ] },
  { id: 'global_tax', era: 4, cat: 'global', name: '글로벌 조세 질서', desc: '다국적 기업 세금 규칙을 누가 정할까.', options: [
    { id: 'cur', label: 'OECD 최저한세 따름', cur: true, desc: '현행.' },
    { id: 'lead', label: '글로벌 디지털세 주도', lt: 'law', lean: 'L', pc: 40, lag: 4, desc: '빅테크 세수 확보.', e: { fiscal: 0.5 }, rel: { us: -8, eu: 6 }, f: { biz: -4, lib: 4 } },
    { id: 'haven', label: '국제 금융·조세 특구', lt: 'law', lean: 'R', pc: 40, lag: 4, desc: '세계 자본을 끌어들입니다.', e: { gdp: 0.15, fiscal: 0.2, gini: 0.01 }, rel: { eu: -8 }, f: { biz: 8, lib: -6 } } ] },
  { id: 'ai_rule', era: 4, cat: 'global', name: 'AI 국제 규범', desc: 'AI 시대의 규칙을 누가 쓸까.', options: [
    { id: 'cur', label: '각국 자율', cur: true, desc: '현행.' },
    { id: 'treaty', label: 'AI 안전 국제조약 주도', lt: 'decree', lean: 'N', pc: 40, lag: 4, desc: '세계 표준을 우리가.', e: { innovation: 2, safety: 2 }, rel: { eu: 8, us: 2 }, f: { lib: 4 } },
    { id: 'race', label: 'AI 패권 경쟁 전면전', lt: 'decree', lean: 'R', pc: 50, lag: 4, desc: '규제 없이 질주.', e: { innovation: 6, gdp: 0.15, safety: -2 }, rel: { cn: -6, eu: -6 }, f: { biz: 8, lib: -4 } } ] },
];
POLICIES.push(...ERA_POLICIES);
const policyLocked = (s, p) => (p.era || 1) > eraOf(s);
(function () { // 잠긴 정책은 시행 불가
  const f = enactPolicy; enactPolicy = function (s, pid, ...a) { const p = policyById(pid, s); if (p && policyLocked(s, p)) return { ok: false, msg: `'${ERAS[p.era - 1].name}' 단계에 열리는 정책입니다.` }; return f(s, pid, ...a); };
})();

/* ---------------- 국무총리 내정 위임 ---------------- */
// 국내 정치 사건 카드를 총리가 대신 결정 (국가 비상·점령지·총독부 건의 카드는 계속 대통령에게)
function pmPick(s, ev) {
  const def = DOM_EVENTS[ev.key]; let best = -1, bestV = -1e9;
  def.choices.forEach((c, i) => {
    if (c.pc && s.pcap < c.pc + 50) return;
    const t = JSON.parse(JSON.stringify(s)); const R = Math.random; Math.random = () => 0.5;
    try { c.run(t, ev); } catch { Math.random = R; return; } Math.random = R;
    const v = (t.approval - s.approval) * 2 + ((t.dom?.unity || 0) - (s.dom?.unity || 0)) * 0.3 + ((t.dom?.oppMood || 0) - (s.dom?.oppMood || 0)) * 0.3 + (t.pcap - s.pcap) * 0.05 - (c.pc || 0) * 0.05
      + ['gdp', 'security', 'safety', 'happiness'].reduce((a, k) => a + ((t.stats[k] || 0) - (s.stats[k] || 0)) * (k === 'gdp' ? 4 : 0.6), 0);
    if (v > bestV) { bestV = v; best = i; }
  });
  return best < 0 ? def.choices.findIndex(c => !c.pc) : best;
}
function pmAutoResolve(s) {
  if (!s.pmAuto || eraOf(s) < 2) return [];
  const out = [];
  for (const ev of [...(s.dom?.pending || [])]) {
    const def = DOM_EVENTS[ev.key]; if (!def || def.extreme || ['govProposal', 'terrRevolt', 'protectRequest'].includes(ev.key)) continue;
    const i = pmPick(s, ev); if (i < 0) continue;
    const r = resolveDomEvent(s, ev.id, i); if (r?.ok) out.push(`${r.icon} ${r.title} → ${r.choice}`);
  }
  if (out.length) { (s.pmLog = s.pmLog || []).unshift(...out.map(x => `${turnLabel(s.turn).year}.${turnLabel(s.turn).q}Q ${x}`)); s.pmLog.length = Math.min(s.pmLog.length, 12); addLog(s, 'info', `🧑‍💼 국무총리가 국내 현안 ${out.length}건을 처리했습니다: ${out.join(' / ')}`); }
  return out;
}
HOOKS.postTurn.push(eraTurn);
HOOKS.postTurn.push((s, report) => { report.pmDone = pmAutoResolve(s); report.domEvents = (s.dom?.pending || []).map(x => x.id); });
HOOKS.migrate.push(s => { for (const p of POLICIES) if (s.policies[p.id] == null) s.policies[p.id] = p.options.find(o => o.cur).id; if (!s.era) s.era = 1; });

// 단계 승격 카드
function openEraCard(n) {
  const E = ERAS[n - 1]; if (typeof setSpeed === 'function') setSpeed(0);
  const pols = ERA_POLICIES.filter(p => p.era === n).map(p => `<li>📜 ${esc(p.name)}</li>`).join('');
  const acts = { 2: ['🛡️ 약소국 안보 보장(세력권)', '👑 압박 요구(시장 개방·기지·자원·진영 합류)', '🚫 동맹국 제재 동참 요청', '🧑‍💼 국무총리 내정 위임'], 3: ['🕶️ 정권 교체 공작'], 4: [] }[n] || [];
  openModal(`<div class="event era-up">
    <div class="ev-banner ev-good"><span class="ev-art">${E.icon}</span><span class="ev-kind">국가 발전 단계 승격</span><span class="ev-date">${n}단계</span></div>
    <h2>대한민국, ${E.name}으로</h2><p class="ev-desc">${esc(E.desc)} 국고 +${won(50 * n)}.</p>
    <div class="box"><h4>새로 열린 것</h4><ul>${pols}${acts.map(a => `<li>${a}</li>`).join('')}</ul></div>
    ${n === 2 ? '<p class="muted small">국내 정치가 번거롭다면 왼쪽 위 임무 창의 "내정 총리 위임"을 켜세요. 국가 비상·점령지·외교 카드만 대통령에게 옵니다.</p>' : ''}
    <div class="modal-actions">${n === 2 ? '<button class="btn" id="era-pm">🧑‍💼 내정 총리 위임 켜고 시작</button>' : ''}<button class="btn primary" onclick="closeModal()">세계로 나아간다</button></div></div>`);
  if (typeof rewardPop === 'function') rewardPop(`${E.icon} ${E.name}!`, '국가 발전 단계가 올랐습니다', true);
  const b = document.getElementById('era-pm'); if (b) b.onclick = () => { S.pmAuto = true; saveGame(S); closeModal(); toast('🧑‍💼 내정 총리 위임을 켰습니다.'); };
}
