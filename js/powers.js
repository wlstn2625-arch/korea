/* =========================================================
 *  대통령의 헌법상 권한
 *  - 긴급재정경제명령(헌법 제76조): 재정·경제 분야 법률을 국회를 거치지 않고 즉시 시행.
 *    다음 분기 국회 승인을 받지 못하면 효력을 잃음.
 *  - 국민투표 부의(헌법 제72조): 중요 정책을 국회 대신 국민에게 직접 물음.
 * ========================================================= */
const EMERGENCY_CATS = new Set(['tax', 'econ', 'labor', 'welfare', 'house', 'health', 'env']);

function canEmergency(s, p, opt) {
  if (!opt || opt.lt !== 'law') return '법률 사항에만 쓸 수 있습니다.';
  if (!EMERGENCY_CATS.has(p.cat)) return '긴급재정경제명령은 재정·경제 분야(세제·경제·노동·복지·부동산·의료·에너지)에만 쓸 수 있습니다.';
  if ((s.emergency || []).length >= 2) return '국회 승인을 기다리는 긴급명령이 이미 2건 있습니다.';
  return null;
}
function canReferendum(s, p, opt) {
  if (!opt || opt.lt !== 'law') return opt?.lt === 'const' ? '헌법 개정은 국회 의결(2/3)을 생략할 수 없습니다.' : '법률 사항에만 쓸 수 있습니다.';
  if ((s.referendumTurn ?? -99) >= s.turn - 3) return '국민투표는 1년(4분기)에 한 번만 부의할 수 있습니다.';
  return null;
}
const emergencyCost = (s, opt) => Math.round(policyCost(s, opt) * 1.5);
const referendumCost = (s, opt) => Math.round(policyCost(s, opt) * 1.3);
function referendumOdds(s, opt) {
  const sup = refendumSupport(s, opt) + (opt.lean === 'N' ? 3 : 0) + (wv(s) === 'con' && opt.lean === 'R' ? 2 : 0) + approvalDeltaFromFactions(opt.f || {}) * 0.5;
  return { sup, prob: normCdf((sup - 50) / 5) };
}

function emergencyDecree(s, pid, oid) {
  const p = policyById(pid, s), opt = optionOf(p, oid), old = currentOption(p, s);
  const why = canEmergency(s, p, opt); if (why) return { ok: false, msg: why };
  if (s.enactedThisTurn.includes(pid) || s.bills.some(b => b.pid === pid)) return { ok: false, msg: '이 분야는 이번 분기에 이미 손댔거나 국회 심의 중입니다.' };
  const cost = emergencyCost(s, opt); if (s.pcap < cost) return { ok: false, msg: `국고 ${won(cost)}이 필요합니다.` };
  s.pcap -= cost; s.enactedThisTurn.push(pid);
  applyPassed(s, p, opt, old);
  s.approval = clamp(s.approval - 2, 0, 100);
  s.factions.legal = clamp(s.factions.legal - 5, 0, 100);
  const opp = s.ruling === 'R' ? 'lib' : 'con'; s.factions[opp] = clamp(s.factions[opp] - 4, 0, 100);
  (s.emergency = s.emergency || []).push({ pid, oid, prevOid: old.id, turn: s.turn });
  addLog(s, 'info', `⚡ [${p.name}] 긴급재정경제명령으로 '${opt.label}' 즉시 시행. 다음 분기 국회 승인이 필요합니다.`);
  return { ok: true, passed: true, detail: '긴급재정경제명령 발동: 즉시 효력이 발생했습니다. 다음 분기에 국회 승인을 받지 못하면 효력을 잃습니다.' };
}

function referendumPolicy(s, pid, oid) {
  const p = policyById(pid, s), opt = optionOf(p, oid), old = currentOption(p, s);
  const why = canReferendum(s, p, opt); if (why) return { ok: false, msg: why };
  if (s.enactedThisTurn.includes(pid) || s.bills.some(b => b.pid === pid)) return { ok: false, msg: '이 분야는 이번 분기에 이미 손댔거나 국회 심의 중입니다.' };
  const cost = referendumCost(s, opt); if (s.pcap < cost) return { ok: false, msg: `국고 ${won(cost)}이 필요합니다.` };
  s.pcap -= cost; s.enactedThisTurn.push(pid); s.referendumTurn = s.turn;
  const { sup } = referendumOdds(s, opt);
  const result = clamp(sup + gauss() * 5, 5, 95);
  if (result > 50) {
    applyPassed(s, p, opt, old);
    s.approval = clamp(s.approval + 2, 0, 100);
    addLog(s, 'good', `🗳️ [${p.name}] 국민투표 가결 (찬성 ${result.toFixed(1)}%) → '${opt.label}' 시행.`);
    return { ok: true, passed: true, detail: `국민투표 찬성 ${result.toFixed(1)}%로 가결되었습니다. 국민의 직접 위임을 받아 시행합니다.` };
  }
  s.approval = clamp(s.approval - 4, 0, 100);
  addLog(s, 'bad', `🗳️ [${p.name}] 국민투표 부결 (찬성 ${result.toFixed(1)}%). 정치적 타격.`);
  return { ok: true, passed: false, detail: `국민투표 찬성 ${result.toFixed(1)}%로 부결되었습니다. 지지율이 하락했습니다.` };
}

// 긴급명령의 국회 승인 (다음 분기)
function emergencyTurn(s, report) {
  if (!s.emergency?.length) return;
  report.emergency = [];
  for (const em of [...s.emergency]) {
    if (em.turn >= s.turn) continue;
    s.emergency = s.emergency.filter(x => x !== em);
    const p = policyById(em.pid, s), opt = optionOf(p, em.oid), prev = optionOf(p, em.prevOid);
    if (!p || !opt || s.policies[em.pid] !== em.oid) continue;
    const prob = clamp(voteModel(s, opt).prob + 0.15, 0.05, 0.97);
    if (Math.random() < prob) {
      addLog(s, 'good', `🏛️ 국회가 긴급명령 '${opt.label}'을(를) 승인했습니다.`);
      report.emergency.push(`국회 승인: ${p.name} — ${opt.label}`);
    } else {
      applyPassed(s, p, prev, opt);
      s.approval = clamp(s.approval - 3, 0, 100);
      addLog(s, 'bad', `🏛️ 국회가 긴급명령 '${opt.label}' 승인을 거부했습니다. 효력을 잃고 '${prev.label}'(으)로 돌아갑니다.`);
      report.emergency.push(`국회 승인 거부: ${p.name} — ${opt.label} 효력 상실`);
    }
  }
}

HOOKS.migrate.push(s => { if (!s.emergency) s.emergency = []; if (!s.worldview) s.worldview = 'con'; });
HOOKS.preMacro.push(emergencyTurn);
