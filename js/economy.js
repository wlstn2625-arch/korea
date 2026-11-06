/* =========================================================
 *  산업·경제 시뮬레이션
 *  - 12개 산업이 각자 성장률을 가지며, 가중 합이 GDP 성장률에 반영
 *  - 지표·외교관계·제도 변화가 산업별로 다르게 작용
 * ========================================================= */

// share: GDP 비중(%), emp: 고용 비중(%), base: 기본 연 성장률(%), exp: 수출 비중(%)
// drv: 지표/관계 민감도(기준값 대비 1단위당 성장률 %p), pol: 제도별 성장률 보정
const SECTORS = [
  { id: 'semi', name: '반도체', icon: '💾', share: 10, emp: 2, base: 4.0, exp: 22,
    drv: { innovation: 0.10, 'rel.us': 0.03, 'rel.cn': 0.03, 'rel.jp': 0.01 },
    pol: { chip: { mega: 3, cut: -3 }, work_hours: { d4: -1, flex: 0.5 }, nuclear: { phaseout: -0.8, expand: 0.5 } } },
  { id: 'auto', name: '자동차·배터리', icon: '🚗', share: 7, emp: 4, base: 2.0, exp: 14,
    drv: { 'rel.us': 0.04, 'rel.eu': 0.02, innovation: 0.03 },
    pol: { trade: { protect: -1.5, cptpp: 0.8 }, carbon: { strong: -0.8 }, labor_union: { repeal: 0.4 } } },
  { id: 'ship', name: '조선·방산', icon: '🚢', share: 4, emp: 2, base: 3.0, exp: 9,
    drv: { 'rel.us': 0.05, security: 0.03, 'rel.eu': 0.02 },
    pol: { immig: { agency: 1.5, restrict: -2.5 }, def_budget: { up35: 2, up5: 3.5, down2: -1.5 }, oda: { ukr: 1.5 } } },
  { id: 'heavy', name: '석유화학·철강', icon: '🏗️', share: 7, emp: 3, base: 0.5, exp: 12,
    drv: { 'rel.cn': 0.03, env: -0.02 },
    pol: { carbon: { strong: -2.5, weak: 1 }, carbon_tax: { tax: -1.5 }, nuclear: { phaseout: -0.8 } } },
  { id: 'build', name: '건설·부동산', icon: '🏢', share: 8, emp: 8, base: 0.0,  exp: 1,
    drv: { housing: -0.03 },
    pol: { supply: { public: 2, dereg: 2.5, greenbelt: 2 }, loan: { loosen: 1.5, tighten: -1 }, property_tax: { raise: -1, abolish: 0.8 }, capital: { sejong: 1.5 } } },
  { id: 'fin', name: '금융', icon: '🏦', share: 7, emp: 3, base: 2.0, exp: 2,
    drv: { debt: -0.03, justice: 0.02 },
    pol: { bok: { control: -2.5, dual: -0.3 }, fin_tax: { introduce: -1 }, chaebol: { tighten: 0.5 } } },
  { id: 'it', name: 'IT·플랫폼·AI', icon: '💻', share: 8, emp: 4, base: 4.0, exp: 5,
    drv: { innovation: 0.08, freedom: 0.03, education: 0.03 },
    pol: { ai_edu: { full: 1 }, telemed: { full: 1 }, press: { punitive: -0.8 } } },
  { id: 'culture', name: '콘텐츠·관광', icon: '🎬', share: 3, emp: 3, base: 3.0, exp: 3,
    drv: { 'rel.cn': 0.05, 'rel.jp': 0.03, freedom: 0.03, safety: 0.02 },
    pol: {} },
  { id: 'energy', name: '에너지·전력', icon: '⚡', share: 3, emp: 1, base: 1.0, exp: 1,
    drv: { env: 0.01 },
    pol: { nuclear: { expand: 2, phaseout: -1.5 }, renew: { offshore: 2 }, privatize: { private: 1 } } },
  { id: 'agri', name: '농어업', icon: '🌾', share: 2, emp: 6, base: -0.5, exp: 1,
    drv: { 'rel.cn': 0.01 },
    pol: { trade: { cptpp: -3, protect: 1 }, immig: { restrict: -2, agency: 1 } } },
  { id: 'service', name: '서비스·자영업', icon: '🛍️', share: 25, emp: 40, base: 1.2, exp: 2,
    drv: { happiness: 0.05, infl: -0.3, housing: 0.01 },
    pol: { min_wage: { w12k: -0.8, freeze: 0.3, diff: 0.5 }, smb: { support: 1, restructure: -0.5 }, work_hours: { d45: 0.4, d4: 0.6 } } },
  { id: 'public', name: '공공·보건·교육', icon: '🏥', share: 16, emp: 24, base: 2.0, exp: 0,
    drv: { welfare: 0.03, health: 0.03, education: 0.02 },
    pol: { health_ins: { expand: 0.8, private: -0.5 }, free_edu: { univ: 0.4, all_univ: 0.8 } } },
];
const SECTOR_BASE_AVG = SECTORS.reduce((a, x) => a + x.share * x.base, 0) / SECTORS.reduce((a, x) => a + x.share, 0);
const DRIVER_BASE = k => k.startsWith('rel.') ? RELATIONS[k.slice(4)].base : STATS[k].base;
const driverVal = (s, k) => k.startsWith('rel.') ? s.rel[k.slice(4)] : s.stats[k];

function sectorGrowth(s, x) {
  let g = x.base;
  for (const k in x.drv) g += x.drv[k] * (driverVal(s, k) - DRIVER_BASE(k));
  for (const pid in x.pol) { const v = x.pol[pid][s.policies[pid]]; if (v) g += v; }
  const inv = (s.sectorInvest || []).find(i => i.id === x.id); if (inv) g += 2.5;
  g += (s.buildings?.[x.id] || 0) * 0.6; // 지어 둔 공장
  const sh = (s.sectorShock || {})[x.id]; if (sh) g += sh;
  if (s.war) g -= x.id === 'ship' ? -2 : 3;     // 전쟁: 방산 특수, 나머지 타격
  if (s.annexed?.nk && (x.id === 'build' || x.id === 'agri')) g += 1.5; // 통일 재건 수요
  return clamp(g, -15, 20);
}

function economyTurn(s) {
  if (!s.sectors) return;
  let wsum = 0, esum = 0, tot = 0;
  for (const x of SECTORS) {
    const g = sectorGrowth(s, x) + gauss() * 0.6;
    const sec = s.sectors[x.id];
    sec.g = g; sec.idx *= 1 + g / 400; sec.hist.push(+sec.idx.toFixed(2)); if (sec.hist.length > 24) sec.hist.shift();
    wsum += x.share * (g - x.base); esum += x.emp * (g - x.base); tot += x.share;
  }
  // 산업 성장의 기준 대비 차이가 GDP·실업 균형에 반영
  s.econDelta = clamp(wsum / tot * 0.45, -3, 3);
  s.econUnemp = clamp(-esum / 100 * 0.05, -1, 1);
  // 육성 투자 기간 차감
  s.sectorInvest = (s.sectorInvest || []).filter(i => --i.left > 0);
  for (const k in (s.sectorShock || {})) { s.sectorShock[k] *= 0.6; if (Math.abs(s.sectorShock[k]) < 0.2) delete s.sectorShock[k]; }
}

// 이벤트가 특정 산업을 흔듦
const EVENT_SECTOR = { chip_boom: { semi: 6, it: 2 }, us_tariff: { auto: -4, semi: -2 }, cn_sanction: { culture: -6, heavy: -2 }, recession: { semi: -4, auto: -3, heavy: -3, fin: -2 },
  exchange: { fin: -3 }, pf_crisis: { build: -5, fin: -3 }, oil: { heavy: -3, service: -1 }, kpop: { culture: 6 }, pandemic: { service: -4, culture: -6 }, typhoon: { agri: -4, build: 1 } };
function sectorEventShocks(s, report, newCrises) {
  s.sectorShock = s.sectorShock || {};
  for (const c of newCrises) {
    const ev = WORLD_EVENTS.find(e => e.title === c.title); const m = ev && EVENT_SECTOR[ev.id];
    if (m) for (const k in m) s.sectorShock[k] = (s.sectorShock[k] || 0) + m[k];
  }
}

const INVEST_COST = 25;
function investSector(s, id) {
  s.sectorInvest = s.sectorInvest || [];
  if (s.sectorInvest.some(i => i.id === id)) return { ok: false, msg: '이미 집중 육성 중인 산업입니다.' };
  if (s.sectorInvest.length >= 3) return { ok: false, msg: '집중 육성은 동시에 3개 산업까지입니다.' };
  if (s.pcap < INVEST_COST) return { ok: false, msg: `국고 ${won(INVEST_COST)}이 필요합니다.` };
  s.pcap -= INVEST_COST;
  s.sectorInvest.push({ id, left: 8 });
  s.stats.fiscal = clamp(s.stats.fiscal - 0.25, STATS.fiscal.min, STATS.fiscal.max);
  s.mods.fiscal -= 0.1;
  s.factions.biz = clamp(s.factions.biz + 3, 0, 100);
  const x = SECTORS.find(z => z.id === id);
  addLog(s, 'info', `🏭 ${x.name} 산업 집중 육성 착수 (8분기, 성장률 +2.5%p, 재정 부담).`);
  return { ok: true };
}

/* ---------------- 국고: 수입 내역 ---------------- */
// 내부 단위 10 = 1조 원. 정상 난이도 출발 시 분기 순수입 약 ₩3조
const TAX_CATS = new Set(['tax']);
function taxLevel(s) {
  let sum = 0;
  for (const p of POLICIES) if (TAX_CATS.has(p.cat)) { const o = currentOption(p, s); if (o?.e?.fiscal) sum += o.e.fiscal; }
  return clamp(1 + sum * 0.25, 0.4, 1.8);
}
function budgetIncome(s) {
  const mul = (DIFFICULTY[s.difficulty] || DIFFICULTY.normal).incomeMul || 1;
  const tax = 16 * taxLevel(s) * (1 + (s.stats.gdp - 1.8) * 0.06) * mul;
  let trade = 0;
  for (const k in (s.diplo || {})) { const d = s.diplo[k]; if (!d.fta || s.annexed?.[k] || s.world?.owner?.[k]) continue; const c = typeof cinfo === 'function' ? cinfo(k) : null; if (c && !c.eu) trade += Math.pow(c.eco, 0.8) * 0.045; }
  trade *= mul * (1 - (s.world?.conflicts || []).filter(c => c.type === 'trade' && [c.a, c.b].some(x => ['us', 'cn'].includes(x))).length * 0.1);
  let industry = 0;
  for (const x of SECTORS) industry += x.share * ((s.sectors?.[x.id]?.idx || 100) / 100) * 0.05;
  industry = (industry + Object.values(s.buildings || {}).reduce((a, b) => a + b, 0) * 1.2) * mul;
  const annexed = typeof terrIncome === 'function' ? terrIncome(s) : Object.keys(s.annexed || {}).reduce((a, k) => a + (typeof cinfo === 'function' ? cinfo(k).eco * 0.06 : 0), 0) * mul;
  const defense = typeof techBonus === 'function' ? techBonus(s).income * mul : 0;
  const interest = -Math.max(0, s.stats.debt - 40) * 0.09;
  const admin = (s.approval - 45) * 0.12 + (s.pcapBonus || 0) * 0.5;
  const war = s.war ? -10 : 0;
  const imf = s.imfTurn != null && s.turn - s.imfTurn < 8 ? -6 : 0;
  const total = tax + trade + industry + annexed + defense + interest + admin + war + imf;
  return { tax, trade, industry, annexed, defense, interest, admin, war, imf, total };
}

/* ---------------- 공장 건설·특별세·국채 ---------------- */
const BUILD_COST = 40, BUILD_TIME = 2, BUILD_MAX = 5;
function buildCost(s, id) { return Math.round(BUILD_COST * (1 + (s.buildings?.[id] || 0) * 0.35)); }
function buildFactory(s, id) {
  const x = SECTORS.find(z => z.id === id), lv = (s.buildings[id] || 0) + s.construction.filter(c => c.id === id).length;
  if (lv >= BUILD_MAX) return { ok: false, msg: `${x.name} 시설은 최대 ${BUILD_MAX}단계입니다.` };
  if (s.construction.length >= 3) return { ok: false, msg: '동시에 공사할 수 있는 곳은 3곳까지입니다.' };
  const cost = buildCost(s, id);
  if (s.pcap < cost) return { ok: false, msg: `국고 ${won(cost)}이(가) 필요합니다. 국채를 발행하거나 특별세를 걷으세요.` };
  s.pcap -= cost;
  s.construction.push({ id, left: BUILD_TIME });
  s.factions.local = clamp(s.factions.local + 2, 0, 100); s.factions.labor = clamp(s.factions.labor + 1, 0, 100);
  addLog(s, 'info', `🏗️ ${x.name} 시설 ${lv + 1}단계 착공 (${won(cost)}, ${BUILD_TIME}분기 후 완공)`);
  return { ok: true, msg: `${x.icon} ${x.name} 시설 착공! ${BUILD_TIME}분기 후 완공됩니다.` };
}
function constructionTurn(s, report) {
  report.built = [];
  for (const c of [...s.construction]) {
    if (--c.left > 0) continue;
    s.construction = s.construction.filter(x => x !== c);
    s.buildings[c.id] = (s.buildings[c.id] || 0) + 1;
    const x = SECTORS.find(z => z.id === c.id);
    s.mods.unemp -= 0.04 * x.emp / 5; s.mods.innovation += ['semi', 'it', 'auto'].includes(x.id) ? 0.6 : 0.2;
    if (['heavy', 'energy', 'build'].includes(x.id)) s.mods.env -= 0.4;
    report.built.push(`${x.icon} ${x.name} ${s.buildings[c.id]}단계`);
    addLog(s, 'good', `🏭 ${x.name} 시설 ${s.buildings[c.id]}단계 완공! 산업 성장과 국고 수입이 늘어납니다.`);
  }
}
const FINANCE_ACTIONS = [
  { id: 'levy', name: '특별세 징수', icon: '🧾', cd: 2, desc: '국고 +₩3조. 지지율 -2.5, 재계·노동계 반발.',
    run: s => { s.pcap += 30; s.approval = clamp(s.approval - 2.5, 0, 100); s.factions.biz = clamp(s.factions.biz - 4, 0, 100); s.factions.labor = clamp(s.factions.labor - 2, 0, 100); return '한시적 특별세를 걷어 국고 ₩3조를 확보했습니다.'; } },
  { id: 'bond', name: '국채 발행', icon: '📜', cd: 0, desc: '국고 +₩5조. 국가채무비율 +0.5%p, 이자 부담 증가.',
    run: s => { s.pcap += 50; s.stats.debt += 0.5; s.mods.debt += 0.3; return '국채를 발행해 국고 ₩5조를 마련했습니다.'; } },
  { id: 'repay', name: '국채 상환', icon: '🏦', cd: 0, cost: 50, desc: '국고 ₩5조로 나랏빚을 갚습니다. 국가채무비율 -1%p, 이자 부담 감소. 아래 "나랏빚 갚기"에서 한꺼번에 갚을 수 있습니다.',
    run: s => repayDebt(s, 1).msg },
  { id: 'sell', name: '국유재산 매각', icon: '🏢', cd: 4, desc: '국고 +₩4조. 공공 자산 감소, 진보층 반발.',
    run: s => { s.pcap += 40; s.factions.lib = clamp(s.factions.lib - 3, 0, 100); s.stats.welfare -= 0.5; return '유휴 국유지와 공기업 지분 일부를 매각했습니다.'; } },
];
// 나랏빚 상환: ₩5조당 국가채무비율 1%p. 갚은 만큼 이자 부담(채무 자연 증가)도 줄어듦
const REPAY_UNIT = 50;
function repayDebt(s, pts) {
  pts = Math.min(pts, Math.floor(s.stats.debt), Math.floor(s.pcap / REPAY_UNIT));
  if (pts <= 0) return { ok: false, msg: s.stats.debt < 1 ? '갚을 나랏빚이 없습니다.' : `국고 ${won(REPAY_UNIT)} 이상이 필요합니다.` };
  s.pcap -= pts * REPAY_UNIT; s.stats.debt = Math.max(0, s.stats.debt - pts);
  s.mods.debt = Math.max(-4, s.mods.debt - 0.05 * pts);
  s.repaidTotal = (s.repaidTotal || 0) + pts;
  addLog(s, 'good', `🏦 국고 ${won(pts * REPAY_UNIT)}로 국채를 상환했습니다. 국가채무비율 -${pts}%p`);
  return { ok: true, msg: `🏦 국채 ${won(pts * REPAY_UNIT)} 상환 — 국가채무비율 ${s.stats.debt.toFixed(1)}% (-${pts}%p)` };
}
// 자동 상환: 분기 결산 때 국고가 기준을 넘는 만큼 갚음
const AUTO_REPAY = [{ v: 0, name: '끔' }, { v: 300, name: '₩30조 초과분' }, { v: 150, name: '₩15조 초과분' }, { v: 50, name: '₩5조 초과분' }];
function autoRepayTurn(s, report) {
  if (!s.autoRepay || s.war) return;
  const pts = Math.floor((s.pcap - s.autoRepay) / REPAY_UNIT);
  if (pts > 0) { const r = repayDebt(s, pts); if (r.ok) report.autoRepaid = pts; }
}
HOOKS.postTurn.push(autoRepayTurn);
// 아무것도 안 할 때 다음 분기 채무비율 변화 (재정 적자 - 경제 성장 효과 + 이자)
function debtDrift(s) { const st = s.stats; return (-st.fiscal - (st.gdp + st.infl) * st.debt / 100) / 4 + s.mods.debt / 8; }
function financeAction(s, id) {
  const a = FINANCE_ACTIONS.find(x => x.id === id); s.finCd = s.finCd || {};
  if ((s.finCd[id] || 0) > s.turn) return { ok: false, msg: `${s.finCd[id] - s.turn}분기 후에 다시 할 수 있습니다.` };
  if (id === 'bond' && s.stats.debt > 120) return { ok: false, msg: '국가채무가 너무 커서 국채를 더 찍을 수 없습니다.' };
  if (a.cost && s.pcap < a.cost) return { ok: false, msg: `국고 ${won(a.cost)}이(가) 필요합니다.` };
  s.finCd[id] = s.turn + a.cd;
  const msg = a.run(s); addLog(s, 'info', `${a.icon} ${msg}`);
  return { ok: true, msg };
}

HOOKS.migrate.push(s => {
  if (!s.buildings) s.buildings = {};
  if (!s.construction) s.construction = [];
});
HOOKS.preMacro.push(constructionTurn);
HOOKS.migrate.push(s => {
  if (!s.sectors) { s.sectors = {}; for (const x of SECTORS) s.sectors[x.id] = { idx: 100, g: x.base, hist: [100] }; }
  if (!s.sectorInvest) s.sectorInvest = [];
});
HOOKS.preMacro.push(economyTurn);
HOOKS.events.push(sectorEventShocks);
