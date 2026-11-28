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
