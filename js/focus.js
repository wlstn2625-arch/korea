/* =========================================================
 *  국가 중점(National Focus) — 하츠 오브 아이언식 대한민국 중점 트리
 *  - 한 번에 하나씩, 정해진 날수(35·70일)가 지나면 완료되어 효과 발동
 *  - 선행 중점(req: 모두 / any: 하나라도), 상호 배타(excl) 갈림길
 *  - 6갈래: 경제 기적 · 자주국방 · 통일 · 외교 노선 · 정치 · 사회
 *  - 최종 중점 '조국과 민족을 위하여': 총력 국가 체제
 * ========================================================= */
const FOCUS_BRANCHES = [
  { id: 'eco', name: '경제 기적', icon: '🏭' }, { id: 'def', name: '자주국방', icon: '🪖' }, { id: 'uni', name: '통일', icon: '🕊️' },
  { id: 'dip', name: '외교 노선', icon: '🌏' }, { id: 'pol', name: '정치', icon: '🏛️' }, { id: 'soc', name: '사회', icon: '👨‍👩‍👧' },
];
// x: 갈래 안 열(0~1), y: 단계
const setFB = (s, key, o) => { s.fb = s.fb || {}; s.fb[key] = o; };
const FOCUSES = [
  // 경제 기적
  { id: 'e_han', br: 'eco', x: 0.5, y: 0, days: 70, icon: '🌊', name: '한강의 기적 2.0', fx: '성장률 +0.1(지속), 국고 +₩3조', run: s => { s.mods.gdp += 0.1; s.pcap += 30; } },
  { id: 'e_chip', br: 'eco', x: 0, y: 1, days: 70, req: ['e_han'], excl: ['e_dom'], icon: '💾', name: '반도체 초격차', fx: '혁신 +3, 성장률 +0.08, 국고 수입 +₩0.8조/분기', run: s => { s.mods.innovation += 3; s.mods.gdp += 0.08; setFB(s, 'e_chip', { income: 8 }); } },
  { id: 'e_dom', br: 'eco', x: 1, y: 1, days: 70, req: ['e_han'], excl: ['e_chip'], icon: '🛒', name: '내수·소상공인 부흥', fx: '행복 +3, 실업 -0.3, 지지율 +3', run: s => { s.mods.happiness += 3; s.mods.unemp -= 0.3; s.approval = clamp(s.approval + 3, 0, 100); } },
  { id: 'e_trillion', br: 'eco', x: 0.5, y: 2, days: 70, any: ['e_chip', 'e_dom'], icon: '🚢', name: '수출 1조 달러', fx: '성장률 +0.12, 국고 수입 +₩1조/분기', run: s => { s.mods.gdp += 0.12; setFB(s, 'e_tril', { income: 10 }); } },
  { id: 'e_hub', br: 'eco', x: 0.5, y: 3, days: 70, req: ['e_trillion'], icon: '🏦', name: '세계 경제 강국', fx: '성장률 +0.1, 재정 +0.3, 국가채무 -5%p', run: s => { s.mods.gdp += 0.1; s.mods.fiscal += 0.3; s.stats.debt = Math.max(0, s.stats.debt - 5); } },
  // 자주국방
  { id: 'd_self', br: 'def', x: 0.5, y: 0, days: 70, icon: '🛡️', name: '자주국방 선언', fx: '안보 +3, 사단 +2', run: s => { s.mods.security += 3; setFB(s, 'd_self', { divs: 2, mil: 3 }); } },
  { id: 'd_reform', br: 'def', x: 0, y: 1, days: 70, req: ['d_self'], icon: '🎖️', name: '국방 개혁 2.0', fx: '전투력 +5%, 조직력 회복 +0.3', run: s => { setFB(s, 'd_reform', { quality: 0.05, org: 0.3, mil: 3 }); } },
  { id: 'd_ind', br: 'def', x: 1, y: 1, days: 70, req: ['d_self'], icon: '🏗️', name: 'K-방산 총력 생산', fx: '장비 보충 +, 국고 수입 +₩0.6조/분기, 공군·해군 +10', run: s => { setFB(s, 'd_ind', { equip: 0.002, income: 6, air: 10, navy: 10, mil: 3 }); } },
  { id: 'd_opcon', br: 'def', x: 0.5, y: 2, days: 70, req: ['d_reform', 'd_ind'], icon: '⭐', name: '전시작전권 환수', fx: '전투력 +5%, 사단 +3, 미국 관계 -3', run: s => { setFB(s, 'd_opcon', { quality: 0.05, divs: 3, mil: 4 }); relBump(s, 'us', -3, -1); } },
  { id: 'd_final', br: 'def', x: 0.5, y: 3, days: 70, req: ['d_opcon'], icon: '🇰🇷', name: '조국과 민족을 위하여', fx: '총력 국가 체제: 사단 +6, 전투력 +8%, 총동원 +20%, 사상자 -10%, 안보 +5, 지지율 +3', run: s => { setFB(s, 'd_final', { divs: 6, quality: 0.08, mobilize: 0.2, cas: 0.9, mil: 8 }); s.mods.security += 5; s.approval = clamp(s.approval + 3, 0, 100); } },
  // 통일
  { id: 'u_talk', br: 'uni', x: 0.5, y: 0, days: 35, icon: '🤝', name: '남북 대화 재개', fx: '북한 관계 +8', run: s => { relBump(s, 'nk', 8, 6); } },
  { id: 'u_peace', br: 'uni', x: 0, y: 1, days: 70, req: ['u_talk'], excl: ['u_press'], icon: '🕊️', name: '평화 공존', fx: '북한 관계 +15, 안보 +2, 개성공단 재가동(성장 +0.04)', run: s => { relBump(s, 'nk', 15, 12); s.mods.security += 2; s.mods.gdp += 0.04; } },
  { id: 'u_press', br: 'uni', x: 1, y: 1, days: 70, req: ['u_talk'], excl: ['u_peace'], icon: '✊', name: '대북 최대 압박', fx: '북한 관계 -15, 미국 +6, 북한 전쟁 명분', run: s => { relBump(s, 'nk', -15, -12); relBump(s, 'us', 6, 3); dip(s, 'nk').casusBelli = s.turn + 12; } },
  { id: 'u_fed', br: 'uni', x: 0, y: 2, days: 70, req: ['u_peace'], icon: '🧩', name: '남북 연합 구상', fx: '북한 관계 +25(평화통일 협상 조건인 관계 80에 다가감)', run: s => { relBump(s, 'nk', 25, 20); } },
  { id: 'u_north', br: 'uni', x: 1, y: 2, days: 70, req: ['u_press'], icon: '⚔️', name: '북진 통일 준비', fx: '북한 상대 전투력 +10%, 사단 +3', run: s => { setFB(s, 'u_north', { quality: 0.1, divs: 3, mil: 4 }); } },
  { id: 'u_one', br: 'uni', x: 0.5, y: 3, days: 70, any: ['u_fed', 'u_north'], icon: '🇰🇷', name: '하나의 한반도', fx: '통일 후 북한 지역 통합 +30, 저항 -20 (통일 전이면 지지율 +3)', run: s => { const t = s.terr?.nk; if (t) { t.integ = Math.min(100, t.integ + 30); t.resist = Math.max(0, t.resist - 20); } else s.approval = clamp(s.approval + 3, 0, 100); } },
  // 외교 노선
  { id: 'x_us', br: 'dip', x: 0, y: 0, days: 35, excl: ['x_bal'], icon: '🇺🇸', name: '한미동맹 격상', fx: '미국 관계 +12, 일본 +5, 중국 -8', run: s => { relBump(s, 'us', 12, 8); relBump(s, 'jp', 5, 3); relBump(s, 'cn', -8, -5); } },
  { id: 'x_bal', br: 'dip', x: 1, y: 0, days: 35, excl: ['x_us'], icon: '⚖️', name: '균형 외교', fx: '중국 +10, 러시아 +6, 미국 -5', run: s => { relBump(s, 'cn', 10, 6); relBump(s, 'ru', 6, 4); relBump(s, 'us', -5, -3); } },
  { id: 'x_quad', br: 'dip', x: 0, y: 1, days: 70, req: ['x_us'], icon: '🔷', name: '인도태평양 전략', fx: '안보 +3, 미·일·호·인 관계 +5', run: s => { s.mods.security += 3; for (const k of ['us', 'jp', 'aus', 'ind']) if (cinfo(k)) relBump(s, k, 5, 3); } },
  { id: 'x_asia', br: 'dip', x: 1, y: 1, days: 70, req: ['x_bal'], icon: '🌏', name: '동아시아 공동체', fx: '중·일 +6, 아세안 국가 +6, 성장 +0.06', run: s => { for (const k of ['cn', 'jp', 'vnm', 'tha', 'idn', 'phl', 'mys', 'sgp']) if (cinfo(k)) relBump(s, k, 6, 4); s.mods.gdp += 0.06; } },
  { id: 'x_lead', br: 'dip', x: 0.5, y: 2, days: 70, any: ['x_quad', 'x_asia'], icon: '👑', name: '아시아의 맹주', fx: '위협도 -10, 국력 순위 산정 시 외교 영향력 반영(국고 +₩5조)', run: s => { if (typeof addThreat === 'function') addThreat(s, -10, '아시아의 맹주 외교'); s.pcap += 50; } },
  { id: 'x_claim', br: 'dip', x: 0.5, y: 3, days: 70, req: ['x_lead'], icon: '📜', name: '역사적 영토 회복', fx: '이웃 나라(관계 50 미만)에 전쟁 명분. 위협도 +6', run: s => { for (const k of ['jp', 'cn', 'nk', 'ru', 'mng']) if (cinfo(k) && relOf(s, k) < 50 && !s.annexed[k]) dip(s, k).casusBelli = s.turn + 16; if (typeof addThreat === 'function') addThreat(s, 6, '영토 회복 선언'); } },
  // 정치
  { id: 'p_reform', br: 'pol', x: 0.5, y: 0, days: 35, icon: '🏛️', name: '정치 개혁', fx: '당 장악력 +10, 야당 협조도 +5', run: s => { s.dom.unity = clamp(s.dom.unity + 10, 0, 100); s.dom.oppMood = clamp(s.dom.oppMood + 5, 0, 100); } },
  { id: 'p_unity', br: 'pol', x: 0, y: 1, days: 70, req: ['p_reform'], excl: ['p_strong'], icon: '🤝', name: '국민 통합', fx: '모든 세력 +4, 지지율 +4', run: s => { for (const k in s.factions) s.factions[k] = clamp(s.factions[k] + 4, 0, 100); s.approval = clamp(s.approval + 4, 0, 100); } },
  { id: 'p_strong', br: 'pol', x: 1, y: 1, days: 70, req: ['p_reform'], excl: ['p_unity'], icon: '🦅', name: '강력한 대통령', fx: '정책 비용이 들 때마다 국고 +10% 효율(국고 +₩4조), 야당 협조도 -10, 자유 -2', run: s => { s.pcap += 40; s.dom.oppMood = clamp(s.dom.oppMood - 10, 0, 100); s.mods.freedom -= 2; s.dom.unity = clamp(s.dom.unity + 10, 0, 100); } },
  { id: 'p_final', br: 'pol', x: 0.5, y: 2, days: 70, any: ['p_unity', 'p_strong'], icon: '📜', name: '제7공화국 헌법', fx: '사법 신뢰 +3, 안정적 국정: 지지율 하락 완화(지지율 +3)', run: s => { s.mods.justice += 3; s.approval = clamp(s.approval + 3, 0, 100); } },
  // 사회
  { id: 's_birth', br: 'soc', x: 0.5, y: 0, days: 70, icon: '🍼', name: '저출산 총력 대응', fx: '출산율 +0.06, 행복 +2, 재정 -0.2', run: s => { s.mods.tfr += 0.06; s.mods.happiness += 2; s.mods.fiscal -= 0.2; } },
  { id: 's_edu', br: 'soc', x: 0, y: 1, days: 70, req: ['s_birth'], icon: '🎓', name: '인재 강국', fx: '교육 +3, 혁신 +2', run: s => { s.mods.education += 3; s.mods.innovation += 2; } },
  { id: 's_immig', br: 'soc', x: 1, y: 1, days: 70, req: ['s_birth'], icon: '🛂', name: '이민으로 인구 1억', fx: '성장 +0.1, 출산율 +0.03, 치안 -1', run: s => { s.mods.gdp += 0.1; s.mods.tfr += 0.03; s.mods.safety -= 1; } },
  { id: 's_welfare', br: 'soc', x: 0.5, y: 2, days: 70, any: ['s_edu', 's_immig'], icon: '🏡', name: '모두가 잘사는 나라', fx: '복지 +3, 행복 +3, 지니 -0.01', run: s => { s.mods.welfare += 3; s.mods.happiness += 3; s.mods.gini -= 0.01; } },
];
const focusById = id => FOCUSES.find(f => f.id === id);
function focusState(s) { if (!s.focus) s.focus = { cur: null, prog: 0, done: [], qDays: 0 }; return s.focus; }
function focusWhyNot(s, f) {
  const F = focusState(s);
  if (F.done.includes(f.id)) return '완료';
  if (F.cur === f.id) return '진행 중';
  if ((f.req || []).some(r => !F.done.includes(r))) return '선행 중점 필요';
  if (f.any && !f.any.some(r => F.done.includes(r))) return '선행 중점 필요';
  if ((f.excl || []).some(x => F.done.includes(x) || F.cur === x)) return '다른 노선을 택함';
  return null;
}
function startFocus(s, id) {
  const f = focusById(id), F = focusState(s); if (!f) return { ok: false };
  const why = focusWhyNot(s, f); if (why) return { ok: false, msg: why };
  const lost = F.cur ? Math.round(F.prog) : 0;
  F.cur = id; F.prog = 0;
  return { ok: true, msg: `🎯 국가 중점: ${f.name} (${f.days}일)${lost ? ` — 이전 중점 진행 ${lost}일은 사라졌습니다` : ''}` };
}
function focusTick(s, days) {
  const F = focusState(s); F.qDays = (F.qDays || 0) + days;
  if (!F.cur) return;
  F.prog += days;
  const f = focusById(F.cur);
  if (F.prog >= f.days) {
    F.done.push(f.id); F.cur = null; const over = F.prog - f.days; F.prog = 0;
    try { f.run(s); } catch (e) { }
    (s.cnt = s.cnt || {}).focus = (s.cnt.focus || 0) + 1;
    addLog(s, 'good', `🎯 국가 중점 완료: ${f.icon} ${f.name} — ${f.fx}`);
    if (s.world && typeof worldNews === 'function') worldNews(s, `🎯 대한민국, '${f.name}' 추진 완료`, 'good');
    (s.focusDoneQ = s.focusDoneQ || []).push(f.id);
    if (typeof focusDoneFx === 'function') focusDoneFx(f);
    // 넘친 날수는 버림 (하츠처럼 다음 중점은 새로 고름)
  }
}
// 분기 결산: 실시간으로 흐르지 않은 남은 날수만큼 진행
HOOKS.postTurn.push((s, report) => {
  const F = focusState(s); const rest = Math.max(0, 90 - (F.qDays || 0)); F.qDays = 0;
  s.focusDoneQ = []; focusTick(s, rest); F.qDays = 0;
  report.focusDone = (s.focusDoneQ || []).map(id => focusById(id).name);
});
HOOKS.migrate.push(s => { focusState(s); });
