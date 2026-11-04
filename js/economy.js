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
  if (s.pcap < INVEST_COST) return { ok: false, msg: `정치자본 ⚡${INVEST_COST}이 필요합니다.` };
  s.pcap -= INVEST_COST;
  s.sectorInvest.push({ id, left: 8 });
  s.stats.fiscal = clamp(s.stats.fiscal - 0.25, STATS.fiscal.min, STATS.fiscal.max);
  s.mods.fiscal -= 0.1;
  s.factions.biz = clamp(s.factions.biz + 3, 0, 100);
  const x = SECTORS.find(z => z.id === id);
  addLog(s, 'info', `🏭 ${x.name} 산업 집중 육성 착수 (8분기, 성장률 +2.5%p, 재정 부담).`);
  return { ok: true };
}

HOOKS.migrate.push(s => {
  if (!s.sectors) { s.sectors = {}; for (const x of SECTORS) s.sectors[x.id] = { idx: 100, g: x.base, hist: [100] }; }
  if (!s.sectorInvest) s.sectorInvest = [];
});
HOOKS.preMacro.push(economyTurn);
HOOKS.events.push(sectorEventShocks);
