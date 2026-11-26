/* =========================================================
 *  변수 시뮬레이션 (매 판 다른 흐름)
 *  1) 세계 흐름: 세계 경기·유가·미국 노선·중국 공세·기술 붐·기후·민심이 판마다 다르게 움직임
 *  2) 정책 시행 성과: 같은 정책도 그때 흐름·민심·운에 따라 대성공/순조/기대 이하/역풍
 *  3) 시국 정책안: 지금 상황(전쟁·물가·경기·영토·국력…)을 판단해 그 분기에 있을 법한 정책안을 제안
 *  4) 외교 행동 확장 + 외교 정세 카드
 *  5) 전장 변수: 날씨·장군 경질·보급 차단·의용군·기습 등 전투 중 돌발 상황
 * ========================================================= */

const DYN = {
  pick: a => a[Math.floor(Math.random() * a.length)],
  chance: p => Math.random() < p,
};

/* ---------------- 1) 세계 흐름 ---------------- */
const FLOW_INFO = {
  econ: { name: '세계 경기', icon: '💹', fmt: v => v > 45 ? '호황' : v > 15 ? '확장' : v > -15 ? '보합' : v > -45 ? '둔화' : '침체' },
  oil: { name: '국제 유가', icon: '🛢️', fmt: v => `$${Math.round(v * 0.8)}` },
  us: { name: '미국 노선', icon: '🇺🇸', fmt: v => v > 40 ? '적극 개입' : v > 0 ? '동맹 중시' : v > -40 ? '거래주의' : '고립주의' },
  cn: { name: '중국 공세', icon: '🇨🇳', fmt: v => v > 70 ? '강경' : v > 45 ? '압박' : v > 25 ? '관망' : '유화' },
  tech: { name: '기술 붐', icon: '🤖', fmt: v => v > 70 ? 'AI 대호황' : v > 45 ? '활발' : v > 25 ? '보통' : '정체' },
  climate: { name: '기후 위험', icon: '🌪️', fmt: v => v > 70 ? '극심' : v > 45 ? '높음' : v > 25 ? '보통' : '낮음' },
  mood: { name: '민심', icon: '🧭', fmt: v => v > 20 ? '낙관' : v > 5 ? '안정' : v > -10 ? '냉담' : v > -25 ? '불만' : '분노' },
};

function newFlow() {
  return {
    econ: Math.round(gauss() * 20), econDir: DYN.pick([-4, -2, 2, 4]),
    oil: Math.round(95 + gauss() * 12), us: Math.round(rnd(-30, 60)), cn: Math.round(rnd(30, 65)),
    tech: Math.round(rnd(30, 60)), climate: Math.round(rnd(20, 40)), mood: 0,
    nextUsElect: 8, applied: null, hist: [], luck: +(gauss() * 0.08).toFixed(3),
  };
}
const flowOf = s => (s.flow = s.flow || newFlow());

function flowNews(s, text, type = 'info') {
  addLog(s, type, text);
  if (s.world && typeof worldNews === 'function') worldNews(s, text, type);
  (s.flowNews = s.flowNews || []).unshift({ turn: s.turn, text, type }); s.flowNews.length = Math.min(s.flowNews.length, 12);
}

function flowStep(s) {
  const F = flowOf(s);
  // 세계 경기: 추세가 있고 가끔 방향을 바꾸며, 드물게 큰 충격
  if (DYN.chance(0.17)) F.econDir = -Math.sign(F.econDir || 1) * rnd(2, 6);
  F.econ += F.econDir + gauss() * 9 - F.econ * 0.08;
  if (DYN.chance(0.035)) { F.econ -= rnd(40, 60); F.econDir = -3; flowNews(s, `📉 ${DYN.pick(['미국 대형 은행 파산', '중국 부동산 그룹 연쇄 부도', '유럽 국채 위기', '글로벌 신용경색'])}으로 세계 금융시장이 급락했습니다. 세계 경기 침체 우려.`, 'bad'); }
  else if (DYN.chance(0.03)) { F.econ += rnd(25, 40); F.econDir = 3; flowNews(s, `📈 ${DYN.pick(['AI 생산성 혁명', '미·중 무역 합의', '글로벌 금리 인하', '인도·아세안 투자 붐'])}으로 세계 경기가 살아납니다.`, 'good'); }
  F.econ = clamp(F.econ, -100, 100);
  // 유가: 중동 정세·경기에 반응
  F.oil += gauss() * 8 + (F.econ > 30 ? 2 : F.econ < -30 ? -3 : 0) - (F.oil - 100) * 0.1;
  if (DYN.chance(0.04)) { F.oil += rnd(30, 55); flowNews(s, `🛢️ ${DYN.pick(['호르무즈 해협 긴장', '산유국 감산 합의', '주요 송유관 테러', '중동 무력 충돌'])}으로 국제 유가가 급등했습니다.`, 'bad'); }
  F.oil = clamp(F.oil, 45, 220);
  // 미국 노선: 대선 때 크게 바뀜
  if (s.turn >= F.nextUsElect) {
    F.nextUsElect = s.turn + 16;
    const old = F.us; F.us = clamp(Math.round(gauss() * 50 + 10), -90, 90);
    const iso = F.us < -30, inter = F.us > 40;
    flowNews(s, `🇺🇸 미국 대선 결과: ${iso ? '"미국 우선" 고립주의 후보' : inter ? '동맹 복원을 내건 국제주의 후보' : F.us > 0 ? '중도 성향 후보' : '거래주의 성향 후보'} 당선. ${F.us < old - 30 ? '동맹국에 방위비 압박이 커질 전망입니다.' : F.us > old + 30 ? '동맹 관계가 강화될 전망입니다.' : '대외 노선은 큰 변화가 없을 전망입니다.'}`, F.us < old - 30 ? 'bad' : 'info');
  } else F.us = clamp(F.us + gauss() * 4, -90, 90);
  // 중국 공세: 경기가 나쁘면 대외 강경
  F.cn = clamp(F.cn + gauss() * 5 + (F.econ < -30 ? 2 : 0) + (s.rel?.cn < 30 ? 1.5 : 0) - (F.cn - 50) * 0.05, 0, 100);
  if (DYN.chance(0.03)) { F.cn = clamp(F.cn + 25, 0, 100); flowNews(s, `🇨🇳 중국 지도부가 "${DYN.pick(['핵심 이익 수호', '해양 주권 확립', '외세 간섭 배격'])}"을 선언하며 대외 노선을 강경하게 틀었습니다.`, 'bad'); }
  // 기술 붐·기후·민심
  F.tech = clamp(F.tech + gauss() * 5 + 0.6 - (F.tech - 50) * 0.04, 0, 100);
  F.climate = clamp(F.climate + 0.8 + gauss() * 3, 0, 100);
  F.mood = clamp(F.mood * 0.8 + gauss() * 6 + (s.stats.happiness - 42) * 0.15 + F.econ * 0.04, -50, 50);
  F.hist.push({ t: s.turn, econ: Math.round(F.econ), oil: Math.round(F.oil), us: Math.round(F.us), cn: Math.round(F.cn) }); if (F.hist.length > 40) F.hist.shift();
}

// 흐름이 이번 분기 지표에 주는 영향 (한 분기만 적용하고 되돌림)
function flowImpact(s) {
  const F = flowOf(s);
  return {
    gdp: F.econ * 0.009 - Math.max(0, F.oil - 110) * 0.006 + (F.tech - 50) * 0.006 + F.luck,
    infl: Math.max(0, F.oil - 100) * 0.012 + F.econ * 0.004,
    unemp: -F.econ * 0.006,
    innovation: (F.tech - 50) * 0.06,
    rel: { us: F.us * 0.07, cn: -(F.cn - 50) * 0.12 },
  };
}
HOOKS.preMacro.push(s => {
  const I = flowImpact(s);
  for (const k of ['gdp', 'infl', 'unemp', 'innovation']) s.mods[k] += I[k];
  for (const k in I.rel) s.relMods[k] = (s.relMods[k] || 0) + I.rel[k];
  flowOf(s).applied = I;
});
HOOKS.postMacro.push(s => {
  const F = flowOf(s), I = F.applied; if (!I) return;
  for (const k of ['gdp', 'infl', 'unemp', 'innovation']) s.mods[k] -= I[k];
  for (const k in I.rel) s.relMods[k] -= I.rel[k];
  F.applied = null;
  s.approval = clamp(s.approval + F.mood * 0.04, 0, 100);
  if (s.world) s.world.tension = clamp(s.world.tension + (F.cn - 55) * 0.03 + (F.oil > 150 ? 0.5 : 0), 0, 100);
});

/* ---------------- 2) 정책 시행 성과 변수 ---------------- */
const PERF = [
  { id: 'great', name: '대성공', icon: '🌟', k: 1.4, type: 'good' },
  { id: 'ok', name: '순조', icon: '✅', k: 1.0, type: 'info' },
  { id: 'weak', name: '기대 이하', icon: '😐', k: 0.6, type: 'info' },
  { id: 'back', name: '역풍', icon: '🌪️', k: 0.25, type: 'bad' },
];
// ctx: 경제 정책이면 경기 영향, 민심·사법 신뢰(행정 역량)·운
function rollPerf(s, econ = false) {
  const F = flowOf(s);
  const z = gauss() + F.mood * 0.02 + (econ ? F.econ * 0.008 : 0) + (s.stats.justice - 41) * 0.01 + (s.approval - 45) * 0.012 + F.luck * 5;
  return z > 1.25 ? PERF[0] : z > -0.55 ? PERF[1] : z > -1.65 ? PERF[2] : PERF[3];
}
const ECON_CATS = new Set(['tax', 'econ', 'labor', 'house']);
const _applyPassed = applyPassed;
applyPassed = function (s, p, opt, old) {
  _applyPassed(s, p, opt, old);
  if (s._noPerf) return;
  const pe = s.pending.find(x => x.pid === p.id); if (!pe) return;
  const R = rollPerf(s, ECON_CATS.has(p.cat));
  for (const k in pe.e) pe.e[k] *= R.k;
  for (const k in (pe.rel || {})) pe.rel[k] *= R.k;
  if (R.id === 'back') { s.approval = clamp(s.approval - 2, 0, 100); for (const k in opt.f || {}) if (opt.f[k] < 0 && s.factions[k] != null) s.factions[k] = clamp(s.factions[k] + opt.f[k] * 0.5, 0, 100); }
  if (R.id === 'great') s.approval = clamp(s.approval + 1.5, 0, 100);
  pe.perf = R.id;
  const why = R.id === 'great' ? DYN.pick(['현장 공무원들이 빠르게 움직였습니다', '여론이 우호적이었습니다', '시장 상황이 맞아떨어졌습니다']) : R.id === 'weak' ? DYN.pick(['부처 간 엇박자가 났습니다', '예산 집행이 늦어졌습니다', '현장 반응이 미지근합니다']) : R.id === 'back' ? DYN.pick(['시행 첫 주부터 혼선이 빚어졌습니다', '이해집단의 집단 반발이 터졌습니다', '언론이 부작용 사례를 연일 보도합니다']) : '계획대로 집행되고 있습니다';
  s.lastPerf = { turn: s.turn, name: `${p.name}: ${opt.label}`, perf: R.id, why };
  addLog(s, R.type, `${R.icon} [시행 성과: ${R.name}] ${p.name}: ${opt.label} — ${why}.${R.k !== 1 ? ` (효과 ×${R.k})` : ''}`);
};

/* ---------------- 3) 시국 정책안 ---------------- */
// fx: e(즉시 지표) · mods(지속 효과) · ap(지지율) · rel · f(세력) · pcap(국고 증감) · threat · tension · risk{p,text,fx}
function applyFx(s, fx, k = 1) {
  const st = s.stats;
  for (const x in fx.e || {}) if (STATS[x]) st[x] = clamp(st[x] + fx.e[x] * k, STATS[x].min, STATS[x].max);
  for (const x in fx.mods || {}) if (s.mods[x] != null) s.mods[x] += fx.mods[x] * k;
  if (fx.ap) s.approval = clamp(s.approval + fx.ap * k, 0, 100);
  for (const x in fx.rel || {}) if (typeof relBump === 'function' && (RELATIONS[x] || cinfo(x))) relBump(s, x, fx.rel[x] * k, fx.rel[x] * k * 0.4);
  for (const x in fx.f || {}) if (s.factions[x] != null) s.factions[x] = clamp(s.factions[x] + fx.f[x] * k, 0, 100);
  if (fx.pcap) s.pcap += fx.pcap * (fx.pcap > 0 ? k : 1);
  if (fx.threat && typeof addThreat === 'function') addThreat(s, fx.threat * k);
  if (fx.tension && s.world) s.world.tension = clamp(s.world.tension + fx.tension * k, 0, 100);
}
function fxText(fx) {
  const out = [];
  const num = (v, d = 1) => `${v > 0 ? '+' : ''}${(+v).toFixed(Math.abs(v) < 0.1 ? 2 : Math.abs(v) < 1 && d ? 1 : 0)}`;
  for (const x in fx.e || {}) out.push(`${STATS[x]?.name || x} ${num(fx.e[x])}`);
  for (const x in fx.mods || {}) out.push(`${STATS[x]?.name || x} ${num(fx.mods[x])}(지속)`);
  if (fx.ap) out.push(`지지율 ${num(fx.ap)}`);
  for (const x in fx.rel || {}) out.push(`${RELATIONS[x]?.name || (typeof cname === 'function' ? cname(x) : x)} 관계 ${num(fx.rel[x], 0)}`);
  for (const x in fx.f || {}) out.push(`${FACTIONS[x]?.name || x} ${num(fx.f[x], 0)}`);
  if (fx.pcap) out.push(`국고 ${fx.pcap > 0 ? '+' : '-'}${won(Math.abs(fx.pcap))}`);
  if (fx.threat) out.push(`위협도 ${num(fx.threat, 0)}`);
  if (fx.tension) out.push(`세계 긴장 ${num(fx.tension, 0)}`);
  if (fx.risk) out.push(`⚠️ ${Math.round(fx.risk.p * 100)}% 확률로 ${fx.risk.text}`);
  return out.join(', ');
}

const inWar = s => !!(s.war && s.war.theater);
const terrCount = s => Object.keys(s.terr || {}).length;
const rankOf = s => { try { return powerRank(s); } catch { return 20; } };

// 시국 정책 템플릿: cond(조건), score(지금 얼마나 절실한가), make(구체적 내용·수치는 매번 다름)
const SIT_POLICIES = [
  /* --- 경제 --- */
  { key: 'stimulus', icon: '💸', cat: '경제', cond: s => s.stats.gdp < 1.6 || flowOf(s).econ < -25, score: s => 2 + Math.max(0, 1.6 - s.stats.gdp) * 2,
    make: s => { const n = DYN.pick([20, 30, 45, 60]); return { title: `${n}조 원 규모 경기 부양 추경`, desc: `세계 경기 ${FLOW_INFO.econ.fmt(flowOf(s).econ)}, 성장률 ${s.stats.gdp.toFixed(1)}%. 기재부가 추경 편성안을 올렸습니다.`,
      choices: [
        { label: `추경 ${n}조 원 전액 편성`, fx: { e: { gdp: n / 70, unemp: -n / 120, debt: n / 25, fiscal: -n / 40 }, ap: 1.5 } },
        { label: '취약계층 선별 지원만', fx: { e: { gdp: n / 200, welfare: 2, debt: n / 80 }, f: { labor: 3, elder: 3 } } },
        { label: '감세로 대신', fx: { e: { gdp: n / 120, fiscal: -n / 60, gini: 0.004 }, f: { biz: 6, lib: -4 } } },
      ] }; } },
  { key: 'prices', icon: '🛒', cat: '경제', cond: s => s.stats.infl > 2.8 || flowOf(s).oil > 125, score: s => 2 + Math.max(0, s.stats.infl - 2.5) * 1.5,
    make: s => ({ title: '장바구니 물가 비상 대책', desc: `물가상승률 ${s.stats.infl.toFixed(1)}%, 유가 ${FLOW_INFO.oil.fmt(flowOf(s).oil)}. "월급 빼고 다 올랐다"는 원성이 큽니다.`,
      choices: [
        { label: '유류세 30% 한시 인하', fx: { e: { infl: -0.5, fiscal: -0.4 }, ap: 2, f: { farm: 3 } } },
        { label: '공공요금 1년 동결', fx: { e: { infl: -0.35 }, mods: { fiscal: -0.1 }, ap: 1 } },
        { label: '한국은행에 금리 인상 신호', fx: { e: { infl: -0.6, gdp: -0.3, housing: 2 }, f: { biz: -4, youth: 2 } } },
        { label: '담합 일제 조사', fx: { e: { infl: -0.2, justice: 2 }, f: { biz: -5 }, risk: { p: 0.3, text: '조사 실효성 논란(지지율 -1)', fx: { ap: -1 } } } },
      ] }) },
  { key: 'youthjobs', icon: '🎓', cat: '고용', cond: s => s.stats.unemp > 3.3 || s.factions.youth < 38, score: s => 1.5 + Math.max(0, s.stats.unemp - 3) * 1.5,
    make: s => ({ title: '청년 일자리 긴급 패키지', desc: `실업률 ${s.stats.unemp.toFixed(1)}%. 청년층 지지 ${Math.round(s.factions.youth)}.`,
      choices: [
        { label: '공공 인턴 10만 명', fx: { e: { unemp: -0.3, fiscal: -0.2 }, f: { youth: 5 }, risk: { p: 0.35, text: '"단기 알바 일자리" 비판(청년 -4)', fx: { f: { youth: -4 } } } } },
        { label: '중소기업 채용 세액공제', fx: { e: { unemp: -0.2 }, mods: { unemp: -0.1 }, f: { biz: 4, youth: 2 } } },
        { label: '창업 바우처 1조 원', pc: 10, fx: { e: { innovation: 2, unemp: -0.1 }, f: { youth: 4 } } },
      ] }) },
  { key: 'chips', icon: '🔬', cat: '산업', cond: s => flowOf(s).tech > 50 || s.turn > 3, score: s => 1 + flowOf(s).tech / 40,
    make: s => { const n = DYN.pick([10, 20, 33]); return { title: `반도체·AI 특별법 (${n}조 원)`, desc: `${FLOW_INFO.tech.fmt(flowOf(s).tech)} 국면. 대만·미국·일본이 보조금 경쟁 중입니다.`,
      choices: [
        { label: '클러스터 보조금 전액 지원', pc: n / 2, fx: { e: { innovation: n / 6 }, mods: { gdp: n / 200 }, f: { biz: 5, local: 3 } } },
        { label: '주 52시간 예외 허용', fx: { e: { innovation: 3 }, mods: { gdp: 0.04 }, f: { labor: -8, biz: 6 } } },
        { label: '인재 양성에 집중', pc: 8, fx: { mods: { innovation: 2 }, e: { education: 2 }, f: { teach: 3 } } },
      ] }; } },
  { key: 'housingHot', icon: '🏠', cat: '부동산', cond: s => flowOf(s).econ > 20 && s.stats.housing < 45, score: s => 1.5 + (45 - s.stats.housing) / 10,
    make: s => ({ title: '수도권 집값 과열 대책', desc: `경기 호조에 유동성이 몰리며 ${DYN.pick(['강남 3구', '마용성', '분당·과천', '성수·용산'])} 호가가 급등합니다.`,
      choices: [
        { label: '대출 규제(DSR 강화)', fx: { e: { housing: 4, gdp: -0.15 }, f: { youth: -3, elder: 2 } } },
        { label: '3기 신도시 조기 공급', pc: 12, fx: { e: { housing: 3 }, mods: { housing: 1.5 }, f: { local: -2, youth: 4 } } },
        { label: '시장에 맡긴다', fx: { e: { housing: -3, gdp: 0.1 }, f: { youth: -5 } } },
      ] }) },
  { key: 'housingCrash', icon: '🏚️', cat: '부동산', cond: s => flowOf(s).econ < -35, score: s => 2,
    make: s => ({ title: '부동산 PF 부실 연쇄 우려', desc: `경기 침체로 건설사 ${DYN.pick(['3곳', '5곳', '7곳'])}이 부도 위기입니다. 금융권 전이 우려.`,
      choices: [
        { label: '정책금융 투입해 방어', pc: 15, fx: { e: { gdp: 0.3, debt: 1.5 }, f: { biz: 4, lib: -3 } } },
        { label: '부실 기업은 정리', fx: { e: { gdp: -0.4, unemp: 0.3, justice: 2 }, risk: { p: 0.35, text: '금융 불안 확산(성장률 -0.4)', fx: { e: { gdp: -0.4 } } } } },
      ] }) },
  { key: 'fx', icon: '💱', cat: '금융', cond: s => flowOf(s).econ < -40 || (inWar(s) && DYN.chance(0.5)), score: s => 2.2,
    make: s => { const r = DYN.pick([1480, 1550, 1620]); return { title: `환율 ${r}원 돌파, 외환 방어`, desc: '외국인 자금이 빠지고 원화 가치가 급락하고 있습니다.',
      choices: [
        { label: '외환보유액 투입', fx: { e: { infl: -0.3 }, pcap: -10 } },
        { label: '미국과 통화스와프 요청', fx: { e: { infl: -0.4, gdp: 0.1 }, rel: { us: -2 }, risk: { p: 0.3, text: '협상 결렬(물가 +0.4)', fx: { e: { infl: 0.4 } } } } },
        { label: '수출 기회로 활용', fx: { e: { gdp: 0.2, infl: 0.5 }, f: { biz: 4 } } },
      ] }; } },
  { key: 'energy', icon: '⚡', cat: '에너지', cond: s => flowOf(s).oil > 135, score: s => 1.5 + (flowOf(s).oil - 130) / 30,
    make: s => ({ title: '에너지 안보 비상 계획', desc: `유가 ${FLOW_INFO.oil.fmt(flowOf(s).oil)}. 겨울철 가스 수급도 불안합니다.`,
      choices: [
        { label: '원전 가동률 최대', fx: { e: { infl: -0.3, env: -1 }, f: { lib: -3, con: 3 } } },
        { label: '전략비축유 방출', fx: { e: { infl: -0.4 }, pcap: -6 } },
        { label: '재생에너지 긴급 투자', pc: 12, fx: { mods: { env: 1, infl: -0.1 }, f: { lib: 4, youth: 3 } } },
      ] }) },
  { key: 'smallbiz', icon: '🏪', cat: '민생', cond: s => flowOf(s).econ < -15 || s.stats.happiness < 38, score: s => 1.4,
    make: s => ({ title: '자영업자 폐업 대란', desc: `${DYN.pick(['치킨집', '카페', '노래방', 'PC방'])} 폐업률이 역대 최고입니다. 대출 만기가 몰려 있습니다.`,
      choices: [
        { label: '대출 만기 1년 연장', fx: { e: { happiness: 1 }, ap: 1, risk: { p: 0.25, text: '부실 이연 비판(채무 +1)', fx: { e: { debt: 1 } } } } },
        { label: '폐업 지원·재취업 교육', pc: 6, fx: { e: { unemp: -0.1, welfare: 1 }, f: { labor: 3 } } },
        { label: '최저임금 동결', fx: { e: { unemp: -0.1 }, f: { biz: 5, labor: -7 } } },
      ] }) },
  /* --- 사회 --- */
  { key: 'birth', icon: '👶', cat: '인구', cond: s => s.stats.tfr < 0.9, score: s => 1 + (0.9 - s.stats.tfr) * 6,
    make: s => { const n = DYN.pick([1000, 2000, 3000]); return { title: `출생아 1명당 ${n}만 원 지급안`, desc: `합계출산율 ${s.stats.tfr.toFixed(2)}명. 인구 감소가 가속합니다.`,
      choices: [
        { label: `${n}만 원 현금 지급`, fx: { e: { tfr: n / 40000, fiscal: -n / 3000 }, ap: 1, f: { youth: 3 }, risk: { p: 0.4, text: '"효과 없다"는 연구 발표(출산율 효과 절반)', fx: { e: { tfr: -n / 80000 } } } } },
        { label: '육아휴직 급여 100%', pc: 10, fx: { mods: { tfr: 0.02 }, e: { happiness: 1 }, f: { biz: -3, youth: 4 } } },
        { label: '이민청 신설', fx: { mods: { unemp: -0.05, gdp: 0.03 }, f: { con: -4, biz: 4, local: 2 } } },
      ] }; } },
  { key: 'disaster', icon: '🌊', cat: '안전', cond: s => flowOf(s).climate > 45, score: s => flowOf(s).climate / 30,
    make: s => ({ title: '기후 재난 대응 체계 개편', desc: `기후 위험 ${FLOW_INFO.climate.fmt(flowOf(s).climate)}. ${DYN.pick(['극한 호우', '초강력 태풍', '폭염 사망자', '대형 산불'])}이(가) 해마다 커집니다.`,
      choices: [
        { label: '도시 방재 인프라 투자', pc: 14, fx: { mods: { safety: 1.5 }, e: { env: 1 }, f: { local: 4 } } },
        { label: '재난 컨트롤타워 일원화', fx: { e: { safety: 3, justice: 1 }, ap: 1 } },
        { label: '탄소중립 목표 상향', fx: { mods: { env: 2, gdp: -0.04 }, f: { lib: 5, biz: -5 } } },
      ] }) },
  { key: 'medical', icon: '🏥', cat: '의료', cond: s => s.turn >= 2 && s.stats.health < 66, score: s => 1.2,
    make: s => ({ title: '지역 응급실 공백 사태', desc: `${DYN.pick(['경북', '전남', '강원', '충북'])}에서 응급실을 찾지 못한 환자가 숨졌습니다.`,
      choices: [
        { label: '지역 의사제 도입', fx: { mods: { health: 1.5 }, f: { medic: -8, local: 6 } } },
        { label: '응급의료 수가 2배', pc: 8, fx: { e: { health: 2 }, f: { medic: 5 } } },
        { label: '닥터헬기 전국 배치', pc: 12, fx: { e: { health: 2, safety: 1 }, ap: 1 } },
      ] }) },
  { key: 'elderPoverty', icon: '👵', cat: '복지', cond: s => s.factions.elder < 45 || s.stats.welfare < 50, score: s => 1.2,
    make: s => ({ title: '노인 빈곤율 OECD 1위 대책', desc: '폐지 줍는 노인 실태 보도로 여론이 들끓습니다.',
      choices: [
        { label: '기초연금 10만 원 인상', fx: { e: { welfare: 2, fiscal: -0.3 }, f: { elder: 7 } } },
        { label: '노인 일자리 확대', pc: 6, fx: { e: { welfare: 1, unemp: -0.05 }, f: { elder: 4 } } },
        { label: '국민연금 개혁과 묶어 처리', fx: { mods: { fiscal: 0.15 }, f: { elder: -3, youth: 4 } } },
      ] }) },
  { key: 'local', icon: '🏘️', cat: '지방', cond: s => s.factions.local < 45 || s.turn > 6, score: s => 1,
    make: s => ({ title: '지방 소멸 위기 지역 지원', desc: `${DYN.pick(['의성', '고흥', '삼척', '봉화', '군위'])} 등 89개 시군이 소멸 위험입니다.`,
      choices: [
        { label: '공공기관 2차 이전', fx: { mods: { gdp: -0.02 }, f: { local: 8, youth: -2 } } },
        { label: '지방 정착 청년 월 50만 원', pc: 8, fx: { f: { local: 5, youth: 3 }, mods: { tfr: 0.005 } } },
        { label: '광역 메가시티 육성', pc: 10, fx: { mods: { gdp: 0.03 }, f: { local: 4 } } },
      ] }) },
  { key: 'cyber', icon: '🛡️', cat: '안보', cond: s => s.turn >= 2, score: s => 0.8 + (s.world?.tension || 30) / 80,
    make: s => ({ title: `${DYN.pick(['통신사', '은행', '병원', '공항'])} 대규모 해킹 이후 사이버 안보`, desc: '배후로 국가 해커 조직이 지목됩니다.',
      choices: [
        { label: '사이버안보청 신설', pc: 10, fx: { mods: { security: 1, safety: 1 }, f: { mil: 3 } } },
        { label: '보복 해킹 승인', fx: { e: { security: 2 }, tension: 3, rel: { nk: -4 } } },
        { label: '민간 보안 규제 강화', fx: { e: { safety: 2, innovation: -1 }, f: { biz: -3 } } },
      ] }) },
  { key: 'unity', icon: '🤝', cat: '정치', cond: s => flowOf(s).mood < -12 || s.approval < 35, score: s => 1.5 + Math.max(0, 35 - s.approval) / 10,
    make: s => ({ title: '국민 통합 대책', desc: `민심 ${FLOW_INFO.mood.fmt(flowOf(s).mood)}. 광장이 둘로 쪼개져 매주 집회가 열립니다.`,
      choices: [
        { label: '여야 영수회담 정례화', fx: { ap: 2, f: { con: 2, lib: 2 } } },
        { label: '대통령 국민 대담 생중계', fx: { risk: { p: 0.45, text: '말실수 논란(지지율 -3)', fx: { ap: -3 } }, ap: 3 } },
        { label: '특별사면', fx: { ap: -1, e: { justice: -2 }, f: { con: 4, lib: -4 } } },
      ] }) },
  /* --- 전쟁·영토 --- */
  { key: 'warbond', icon: '🎖️', cat: '전시', cond: inWar, score: s => 3,
    make: s => { const n = DYN.pick([30, 50, 80]); return { title: `전시 국채 ${n}조 원 발행`, desc: '전쟁 비용이 하루하루 불어납니다. 국민 참여형 "승리 국채"를 내자는 제안입니다.',
      choices: [
        { label: '승리 국채 발행', fx: { pcap: n / 2, e: { debt: n / 30 }, ap: 1 } },
        { label: '전쟁세 신설', fx: { pcap: n / 2.5, ap: -3, f: { biz: -4 } } },
        { label: '동맹국 차관 요청', fx: { pcap: n / 3, rel: { us: -2, jp: -1 } } },
      ] }; } },
  { key: 'warcontrol', icon: '📻', cat: '전시', cond: s => inWar(s) && s.war.theater.days > 40, score: s => 2.5,
    make: s => ({ title: '전시 통제 수위', desc: '가짜뉴스와 사재기가 퍼지고, 반전 집회도 열립니다.',
      choices: [
        { label: '언론·집회 전시 통제', fx: { e: { freedom: -5, safety: 3 }, f: { lib: -6, con: 3 } } },
        { label: '생필품 배급제', fx: { e: { infl: -0.6, happiness: -2 }, f: { elder: 2 } } },
        { label: '대통령 대국민 연설', fx: { ap: 2, risk: { p: 0.3, text: '"현실 회피" 비판(지지율 -2)', fx: { ap: -2 } } } },
      ] }) },
  { key: 'reserve', icon: '🪖', cat: '전시', cond: s => inWar(s) && (s.war.theater.kr?.org ?? 60) < 55, score: s => 3,
    make: s => ({ title: '예비군 추가 동원령', desc: '전선 부대의 피로가 쌓여 교대 병력이 부족합니다.',
      choices: [
        { label: '예비군 30만 명 동원', fx: { e: { unemp: -0.3, gdp: -0.3 }, ap: -2, war: { kr: { mp: 8, org: 10 } } } },
        { label: '외국 의용군 모집', pc: 10, fx: { war: { kr: { mp: 4 } }, rel: { us: 1 } } },
        { label: '현 병력으로 버틴다', fx: { war: { kr: { org: 4 } } } },
      ] }) },
  { key: 'rebuild', icon: '🏗️', cat: '전후', cond: s => flowOf(s).warEnded != null && s.turn - flowOf(s).warEnded <= 4, score: s => 3,
    make: s => ({ title: '전후 재건 특별법', desc: '전쟁이 끝났습니다. 파괴된 도시와 상이군인, 늘어난 국가채무가 남았습니다.',
      choices: [
        { label: '재건 뉴딜 (대규모 공공투자)', pc: 15, fx: { mods: { gdp: 0.1 }, e: { unemp: -0.4, debt: 2 }, ap: 2 } },
        { label: '보훈·상이군인 지원', pc: 6, fx: { f: { mil: 8, elder: 3 }, ap: 1 } },
        { label: '군 감축·평화 배당', fx: { e: { security: -3, fiscal: 0.4 }, f: { lib: 5, mil: -6 } } },
      ] }) },
  { key: 'armsExport', icon: '🚀', cat: '방산', cond: s => (s.tech?.done?.length || 0) >= 3, score: s => 1 + (s.tech.done.length) / 8,
    make: s => { const n = DYN.pick(['폴란드', '사우디', '인도네시아', '루마니아', '호주', '이집트']); return { title: `${n} 대규모 방산 수출 협상`, desc: `개발한 무기 ${s.tech.done.length}종이 해외에서 주목받고 있습니다.`,
      choices: [
        { label: '전차·자주포 패키지 수출', fx: { pcap: 18, mods: { gdp: 0.03 }, f: { mil: 4, biz: 4 } } },
        { label: '기술 이전까지 포함해 대형 계약', fx: { pcap: 30, e: { innovation: -1 }, risk: { p: 0.25, text: '기술 유출 논란(지지율 -2)', fx: { ap: -2 } } } },
        { label: '분쟁국 수출은 자제', fx: { e: { freedom: 1 }, f: { lib: 3 } } },
      ] }; } },
  { key: 'border', icon: '🧱', cat: '영토', cond: s => terrCount(s) >= 1, score: s => 1 + terrCount(s) * 0.5,
    make: s => ({ title: '새 국경 관리 체계', desc: `점령·편입 지역 ${terrCount(s)}곳. 밀수·월경·게릴라 침투가 늘고 있습니다.`,
      choices: [
        { label: '국경수비대 창설', pc: 10, fx: { e: { safety: 2, security: 2 }, f: { mil: 3 } } },
        { label: '경제특구로 개방', fx: { mods: { gdp: 0.04 }, e: { safety: -2 }, f: { biz: 5 } } },
        { label: '이주 제한 강화', fx: { e: { freedom: -2, safety: 1 }, f: { con: 3, lib: -3 } } },
      ] }) },
  { key: 'assimilate', icon: '🗺️', cat: '영토', cond: s => terrCount(s) >= 2, score: s => 1.5,
    make: s => ({ title: '편입 지역 통합 방향', desc: '편입 주민의 시민권·언어·교육을 어떻게 할지 국론이 갈립니다.',
      choices: [
        { label: '시민권 즉시 부여', fx: { ap: -1, mods: { gdp: 0.05 }, f: { con: -4, lib: 4 }, terr: { resist: -8 } } },
        { label: '단계적 동화 교육', pc: 8, fx: { terr: { resist: -4, integ: 6 } } },
        { label: '자치 보장', fx: { terr: { resist: -10 }, f: { con: -3 }, e: { security: -1 } } },
      ] }) },
  /* --- 국력·외교 --- */
  { key: 'usBurden', icon: '💵', cat: '외교', cond: s => flowOf(s).us < -25, score: s => 2.2,
    make: s => { const n = DYN.pick([3, 5, 8]); return { title: `미국, 방위비 분담금 ${n}배 인상 요구`, desc: `${FLOW_INFO.us.fmt(flowOf(s).us)} 노선의 미 행정부가 "안 내면 주한미군 감축"을 거론합니다.`,
      choices: [
        { label: '일부 수용', fx: { pcap: -n * 3, rel: { us: 6 } } },
        { label: '자주국방 선언', fx: { rel: { us: -8 }, mods: { security: 1 }, e: { fiscal: -0.3 }, f: { mil: 5, con: -2, lib: 3 } } },
        { label: '무기 구매로 대신', fx: { pcap: -n * 2, rel: { us: 4 }, e: { security: 2 } } },
      ] }; } },
  { key: 'cnPress', icon: '🐉', cat: '외교', cond: s => flowOf(s).cn > 60, score: s => 1.5 + (flowOf(s).cn - 60) / 15,
    make: s => ({ title: '중국 압박 대응 기조', desc: `중국 공세 ${FLOW_INFO.cn.fmt(flowOf(s).cn)}. ${DYN.pick(['서해 구조물 설치', '한한령 재개', '요소수 수출 통제', '군용기 KADIZ 진입'])}이(가) 이어집니다.`,
      choices: [
        { label: '한·미·일 공조 강화', fx: { rel: { us: 4, jp: 4, cn: -8 }, e: { security: 2 }, tension: 2 } },
        { label: '전략적 모호성 유지', fx: { rel: { cn: 2, us: -2 } } },
        { label: '공급망 탈중국', pc: 10, fx: { rel: { cn: -5 }, mods: { gdp: -0.02, innovation: 1 }, f: { biz: -2 } } },
      ] }) },
  { key: 'globalAid', icon: '🌍', cat: '국제', cond: s => rankOf(s) <= 10, score: s => 1.2 + (10 - rankOf(s)) / 5,
    make: s => ({ title: '글로벌 중추국가 원조 구상', desc: `국력 세계 ${rankOf(s)}위. 개발도상국들이 한국형 발전 모델 지원을 요청합니다.`,
      choices: [
        { label: 'ODA 2배 확대', pc: 12, fx: { rel: { eu: 4, us: 2 }, ap: -1, threat: -4 } },
        { label: '새마을·디지털 정부 수출', pc: 6, fx: { rel: { eu: 2 }, mods: { gdp: 0.02 }, threat: -2 } },
        { label: '국내가 먼저', fx: { ap: 1, threat: 2 } },
      ] }) },
  { key: 'hegemonOrder', icon: '👑', cat: '국제', cond: s => rankOf(s) <= 3, score: s => 2,
    make: s => ({ title: '새 국제 질서 구상', desc: '세계가 한국의 다음 행보를 지켜봅니다. 어떤 질서를 내세울지 정해야 합니다.',
      choices: [
        { label: '"아시아 평화 공동체" 제창', pc: 15, fx: { threat: -10, rel: { cn: 4, jp: 4 }, tension: -5 } },
        { label: '서울 컨센서스(경제 블록)', pc: 15, fx: { mods: { gdp: 0.08 }, threat: 4 } },
        { label: '힘에 의한 평화', fx: { e: { security: 4 }, threat: 8, tension: 4, f: { mil: 6 } } },
      ] }) },
  { key: 'refugee', icon: '🚢', cat: '국제', cond: s => (s.world?.conflicts?.length || 0) >= 2, score: s => 1.2,
    make: s => { const c = DYN.pick(s.world.conflicts); return { title: `${cname(c.a)} 분쟁 난민 수용 요청`, desc: `유엔난민기구가 ${DYN.pick([5000, 10000, 30000])}명 수용을 요청했습니다.`,
      choices: [
        { label: '전원 수용', fx: { rel: { eu: 4 }, e: { safety: -1, freedom: 2 }, f: { lib: 4, con: -5 } } },
        { label: '재정 지원만', fx: { pcap: -5, rel: { eu: 2 } } },
        { label: '거부', fx: { rel: { eu: -3 }, f: { con: 3 } } },
      ] }; } },
  { key: 'space', icon: '🛰️', cat: '과학', cond: s => s.turn >= 8, score: s => 0.9,
    make: s => ({ title: DYN.pick(['달 착륙선 독자 개발', '한국형 GPS(KPS) 앞당기기', '민간 우주발사장 유치']), desc: '우주항공청이 국가 프로젝트를 건의했습니다.',
      choices: [
        { label: '국가 프로젝트로 추진', pc: 14, fx: { mods: { innovation: 1.5 }, e: { happiness: 1 }, ap: 1, risk: { p: 0.3, text: '발사 실패(지지율 -2)', fx: { ap: -2 } } } },
        { label: '민간에 맡긴다', fx: { e: { innovation: 1 }, f: { biz: 3 } } },
        { label: '보류', fx: {} },
      ] }) },
  { key: 'pandemic', icon: '🦠', cat: '보건', cond: s => s.turn >= 3 && DYN.chance(0.25), score: s => 2,
    make: s => ({ title: `신종 ${DYN.pick(['호흡기 바이러스', '조류 인플루엔자', '변종 엠폭스'])} 확산 대비`, desc: '해외에서 확진자가 급증합니다. 국내 유입은 시간문제입니다.',
      choices: [
        { label: '입국 제한·선제 방역', fx: { e: { health: 2, gdp: -0.2 }, rel: { cn: -2 } } },
        { label: '백신 선구매', pc: 10, fx: { e: { health: 3 }, ap: 1 } },
        { label: '경제 우선, 모니터링만', fx: { risk: { p: 0.5, text: '대유행(성장률 -0.6, 지지율 -3)', fx: { e: { gdp: -0.6 }, ap: -3 } } } },
      ] }) },
];

function sitState(s) { return (s.sit = s.sit || { list: [], seen: {} }); }
function genSitPolicies(s, max = 4) {
  const S2 = sitState(s);
  S2.list = S2.list.filter(p => p.exp >= s.turn);
  const have = new Set(S2.list.map(p => p.key));
  const pool = SIT_POLICIES.filter(t => !have.has(t.key) && !(S2.seen[t.key] != null && s.turn - S2.seen[t.key] < 6)).filter(t => { try { return t.cond(s); } catch { return false; } });
  while (S2.list.length < max && pool.length) {
    const w = pool.map(t => { try { return Math.max(0.2, t.score(s)) * (0.6 + Math.random() * 0.8); } catch { return 0.5; } });
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    for (; i < w.length - 1; i++) if ((r -= w[i]) <= 0) break;
    const t = pool.splice(i, 1)[0];
    try { const m = t.make(s); S2.list.push({ id: uid(), key: t.key, icon: t.icon, cat: t.cat, turn: s.turn, exp: s.turn + 2, ...m }); S2.seen[t.key] = s.turn; } catch {}
  }
}

function sitApplyExtra(s, fx, k) {
  if (fx.war && inWar(s)) { const T = s.war.theater; for (const side in fx.war) for (const x in fx.war[side]) if (T[side] && T[side][x] != null) T[side][x] = clamp(T[side][x] + fx.war[side][x] * k, 0, x === 'equip' ? 1 : 100000); }
  if (fx.terr && s.terr) for (const t of Object.values(s.terr)) for (const x in fx.terr) if (t[x] != null) t[x] = clamp(t[x] + fx.terr[x] * k, 0, 100);
}
function adoptSitPolicy(s, id, i) {
  const S2 = sitState(s); const p = S2.list.find(x => x.id === id); if (!p) return { ok: false, msg: '이미 처리된 정책안입니다.' };
  const c = p.choices[i]; if (!c) return { ok: false, msg: '선택지가 없습니다.' };
  if (c.pc && s.pcap < c.pc) return { ok: false, msg: `국고 ${won(c.pc)}이 필요합니다.` };
  if (c.pc) s.pcap -= c.pc;
  const R = rollPerf(s, p.cat === '경제' || p.cat === '금융');
  const fx = c.fx || {};
  applyFx(s, { ...fx, risk: undefined }, R.k); sitApplyExtra(s, fx, R.k);
  let extra = '';
  if (fx.risk && Math.random() < fx.risk.p * (R.id === 'back' ? 1.6 : R.id === 'great' ? 0.4 : 1)) { applyFx(s, fx.risk.fx || {}); extra = ` ⚠️ ${fx.risk.text.replace(/\(.*\)$/, '')}`; }
  S2.list = S2.list.filter(x => x !== p);
  const text = `${p.icon} [시국 정책] ${p.title} → ${c.label} · 성과 ${R.icon}${R.name}${extra}`;
  addLog(s, R.type === 'bad' || extra ? 'bad' : 'good', text);
  return { ok: true, msg: text, perf: R };
}

/* ---- Claude가 직접 기획하는 시국 정책안 ---- */
const SIT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'desc', 'icon', 'choices'],
  properties: {
    title: { type: 'string' }, desc: { type: 'string' }, icon: { type: 'string' },
    choices: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'cost', 'effects', 'approval'],
      properties: { label: { type: 'string' }, cost: { type: 'number' }, approval: { type: 'number' },
        effects: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['stat', 'delta'], properties: { stat: { type: 'string', enum: Object.keys(STATS) }, delta: { type: 'number' } } } },
        factions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['faction', 'delta'], properties: { faction: { type: 'string', enum: Object.keys(FACTIONS) }, delta: { type: 'number' } } } },
        relations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['country', 'delta'], properties: { country: { type: 'string', enum: Object.keys(RELATIONS) }, delta: { type: 'number' } } } } } } },
  },
};
const SIT_LIM = { gdp: 0.6, unemp: 0.5, infl: 0.8, debt: 4, fiscal: 0.8, tfr: 0.05, gini: 0.01 };
function sitSummary(s) {
  const F = flowOf(s);
  return [`${turnLabel(s.turn).year}년 ${turnLabel(s.turn).q}분기, 지지율 ${s.approval.toFixed(0)}%, 국고 ${won(s.pcap)}`,
    `지표: ${Object.entries(STATS).map(([k, m]) => `${m.name} ${fmtStat(k, s.stats[k])}`).join(', ')}`,
    `세계 흐름: ${Object.entries(FLOW_INFO).map(([k, m]) => `${m.name} ${m.fmt(F[k])}`).join(', ')}`,
    `관계: ${Object.entries(RELATIONS).map(([k, m]) => `${m.name} ${Math.round(s.rel[k])}`).join(', ')}`,
    inWar(s) ? `전쟁 중: ${cname(s.war.k)}와 교전 ${s.war.theater.days}일째` : '전쟁 없음',
    `점령·편입 지역 ${terrCount(s)}곳, 국력 순위 ${rankOf(s)}위`,
    `최근 사건: ${s.log.slice(0, 5).map(l => l.text).join(' / ')}`].join('\n');
}
async function aiSitPolicy(s, hint = '') {
  const prompt = `당신은 한국 대통령실 정책기획수석입니다. 아래 게임 속 국가 상황을 보고, 지금 이 시점에 실제로 있을 법한 '시국 정책안' 하나를 기획하세요.
${sitSummary(s)}
${hint ? `대통령의 주문: ${hint}\n` : ''}
조건: 제목은 구체적으로(숫자·지명 포함 가능), desc는 왜 지금 이 정책이 필요한지 1~2문장. 선택지 3개는 서로 성격이 다르고 장단점이 뚜렷해야 합니다.
cost는 국고 소요(0~20, 단위 게임 포인트), approval은 지지율 변화(-4~4), effects의 delta 범위: 성장률·실업률·물가 ±0.6, 국가채무 ±4, 재정수지 ±0.8, 출산율 ±0.05, 지니 ±0.01, 나머지 0~100 지표 ±5. icon은 이모지 하나.`;
  let r;
  if (typeof ClaudeAI !== 'undefined' && ClaudeAI.enabled() && ClaudeAI.rawCall) r = await ClaudeAI.rawCall({ system: '한국어로 답합니다. 게임 밸런스를 지키는 정책 기획자입니다.', user: prompt, schema: SIT_SCHEMA });
  else throw new Error('Claude AI 연결이 필요합니다(설정에서 켜기).');
  const lim = k => SIT_LIM[k] ?? 5;
  const choices = (r.choices || []).slice(0, 4).map(c => {
    const fx = { e: {}, f: {}, rel: {}, ap: clamp(+c.approval || 0, -4, 4) };
    for (const x of c.effects || []) if (STATS[x.stat] && isFinite(+x.delta)) fx.e[x.stat] = clamp(+x.delta, -lim(x.stat), lim(x.stat));
    for (const x of c.factions || []) if (FACTIONS[x.faction] && isFinite(+x.delta)) fx.f[x.faction] = clamp(+x.delta, -8, 8);
    for (const x of c.relations || []) if (RELATIONS[x.country] && isFinite(+x.delta)) fx.rel[x.country] = clamp(+x.delta, -8, 8);
    return { label: String(c.label || '').slice(0, 60), pc: clamp(Math.round(+c.cost || 0), 0, 20), fx };
  }).filter(c => c.label);
  if (choices.length < 2) throw new Error('AI 정책안 형식이 올바르지 않습니다.');
  const S2 = sitState(s);
  const p = { id: uid(), key: 'ai_' + uid(), icon: String(r.icon || '🧠').slice(0, 4), cat: 'AI 기획', ai: true, turn: s.turn, exp: s.turn + 3, title: String(r.title).slice(0, 60), desc: String(r.desc || '').slice(0, 200), choices };
  S2.list.unshift(p); if (S2.list.length > 6) S2.list.pop();
  return p;
}

/* ---------------- 4) 외교 행동 확장 ---------------- */
const dipCd = (s, k, id) => (dip(s, k).cds = dip(s, k).cds || {})[id] > s.turn ? '최근에 했습니다. 잠시 후 다시 할 수 있습니다.' : null;
const dipSetCd = (s, k, id, n) => { (dip(s, k).cds = dip(s, k).cds || {})[id] = s.turn + n; };
const notBloc = (s, k) => cinfo(k).isBloc ? '블록에는 쓸 수 없습니다. 회원국을 고르세요.' : null;
const NEW_DIPLO = [
  { id: 'envoy', name: '특사 파견', icon: '🕴️', pc: 4, desc: '물밑 대화. 결과는 그때그때 다릅니다(관계 -2~+10).',
    can: (s, k) => dipCd(s, k, 'envoy'),
    run: (s, k) => { dipSetCd(s, k, 'envoy', 1); const r = Math.round(gauss() * 4 + 4 + flowOf(s).luck * 20); relBump(s, k, clamp(r, -2, 10), r > 6 ? 2 : 0); return r >= 7 ? `특사가 ${cname(k)} 정상과 깊은 대화를 나눴습니다. 관계 +${r}.` : r >= 2 ? `${cname(k)}에 특사를 보냈습니다. 반응은 무난했습니다(관계 +${r}).` : `❌ ${cname(k)}이(가) 특사를 냉대했습니다(관계 ${r}).`; } },
  { id: 'culture', name: '한류 문화 교류', icon: '🎤', pc: 5, desc: '케이팝·드라마 문화원 행사. 관계 +4(지속 +2), 국민 행복 +.',
    can: (s, k) => notBloc(s, k) || dipCd(s, k, 'culture') || (k === 'nk' && relOf(s, k) < 40 ? '북한이 "괴뢰 문화"라며 거부합니다.' : null),
    run: (s, k) => { dipSetCd(s, k, 'culture', 3); relBump(s, k, 4, 2); s.stats.happiness += 0.3; return `${cname(k)}에서 한류 페스티벌을 열었습니다. ${DYN.pick(['현지 팬 10만 명이 몰렸습니다.', '현지 방송이 생중계했습니다.', '현지 청년층 호감도가 크게 올랐습니다.'])}`; } },
  { id: 'arms', name: '무기 수출', icon: '🚀', pc: 3, desc: '관계 50 이상. 국고 수입(개발한 무기 수 비례), 관계 +3. 상대의 적국은 반발.',
    can: (s, k) => notBloc(s, k) || dipCd(s, k, 'arms') || (relOf(s, k) < 50 ? '관계 50 이상 필요.' : ['cn', 'ru', 'nk'].includes(k) ? '전략 경쟁국에는 수출할 수 없습니다.' : null),
    run: (s, k) => { dipSetCd(s, k, 'arms', 4); const n = (s.tech?.done?.length || 0); const gain = Math.round((8 + n * 1.5) * (0.6 + ecoK(k) * 0.5) * (0.8 + Math.random() * 0.5)); s.pcap += gain; relBump(s, k, 3, 3); s.factions.mil = clamp(s.factions.mil + 2, 0, 100); if (['pak', 'irn', 'syr'].includes(k)) relBump(s, 'us', -3, -2); return `${cname(k)}에 ${DYN.pick(['K2 전차', 'K9 자주포', 'FA-50 경공격기', '천궁 방공 체계', '레드백 장갑차'])}를 수출했습니다. 국고 +${won(gain)}.`; } },
  { id: 'techco', name: '기술 협력 협정', icon: '🔬', pc: 10, desc: '관계 60 이상. 산업 경쟁력 +, 성장 소폭 +.',
    can: (s, k) => notBloc(s, k) || dipCd(s, k, 'techco') || (relOf(s, k) < 60 ? '관계 60 이상 필요.' : null),
    run: (s, k) => { dipSetCd(s, k, 'techco', 6); const g = clamp(cinfo(k).eco / 40, 0.3, 2); s.mods.innovation += 0.8 * g; s.mods.gdp += 0.015 * g; relBump(s, k, 3, 3); return `${cname(k)}과(와) ${DYN.pick(['AI·반도체', '배터리·소재', '원전·SMR', '우주·위성', '바이오'])} 기술 협력 협정을 맺었습니다.`; } },
  { id: 'swap', name: '통화 스와프', icon: '💱', pc: 8, desc: '관계 65·경제 규모 40 이상. 외환 위기 방어(물가 안정), 관계 +3.',
    can: (s, k) => (k !== 'eu' && notBloc(s, k)) || (dip(s, k).swap ? '이미 체결했습니다.' : relOf(s, k) < 65 ? '관계 65 이상 필요.' : cinfo(k).eco < 40 ? '경제 규모가 작습니다.' : null),
    run: (s, k) => { dip(s, k).swap = true; s.mods.infl -= 0.1 * ecoK(k); s.stats.infl -= 0.2; relBump(s, k, 3, 3); return `${cname(k)}과(와) 통화 스와프를 체결했습니다. 외환시장이 안정됩니다.`; } },
  { id: 'visa', name: '비자 면제', icon: '🛂', pc: 4, desc: '관계 +5(지속 +3), 관광·교류 활성(행복 +), 치안 소폭 -.',
    can: (s, k) => notBloc(s, k) || (dip(s, k).visa ? '이미 면제 중입니다.' : relOf(s, k) < 45 ? '관계 45 이상 필요.' : k === 'nk' ? '불가합니다.' : null),
    run: (s, k) => { dip(s, k).visa = true; relBump(s, k, 5, 3); s.mods.happiness += 0.2; s.stats.safety -= 0.5; return `${cname(k)}과(와) 상호 비자 면제에 합의했습니다.`; } },
  { id: 'loan', name: '개발 차관', icon: '🏦', pc: 0, desc: '경제 규모 60 미만 국가에 국고를 빌려줌. 관계 +10. 8분기 뒤 원리금(+25%) 회수… 상대가 망하면 떼임.',
    cost: (s, k) => Math.round(10 + cinfo(k).eco * 0.2),
    can: (s, k) => notBloc(s, k) || (cinfo(k).eco >= 60 ? '선진국은 차관이 필요 없습니다.' : (s.loans || []).some(l => l.k === k) ? '이미 차관이 있습니다.' : null),
    run: (s, k) => { const amt = Math.round(10 + cinfo(k).eco * 0.2); (s.loans = s.loans || []).push({ k, amt, due: s.turn + 8 }); relBump(s, k, 10, 4); return `${cname(k)}에 ${won(amt)} 규모의 개발 차관을 제공했습니다. 8분기 뒤 상환 예정.`; } },
  { id: 'drill', name: '연합 군사훈련', icon: '🎯', pc: 8, desc: '동맹국만. 안보 +2, 관계 +4. 북·중·러 반발, 세계 긴장 +.',
    can: (s, k) => dip(s, k).alliance ? dipCd(s, k, 'drill') : '동맹국만 가능합니다.',
    run: (s, k) => { dipSetCd(s, k, 'drill', 2); s.stats.security += 2; relBump(s, k, 4, 2); relBump(s, 'nk', -4, -1); relBump(s, 'cn', -2, 0); if (s.world) s.world.tension = clamp(s.world.tension + 2, 0, 100); return `${cname(k)}과(와) ${DYN.pick(['대규모 연합 상륙훈련', '연합 공중훈련', '해상 기동훈련', '사이버 연합훈련'])}을 실시했습니다.`; } },
  { id: 'mediate', name: '분쟁 중재', icon: '🕊️', pc: 12, desc: '이 나라가 얽힌 분쟁을 중재. 성공하면 위상·관계 크게 상승, 실패하면 체면 손상.',
    can: (s, k) => (s.world?.conflicts || []).some(c => c.a === k || c.b === k) ? dipCd(s, k, 'mediate') : '이 나라가 얽힌 분쟁이 없습니다.',
    run: (s, k) => {
      dipSetCd(s, k, 'mediate', 3); const c = s.world.conflicts.find(c => c.a === k || c.b === k);
      const p = clamp(0.3 + (relOf(s, c.a) + relOf(s, c.b) - 100) / 200 + (20 - rankOf(s)) / 60 + flowOf(s).luck * 3, 0.1, 0.85);
      if (Math.random() < p) { s.world.conflicts = s.world.conflicts.filter(x => x !== c); relBump(s, c.a, 8, 4); relBump(s, c.b, 8, 4); s.approval = clamp(s.approval + 3, 0, 100); s.world.tension = clamp(s.world.tension - 5, 0, 100); if (typeof addThreat === 'function') addThreat(s, -3); return `✅ 서울 평화회담 성공! ${cname(c.a)}${c.b !== c.a ? '·' + cname(c.b) : ''} 분쟁이 종식됐습니다. (성공 확률 ${Math.round(p * 100)}%)`; }
      relBump(s, c.a, -3, 0); s.approval = clamp(s.approval - 1, 0, 100); return `❌ 중재가 결렬됐습니다. 양측 모두 한국의 제안을 거부했습니다. (성공 확률 ${Math.round(p * 100)}%)`; } },
  { id: 'resource', name: '자원 공동개발', icon: '⛏️', pc: 14, desc: '관계 50 이상 개도국. 리튬·희토류·가스 확보: 성장 +, 물가 안정. 사업은 실패할 수도.',
    can: (s, k) => notBloc(s, k) || dipCd(s, k, 'resource') || (relOf(s, k) < 50 ? '관계 50 이상 필요.' : cinfo(k).eco >= 70 ? '자원 개발 대상국이 아닙니다.' : null),
    run: (s, k) => { dipSetCd(s, k, 'resource', 8); const res = DYN.pick(['리튬', '희토류', '니켈', 'LNG', '구리']); if (Math.random() < 0.7) { s.mods.gdp += 0.04; s.mods.infl -= 0.05; relBump(s, k, 4, 3); return `${cname(k)}과(와) ${res} 공동개발에 성공했습니다. 공급망이 든든해집니다.`; } relBump(s, k, 1, 0); return `❌ ${cname(k)} ${res} 광구에서 경제성이 나오지 않았습니다. 투자금을 잃었습니다.`; } },
  { id: 'students', name: '인재·유학생 교류', icon: '🎓', pc: 6, desc: '관계 +3, 산업 경쟁력·교육 소폭 +.',
    can: (s, k) => notBloc(s, k) || dipCd(s, k, 'students'),
    run: (s, k) => { dipSetCd(s, k, 'students', 4); relBump(s, k, 3, 2); s.mods.innovation += 0.3; s.stats.education += 0.5; return `${cname(k)}과(와) 인재 교류 프로그램을 시작했습니다.`; } },
  { id: 'recall', name: '대사 소환', icon: '📤', pc: 2, desc: '강력 항의. 관계 -8. 관계 30 미만이면 국내 지지 +1.',
    can: (s, k) => notBloc(s, k) || dipCd(s, k, 'recall'),
    run: (s, k) => { dipSetCd(s, k, 'recall', 2); const low = relOf(s, k) < 30; relBump(s, k, -8, -3); if (low) s.approval = clamp(s.approval + 1, 0, 100); return `${cname(k)} 주재 대사를 소환했습니다.${low ? ' 국내 여론은 "당당한 외교"라며 호평합니다.' : ''}`; } },
];
{
  const i = DIPLO_ACTIONS.findIndex(a => a.id === 'ultimatum');
  DIPLO_ACTIONS.splice(i < 0 ? DIPLO_ACTIONS.length : i, 0, ...NEW_DIPLO);
}
// 차관 상환: 상대 경제·안정·운에 따라 갚거나 떼임
HOOKS.postTurn.push(s => {
  if (!s.loans?.length) return;
  for (const l of s.loans.filter(l => l.due <= s.turn)) {
    const fail = s.annexed?.[l.k] || s.world?.owner?.[l.k] ? 0.9 : clamp(0.15 + (s.world?.conflicts || []).some(c => c.a === l.k || c.b === l.k) * 0.3 - flowOf(s).econ * 0.002, 0.05, 0.6);
    if (Math.random() < fail) { relBump(s, l.k, -4, 0); addLog(s, 'bad', `🏦 ${cname(l.k)}이(가) 차관 ${won(l.amt)}을 갚지 못했습니다(채무 불이행).`); }
    else { const back = Math.round(l.amt * 1.25); s.pcap += back; addLog(s, 'good', `🏦 ${cname(l.k)}이(가) 차관 원리금 ${won(back)}을 상환했습니다.`); }
  }
  s.loans = s.loans.filter(l => l.due > s.turn);
});

/* ---- 외교 정세 카드 (그때 상황에 맞는 나라를 골라 등장) ---- */
if (typeof EVENT_KINDS !== 'undefined') EVENT_KINDS.diplo = { cls: 'ev-diplomacy', name: '외교' };
const randCountry = (s, f) => { const ks = allCountryKeys().filter(k => { const c = cinfo(k); return c && !c.isBloc && k !== 'kr' && !RELATIONS[k] && !s.annexed?.[k] && !s.world?.owner?.[k] && !s.terr?.[k] && f(k, c); }); return ks.length ? DYN.pick(ks) : null; };
const dev = (s, f) => randCountry(s, (k, c) => c.eco < 55 && f(k, c));
const DIPLO_EVENTS = {
  armsBuyer: { w: 2, cond: s => (s.tech?.done?.length || 0) >= 1 && !!randCountry(s, (k) => relOf(s, k) >= 45), icon: '🚀',
    make: s => { const k = randCountry(s, (k) => relOf(s, k) >= 45); return { k, title: `${cname(k)}, 한국 무기 대량 구매 타진`, desc: `${cname(k)} 국방장관이 방한해 ${DYN.pick(['전차 300대', '자주포 200문', '전투기 48대', '호위함 6척'])} 구매를 타진했습니다. 조건은 현지 생산입니다.` }; },
    choices: [
      { label: '현지 생산까지 수용', desc: '국고 대폭 +, 관계 +6, 기술 유출 우려.', run: (s, ev) => { const g = Math.round(rnd(20, 35)); s.pcap += g; relBump(s, ev.k, 6, 3); s.stats.innovation -= 1; return `역대급 방산 계약! 국고 +${won(g)}.`; } },
      { label: '완제품만 판매', desc: '50% 확률로 성사(국고 +), 실패 시 관계 -3.', run: (s, ev) => { if (coin(0.5 + flowOf(s).luck * 3)) { const g = Math.round(rnd(12, 20)); s.pcap += g; relBump(s, ev.k, 3, 1); return `완제품 계약 성사. 국고 +${won(g)}.`; } relBump(s, ev.k, -3, 0); return '상대가 경쟁국 무기로 돌아섰습니다.'; } },
      { label: '거절', desc: '분쟁 연루를 피함.', run: (s, ev) => { relBump(s, ev.k, -2, 0); return '수출을 정중히 거절했습니다.'; } },
    ] },
  coupAbroad: { w: 1.5, cond: s => !!dev(s, () => true), icon: '🪖',
    make: s => { const k = dev(s, () => true); return { k, title: `${cname(k)}에서 군사 쿠데타`, desc: `${cname(k)} 군부가 정권을 장악했습니다. 한국 기업 ${DYN.pick([30, 80, 150])}곳과 교민이 현지에 있습니다. 군정이 한국의 승인을 요청합니다.` }; },
    choices: [
      { label: '군사정권 승인', desc: '이권 유지(국고 +5), 서방 관계 -, 자유·인권 -1.', run: (s, ev) => { s.pcap += 5; relBump(s, ev.k, 8, 3); relBump(s, 'eu', -3, -1); s.stats.freedom -= 1; return '군정을 사실상 승인했습니다. 사업은 지켰지만 비판이 나옵니다.'; } },
      { label: '규탄·제재 동참', desc: '서방 관계 +, 현지 사업 타격.', run: (s, ev) => { relBump(s, ev.k, -12, -4); relBump(s, 'eu', 3, 1); relBump(s, 'us', 2, 1); s.mods.gdp -= 0.01; return '민주주의 회복을 촉구하며 제재에 동참했습니다.'; } },
      { label: '교민 철수만', desc: '군 수송기 투입. 국고 소요, 지지율 +1.', pc: 4, run: s => { s.approval += 1; return '공군 수송기로 교민을 무사히 철수시켰습니다.'; } },
    ] },
  hostage: { w: 1.2, cond: s => s.turn >= 2 && !!dev(s, () => true), icon: '🆘',
    make: s => { const k = dev(s, () => true); return { k, title: `${cname(k)}에서 한국인 ${DYN.pick([3, 7, 12])}명 피랍`, desc: `무장 조직이 ${DYN.pick(['선교 봉사단', '건설 노동자', '관광객', '선원'])}을 납치하고 몸값을 요구합니다.` }; },
    choices: [
      { label: '특수부대 구출 작전', desc: '성공률 60%: 지지율 +5 / 실패: 지지율 -6.', run: s => { if (coin(0.6 + flowOf(s).luck * 3)) { s.approval += 5; s.factions.mil = clamp(s.factions.mil + 6, 0, 100); return '"아덴만 여명 작전"급 구출 성공! 전원 무사 귀환.'; } s.approval -= 6; return '작전 중 인질이 희생됐습니다. 책임론이 거셉니다.'; } },
      { label: '물밑 협상(몸값)', desc: '국고 -8, 무사 귀환. "테러에 굴복" 비판.', run: s => { s.pcap -= 8; s.approval += 1; s.factions.con = clamp(s.factions.con - 3, 0, 100); return '협상 끝에 전원 석방됐습니다.'; } },
      { label: '현지 정부에 맡김', desc: '관계 +, 결과는 운.', run: (s, ev) => { relBump(s, ev.k, 3, 1); if (coin(0.5)) return '현지 군경이 인질을 구출했습니다.'; s.approval -= 3; return '수색이 길어지며 가족들의 원성이 큽니다.'; } },
    ] },
  mediationAsk: { w: 1.5, cond: s => (s.world?.conflicts || []).length >= 1, icon: '🕊️',
    make: s => { const c = DYN.pick(s.world.conflicts); return { a: c.a, b: c.b, title: `${cname(c.a)}${c.b !== c.a ? '·' + cname(c.b) : ''} 분쟁, 한국에 중재 요청`, desc: '양측이 서울을 협상 장소로 제안했습니다. 성공하면 위상이 크게 오르지만 실패하면 망신입니다.' }; },
    choices: [
      { label: '서울 평화회담 주최', desc: '성공 확률은 국력·관계·운에 따라. 성공: 지지율 +4, 위협도 -4.', pc: 10, run: (s, ev) => { const p = clamp(0.35 + (20 - rankOf(s)) / 50 + flowOf(s).luck * 3, 0.15, 0.85); if (Math.random() < p) { s.world.conflicts = s.world.conflicts.filter(c => !(c.a === ev.a && c.b === ev.b)); relBump(s, ev.a, 6, 3); relBump(s, ev.b, 6, 3); s.approval += 4; if (typeof addThreat === 'function') addThreat(s, -4); return `서울 평화협정 체결! (성공 확률 ${Math.round(p * 100)}%)`; } s.approval -= 1; return `회담이 결렬됐습니다. (성공 확률 ${Math.round(p * 100)}%)`; } },
      { label: '한쪽 편을 든다', desc: `${'우방 쪽 관계 +8, 반대쪽 -10.'}`, run: (s, ev) => { const [f, o] = relOf(s, ev.a) >= relOf(s, ev.b) ? [ev.a, ev.b] : [ev.b, ev.a]; relBump(s, f, 8, 3); if (o !== f) relBump(s, o, -10, -4); return `${cname(f)} 편을 들었습니다.`; } },
      { label: '불개입', desc: '변화 없음.', run: () => '중재 요청을 정중히 사양했습니다.' },
    ] },
  tradeHit: { w: 1.5, cond: s => flowOf(s).cn > 55 || flowOf(s).us < -20, icon: '📦',
    make: s => { const k = flowOf(s).cn > 55 && (flowOf(s).us >= -20 || coin(0.5)) ? 'cn' : 'us'; return { k, title: k === 'cn' ? `중국, 한국산 ${DYN.pick(['배터리', '화장품', '반도체 장비', '게임'])} 수입 규제` : `미국, 한국산 ${DYN.pick(['자동차', '철강', '배터리', '가전'])}에 관세 ${DYN.pick([15, 25, 35])}%`, desc: k === 'cn' ? '사실상 보복 조치로 보입니다. 수출 기업들이 비상입니다.' : '"동맹도 예외 없다"는 미 행정부의 통보입니다.' }; },
    choices: [
      { label: '맞보복', desc: '관계 -10, 지지율 +2, 성장률 -0.2.', run: (s, ev) => { relBump(s, ev.k, -10, -4); s.approval += 2; s.stats.gdp -= 0.2; return '같은 수준의 보복 관세를 발표했습니다.'; } },
      { label: '협상(양보)', desc: '관계 +3, 해당 산업 피해 일부.', run: (s, ev) => { relBump(s, ev.k, 3, 1); s.stats.gdp -= 0.1; s.factions.biz = clamp(s.factions.biz - 2, 0, 100); return '일부 양보로 규제를 완화시켰습니다.'; } },
      { label: '수출 다변화 지원', desc: '국고 소요, 장기적으로 의존도 감소.', pc: 10, run: (s, ev) => { s.mods.gdp += 0.03; relBump(s, ev.k, -2, -1); return '아세안·인도·중동 시장 개척 자금을 풀었습니다.'; } },
    ] },
  summitInvite: { w: 1.2, cond: s => rankOf(s) <= 12, icon: '🌐',
    make: s => ({ title: `${DYN.pick(['G7 확대 정상회의', 'G20 정상회의', '유엔 총회 기조연설', 'APEC 정상회의'])}에 초청`, desc: `국력 세계 ${rankOf(s)}위의 한국에 의장국이 특별 세션을 제안했습니다.` }),
    choices: [
      { label: '참석해 비전 연설', desc: '지지율 +2, 관계(미·EU·일) +3. 30% 확률로 실언 논란.', run: s => { if (coin(0.3)) { s.approval -= 2; return '연설 중 발언이 오역되며 외교 결례 논란이 일었습니다.'; } s.approval += 2; ['us', 'eu', 'jp'].forEach(k => relBump(s, k, 3, 1)); return '기립 박수를 받았습니다. "한국의 시간"이라는 외신 평가.'; } },
      { label: '참석해 양자회담에 집중', desc: '관계 무작위 2개국 +5.', run: s => { const ks = DYN.pick([['us', 'jp'], ['cn', 'eu'], ['us', 'eu'], ['jp', 'tw']]); ks.forEach(k => relBump(s, k, 5, 2)); return `${ks.map(k => RELATIONS[k].name).join('·')}과(와) 연쇄 정상회담을 가졌습니다.`; } },
      { label: '국내 현안으로 불참', desc: '지지율 +0.5, 관계 -2.', run: s => { s.approval += 0.5; ['us', 'eu'].forEach(k => relBump(s, k, -2, 0)); return '"민생이 먼저"라며 총리를 대신 보냈습니다.'; } },
    ] },
  troopCut: { w: 2, cond: s => flowOf(s).us < -35 && !s.annexed?.us, icon: '🇺🇸',
    make: s => ({ title: '미국, 주한미군 감축 통보', desc: `고립주의 노선의 미 행정부가 주한미군 ${DYN.pick(['1개 여단', '30%', '절반'])} 철수 계획을 통보했습니다.` }),
    choices: [
      { label: '방위비 증액으로 붙잡기', desc: '국고 -15, 미국 관계 +6.', run: s => { s.pcap -= 15; relBump(s, 'us', 6, 3); return '분담금을 크게 올려 철수를 막았습니다.'; } },
      { label: '자주국방 가속', desc: '안보 -3(단기), 안보 지속 +1.5, 군 지지 +.', run: s => { s.stats.security -= 3; s.mods.security += 1.5; s.factions.mil = clamp(s.factions.mil + 5, 0, 100); relBump(s, 'us', -4, -2); return '"우리 안보는 우리가"를 선언했습니다.'; } },
      { label: '중국과 관계 개선', desc: '중국 +8, 미국 -8, 위협도 -.', run: s => { relBump(s, 'cn', 8, 3); relBump(s, 'us', -8, -3); return '균형 외교로 방향을 틀었습니다.'; } },
    ] },
  kadiz: { w: 1.5, cond: s => flowOf(s).cn > 50 || relOf(s, 'ru') < 30, icon: '✈️',
    make: s => { const k = coin(0.6) ? 'cn' : 'ru'; return { k, title: `${cname(k)} 군용기 ${DYN.pick([4, 6, 9])}대 KADIZ 진입`, desc: '사전 통보 없이 방공식별구역을 휘젓고 나갔습니다. 일부는 영공에 근접했습니다.' }; },
    choices: [
      { label: '전투기 긴급 발진·강력 항의', desc: '군 지지 +, 관계 -5, 세계 긴장 +.', run: (s, ev) => { s.factions.mil = clamp(s.factions.mil + 3, 0, 100); relBump(s, ev.k, -5, -1); if (s.world) s.world.tension += 2; return 'F-35A가 긴급 출격해 차단 기동을 했습니다.'; } },
      { label: '한·미·일 공동 대응', desc: '미·일 +3, 상대 -6.', run: (s, ev) => { relBump(s, 'us', 3, 1); relBump(s, 'jp', 3, 1); relBump(s, ev.k, -6, -2); return '3국 공동 성명을 냈습니다.'; } },
      { label: '외교 채널로 조용히', desc: '관계 유지, 보수층 -3.', run: s => { s.factions.con = clamp(s.factions.con - 3, 0, 100); return '"저자세 외교"라는 비판이 나왔습니다.'; } },
    ] },
  allyCall: { w: 1.5, cond: s => Object.keys(s.diplo || {}).some(k => dip(s, k).alliance && (s.world?.conflicts || []).some(c => c.a === k || c.b === k)), icon: '📯',
    make: s => { const k = Object.keys(s.diplo).find(k => dip(s, k).alliance && s.world.conflicts.some(c => c.a === k || c.b === k)); return { k, title: `동맹국 ${cname(k)}, 파병 요청`, desc: `분쟁 중인 ${cname(k)}이(가) 동맹 조약을 근거로 한국군 파병을 요청했습니다.` }; },
    choices: [
      { label: '전투부대 파병', desc: '관계 +12, 지지율 -3, 사상자 위험.', run: (s, ev) => { relBump(s, ev.k, 12, 5); s.approval -= 3; if (coin(0.3)) { s.approval -= 3; return '파병 부대에서 전사자가 나왔습니다. 반전 여론이 커집니다.'; } return '파병 부대가 무사히 임무를 수행 중입니다.'; } },
      { label: '의료·공병 부대만', desc: '관계 +5, 부담 적음.', run: (s, ev) => { relBump(s, ev.k, 5, 2); return '비전투 부대를 보냈습니다.'; } },
      { label: '거절', desc: '관계 -12, 동맹 신뢰 하락.', run: (s, ev) => { relBump(s, ev.k, -12, -5); return '"동맹이 맞느냐"는 반응이 돌아왔습니다.'; } },
    ] },
  resourceOffer: { w: 1.2, cond: s => !!dev(s, (k) => relOf(s, k) >= 40), icon: '⛏️',
    make: s => { const k = dev(s, (k) => relOf(s, k) >= 40); const r = DYN.pick(['리튬', '희토류', '코발트', '천연가스', '우라늄']); return { k, r, title: `${cname(k)}, ${r} 광구 지분 제안`, desc: `${cname(k)} 정부가 ${r} 광구 지분 40%를 한국에 우선 제안했습니다. 중국 기업도 뛰어들었습니다.` }; },
    choices: [
      { label: '국고로 지분 인수', desc: '국고 -12, 70% 확률로 대박(성장·물가 안정).', run: (s, ev) => { s.pcap -= 12; if (coin(0.7)) { s.mods.gdp += 0.05; s.mods.infl -= 0.08; relBump(s, ev.k, 5, 3); return `${ev.r} 공급망을 확보했습니다.`; } return `${ev.r} 매장량이 과대 평가로 드러났습니다. 투자 손실.`; } },
      { label: '민간 기업 컨소시엄', desc: '재계 +, 효과 절반.', run: (s, ev) => { s.mods.gdp += 0.02; s.factions.biz = clamp(s.factions.biz + 3, 0, 100); return '민간 컨소시엄이 지분을 인수했습니다.'; } },
      { label: '포기', desc: '중국이 가져감.', run: s => { relBump(s, 'cn', 1, 0); return '중국 기업이 광구를 가져갔습니다.'; } },
    ] },
  spy: { w: 1, cond: s => s.turn >= 3, icon: '🕵️',
    make: s => { const k = DYN.pick(['cn', 'ru', 'nk', 'jp', 'us']); return { k, title: `${cname(k)} 정보요원 적발`, desc: `국정원이 ${DYN.pick(['방산업체 기술', '반도체 공정', '군 작전 계획', '정치권 동향'])}을 빼돌리던 ${cname(k)} 요원을 체포했습니다.` }; },
    choices: [
      { label: '공개 추방', desc: '지지율 +1, 관계 -8.', run: (s, ev) => { s.approval += 1; relBump(s, ev.k, -8, -2); return '외교관 신분 요원들을 추방했습니다.'; } },
      { label: '비공개 맞교환', desc: '관계 유지, 안보 +1.', run: s => { s.stats.security += 1; return '억류된 우리 요원과 조용히 맞교환했습니다.'; } },
      { label: '이중간첩으로 역이용', desc: '50%: 안보 +3 / 50%: 들통나 관계 -10.', run: (s, ev) => { if (coin(0.5)) { s.stats.security += 3; return '역정보 공작이 성공하고 있습니다.'; } relBump(s, ev.k, -10, -3); return '공작이 들통나 외교 마찰이 커졌습니다.'; } },
    ] },
  megaEvent: { w: 0.8, cond: s => s.turn >= 4, icon: '🏟️',
    make: s => ({ title: `${DYN.pick(['하계 올림픽', '월드컵', '세계 엑스포', '동계 아시안게임'])} 유치 도전`, desc: '부산·서울이 유치 의사를 밝혔습니다. 경쟁국이 만만치 않습니다.' }),
    choices: [
      { label: '국가 총력 유치전', desc: '국고 -10, 40% 확률로 유치(행복·성장 +), 실패 시 지지율 -2.', run: s => { s.pcap -= 10; if (coin(0.4 + (20 - rankOf(s)) / 100)) { s.mods.happiness += 1; s.mods.gdp += 0.03; s.approval += 3; return '유치에 성공했습니다! 온 국민이 환호합니다.'; } s.approval -= 2; return '압도적 표차로 탈락했습니다.'; } },
      { label: '포기', desc: '재정 건전성 유지.', run: () => '유치 신청을 철회했습니다.' },
    ] },
};
for (const k in DIPLO_EVENTS) Object.assign(DIPLO_EVENTS[k], { kind: 'diplo' });
if (typeof DOM_EVENTS !== 'undefined') Object.assign(DOM_EVENTS, DIPLO_EVENTS);
// 기후 위험이 높으면 재난 사건이 더 자주
if (typeof domEventWeight === 'function') {
  const _w = domEventWeight;
  domEventWeight = function (s, key, e) {
    let w = _w(s, key, e);
    if (w > 0 && e.kind === 'disaster') w *= 0.6 + flowOf(s).climate / 60;
    if (w > 0 && e.kind === 'diplo') w *= rankOf(s) <= 10 ? 1.3 : 1;
    return w;
  };
}

/* ---------------- 5) 전장 변수 ---------------- */
const WAR_VARS = [
  { id: 'cold', w: s => [1, 4].includes(turnLabel(s.turn).q) ? 2 : 0.3, run: (s, T) => { T.kr.org -= 8; T.en.org -= 10; return ['❄️ 혹한이 덮쳤습니다. 양군 모두 동상자가 속출합니다.', 'info']; } },
  { id: 'rain', w: s => turnLabel(s.turn).q === 3 ? 2 : 0.3, run: (s, T) => { T.kr.org -= 6; T.en.org -= 6; return ['🌧️ 장마로 도로가 진흙탕입니다. 기갑 기동이 멈췄습니다.', 'info']; } },
  { id: 'enGeneral', w: () => 1, run: (s, T) => { T.en.org -= 14; return ['🎖️ 적 총사령관이 경질됐습니다. 적 지휘 체계가 흔들립니다.', 'good']; } },
  { id: 'morale', w: () => 1, run: (s, T) => { T.kr.org += 12; return [`📣 ${DYN.pick(['한 소대의 고지 사수 영상', '대통령의 최전선 방문', '전사자 유족의 편지'])}가 퍼지며 아군 사기가 치솟습니다.`, 'good']; } },
  { id: 'supplyCut', w: () => 1, run: (s, T) => { if (coin(0.5)) { T.kr.equip = clamp(T.kr.equip - 0.05, 0.15, 1); return ['🚛 아군 보급로가 기습당했습니다. 탄약이 부족합니다.', 'bad']; } T.en.equip = clamp(T.en.equip - 0.06, 0.15, 1); return ['🔥 특수부대가 적 보급 기지를 폭파했습니다.', 'good']; } },
  { id: 'surrender', w: s => (s.war.score || 0) > 30 ? 1.5 : 0.4, run: (s, T) => { const n = Math.round(rnd(3, 8)); T.en.mp -= n; return [`🏳️ 적 ${n}개 대대가 집단 투항했습니다.`, 'good']; } },
  { id: 'volunteers', w: s => relOf(s, 'us') > 60 || relOf(s, 'eu') > 60 ? 0.8 : 0.2, run: (s, T) => { T.kr.mp += 4; return ['🌍 해외 의용군이 도착했습니다.', 'good']; } },
  { id: 'leak', w: () => 0.8, run: (s, T) => { T.kr.org -= 10; return ['🕵️ 작전 계획이 유출됐습니다. 적이 우리 공세를 미리 대비합니다.', 'bad']; } },
  { id: 'friendly', w: () => 0.5, run: (s, T) => { T.kr.cas += Math.round(rnd(200, 900)); T.kr.org -= 4; return ['💥 오인 사격 사고가 발생했습니다.', 'bad']; } },
  { id: 'breakthrough', w: () => 1, run: (s, T) => {
    const es = Object.entries(T.edges || {}); if (!es.length) return null;
    const [key, e] = DYN.pick(es); const up = coin(0.55 + flowOf(s).luck * 3); e.prog = clamp((e.prog || 0) + (up ? 25 : -25), -99, 99);
    const byId = Object.fromEntries(T.provs.map(p => [p.id, p])); const [a, b] = key.split('>'); const p = byId[up ? b : a] || byId[a] || byId[b];
    return up ? [`⚡ 아군 기습 돌파! ${p ? p.n + ' 방면' : '한 전선'}에서 적 방어선이 뚫렸습니다.`, 'good'] : [`⚠️ 적 기습 역습! ${p ? p.n + ' 방면' : '한 전선'}이 밀리고 있습니다.`, 'bad']; } },
];
function warVariance(s) {
  const T = s.war?.theater; if (!T || !T.kr || !T.en) return;
  if (Math.random() > 0.03) return;
  const pool = WAR_VARS.map(v => [v, Math.max(0, v.w(s))]); let r = Math.random() * pool.reduce((a, x) => a + x[1], 0);
  const v = (pool.find(x => (r -= x[1]) <= 0) || pool[0])[0];
  const out = v.run(s, T); if (!out) return;
  T.kr.org = clamp(T.kr.org, 5, 100); T.en.org = clamp(T.en.org, 5, 100); T.en.mp = Math.max(1, T.en.mp);
  warLog(s, `[전장 변수] ${out[0]}`, out[1]);
  (T.varFx = T.varFx || []).push({ text: out[0], type: out[1] });
}
if (typeof warDay === 'function') { const _wd = warDay; warDay = function (s, ...a) { const r = _wd(s, ...a); try { warVariance(s); } catch {} return r; }; }

/* ---------------- 분기 처리·저장 호환 ---------------- */
HOOKS.migrate.push(s => { flowOf(s); if (!sitState(s).list.length) genSitPolicies(s, 3); });
HOOKS.postTurn.push(s => {
  const F = flowOf(s);
  if (F.wasWar && !s.war) F.warEnded = s.turn;
  F.wasWar = !!s.war;
  flowStep(s);
  genSitPolicies(s);
});
