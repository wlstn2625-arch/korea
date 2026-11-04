/* =========================================================
 *  외교·지도·전쟁
 *  - 동아시아 주요국의 국력·관계·조약
 *  - 외교 행동(정상회담·원조·FTA·동맹·제재·최후통첩·선전포고·평화통일)
 *  - 전쟁: 국력·동맹 개입으로 전황 점수가 움직이고, 승리 시 합병·통일·배상
 * ========================================================= */

// mil: 군사력(0~100), eco: 경제 규모, nukes: 핵보유, annex: 합병 가능, far: 원거리(전쟁 불가)
const COUNTRIES = {
  nk: { mil: 50, eco: 3,   nukes: true,  annex: true,  pos: [55, 30], pop: '2,600만', note: '핵·미사일 보유, 세계 최대급 재래식 병력' },
  cn: { mil: 95, eco: 95,  nukes: true,  annex: false, pos: [24, 42], pop: '14억',    note: '최대 교역국, 북한의 사실상 후견국' },
  jp: { mil: 62, eco: 70,  nukes: false, annex: true,  pos: [80, 52], pop: '1억 2천만', note: '한미일 안보협력 축, 과거사 갈등' },
  ru: { mil: 80, eco: 35,  nukes: true,  annex: false, pos: [62, 13],  pop: '1억 4천만', note: '북러 군사협력 강화' },
  us: { mil: 100, eco: 100, nukes: true, annex: false, far: true, pos: [93, 28], pop: '3억 4천만', note: '유일한 군사동맹국, 주한미군 주둔' },
  tw: { mil: 42, eco: 35,  nukes: false, annex: true,  pos: [42, 82], pop: '2,300만', note: '반도체 경쟁국, 양안 긴장' },
  eu: { mil: 65, eco: 90,  nukes: true,  annex: false, far: true, pos: [9, 15],  pop: '4억 5천만', note: '가치 외교 파트너, 탄소국경세' },
};
// 상대를 공격하면 편을 드는 나라: [나라, 조건]
const PROTECTORS = {
  nk: [['cn', s => s.rel.cn < 65 && !s.diplo.cn.alliance], ['ru', s => s.rel.ru < 40]],
  tw: [['us', s => s.rel.us < 90], ['jp', s => s.rel.jp < 85]],
  jp: [['us', s => true]],
  cn: [['ru', s => s.rel.ru < 60], ['nk', s => !s.annexed.nk]],
  ru: [['cn', s => s.rel.cn < 50]],
};

function milPower(s) {
  const p = s.policies;
  let m = s.stats.security * 0.8;
  m += { up35: 6, up5: 12, down2: -5 }[p.def_budget] || 0;
  m += { volunteer: -4, both: 4, m24: 3 }[p.conscript] || 0;
  m += { armed: 15, latent: 3 }[p.nuke] || 0;
  if (s.annexed?.nk) m += 8;
  return clamp(m, 5, 120);
}
const hasNukes = (s, k) => k === 'kr' ? s.policies.nuke === 'armed' : COUNTRIES[k].nukes;

/* ---------------- 외교 행동 ---------------- */
const DIPLO_ACTIONS = [
  { id: 'summit', name: '정상회담', icon: '🤝', pc: 12, desc: '관계 +8 (지속 +3). 2분기 쿨타임.',
    can: (s, k) => k === 'nk' && s.rel.nk < 25 ? '북한이 회담을 거부합니다(관계 25 이상 필요).' : (s.diplo[k].cd > s.turn ? '최근에 회담했습니다.' : null),
    run: (s, k) => { relBump(s, k, 8, 3); s.diplo[k].cd = s.turn + 2; return `${RELATIONS[k].name}과 정상회담을 가졌습니다.`; } },
  { id: 'aid', name: '경제 원조', icon: '🎁', pc: 8, desc: '관계 +6 (지속 +2). 재정 -0.2%p.',
    can: (s, k) => k === 'us' || k === 'eu' ? '원조 대상이 아닙니다.' : null,
    run: (s, k) => { relBump(s, k, 6, 2); s.stats.fiscal -= 0.2; if (k === 'nk') { s.factions.lib += 3; s.factions.con -= 3; } return `${RELATIONS[k].name}에 경제 원조를 제공했습니다.`; } },
  { id: 'fta', name: 'FTA 체결', icon: '📦', pc: 30, desc: '성장률 +0.08%p, 관계 +5. 농어민 반발. 관계 55 이상.',
    can: (s, k) => s.diplo[k].fta ? '이미 FTA가 있습니다.' : k === 'nk' ? '북한과는 불가합니다.' : s.rel[k] < 55 ? '관계 55 이상 필요.' : null,
    cost: (s, k) => s.diplo[k].offer >= s.turn ? 15 : 30,
    run: (s, k) => { s.diplo[k].fta = true; s.mods.gdp += 0.08; relBump(s, k, 3, 5); s.factions.farm -= 6; s.factions.biz += 5; return `${RELATIONS[k].name}과 FTA를 체결했습니다.`; } },
  { id: 'alliance', name: '안보 동맹', icon: '🛡️', pc: 40, desc: '안보 +5. 상대 진영 반발. 관계 75 이상.',
    can: (s, k) => s.diplo[k].alliance ? '이미 동맹입니다.' : k === 'nk' ? '불가합니다.' : s.rel[k] < 75 ? '관계 75 이상 필요.' : null,
    run: (s, k) => {
      s.diplo[k].alliance = true; s.mods.security += 5; relBump(s, k, 3, 5);
      if (['us', 'jp', 'tw'].includes(k)) s.relMods.cn -= 8;
      if (k === 'cn' || k === 'ru') { s.relMods.us -= 12; s.relMods.jp -= 6; }
      return `${RELATIONS[k].name}과 안보 동맹을 맺었습니다.`; } },
  { id: 'unally', name: '동맹 파기', icon: '✂️', pc: 10, desc: '안보 -5, 관계 -15.',
    can: (s, k) => s.diplo[k].alliance ? null : '동맹이 아닙니다.',
    run: (s, k) => { s.diplo[k].alliance = false; s.mods.security -= 5; relBump(s, k, -10, -15); return `${RELATIONS[k].name}과의 동맹을 파기했습니다.`; } },
  { id: 'sanction', name: '경제 제재', icon: '🚫', pc: 12, desc: '관계 -15, 우리 경제도 일부 타격.',
    can: (s, k) => s.diplo[k].sanction ? '이미 제재 중입니다.' : null,
    run: (s, k) => { s.diplo[k].sanction = true; relBump(s, k, -10, -15); s.mods.gdp -= 0.03 * COUNTRIES[k].eco / 50; return `${RELATIONS[k].name}에 경제 제재를 가했습니다.`; } },
  { id: 'unsanction', name: '제재 해제', icon: '🔓', pc: 5, desc: '관계 +8.',
    can: (s, k) => s.diplo[k].sanction ? null : '제재 중이 아닙니다.',
    run: (s, k) => { s.diplo[k].sanction = false; s.mods.gdp += 0.03 * COUNTRIES[k].eco / 50; relBump(s, k, 5, 8); return `${RELATIONS[k].name}에 대한 제재를 해제했습니다.`; } },
  { id: 'ultimatum', name: '최후통첩', icon: '📜', pc: 20, desc: '양보를 요구. 거부하면 전쟁 명분이 생깁니다. 관계 35 미만.',
    can: (s, k) => COUNTRIES[k].far ? '원거리 국가입니다.' : s.rel[k] >= 35 ? '관계 35 미만에서만 가능합니다.' : s.war ? '전쟁 중입니다.' : null,
    run: (s, k) => {
      const ratio = (milPower(s) + allyPower(s, k, 'kr')) / (COUNTRIES[k].mil + allyPower(s, k, 'them'));
      if (ratio > 1.3 && Math.random() < 0.4 + (ratio - 1.3)) {
        s.stats.fiscal += 0.6; s.mods.fiscal += 0.15; relBump(s, k, -8, -6); s.approval = clamp(s.approval + 4, 0, 100);
        return `✅ ${RELATIONS[k].name}이(가) 최후통첩을 수용하고 양보(배상·경제 이권)했습니다.`;
      }
      s.diplo[k].casusBelli = s.turn + 4; relBump(s, k, -10, -8);
      return `❌ ${RELATIONS[k].name}이(가) 최후통첩을 거부했습니다. 4분기 동안 전쟁 명분이 생겼습니다.`; } },
  { id: 'war', name: '선전포고', icon: '⚔️', pc: 30, desc: '전쟁을 시작합니다. 관계 25 미만 또는 최후통첩 거부 시.',
    can: (s, k) => COUNTRIES[k].far ? '원거리 국가와는 전쟁할 수 없습니다.' : s.war ? '이미 전쟁 중입니다.' : (s.rel[k] >= 25 && !(s.diplo[k].casusBelli >= s.turn)) ? '관계 25 미만이거나 최후통첩 거부 명분이 필요합니다.' : null,
    run: (s, k, goal) => startWar(s, k, 'kr', goal) },
  { id: 'unify', name: '평화통일 협상', icon: '🕊️', pc: 60, desc: '남북 관계 80 이상. 남북 동시 국민투표.',
    can: (s, k) => k !== 'nk' ? '북한만 해당합니다.' : s.annexed.nk ? '이미 통일되었습니다.' : s.rel.nk < 80 ? '남북 관계 80 이상 필요.' : null,
    run: (s, k) => {
      const sup = s.approval * 0.5 + 25 + (s.rel.nk - 80) * 0.5 + gauss() * 5;
      if (sup > 50) { annex(s, 'nk', true); return `🕊️ 국민투표 찬성 ${sup.toFixed(1)}%! 평화통일이 이루어졌습니다.`; }
      relBump(s, 'nk', -5, 0); return `국민투표 찬성 ${sup.toFixed(1)}%로 부결되었습니다.`; } },
];

function relBump(s, k, now, lasting) {
  s.rel[k] = clamp(s.rel[k] + now, 0, 100); s.relMods[k] += lasting;
}
function diploCost(s, a, k) { return a.cost ? a.cost(s, k) : a.pc; }
function diploAction(s, aid, k, goal) {
  const a = DIPLO_ACTIONS.find(x => x.id === aid);
  if (s.annexed[k]) return { ok: false, msg: '이미 합병된 지역입니다.' };
  const why = a.can(s, k); if (why) return { ok: false, msg: why };
  const cost = diploCost(s, a, k);
  if (s.pcap < cost) return { ok: false, msg: `정치자본 ⚡${cost}이 필요합니다.` };
  s.pcap -= cost;
  const msg = a.run(s, k, goal);
  for (const f in s.factions) s.factions[f] = clamp(s.factions[f], 0, 100);
  addLog(s, /❌|파기|제재를 가/.test(msg) ? 'bad' : 'good', `${a.icon} ${msg}`);
  return { ok: true, msg };
}

/* ---------------- 전쟁 ---------------- */
function allyPower(s, k, side) {
  if (side === 'kr') return (s.war?.allies || warAllies(s, k, 'kr')).reduce((a, c) => a + COUNTRIES[c].mil * 0.5, 0);
  return (s.war?.enemyAllies || warAllies(s, k, 'them')).reduce((a, c) => a + COUNTRIES[c].mil * 0.5, 0);
}
function warAllies(s, k, side, aggressor = 'kr') {
  if (side === 'them') return (PROTECTORS[k] || []).filter(([c, cond]) => c !== k && !s.annexed[c] && !(s.diplo[c]?.alliance) && cond(s)).map(([c]) => c);
  const out = [];
  for (const c of Object.keys(COUNTRIES)) {
    if (c === k || !s.diplo[c]?.alliance || s.annexed[c]) continue;
    if ((PROTECTORS[k] || []).some(([p]) => p === c)) continue;
    // 방어전이거나, 북한 상대 전쟁에 미국이 동의할 때 참전
    if (aggressor === 'them' || (k === 'nk' && c === 'us' && s.rel.us >= 70) || s.rel[c] >= 85) out.push(c);
  }
  return out;
}
function warOdds(s, k) {
  const ours = milPower(s) + allyPower(s, k, 'kr'), theirs = COUNTRIES[k].mil + allyPower(s, k, 'them');
  return { ours, theirs, edge: (ours - theirs) / (ours + theirs) };
}
function nukeRisk(s) {
  const w = s.war; if (!w) return 0;
  const enemyNuke = hasNukes(s, w.k) || w.enemyAllies.some(c => COUNTRIES[c].nukes);
  if (!enemyNuke || w.score < 40) return 0;
  const deter = hasNukes(s, 'kr') || w.allies.includes('us');
  return clamp((deter ? 0.02 : 0.06) + (w.score - 40) / (deter ? 1500 : 500), 0, 0.3);
}

const GOAL_NAMES = { annex: '합병', unify: '흡수통일', concession: '배상·이권 획득' };
function startWar(s, k, aggressor, goal) {
  goal = goal || (k === 'nk' ? 'unify' : COUNTRIES[k].annex ? 'annex' : 'concession');
  if (goal !== 'concession' && !COUNTRIES[k].annex) goal = 'concession';
  const allies = warAllies(s, k, 'kr', aggressor), enemyAllies = warAllies(s, k, 'them');
  s.war = { k, goal, aggressor, score: 0, turns: 0, allies, enemyAllies, log: [] };
  for (const c of enemyAllies) relBump(s, c, -25, -20);
  if (aggressor === 'kr') {
    // 침략 전쟁에 대한 국제 사회 반발 (미국이 함께 싸우는 대북 전쟁은 예외)
    const approved = k === 'nk' && allies.includes('us');
    for (const c of ['us', 'eu', 'jp', 'cn']) if (c !== k && !allies.includes(c) && !enemyAllies.includes(c)) relBump(s, c, approved ? -3 : -15, approved ? -2 : -12);
    s.factions.lib -= 10; s.factions.youth -= 6; s.factions.mil += 8; s.factions.con += k === 'nk' ? 6 : 0;
    s.approval = clamp(s.approval + (approved ? 3 : -4), 0, 100);
  } else {
    s.approval = clamp(s.approval + 8, 0, 100); // 결집 효과
    s.factions.mil += 10; s.factions.con += 5;
  }
  relBump(s, k, -40, -40);
  const msg = `⚔️ ${RELATIONS[k].name}과 전쟁 발발! (${aggressor === 'kr' ? '우리가 선전포고' : '상대의 침공'}) 목표: ${GOAL_NAMES[goal]}. 우리 편: ${allies.map(c => RELATIONS[c].name).join(', ') || '없음'} / 상대 편: ${enemyAllies.map(c => RELATIONS[c].name).join(', ') || '없음'}`;
  addLog(s, 'bad', msg);
  return msg;
}

function warAction(s, act) {
  const w = s.war; if (!w) return { ok: false, msg: '전쟁 중이 아닙니다.' };
  if (act === 'offensive') {
    if (s.pcap < 15) return { ok: false, msg: '정치자본 ⚡15가 필요합니다.' };
    s.pcap -= 15; w.push = 12; s.stats.happiness -= 1; s.stats.debt += 1;
    addLog(s, 'info', '🎖️ 총공세를 명령했습니다. 다음 분기 전황에 큰 영향을 줍니다.');
    return { ok: true };
  }
  if (act === 'peace') {
    const sc = w.score;
    if (sc >= 40) { endWar(s, 'concession'); return { ok: true, msg: '상대가 불리한 조건으로 강화에 응했습니다. 배상과 이권을 얻었습니다.' }; }
    if (sc >= -20 && Math.random() < 0.6) { endWar(s, 'white'); return { ok: true, msg: '현 전선에서 휴전 협정이 체결되었습니다.' }; }
    if (sc < -20) { endWar(s, 'concede'); return { ok: true, msg: '불리한 조건으로 강화했습니다. 배상금을 지불합니다.' }; }
    addLog(s, 'bad', '🕊️ 휴전 제안이 거부되었습니다.');
    return { ok: true, msg: '상대가 휴전 제안을 거부했습니다.' };
  }
}

function endWar(s, outcome) {
  const w = s.war; const k = w.k; s.war = null;
  const name = RELATIONS[k].name;
  if (outcome === 'victory') {
    if (w.goal === 'concession') endWar2Concession(s, k);
    else annex(s, k, false);
  } else if (outcome === 'concession') endWar2Concession(s, k);
  else if (outcome === 'white') { addLog(s, 'info', `🏳️ ${name}과 휴전했습니다. 영토 변화는 없습니다.`); relBump(s, k, 10, 15); }
  else if (outcome === 'concede') { s.stats.fiscal -= 1.5; s.mods.fiscal -= 0.3; s.approval = clamp(s.approval - 10, 0, 100); s.stats.security -= 5; addLog(s, 'bad', `📉 ${name}에 배상금을 지불하는 조건으로 강화했습니다.`); relBump(s, k, 10, 15); }
  for (const c of [...w.allies, ...w.enemyAllies]) relBump(s, c, 0, c && w.enemyAllies.includes(c) ? 8 : 0);
}
function endWar2Concession(s, k) {
  s.stats.fiscal += 1.0; s.mods.fiscal += 0.25; s.mods.gdp += 0.05; s.approval = clamp(s.approval + 6, 0, 100);
  relBump(s, k, 10, 10);
  addLog(s, 'good', `🏆 ${RELATIONS[k].name}으로부터 배상과 경제 이권을 얻어냈습니다.`);
}

// 합병·통일
function annex(s, k, peaceful) {
  s.annexed[k] = true; s.diplo[k].sanction = false;
  if (k === 'nk') {
    s.stats.debt += peaceful ? 14 : 22; s.mods.gdp += 0.35; s.mods.tfr += 0.08; s.mods.security += 12; s.mods.gini += 0.015;
    s.stats.happiness -= peaceful ? 1 : 5; s.relMods.cn -= peaceful ? 5 : 18; s.relMods.ru -= peaceful ? 2 : 10;
    s.approval = clamp(s.approval + (peaceful ? 15 : 10), 0, 100); s.scoreBonus = (s.scoreBonus || 0) + (peaceful ? 15 : 10);
    s.rel.nk = 100; s.unifiedTurn = s.turn;
    addLog(s, 'good', peaceful ? '🇰🇷 한반도 평화통일 달성! 통일 비용과 함께 새로운 성장 동력이 생겼습니다.' : '🇰🇷 전쟁 끝에 한반도가 통일되었습니다. 막대한 재건 비용과 주변국 반발이 뒤따릅니다.');
  } else {
    const g = { tw: { gdp: 0.25, inn: 5, debt: 8 }, jp: { gdp: 0.6, inn: 6, debt: 15 } }[k] || { gdp: 0.1, inn: 1, debt: 10 };
    s.stats.debt += g.debt; s.mods.gdp += g.gdp; s.mods.innovation += g.inn; s.stats.happiness -= 3;
    for (const c of ['us', 'cn', 'eu', 'jp', 'ru']) if (c !== k && !s.annexed[c]) relBump(s, c, -15, k === 'tw' && c === 'cn' ? -25 : -15);
    s.approval = clamp(s.approval + 5, 0, 100); s.scoreBonus = (s.scoreBonus || 0) + 4;
    s.occupied = s.occupied || {}; s.occupied[k] = s.turn;
    s.rel[k] = 50;
    addLog(s, 'good', `🚩 ${RELATIONS[k].name}을(를) 합병했습니다. 점령지 저항과 국제 사회의 강한 반발이 예상됩니다.`);
  }
}

/* ---------------- 전선: 전황 점수 → 점령된 시·도 ---------------- */
const CAPITAL = { nk: '평양', jp: '도쿄', tw: '타이베이', cn: '베이징', ru: '블라디보스토크', kr: '서울' };
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
function warOccupation(s) {
  const out = { byUs: new Set(), byEnemy: new Set(), seoulLost: false, enemyCapitalTaken: false };
  const w = s.war; if (!w || typeof MAP_DATA === 'undefined') return out;
  const seoul = MAP_DATA.cities['서울'], cap = MAP_DATA.cities[CAPITAL[w.k]];
  if (w.score > 0 && MAP_DATA.prov[w.k]) {
    // 우리 쪽에서 가까운 곳부터 진격
    const list = [...MAP_DATA.prov[w.k]].filter(p => p.c).sort((a, b) => dist2(a.c, seoul) - dist2(b.c, seoul));
    const n = Math.round(w.score / 100 * list.length);
    list.slice(0, n).forEach(p => out.byUs.add(p.id));
    out.enemyCapitalTaken = n >= list.length * 0.85;
  }
  if (w.score < 0) {
    // 적은 자기 수도 쪽에서 가까운 우리 시·도부터 점령
    const list = [...MAP_DATA.prov.kr].filter(p => p.c).sort((a, b) => dist2(a.c, cap) - dist2(b.c, cap));
    const n = Math.round(-w.score / 100 * list.length);
    list.slice(0, n).forEach(p => out.byEnemy.add(p.id));
    out.seoulLost = list.slice(0, n).some(p => p.n === '서울특별시');
  }
  return out;
}

/* ---------------- 분기 처리 ---------------- */
function worldTurn(s, report) {
  report.world = { events: [] };
  // 상대국 AI: 북한의 기습 침공(관계 최악·우리 군사력 약할 때)
  if (!s.war && !s.annexed.nk && s.rel.nk < 8 && milPower(s) < 58 && Math.random() < 0.04) {
    report.world.events.push(startWar(s, 'nk', 'them', 'concession'));
  }
  // 우호국의 FTA 제안
  for (const k of Object.keys(COUNTRIES)) {
    const d = s.diplo[k]; if (s.annexed[k] || d.fta || k === 'nk') continue;
    if (s.rel[k] >= 68 && Math.random() < 0.08) { d.offer = s.turn + 2; const t = `📨 ${RELATIONS[k].name}이(가) FTA 체결을 제안했습니다. (2분기 동안 비용 ⚡15)`; addLog(s, 'info', t); report.world.events.push(t); }
  }
  // 제재 중인 상대의 보복
  for (const k of Object.keys(COUNTRIES)) if (s.diplo[k].sanction && !s.annexed[k]) { s.rel[k] = clamp(s.rel[k] - 2, 0, 100); }
  // 점령지 저항
  for (const k in (s.occupied || {})) { s.stats.safety -= 0.8; s.stats.fiscal -= 0.1; }

  const w = s.war; if (!w) return;
  w.turns++;
  const o = warOdds(s, w.k);
  const delta = o.edge * 45 + gauss() * 10 + (w.push || 0);
  w.push = 0;
  w.score = clamp(w.score + delta, -100, 100);
  // 전쟁 비용
  s.stats.gdp -= 0.5; s.stats.happiness -= 1.5; s.stats.debt += 1.5; s.stats.fiscal -= 0.3; s.stats.safety -= 1;
  if (w.turns > 1) s.approval = clamp(s.approval - 1.5, 0, 100);
  for (const c of w.allies) relBump(s, c, 1, 0);
  // 점령당한 우리 시·도만큼 추가 피해, 서울 함락 시 큰 타격
  const occ = warOccupation(s);
  s.stats.gdp -= 0.12 * occ.byEnemy.size; s.stats.happiness -= 0.4 * occ.byEnemy.size;
  if (occ.seoulLost) { s.stats.gdp -= 1; s.approval = clamp(s.approval - 4, 0, 100); }
  const occTxt = occ.byUs.size ? ` · 아군이 ${RELATIONS[w.k].name} ${occ.byUs.size}개 지역 장악` : occ.byEnemy.size ? ` · 적이 우리 시·도 ${occ.byEnemy.size}곳 점령${occ.seoulLost ? '(서울 함락!)' : ''}` : '';
  const line = `${turnLabel(s.turn).year}.${turnLabel(s.turn).q}Q 전황 ${delta >= 0 ? '진격' : '후퇴'} (${delta >= 0 ? '+' : ''}${delta.toFixed(0)}) → 전황 점수 ${w.score.toFixed(0)}${occTxt}`;
  w.log.push(line); report.world.war = line;
  // 핵 사용 위험
  if (Math.random() < nukeRisk(s)) {
    s.forceEnding = { type: 'nuke', title: '핵 공격', desc: `패색이 짙어진 ${RELATIONS[w.k].name} 진영이 핵무기를 사용했습니다. 한반도는 회복하기 어려운 피해를 입었습니다.` };
    return;
  }
  if (w.score >= 100) { report.world.events.push(`🏆 ${RELATIONS[w.k].name}과의 전쟁에서 승리했습니다!`); endWar(s, 'victory'); }
  else if (w.score <= -100) { s.forceEnding = { type: 'defeat', title: '패전', desc: `${RELATIONS[w.k].name} 진영과의 전쟁에서 패배했습니다. 정부는 항복 문서에 서명했습니다.` }; }
  else if (w.turns >= 8) { report.world.events.push('장기전 끝에 국제 사회 중재로 정전협정이 맺어졌습니다.'); endWar(s, 'white'); }
}

// 통일·합병 후 사라진 상대와 관련된 돌발 사건 제거, 점령지 저항 사건 추가
function worldEvents(s, report, newCrises) {
  for (let i = newCrises.length - 1; i >= 0; i--) {
    const c = newCrises[i];
    if ((s.annexed.nk && (c.relTarget === 'nk' || /북한|NLL/.test(c.title))) || (c.relTarget && s.annexed[c.relTarget])) newCrises.splice(i, 1);
  }
  for (const k in (s.occupied || {})) if (Math.random() < 0.2) newCrises.push(makeCrisis(s, { tpl: 'security', title: `${RELATIONS[k].name} 점령지 저항 운동`, desc: `합병된 ${RELATIONS[k].name} 지역에서 무장 저항과 대규모 시위가 이어지고 있습니다.`, sev: 2 }));
}

HOOKS.migrate.push(s => {
  if (s.rel.tw == null) { s.rel.tw = RELATIONS.tw.base; s.relMods.tw = 0; }
  if (!s.diplo) {
    s.diplo = {};
    for (const k in COUNTRIES) s.diplo[k] = { fta: ['us', 'cn', 'eu', 'jp'].includes(k), alliance: k === 'us', sanction: false, cd: 0 };
  }
  if (!s.annexed) s.annexed = {};
  if (s.war === undefined) s.war = null;
});
HOOKS.postMacro.push(worldTurn);
HOOKS.events.push(worldEvents);
