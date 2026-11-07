/* =========================================================
 *  군사·전역(戰域) 시뮬레이션 — 하츠 오브 아이언식
 *  - 양측 군대: 사단·질·장비·조직력·병력 예비·공군·해군 (동맹군·적 동맹군 합류)
 *  - 시·도 단위 전역: 남북한·일본·대만은 실제 시·도, 그 밖의 나라는 가상 작전 지역
 *  - 하루 단위 전투: 접경마다 전투 진행도, 지형·요새·제공권 반영, 점령 시 소유 변경
 *  - 태세(방어/공세/총공세), 특수 작전(전략 폭격·미사일·상륙·봉쇄·총동원)
 *  - 승점(수도 등) 상실 비율 = 항복 진행도, 75%면 항복
 * ========================================================= */

const QUALITY = { kr: 1.0, us: 1.25, jp: 0.95, cn: 0.85, ru: 0.8, nk: 0.45, tw: 0.8, gbr: 1.1, fra: 1.05, deu: 0.95, isr: 1.1, ind: 0.7, tur: 0.8, vnm: 0.65, pak: 0.6, irn: 0.55 };
const AIR = { kr: 60, us: 160, jp: 70, cn: 95, ru: 80, nk: 18, tw: 45, gbr: 55, fra: 55, isr: 60, ind: 55 };
const NAVY = { kr: 55, us: 170, jp: 80, cn: 90, ru: 50, nk: 14, tw: 35, gbr: 60, fra: 50, ind: 45 };
const MOUNTAIN = new Set(['강원도', '경상북도', '충청북도', '함경남도', '함경북도', '량강도', '자강도', '평안북도']);
const PROV_VP = { '서울특별시': 10, '부산광역시': 4, '인천광역시': 3, '대구광역시': 3, '대전광역시': 2, '광주광역시': 2, '울산광역시': 2, '세종특별자치시': 2, '평양직할시': 10, '라선특별시': 2, '도쿄도': 10, '오사카부': 4, '아이치현': 2, '가나가와현': 2, '후쿠오카현': 2, '타이베이시': 10, '신베이시': 3, '가오슝시': 3, '타이중 시티': 3 };
const STANCES = { hold: { name: '방어', atk: 0, org: 2 }, attack: { name: '공세', atk: 1, org: -1.2 }, all: { name: '총공세', atk: 1.35, org: -2.4 } };

/* ---------------- 군대 ---------------- */
function ourForces(s) {
  const p = s.policies;
  let divs = 30 + (s.stats.security - 68) * 0.25 + ({ up35: 4, up5: 9, down2: -4 }[p.def_budget] || 0) + ({ both: 8, m24: 4, volunteer: -6 }[p.conscript] || 0);
  const ship = (s.buildings?.ship || 0);
  const air = AIR.kr + ({ up35: 10, up5: 25, down2: -8 }[p.def_budget] || 0) + (s.stats.innovation - 72) * 0.4;
  const navy = NAVY.kr + ({ up35: 8, up5: 20, down2: -6 }[p.def_budget] || 0) + ship * 5;
  const tb = typeof techBonus === 'function' ? techBonus(s) : { divs: 0, quality: 0, air: 0, navy: 0 };
  const tr = typeof terrForces === 'function' ? terrForces(s) : { divs: s.annexed?.nk ? 10 : 0, air: 0, navy: 0 };
  divs += tb.divs + tr.divs;
  return { divs: Math.max(8, divs), quality: QUALITY.kr + (s.stats.innovation - 72) * 0.004 + tb.quality, air: air + tb.air + tr.air, navy: navy + tb.navy + tr.navy };
}
function foreignForces(k) {
  const c = cinfo(k);
  const boost = typeof geoBoost === 'function' ? geoBoost(k) : 0;
  return { divs: (c.mil + boost) * (k === 'nk' ? 1.3 : 0.9), quality: QUALITY[k] ?? clamp(0.35 + c.eco / 160, 0.4, 0.95), air: AIR[k] ?? c.mil * 0.6, navy: NAVY[k] ?? c.mil * 0.45 };
}
// 동맹군은 본국 전력 일부만 투입(원정)
const expedition = (k, f) => ({ divs: f.divs * (k === 'us' ? 0.16 : 0.18), quality: f.quality, air: f.air * (k === 'us' ? 0.55 : 0.3), navy: f.navy * (k === 'us' ? 0.5 : 0.3) });
function sideForces(s, side) {
  const w = s.war, T = w.theater;
  const base = side === 'kr' ? ourForces(s) : foreignForces(w.k);
  const helpers = (side === 'kr' ? w.allies : w.enemyAllies).filter(a => cinfo(a));
  const tb = typeof techBonus === 'function' ? techBonus(s) : { mobilize: 0, enemyAir: 1 };
  let divs = base.divs * (side === 'kr' && T.mobilized ? 1.25 + tb.mobilize : 1), q = base.quality * divs, air = base.air * (side === 'kr' ? 1 : tb.enemyAir), navy = base.navy;
  for (const a of helpers) { const f = expedition(a, foreignForces(a)); divs += f.divs; q += f.quality * f.divs; air += f.air; navy += f.navy; }
  const st = T[side];
  return { divs: divs * (st.mp / 100), rawDivs: divs, quality: q / Math.max(1, divs), air: air * (st.airLeft / 100), navy: navy * (st.navyLeft / 100), equip: st.equip, org: st.org, helpers };
}

/* ---------------- 전역 만들기 ---------------- */
function provAdj(list) {
  const d = (a, b) => Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]), links = new Set();
  for (const a of list) {
    const near = list.filter(b => b !== a).sort((x, y) => d(a, x) - d(a, y)); const n0 = d(a, near[0]);
    for (const b of near.slice(0, 5)) if (d(a, b) <= Math.max(n0 * 1.9, 2.2)) links.add([a.id, b.id].sort().join('|'));
  }
  return [...links].map(l => l.split('|'));
}
function initTheater(s) {
  const w = s.war, k = w.k;
  const provs = [];
  const add = (key, owner) => (MAP_DATA.prov[key] || []).forEach(p => provs.push({ id: p.id, n: p.n, c: p.c, home: key, owner, vp: PROV_VP[p.n] || 1, terrain: MOUNTAIN.has(p.n) ? 1.3 : 1 }));
  add('kr', 'kr');
  let landLinked = false;
  if (MAP_DATA.prov[k]) { add(k, k); landLinked = k === 'nk'; }
  else {
    // 시·도 데이터가 없는 나라: 수도를 포함한 가상 작전 지역 6곳 (일렬로 연결)
    // 한국 쪽 해안에서 수도(중심) 방향으로 늘어놓음
    const mc = MAP_DATA.countries[k] || {}, c = mc.c || [0, 0], kc = MAP_DATA.countries.kr.c;
    const R = clamp(Math.sqrt(mc.a || 20) * 0.9, 3, 40);
    const dx = kc[0] - c[0], dy = kc[1] - c[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const names = ['해안 거점', '항만 도시', '산업 지대', '내륙 요충지', '방어선', '수도권'];
    names.forEach((n, i) => { const t = R * (1 - i / 5), side = (i % 2 ? 1 : -1) * R * 0.12;
      provs.push({ id: `${k}-v${i}`, n: `${cname(k)} ${n}`, c: [c[0] + ux * t - uy * side, c[1] + uy * t + ux * side], home: k, owner: k, vp: i === 5 ? 10 : 1 + (i === 2 ? 2 : 0), terrain: i === 4 ? 1.3 : 1, virtual: true }); });
  }
  let links;
  if (k === 'nk') links = provAdj(provs);
  else {
    links = provAdj(provs.filter(p => p.home === 'kr'));
    if (MAP_DATA.prov[k]) links = links.concat(provAdj(provs.filter(p => p.home === k)));
    else for (let i = 0; i < 5; i++) links.push([`${k}-v${i}`, `${k}-v${i + 1}`]);
  }
  // DMZ 요새: 남북 접경 시·도는 수비가 유리
  const byId = Object.fromEntries(provs.map(p => [p.id, p]));
  for (const [a, b] of links) if (byId[a].home !== byId[b].home) { byId[a].fort = 1.4; byId[b].fort = 1.4; }
  const side = () => ({ org: 85, equip: 1, mp: 100, airLeft: 100, navyLeft: 100, cas: 0, stance: 'hold' });
  w.theater = { provs, links, edges: {}, kr: side(), en: side(), landLinked, days: 0, daysThisQ: 0, ops: {}, log: [], blockade: 0, mobilized: false, exhaustion: 0, enemyStanceDays: 0 };
  w.theater.kr.stance = w.aggressor === 'kr' ? 'attack' : 'hold';
  if (typeof initArmies === 'function') initArmies(s);
}

/* ---------------- 하루 전투 ---------------- */
function supremacy(s) {
  const a = sideForces(s, 'kr'), b = sideForces(s, 'en');
  return { air: a.air / Math.max(1, a.air + b.air), navy: a.navy / Math.max(1, a.navy + b.navy), a, b };
}
function landPower(f, airShare) { return f.divs * f.quality * (0.4 + 0.6 * f.equip) * (0.45 + 0.55 * f.org / 100) * (0.75 + airShare * 0.5); }
function frontEdges(T) {
  const byId = Object.fromEntries(T.provs.map(p => [p.id, p]));
  return T.links.filter(([a, b]) => (byId[a].owner === 'kr') !== (byId[b].owner === 'kr')).map(([a, b]) => byId[a].owner === 'kr' ? [a, b] : [b, a]);
}
function warLog(s, text, type = 'info') {
  const T = s.war.theater, t = turnLabel(s.turn), d = Math.min(89, Math.floor(T.daysThisQ));
  T.log.unshift({ text: `${t.year}년 ${(t.q - 1) * 3 + 1 + Math.floor(d / 30)}월 ${(d % 30) + 1}일 ${text}`, type });
  if (T.log.length > 40) T.log.length = 40;
  if (typeof worldNews === 'function' && type !== 'info') worldNews(s, `⚔️ ${text}`, type);
}
function warDay(s) {
  const w = s.war, T = w?.theater; if (!T || !w) return;
  T.days++; T.daysThisQ++;
  const sup = supremacy(s), A = sup.a, B = sup.b, TB = typeof techBonus === 'function' ? techBonus(s) : { cas: 1, org: 0, equip: 0 };
  const edges = frontEdges(T);
  const byId = Object.fromEntries(T.provs.map(p => [p.id, p]));
  // 적 AI 태세
  const pA = landPower(A, sup.air), pB = landPower(B, 1 - sup.air);
  const enSurr = surrender(s, 'en'), krSurr = surrender(s, 'kr');
  T.en.stance = enSurr > 55 ? 'all' : pB > pA * 0.95 ? 'attack' : 'hold';
  // 주공 목표: 목표 도시에 가장 가까운 전선에 병력 집중(×1.6), 나머지는 조공(×0.85). 적은 서울을 노림
  const focus = (goal, side) => { const tg = goal && byId[goal]; if (!tg || (side === 'kr' ? tg.owner === 'kr' : tg.owner !== 'kr') || edges.length < 2) return () => 1; // 전선이 하나면 집중할 것도 없음
    const d = p => Math.hypot(p.c[0] - tg.c[0], p.c[1] - tg.c[1]); const min = Math.min(...edges.map(e => d(byId[side === 'kr' ? e[1] : e[0]])));
    return p => d(p) <= min + 0.01 ? (side === 'kr' ? 1.6 : 1.3) : (side === 'kr' ? 0.85 : 0.95); };
  if (T.target && byId[T.target]?.owner === 'kr') { warLog(s, `🎯 목표 ${byId[T.target].n} 확보!`, 'good'); T.target = null; }
  const fK = focus(T.target, 'kr'), fE = focus(T.provs.find(p => p.n === '서울특별시' && p.owner === 'kr')?.id, 'en');
  // 군단 지휘: 군단이 있는 전선만 공격하고, 수비는 그 자리 군단+수비대
  const AW = T.armies && typeof armyWeights === 'function' ? armyWeights(s, T, edges) : null;
  if (T.pendingBattle && !s.uiPeace && typeof applyBattle === 'function') applyBattle(s, 'siege');
  if (edges.length) {
    const share = 1 / edges.length; var dayKr = 0, dayEn = 0;
    for (const [ourId, enId] of edges) {
      const key = ourId + '>' + enId, e = T.edges[key] = T.edges[key] || { prog: 0 };
      const ours = byId[ourId], theirs = byId[enId];
      const atkK = STANCES[T.kr.stance].atk, atkE = STANCES[T.en.stance].atk;
      let delta = 0;
      // 방어 측은 지형·요새·참호(방어 태세) 보너스
      const dE = theirs.terrain * (theirs.fort || 1) * (T.en.stance === 'hold' ? 1.2 : 1), dK = ours.terrain * (ours.fort || 1) * (T.kr.stance === 'hold' ? 1.2 : 1);
      const fk = AW ? 1 : fK(theirs), fe = fE(ours);
      const aw = AW ? AW.atk(ourId, enId) : { w: 1, prog: 1 }, bm = typeof battleMod === 'function' ? battleMod(T, enId) : { atk: 1, cas: 1, def: 1 };
      const kAtk = AW ? (aw.w > 0 ? (STANCES[T.kr.stance].atk || 1) : 0) : atkK;
      const pAk = pA * aw.w * bm.atk, pAd = AW ? pA * AW.def(ourId) : pA;
      if (kAtk) delta += ((pAk * kAtk * fk - pB * dE * bm.def * 0.9) / (pAk * fk + pB * dE * bm.def * 0.9 + 1) * 8 + 0.8) * (fk > 1 ? 1.15 : fk < 1 ? 0.8 : 1) * aw.prog;
      if (atkE) delta -= ((pB * atkE * fe - pAd * dK * 0.9) / (pB * fe + pAd * dK * 0.9 + 1) * 8 + 0.8) * (fe > 1 ? 1.1 : 1);
      if (AW && kAtk && aw.armies) for (const a of aw.armies) a.str = clamp(a.str - 0.04 * bm.cas, 5, 100);
      delta += gauss() * 1.6;
      if (!kAtk && !atkE) delta = 0;
      e.prog = clamp(e.prog + delta, -100, 100);
      e.active = !!(kAtk || atkE);
      // 사상자 (명)
      if (e.active) {
        const fight = (kAtk + atkE) * share;
        const krC = Math.round(pB * fight * 22 * (0.6 + Math.random() * 0.8) * TB.cas * bm.cas), enC = Math.round(pA * fight * 22 * (0.6 + Math.random() * 0.8) * (1 + sup.air * 0.4));
        T.kr.cas += krC; T.en.cas += enC; dayKr += krC; dayEn += enC;
      }
      if (e.prog >= 100) { theirs.owner = 'kr'; theirs.fort = 1; clearEdges(T, enId); T.kr.org = Math.max(10, T.kr.org - 8); warLog(s, `${theirs.n} 점령! 아군이 진격했습니다.`, theirs.vp >= 5 ? 'good' : 'info'); warFx(T, { type: 'capture', side: 'kr', name: theirs.n, vp: theirs.vp, c: theirs.c }); s.cnt = s.cnt || {}; s.cnt.capture = (s.cnt.capture || 0) + 1; if (AW) armiesOnCapture(s, T, ourId, enId); break; }
      if (e.prog <= -100) { ours.owner = w.k; ours.fort = 1; clearEdges(T, ourId); T.en.org = Math.max(10, T.en.org - 8); warLog(s, `${ours.n} 함락. 적군이 밀고 내려옵니다.`, 'bad'); warFx(T, { type: 'capture', side: 'en', name: ours.n, vp: ours.vp, c: ours.c }); if (AW) armiesOnLoss(s, T, ourId); break; }
    }
  }
  T.dayKr = dayKr || 0; T.dayEn = dayEn || 0;
  if (AW && typeof armiesDay === 'function') armiesDay(s);
  // 조직력·장비·병력
  for (const side of ['kr', 'en']) {
    const st = T[side];
    const stc = side === 'kr' && AW ? (T.armies.some(a => a.order === 'attack' && a.str > 0) ? (st.stance === 'all' ? 'all' : 'attack') : 'hold') : st.stance;
    st.org = clamp(st.org + STANCES[stc].org * (edges.length ? 1 : 0) + (edges.length ? 0 : 2) + 0.6 + (side === 'kr' ? TB.org : 0), 15, 100);
    const prod = side === 'kr' ? 0.004 + TB.equip + (s.buildings?.ship || 0) * 0.001 + (s.policies.def_budget === 'up5' ? 0.003 : s.policies.def_budget === 'up35' ? 0.0015 : 0) : 0.004 * (T.blockade > 0 ? 0.4 : 1);
    st.equip = clamp(st.equip - (edges.length && st.stance !== 'hold' ? 0.006 : 0.002) + prod, 0.15, 1);
    st.mp = clamp(st.mp - (side === 'kr' ? T.dayKr : T.dayEn) / 4000 + 0.05, 25, 100);
  }
  if (T.blockade > 0) T.blockade--;
  T.exhaustion = clamp(T.kr.cas / 6000 + T.days / 40, 0, 100);
  // 바다 건너 침공: 제해권이 압도적인 쪽이 상륙 시도
  if (!T.landLinked && !frontEdges(T).length && Math.random() < 0.01 && sup.navy < 0.3) enemyLanding(s);
}
function clearEdges(T, id) { for (const key of Object.keys(T.edges)) if (key.split('>').includes(id)) delete T.edges[key]; }
function surrender(s, side) {
  const T = s.war?.theater; if (!T) return 0;
  const home = side === 'kr' ? 'kr' : s.war.k;
  const mine = T.provs.filter(p => p.home === home), total = mine.reduce((a, p) => a + p.vp, 0);
  const lost = mine.filter(p => p.owner !== home).reduce((a, p) => a + p.vp, 0);
  const st = T[side];
  return clamp(lost / total * 100 + (100 - st.mp) * 0.3 + (1 - st.equip) * 15, 0, 100);
}
function enemyLanding(s) {
  const T = s.war.theater, coast = T.provs.filter(p => p.home === 'kr' && p.owner === 'kr' && ['부산광역시', '경상남도', '전라남도', '울산광역시', '인천광역시', '강원도', '제주특별자치도'].includes(p.n));
  const t = coast[Math.floor(Math.random() * coast.length)]; if (!t) return;
  t.owner = s.war.k; T.landLinked = true;
  warLog(s, `적군이 ${t.n}에 상륙했습니다!`, 'bad');
}
function runWarDays(s, n) { for (let i = 0; i < n && s.war?.theater; i++) warDay(s); }

/* ---------------- 명령 ---------------- */
const OPS = [
  { id: 'bomb', name: '전략 폭격', icon: '✈️', cost: 15, cd: 30, desc: '적 공장·보급선을 폭격합니다. 제공권 50% 이상 필요. 적 장비 -12%, 조직력 -10.',
    can: s => supremacy(s).air < 0.5 ? '제공권이 50% 미만입니다.' : null,
    run: s => { const T = s.war.theater; T.en.equip = clamp(T.en.equip - 0.12, 0.15, 1); T.en.org -= 10; T.kr.airLeft = clamp(T.kr.airLeft - 4, 20, 100); return '전략 폭격으로 적 군수 시설을 타격했습니다.'; } },
  { id: 'missile', name: '미사일 정밀 타격', icon: '🚀', cost: 20, cd: 20, desc: '적 지휘부·포병 진지를 정밀 타격. 적 조직력 -18, 장비 -5%.',
    run: s => { const T = s.war.theater, m = typeof techBonus === 'function' ? techBonus(s).missile : 1; T.en.org = clamp(T.en.org - 18 * m, 5, 100); T.en.equip = clamp(T.en.equip - 0.05 * m, 0.15, 1); T.en.airLeft = clamp(T.en.airLeft - 6 * m, 10, 100); return `${m >= 1.8 ? '극초음속 미사일' : '현무 미사일'}이 적 지휘부를 타격했습니다.${m > 1 ? ` (위력 ×${m.toFixed(1)})` : ''}`; } },
  { id: 'cyber', name: '사이버 공격', icon: '💻', cost: 12, cd: 25, desc: '적 지휘통신망·전력망을 마비시킵니다. 적 조직력 -12, 장비 -4%. 사이버사령부 확장 필요.',
    can: s => typeof techDone === 'function' && techDone(s, 'c1') ? null : '사이버사령부 확장을 먼저 개발하세요.',
    run: s => { const T = s.war.theater; T.en.org = clamp(T.en.org - 12, 5, 100); T.en.equip = clamp(T.en.equip - 0.04, 0.15, 1); return '사이버사령부가 적 지휘통신망을 마비시켰습니다.'; } },
  { id: 'landing', name: '상륙 작전', icon: '⚓', cost: 30, cd: 45, desc: '적 해안에 상륙해 교두보를 만듭니다. 제해권이 높을수록 성공률↑. 바다 건너 전쟁에서는 필수.',
    run: s => { const T = s.war.theater, sup = supremacy(s);
      const targets = T.provs.filter(p => p.home === s.war.k && p.owner !== 'kr');
      const kc = MAP_DATA.countries.kr.c, dd = p => (p.c[0] - kc[0]) ** 2 + (p.c[1] - kc[1]) ** 2;
      const target = T.provs.find(p => p.virtual && p.home === s.war.k && p.owner !== 'kr') || targets.sort((a, b) => dd(a) - dd(b))[0];
      if (!target) return '상륙할 곳이 없습니다.';
      const marine = (T.armies || []).some(a => a.str > 0 && a.gen.traits.includes('marine')) ? 0.15 : 0;
      const p = clamp(0.2 + sup.navy * 0.7 + sup.air * 0.1 - (target.fort ? 0.1 : 0) + (typeof techBonus === 'function' ? techBonus(s).landing : 0) + marine, 0.05, 0.95);
      if (Math.random() < p) { target.owner = 'kr'; T.landLinked = true; clearEdges(T, target.id);
        if (T.armies) { const ma = T.armies.filter(a => a.str > 0).sort((x, y) => (y.gen.traits.includes('marine') ? 2 : 0) + (y.name.includes('상륙') ? 1 : 0) - (x.gen.traits.includes('marine') ? 2 : 0) - (x.name.includes('상륙') ? 1 : 0))[0]; if (ma) { ma.loc = target.id; ma.order = ma.auto ? 'attack' : 'hold'; ma.path = []; ma.target = null; warLog(s, `⚓ ${ma.name}이(가) ${target.n}에 상륙했습니다.`, 'good'); } } warLog(s, `${target.n} 상륙 성공! 교두보를 확보했습니다.`, 'good'); return `${target.n} 상륙에 성공했습니다. (성공률 ${Math.round(p * 100)}%)`; }
      T.kr.mp = clamp(T.kr.mp - 4, 30, 100); T.kr.navyLeft = clamp(T.kr.navyLeft - 10, 10, 100); warLog(s, `${target.n} 상륙 실패. 큰 피해를 입었습니다.`, 'bad'); return `상륙이 실패했습니다. (성공률 ${Math.round(p * 100)}%)`; } },
  { id: 'blockade', name: '해상 봉쇄', icon: '🚢', cost: 10, cd: 60, desc: '적 항구를 봉쇄해 60일간 적 장비 보충을 크게 줄입니다. 제해권 40% 이상.',
    can: s => supremacy(s).navy < 0.4 ? '제해권이 40% 미만입니다.' : null,
    run: s => { s.war.theater.blockade = 60; return '해군이 적 항구 봉쇄에 들어갔습니다.'; } },
  { id: 'mobilize', name: '총동원령', icon: '📯', cost: 25, cd: 9999, desc: '예비군 동원. 사단 +25%. 지지율 -4, 경제 위축.',
    can: s => s.war.theater.mobilized ? '이미 총동원 중입니다.' : null,
    run: s => { const T = s.war.theater; T.mobilized = true; T.kr.mp = clamp(T.kr.mp + 15, 30, 100); s.approval = clamp(s.approval - 4, 0, 100); s.mods.gdp -= 0.2; s.factions.youth = clamp(s.factions.youth - 6, 0, 100); return '총동원령을 선포했습니다. 예비군이 전선으로 향합니다.'; } },
];
// 화면 연출용 사건 기록 (지도 폭발·함락 배너). 화면이 읽고 지움
function warFx(T, ev) { (T.fx = T.fx || []).push(ev); if (T.fx.length > 8) T.fx.shift(); }
function setTarget(s, id) {
  const T = s.war?.theater; if (!T) return { ok: false, msg: '전쟁 중이 아닙니다.' };
  const p = T.provs.find(x => x.id === id);
  if (!id || !p) { T.target = null; return { ok: true, msg: '주공 목표를 해제했습니다.' }; }
  if (p.owner === 'kr') return { ok: false, msg: '이미 아군이 장악한 곳입니다.' };
  T.target = id; warLog(s, `🎯 주공 목표 지정: ${p.n}`);
  return { ok: true, msg: `🎯 주공 목표: ${p.n} — 가장 가까운 전선에 병력을 집중합니다.` };
}
function setStance(s, st) { if (!s.war?.theater) return { ok: false }; s.war.theater.kr.stance = st; warLog(s, `아군 태세 전환: ${STANCES[st].name}`); return { ok: true }; }
function warOp(s, id) {
  const T = s.war?.theater; if (!T) return { ok: false, msg: '전쟁 중이 아닙니다.' };
  const o = OPS.find(x => x.id === id);
  if ((T.ops[id] || 0) > T.days) return { ok: false, msg: `${T.ops[id] - T.days}일 뒤에 다시 할 수 있습니다.` };
  const why = o.can?.(s); if (why) return { ok: false, msg: why };
  if (s.pcap < o.cost) return { ok: false, msg: `국고 ${won(o.cost)}이(가) 필요합니다.` };
  s.pcap -= o.cost; T.ops[id] = T.days + o.cd;
  const msg = o.run(s); warLog(s, `${o.icon} ${msg}`);
  const tgt = T.provs.find(p => p.id === T.target) || T.provs.filter(p => p.home === s.war.k && p.owner !== 'kr').sort((a, b) => b.vp - a.vp)[0];
  warFx(T, { type: 'op', id, c: tgt?.c, ok: !/실패/.test(msg) });
  s.cnt = s.cnt || {}; s.cnt.ops = (s.cnt.ops || 0) + 1;
  return { ok: true, msg };
}

/* ---------------- 분기 결산과 연결 ---------------- */
// 분기 동안 실시간으로 흐르지 않은 날은 결산 때 몰아서 진행
function warQuarter(s, report) {
  const w = s.war, T = w.theater;
  runWarDays(s, Math.max(0, 90 - T.daysThisQ));
  T.daysThisQ = 0;
  const es = surrender(s, 'en'), ks = surrender(s, 'kr');
  w.score = clamp((es - ks) * 1.3, -100, 100);
  const cas = n => n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n.toLocaleString('ko-KR');
  return { es, ks, line: `전황: 적 항복 진행도 ${es.toFixed(0)}% · 아군 ${ks.toFixed(0)}% · 사상자 아군 ${cas(T.kr.cas)}명 / 적군 ${cas(T.en.cas)}명` };
}
// 핵 공격: 게임 오버 대신 극한 위기
function nuclearStrike(s) {
  const w = s.war, T = w.theater;
  const target = T ? (T.provs.find(p => p.home === 'kr' && p.owner === 'kr' && p.vp >= 3 && p.n !== '서울특별시') || T.provs.find(p => p.home === 'kr' && p.owner === 'kr')) : null;
  if (target) target.nuked = true;
  s.stats.gdp -= 6; s.stats.happiness -= 25; s.stats.safety -= 30; s.stats.security -= 10; s.stats.debt += 15; s.mods.gdp -= 0.5;
  s.approval = clamp(s.approval + 6, 0, 100); // 결집
  if (s.world) s.world.tension = 100;
  s.nukePending = { k: w.k, city: target?.n || '남부 도시' };
  addLog(s, 'bad', `☢️ ${cname(w.k)} 진영이 ${s.nukePending.city}에 핵무기를 사용했습니다.`);
  if (typeof worldNews === 'function') worldNews(s, `☢️ 속보: ${cname(w.k)}, 대한민국 ${s.nukePending.city}에 핵 공격`, 'bad');
}
function nukeResponse(s, choice) {
  const k = s.nukePending?.k; s.nukePending = null; if (!s.war) return '전쟁은 이미 끝났습니다.';
  if (choice === 'retaliate') {
    const can = hasNukes(s, 'kr') || s.war.allies.includes('us');
    if (!can) return '보복할 핵 수단이 없습니다.';
    const T = s.war.theater; if (T) { T.en.mp -= 30; T.en.equip = 0.3; T.en.org = 10; }
    for (const o of Object.keys(RELATIONS)) if (o !== k) relBump(s, o, -10, -6);
    s.scoreBonus = (s.scoreBonus || 0) - 5;
    return `${s.war.allies.includes('us') && !hasNukes(s, 'kr') ? '미국이' : '대한민국이'} 핵으로 보복했습니다. 적군이 붕괴 직전입니다. 세계가 경악했습니다.`;
  }
  if (choice === 'ceasefire') { endWar(s, 'white'); s.approval = clamp(s.approval - 8, 0, 100); return '현 전선에서 즉시 휴전했습니다. 더 이상의 핵 공격은 막았습니다.'; }
  if (Math.random() < 0.6) { endWar(s, 'white'); relBump(s, 'us', 5, 3); relBump(s, 'eu', 5, 3); return '유엔 안보리 긴급 중재로 휴전이 성립했습니다. 국제 사회가 재건 지원을 약속했습니다.'; }
  return '중재가 실패했습니다. 전쟁이 계속됩니다.';
}
