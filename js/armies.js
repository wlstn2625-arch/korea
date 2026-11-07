/* =========================================================
 *  군단 지휘 (하츠식): 장군이 이끄는 군단을 지도에서 직접 움직임
 *  - 전체 병력의 25%는 전선 수비대, 75%를 군단들이 나눠 가짐
 *  - 군단: 위치(시·도), 명령(방어/공격/이동), 병력 비중, 전투력(str), 장군(특성·경험)
 *  - 공격은 군단이 있는 곳에서 인접한 적 지역으로만. 점령하면 그 지역으로 진격
 *  - 포위: 사방이 아군인 적 지역은 항복(포위 섬멸), 사방이 적인 아군 군단은 궤멸
 *  - 큰 도시·험지 공격 때 전투 결정 카드(정면 돌격·포위 고사·포격 우선)
 *  - 자동 지휘를 켜면 장군이 알아서 목표를 고름
 * ========================================================= */
const GEN_TRAITS = {
  offense: { name: '공격형', icon: '⚔️', desc: '공격력 +20%', atk: 1.2 },
  defense: { name: '방어형', icon: '🛡️', desc: '방어력 +25%', def: 1.25 },
  armor: { name: '기갑', icon: '🛞', desc: '이동이 빠르고 돌파력 +15%', speed: 3, prog: 1.15 },
  marine: { name: '상륙전', icon: '⚓', desc: '상륙 작전 성공률 +15%p', landing: 0.15 },
  logistics: { name: '보급', icon: '📦', desc: '병력 회복 2배', regen: 2 },
  ace: { name: '명장', icon: '🎖️', desc: '공격·방어 +10%', atk: 1.1, def: 1.1 },
};
const ARMY_NAMES = ['제1군', '제2군', '제3군', '제5군단', '해병 원정군'];
function genGeneral() {
  const ks = Object.keys(GEN_TRAITS), t = [ks[Math.floor(Math.random() * ks.length)]];
  if (Math.random() < 0.3) { const t2 = ks[Math.floor(Math.random() * ks.length)]; if (!t.includes(t2)) t.push(t2); }
  return { name: (typeof randName === 'function' ? randName() : '장군'), rank: '대장', skill: 1 + Math.floor(Math.random() * 3), traits: t, xp: 0 };
}
const genMul = (g, key) => g.traits.reduce((a, t) => a * (GEN_TRAITS[t][key] || 1), 1) * (key === 'atk' || key === 'def' ? 1 + 0.04 * g.skill : 1);
function linkMap(T) { if (T._lm && T._lmN === T.links.length) return T._lm; const m = {}; for (const [a, b] of T.links) { (m[a] = m[a] || []).push(b); (m[b] = m[b] || []).push(a); } T._lm = m; T._lmN = T.links.length; return m; }
function frontProvs(T) { const lm = linkMap(T), by = Object.fromEntries(T.provs.map(p => [p.id, p])); return T.provs.filter(p => p.owner === 'kr' && (lm[p.id] || []).some(n => by[n].owner !== 'kr')).map(p => p.id); }
// 아군 땅을 따라가는 최단 경로
function armyPath(T, from, to) {
  const lm = linkMap(T), by = Object.fromEntries(T.provs.map(p => [p.id, p])), prev = { [from]: null }, q = [from];
  while (q.length) { const x = q.shift(); if (x === to) break; for (const n of lm[x] || []) if (!(n in prev) && by[n].owner === 'kr') { prev[n] = x; q.push(n); } }
  if (!(to in prev)) return by[to]?.owner === 'kr' ? ['sea:' + to] : null; // 바다 건너면 해상 수송
  const path = []; for (let x = to; x !== from; x = prev[x]) path.unshift(x); return path;
}
function initArmies(s) {
  const T = s.war.theater; const F = frontProvs(T);
  const homes = T.provs.filter(p => p.home === 'kr' && p.owner === 'kr');
  const coast = homes.find(p => p.n === '부산광역시') || homes[0];
  const n = F.length >= 2 ? 3 : 2;
  const byId = Object.fromEntries(T.provs.map(p => [p.id, p]));
  const Fs = [...F].sort((a, b) => byId[a].c[0] - byId[b].c[0]); // 서쪽 → 동쪽
  const spread = Fs.length ? [Fs[0], Fs[Fs.length - 1]] : [coast.id, coast.id];
  const mid = Fs.length >= 3 ? Fs[Math.floor(Fs.length / 2)] : coast.id;
  const shares = n === 3 ? [0.4, 0.35, 0.25] : [0.6, 0.4];
  T.armies = shares.map((sh, i) => ({ id: 'a' + i, name: ARMY_NAMES[i], share: sh, str: 100, loc: i < 2 ? spread[i] : (F.length >= 3 ? mid : coast.id), order: 'hold', target: null, path: [], moveT: 0, auto: true, gen: genGeneral(), kills: 0 }));
  if (T.armies[2]) T.armies[2].name = '제3군(예비·상륙)';
}
const armyAt = (T, pid) => (T.armies || []).filter(a => a.loc === pid && a.str > 0);
// 이 전선(아군 ourId → 적 enId)에서 아군 공격력·방어력 배율 (균등 배치면 기존과 같은 1)
function armyWeights(s, T, edges) {
  const F = [...new Set(edges.map(e => e[0]))], nF = Math.max(1, F.length);
  const live = (T.armies || []).filter(a => a.str > 0); const tot = live.reduce((x, a) => x + a.share, 0) || 1;
  const eff = a => (a.share / tot) * (0.7 + 0.3 * a.str / 100);
  return {
    atk: (ourId, enId) => { const as = live.filter(a => a.loc === ourId && a.order === 'attack' && a.target === enId); if (!as.length) return { w: 0, prog: 1 };
      return { w: Math.pow(nF, 0.8) * as.reduce((x, a) => x + eff(a) * genMul(a.gen, 'atk'), 0), prog: Math.max(...as.map(a => genMul(a.gen, 'prog'))), armies: as }; },
    def: ourId => 0.35 + 0.65 * nF * live.filter(a => a.loc === ourId).reduce((x, a) => x + eff(a) * genMul(a.gen, 'def'), 0),
  };
}
function retreat(s, T, a) {
  const lm = linkMap(T), by = Object.fromEntries(T.provs.map(p => [p.id, p]));
  const opts = (lm[a.loc] || []).filter(n => by[n].owner === 'kr');
  if (!opts.length && by[a.loc]?.home !== 'kr') { // 교두보에서 밀리면 해상 철수
    const home = T.provs.find(p => p.home === 'kr' && p.owner === 'kr' && ['부산광역시', '인천광역시', '울산광역시'].includes(p.n)) || T.provs.find(p => p.home === 'kr' && p.owner === 'kr');
    if (home) { a.loc = home.id; a.str = Math.max(10, a.str - 40); a.order = 'hold'; a.target = null; a.path = []; if (s.war.k !== 'nk' && !frontProvs(T).length) T.landLinked = false; warLog(s, `🚢 ${a.name}이(가) 교두보를 잃고 ${home.n}(으)로 해상 철수했습니다.`, 'bad'); return; }
  }
  if (!opts.length) { a.str = 0; warLog(s, `💀 ${a.name}(${a.gen.name} 장군)이 퇴로를 잃고 궤멸했습니다!`, 'bad'); warFx(T, { type: 'capture', side: 'en', name: `${a.name} 궤멸`, vp: 6, c: by[a.loc].c }); return; }
  a.loc = opts[Math.floor(Math.random() * opts.length)]; a.str = Math.max(10, a.str - 15); a.order = 'hold'; a.target = null; a.path = [];
  warLog(s, `↩️ ${a.name}이(가) ${by[a.loc].n}(으)로 후퇴했습니다.`, 'bad');
}
// 점령·함락 직후 군단 처리
function armiesOnCapture(s, T, ourId, enId) {
  for (const a of (T.armies || [])) if (a.loc === ourId && a.order === 'attack' && a.target === enId && a.str > 0) {
    a.loc = enId; a.target = null; a.order = a.auto ? 'attack' : 'hold'; a.gen.xp++; a.kills++;
    if (a.gen.xp >= (a.gen.skill + 1) * 3 && a.gen.skill < 5) { a.gen.skill++; warLog(s, `⭐ ${a.gen.name} 장군 진급! (지휘력 ${a.gen.skill})`, 'good'); }
  }
}
function armiesOnLoss(s, T, lostId) { for (const a of (T.armies || [])) if (a.loc === lostId && a.str > 0) retreat(s, T, a); }
// 하루마다: 이동, 회복, 자동 지휘, 포위
function armiesDay(s) {
  const T = s.war?.theater; if (!T?.armies) return;
  const lm = linkMap(T), by = Object.fromEntries(T.provs.map(p => [p.id, p])), enemyAdj = id => (lm[id] || []).filter(n => by[n].owner !== 'kr');
  const glob = T.kr.stance;
  for (const a of T.armies) {
    if (a.str <= 0) continue;
    if (by[a.loc]?.owner !== 'kr') { retreat(s, T, a); continue; }
    // 이동
    if (a.order === 'move' && a.path.length) {
      a.moveT = (a.moveT || 0) + 1;
      const sea = String(a.path[0]).startsWith('sea:');
      if (a.moveT >= (sea ? 12 : genMul(a.gen, 'speed') !== 1 ? GEN_TRAITS.armor.speed : 5)) { a.moveT = 0; const nx = String(a.path.shift()).replace('sea:', ''); if (by[nx]?.owner === 'kr') { a.loc = nx; if (sea) warLog(s, `🚢 ${a.name}이(가) 해상 수송으로 ${by[nx].n}에 도착했습니다.`); } else { a.path = []; } }
      if (!a.path.length) { a.order = a.auto ? 'attack' : 'hold'; if (!a.auto) warLog(s, `📍 ${a.name}이(가) ${by[a.loc].n}에 도착해 명령을 기다립니다.`); }
    }
    // 회복: 방어·대기 중이면 병력 회복
    a.str = clamp(a.str + (a.order === 'attack' ? -0.04 : 0.6 * genMul(a.gen, 'regen')), 5, 100);
    // 자동 지휘: 지치면 쉬었다가 다시 공격
    if (a.auto) { if (a.str < 35) a.resting = true; if (a.resting && a.str > 75) a.resting = false; }
    // 자동 지휘: 인접한 적 지역 중 목표(주공)에 가깝고 약한 곳, 없으면 가장 가까운 전선으로 이동
    if (a.auto && a.order !== 'move') {
      const adj = enemyAdj(a.loc);
      if (glob === 'hold' || a.resting) { a.order = 'hold'; a.target = null; }
      else if (adj.length) {
        if (!a.target || !adj.includes(a.target) || T.days % 10 === 0) {
          const tg = T.target && by[T.target];
          const sc = id => by[id].vp * 2 - by[id].terrain * 3 - (by[id].fort || 1) * 2 - (tg ? Math.hypot(by[id].c[0] - tg.c[0], by[id].c[1] - tg.c[1]) * 0.6 : 0) + (by[id].nuked ? -5 : 0);
          a.target = adj.sort((x, y) => sc(y) - sc(x))[0];
        }
        a.order = 'attack';
      } else {
        const F = frontProvs(T); const occ = f => T.armies.filter(x => x !== a && x.str > 0 && (x.loc === f || x.path?.at?.(-1) === f || String(x.path?.at?.(-1)) === 'sea:' + f)).length;
        if (F.length) { const near = F.map(f => [f, armyPath(T, a.loc, f)]).filter(x => x[1]).sort((x, y) => occ(x[0]) - occ(y[0]) || x[1].length - y[1].length)[0]; if (near && near[1].length) { a.order = 'move'; a.path = near[1]; a.target = null; } }
      }
    }
    if (a.order === 'attack' && (!a.target || by[a.target]?.owner === 'kr' || !enemyAdj(a.loc).includes(a.target))) { a.order = a.auto ? 'attack' : 'hold'; a.target = null; }
  }
  if (T.days % 7 === 0) {
    const F = frontProvs(T), live = T.armies.filter(a => a.str > 0);
    const empty = F.filter(f => !live.some(a => a.loc === f || a.path?.at?.(-1) === f));
    const crowded = live.filter(a => a.auto && a.order !== 'move' && live.filter(b => b.loc === a.loc).length >= 2);
    if (empty.length && crowded.length && F.length > live.length - 1) {
      const a = crowded[0], tgt = empty.map(f => [f, armyPath(T, a.loc, f)]).filter(x => x[1]).sort((x, y) => x[1].length - y[1].length)[0];
      if (tgt) { a.order = 'move'; a.path = tgt[1]; a.target = null; }
    }
  }
  // 포위 섬멸: 사방이 아군 땅인 적 지역은 항복
  for (const p of T.provs) {
    if (p.owner === 'kr' || p.virtual) continue;
    const nb = lm[p.id] || []; if (nb.length < 2 || !nb.every(n => by[n].owner === 'kr')) continue;
    p.owner = 'kr'; clearEdges(T, p.id); T.en.mp = clamp(T.en.mp - 5, 25, 100); T.en.cas += 15000;
    warLog(s, `🌀 ${p.n} 포위 섬멸! 고립된 적 부대가 항복했습니다.`, 'good'); warFx(T, { type: 'capture', side: 'kr', name: `${p.n} 포위 섬멸`, vp: 6, c: p.c });
    (s.cnt = s.cnt || {}).capture = (s.cnt.capture || 0) + 1;
  }
  // 아군 포위: 사방이 적이면 그 땅과 군단을 잃음
  for (const p of T.provs) {
    if (p.owner !== 'kr' || p.virtual) continue;
    const nb = lm[p.id] || []; if (nb.length < 2 || !nb.every(n => by[n].owner !== 'kr')) continue;
    for (const a of armyAt(T, p.id)) { a.str = 0; warLog(s, `💀 ${a.name}이(가) ${p.n}에서 포위돼 궤멸했습니다!`, 'bad'); }
    p.owner = s.war.k; clearEdges(T, p.id); T.kr.mp = clamp(T.kr.mp - 5, 25, 100);
    warLog(s, `🌀 ${p.n}이(가) 포위당해 함락됐습니다.`, 'bad'); warFx(T, { type: 'capture', side: 'en', name: `${p.n} 포위 함락`, vp: 6, c: p.c });
  }
  // 궤멸한 군단은 30일 뒤 수도에서 재편성
  for (const a of T.armies) if (a.str <= 0) { a.dead = (a.dead || 0) + 1; if (a.dead > 30) { const cap = T.provs.find(p => p.home === 'kr' && p.owner === 'kr' && p.vp >= 5) || T.provs.find(p => p.owner === 'kr'); if (cap) { a.str = 40; a.loc = cap.id; a.dead = 0; a.order = 'hold'; a.gen = genGeneral(); warLog(s, `🔁 ${a.name}이(가) 새 장군 ${a.gen.name} 아래 재편성됐습니다.`); } } }
}

/* ---------------- 플레이어 명령 ---------------- */
function armyOrder(s, aid, kind, pid) {
  const T = s.war?.theater, a = T?.armies?.find(x => x.id === aid); if (!a) return { ok: false, msg: '군단이 없습니다.' };
  if (a.str <= 0) return { ok: false, msg: '궤멸한 군단입니다. 재편성을 기다리세요.' };
  const by = Object.fromEntries(T.provs.map(p => [p.id, p])), lm = linkMap(T);
  if (kind === 'auto') { a.auto = !a.auto; return { ok: true, msg: `${a.name}: ${a.auto ? '🤖 자동 지휘' : '✋ 직접 지휘'}` }; }
  if (kind === 'hold') { a.auto = false; a.order = 'hold'; a.target = null; a.path = []; return { ok: true, msg: `${a.name}: 방어 태세` }; }
  const p = by[pid]; if (!p) return { ok: false, msg: '알 수 없는 지역입니다.' };
  if (p.owner !== 'kr') {
    if (!(lm[a.loc] || []).includes(pid)) return { ok: false, msg: `${a.name}이(가) 있는 ${by[a.loc].n}과(와) 맞닿은 적 지역만 공격할 수 있습니다. 먼저 전선으로 이동시키세요.` };
    a.auto = false; a.order = 'attack'; a.target = pid; a.path = [];
    maybeBattleCard(s, T, a, p);
    return { ok: true, msg: `⚔️ ${a.name} → ${p.n} 공격 개시!` };
  }
  if (pid === a.loc) return { ok: false, msg: '이미 그 자리에 있습니다.' };
  const path = armyPath(T, a.loc, pid); if (!path) return { ok: false, msg: '아군 땅으로 이어진 길이 없습니다.' };
  a.auto = false; a.order = 'move'; a.path = path; a.target = null; a.moveT = 0;
  return { ok: true, msg: `🚚 ${a.name} → ${p.n} 이동 (${path.length}개 지역, 약 ${path.length * (genMul(a.gen, 'speed') !== 1 ? 3 : 5)}일)` };
}
function shiftShare(s, from, to) {
  const T = s.war?.theater, A = T?.armies?.find(x => x.id === from), B = T?.armies?.find(x => x.id === to);
  if (!A || !B || A.share < 0.15) return { ok: false, msg: '더 뺄 병력이 없습니다.' };
  A.share -= 0.1; B.share += 0.1; B.str = Math.max(30, B.str - 5);
  return { ok: true, msg: `${A.name}의 병력 10%를 ${B.name}에 넘겼습니다.` };
}

/* ---------------- 전투 결정 카드 (큰 도시·험지) ---------------- */
const BATTLE_CHOICES = [
  { id: 'assault', name: '정면 돌격', icon: '💥', desc: '빠르게 밀어붙입니다. 돌파력 +40%, 사상자 +60%.', mod: { atk: 1.4, cas: 1.6, days: 20 } },
  { id: 'siege', name: '포위·고사 작전', icon: '🌀', desc: '천천히 조여 갑니다. 돌파력 -20%지만 20일 뒤 적 방어 -40%, 사상자 -40%.', mod: { atk: 0.8, cas: 0.6, days: 20, siege: true } },
  { id: 'bombard', name: '포격·공습 우선', icon: '✈️', desc: `국고 ₩1조. 적 조직력 -12, 돌파력 +20%.`, mod: { atk: 1.2, cas: 0.9, days: 15, cost: 10 } },
];
function maybeBattleCard(s, T, a, p) {
  if (!(p.vp >= 3 || p.terrain > 1 || p.fort > 1)) return;
  T.decided = T.decided || {}; if (T.decided[p.id]) return;
  T.decided[p.id] = true;
  T.pendingBattle = { pid: p.id, aid: a.id };
}
function applyBattle(s, choiceId) {
  const T = s.war?.theater, B = T?.pendingBattle; if (!B) return { ok: false };
  const C = BATTLE_CHOICES.find(x => x.id === choiceId) || BATTLE_CHOICES[1];
  if (C.mod.cost && s.pcap < C.mod.cost) return { ok: false, msg: `국고 ${won(C.mod.cost)}이(가) 필요합니다.` };
  if (C.mod.cost) { s.pcap -= C.mod.cost; T.en.org = clamp(T.en.org - 12, 5, 100); }
  T.pendingBattle = null;
  (T.bmods = T.bmods || {})[B.pid] = { ...C.mod, until: T.days + C.mod.days, start: T.days };
  const p = T.provs.find(x => x.id === B.pid);
  warLog(s, `${C.icon} ${p.n} 공방전: ${C.name}`);
  return { ok: true, msg: `${C.icon} ${p.n}: ${C.name}` };
}
// 전투 보정값 (돌격·포위·포격)
function battleMod(T, enId) {
  const m = T.bmods?.[enId]; if (!m) return { atk: 1, cas: 1, def: 1 };
  if (T.days > m.until && !m.siege) return { atk: 1, cas: 1, def: 1 };
  return { atk: T.days <= m.until ? m.atk : 1, cas: T.days <= m.until ? m.cas : 1, def: m.siege && T.days - m.start >= 20 ? 0.6 : 1 };
}
