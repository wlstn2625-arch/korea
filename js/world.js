/* =========================================================
 *  세계 외교·전쟁
 *  - 지도의 모든 나라(약 200개국)와 외교·전쟁 가능
 *  - 핵심 7개국(미·중·일·러·대만·북한·EU)은 국가 지표에 직접 영향을 주는 관계,
 *    나머지 나라는 실제 GDP·인구로 국력을 정하고 블록(NATO 등)에 따라 편을 듦
 *  - 전쟁: 국력·거리(전력 투사)·동맹 개입으로 전황이 움직이고, 승리 시 배상·합병·통일
 * ========================================================= */

// 핵심 7개국 고유 정보 (RELATIONS 키와 같음)
const CORE_INFO = {
  nk: { mil: 50, eco: 3, nukes: true, note: '핵·미사일 보유, 세계 최대급 재래식 병력' },
  cn: { mil: 95, eco: 95, nukes: true, note: '최대 교역국, 북한의 사실상 후견국' },
  jp: { mil: 62, eco: 70, nukes: false, note: '한미일 안보협력 축, 과거사 갈등' },
  ru: { mil: 80, eco: 35, nukes: true, note: '북러 군사협력 강화' },
  us: { mil: 100, eco: 100, nukes: true, note: '유일한 군사동맹국, 주한미군 주둔' },
  tw: { mil: 42, eco: 35, nukes: false, note: '반도체 경쟁국, 양안 긴장' },
  eu: { mil: 65, eco: 90, nukes: true, note: '27개 회원국 연합(블록). 가치 외교 파트너, 탄소국경세', bloc: true },
};
// 군사력 보정(실제 군사력 순위 참고), 핵보유국
const MIL_OVERRIDE = { ind: 78, gbr: 68, fra: 70, deu: 55, tur: 58, pak: 55, isr: 60, irn: 50, egy: 45, bra: 42, ukr: 52, ita: 50, sau: 45, idn: 45, vnm: 45, aus: 45, pol: 45, tha: 40, can: 40, esp: 42, grc: 35, phl: 30, dza: 38, mex: 35, nga: 30, prk: 50, irq: 30, syr: 25, mmr: 32, bgd: 30, swe: 38, nor: 35, fin: 38, che: 30, nld: 35, arg: 30, col: 32, chl: 30, zaf: 32, eth: 30, mar: 30, are: 38, qat: 25, sgp: 38, mys: 32, kaz: 30, blr: 30, cub: 22, ven: 25, afg: 18 };
const NUKES = new Set(['us', 'ru', 'cn', 'gbr', 'fra', 'ind', 'pak', 'isr', 'nk']);
const NATO = new Set(['us', 'can', 'gbr', 'fra', 'deu', 'ita', 'esp', 'prt', 'nld', 'bel', 'lux', 'dnk', 'nor', 'isl', 'tur', 'grc', 'pol', 'cze', 'svk', 'hun', 'rou', 'bgr', 'hrv', 'svn', 'alb', 'mne', 'mkd', 'est', 'lva', 'ltu', 'fin', 'swe']);
const EU_MEMBERS = new Set(['deu', 'fra', 'ita', 'esp', 'prt', 'nld', 'bel', 'lux', 'dnk', 'irl', 'aut', 'swe', 'fin', 'est', 'lva', 'ltu', 'pol', 'cze', 'svk', 'hun', 'svn', 'hrv', 'rou', 'bgr', 'grc', 'cyp', 'mlt']);
// 블록: 이 나라를 공격하면 편을 드는 나라
const BLOC_PROTECT = {
  csto: { members: ['blr', 'kaz', 'arm', 'kgz', 'tjk'], protectors: ['ru'] },
  cnPartner: { members: ['pak', 'lao', 'khm', 'mmr'], protectors: ['cn'] },
  usPartner: { members: ['aus', 'nzl', 'phl', 'isr', 'sau', 'are', 'qat', 'kwt', 'bhr'], protectors: ['us'] },
  ruPartner: { members: ['cub', 'ven', 'syr', 'irn'], protectors: ['ru'] },
};
const CORE_PROTECT = { nk: ['cn', 'ru'], tw: ['us', 'jp'], jp: ['us'], cn: ['ru', 'nk'], ru: ['cn', 'blr'] };
// 보호국이 참전하는 관계 상한 (이보다 우리와 가까우면 중립)
const PROTECT_TH = { 'nk>cn': 65, 'nk>ru': 40, 'tw>us': 90, 'tw>jp': 85, 'cn>ru': 60, 'ru>cn': 50 };
// 출발 시 관계 (지정 없으면 대륙별 기본값)
const BASE_REL = { gbr: 74, can: 72, aus: 75, nzl: 70, deu: 70, fra: 68, ind: 66, vnm: 72, idn: 68, phl: 66, tha: 68, mys: 66, sgp: 74, pol: 76, tur: 70, sau: 68, are: 72, qat: 66, isr: 58, ukr: 64, mng: 70, kaz: 66, uzb: 70, mex: 62, chl: 66, bra: 60, pak: 50, irn: 30, syr: 22, blr: 30, cub: 40, ven: 42, afg: 30, mmr: 40, lao: 58, khm: 62, egy: 60, nga: 56, zaf: 58 };
const REG_REL = { Asia: 55, Europe: 60, 'North America': 60, 'South America': 56, Africa: 52, Oceania: 64 };
// 한국이 이미 FTA를 맺은 나라 (RCEP 포함)
const KOREA_FTA = new Set(['us', 'cn', 'jp', 'eu', 'chl', 'sgp', 'ind', 'per', 'tur', 'aus', 'can', 'nzl', 'vnm', 'col', 'gbr', 'isr', 'idn', 'phl', 'khm', 'cri', 'slv', 'hnd', 'nic', 'pan', 'mys', 'tha', 'brn', 'lao', 'mmr', 'ecu', 'are', 'gtm', ...EU_MEMBERS]);

const SUB_KO = { 'Eastern Asia': '동아시아', 'South-Eastern Asia': '동남아시아', 'Southern Asia': '남아시아', 'Central Asia': '중앙아시아', 'Western Asia': '서아시아·중동',
  'Eastern Europe': '동유럽', 'Northern Europe': '북유럽', 'Southern Europe': '남유럽', 'Western Europe': '서유럽', 'Northern Africa': '북아프리카', 'Western Africa': '서아프리카',
  'Middle Africa': '중앙아프리카', 'Eastern Africa': '동아프리카', 'Southern Africa': '남아프리카', 'Northern America': '북아메리카', 'Central America': '중앙아메리카', 'Caribbean': '카리브해',
  'South America': '남아메리카', 'Australia and New Zealand': '오세아니아', 'Melanesia': '멜라네시아', 'Micronesia': '미크로네시아', 'Polynesia': '폴리네시아', 'Seven seas (open ocean)': '대양 도서' };
const SEOUL_LL = [126.98, 37.57];
function kmBetween(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 나라 정보 (지도 데이터 + 핵심국 정보)
const _cinfo = {};
function cinfo(k) {
  if (_cinfo[k]) return _cinfo[k];
  const m = (typeof MAP_DATA !== 'undefined' && MAP_DATA.countries[k]) || null;
  const core = CORE_INFO[k];
  if (!m && !core) return null;
  const gdp = m?.gdp || 1000, pop = m?.pop || 1e6;
  const eco = core ? core.eco : clamp(Math.round(100 * Math.log10(gdp / 1000) / Math.log10(21433226 / 1000)), 1, 100);
  const mil = core ? core.mil : MIL_OVERRIDE[k] ?? clamp(Math.round(eco * 0.5 + Math.log10(pop) * 4 - 18), 3, 60);
  const ll = k === 'eu' ? [4.35, 50.85] : m?.ll || SEOUL_LL;
  const km = kmBetween(SEOUL_LL, ll);
  const name = core && RELATIONS[k] ? RELATIONS[k].name : m?.n || k;
  const flag = core && RELATIONS[k] ? RELATIONS[k].flag : m?.f || '🏳️';
  const nukes = core ? core.nukes : NUKES.has(k);
  const bloc = NATO.has(k) ? 'NATO' : Object.entries(BLOC_PROTECT).find(([, b]) => b.members.includes(k))?.[0];
  return (_cinfo[k] = {
    k, name, flag, mil, eco, nukes, core: !!RELATIONS[k], isBloc: !!core?.bloc, eu: EU_MEMBERS.has(k),
    annex: !core?.bloc && (!nukes || k === 'nk'), note: core?.note || '', pop, gdp, reg: m?.reg || '', sub: SUB_KO[m?.sub] || m?.sub || '', km,
    reach: clamp(1 - (km - 1500) / 14000, 0.35, 1), bloc,
  });
}
const cname = k => cinfo(k)?.name || k;
const cflag = k => cinfo(k)?.flag || '🏳️';
const allCountryKeys = () => [...Object.keys(CORE_INFO), ...Object.keys(typeof MAP_DATA !== 'undefined' ? MAP_DATA.countries : {}).filter(k => k !== 'kr' && !CORE_INFO[k])];
const isCore = k => !!RELATIONS[k];
function baseRel(k) {
  if (RELATIONS[k]) return RELATIONS[k].base;
  if (BASE_REL[k] != null) return BASE_REL[k];
  const c = cinfo(k); return REG_REL[c?.reg] ?? 55;
}
function dip(s, k) { return s.diplo[k] || (s.diplo[k] = { fta: KOREA_FTA.has(k), alliance: k === 'us', sanction: false, cd: 0 }); }
const relOf = (s, k) => s.rel[k] ?? baseRel(k);

function milPower(s) {
  const p = s.policies;
  let m = s.stats.security * 0.8;
  m += { up35: 6, up5: 12, down2: -5 }[p.def_budget] || 0;
  m += { volunteer: -4, both: 4, m24: 3 }[p.conscript] || 0;
  m += { armed: 15, latent: 3 }[p.nuke] || 0;
  if (s.annexed?.nk) m += 8;
  m += Object.keys(s.annexed || {}).filter(k => k !== 'nk').reduce((a, k) => a + cinfo(k).mil * 0.15, 0);
  return clamp(m, 5, 140);
}
const hasNukes = (s, k) => k === 'kr' ? s.policies.nuke === 'armed' : cinfo(k).nukes;

/* ---------------- 외교 행동 ---------------- */
const ecoK = k => clamp(cinfo(k).eco / 60, 0.1, 1.4);
const DIPLO_ACTIONS = [
  { id: 'summit', name: '정상회담', icon: '🤝', pc: 12, desc: '관계 +8 (지속 +3). 2분기 쿨타임.',
    can: (s, k) => k === 'nk' && relOf(s, k) < 25 ? '북한이 회담을 거부합니다(관계 25 이상 필요).' : (dip(s, k).cd > s.turn ? '최근에 회담했습니다.' : null),
    cost: (s, k) => isCore(k) ? 12 : 6,
    run: (s, k) => { relBump(s, k, 8, 3); dip(s, k).cd = s.turn + 2; return `${cname(k)}과(와) 정상회담을 가졌습니다.`; } },
  { id: 'aid', name: '경제 원조', icon: '🎁', pc: 8, desc: '관계 +6 (지속 +2). 재정 -0.1~0.2%p.',
    can: (s, k) => cinfo(k).eco >= 85 ? '원조 대상이 아닙니다.' : null,
    run: (s, k) => { relBump(s, k, isCore(k) ? 6 : 10, isCore(k) ? 2 : 4); s.stats.fiscal -= isCore(k) ? 0.2 : 0.1; if (k === 'nk') { s.factions.lib += 3; s.factions.con -= 3; } return `${cname(k)}에 경제 원조를 제공했습니다.`; } },
  { id: 'fta', name: 'FTA 체결', icon: '📦', pc: 30, desc: '성장률 상승(상대 경제 규모 비례), 관계 +5. 농어민 반발. 관계 55 이상.',
    can: (s, k) => dip(s, k).fta ? '이미 FTA가 있습니다.' : k === 'nk' ? '북한과는 불가합니다.' : relOf(s, k) < 55 ? '관계 55 이상 필요.' : (cinfo(k).eu && !dip(s, 'eu').fta ? 'EU 회원국은 EU와 FTA를 맺어야 합니다.' : null),
    cost: (s, k) => dip(s, k).offer >= s.turn ? 10 : isCore(k) ? 30 : Math.round(10 + cinfo(k).eco * 0.2),
    run: (s, k) => { dip(s, k).fta = true; s.mods.gdp += 0.08 * ecoK(k); relBump(s, k, 3, 5); s.factions.farm -= Math.round(6 * ecoK(k)); s.factions.biz += Math.round(5 * ecoK(k)); return `${cname(k)}과(와) FTA를 체결했습니다.`; } },
  { id: 'alliance', name: '안보 동맹', icon: '🛡️', pc: 40, desc: '안보 상승(상대 군사력 비례), 상대 진영 반발. 관계 75 이상.',
    can: (s, k) => dip(s, k).alliance ? '이미 동맹입니다.' : k === 'nk' ? '불가합니다.' : relOf(s, k) < 75 ? '관계 75 이상 필요.' : null,
    cost: (s, k) => isCore(k) ? 40 : Math.round(15 + cinfo(k).mil * 0.3),
    run: (s, k) => {
      dip(s, k).alliance = true; s.mods.security += Math.max(1, Math.round(cinfo(k).mil / 20)); relBump(s, k, 3, 5);
      if (['us', 'jp', 'tw'].includes(k) || NATO.has(k)) s.relMods.cn -= isCore(k) ? 8 : 2;
      if (k === 'cn' || k === 'ru') { s.relMods.us -= 12; s.relMods.jp -= 6; }
      return `${cname(k)}과(와) 안보 동맹을 맺었습니다.`; } },
  { id: 'unally', name: '동맹 파기', icon: '✂️', pc: 10, desc: '안보 하락, 관계 -15.',
    can: (s, k) => dip(s, k).alliance ? null : '동맹이 아닙니다.',
    run: (s, k) => { dip(s, k).alliance = false; s.mods.security -= Math.max(1, Math.round(cinfo(k).mil / 20)); relBump(s, k, -10, -15); return `${cname(k)}과(와)의 동맹을 파기했습니다.`; } },
  { id: 'sanction', name: '경제 제재', icon: '🚫', pc: 12, desc: '관계 -15, 우리 경제도 일부 타격.',
    can: (s, k) => dip(s, k).sanction ? '이미 제재 중입니다.' : null,
    run: (s, k) => { dip(s, k).sanction = true; relBump(s, k, -10, -15); s.mods.gdp -= 0.03 * cinfo(k).eco / 50; return `${cname(k)}에 경제 제재를 가했습니다.`; } },
  { id: 'unsanction', name: '제재 해제', icon: '🔓', pc: 5, desc: '관계 +8.',
    can: (s, k) => dip(s, k).sanction ? null : '제재 중이 아닙니다.',
    run: (s, k) => { dip(s, k).sanction = false; s.mods.gdp += 0.03 * cinfo(k).eco / 50; relBump(s, k, 5, 8); return `${cname(k)}에 대한 제재를 해제했습니다.`; } },
  { id: 'ultimatum', name: '최후통첩', icon: '📜', pc: 20, desc: '양보를 요구. 거부하면 전쟁 명분이 생깁니다. 관계 35 미만.',
    can: (s, k) => cinfo(k).isBloc ? '블록에는 쓸 수 없습니다.' : relOf(s, k) >= 35 ? '관계 35 미만에서만 가능합니다.' : s.war ? '전쟁 중입니다.' : null,
    run: (s, k) => {
      const o = warOdds(s, k), ratio = o.ours / o.theirs;
      if (ratio > 1.3 && Math.random() < 0.4 + (ratio - 1.3)) {
        s.stats.fiscal += 0.6 * ecoK(k); s.mods.fiscal += 0.15 * ecoK(k); relBump(s, k, -8, -6); s.approval = clamp(s.approval + 4, 0, 100);
        return `✅ ${cname(k)}이(가) 최후통첩을 수용하고 양보(배상·경제 이권)했습니다.`;
      }
      dip(s, k).casusBelli = s.turn + 4; relBump(s, k, -10, -8);
      return `❌ ${cname(k)}이(가) 최후통첩을 거부했습니다. 4분기 동안 전쟁 명분이 생겼습니다.`; } },
  { id: 'war', name: '선전포고', icon: '⚔️', pc: 30, desc: '전쟁을 시작합니다. 관계 25 미만 또는 최후통첩 거부 시. 먼 나라일수록 전력 투사가 약해집니다.',
    can: (s, k) => cinfo(k).isBloc ? '블록 전체와는 전쟁할 수 없습니다. 회원국을 고르세요.' : s.war ? '이미 전쟁 중입니다.' : (relOf(s, k) >= 25 && !(dip(s, k).casusBelli >= s.turn)) ? '관계 25 미만이거나 최후통첩 거부 명분이 필요합니다.' : null,
    run: (s, k, goal) => startWar(s, k, 'kr', goal) },
  { id: 'unify', name: '평화통일 협상', icon: '🕊️', pc: 60, desc: '남북 관계 80 이상. 남북 동시 국민투표.',
    can: (s, k) => k !== 'nk' ? '북한만 해당합니다.' : s.annexed.nk ? '이미 통일되었습니다.' : relOf(s, k) < 80 ? '남북 관계 80 이상 필요.' : null,
    run: (s, k) => {
      const sup = s.approval * 0.5 + 25 + (relOf(s, k) - 80) * 0.5 + gauss() * 5;
      if (sup > 50) { annex(s, 'nk', true); return `🕊️ 국민투표 찬성 ${sup.toFixed(1)}%! 평화통일이 이루어졌습니다.`; }
      relBump(s, 'nk', -5, 0); return `국민투표 찬성 ${sup.toFixed(1)}%로 부결되었습니다.`; } },
];

function relBump(s, k, now, lasting) {
  if (s.annexed?.[k]) return;
  s.rel[k] = clamp(relOf(s, k) + now, 0, 100); s.relMods[k] = (s.relMods[k] || 0) + lasting;
}
function diploCost(s, a, k) { return a.cost ? a.cost(s, k) : a.pc; }
function diploAction(s, aid, k, goal) {
  const a = DIPLO_ACTIONS.find(x => x.id === aid);
  if (!cinfo(k)) return { ok: false, msg: '알 수 없는 나라입니다.' };
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
function protectorsOf(k) {
  const out = new Set(CORE_PROTECT[k] || []);
  if (NATO.has(k)) ['us', 'gbr', 'fra', 'deu'].forEach(p => p !== k && out.add(p));
  if (EU_MEMBERS.has(k)) out.add('fra');
  for (const b of Object.values(BLOC_PROTECT)) if (b.members.includes(k)) b.protectors.forEach(p => out.add(p));
  out.delete(k);
  return [...out];
}
function warAllies(s, k, side, aggressor = 'kr') {
  if (side === 'them') return protectorsOf(k).filter(c => cinfo(c) && !s.annexed[c] && !dip(s, c).alliance && relOf(s, c) < (PROTECT_TH[`${k}>${c}`] ?? (c === 'us' ? 90 : 85)));
  const prot = new Set(protectorsOf(k));
  return Object.keys(s.diplo).filter(c => c !== k && cinfo(c) && !cinfo(c).isBloc && dip(s, c).alliance && !s.annexed[c] && !prot.has(c)
    && (aggressor === 'them' || (k === 'nk' && c === 'us' && relOf(s, 'us') >= 70) || relOf(s, c) >= 85));
}
function warOdds(s, k) {
  const w = s.war && s.war.k === k ? s.war : null;
  const allies = w ? w.allies : warAllies(s, k, 'kr'), en = w ? w.enemyAllies : warAllies(s, k, 'them');
  const reach = cinfo(k).reach;
  const ours = milPower(s) * reach + allies.reduce((a, c) => a + cinfo(c).mil * 0.5, 0);
  const theirs = cinfo(k).mil + en.reduce((a, c) => a + cinfo(c).mil * 0.5, 0);
  return { ours, theirs, edge: (ours - theirs) / (ours + theirs), reach, allies, en };
}
function nukeRisk(s) {
  const w = s.war; if (!w) return 0;
  const enemyNuke = hasNukes(s, w.k) || w.enemyAllies.some(c => cinfo(c).nukes);
  if (!enemyNuke || w.score < 40) return 0;
  const deter = hasNukes(s, 'kr') || w.allies.includes('us');
  return clamp((deter ? 0.02 : 0.06) + (w.score - 40) / (deter ? 1500 : 500), 0, 0.3);
}

const GOAL_NAMES = { annex: '합병', unify: '흡수통일', concession: '배상·이권 획득' };
function startWar(s, k, aggressor, goal) {
  const c = cinfo(k);
  goal = goal || (k === 'nk' ? 'unify' : c.annex ? 'annex' : 'concession');
  if (goal !== 'concession' && !c.annex) goal = 'concession';
  const allies = warAllies(s, k, 'kr', aggressor), enemyAllies = warAllies(s, k, 'them');
  s.war = { k, goal, aggressor, score: 0, turns: 0, allies, enemyAllies, log: [] };
  for (const e of enemyAllies) relBump(s, e, -25, -20);
  if (aggressor === 'kr') {
    // 침략 전쟁: 국제 사회 반발 (미국이 함께 싸우는 대북 전쟁은 예외)
    const approved = k === 'nk' && allies.includes('us');
    for (const o of ['us', 'eu', 'jp', 'cn']) if (o !== k && !allies.includes(o) && !enemyAllies.includes(o)) relBump(s, o, approved ? -3 : -15, approved ? -2 : -12);
    // 같은 대륙 나라들도 경계
    for (const o of Object.keys(s.rel)) if (!isCore(o) && o !== k && cinfo(o)?.reg === c.reg && !allies.includes(o)) relBump(s, o, approved ? -1 : -8, approved ? 0 : -5);
    s.factions.lib -= 10; s.factions.youth -= 6; s.factions.mil += 8; s.factions.con += k === 'nk' ? 6 : 0;
    s.approval = clamp(s.approval + (approved ? 3 : -4), 0, 100);
  } else {
    s.approval = clamp(s.approval + 8, 0, 100);
    s.factions.mil += 10; s.factions.con += 5;
  }
  relBump(s, k, -40, -40);
  const msg = `⚔️ ${c.name}과(와) 전쟁 발발! (${aggressor === 'kr' ? '우리가 선전포고' : '상대의 침공'}) 목표: ${GOAL_NAMES[goal]}. 우리 편: ${allies.map(cname).join(', ') || '없음'} / 상대 편: ${enemyAllies.map(cname).join(', ') || '없음'}`;
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
  const name = cname(k);
  if (outcome === 'victory') { if (w.goal === 'concession') endWar2Concession(s, k); else annex(s, k, false); }
  else if (outcome === 'concession') endWar2Concession(s, k);
  else if (outcome === 'white') { addLog(s, 'info', `🏳️ ${name}과(와) 휴전했습니다. 영토 변화는 없습니다.`); relBump(s, k, 10, 15); }
  else if (outcome === 'concede') { s.stats.fiscal -= 1.5; s.mods.fiscal -= 0.3; s.approval = clamp(s.approval - 10, 0, 100); s.stats.security -= 5; addLog(s, 'bad', `📉 ${name}에 배상금을 지불하는 조건으로 강화했습니다.`); relBump(s, k, 10, 15); }
  for (const e of w.enemyAllies) relBump(s, e, 0, 8);
}
function endWar2Concession(s, k) {
  const e = ecoK(k);
  s.stats.fiscal += 1.0 * e; s.mods.fiscal += 0.25 * e; s.mods.gdp += 0.05 * e; s.approval = clamp(s.approval + 6, 0, 100);
  relBump(s, k, 10, 10);
  addLog(s, 'good', `🏆 ${cname(k)}(으)로부터 배상과 경제 이권을 얻어냈습니다.`);
}

// 합병·통일
function annex(s, k, peaceful) {
  s.annexed[k] = true; dip(s, k).sanction = false;
  if (k === 'nk') {
    s.stats.debt += peaceful ? 14 : 22; s.mods.gdp += 0.35; s.mods.tfr += 0.08; s.mods.security += 12; s.mods.gini += 0.015;
    s.stats.happiness -= peaceful ? 1 : 5; s.relMods.cn -= peaceful ? 5 : 18; s.relMods.ru -= peaceful ? 2 : 10;
    s.approval = clamp(s.approval + (peaceful ? 15 : 10), 0, 100); s.scoreBonus = (s.scoreBonus || 0) + (peaceful ? 15 : 10);
    s.rel.nk = 100; s.unifiedTurn = s.turn;
    addLog(s, 'good', peaceful ? '🇰🇷 한반도 평화통일 달성! 통일 비용과 함께 새로운 성장 동력이 생겼습니다.' : '🇰🇷 전쟁 끝에 한반도가 통일되었습니다. 막대한 재건 비용과 주변국 반발이 뒤따릅니다.');
  } else {
    const c = cinfo(k), e = ecoK(k);
    s.stats.debt += 4 + 10 * e; s.mods.gdp += 0.45 * e; s.mods.innovation += Math.round(5 * e); s.stats.happiness -= 3;
    for (const o of ['us', 'cn', 'eu', 'jp', 'ru']) if (o !== k && !s.annexed[o]) relBump(s, o, -10 - 5 * e, k === 'tw' && o === 'cn' ? -25 : -10 - 5 * e);
    for (const o of Object.keys(s.rel)) if (!isCore(o) && cinfo(o)?.reg === c.reg && o !== k) relBump(s, o, -10, -8);
    s.approval = clamp(s.approval + 5, 0, 100); s.scoreBonus = (s.scoreBonus || 0) + Math.min(6, 2 + Math.round(4 * e));
    s.occupied = s.occupied || {}; s.occupied[k] = s.turn;
    s.rel[k] = 50;
    addLog(s, 'good', `🚩 ${c.name}을(를) 합병했습니다. 점령지 저항과 국제 사회의 강한 반발이 예상됩니다.`);
  }
}

/* ---------------- 전선: 전황 점수 → 점령된 시·도 ---------------- */
const CAPITAL = { nk: '평양', jp: '도쿄', tw: '타이베이', cn: '베이징', ru: '모스크바', us: '워싱턴', kr: '서울' };
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
function warOccupation(s) {
  const out = { byUs: new Set(), byEnemy: new Set(), seoulLost: false, wholeCountry: false };
  const w = s.war; if (!w || typeof MAP_DATA === 'undefined') return out;
  const seoul = MAP_DATA.cities['서울'];
  if (w.score > 0) {
    if (MAP_DATA.prov[w.k]) {
      const list = [...MAP_DATA.prov[w.k]].sort((a, b) => dist2(a.c, seoul) - dist2(b.c, seoul));
      list.slice(0, Math.round(w.score / 100 * list.length)).forEach(p => out.byUs.add(p.id));
    } else out.wholeCountry = w.score >= 50;  // 시·도 데이터가 없는 나라는 절반 넘게 밀면 전역 표시
  }
  if (w.score < 0) {
    // 적은 자기 쪽에서 가까운 우리 시·도부터 점령 (먼 나라는 바다를 건너 남해안부터)
    const cap = MAP_DATA.cities[CAPITAL[w.k]] || MAP_DATA.countries[w.k]?.c || seoul;
    const list = [...MAP_DATA.prov.kr].sort((a, b) => dist2(a.c, cap) - dist2(b.c, cap));
    const n = Math.round(-w.score / 100 * list.length);
    list.slice(0, n).forEach(p => out.byEnemy.add(p.id));
    out.seoulLost = list.slice(0, n).some(p => p.n === '서울특별시');
  }
  return out;
}

/* ---------------- 분기 처리 ---------------- */
function worldTurn(s, report) {
  report.world = { events: [] };
  // 비핵심국 관계 변화 (EU 회원국은 EU 관계를 따라감)
  for (const k of Object.keys(s.rel)) {
    if (isCore(k) || s.annexed[k] || !cinfo(k)) continue;
    const eq = baseRel(k) + (s.relMods[k] || 0) + (cinfo(k).eu ? (s.rel.eu - RELATIONS.eu.base) * 0.6 : 0) + (NATO.has(k) ? (s.rel.us - RELATIONS.us.base) * 0.2 : 0);
    s.rel[k] = clamp(s.rel[k] + (eq - s.rel[k]) * 0.2 + gauss() * 0.6, 0, 100);
  }
  // 북한의 기습 침공(관계 최악·우리 군사력 약할 때)
  if (!s.war && !s.annexed.nk && s.rel.nk < 8 && milPower(s) < 58 && Math.random() < 0.04) report.world.events.push(startWar(s, 'nk', 'them', 'concession'));
  // 우호국의 FTA 제안 (핵심국 + 무작위 몇 나라)
  const cands = [...Object.keys(RELATIONS), ...Object.keys(s.rel).filter(k => !isCore(k)).sort(() => Math.random() - 0.5).slice(0, 12)];
  for (const k of cands) {
    if (s.annexed[k] || k === 'nk' || !cinfo(k)) continue;
    const d = dip(s, k); if (d.fta || (cinfo(k).eu && !dip(s, 'eu').fta)) continue;
    if (relOf(s, k) >= 68 && Math.random() < 0.06) { d.offer = s.turn + 2; const t = `📨 ${cname(k)}이(가) FTA 체결을 제안했습니다. (2분기 동안 비용 ⚡10)`; addLog(s, 'info', t); report.world.events.push(t); }
  }
  for (const k of Object.keys(s.diplo)) if (s.diplo[k].sanction && !s.annexed[k]) s.rel[k] = clamp(relOf(s, k) - 2, 0, 100);
  for (const k in (s.occupied || {})) { s.stats.safety -= 0.5 + 0.5 * ecoK(k); s.stats.fiscal -= 0.1; }

  const w = s.war; if (!w) return;
  w.turns++;
  const o = warOdds(s, w.k);
  const delta = o.edge * 52 + gauss() * 10 + (w.push || 0);
  w.push = 0;
  w.score = clamp(w.score + delta, -100, 100);
  s.stats.gdp -= 0.5; s.stats.happiness -= 1.5; s.stats.debt += 1.5; s.stats.fiscal -= 0.3; s.stats.safety -= 1;
  if (w.turns > 1) s.approval = clamp(s.approval - 1.5, 0, 100);
  for (const a of w.allies) relBump(s, a, 1, 0);
  const occ = warOccupation(s);
  s.stats.gdp -= 0.12 * occ.byEnemy.size; s.stats.happiness -= 0.4 * occ.byEnemy.size;
  if (occ.seoulLost) { s.stats.gdp -= 1; s.approval = clamp(s.approval - 4, 0, 100); }
  const occTxt = occ.byUs.size ? ` · 아군이 ${cname(w.k)} ${occ.byUs.size}개 지역 장악` : occ.wholeCountry ? ` · 아군이 ${cname(w.k)} 주요 지역 장악` : occ.byEnemy.size ? ` · 적이 우리 시·도 ${occ.byEnemy.size}곳 점령${occ.seoulLost ? '(서울 함락!)' : ''}` : '';
  const line = `${turnLabel(s.turn).year}.${turnLabel(s.turn).q}Q 전황 ${delta >= 0 ? '진격' : '후퇴'} (${delta >= 0 ? '+' : ''}${delta.toFixed(0)}) → 전황 점수 ${w.score.toFixed(0)}${occTxt}`;
  w.log.push(line); report.world.war = line;
  if (Math.random() < nukeRisk(s)) {
    s.forceEnding = { type: 'nuke', title: '핵 공격', desc: `패색이 짙어진 ${cname(w.k)} 진영이 핵무기를 사용했습니다. 한반도는 회복하기 어려운 피해를 입었습니다.` };
    return;
  }
  if (w.score >= 100) { report.world.events.push(`🏆 ${cname(w.k)}과(와)의 전쟁에서 승리했습니다!`); endWar(s, 'victory'); }
  else if (w.score <= -100) { s.forceEnding = { type: 'defeat', title: '패전', desc: `${cname(w.k)} 진영과의 전쟁에서 패배했습니다. 정부는 항복 문서에 서명했습니다.` }; }
  else if (w.turns >= 10) { report.world.events.push('장기전 끝에 국제 사회 중재로 정전협정이 맺어졌습니다.'); endWar(s, 'white'); }
}

function worldEvents(s, report, newCrises) {
  for (let i = newCrises.length - 1; i >= 0; i--) {
    const c = newCrises[i];
    if ((s.annexed.nk && (c.relTarget === 'nk' || /북한|NLL/.test(c.title))) || (c.relTarget && s.annexed[c.relTarget])) newCrises.splice(i, 1);
  }
  for (const k in (s.occupied || {})) if (Math.random() < 0.2) newCrises.push(makeCrisis(s, { tpl: 'security', title: `${cname(k)} 점령지 저항 운동`, desc: `합병된 ${cname(k)} 지역에서 무장 저항과 대규모 시위가 이어지고 있습니다.`, sev: 2 }));
}

HOOKS.migrate.push(s => {
  if (s.rel.tw == null) { s.rel.tw = RELATIONS.tw.base; s.relMods.tw = 0; }
  if (!s.diplo) s.diplo = {};
  for (const k of Object.keys(CORE_INFO)) dip(s, k);
  if (!s.annexed) s.annexed = {};
  if (s.war === undefined) s.war = null;
  if (s.war && !s.war.enemyAllies) s.war.enemyAllies = [];
  // 전 세계 나라 관계 초기화
  for (const k of allCountryKeys()) {
    if (s.rel[k] == null) s.rel[k] = baseRel(k);
    if (s.relMods[k] == null) s.relMods[k] = 0;
  }
});
HOOKS.postMacro.push(worldTurn);
HOOKS.events.push(worldEvents);
