/* =========================================================
 *  미사일 정밀 타격 (적 내륙 어디든) + 적의 미사일 공격과 요격
 *  - 미사일 재고: 기본 6발 + 미사일 기술, 10일마다 1발 보충
 *  - 목표 종류: 지휘부·군수공장·비행장·항구·수도(정부청사)
 *  - 맞은 지역은 일정 기간 방어가 약해짐(공략이 쉬워짐), 목표별 전국 효과
 *  - 적도 우리 도시·군단에 미사일을 쏨 → 방공 기술에 따라 요격
 * ========================================================= */
const STRIKE_TYPES = [
  { id: 'hq', icon: '🎯', name: '지휘부', desc: '그 지역 방어 -30%(20일), 적 조직력 -12', def: 0.7, days: 20, run: (s, T) => { T.en.org = clamp(T.en.org - 12, 5, 100); } },
  { id: 'factory', icon: '🏭', name: '군수공장', desc: '적 장비 -6%, 30일간 적 장비 보충 절반', def: 0.9, days: 30, run: (s, T) => { T.en.equip = clamp(T.en.equip - 0.06, 0.15, 1); T.enProdCut = T.days + 30; } },
  { id: 'airbase', icon: '✈️', name: '비행장', desc: '적 공군 -12% (제공권↑)', def: 0.9, days: 15, run: (s, T) => { T.en.airLeft = clamp(T.en.airLeft - 12, 10, 100); } },
  { id: 'port', icon: '⚓', name: '항구', desc: '적 해군 -12% (제해권↑), 해안 지역만', def: 0.9, days: 15, coast: true, run: (s, T) => { T.en.navyLeft = clamp(T.en.navyLeft - 12, 10, 100); } },
  { id: 'capital', icon: '🏛️', name: '수도·정부청사', desc: '적 항복 의지 꺾기(병력 -4%, 조직력 -8). 국제 비난, 위협도 +2', def: 0.8, days: 20, capital: true, run: (s, T) => { T.en.mp = clamp(T.en.mp - 4, 25, 100); T.en.org = clamp(T.en.org - 8, 5, 100); if (typeof addThreat === 'function') addThreat(s, 2); relBump(s, 'eu', -2, -1); } },
];
const COAST_WORDS = /해안|항만|부산|인천|울산|남포|원산|청진|함경|평안남|황해|도$|현$|시$/;
function missileStock(s) {
  const T = s.war?.theater; if (!T) return 0;
  const tb = typeof techBonus === 'function' ? techBonus(s) : { missile: 1 };
  const cap = 6 + Math.round((tb.missile - 1) * 8);
  if (T.missiles == null) T.missiles = cap;
  T.missileCap = cap; return T.missiles;
}
function strikeOptions(s, pid) {
  const T = s.war.theater, p = T.provs.find(x => x.id === pid); if (!p || p.owner === 'kr') return [];
  return STRIKE_TYPES.filter(t => (!t.capital || p.vp >= 5) && (!t.coast || p.virtual || COAST_WORDS.test(p.n)));
}
function missileStrike(s, pid, type) {
  const T = s.war?.theater; if (!T) return { ok: false, msg: '전쟁 중이 아닙니다.' };
  const p = T.provs.find(x => x.id === pid), st = STRIKE_TYPES.find(x => x.id === type);
  if (!p || !st || p.owner === 'kr') return { ok: false, msg: '적 지역을 고르세요.' };
  if (missileStock(s) < 1) return { ok: false, msg: '미사일이 없습니다. 10일마다 1발씩 보충됩니다.' };
  if (s.pcap < 8) return { ok: false, msg: `발사 비용 ${won(8)}이(가) 필요합니다.` };
  T.missiles--; s.pcap -= 8;
  const tb = typeof techBonus === 'function' ? techBonus(s) : { missile: 1 };
  // 적 방공에 일부 요격 (극초음속·정찰위성이면 잘 뚫음)
  const hit = Math.random() < clamp(0.6 + (tb.missile - 1) * 0.25 + (1 - T.en.airLeft / 100) * 0.2, 0.45, 0.95);
  warFx(T, { type: 'strike', c: p.c, ok: hit, kind: st.id });
  if (!hit) { warLog(s, `🚀 ${p.n} ${st.name} 타격 — 적 방공망에 요격당했습니다.`, 'bad'); return { ok: true, msg: `${st.icon} ${p.n} ${st.name}: 요격당했습니다! (남은 미사일 ${T.missiles}발)` }; }
  (T.strikes = T.strikes || {})[pid] = { def: st.def, until: T.days + st.days, icon: st.icon };
  st.run(s, T);
  (s.cnt = s.cnt || {}).ops = (s.cnt.ops || 0) + 1;
  warLog(s, `🚀 ${p.n} ${st.name} 명중! ${st.desc}`, 'good');
  return { ok: true, msg: `${st.icon} ${p.n} ${st.name} 명중! (남은 미사일 ${T.missiles}발)` };
}
// 맞은 지역의 방어 배율 (전투 계산에서 사용)
function strikeDef(T, pid) { const x = T.strikes?.[pid]; return x && T.days <= x.until ? x.def : 1; }
// 하루마다: 미사일 보충, 적의 미사일 공격
function strikesDay(s) {
  const T = s.war?.theater; if (!T) return;
  missileStock(s);
  if (T.days % 10 === 0 && T.missiles < T.missileCap) T.missiles++;
  if (T.enProdCut && T.days <= T.enProdCut) T.en.equip = clamp(T.en.equip - 0.002, 0.15, 1); // 보충 절반
  // 적 미사일: 핵심 도시나 군단을 노림
  const enemyMissiles = cinfo(s.war.k).mil >= 30 || cinfo(s.war.k).nukes;
  if (!enemyMissiles || Math.random() > 0.06) return;
  const mine = T.provs.filter(p => p.owner === 'kr' && p.home === 'kr');
  const armyLocs = new Set((T.armies || []).filter(a => a.str > 0).map(a => a.loc));
  const tg = mine.sort((a, b) => (b.vp + (armyLocs.has(b.id) ? 6 : 0)) - (a.vp + (armyLocs.has(a.id) ? 6 : 0)))[Math.floor(Math.random() * Math.min(3, mine.length))];
  if (!tg) return;
  const done = id => typeof techDone === 'function' && techDone(s, id);
  const pInt = clamp(0.15 + (done('m1') ? 0.25 : 0) + (done('m6') ? 0.2 : 0) + (done('m5') ? 0.15 : 0) + (done('n7') ? 0.08 : 0) + (done('a7') ? 0.07 : 0), 0.1, 0.92);
  const intercepted = Math.random() < pInt;
  const from = T.provs.filter(p => p.owner !== 'kr').sort((a, b) => b.vp - a.vp)[0]?.c;
  warFx(T, { type: 'enemyStrike', from, c: tg.c, intercepted });
  if (intercepted) { warLog(s, `🛡️ 적 탄도미사일이 ${tg.n}을(를) 노렸으나 요격에 성공했습니다! (요격률 ${Math.round(pInt * 100)}%)`, 'good'); return; }
  const hitArmies = (T.armies || []).filter(a => a.loc === tg.id && a.str > 0);
  for (const a of hitArmies) a.str = clamp(a.str - 12, 5, 100);
  s.approval = clamp(s.approval - 0.4, 0, 100); s.stats.gdp -= 0.02; T.kr.org = clamp(T.kr.org - 3, 5, 100);
  warLog(s, `💥 적 미사일이 ${tg.n}에 떨어졌습니다!${hitArmies.length ? ` ${hitArmies.map(a => a.name).join('·')} 피해` : ' 민간 피해 발생'} (요격률 ${Math.round(pInt * 100)}%)`, 'bad');
}

/* ---------------- 사단 재편: 새 군단 편성·군단 합치기 ---------------- */
const ARMY_EXTRA_NAMES = ['제5군', '제6군', '제7군', '수도방위사령부', '기동군단', '특수전사령부'];
function splitArmy(s, aid) {
  const T = s.war?.theater, a = T?.armies?.find(x => x.id === aid); if (!a) return { ok: false };
  if (T.armies.filter(x => x.str > 0).length >= 6) return { ok: false, msg: '군단은 6개까지 편성할 수 있습니다.' };
  if (a.share < 0.2) return { ok: false, msg: '떼어낼 사단이 부족합니다.' };
  const take = Math.round(a.share * 0.4 * 100) / 100; a.share -= take;
  const name = ARMY_EXTRA_NAMES.find(n => !T.armies.some(x => x.name === n)) || `제${T.armies.length + 1}군`;
  const b = { id: 'a' + Date.now().toString(36) + T.armies.length, name, share: take, str: a.str, loc: a.loc, order: 'hold', target: null, path: [], moveT: 0, auto: false, gen: genGeneral(), kills: 0 };
  T.armies.push(b);
  return { ok: true, msg: `${a.name}에서 사단을 떼어 ${name}(${b.gen.name} 대장)을 편성했습니다.` };
}
function mergeArmy(s, aid) {
  const T = s.war?.theater, a = T?.armies?.find(x => x.id === aid); if (!a) return { ok: false };
  const b = T.armies.find(x => x !== a && x.loc === a.loc && x.str > 0);
  if (!b) return { ok: false, msg: '같은 지역에 있는 다른 군단이 없습니다. 먼저 한곳으로 모으세요.' };
  b.str = (b.str * b.share + a.str * a.share) / (a.share + b.share); b.share += a.share;
  T.armies = T.armies.filter(x => x !== a);
  return { ok: true, msg: `${a.name}을(를) ${b.name}에 합쳤습니다.` };
}
// 군단의 사단 수 (화면 표시)
function armyDivs(s, a) { const f = sideForces(s, 'kr'); const live = s.war.theater.armies.filter(x => x.str > 0).reduce((x, y) => x + y.share, 0) || 1; return Math.max(1, Math.round(f.rawDivs * 0.65 * a.share / live)); }

/* ---------------- ☢️ 핵 공격 (핵보유국만) ----------------
 * 탄두는 처음 핵보유국이 될 때 3발, 이후 4분기마다 1발 생산(최대 6발)
 * 목표 지역: 적군 괴멸, 60일간 방어 사실상 소멸, 적 병력·조직력·장비 폭락
 * 대가: 주요국 관계 폭락, 위협도 +35, 지지율 -6, 세계 긴장 최고, 평가 감점
 *       적(또는 적 동맹)이 핵보유국이면 보복 핵 위험 — 미사일 방어 기술이 막아 줌
 */
function nukeStock(s) { if (!hasNukes(s, 'kr')) return 0; if (s.nukeStock == null) s.nukeStock = 3; return s.nukeStock; }
function nukeRetaliationChance(s) {
  const w = s.war; if (!w) return 0;
  const enemyNuke = hasNukes(s, w.k) || w.enemyAllies.some(c => cinfo(c)?.nukes); if (!enemyNuke) return 0;
  const done = id => typeof techDone === 'function' && techDone(s, id);
  return clamp(0.65 - (done('m5') ? 0.25 : 0) - (done('m1') ? 0.08 : 0) - (done('m7') ? 0.1 : 0) - (done('n5') ? 0.07 : 0), 0.1, 0.65);
}
function playerNuke(s, pid) {
  const w = s.war, T = w?.theater; if (!T) return { ok: false, msg: '전쟁 중이 아닙니다.' };
  if (!hasNukes(s, 'kr')) return { ok: false, msg: '핵무기가 없습니다. 독자 핵무장 정책이나 무기 개발이 필요합니다.' };
  if (nukeStock(s) < 1) return { ok: false, msg: '남은 핵탄두가 없습니다. 4분기마다 1발씩 생산됩니다.' };
  const p = T.provs.find(x => x.id === pid); if (!p || p.owner === 'kr') return { ok: false, msg: '적 지역을 고르세요.' };
  s.nukeStock--; (s.cnt = s.cnt || {}).nukeUsed = (s.cnt.nukeUsed || 0) + 1;
  // 전장 효과
  p.nuked = true; (T.strikes = T.strikes || {})[pid] = { def: 0.1, until: T.days + 60, icon: '☢️' };
  T.en.mp = clamp(T.en.mp - 15 - p.vp, 20, 100); T.en.org = clamp(T.en.org - 40, 5, 100); T.en.equip = clamp(T.en.equip - 0.15, 0.15, 1); T.en.cas += 150000 + p.vp * 60000;
  // 맞닿은 아군 군단이 있으면 곧바로 진입 가능할 만큼 무너짐
  for (const key of Object.keys(T.edges)) if (key.endsWith('>' + pid)) T.edges[key].prog = Math.max(T.edges[key].prog, 70);
  // 국제 사회의 대가
  for (const k of ['us', 'cn', 'jp', 'eu', 'ru']) if (k !== w.k && cinfo(k)) relBump(s, k, -25, -18);
  if (typeof addThreat === 'function') addThreat(s, 35, '핵무기 사용');
  if (s.world) s.world.tension = 100;
  s.approval = clamp(s.approval - 6, 0, 100); s.scoreBonus = (s.scoreBonus || 0) - 10; s.factions.lib = clamp(s.factions.lib - 12, 0, 100);
  warFx(T, { type: 'nuke', c: p.c, name: p.n });
  warLog(s, `☢️ 대한민국이 ${p.n}에 핵무기를 사용했습니다.`, 'bad');
  addLog(s, 'bad', `☢️ ${cname(w.k)} ${p.n}에 핵 공격. 세계가 경악했습니다.`);
  if (typeof worldNews === 'function') worldNews(s, `☢️ 속보: 대한민국, ${cname(w.k)} ${p.n}에 핵 공격 — 국제 사회 경악`, 'bad');
  // 보복
  const rc = nukeRetaliationChance(s);
  let msg = `☢️ ${p.n}에 핵 공격. 적군이 괴멸했습니다.`;
  if (rc && Math.random() < rc) { nuclearStrike(s); msg += ` 그러나 ${cname(w.k)} 진영이 보복 핵 공격을 가했습니다!`; }
  else if (rc) msg += ` 적의 보복은 없었습니다(보복 위험 ${Math.round(rc * 100)}%).`;
  return { ok: true, msg };
}
HOOKS.postTurn.push(s => { if (hasNukes(s, 'kr')) { nukeStock(s); s.nukeTimer = (s.nukeTimer || 0) + 1; if (s.nukeTimer >= 4) { s.nukeTimer = 0; s.nukeStock = Math.min(6, s.nukeStock + 1); } } });
