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
  const capital = (c.eco * 0.35 + 2) * (t.dev / 50) * ext * calm;
  const upkeep = R.upkeep * (c.eco * 0.5 + 6) + LEVELS.invest.cost[t.invest];
  const divs = R.puppet ? terrPop(k) / 1e6 * 0.08 * LEVELS.conscript.mul[Math.min(1, t.conscript)] : terrPop(k) / 1e6 * 0.2 * Math.max(LEVELS.conscript.mul[t.conscript], full ? 0.4 : 0) * calm;
  const milShare = R.puppet ? 0.08 : t.rule === 'autonomy' ? 0.08 : 0.15;
  const mil = c.mil * milShare * calm;
  const gdp = ecoK(k) * 0.12 * (t.dev / 50) * (t.extract > 0 ? 1 : 0.6) * calm * (R.puppet ? 0.5 : 1);
  return { capital, upkeep, divs: Math.min(divs, 25), air: mil * 0.5, navy: mil * 0.4, mil, gdp };
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
  report.terr = [];
  let gdp = 0;
  for (const k of Object.keys(s.terr || {})) {
    const t = s.terr[k], R = RULES[t.rule], o = terrOutput(s, k);
    gdp += o.gdp; // 자본(국고)은 budgetIncome의 점령지 항목으로 들어옴
    // 저항·통합·개발
    const inv = t.invest;
    const years = (s.turn - t.since) / 4; // 세월이 흐르면 저항이 조금씩 체념으로
    t.resist = clamp(t.resist + R.resist + LEVELS.extract.resist[t.extract] + LEVELS.conscript.resist[t.conscript] + LEVELS.invest.resist[inv] - t.integ / 60 - Math.min(1.5, years * 0.3) + gauss() * 1.2, 0, 100);
    t.integ = clamp(t.integ + Math.max(0, R.integ + LEVELS.invest.integ[inv]) * (1 - t.resist / 150), 0, 100);
    t.dev = clamp(t.dev + LEVELS.invest.dev[inv] - (t.resist > 70 ? 1 : 0) + 0.3, 5, 100);
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
HOOKS.postTurn.push(territoryTurn);
