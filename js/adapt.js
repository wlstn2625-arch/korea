/* =========================================================
 *  합병·점령에 맞춰 게임 전체가 바뀜
 *  - 그 나라와의 '관계'는 더 이상 없음: 관계 수치·외교 효과·안보/경제 계산에서 빠짐
 *  - 그 나라 전용 정책(한미동맹·전작권·대중국·대일본·대북·국가보안법)은
 *    '○○ 지역 통치' 정책으로 바뀌어, 통치 방식을 카드로 고름
 *  - 동맹·FTA·제재 같은 외교 관계도 정리
 * ========================================================= */
const POLICY_TIES = { us_alliance: 'us', opcon: 'us', china: 'cn', japan: 'jp', nk_policy: 'nk', nsa: 'nk' };
const isGone = (s, k) => !!(k && (s.annexed?.[k] || (s.terr?.[k] && !(typeof RULES !== 'undefined' && RULES[s.terr[k].rule]?.puppet)) || s.world?.owner?.[k]));
const policyObsolete = (s, p) => !!(p && POLICY_TIES[p.id] && isGone(s, POLICY_TIES[p.id]));
const goneCore = s => Object.keys(RELATIONS).filter(k => isGone(s, k));

// 정책 시행 막기
{
  const _ep = enactPolicy;
  enactPolicy = function (s, pid, ...a) {
    const p = policyById(pid, s);
    if (policyObsolete(s, p)) return { ok: false, msg: `${cname(POLICY_TIES[pid])}은(는) 이제 대한민국 영토입니다. '${cname(POLICY_TIES[pid])} 지역 통치'에서 통치 방식을 정하세요.` };
    return _ep(s, pid, ...a);
  };
}

// 관계 정리: 매 분기 거시 계산 전에, 사라진 나라와의 관계를 중립값으로 고정(안보·경제·여론 계산에 영향 없게)
function settleGone(s) {
  for (const k of goneCore(s)) {
    s.rel[k] = RELATIONS[k].base; s.relMods[k] = 0;
    const d = s.diplo?.[k]; if (d) { d.alliance = false; d.fta = false; d.sanction = false; d.swap = false; d.visa = false; }
  }
  // 진행 중인 정책 효과에 남은 그 나라 관계 효과도 제거
  for (const pe of s.pending || []) for (const k of goneCore(s)) if (pe.rel) delete pe.rel[k];
}
HOOKS.preMacro.push(settleGone);
HOOKS.postTurn.push(settleGone);
HOOKS.migrate.push(settleGone);

// 합병하는 순간 바로 정리하고 알림
if (typeof annex === 'function') {
  const _an = annex;
  annex = function (s, k, ...a) {
    const r = _an(s, k, ...a);
    settleGone(s);
    const ties = Object.entries(POLICY_TIES).filter(([, c]) => c === k).map(([pid]) => policyById(pid, s)?.name).filter(Boolean);
    if (ties.length) addLog(s, 'info', `🗺️ ${cname(k)} 편입으로 ${ties.join('·')}은(는) '${cname(k)} 지역 통치' 정책으로 바뀌었습니다.`);
    return r;
  };
}

// 장관 건의에서 제외
if (typeof ministerProposals === 'function') {
  const _mp = ministerProposals;
  ministerProposals = cat => _mp(cat).filter(x => !policyObsolete(S, x.p));
}

/* ---------------- 국가 중점도 상황에 맞게 ----------------
 * 대상 나라가 사라지면 같은 자리의 중점이 '그 이후'에 맞는 내용으로 바뀜(이름·효과·실행) */
const curS = () => (typeof S !== 'undefined' && S) ? S : null;
const tInteg = (s, k, integ, resist) => { const t = s.terr?.[k]; if (t) { t.integ = clamp(t.integ + integ, 0, 100); t.resist = clamp(t.resist + resist, 0, 100); } };
const FOCUS_ADAPT = {
  // 통일 갈래 → 통일 이후(북부 통합)
  u_talk: { k: 'nk', icon: '🫱', name: '북부 민심 수습', fx: '북부 지역 저항 -12, 통합 +8, 지지율 +2', run: s => { tInteg(s, 'nk', 8, -12); s.approval = clamp(s.approval + 2, 0, 100); } },
  u_peace: { k: 'nk', icon: '🏭', name: '북부 경제특구', fx: '북부 개발 +12, 성장률 +0.06(지속), 저항 -5', run: s => { const t = s.terr?.nk; if (t) t.dev = clamp(t.dev + 12, 0, 100); s.mods.gdp += 0.06; tInteg(s, 'nk', 0, -5); } },
  u_press: { k: 'nk', icon: '🚓', name: '북부 치안 확립', fx: '북부 저항 -18, 치안 +1, 자유 -1', run: s => { tInteg(s, 'nk', 0, -18); s.mods.safety += 1; s.mods.freedom -= 1; } },
  u_fed: { k: 'nk', icon: '🧩', name: '남북 행정 통합', fx: '북부 통합 +20, 재정 -0.2', run: s => { tInteg(s, 'nk', 20, -6); s.mods.fiscal -= 0.2; } },
  u_north: { k: 'nk', icon: '🏯', name: '북방 국경 요새화', fx: '안보 +4, 사단 +3 (압록강·두만강 방어선)', run: s => { s.mods.security += 4; setFB(s, 'u_north', { divs: 3, mil: 4 }); } },
  // 자주국방: 미국이 사라지면 전작권 환수 대신 미군 전력 흡수
  d_opcon: { k: 'us', icon: '🦅', name: '옛 주한미군 전력 흡수', fx: '전투력 +7%, 사단 +4, 공군·해군 +15', run: s => { setFB(s, 'd_opcon', { quality: 0.07, divs: 4, mil: 5, air: 15, navy: 15 }); } },
  // 외교 노선
  x_us: { k: 'us', icon: '🌊', name: '태평양 패권', fx: '안보 +4, 일본·호주·필리핀 관계 +6, 위협도 +3', run: s => { s.mods.security += 4; for (const k of ['jp', 'aus', 'phl']) if (cinfo(k)) relBump(s, k, 6, 3); if (typeof addThreat === 'function') addThreat(s, 3); } },
  x_bal: { k: 'cn', icon: '🧭', name: '유라시아 균형', fx: '러시아 +10, 인도 +8, 중앙아시아 +6', run: s => { for (const [k, v] of [['ru', 10], ['ind', 8], ['kaz', 6], ['uzb', 6]]) if (cinfo(k)) relBump(s, k, v, v / 2); } },
  x_quad: { k: 'us', icon: '🔷', name: '인도태평양 해양 질서', fx: '안보 +3, 호주·인도·필리핀 관계 +6', run: s => { s.mods.security += 3; for (const k of ['aus', 'ind', 'phl']) if (cinfo(k)) relBump(s, k, 6, 3); } },
};
for (const [id, A] of Object.entries(FOCUS_ADAPT)) {
  const f = typeof focusById === 'function' && focusById(id); if (!f) continue;
  const o = { icon: f.icon, name: f.name, fx: f.fx, run: f.run };
  const on = s => s && isGone(s, A.k);
  Object.defineProperty(f, 'icon', { get: () => on(curS()) ? A.icon : o.icon, configurable: true });
  Object.defineProperty(f, 'name', { get: () => on(curS()) ? A.name : o.name, configurable: true });
  Object.defineProperty(f, 'fx', { get: () => on(curS()) ? A.fx : o.fx, configurable: true });
  f.run = s => on(s) ? A.run(s) : o.run(s);
  f.adaptedBy = A.k;
}
// 통일 갈래 이름도 '통일 이후'로
if (typeof FOCUS_BRANCHES !== 'undefined') {
  const b = FOCUS_BRANCHES.find(x => x.id === 'uni');
  if (b) { const n0 = b.name, i0 = b.icon; Object.defineProperty(b, 'name', { get: () => (curS() && isGone(curS(), 'nk')) ? '통일 이후' : n0, configurable: true }); Object.defineProperty(b, 'icon', { get: () => (curS() && isGone(curS(), 'nk')) ? '🇰🇷' : i0, configurable: true }); }
}
