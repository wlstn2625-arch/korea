/* =========================================================
 *  점령지 통치와 강화 회의
 *  - 전쟁에 이기면 강화 조건을 직접 고름: 합병·괴뢰 정부·배상·군비 제한·관대한 평화
 *  - 점령지마다 통치 방식(편입·자치·군정·식민 총독부·괴뢰 정부)과 징수·징병·투자 수준을 정함
 *  - 점령지는 인력(사단)·국방력(공군·해군·군사력)·자본(국고)·자원(성장률)을 주지만, 저항이 쌓이면 봉기
 * ========================================================= */
const RULES = {
  integrate: { name: '완전 편입·동화', icon: '🤝', ext: 0.35, resist: -1.2, integ: 3, upkeep: 0.10, desc: '시민권과 복지를 똑같이 줍니다. 처음엔 돈이 들지만 저항이 사라지고 결국 본토가 됩니다.' },
  autonomy: { name: '자치주(특별행정구)', icon: '🏛️', ext: 0.6, resist: -2, integ: 1.2, upkeep: 0.03, desc: '현지 엘리트에게 자치를 맡깁니다. 안정적이지만 거둬들이는 것은 적습니다.' },
  direct: { name: '군정 직할 통치', icon: '🎖️', ext: 1.0, resist: 1.0, integ: 0.4, upkeep: 0.05, desc: '군이 직접 다스립니다. 징수·징병이 효율적이지만 저항이 쌓입니다.' },
  colony: { name: '총독부 식민 통치', icon: '⛓️', ext: 1.6, resist: 2.0, integ: 0, upkeep: 0.02, intl: true, desc: '자원과 인력을 최대한 뽑아냅니다. 저항이 거세고 국제 사회의 비난을 받습니다.' },
  puppet: { name: '괴뢰 정부', icon: '🎭', ext: 0.35, resist: -1.5, integ: 0, upkeep: 0, puppet: true, desc: '친한 정권을 세워 독립국 모양새를 유지합니다. 동맹으로 묶이고 이권을 챙깁니다.' },
};
const LEVELS = {
  extract: { name: '자원·세금 징수', opts: ['낮게', '보통', '수탈'], mul: [0.5, 1, 1.6], resist: [-0.5, 0.8, 2] },
  conscript: { name: '현지 징병', opts: ['없음', '지원병', '강제 징집'], mul: [0, 0.4, 1], resist: [0, 0.6, 2] },
  invest: { name: '재건 투자', opts: ['없음', '보통', '대규모'], cost: [0, 10, 25], dev: [0, 1.5, 4], resist: [0, -1.5, -3.5], integ: [0, 1, 2] },
};

// 점령지 개발 사업 (최대 3단계, 단계마다 효과 누적)
//  cap: 자본 배율, gdp: 성장 배율, mil: 국방력 배율, divs: 사단, upkeep: 유지비 배율, resist/integ/dev: 분기 변화
const TERR_PROJECTS = [
  { id: 'rail', name: '도로·철도망', icon: '🛤️', time: 2, fx: { cap: 0.05, dev: 0.8, integ: 0.5 }, desc: '물자가 돌고 사람이 오갑니다. 개발·통합의 기본.' },
  { id: 'port', name: '무역항·물류기지', icon: '⚓', time: 2, fx: { cap: 0.12, gdp: 0.1 }, desc: '본토와의 교역으로 자본 수입 증가.' },
  { id: 'mine', name: '광산·자원 개발', icon: '⛏️', time: 2, fx: { gdp: 0.25, cap: 0.08, resist: 0.4 }, desc: '희토류·광물을 캐 본토 산업에 공급(성장률↑). 주민 반발.' },
  { id: 'ind', name: '산업단지·공장', icon: '🏭', time: 3, fx: { cap: 0.18, dev: 0.5, resist: -0.2 }, desc: '일자리가 생기고 세수가 늘어납니다.' },
  { id: 'school', name: '학교·한국어 교육', icon: '🏫', time: 2, fx: { integ: 1.2, resist: -0.4 }, desc: '다음 세대가 대한민국 시민으로 자랍니다.' },
  { id: 'hospital', name: '병원·보건소', icon: '🏥', time: 2, fx: { resist: -0.7, dev: 0.3 }, desc: '민심을 얻는 가장 확실한 길.' },
  { id: 'base', name: '군사기지', icon: '🪖', time: 2, fx: { mil: 0.25, divs: 1.5, resist: 0.3 }, desc: '현지 주둔군과 전진기지. 국방력↑, 반감↑.' },
  { id: 'police', name: '경찰·정보망', icon: '🕵️', time: 1, fx: { resist: -0.9 }, desc: '저항 조직을 미리 색출합니다.' },
  { id: 'admin', name: '행정청·세무서', icon: '🏛️', time: 2, fx: { cap: 0.08, upkeep: -0.15 }, desc: '징수 효율↑, 통치 비용↓.' },
];
// 현지 정책 (켜고 끌 수 있음, 켤 때 국고)
const TERR_POLICIES = [
  { id: 'land', name: '토지 개혁', icon: '🌾', cost: 12, fx: { resist: -0.8, cap: -0.1, dev: 0.3 }, desc: '지주 땅을 소작농에게. 민심↑, 수입 조금↓.' },
  { id: 'settle', name: '한국인 이주 장려', icon: '🧳', cost: 15, fx: { integ: 1.5, resist: 0.8, dev: 0.4 }, desc: '본토 주민 이주로 통합 가속. 원주민 반발.' },
  { id: 'elite', name: '현지 엘리트 등용', icon: '🤝', cost: 10, fx: { resist: -1, cap: -0.08 }, desc: '현지 유력층에게 자리를 줍니다.' },
  { id: 'culture', name: '언어·문화 동화 정책', icon: '📖', cost: 10, fx: { integ: 2, resist: 1.2 }, desc: '한국어 공용화. 통합은 빠르지만 반감이 큽니다.' },
  { id: 'fta', name: '자유무역지대', icon: '💹', cost: 20, fx: { cap: 0.2, gdp: 0.15, dev: 0.4 }, desc: '외국 자본 유치. 자본·성장 모두↑.' },
  { id: 'martial', name: '계엄·통행 금지', icon: '⛔', cost: 8, fx: { resist: -1.8, dev: -0.6, cap: -0.15 }, desc: '저항을 짓누르지만 경제가 멈춥니다. 국제 비난.', intl: true },
];
const projCost = (k, id, lv) => Math.round((15 + cinfo(k).eco * 0.25 + terrPop(k) / 1e7) * (1 + lv * 0.6));
// 개발 사업·현지 정책 효과 합
function terrMods(t, s) {
  const m = { cap: 0, gdp: 0, mil: 0, divs: 0, upkeep: 0, resist: 0, integ: 0, dev: 0 };
  const G = s && typeof govMods === 'function' ? govMods(s, t.k) : null; // 지역 총독
  if (G) for (const k in G) m[k] += G[k];
  for (const p of TERR_PROJECTS) { const lv = t.lv?.[p.id] || 0; for (const k in p.fx) m[k] += p.fx[k] * lv; }
  for (const p of TERR_POLICIES) if (t.pol?.[p.id]) for (const k in p.fx) m[k] += p.fx[k];
  return m;
}
function terrBuild(s, k, id) {
  const t = s.terr?.[k], p = TERR_PROJECTS.find(x => x.id === id); if (!t || !p) return { ok: false, msg: '알 수 없는 사업입니다.' };
  t.lv = t.lv || {}; t.proj = t.proj || [];
  const lv = (t.lv[id] || 0) + t.proj.filter(x => x.id === id).length;
  if (lv >= 3) return { ok: false, msg: `${p.name}은(는) 최대 3단계입니다.` };
  if (t.proj.length >= 2) return { ok: false, msg: '점령지마다 동시에 2개 사업까지 진행할 수 있습니다.' };
  const cost = projCost(k, id, lv); if (s.pcap < cost) return { ok: false, msg: `국고 ${won(cost)}이(가) 필요합니다.` };
  s.pcap -= cost; t.proj.push({ id, left: p.time });
  s.cnt = s.cnt || {}; s.cnt.terrBuild = (s.cnt.terrBuild || 0) + 1;
  addLog(s, 'info', `${p.icon} ${cname(k)} ${p.name} ${lv + 1}단계 착공 (${won(cost)})`);
  return { ok: true, msg: `${p.icon} ${cname(k)} ${p.name} ${lv + 1}단계 착공! ${p.time}분기 뒤 완공` };
}
function terrPolicy(s, k, id) {
  const t = s.terr?.[k], p = TERR_POLICIES.find(x => x.id === id); if (!t || !p) return { ok: false };
  t.pol = t.pol || {};
  if (t.pol[id]) { delete t.pol[id]; return { ok: true, msg: `${p.icon} ${p.name} 폐지` }; }
  if (s.pcap < p.cost) return { ok: false, msg: `국고 ${won(p.cost)}이(가) 필요합니다.` };
  s.pcap -= p.cost; t.pol[id] = s.turn;
  return { ok: true, msg: `${p.icon} ${cname(k)}: ${p.name} 시행` };
}
function terrPop(k) { return (typeof MAP_DATA !== 'undefined' && MAP_DATA.countries[k]?.pop) || cinfo(k).pop || 5e6; }
function createTerritory(s, k, rule, peaceful) {
  s.terr = s.terr || {};
  const base = { integrate: 30, autonomy: 30, direct: 50, colony: 60, puppet: 20 }[rule] ?? 45;
  s.terr[k] = { k, rule, resist: clamp(base - (peaceful ? 20 : 0) + (k === 'nk' ? -5 : 0), 5, 95), integ: 0, dev: k === 'nk' ? 25 : 45, extract: 1, conscript: 0, invest: 0, since: s.turn, cd: 0, highQ: 0 };
  return s.terr[k];
}
// 점령지 하나의 분기 산출
function terrOutput(s, k) {
  const t = s.terr[k], c = cinfo(k), R = RULES[t.rule];
  const calm = 1 - t.resist / 130, full = t.integ >= 100;
  const ext = (full ? 0.9 : R.ext) * LEVELS.extract.mul[t.extract];
  const M = terrMods(t, s);
  const capital = (c.eco * 0.35 + 2) * (t.dev / 50) * ext * calm * Math.max(0.2, 1 + M.cap);
  const upkeep = R.upkeep * (c.eco * 0.5 + 6) * Math.max(0.3, 1 + M.upkeep) + LEVELS.invest.cost[t.invest];
  const divs = R.puppet ? terrPop(k) / 1e6 * 0.08 * LEVELS.conscript.mul[Math.min(1, t.conscript)] : terrPop(k) / 1e6 * 0.2 * Math.max(LEVELS.conscript.mul[t.conscript], full ? 0.4 : 0) * calm;
  const milShare = R.puppet ? 0.08 : t.rule === 'autonomy' ? 0.08 : 0.15;
  const mil = c.mil * milShare * calm * (1 + M.mil);
  const gdp = ecoK(k) * 0.12 * (t.dev / 50) * (t.extract > 0 ? 1 : 0.6) * calm * (R.puppet ? 0.5 : 1) * (1 + M.gdp);
  return { capital, upkeep, divs: Math.min(divs + M.divs, 30), air: mil * 0.5, navy: mil * 0.4, mil, gdp };
}
function terrForces(s) {
  const r = { divs: 0, air: 0, navy: 0, mil: 0 };
  if (!s.terr) return { divs: s.annexed?.nk ? 10 : 0, air: 0, navy: 0, mil: s.annexed?.nk ? 8 : 0 };
  for (const k in s.terr) { const o = terrOutput(s, k); r.divs += o.divs; r.air += o.air; r.navy += o.navy; r.mil += o.mil * 0.5 + o.divs * 0.4; }
  return r;
}
function terrIncome(s) { let n = 0; for (const k in (s.terr || {})) { const o = terrOutput(s, k); n += o.capital - o.upkeep; } return n; }

function setTerr(s, k, field, v) {
  const t = s.terr?.[k]; if (!t) return { ok: false, msg: '점령지가 아닙니다.' };
  if (field === 'rule') {
    if (t.rule === v) return { ok: true };
    if (t.cd > s.turn) return { ok: false, msg: `통치 방식은 ${t.cd - s.turn}분기 뒤에 다시 바꿀 수 있습니다.` };
    if (s.pcap < 15) return { ok: false, msg: `통치 체제 개편에 국고 ${won(15)}이(가) 필요합니다.` };
    if (v === 'puppet' && k === 'nk' && s.annexed.nk && t.integ > 50) return { ok: false, msg: '이미 깊이 통합되어 괴뢰 정부로 되돌릴 수 없습니다.' };
    s.pcap -= 15; t.cd = s.turn + 2;
    // 강압 → 유화로 바꾸면 저항이 조금 누그러지고, 반대면 반발
    const harsh = { integrate: 0, autonomy: 1, puppet: 1, direct: 2, colony: 3 };
    t.resist = clamp(t.resist + (harsh[v] - harsh[t.rule]) * 4, 0, 100);
    if (RULES[v].puppet) { s.annexed[k] = false; dip(s, k).alliance = true; s.rel[k] = Math.max(s.rel[k] || 0, 70); }
    else if (RULES[t.rule].puppet) { s.annexed[k] = true; s.rel[k] = 50; }
    t.rule = v;
    addLog(s, 'info', `${RULES[v].icon} ${cname(k)} 통치 방식을 ${RULES[v].name}(으)로 바꿨습니다.`);
    return { ok: true, msg: `${cname(k)}: ${RULES[v].name}` };
  }
  if (!(field in LEVELS)) return { ok: false };
  if (field === 'conscript' && RULES[t.rule].puppet && v > 1) return { ok: false, msg: '괴뢰 정부에는 강제 징집을 요구할 수 없습니다.' };
  t[field] = v;
  return { ok: true };
}
// 치안 작전: 저항을 직접 꺾음 (국고·국제 여론 비용)
function suppressTerritory(s, k) {
  const t = s.terr?.[k]; if (!t) return { ok: false, msg: '점령지가 아닙니다.' };
  if ((t.supCd || 0) > s.turn) return { ok: false, msg: `${t.supCd - s.turn}분기 뒤에 다시 할 수 있습니다.` };
  if (s.pcap < 15) return { ok: false, msg: `국고 ${won(15)}이(가) 필요합니다.` };
  s.pcap -= 15; t.supCd = s.turn + 2; t.resist = clamp(t.resist - 15, 0, 100); t.dev = clamp(t.dev - 2, 5, 100);
  relBump(s, 'eu', -2, -1); s.stats.safety -= 0.5;
  addLog(s, 'info', `🪖 ${cname(k)}에서 대규모 치안 작전을 벌였습니다.`);
  return { ok: true, msg: `${cname(k)} 치안 작전: 저항 -15` };
}
function releaseTerritory(s, k, hostile) {
  const t = s.terr?.[k]; if (!t) return { ok: false };
  delete s.terr[k]; s.annexed[k] = false; if (s.occupied) delete s.occupied[k];
  if (hostile) { s.rel[k] = 5; s.approval = clamp(s.approval - 6, 0, 100); addLog(s, 'bad', `🏴 ${cname(k)}이(가) 봉기 끝에 독립을 선언했습니다. 점령지를 잃었습니다.`); }
  else { s.rel[k] = 65; dip(s, k).alliance = relOf(s, k) >= 60; for (const o of ['us', 'eu', 'jp', 'cn']) relBump(s, o, 5, 3); s.approval = clamp(s.approval + 2, 0, 100); addLog(s, 'good', `🕊️ ${cname(k)}의 독립을 승인했습니다. 국제 사회가 환영합니다.`); }
  return { ok: true, msg: hostile ? '점령지를 잃었습니다.' : `${cname(k)}의 독립을 승인했습니다.` };
}

function territoryTurn(s, report) {
  report.terr = report.terr || [];
  let gdp = 0;
  for (const k of Object.keys(s.terr || {})) {
    const t = s.terr[k], R = RULES[t.rule], o = terrOutput(s, k);
    gdp += o.gdp; // 자본(국고)은 budgetIncome의 점령지 항목으로 들어옴
    // 저항·통합·개발
    const inv = t.invest, M = terrMods(t, s);
    // 개발 사업 공사 진행
    for (const pj of [...(t.proj || [])]) if (--pj.left <= 0) { t.proj = t.proj.filter(x => x !== pj); t.lv = t.lv || {}; t.lv[pj.id] = (t.lv[pj.id] || 0) + 1; const P = TERR_PROJECTS.find(x => x.id === pj.id); report.terr.push(`${P.icon} ${cname(k)} ${P.name} ${t.lv[pj.id]}단계 완공`); addLog(s, 'good', `${P.icon} ${cname(k)} ${P.name} ${t.lv[pj.id]}단계 완공`); }
    const years = (s.turn - t.since) / 4; // 세월이 흐르면 저항이 조금씩 체념으로
    t.resist = clamp(t.resist + R.resist + LEVELS.extract.resist[t.extract] + LEVELS.conscript.resist[t.conscript] + LEVELS.invest.resist[inv] - t.integ / 60 - Math.min(1.5, years * 0.3) + M.resist + gauss() * 1.2, 0, 100);
    t.integ = clamp(t.integ + Math.max(0, R.integ + LEVELS.invest.integ[inv] + M.integ) * (1 - t.resist / 150), 0, 100);
    t.dev = clamp(t.dev + LEVELS.invest.dev[inv] + M.dev - (t.resist > 70 ? 1 : 0) + 0.3, 5, 100);
    if (t.pol?.martial) for (const x of ['us', 'eu']) s.rel[x] = clamp(s.rel[x] - 0.4, 0, 100);
    if (t.integ >= 100 && !t.full) { t.full = true; t.resist = Math.min(t.resist, 10); report.terr.push(`🇰🇷 ${cname(k)}이(가) 완전히 통합되어 본토가 되었습니다!`); addLog(s, 'good', `🇰🇷 ${cname(k)} 완전 통합 달성`); }
    // 치안·국제 여론
    if (!R.puppet) s.stats.safety -= t.resist / 100 * 0.5;
    if (R.intl || t.extract === 2) for (const x of ['us', 'eu', 'cn']) if (x !== k) s.rel[x] = clamp(s.rel[x] - 0.6, 0, 100);
    if (R.puppet) s.rel[k] = clamp((s.rel[k] || 50) + (t.resist < 40 ? 0.5 : -1), 0, 100);
    // 저항이 극에 달하면 독립
    t.highQ = t.resist >= 98 ? (t.highQ || 0) + 1 : 0;
    if (t.highQ >= 2) { releaseTerritory(s, k, true); report.terr.push(`🏴 ${cname(k)} 독립 봉기 성공 — 점령지를 잃었습니다.`); }
  }
  s.terrGdp = gdp;
}

/* ---------------- 강화 회의 ---------------- */
const PEACE_TERMS = [
  { id: 'annex', icon: '🚩', name: k => k === 'nk' ? '흡수 통일' : '합병', desc: k => k === 'nk' ? '북한 전역을 대한민국에 편입합니다. 통치 방식은 점령지 화면에서 바꿀 수 있습니다(기본: 완전 편입).' : '영토 전체를 점령지로 편입합니다. 인력·자원·자본을 얻지만 저항과 국제 반발이 따릅니다.',
    can: (s, k) => cinfo(k).annex ? null : '합병할 수 없는 강대국입니다.' },
  { id: 'puppet', icon: '🎭', name: () => '괴뢰 정부 수립', desc: () => '친한 정권을 세우고 동맹으로 묶습니다. 국제 반발이 적고 이권과 일부 병력을 챙깁니다.', can: () => null },
  { id: 'reparation', icon: '💰', name: () => '배상금·자원 이권', desc: () => '막대한 배상금과 자원 개발권을 받아냅니다. 영토는 그대로 돌려줍니다.', can: () => null },
  { id: 'disarm', icon: '🔒', name: k => k === 'nk' ? '비핵화·군비 제한' : '군비 제한·비무장지대', desc: () => '상대 군대를 크게 줄이고 완충 지대를 만듭니다. 안보가 크게 좋아집니다.', can: () => null },
  { id: 'lenient', icon: '🕊️', name: () => '관대한 평화', desc: () => '아무것도 요구하지 않습니다. 상대와 국제 사회의 신뢰를 얻고 지지율이 오릅니다.', can: () => null },
];
function applyPeace(s, choice) {
  const P = s.peacePending; if (!P) return { ok: false };
  const k = P.k; s.peacePending = null;
  const term = PEACE_TERMS.find(x => x.id === choice);
  if (term.can(s, k)) return { ok: false, msg: term.can(s, k) };
  if (choice === 'annex') { annex(s, k, false); if (!s.terr?.[k]) createTerritory(s, k, k === 'nk' ? 'integrate' : 'direct'); }
  else if (choice === 'puppet') {
    createTerritory(s, k, 'puppet'); dip(s, k).alliance = true; dip(s, k).sanction = false; s.rel[k] = 72;
    for (const o of ['us', 'cn', 'eu', 'jp', 'ru']) if (o !== k) relBump(s, o, -4, -2);
    s.scoreBonus = (s.scoreBonus || 0) + 3; s.approval = clamp(s.approval + 4, 0, 100);
    addLog(s, 'good', `🎭 ${cname(k)}에 친한 정부가 들어섰습니다. 동맹으로 편입됩니다.`);
  }
  else if (choice === 'reparation') { endWar2Concession(s, k); s.pcap += Math.round(30 + ecoK(k) * 60); s.mods.gdp += 0.05 * ecoK(k); }
  else if (choice === 'disarm') { s.stats.security += 6; s.mods.security += 2; relBump(s, k, 2, 5); s.world && (s.world.tension = clamp(s.world.tension - 5, 0, 100)); (s.disarmed = s.disarmed || {})[k] = s.turn; if (k === 'nk') { s.mods.security += 3; s.rel.nk = Math.max(s.rel.nk, 40); } addLog(s, 'good', `🔒 ${cname(k)}의 군비를 제한하고 비무장지대를 설치했습니다.`); }
  else if (choice === 'lenient') { relBump(s, k, 25, 25); for (const o of ['us', 'eu', 'jp', 'cn']) if (o !== k) relBump(s, o, 6, 4); s.approval = clamp(s.approval + 3, 0, 100); s.scoreBonus = (s.scoreBonus || 0) + 2; addLog(s, 'good', `🕊️ ${cname(k)}에 관대한 평화를 제시했습니다. 국제 사회가 높이 평가합니다.`); }
  return { ok: true, msg: `${term.icon} 강화 조약: ${term.name(k)}` };
}

// 봉기 카드 (국정 사건 카드로 등장)
if (typeof DOM_EVENTS !== 'undefined') DOM_EVENTS.terrRevolt = {
  w: 8, kind: 'security', extreme: true, icon: '🏴',
  cond: s => Object.values(s.terr || {}).some(t => t.resist >= 75 && !RULES[t.rule].puppet),
  make: s => { const t = Object.values(s.terr).filter(x => x.resist >= 75 && !RULES[x.rule].puppet).sort((a, b) => b.resist - a.resist)[0];
    return { title: `${cname(t.k)} 점령지 무장 봉기`, desc: `저항도 ${t.resist.toFixed(0)}. ${cname(t.k)} 곳곳에서 무장 세력이 군 기지와 총독부 청사를 습격했습니다. 그대로 두면 독립을 선언할 것입니다.`, k: t.k }; },
  choices: [
    { label: '무력 진압', desc: '저항 -25, 지지율 -2, 서방 관계 악화, 치안 -2.', pc: 10, run: (s, ev) => { const t = s.terr[ev.k]; if (!t) return '이미 끝난 일입니다.'; t.resist = clamp(t.resist - 25, 0, 100); s.approval -= 2; relBump(s, 'eu', -4, -2); relBump(s, 'us', -3, -1); s.stats.safety -= 2; return '군을 투입해 봉기를 진압했습니다. 국제 인권 단체가 규탄합니다.'; } },
    { label: '자치권 확대', desc: '통치 방식을 자치주로 전환, 저항 -15, 징수 효율 하락.', run: (s, ev) => { const t = s.terr[ev.k]; if (!t) return '이미 끝난 일입니다.'; t.rule = RULES[t.rule].puppet ? t.rule : 'autonomy'; t.resist = clamp(t.resist - 15, 0, 100); t.extract = Math.min(t.extract, 1); t.conscript = 0; return '현지 지도부와 자치 확대에 합의했습니다.'; } },
    { label: '독립 승인', desc: '점령지를 잃지만 국제 신뢰와 지지율을 얻습니다.', run: (s, ev) => releaseTerritory(s, ev.k, false).msg || '독립을 승인했습니다.' },
  ] };

HOOKS.migrate.push(s => {
  if (!s.terr) { s.terr = {}; for (const k of Object.keys(s.annexed || {})) if (s.annexed[k]) createTerritory(s, k, k === 'nk' ? 'integrate' : 'direct'); }
});
/* ---------------- 총독부 위임: 참모가 알아서 운영, 중요한 결정만 대통령에게 ---------------- */
const GOV_DIRECTIVES = {
  balance: { name: '균형', icon: '⚖️', desc: '수익과 안정을 함께. 저항이 높아지면 달래고, 여유가 있으면 개발.' },
  profit: { name: '수익 우선', icon: '💰', desc: '최대한 거둬들입니다. 저항은 치안 작전으로 누릅니다.' },
  stable: { name: '안정 우선', icon: '🕊️', desc: '저항을 낮추는 데 집중. 병원·경찰·엘리트 등용.' },
  integrate: { name: '본토화', icon: '🇰🇷', desc: '학교·철도·이주로 통합. 결국 완전 편입을 건의합니다.' },
};
const GOV_PRIORITY = {
  balance: r => r > 55 ? ['police', 'hospital', 'rail', 'school'] : ['rail', 'port', 'ind', 'school', 'admin', 'hospital'],
  profit: r => r > 60 ? ['police', 'admin', 'port'] : ['port', 'ind', 'admin', 'police', 'mine', 'rail'],
  stable: r => ['police', 'hospital', 'school', 'rail', 'ind'],
  integrate: r => r > 55 ? ['hospital', 'police', 'school'] : ['school', 'rail', 'hospital', 'ind', 'port'],
};
function govSettings(s) { if (!s.gov) s.gov = { budget: 30, reserve: 100 }; return s.gov; }
function setGov(s, k, field, v) {
  const G = govSettings(s);
  if (k === '*') { for (const t of Object.values(s.terr || {})) { if (field === 'auto') t.auto = v; if (field === 'dir') t.dir = v; } return { ok: true, msg: field === 'auto' ? (v ? '🤖 모든 점령지를 총독부에 맡겼습니다.' : '모든 점령지를 직접 관리합니다.') : `모든 점령지 방침: ${GOV_DIRECTIVES[v].name}` }; }
  if (k === 'budget' || k === 'reserve') { G[k] = v; return { ok: true }; }
  const t = s.terr?.[k]; if (!t) return { ok: false };
  t[field] = v; return { ok: true, msg: field === 'auto' ? (v ? `🤖 ${cname(k)}을(를) 총독부에 맡겼습니다.` : `${cname(k)}을(를) 직접 관리합니다.`) : `${cname(k)} 방침: ${GOV_DIRECTIVES[v].name}` };
}
function govNote(t, text) { (t.govLog = t.govLog || []).unshift(text); if (t.govLog.length > 5) t.govLog.length = 5; }
function autoGovern(s, report) {
  report.terr = report.terr || [];
  const G = govSettings(s); let spent = 0; const notes = [];
  const canSpend = c => spent + c <= G.budget && s.pcap - c >= G.reserve;
  const spend = c => { spent += c; };
  for (const k of Object.keys(s.terr || {})) {
    const t = s.terr[k]; if (!t.auto) continue;
    const dir = t.dir || 'balance', R = RULES[t.rule], r = t.resist, before = notes.length;
    // 징수·징병·투자
    const lv = { extract: t.extract, conscript: t.conscript, invest: t.invest };
    if (dir === 'profit') { lv.extract = r < 55 ? 2 : 1; lv.conscript = R.puppet ? (r < 40 ? 1 : 0) : r < 50 ? 1 : 0; lv.invest = t.dev < 30 ? 1 : 0; }
    else if (dir === 'stable') { lv.extract = r > 50 ? 0 : 1; lv.conscript = 0; lv.invest = r > 65 ? 2 : 1; }
    else if (dir === 'integrate') { lv.extract = r > 60 ? 0 : 1; lv.conscript = 0; lv.invest = 2; }
    else { lv.extract = r < 55 ? 1 : 0; lv.conscript = r < 40 && !R.puppet ? 1 : 0; lv.invest = r > 60 || t.dev < 35 ? 1 : 0; }
    if (lv.invest && !canSpend(LEVELS.invest.cost[lv.invest])) lv.invest = canSpend(LEVELS.invest.cost[1]) ? 1 : 0;
    if (lv.invest) spend(LEVELS.invest.cost[lv.invest]);
    for (const f of ['extract', 'conscript', 'invest']) if (t[f] !== lv[f]) { t[f] = lv[f]; notes.push(`${LEVELS[f].name} → ${LEVELS[f].opts[lv[f]]}`); }
    // 치안 작전
    if (!R.puppet && r >= (dir === 'profit' ? 55 : dir === 'stable' ? 60 : 72) && (t.supCd || 0) <= s.turn && canSpend(15)) { const x = suppressTerritory(s, k); if (x.ok) { spend(0); spent += 15; notes.push('치안 작전'); } }
    // 개발 사업
    if ((t.proj || []).length < 2) for (const id of GOV_PRIORITY[dir](r)) {
      const lvNow = (t.lv?.[id] || 0) + (t.proj || []).filter(x => x.id === id).length; if (lvNow >= 3) continue;
      const c = projCost(k, id, lvNow); if (!canSpend(c)) break;
      const x = terrBuild(s, k, id); if (x.ok) { spent += c; notes.push(`${TERR_PROJECTS.find(p => p.id === id).name} ${lvNow + 1}단계 착공`); }
      break;
    }
    // 현지 정책
    const pol = id => t.pol?.[id];
    const want = { elite: dir !== 'profit' && r > 45, land: dir === 'stable' && r > 50, settle: dir === 'integrate' && r < 40, culture: dir === 'integrate' && r < 30, fta: dir === 'profit' && r < 50, martial: dir === 'profit' && r > 85 };
    for (const [id, on] of Object.entries(want)) {
      const P = TERR_POLICIES.find(x => x.id === id);
      if (on && !pol(id) && canSpend(P.cost)) { terrPolicy(s, k, id); spent += P.cost; notes.push(`${P.name} 시행`); }
      else if (!on && pol(id) && (id === 'martial' ? r < 60 : id === 'settle' || id === 'culture' ? r > 55 : false)) { terrPolicy(s, k, id); notes.push(`${P.name} 폐지`); }
    }
    // 중요한 결정은 대통령에게: 통치 방식 변경 건의
    t.propCd = t.propCd || 0;
    let rec = null;
    if (dir === 'integrate' && !R.puppet && t.rule !== 'integrate' && r < 55) rec = 'integrate';
    else if (r >= 80 && ['colony', 'direct'].includes(t.rule) && dir !== 'profit') rec = 'autonomy';
    else if (dir === 'profit' && t.rule === 'autonomy' && r < 35) rec = 'direct';
    if (rec && t.propCd <= s.turn && !(s.govProps || []).some(p => p.k === k)) { (s.govProps = s.govProps || []).push({ k, rule: rec, turn: s.turn }); t.propCd = s.turn + 6; notes.push(`통치 방식 변경 건의(${RULES[rec].name})`); }
    if (notes.length > before) { const list = notes.slice(before); govNote(t, `${turnLabel(s.turn).year}.${turnLabel(s.turn).q}Q ${list.join(', ')}`); report.terr?.push(`🤖 ${cname(k)} 총독부: ${list.join(', ')}`); }
  }
  if (notes.length) { report.govSpent = spent; addLog(s, 'info', `🤖 총독부가 점령지를 운영했습니다 (지출 ${won(spent)}, 조치 ${notes.length}건)`); }
}
// 총독부 건의 카드
if (typeof DOM_EVENTS !== 'undefined') DOM_EVENTS.govProposal = {
  w: 50, kind: 'politics', icon: '🤖', cond: s => (s.govProps || []).some(p => s.terr?.[p.k]),
  make: s => { s.govProps = (s.govProps || []).filter(p => s.terr?.[p.k]); const p = s.govProps.shift(); const t = s.terr[p.k];
    return { title: `총독부 건의: ${cname(p.k)}을(를) ${RULES[p.rule].name}(으)로`, desc: `${cname(p.k)} 총독부가 통치 방식 변경을 건의했습니다. 현재 ${RULES[t.rule].name}, 저항 ${t.resist.toFixed(0)}, 통합 ${t.integ.toFixed(0)}. ${RULES[p.rule].desc}`, k: p.k, rule: p.rule }; },
  choices: [
    { label: '건의 수용', desc: '통치 방식을 바꿉니다(국고 ₩1.5조).', run: (s, ev) => { const r = setTerr(s, ev.k, 'rule', ev.rule); return r.ok === false ? r.msg : `${cname(ev.k)}의 통치 방식을 ${RULES[ev.rule].name}(으)로 바꿨습니다.`; } },
    { label: '현행 유지', desc: '지금 방식을 유지합니다.', run: (s, ev) => '현행 통치 방식을 유지하라고 지시했습니다.' },
    { label: '직접 관리로 전환', desc: '위임을 풀고 대통령이 직접 챙깁니다.', run: (s, ev) => { if (s.terr[ev.k]) s.terr[ev.k].auto = false; return `${cname(ev.k)}을(를) 직접 관리합니다.`; } },
  ] };
// 새 점령지는 기본으로 총독부 위임(설정에 따라)
(function () { const f = createTerritory; createTerritory = function (s, k, rule, peaceful) { const t = f(s, k, rule, peaceful); if (govSettings(s).autoNew !== false) { t.auto = true; t.dir = govSettings(s).defDir || (k === 'nk' ? 'integrate' : 'balance'); } return t; }; })();
HOOKS.migrate.push(s => { if (!s.govMigrated) { s.govMigrated = true; for (const [k, t] of Object.entries(s.terr || {})) if (t.auto == null) { t.auto = true; t.dir = t.dir || (k === 'nk' ? 'integrate' : 'balance'); } } });
HOOKS.postTurn.push(autoGovern);
HOOKS.postTurn.push(territoryTurn);
