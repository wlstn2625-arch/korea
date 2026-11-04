/* =========================================================
 *  정치 시스템: 국회 법안 심의 + 이익집단 영향력·국정 연합
 * ========================================================= */

/* ---------------- 이익집단 영향력 ---------------- */
// 기본 영향력(합 100). 경제·제도 변화에 따라 매 분기 다시 계산
const CLOUT_BASE = { biz: 18, labor: 12, youth: 8, elder: 12, con: 10, lib: 10, mil: 6, legal: 6, teach: 5, medic: 5, farm: 4, local: 4 };
// 함께 연합하면 마찰이 생기는 조합
const RIVALS = [['con', 'lib'], ['biz', 'labor'], ['youth', 'elder'], ['medic', 'local']];
const INITIAL_COALITION = { lib: ['lib', 'labor', 'youth', 'teach'], con: ['con', 'biz', 'elder', 'mil'], ind: ['youth', 'local'] };

// 세력 이름에 맞는 조사(이/가)
const iga = w => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이' : '가'; };

function computeClout(s) {
  const st = s.stats, pol = s.policies, c = { ...CLOUT_BASE };
  c.biz += (st.innovation - 72) * 0.15 + (st.gdp - 1.8) * 1.5 + (pol.chaebol === 'loosen' ? 3 : pol.chaebol === 'tighten' ? -3 : 0);
  c.labor += (pol.labor_union === 'repeal' || pol.labor_union === 'flex_fire' ? -4 : 0) + (pol.platform === 'worker' ? 2 : 0) - (st.unemp - 2.8) * 0.8;
  c.elder += s.turn * 0.12;            // 고령화로 노년층 영향력 증가
  c.youth += -s.turn * 0.05 + (pol.vote_age === 'a16' ? 2 : 0);
  c.mil += (st.security - 68) * 0.1 + (s.war ? 4 : 0);
  c.legal += pol.prosecution === 'restore' ? 3 : pol.prosecution === 'jury' ? -2 : 0;
  c.medic += pol.med_school === 'cur' ? 1 : -1;
  c.farm += -s.turn * 0.04 + (pol.trade === 'cptpp' ? -1 : 0);
  c.local += pol.decentral === 'federal' ? 4 : pol.decentral === 'megacity' ? 2 : 0;
  for (const k in c) c[k] = Math.max(1, c[k]);
  const sum = Object.values(c).reduce((a, b) => a + b, 0);
  for (const k in c) c[k] = (c[k] / sum) * 100;
  return c;
}

function legitimacy(s) { return (s.coalition || []).reduce((a, k) => a + (s.clout?.[k] || 0), 0); }
function coalitionFriction(s) {
  const co = new Set(s.coalition || []);
  return RIVALS.filter(([a, b]) => co.has(a) && co.has(b));
}

// 연합 세력이 법안에 찬성/반대하면 국회 표결에 압력이 됨 (의석 환산)
function coalitionSeatBonus(s, opt) {
  let b = 0;
  for (const k of (s.coalition || [])) b += clamp(opt.f?.[k] || 0, -15, 15) * (s.clout?.[k] || 0) * 0.04;
  return clamp(b, -25, 25);
}

function joinCost(s, k) { return Math.round(15 + (s.clout?.[k] || 5) * 1.2); }
function canJoin(s, k) {
  if ((s.coalition || []).includes(k)) return { ok: false, why: '이미 연합에 있습니다.' };
  if ((s.coalition || []).length >= 6) return { ok: false, why: '연합은 최대 6개 세력까지입니다.' };
  if (s.factions[k] < 42) return { ok: false, why: `지지도가 42 이상이어야 합니다. (현재 ${s.factions[k].toFixed(0)})` };
  if (s.pcap < joinCost(s, k)) return { ok: false, why: `정치자본 ⚡${joinCost(s, k)}이 필요합니다.` };
  return { ok: true };
}
function joinCoalition(s, k) {
  const c = canJoin(s, k); if (!c.ok) return c;
  s.pcap -= joinCost(s, k); s.coalition.push(k);
  s.factions[k] = clamp(s.factions[k] + 8, 0, 100);
  for (const [a, b] of RIVALS) { const r = a === k ? b : b === k ? a : null; if (r) s.factions[r] = clamp(s.factions[r] - 6, 0, 100); }
  addLog(s, 'good', `🤝 ${FACTIONS[k].name}${iga(FACTIONS[k].name)} 국정 연합에 합류했습니다.`);
  return { ok: true };
}
function leaveCoalition(s, k, forced = false) {
  s.coalition = s.coalition.filter(x => x !== k);
  s.factions[k] = clamp(s.factions[k] - (forced ? 4 : 10), 0, 100);
  addLog(s, 'bad', forced ? `💔 ${FACTIONS[k].name}${iga(FACTIONS[k].name)} 불만을 품고 국정 연합에서 이탈했습니다.` : `👋 ${FACTIONS[k].name}${iga(FACTIONS[k].name)} 국정 연합에서 빠졌습니다.`);
}

/* ---------------- 국회 법안 심의 ---------------- */
const BILL_STAGES = {
  law: [[0, '소관 상임위원회 심사'], [40, '법제사법위원회 체계·자구 심사'], [75, '본회의 상정 대기']],
  const: [[0, '개헌안 발의·공고'], [30, '개헌특위 심사'], [70, '본회의 의결 대기(2/3)']],
};
function billStage(b) { const st = BILL_STAGES[b.lt]; let name = st[0][1]; for (const [t, n] of st) if (b.progress >= t) name = n; return name; }
function billSpeed(s, b) {
  const p = policyById(b.pid, s), o = optionOf(p, b.oid);
  const prob = voteModel(s, o, b.lobby).prob;
  const base = b.lt === 'const' ? 14 : 24;
  return base + prob * (b.lt === 'const' ? 26 : 36) + (b.fast ? 15 : 0);
}
function estimateBillTurns(s, o, lobby = 0) {
  const fake = { lt: o.lt, lobby, progress: 0 };
  const prob = voteModel(s, o, lobby).prob;
  const sp = (o.lt === 'const' ? 14 : 24) + prob * (o.lt === 'const' ? 26 : 36);
  return Math.max(1, Math.ceil(100 / sp));
}

function proposeBill(s, p, opt, old, lobby, cost) {
  s.pcap -= cost;
  const b = { id: uid(), pid: p.id, oid: opt.id, prevOid: old.id, lt: opt.lt, lobby, cost, progress: 0, turns: 0, fast: false, stalled: 0, log: [] };
  s.bills.push(b);
  const t = estimateBillTurns(s, opt, lobby);
  addLog(s, 'info', `📨 [${p.name}] '${opt.label}' ${opt.lt === 'const' ? '개헌안' : '법안'}을 국회에 제출했습니다. (예상 심의 ${t}분기)`);
  return { ok: true, passed: null, bill: true, detail: `국회에 제출되었습니다. ${billStage(b)} 단계부터 심의가 시작되며, 예상 심의 기간은 약 ${t}분기입니다.`, p, opt };
}

const BILL_EVENTS = [
  { w: 3, t: '여야 합의로 심사 속도', d: +18, good: true },
  { w: 2, t: '상임위 공청회에서 찬성 여론 확산', d: +12, good: true },
  { w: 3, t: '여야 대치로 회의 공전', d: -15 },
  { w: 2, t: '야당 필리버스터(무제한 토론)', d: -22, needOpp: true },
  { w: 2, t: '이익집단 로비로 수정 요구 빗발', d: -10, lobby: true },
];

function billsTurn(s, report) {
  report.bills = [];
  for (const b of [...s.bills]) {
    const p = policyById(b.pid, s), o = optionOf(p, b.oid), old = optionOf(p, b.prevOid) || currentOption(p, s);
    if (!p || !o) { s.bills = s.bills.filter(x => x !== b); continue; }
    b.turns++;
    let delta = billSpeed(s, b), ev = null;
    if (Math.random() < 0.35) {
      const opp = 300 - (s.ruling === 'P' ? s.seats.P : s.seats[s.ruling]);
      const pool = BILL_EVENTS.filter(e => !e.needOpp || opp >= 150);
      let r = Math.random() * pool.reduce((a, e) => a + e.w, 0);
      ev = pool.find(e => (r -= e.w) <= 0) || pool[0];
      delta += ev.d;
      if (ev.lobby) { // 손해 보는 세력이 로비
        const loser = Object.entries(o.f || {}).sort((a, c) => a[1] - c[1])[0];
        if (loser) ev = { ...ev, t: `${FACTIONS[loser[0]]?.name || '이해관계자'}의 반대 로비로 수정 요구 빗발` };
      }
      b.log.push(`${turnLabel(s.turn).year}.${turnLabel(s.turn).q}Q ${ev.t}`);
    }
    b.progress = clamp(b.progress + Math.max(0, delta), 0, 100);
    const line = { name: p.name, label: o.label, progress: b.progress, stage: billStage(b), ev: ev && ev.t, good: ev && ev.good };
    if (b.progress >= 100) {
      const r = finalVote(s, p, o, old, b.lobby, b.cost, true);
      line.result = r.passed ? 'passed' : 'failed'; line.detail = r.detail;
      if (r.passed) report.enacted = report.enacted || [];
      s.bills = s.bills.filter(x => x !== b);
    } else if (b.turns >= (b.lt === 'const' ? 10 : 8)) {
      line.result = 'expired';
      addLog(s, 'bad', `🗑️ [${p.name}] '${o.label}' 법안이 장기 계류 끝에 폐기되었습니다.`);
      s.bills = s.bills.filter(x => x !== b);
    }
    report.bills.push(line);
  }
}

// 법안 조작
function billAction(s, billId, act) {
  const b = s.bills.find(x => x.id === billId); if (!b) return { ok: false, msg: '법안을 찾을 수 없습니다.' };
  const p = policyById(b.pid, s), o = optionOf(p, b.oid);
  if (act === 'lobby') {
    if (b.lobby >= 3) return { ok: false, msg: '협상은 3단계가 최대입니다.' };
    if (s.pcap < LOBBY_COST) return { ok: false, msg: `정치자본 ⚡${LOBBY_COST}이 필요합니다.` };
    s.pcap -= LOBBY_COST; b.lobby++;
    addLog(s, 'info', `🤝 [${p.name}] 야당과 협상 ${b.lobby}단계 진행.`);
  } else if (act === 'fast') {
    if (b.fast) return { ok: false, msg: '이미 신속처리 안건입니다.' };
    if (s.pcap < 20) return { ok: false, msg: '정치자본 ⚡20이 필요합니다.' };
    s.pcap -= 20; b.fast = true; b.progress = clamp(b.progress + 15, 0, 99);
    s.factions.con = clamp(s.factions.con - (s.ruling === 'L' ? 3 : 0), 0, 100); s.factions.lib = clamp(s.factions.lib - (s.ruling === 'R' ? 3 : 0), 0, 100);
    addLog(s, 'info', `⏩ [${p.name}] 신속처리안건(패스트트랙)으로 지정했습니다. 야당 반발.`);
  } else if (act === 'withdraw') {
    s.bills = s.bills.filter(x => x !== b);
    s.pcap += Math.floor(b.cost / 3);
    s.approval = clamp(s.approval - 0.5, 0, 100);
    addLog(s, 'info', `↩️ [${p.name}] '${o.label}' 법안을 철회했습니다.`);
  }
  return { ok: true };
}

/* ---------------- 분기 처리 ---------------- */
function politicsTurn(s, report) {
  s.clout = computeClout(s);
  const L = legitimacy(s), fr = coalitionFriction(s);
  // 정당성(연합 영향력 합)과 내부 마찰이 정치자본 회복에 반영
  let bonus = (L - 40) * 0.25 - fr.length * 3;
  // 충성 세력: 연합 내 지지도 70+ → 보너스
  for (const k of s.coalition) if (s.factions[k] >= 70) bonus += 1.5;
  s.pcapBonus = bonus;
  report.politics = { legitimacy: L, friction: fr.map(([a, b]) => `${FACTIONS[a].name}↔${FACTIONS[b].name}`), left: [], radical: [] };
  // 연합 내 불만 세력 이탈
  for (const k of [...s.coalition]) {
    if (s.factions[k] < 30 && Math.random() < 0.4) { leaveCoalition(s, k, true); report.politics.left.push(FACTIONS[k].name); s.approval = clamp(s.approval - 2, 0, 100); }
  }
  // 급진화: 지지도 20 미만이고 영향력 있는 세력은 집단 행동
  s.radical = Object.keys(FACTIONS).filter(k => s.factions[k] < 20 && s.clout[k] >= 6);
  report.politics.radical = s.radical.map(k => FACTIONS[k].name);
}
function radicalEvents(s, report, newCrises) {
  for (const k of (s.radical || [])) {
    if (Math.random() < 0.3) newCrises.push(makeCrisis(s, { tpl: 'protest', title: `${FACTIONS[k].name} 급진화: 대정부 투쟁`, desc: `지지도가 바닥난 ${FACTIONS[k].name}${iga(FACTIONS[k].name)} 대규모 집회와 집단행동에 나섰습니다. 영향력 ${s.clout[k].toFixed(0)}%의 세력입니다.`, sev: s.clout[k] >= 12 ? 3 : 2, facTarget: k }));
  }
}

HOOKS.migrate.push(s => {
  if (!s.bills) s.bills = [];
  if (!s.coalition) s.coalition = [...(INITIAL_COALITION[s.party] || [])];
  if (!s.clout) s.clout = computeClout(s);
});
HOOKS.preMacro.push(billsTurn);
HOOKS.postMacro.push(politicsTurn);
HOOKS.events.push(radicalEvents);
