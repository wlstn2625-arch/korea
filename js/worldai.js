/* =========================================================
 *  살아 있는 세계: 각국 AI (2020년대 국제정치)
 *  - 지도자 성향에 따라 관세 전쟁·사이버 공격·국경 분쟁·전쟁·내전이 일어남
 *  - 강대국은 직접 참전보다 무기 지원(대리전), 서방은 침략국에 제재
 *  - 강제 병합은 드물고, 일어나면 세계 긴장도가 치솟고 국제 제재
 *  - 대한민국은 중재·인도적 지원·무기 지원·제재 동참·참전으로 개입 가능
 * ========================================================= */

const CONFLICT_TYPES = {
  trade:  { name: '관세 전쟁', icon: '💱' },
  cyber:  { name: '사이버 공격', icon: '💻' },
  border: { name: '국경 분쟁', icon: '🚧' },
  war:    { name: '전쟁', icon: '💥' },
  civil:  { name: '내전', icon: '🔥' },
};
// 현대 진영
const CAMPS = {
  west: { name: '미국 주도 동맹', color: '#3d7be0' },
  east: { name: '중·러 축', color: '#d1494f' },
  south: { name: '비동맹(글로벌 사우스)', color: '#b9a36a' },
};
const EAST_CAMP = new Set(['cn', 'ru', 'nk', 'irn', 'blr', 'syr', 'cub', 'ven', 'nic', 'kaz', 'kgz', 'tjk', 'uzb', 'lao', 'mmr', 'eri']);
const WEST_CAMP_EXTRA = new Set(['jp', 'tw', 'aus', 'nzl', 'phl', 'isr', 'ukr', 'kor', 'sgp']);
function campOf(s, k) {
  if (k === 'kr') return dip(s, 'us').alliance ? 'west' : s.rel.cn > 70 ? 'east' : 'south';
  if (s.world?.owner?.[k]) return campOf(s, s.world.owner[k]);
  const L = s.leaders?.[k];
  if (L?.traits.includes('proCN')) return 'east';
  if (L?.traits.includes('proUS')) return 'west';
  if (EAST_CAMP.has(k)) return 'east';
  if (NATO.has(k) || EU_MEMBERS.has(k) || WEST_CAMP_EXTRA.has(k)) return 'west';
  return 'south';
}

/* ---------------- 공통 ---------------- */
function worldNews(s, text, type = 'info') {
  s.world.news.unshift({ turn: s.turn, text, type });
  if (s.world.news.length > 120) s.world.news.length = 120;
  (s.world.turnNews = s.world.turnNews || []).push({ text, type });
}
const ownerOf = (s, k) => s.world?.owner?.[k] || null;
const alive = (s, k) => !s.annexed[k] && !ownerOf(s, k) && !!s.leaders?.[k];
function power(s, k) {
  let p = cinfo(k).mil;
  for (const [o, by] of Object.entries(s.world?.owner || {})) if (by === k) p += cinfo(o).mil * 0.4;
  const civil = s.world?.conflicts.find(c => c.type === 'civil' && c.a === k);
  return civil ? p * 0.6 : p;
}
let _neighbors = null;
function neighborsOf(k) {
  if (!_neighbors) {
    _neighbors = {};
    const ks = Object.keys(MAP_DATA.countries).filter(x => x !== 'kr');
    for (const a of ks) _neighbors[a] = [];
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const A = MAP_DATA.countries[ks[i]], B = MAP_DATA.countries[ks[j]];
      const lim = 900 + (Math.sqrt(A.a) + Math.sqrt(B.a)) * 55; // 큰 나라일수록 국경이 먼 곳까지
      if (kmBetween(A.ll, B.ll) < lim) { _neighbors[ks[i]].push(ks[j]); _neighbors[ks[j]].push(ks[i]); }
    }
  }
  return _neighbors[k] || [];
}
const inConflict = (s, k, type) => s.world.conflicts.some(c => (c.a === k || c.b === k) && (!type || c.type === type));
const weightedPick = arr => { let r = Math.random() * arr.reduce((a, x) => a + x.w, 0); return arr.find(x => (r -= x.w) <= 0) || arr[0]; };

/* ---------------- 분쟁 생성 ---------------- */
function maybeStartConflicts(s, report) {
  const W = s.world, T = W.tension / 100;
  const keys = Object.keys(s.leaders).filter(k => alive(s, k));
  // 1) 관세 전쟁: 경제 대국끼리, 진영이 다르고 민족주의·강경파 지도자
  if (Math.random() < 0.18 + T * 0.12) {
    const big = keys.filter(k => cinfo(k).eco >= 70);
    const a = big[Math.floor(Math.random() * big.length)];
    const cands = big.filter(b => b !== a && campOf(s, a) !== campOf(s, b) && !W.conflicts.some(c => c.type === 'trade' && [c.a, c.b].includes(a) && [c.a, c.b].includes(b)));
    if (a && cands.length && (hasTrait(s, a, 'nationalist') || hasTrait(s, a, 'hardliner') || Math.random() < 0.3)) {
      const b = cands[Math.floor(Math.random() * cands.length)];
      addConflict(s, 'trade', a, b, `${cname(a)}이(가) ${cname(b)} 수입품에 고율 관세를 부과했습니다. 보복 관세가 이어집니다.`);
    }
  }
  // 2) 사이버 공격: 권위·공산·신정 강경 지도자가 민주국가를
  for (const a of keys) {
    const L = s.leaders[a]; if (L.gov === 'dem' || !(L.traits.includes('hardliner') || L.traits.includes('aggressive'))) continue;
    if (Math.random() < 0.008 + T * 0.01) {
      const targets = keys.filter(b => b !== a && s.leaders[b].gov === 'dem' && campOf(s, b) !== campOf(s, a) && cinfo(b).eco >= 30);
      if (Math.random() < 0.18 && campOf(s, a) !== campOf(s, 'kr') && relOf(s, a) < 45) { koreaCyber(s, a); continue; }
      const b = targets[Math.floor(Math.random() * targets.length)];
      if (b) addConflict(s, 'cyber', a, b, `${cname(a)} 연계 해커 조직이 ${cname(b)}의 전력망·금융망을 공격했습니다.`);
    }
  }
  // 3) 국경 분쟁 → 전쟁: 공격적 지도자가 약한 이웃을
  for (const a of keys) {
    const agg = leaderAgg(s, a); if (agg < 45 || inConflict(s, a, 'war') || cinfo(a).mil < 15) continue;
    if (Math.random() > (agg - 40) / 100 * (0.04 + T * 0.06)) continue;
    const opp = hasTrait(s, a, 'opportunist');
    const targets = neighborsOf(a).filter(b => alive(s, b) && b !== 'kr' && campOf(s, b) !== campOf(s, a) || (alive(s, b) && opp && inConflict(s, b)))
      .filter(b => alive(s, b) && power(s, b) < power(s, a) * 0.9 && !(NUKES.has(b) && !NUKES.has(a)))
      .map(b => ({ b, w: 1 + (s.leaders[b].gov !== s.leaders[a].gov ? 1 : 0) + (inConflict(s, b) ? 1 : 0) }));
    if (!targets.length) continue;
    const { b } = weightedPick(targets);
    if (W.conflicts.some(c => [c.a, c.b].includes(a) && [c.a, c.b].includes(b) && c.type === 'border')) {
      // 이미 국경 분쟁 중이면 전면전으로 비화
      if (agg >= 55) startAiWar(s, a, b);
    } else addConflict(s, 'border', a, b, `${cname(a)}과(와) ${cname(b)} 국경에서 무력 충돌이 발생했습니다.`);
  }
  // 4) 내전: 군사정권·권위주의, 무작위
  for (const a of keys) {
    const L = s.leaders[a]; if (!['junta', 'auth', 'theo'].includes(L.gov) || inConflict(s, a, 'civil')) continue;
    if (Math.random() < (L.gov === 'junta' ? 0.008 : 0.0022) * (1 + T)) addConflict(s, 'civil', a, a, `${cname(a)}에서 반정부 무장 세력이 봉기해 내전으로 번졌습니다. 난민이 쏟아지고 있습니다.`);
  }
}
function addConflict(s, type, a, b, text) {
  const c = { id: uid(), type, a, b, score: 0, turns: 0, since: s.turn, supportA: [], supportB: [], krRole: null };
  s.world.conflicts.push(c);
  s.world.tension = clamp(s.world.tension + { trade: 3, cyber: 1, border: 3, war: 10, civil: 2 }[type], 0, 100);
  worldNews(s, `${CONFLICT_TYPES[type].icon} ${text}`, type === 'trade' || type === 'cyber' ? 'info' : 'bad');
  return c;
}
function startAiWar(s, a, b) {
  const W = s.world;
  W.conflicts = W.conflicts.filter(c => !(c.type === 'border' && [c.a, c.b].includes(a) && [c.a, c.b].includes(b)));
  const c = addConflict(s, 'war', a, b, `${cname(a)}이(가) ${cname(b)}을(를) 전면 침공했습니다. ${s.leaders[a].title} ${s.leaders[a].name}: "역사적 영토를 되찾겠다."`);
  // 대리전: 같은 진영 강대국이 무기 지원 (직접 참전은 하지 않음)
  for (const p of ['us', 'cn', 'ru', 'gbr', 'fra', 'deu', 'tur', 'ind']) {
    if (!alive(s, p) || p === a || p === b || hasTrait(s, p, 'isolationist')) continue;
    if (campOf(s, p) === campOf(s, b) && campOf(s, p) !== campOf(s, a)) c.supportB.push(p);
    else if (campOf(s, p) === campOf(s, a) && campOf(s, p) !== campOf(s, b) && Math.random() < 0.5) c.supportA.push(p);
  }
  if (c.supportB.length) worldNews(s, `🚚 ${c.supportB.map(cname).join('·')}이(가) ${cname(b)}에 무기를 지원하기로 했습니다.`);
  if (campOf(s, b) === 'west' || campOf(s, a) === 'east') worldNews(s, `🚫 미국 주도 동맹이 ${cname(a)}에 대한 대규모 경제 제재를 발표했습니다.`);
  // 우리 동맹국이 침공당하면 알림
  if (dip(s, b).alliance) worldNews(s, `⚠️ 대한민국의 동맹국 ${cname(b)}이(가) 침공당했습니다. 참전 여부를 결정해야 합니다.`, 'bad');
  return c;
}

/* ---------------- 분쟁 진행 ---------------- */
function progressConflicts(s, report) {
  const W = s.world;
  for (const c of [...W.conflicts]) {
    c.turns++;
    if (c.type === 'trade') {
      if (c.turns >= 4 && Math.random() < 0.3) endConflict(s, c, `💱 ${cname(c.a)}·${cname(c.b)} 관세 전쟁이 협상으로 일단락되었습니다.`);
      continue;
    }
    if (c.type === 'cyber') { if (c.turns >= 1) endConflict(s, c, null); continue; }
    if (c.type === 'border') {
      // 공격적인 쪽이 강하면 전면전으로 비화
      if (leaderAgg(s, c.a) >= 50 && power(s, c.a) > power(s, c.b) && Math.random() < 0.22 + s.world.tension / 400) { startAiWar(s, c.a, c.b); continue; }
      if (c.turns >= 2 && Math.random() < 0.45) endConflict(s, c, `🚧 ${cname(c.a)}·${cname(c.b)} 국경 분쟁이 휴전으로 진정되었습니다.`);
      continue;
    }
    if (c.type === 'civil') {
      c.score += gauss() * 25;
      if (Math.abs(c.score) >= 70 || c.turns >= 10) {
        if (c.score <= -70) { replaceLeader(s, c.a, '내전 끝에 정권 붕괴', Math.random() < 0.4 ? 'dem' : 'junta'); endConflict(s, c, null); }
        else endConflict(s, c, `🔥 ${cname(c.a)} 내전이 ${c.score >= 70 ? '정부군 승리' : '평화협정'}로 끝났습니다.`);
      }
      continue;
    }
    // 전쟁
    const pa = power(s, c.a) + c.supportA.reduce((x, p) => x + cinfo(p).mil * 0.25, 0) + (c.krRole === 'armsA' ? 10 : 0);
    const pb = power(s, c.b) + c.supportB.reduce((x, p) => x + cinfo(p).mil * 0.25, 0) + (c.krRole === 'armsB' ? 10 : 0);
    c.score = clamp(c.score + (pa - pb) / (pa + pb) * 40 + gauss() * 14, -100, 100);
    // 현대전: 장기화되면 휴전 압력
    const ceasefire = c.turns >= 4 && Math.random() < 0.08 + (c.turns - 4) * 0.04 + (hasTrait(s, c.a, 'pacifist') ? 0.2 : 0);
    if (c.score >= 100) {
      if (hasTrait(s, c.a, 'expansionist') || Math.random() < 0.25) {
        W.owner[c.b] = c.a; W.tension = clamp(W.tension + 15, 0, 100);
        endConflict(s, c, `🚩 ${cname(c.a)}이(가) ${cname(c.b)}을(를) 강제 병합했다고 선언했습니다. 유엔 총회는 규탄 결의를 채택했습니다.`, 'bad');
        for (const p of ['us', 'eu', 'jp']) if (campOf(s, c.a) !== 'west') relBump(s, p, 0, 0);
      } else {
        endConflict(s, c, `🏳️ ${cname(c.b)}이(가) 영토 일부를 내주는 조건으로 ${cname(c.a)}과(와) 휴전했습니다.`, 'bad');
      }
    } else if (c.score <= -100) {
      endConflict(s, c, `🛡️ ${cname(c.b)}이(가) 침공을 격퇴했습니다. ${cname(c.a)}의 ${s.leaders[c.a].title} 리더십이 흔들립니다.`, 'good');
      if (Math.random() < 0.5) replaceLeader(s, c.a, '패전 책임으로 실각');
    } else if (ceasefire) {
      endConflict(s, c, `🕊️ ${cname(c.a)}·${cname(c.b)} 전쟁이 국제 중재로 휴전에 들어갔습니다. (전선 ${c.score >= 0 ? cname(c.a) + ' 우세' : cname(c.b) + ' 우세'})`);
    }
  }
}
function endConflict(s, c, text, type = 'info') {
  s.world.conflicts = s.world.conflicts.filter(x => x !== c);
  if (text) worldNews(s, text, type);
  s.world.tension = clamp(s.world.tension - { trade: 2, cyber: 0, border: 2, war: 5, civil: 1 }[c.type], 0, 100);
}

/* ---------------- 대한민국을 향한 AI 행동 ---------------- */
function koreaCyber(s, a) {
  worldNews(s, `💻 ${cname(a)} 연계 해커 조직이 한국 금융망·공공기관을 공격했습니다.`, 'bad');
  s.world.pendingCrises.push({ tpl: 'security', title: `${cname(a)} 배후 대규모 사이버 공격`, desc: `${cname(a)}과(와) 연계된 해커 조직이 국내 은행·병원·공공기관 전산망을 마비시켰습니다.`, sev: 2, relTarget: a });
}
function aiTowardKorea(s) {
  for (const k of Object.keys(s.leaders)) {
    if (!alive(s, k)) continue;
    const r = relOf(s, k), agg = leaderAgg(s, k), c = cinfo(k);
    // 적대적이고 강하고 가까운 나라: 무력 도발 → 드물게 침공
    if (r < 15 && agg >= 50 && c.km < 3000 && !s.war) {
      if (Math.random() < 0.05) {
        s.world.pendingCrises.push({ tpl: 'security', title: `${cname(k)}의 무력 시위`, desc: `${cname(k)}이(가) 우리 영해·영공 인근에서 대규모 군사훈련과 무력 시위를 벌였습니다.`, sev: 2, relTarget: k });
        worldNews(s, `⚠️ ${cname(k)}이(가) 한국 인근에서 무력 시위`, 'bad');
      } else if (power(s, k) > milPower(s) * 1.2 && Math.random() < 0.012 && k !== 'nk') {
        worldNews(s, `💥 ${cname(k)}이(가) 대한민국에 선전포고했습니다!`, 'bad');
        startWar(s, k, 'them', 'concession');
      }
    }
    // 강경 지도자의 요구
    if (r < 35 && hasTrait(s, k, 'hardliner') && Math.random() < 0.015) {
      s.world.pendingCrises.push({ tpl: 'diplomacy', title: `${cname(k)} ${s.leaders[k].title}의 공개 요구`, desc: `${s.leaders[k].name} ${s.leaders[k].title}이(가) 한국에 무역 보복 철회와 사과를 공개적으로 요구했습니다. 거부하면 보복하겠다고 경고했습니다.`, sev: 1, relTarget: k });
    }
    // 우호적인 지도자의 제안
    if (r >= 72 && !dip(s, k).alliance && hasTrait(s, k, 'koreaFriend') && Math.random() < 0.02) {
      dip(s, k).allyOffer = s.turn + 2;
      worldNews(s, `🤝 ${cname(k)}의 ${s.leaders[k].title} ${s.leaders[k].name}이(가) 한국과의 안보 협력 강화를 제안했습니다. (2분기 동안 동맹 비용 절반)`, 'good');
    }
  }
}

/* ---------------- 분쟁이 우리 경제에 주는 영향 ---------------- */
function conflictSpillover(s) {
  const W = s.world;
  const mideast = W.conflicts.some(c => ['war', 'civil'].includes(c.type) && ['서아시아·중동', '북아프리카'].includes(cinfo(c.a)?.sub));
  const usCnTrade = W.conflicts.some(c => c.type === 'trade' && ['us', 'cn'].includes(c.a) && ['us', 'cn'].includes(c.b));
  const anyWar = W.conflicts.filter(c => c.type === 'war').length;
  s.sectorShock = s.sectorShock || {};
  if (mideast) { s.stats.infl += 0.12; s.sectorShock.heavy = (s.sectorShock.heavy || 0) - 0.5; }
  if (usCnTrade) { s.sectorShock.semi = (s.sectorShock.semi || 0) - 0.8; s.sectorShock.auto = (s.sectorShock.auto || 0) - 0.4; }
  if (anyWar) s.sectorShock.ship = (s.sectorShock.ship || 0) + 0.5 * anyWar; // 방산 수요
  if (W.tension > 65) { s.stats.security -= 0.3; s.stats.gdp -= 0.05; s.factions.mil = clamp(s.factions.mil + 1, 0, 100); }
  W.tension = clamp(W.tension + (35 - W.tension) * 0.12 + gauss() * 0.8, 0, 100); // 평시에는 기준선(35)으로 서서히 복귀
}

/* ---------------- 우리가 할 수 있는 개입 ---------------- */
const INTERVENTIONS = [
  { id: 'mediate', name: '중재', icon: '🕊️', pc: 20, desc: '양측과 관계 50 이상이면 성공 확률이 높습니다. 성공 시 휴전, 세계 긴장도 하락, 국제적 위상 상승.', types: ['war', 'border', 'trade', 'civil'] },
  { id: 'aid', name: '인도적 지원', icon: '🏥', pc: 8, desc: '피해국 관계 +8, 지지율 소폭 상승, 재정 -0.1%p.', types: ['war', 'civil', 'border'] },
  { id: 'armsB', name: '피침국 무기 지원', icon: '🚚', pc: 15, desc: '피침국 관계 +12, 침략국 관계 -20. 방산 수출 증가. 전황에 영향.', types: ['war'] },
  { id: 'sanction', name: '침략국 제재 동참', icon: '🚫', pc: 10, desc: '침략국 관계 -15, 서방 관계 +4, 우리 경제 소폭 부담.', types: ['war'] },
  { id: 'join', name: '참전', icon: '⚔️', pc: 30, desc: '피침국 편에서 직접 참전합니다. 동맹국이 침공당했으면 국제 반발이 없습니다.', types: ['war'] },
];
function intervene(s, cid, act) {
  const c = s.world.conflicts.find(x => x.id === cid); if (!c) return { ok: false, msg: '이미 끝난 분쟁입니다.' };
  const a = INTERVENTIONS.find(x => x.id === act);
  if (s.pcap < a.pc) return { ok: false, msg: `정치자본 ⚡${a.pc}이 필요합니다.` };
  if (c.krDone?.includes(act)) return { ok: false, msg: '이미 실행했습니다.' };
  s.pcap -= a.pc; (c.krDone = c.krDone || []).push(act);
  let msg;
  if (act === 'mediate') {
    const p = clamp(0.25 + (Math.min(relOf(s, c.a), relOf(s, c.b)) - 50) / 80 + (s.world.tension < 50 ? 0.1 : 0), 0.05, 0.85);
    if (Math.random() < p) { endConflict(s, c, null); s.world.tension = clamp(s.world.tension - 6, 0, 100); relBump(s, c.a, 5, 3); if (c.b !== c.a) relBump(s, c.b, 5, 3); s.approval = clamp(s.approval + 2, 0, 100); s.scoreBonus = (s.scoreBonus || 0) + 1; msg = `🕊️ 대한민국의 중재로 ${cname(c.a)}${c.b !== c.a ? '·' + cname(c.b) : ''} ${CONFLICT_TYPES[c.type].name}이(가) 멈췄습니다!`; worldNews(s, msg, 'good'); }
    else msg = `중재 시도가 실패했습니다. (성공 확률 ${Math.round(p * 100)}%)`;
  } else if (act === 'aid') {
    relBump(s, c.b, 8, 4); s.stats.fiscal -= 0.1; s.approval = clamp(s.approval + 0.5, 0, 100); s.factions.lib = clamp(s.factions.lib + 2, 0, 100); msg = `${cname(c.b)}에 긴급 인도적 지원을 보냈습니다.`;
  } else if (act === 'armsB') {
    c.krRole = 'armsB'; relBump(s, c.b, 12, 6); relBump(s, c.a, -20, -12); s.sectorShock = s.sectorShock || {}; s.sectorShock.ship = (s.sectorShock.ship || 0) + 3; s.factions.mil = clamp(s.factions.mil + 4, 0, 100); s.factions.lib = clamp(s.factions.lib - 3, 0, 100);
    msg = `${cname(c.b)}에 무기를 지원했습니다. ${cname(c.a)}이(가) 강하게 반발합니다.`;
  } else if (act === 'sanction') {
    dip(s, c.a).sanction = true; relBump(s, c.a, -15, -10); relBump(s, 'us', 3, 2); relBump(s, 'eu', 3, 2); s.mods.gdp -= 0.02 * cinfo(c.a).eco / 50; msg = `${cname(c.a)}에 대한 국제 제재에 동참했습니다.`;
  } else if (act === 'join') {
    if (s.war) { s.pcap += a.pc; return { ok: false, msg: '이미 다른 전쟁 중입니다.' }; }
    const ally = dip(s, c.b).alliance;
    s.world.conflicts = s.world.conflicts.filter(x => x !== c);
    startWar(s, c.a, ally ? 'them' : 'kr', 'concession');
    s.war.allies = [...new Set([...s.war.allies, c.b, ...c.supportB])];
    s.war.score = clamp(-c.score * 0.5, -60, 60);
    msg = `${cname(c.b)} 편에서 ${cname(c.a)}과(와)의 전쟁에 참전했습니다.`;
  }
  addLog(s, 'info', `${a.icon} ${msg}`);
  return { ok: true, msg };
}

/* ---------------- 분기 처리 ---------------- */
function worldAiTurn(s, report) {
  s.world.turnNews = [];
  maybeStartConflicts(s, report);
  progressConflicts(s, report);
  aiTowardKorea(s);
  conflictSpillover(s);
  // 가끔 열리는 정상회의
  if (s.turn % 4 === 3) worldNews(s, `🌐 G20 정상회의 개최 — 세계 긴장도 ${s.world.tension.toFixed(0)}, 진행 중인 분쟁 ${s.world.conflicts.filter(c => c.type !== 'cyber').length}건이 의제로 올랐습니다.`);
  report.worldNews = s.world.turnNews;
}
function worldAiEvents(s, report, newCrises) {
  for (const p of s.world.pendingCrises) newCrises.push(makeCrisis(s, p));
  s.world.pendingCrises = [];
}

HOOKS.migrate.push(s => {
  if (!s.world) s.world = { tension: 35, conflicts: [], owner: {}, news: [], pendingCrises: [] };
  if (!s.world.pendingCrises) s.world.pendingCrises = [];
});
HOOKS.postMacro.push(worldAiTurn);
HOOKS.events.push(worldAiEvents);
