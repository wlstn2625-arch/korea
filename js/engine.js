/* =========================================================
 *  새로운 대한민국 — 시뮬레이션 엔진 + 규칙 기반 AI 판단
 * ========================================================= */

const START_YEAR = 2026, START_Q = 4, TERM_TURNS = 20;
const GENERAL_ELECTION_TURN = 6;  // 2028년 2분기 총선
const LOCAL_ELECTION_TURN = 14;   // 2030년 2분기 지방선거

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const uid = () => Math.random().toString(36).slice(2, 9);

function turnLabel(t) {
  const idx = START_Q - 1 + t;
  return { year: START_YEAR + Math.floor(idx / 4), q: (idx % 4) + 1, termYear: Math.floor(t / 4) + 1 };
}

function fmtStat(k, v, signed = false) {
  const s = STATS[k];
  const n = Number(v).toFixed(s ? s.dec : 1);
  return (signed && v > 0 ? '+' : '') + n + (s ? s.unit : '');
}

function policyById(id, state) {
  return POLICIES.find(p => p.id === id) || (state && state.customPolicies.find(p => p.id === id));
}
function optionOf(p, oid) { return p.options.find(o => o.id === oid); }
function currentOption(p, state) { return optionOf(p, state.policies[p.id]) || p.options.find(o => o.cur); }

/* ---------------- 해설·추가 선택지 병합 ---------------- */
(function applyPolicyDetails() {
  for (const p of POLICIES) {
    const d = POLICY_DETAILS[p.id]; if (!d) continue;
    p.bg = d.bg; p.issue = d.issue;
    for (const x of (d.extra || [])) if (!p.options.some(o => o.id === x.id)) p.options.push({ ...x, extra: true });
    for (const o of p.options) { const od = d.opts && d.opts[o.id]; if (od) { o.pro = od.pro; o.con = od.con; o.ex = od.ex; } }
  }
})();

/* ---------------- 주관식(직접 입력) 선택지 ---------------- */
// 저장 데이터의 사용자 선택지를 정책 목록에 다시 붙임 (다른 게임의 것은 제거)
function hydrateUserOptions(s) {
  if (!s.userOptions) s.userOptions = {};
  for (const p of POLICIES) p.options = p.options.filter(o => !o.user);
  for (const pid in s.userOptions) {
    const p = POLICIES.find(x => x.id === pid); if (!p) continue;
    for (const o of s.userOptions[pid]) p.options.push(o);
  }
}
function addUserOption(s, pid, opt) {
  const p = policyById(pid, s);
  const o = { ...opt, id: 'u_' + uid(), user: true };
  if (p.custom) { p.options.push(o); return o; }
  (s.userOptions[pid] = s.userOptions[pid] || []).push(o);
  p.options.push(o);
  return o;
}
const numIn = t => { const m = String(t).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };

// 규칙 기반: 숫자가 있으면 기존 선택지 사이를 보간, 없으면 가장 비슷한 선택지 + 키워드 분석
function analyzeOptionRule(s, p, text) {
  const cur = p.options.find(o => o.cur);
  const n = numIn(text);
  const anchors = p.options.filter(o => !o.user && numIn(o.label) != null).map(o => ({ o, v: numIn(o.label) }));
  const uniq = [...new Map(anchors.map(a => [a.v, a])).values()].sort((a, b) => a.v - b.v);
  const mix = (A, B, t) => { const r = {}; for (const k of new Set([...Object.keys(A || {}), ...Object.keys(B || {})])) r[k] = (A?.[k] || 0) * (1 - t) + (B?.[k] || 0) * t; return r; };
  let base, how;
  if (n != null && uniq.length >= 2 && uniq.some(a => a.o.cur)) {
    let i = uniq.findIndex(a => a.v >= n); if (i === -1) i = uniq.length - 1; else if (i === 0) i = 1;
    const a = uniq[i - 1], b = uniq[i];
    let t = (n - a.v) / (b.v - a.v || 1); t = clamp(t, -0.6, 1.6);
    const A = a.o.cur ? { e: {}, rel: {}, f: {} } : a.o, B = b.o.cur ? { e: {}, rel: {}, f: {} } : b.o;
    const near = Math.abs(n - a.v) < Math.abs(n - b.v) ? a.o : b.o;
    const ref = near.cur ? (a.o.cur ? b.o : a.o) : near;
    base = { e: mix(A.e, B.e, t), rel: mix(A.rel, B.rel, t), f: mix(A.f, B.f, t), lt: ref.lt, lean: ref.lean, pc: Math.round(clamp(((A.pc || 10) * (1 - t) + (B.pc || 10) * t), 10, 80)), lag: ref.lag || 4,
      r: (ref.r || []).map(r => [r[0], r[1], r[2], clamp(r[3] * Math.min(1.3, Math.abs(t) + 0.3), 0.05, 0.9), r[4], r[5]]) };
    const raw = (n - a.v) / (b.v - a.v || 1);
    how = raw >= 0 && raw <= 1 ? `기존 선택지 '${a.o.label}'와 '${b.o.label}' 사이를 수치로 보간해 추정했습니다.` : `기존 선택지 '${a.o.label}'→'${b.o.label}'의 추세를 연장해 추정했습니다${Math.abs(raw) > 1.6 || raw < -0.6 ? ' (극단값이라 효과에 상한을 두었습니다)' : ''}.`;
  } else {
    const bigrams = t => { const r = new Set(); const c = String(t).replace(/\s/g, ''); for (let i = 0; i < c.length - 1; i++) r.add(c.slice(i, i + 2)); return r; };
    const tb = bigrams(text);
    const sim = o => { const ob = bigrams(o.label + ' ' + (o.desc || '')); let k = 0; tb.forEach(x => { if (ob.has(x)) k++; }); return k / Math.max(1, tb.size); };
    const cands = p.options.filter(o => !o.cur && !o.user).map(o => ({ o, sc: sim(o) })).sort((a, b) => b.sc - a.sc);
    const kw = analyzeCustomRule(text);
    if (cands.length && cands[0].sc > 0.12) {
      const o = cands[0].o;
      base = { e: mix(o.e, kw.e, 0.3), rel: mix(o.rel, kw.rel, 0.3), f: mix(o.f, kw.f, 0.3), lt: o.lt, lean: o.lean, pc: o.pc, lag: o.lag, r: o.r || [] };
      how = `가장 비슷한 선택지 '${o.label}'를 기준으로 추정했습니다.`;
    } else {
      base = { e: kw.e, rel: kw.rel, f: kw.f, lt: kw.lt, lean: kw.lean, pc: kw.pc, lag: kw.lag, r: kw.r };
      how = '키워드 분석으로 효과를 추정했습니다. 정확한 분석은 Claude 연동 시 가능합니다.';
    }
  }
  for (const k in base.f) base.f[k] = Math.round(base.f[k]);
  return { label: text.slice(0, 40), desc: `직접 입력한 안. ${how}`, ...base };
}

/* ---------------- 상태 생성 ---------------- */
function newGame(partyKey, presidentName) {
  const party = PARTIES[partyKey];
  const stats = {}, mods = {}, rel = {}, relMods = {}, factions = {};
  for (const k in STATS) { stats[k] = STATS[k].base; mods[k] = 0; }
  for (const k in RELATIONS) { rel[k] = RELATIONS[k].base; relMods[k] = 0; }
  for (const k in FACTIONS) factions[k] = FACTIONS[k].base;
  if (partyKey === 'lib') { factions.lib = 66; factions.con = 30; }
  if (partyKey === 'con') { factions.con = 66; factions.lib = 32; factions.mil = 58; factions.labor = 38; }
  if (partyKey === 'ind') { factions.con = 46; factions.lib = 50; factions.youth = 50; }
  const policies = {};
  for (const p of POLICIES) policies[p.id] = p.options.find(o => o.cur).id;

  let seats;
  if (partyKey === 'lib') seats = { L: 170, R: 108, N: 22, P: 0 };
  else if (partyKey === 'con') seats = { L: 170, R: 108, N: 22, P: 0 };
  else seats = { L: 166, R: 104, N: 18, P: 12 };

  const s = {
    v: 1, name: presidentName || '대통령', party: partyKey, ruling: partyKey === 'lib' ? 'L' : partyKey === 'con' ? 'R' : 'P',
    turn: 0, stats, mods, rel, relMods, factions, policies, seats,
    approval: 58, pcap: 100, pending: [], latent: [], crises: [], resolved: [],
    log: [], history: [], customPolicies: [], enactedThisTurn: [], reports: [],
    autoAI: true, over: false, ending: null, userOptions: {},
  };
  s.history.push(snapshot(s));
  addLog(s, 'info', `${presidentName || '대통령'}님, 제21대 대한민국 대통령 취임을 축하드립니다. 5년 단임 임기(20분기)가 시작됩니다.`);
  return s;
}

function snapshot(s) {
  return { turn: s.turn, stats: { ...s.stats }, rel: { ...s.rel }, approval: s.approval, factions: { ...s.factions } };
}

function addLog(s, type, text, turn) {
  s.log.unshift({ type, text, turn: turn ?? s.turn });
  if (s.log.length > 400) s.log.length = 400;
}

/* ---------------- 효과 계산 ---------------- */
function diffEffects(newOpt, oldOpt) {
  const e = {}, rel = {}, f = {};
  const add = (dst, src, k) => { for (const key in (src || {})) dst[key] = (dst[key] || 0) + src[key] * k; };
  add(e, newOpt.e, 1); add(e, oldOpt && oldOpt.e, -1);
  add(rel, newOpt.rel, 1); add(rel, oldOpt && oldOpt.rel, -1);
  // 세력 반응: 새 정책 반응 + 기존 정책 철회 반응(절반)
  add(f, newOpt.f, 1); add(f, oldOpt && oldOpt.f, -0.5);
  return { e, rel, f };
}

// 지표 변화가 가지는 가치(AI 판단 점수). 현재 상태가 나쁠수록 해당 지표의 가중치가 커짐.
function urgency(s, k) {
  const v = s.stats[k], b = STATS[k].base;
  switch (k) {
    case 'debt': return v > 70 ? 2.2 : v > 60 ? 1.6 : 1;
    case 'fiscal': return v < -6 ? 2 : v < -4.5 ? 1.4 : 1;
    case 'gdp': return v < 0.5 ? 2 : v < 1.2 ? 1.4 : 1;
    case 'unemp': return v > 5 ? 2 : v > 3.8 ? 1.4 : 1;
    case 'infl': return v > 4 ? 2 : v > 3 ? 1.4 : 1;
    case 'tfr': return 1.2;
    default:
      if (STATS[k].good > 0 && v < b - 10) return 1.6;
      if (STATS[k].good > 0 && v < 35) return 1.8;
      return 1;
  }
}

function valueOfEffects(s, e, rel, fDelta) {
  let total = 0; const parts = [];
  for (const k in (e || {})) {
    if (!STATS[k]) continue;
    let val = e[k] * STATS[k].w * STATS[k].good * urgency(s, k);
    if (k === 'infl') { // 물가는 2% 근처가 최적
      const cur = s.stats.infl; val = (Math.abs(cur - 2) - Math.abs(cur + e[k] - 2)) * STATS[k].w * urgency(s, k);
    }
    total += val; parts.push({ k, name: STATS[k].name, delta: e[k], val });
  }
  for (const k in (rel || {})) {
    if (!RELATIONS[k]) continue;
    const imp = k === 'us' ? 0.5 : k === 'cn' ? 0.35 : k === 'nk' ? 0.25 : 0.2;
    const val = rel[k] * imp; total += val;
    parts.push({ k, name: RELATIONS[k].name + ' 관계', delta: rel[k], val, rel: true });
  }
  if (fDelta) {
    const appr = approvalDeltaFromFactions(fDelta);
    const lowAppr = s.approval < 35 ? 2 : s.approval < 45 ? 1.4 : 1;
    const val = appr * 1.6 * lowAppr; total += val;
    parts.push({ k: 'approval', name: '지지율', delta: appr, val });
  }
  return { total, parts };
}

function approvalDeltaFromFactions(f) {
  let d = 0;
  for (const k in f) if (FACTIONS[k]) d += f[k] * FACTIONS[k].pop;
  return d;
}

/* ---------------- 국회 표결 ---------------- */
function voteModel(s, opt, lobby = 0) {
  if (!opt.lt || opt.lt === 'decree') return { type: 'decree', prob: 1, need: 0, exp: 0 };
  const lean = opt.lean || 'N';
  const apprAdj = (s.approval - 50) * 0.004;
  const p = (bloc) => {
    if (bloc === s.ruling) return clamp((lean !== 'N' && bloc !== 'P' && lean !== bloc ? 0.72 : 0.96) + apprAdj, 0.4, 0.99);
    if (bloc === 'P') return 0.95;
    if (bloc === 'N') return clamp(0.55 + apprAdj, 0.2, 0.9);
    if (lean === bloc) return clamp(0.88 + apprAdj, 0.5, 0.97);
    if (lean === 'N') return clamp(0.35 + apprAdj * 2, 0.05, 0.8);
    return clamp(0.05 + apprAdj, 0.0, 0.3);
  };
  let exp = 0, varr = 0;
  for (const b in s.seats) { const pr = p(b); exp += s.seats[b] * pr; varr += s.seats[b] * pr * (1 - pr); }
  exp = Math.min(298, exp + lobby * 16); // 야당 협상(협치)으로 확보한 찬성표
  varr += 36; // 이탈표 불확실성
  const need = opt.lt === 'const' ? 200 : 151;
  const sd = Math.sqrt(varr);
  const z = (exp - need + 0.5) / sd;
  let prob = normCdf(z);
  let refProb = 1;
  if (opt.lt === 'const') {
    const refSupport = refendumSupport(s, opt);
    refProb = normCdf((refSupport - 50) / 6);
    prob *= refProb;
  }
  return { type: opt.lt, prob, need, exp: Math.round(exp), sd, refProb };
}
function refendumSupport(s, opt) {
  return s.approval * 0.55 + 22 + (opt.lean === 'N' ? 4 : 0);
}
function normCdf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }

/* ---------------- 정책 미리보기 (AI 사전 분석) ---------------- */
function previewPolicy(s, p, opt, lobby = 0) {
  const old = currentOption(p, s);
  const d = diffEffects(opt, old);
  const val = valueOfEffects(s, d.e, d.rel, d.f);
  const vote = voteModel(s, opt, lobby);
  const gains = [], losses = [];
  for (const part of val.parts) {
    if (Math.abs(part.val) < 0.05 || (part.k === 'approval' && Math.abs(part.delta) < 0.05)) continue;
    (part.val > 0 ? gains : losses).push(part);
  }
  gains.sort((a, b) => b.val - a.val); losses.sort((a, b) => a.val - b.val);
  const risks = (opt.r || []).map(r => ({ tpl: r[0], title: r[1], desc: r[2], prob: r[3], sev: r[4] }));
  const riskCost = risks.reduce((a, r) => a + r.prob * r.sev * 4, 0);
  const net = val.total - riskCost;
  let verdict;
  if (net > 8) verdict = { cls: 'good', text: '강력 추천: 기대 이익이 손해와 리스크를 크게 상회합니다.' };
  else if (net > 2) verdict = { cls: 'good', text: '추천: 전반적으로 이득이 예상됩니다.' };
  else if (net > -2) verdict = { cls: 'mid', text: '판단 유보: 이득과 손해가 팽팽합니다. 국정 우선순위에 따라 결정하세요.' };
  else if (net > -8) verdict = { cls: 'bad', text: '신중 검토: 손해와 부작용이 이득보다 클 가능성이 높습니다.' };
  else verdict = { cls: 'bad', text: '비추천: 심각한 손실이 예상됩니다.' };
  if (vote.prob < 0.35) verdict.text += ' 또한 국회 통과 가능성이 낮습니다.';
  return { diff: d, gains, losses, risks, vote, net, verdict, cost: (opt.pc || 0) + lobby * LOBBY_COST, lag: opt.lag || 4 };
}

/* ---------------- 정책 시행 ---------------- */
const LOBBY_COST = 15; // 야당 협상 1단계당 정치자본
function enactPolicy(s, pid, oid, lobby = 0) {
  const p = policyById(pid, s); const opt = optionOf(p, oid); const old = currentOption(p, s);
  if (!p || !opt) return { ok: false, msg: '정책을 찾을 수 없습니다.' };
  if (old.id === opt.id) return { ok: false, msg: '이미 시행 중인 정책입니다.' };
  if (s.enactedThisTurn.includes(pid)) return { ok: false, msg: '같은 분야는 한 분기에 한 번만 바꿀 수 있습니다.' };
  if (!opt.lt || opt.lt === 'decree') lobby = 0;
  const cost = (opt.pc || 0) + lobby * LOBBY_COST;
  if (s.pcap < cost) return { ok: false, msg: `정치자본이 부족합니다. (필요 ${cost}, 보유 ${Math.floor(s.pcap)})` };

  const vote = voteModel(s, opt, lobby);
  let passed = true, detail = '';
  if (vote.type !== 'decree') {
    if (lobby) detail = `야당 협상 ${lobby}단계(⚡${lobby * LOBBY_COST}) · `;
    const yes = Math.round(clamp(vote.exp + gauss() * vote.sd, 0, 300));
    passed = yes >= vote.need;
    detail += `국회 표결: 찬성 ${yes} / 재적 300 (가결 기준 ${vote.need})`;
    if (passed && vote.type === 'const') {
      const sup = clamp(refendumSupport(s, opt) + gauss() * 6, 5, 95);
      detail += ` → 국민투표 찬성 ${sup.toFixed(1)}%`;
      passed = sup > 50;
    }
  } else detail = '대통령령·행정조치로 즉시 시행';

  s.enactedThisTurn.push(pid);
  if (!passed) {
    s.pcap -= Math.ceil(cost / 2);
    s.approval = clamp(s.approval - 1.5, 0, 100);
    addLog(s, 'bad', `❌ [${p.name}] '${opt.label}' 부결. ${detail}`);
    return { ok: true, passed: false, detail, p, opt };
  }

  s.pcap -= cost;
  const d = diffEffects(opt, old);
  s.policies[pid] = oid;
  // 세력 즉시 반응
  for (const k in d.f) if (s.factions[k] != null) s.factions[k] = clamp(s.factions[k] + d.f[k], 0, 100);
  // 효과는 lag 분기에 걸쳐 서서히
  const lag = Math.max(1, opt.lag || 4);
  s.pending = s.pending.filter(x => x.pid !== pid); // 같은 분야 진행 중이던 효과는 새 정책으로 대체
  s.pending.push({ pid, oid, src: p.custom ? p.name : `${p.name}: ${opt.label}`, e: d.e, rel: d.rel, left: lag, lag });
  // 부작용 리스크 잠복
  for (const r of (opt.r || [])) {
    s.latent.push({ pid, oid, prevOid: old.id, tpl: r[0], title: r[1], desc: r[2], prob: r[3], sev: r[4], relTarget: r[5], due: s.turn + Math.floor(rnd(0, Math.min(3, lag))), tries: 2 });
  }
  addLog(s, 'good', `✅ [${p.name}] '${old.label}' → '${opt.label}' 시행 확정. ${detail}`);
  return { ok: true, passed: true, detail, p, opt };
}

/* ---------------- 위기(부작용·돌발사건) 생성 ---------------- */
function makeCrisis(s, src) {
  const tpl = RISK_TEMPLATES[src.tpl];
  let facTarget = src.facTarget;
  if (!facTarget && src.pid) { // 정책으로 가장 손해 본 세력
    const p = policyById(src.pid, s); const o = p && optionOf(p, src.oid);
    if (o && o.f) facTarget = Object.entries(o.f).sort((a, b) => a[1] - b[1])[0]?.[0];
  }
  const relTarget = src.relTarget || src.target && RELATIONS[src.target] && src.target;
  if (!facTarget && src.target && FACTIONS[src.target]) facTarget = src.target;
  const options = (src.good && OPPORTUNITY_SOL[src.tpl] ? OPPORTUNITY_SOL[src.tpl] : tpl.sol)
    .filter(o => !o.rollback || src.pid) // 정책 철회형 해법은 정책 부작용일 때만
    .map(o => JSON.parse(JSON.stringify(o)));
  return {
    id: uid(), tpl: src.tpl, icon: tpl.icon, kind: tpl.name, title: src.title, desc: src.desc, sev: src.sev || 1,
    good: !!src.good, pid: src.pid, oid: src.oid, prevOid: src.prevOid, facTarget, relTarget: relTarget || null,
    options, turn: s.turn, world: !src.pid,
  };
}

function applyShock(s, c) {
  if (c.good) return;
  const shock = RISK_TEMPLATES[c.tpl].shock;
  for (const k in shock) {
    if (k === 'approval') s.approval = clamp(s.approval + shock[k] * c.sev, 0, 100);
    else if (STATS[k]) s.stats[k] = clamp(s.stats[k] + shock[k] * c.sev, STATS[k].min, STATS[k].max);
  }
  if (c.relTarget) s.rel[c.relTarget] = clamp(s.rel[c.relTarget] - 3 * c.sev, 0, 100);
  if (c.facTarget && s.factions[c.facTarget] != null) s.factions[c.facTarget] = clamp(s.factions[c.facTarget] - 2 * c.sev, 0, 100);
}

// 해법의 실제 효과(심각도 반영, 타겟 치환)
function expandSolution(s, c, sol, success = true) {
  const k = success ? 1 : 0.4;
  const sevK = 0.6 + 0.4 * c.sev;
  const e = {}, rel = {}, f = {};
  for (const x in (sol.e || {})) e[x] = sol.e[x] * sevK * k;
  for (const x in (sol.rel || {})) {
    const key = x === '_target' ? c.relTarget : x;
    if (key && RELATIONS[key]) rel[key] = (rel[key] || 0) + sol.rel[x] * k;
  }
  for (const x in (sol.f || {})) {
    const v = sol.f[x] * (success ? 1 : -0.6);
    if (x === '_target') { if (c.facTarget) f[c.facTarget] = (f[c.facTarget] || 0) + v; }
    else if (x === '_all') { for (const fk in FACTIONS) f[fk] = (f[fk] || 0) + v; }
    else f[x] = (f[x] || 0) + v;
  }
  return { e, rel, f };
}

function rollbackValue(s, c, sol) {
  if (!sol.rollback || !c.pid) return { total: 0 };
  const p = policyById(c.pid, s); const o = p && optionOf(p, c.oid); const prev = p && optionOf(p, c.prevOid);
  if (!o) return { total: 0 };
  const d = diffEffects(o, prev);
  const v = valueOfEffects(s, d.e, d.rel, null);
  return { total: -v.total * sol.rollback, d };
}

/* ---------------- 규칙 기반 AI 판단 ---------------- */
function aiEvaluate(s, c) {
  const evals = c.options.map((sol, i) => {
    const okAdj = clamp(sol.ok + (s.approval - 45) * 0.004 - (s.pcap < (sol.pc || 0) ? 0.25 : 0), 0.05, 0.97);
    const succ = expandSolution(s, c, sol, true), fail = expandSolution(s, c, sol, false);
    const vs = valueOfEffects(s, succ.e, succ.rel, succ.f);
    const vf = valueOfEffects(s, fail.e, fail.rel, fail.f);
    const rb = rollbackValue(s, c, sol);
    const failExtra = c.good ? 0 : -3 * c.sev; // 실패 시 위기 재발
    const pcPenalty = (sol.pc || 0) * (s.pcap < 40 ? 0.35 : 0.12);
    const score = okAdj * (vs.total + rb.total) + (1 - okAdj) * (vf.total + failExtra) - pcPenalty;
    return { i, sol, ok: okAdj, score, vs, rb, pcPenalty };
  });
  evals.sort((a, b) => b.score - a.score);
  return evals;
}

function explainChoice(s, c, evals) {
  const best = evals[0], second = evals[1];
  const pros = best.vs.parts.filter(p => p.val > 0.1).sort((a, b) => b.val - a.val).slice(0, 3);
  const cons = best.vs.parts.filter(p => p.val < -0.1).sort((a, b) => a.val - b.val).slice(0, 2);
  const fmt = p => p.rel ? `${p.name} ${p.delta > 0 ? '+' : ''}${p.delta.toFixed(0)}` : p.k === 'approval' ? `지지율 ${p.delta > 0 ? '+' : ''}${p.delta.toFixed(1)}%p` : `${p.name} ${fmtStat(p.k, p.delta, true)}`;
  let txt = `'${best.sol.label}' 선택 (성공 확률 ${(best.ok * 100).toFixed(0)}%). `;
  // 판단 근거: 현재 국가 상태
  const ctx = [];
  if (s.stats.fiscal < -5 || s.stats.debt > 60) ctx.push('재정 건전성이 악화된 상황');
  if (s.approval < 40) ctx.push('지지율이 낮아 여론 회복이 시급한 상황');
  if (s.pcap < 40) ctx.push('정치자본이 부족한 상황');
  if (s.stats.gdp < 1) ctx.push('경기 둔화 국면');
  if (ctx.length) txt += `현재 ${ctx.join(', ')}을(를) 고려했습니다. `;
  if (pros.length) txt += `기대 이득: ${pros.map(fmt).join(', ')}. `;
  if (cons.length) txt += `감수할 손해: ${cons.map(fmt).join(', ')}. `;
  if (best.rb.total < 0) txt += '원인 정책을 일부 후퇴시키는 비용이 있지만 위기 진화가 우선이라 판단했습니다. ';
  if (second) txt += `차선책 '${second.sol.label}'은(는) ${second.ok < best.ok - 0.1 ? '성공 가능성이 낮고' : second.pcPenalty > best.pcPenalty ? '정치자본 소모가 크고' : '기대 효과가 작고'} 종합 점수(${second.score.toFixed(1)} vs ${best.score.toFixed(1)})에서 밀렸습니다.`;
  return txt;
}

// 해법 실행 (by: 'ai' | 'player' | 'claude')
function resolveCrisis(s, crisisId, solIndex, by = 'player', reasoning = '') {
  const c = s.crises.find(x => x.id === crisisId);
  if (!c) return null;
  const sol = c.options[solIndex];
  const okAdj = clamp(sol.ok + (s.approval - 45) * 0.004 - (s.pcap < (sol.pc || 0) ? 0.25 : 0), 0.05, 0.97);
  const success = Math.random() < okAdj;
  s.pcap = Math.max(0, s.pcap - (sol.pc || 0));
  const fx = expandSolution(s, c, sol, success);
  // 효과의 60%는 즉시, 40%는 구조적(지속) 변화
  for (const k in fx.e) {
    if (!STATS[k]) continue;
    if (k === 'debt') { s.stats.debt = clamp(s.stats.debt + fx.e[k], 0, 250); continue; }
    s.stats[k] = clamp(s.stats[k] + fx.e[k] * 0.6, STATS[k].min, STATS[k].max);
    s.mods[k] += fx.e[k] * 0.4;
  }
  for (const k in fx.rel) { s.rel[k] = clamp(s.rel[k] + fx.rel[k] * 0.6, 0, 100); s.relMods[k] += fx.rel[k] * 0.4; }
  for (const k in fx.f) if (s.factions[k] != null) s.factions[k] = clamp(s.factions[k] + fx.f[k], 0, 100);
  let rbText = '';
  if (success && sol.rollback && c.pid) {
    const rb = rollbackValue(s, c, sol);
    if (rb.d) {
      for (const k in rb.d.e) if (STATS[k]) s.mods[k] -= rb.d.e[k] * sol.rollback;
      for (const k in rb.d.rel) if (RELATIONS[k]) s.relMods[k] -= rb.d.rel[k] * sol.rollback;
      rbText = ` 원인 정책의 효과가 ${(sol.rollback * 100).toFixed(0)}% 축소되었습니다.`;
    }
  }
  if (!success && !c.good) applyShock(s, { ...c, sev: Math.max(1, c.sev - 1) });
  const outcome = success
    ? (c.good ? `기회를 잘 살렸습니다.` : `위기가 진정되었습니다.`) + rbText
    : (c.good ? `기대만큼의 성과를 내지 못했습니다.` : `대응이 실패해 상황이 악화되었습니다. 여론의 비판이 거셉니다.`);
  const who = by === 'player' ? '대통령 결정' : by === 'claude' ? 'Claude AI 판단' : 'AI 참모 판단';
  const rec = { id: c.id, turn: c.turn, title: c.title, icon: c.icon, kind: c.kind, sol: sol.label, success, outcome, by: who, reasoning, fx, good: c.good };
  s.resolved.unshift(rec);
  s.crises = s.crises.filter(x => x.id !== crisisId);
  addLog(s, success ? 'good' : 'bad', `${c.icon} [${c.title}] ${who}: '${sol.label}' → ${success ? '성공' : '실패'}. ${outcome}`);
  return rec;
}

/* ---------------- 턴 진행 ---------------- */
function factionTargets(s) {
  const st = s.stats;
  const base = {};
  for (const k in FACTIONS) base[k] = FACTIONS[k].base;
  if (s.party === 'lib') { base.lib = 62; base.con = 32; }
  if (s.party === 'con') { base.con = 62; base.lib = 34; }
  base.biz += (st.gdp - 1.8) * 4 + (st.innovation - 72) * 0.3;
  base.labor += -(st.gini - 0.324) * 300 - (st.unemp - 2.8) * 3;
  base.youth += (st.housing - 37) * 0.3 - (st.unemp - 2.8) * 3 + (st.happiness - 42) * 0.2;
  base.elder += (st.welfare - 52) * 0.4 + (st.safety - 76) * 0.2 - (st.infl - 2) * 2;
  base.con += (st.security - 68) * 0.25 + (st.gdp - 1.8) * 2 - (st.debt - 51.6) * 0.15;
  base.lib += (st.freedom - 71) * 0.3 + (st.env - 48) * 0.15 - (st.gini - 0.324) * 200;
  base.mil += (st.security - 68) * 0.5;
  base.legal += (st.justice - 41) * 0.2;
  base.teach += (st.education - 46) * 0.4;
  base.medic += (st.health - 62) * 0.1;
  base.local += (st.housing - 37) * 0.1 + (st.gdp - 1.8) * 2;
  base.farm += -(st.infl - 2) * 1;
  return base;
}

function endTurn(s) {
  const prev = snapshot(s);
  const report = { turn: s.turn, label: turnLabel(s.turn), applied: [], crises: [], events: [], elections: [] };

  // 1) 시행 중인 정책 효과 반영(구조적 균형점 이동)
  for (const pe of s.pending) {
    for (const k in pe.e) if (STATS[k]) s.mods[k] += pe.e[k] / pe.lag;
    for (const k in pe.rel) if (RELATIONS[k]) s.relMods[k] += pe.rel[k] / pe.lag;
    pe.left--;
    report.applied.push({ src: pe.src, e: pe.e, progress: 1 - pe.left / pe.lag });
  }
  s.pending = s.pending.filter(pe => pe.left > 0);

  // 2) 거시경제 동학
  const st = s.stats;
  const potential = 1.8 - s.turn * 0.02 + (st.innovation - 72) * 0.02 + (st.tfr - 0.8) * 0.5;
  for (const k in STATS) {
    if (k === 'debt' || k === 'happiness') continue;
    let eq = STATS[k].base + s.mods[k];
    if (k === 'gdp') eq = potential + s.mods.gdp - Math.max(0, st.debt - 90) * 0.03;
    if (k === 'unemp') eq = STATS.unemp.base + s.mods.unemp - (st.gdp - potential) * 0.4;
    if (k === 'fiscal') eq = STATS.fiscal.base + s.mods.fiscal - Math.max(0, st.debt - 51.6) * 0.03 + (st.gdp - 1.8) * 0.2;
    if (k === 'tfr') eq = STATS.tfr.base + s.mods.tfr + (st.housing - 37) * 0.002 + (st.happiness - 42) * 0.001;
    const rate = k === 'tfr' ? 0.2 : 0.35;
    const noise = { gdp: 0.25, unemp: 0.1, infl: 0.2, fiscal: 0.15, tfr: 0.01, gini: 0.001 }[k] ?? 0.6;
    st[k] = clamp(st[k] + (eq - st[k]) * rate + gauss() * noise, STATS[k].min, STATS[k].max);
  }
  // 국가채무: 재정적자 누적 - 명목성장 효과
  const nominal = st.gdp + st.infl;
  st.debt = clamp(st.debt + (-st.fiscal - nominal * st.debt / 100) / 4 + s.mods.debt / 8, 0, 250);
  s.mods.debt *= 0.875;
  // 국민 행복도: 종합 지표
  const hEq = STATS.happiness.base + s.mods.happiness + (st.housing - 37) * 0.15 + (st.welfare - 52) * 0.15 - (st.unemp - 2.8) * 2
    - Math.max(0, st.infl - 2.5) * 2 + (st.safety - 76) * 0.1 + (st.gdp - 1.8) * 1.5 + (st.health - 62) * 0.1 + (st.env - 48) * 0.05;
  st.happiness = clamp(st.happiness + (hEq - st.happiness) * 0.35 + gauss() * 0.5, 0, 100);
  // 외교관계
  for (const k in RELATIONS) {
    const eq = RELATIONS[k].base + s.relMods[k];
    s.rel[k] = clamp(s.rel[k] + (eq - s.rel[k]) * 0.25 + gauss() * 1, 0, 100);
  }
  // 안보는 북한 관계와 미국 관계 영향
  st.security = clamp(st.security + (s.rel.us - 76) * 0.01 + (s.rel.nk - 12) * 0.01, 0, 100);

  // 3) 세력 지지 변화
  const ft = factionTargets(s);
  for (const k in s.factions) s.factions[k] = clamp(s.factions[k] + (ft[k] - s.factions[k]) * 0.1 + gauss() * 0.8, 0, 100);

  // 4) 잠복 리스크 발현
  const newCrises = [];
  for (const r of s.latent) {
    if (r.due > s.turn) continue;
    if (Math.random() < r.prob) { newCrises.push(makeCrisis(s, r)); r.tries = 0; }
    else { r.tries--; r.due = s.turn + 1; r.prob *= 0.6; }
  }
  s.latent = s.latent.filter(r => r.tries > 0 && s.policies[r.pid] === r.oid);

  // 5) 외부 돌발 사건
  const pool = WORLD_EVENTS.filter(ev => { try { return ev.cond(s); } catch { return false; } });
  const nEvents = Math.random() < 0.55 ? (Math.random() < 0.2 ? 2 : 1) : 0;
  for (let i = 0; i < nEvents && pool.length; i++) {
    const tot = pool.reduce((a, e) => a + e.w, 0); let r = Math.random() * tot; let pick = pool[0];
    for (const e of pool) { r -= e.w; if (r <= 0) { pick = e; break; } }
    pool.splice(pool.indexOf(pick), 1);
    newCrises.push(makeCrisis(s, { ...pick, facTarget: FACTIONS[pick.target] ? pick.target : undefined, relTarget: RELATIONS[pick.target] ? pick.target : undefined }));
  }
  for (const c of newCrises) { applyShock(s, c); s.crises.push(c); }
  report.crises = newCrises.map(c => c.id);

  // 6) 지지율·정치자본
  let target = 0; for (const k in FACTIONS) target += s.factions[k] * FACTIONS[k].pop;
  target += (st.gdp - 1.8) * 2.5 - (st.unemp - 2.8) * 3 - Math.max(0, st.infl - 2.5) * 2.5 + (st.happiness - 42) * 0.4;
  target -= Math.max(0, s.turn - 12) * 0.6; // 임기 말 레임덕
  s.approval = clamp(s.approval + (target - s.approval) * 0.45 + gauss() * 1.2, 2, 95);
  s.pcap = clamp(s.pcap + 10 + (s.approval - 45) * 0.3, 0, 200);

  // 7) 선거
  if (s.turn === GENERAL_ELECTION_TURN) report.elections.push(generalElection(s));
  if (s.turn === LOCAL_ELECTION_TURN) report.elections.push(localElection(s));

  // 8) 기록·다음 분기
  report.diff = {};
  for (const k in STATS) report.diff[k] = st[k] - prev.stats[k];
  report.relDiff = {}; for (const k in RELATIONS) report.relDiff[k] = s.rel[k] - prev.rel[k];
  report.approvalDiff = s.approval - prev.approval;
  report.enacted = s.enactedThisTurn.map(pid => { const p = policyById(pid, s); return p ? `${p.name}: ${currentOption(p, s).label}` : pid; });
  s.enactedThisTurn = [];
  s.turn++;
  s.history.push(snapshot(s));
  checkGameOver(s, report);
  s.reports.unshift(report);
  if (s.reports.length > 30) s.reports.length = 30;
  return report;
}

function generalElection(s) {
  const r = s.ruling;
  const share = clamp(0.2 + s.approval / 100 * 0.75 + gauss() * 0.03, 0.1, 0.8);
  const before = { ...s.seats };
  if (r === 'P') {
    s.seats.P = Math.round(clamp((s.approval - 25) * 3, 5, 200));
    const rest = 300 - s.seats.P - 15; s.seats.L = Math.round(rest * 0.6); s.seats.R = rest - s.seats.L; s.seats.N = 15;
  } else {
    const opp = r === 'L' ? 'R' : 'L';
    s.seats[r] = Math.round(300 * share); s.seats.N = Math.round(clamp(rnd(10, 30), 0, 50)); s.seats[opp] = 300 - s.seats[r] - s.seats.N;
  }
  const txt = `🗳️ 제23대 국회의원 총선거: 여당 ${before[r]}석 → ${s.seats[r]}석`;
  addLog(s, s.seats[r] >= before[r] ? 'good' : 'bad', txt);
  s.pcap += s.seats[r] >= 151 ? 30 : 0;
  return txt + (s.seats[r] >= 151 ? ' (여대야소)' : ' (여소야대)');
}
function localElection(s) {
  const win = Math.round(clamp(17 * (s.approval / 100) * 1.4 + gauss(), 1, 17));
  const txt = `🗳️ 제9회 전국동시지방선거: 광역단체장 17곳 중 여당 ${win}곳 승리`;
  s.pcap += win >= 9 ? 25 : -10;
  addLog(s, win >= 9 ? 'good' : 'bad', txt);
  return txt;
}

function checkGameOver(s, report) {
  const opp = 300 - (s.ruling === 'P' ? s.seats.P : s.seats[s.ruling]);
  if (s.approval < 15 && opp >= 200 && Math.random() < 0.45) {
    s.over = true; s.ending = { type: 'impeach', title: '탄핵', desc: `지지율 ${s.approval.toFixed(1)}%. 국회가 탄핵소추안을 가결했고 헌법재판소가 파면을 선고했습니다.` };
  } else if (s.stats.debt > 130 || s.stats.fiscal < -14) {
    s.over = true; s.ending = { type: 'default', title: '국가 부도', desc: '국가채무가 감당할 수 없는 수준에 이르러 IMF 구제금융을 신청했습니다.' };
  } else if (s.stats.security < 12) {
    s.over = true; s.ending = { type: 'war', title: '안보 붕괴', desc: '억지력이 무너지며 한반도에 전면적 군사 위기가 발생했습니다.' };
  } else if (s.turn >= TERM_TURNS) {
    s.over = true; s.ending = { type: 'term', title: '임기 만료' };
  }
  if (s.over) s.ending.score = finalScore(s);
  if (s.over) report.gameOver = s.ending;
}

function finalScore(s) {
  let idx = 0;
  for (const k in STATS) {
    const d = (s.stats[k] - STATS[k].base) * STATS[k].good;
    const w = STATS[k].w * (k === 'infl' ? 0 : 1);
    idx += d * w;
  }
  idx -= Math.abs(s.stats.infl - 2) * 4;
  let relScore = 0; for (const k in RELATIONS) relScore += (s.rel[k] - RELATIONS[k].base) * 0.15;
  const indexScore = clamp(50 + idx * 0.8 + relScore, 0, 100);
  const total = clamp(s.approval * 0.4 + indexScore * 0.6, 0, 100);
  const ending = ENDINGS.find(e => total >= e.min);
  return { total, indexScore, approval: s.approval, grade: ending.grade, title: ending.title, desc: ending.desc };
}

/* ---------------- 자유 입력 정책: 규칙 기반 분석 ---------------- */
const KEYWORD_RULES = [
  { kw: ['감세', '세율 인하', '세금 인하', '인하'], cat: 'tax', e: { fiscal: -0.4, gdp: 0.1, gini: 0.002 }, f: { biz: 6, con: 4, lib: -4 }, lean: 'R' },
  { kw: ['증세', '세율 인상', '세금 인상', '부유세', '횡재세'], cat: 'tax', e: { fiscal: 0.4, gdp: -0.08, gini: -0.003 }, f: { biz: -8, lib: 4, con: -4 }, lean: 'L' },
  { kw: ['무상', '지원금', '수당', '지급', '바우처'], cat: 'welfare', e: { fiscal: -0.4, welfare: 4, happiness: 2, gini: -0.003 }, f: { youth: 4, elder: 4, con: -3 }, lean: 'L' },
  { kw: ['출산', '육아', '보육', '아이'], cat: 'welfare', e: { tfr: 0.04, fiscal: -0.3, happiness: 1 }, f: { youth: 6 }, lean: 'N' },
  { kw: ['규제 완화', '규제완화', '철폐', '자율화', '민영화'], cat: 'econ', e: { gdp: 0.12, innovation: 2, gini: 0.003 }, f: { biz: 8, labor: -6, lib: -4 }, lean: 'R' },
  { kw: ['규제 강화', '금지', '처벌'], cat: 'civil', e: { freedom: -2, safety: 1 }, f: { con: 2 }, lean: 'N' },
  { kw: ['국방', '군', '병역', '징병', '무기', '안보'], cat: 'defense', e: { security: 3, fiscal: -0.2 }, f: { mil: 6, con: 3, youth: -2 }, lean: 'R' },
  { kw: ['북한', '통일', '남북'], cat: 'diplo', e: { security: 1 }, rel: { nk: 6 }, f: { lib: 4, con: -4 }, lean: 'L' },
  { kw: ['미국', '동맹'], cat: 'diplo', e: { security: 2 }, rel: { us: 6, cn: -3 }, f: { con: 4 }, lean: 'R' },
  { kw: ['중국'], cat: 'diplo', e: { gdp: 0.05 }, rel: { cn: 6, us: -2 }, f: { biz: 3 }, lean: 'N' },
  { kw: ['일본'], cat: 'diplo', e: {}, rel: { jp: 6 }, f: { con: 2, lib: -2 }, lean: 'N' },
  { kw: ['교육', '학교', '대학', '입시', '수능', '학원'], cat: 'edu', e: { education: 3, fiscal: -0.1 }, f: { teach: 4 }, lean: 'N' },
  { kw: ['주택', '아파트', '부동산', '임대', '전세', '월세'], cat: 'house', e: { housing: 4, fiscal: -0.1 }, f: { youth: 5 }, lean: 'N' },
  { kw: ['원전', '원자력', '에너지', '전기', '탄소', '환경', '기후'], cat: 'env', e: { env: 3, infl: 0.1 }, f: { lib: 3, biz: -2 }, lean: 'N' },
  { kw: ['병원', '의료', '의사', '건강', '간호'], cat: 'health', e: { health: 4, fiscal: -0.1 }, f: { elder: 3, medic: -4 }, lean: 'N' },
  { kw: ['노동', '근로', '임금', '노조', '일자리', '주4일', '최저'], cat: 'labor', e: { happiness: 2, gdp: -0.05, gini: -0.003 }, f: { labor: 8, biz: -6 }, lean: 'L' },
  { kw: ['검찰', '경찰', '법원', '재판', '사법', '수사'], cat: 'justice', e: { justice: 3 }, f: { legal: -3 }, lean: 'N' },
  { kw: ['헌법', '개헌', '대통령', '국회', '선거'], cat: 'const', e: { justice: 1 }, f: {}, lean: 'N', lt: 'const' },
  { kw: ['혼인', '결혼', '동성', '차별', '성평등', '가족'], cat: 'civil', e: { freedom: 3 }, f: { lib: 6, con: -8, elder: -4 }, lean: 'L' },
  { kw: ['반도체', 'AI', '인공지능', '스타트업', '연구', 'R&D'], cat: 'econ', e: { innovation: 4, gdp: 0.1, fiscal: -0.2 }, f: { biz: 6, youth: 3 }, lean: 'N' },
  { kw: ['폐지'], cat: null, e: {}, f: { con: 1, lib: -1 }, lean: 'N' },
  { kw: ['이민', '외국인'], cat: 'welfare', e: { gdp: 0.1, safety: -1 }, f: { biz: 4, con: -4 }, lean: 'N' },
  { kw: ['마약', '대마'], cat: 'justice', e: { safety: -2, freedom: 2 }, f: { elder: -6 }, lean: 'L' },
  { kw: ['농', '어민', '쌀'], cat: 'econ', e: { fiscal: -0.1 }, f: { farm: 8 }, lean: 'N' },
];

function analyzeCustomRule(text) {
  const e = {}, rel = {}, f = {}; let cat = null, leanScore = 0, lt = 'law', hits = 0;
  for (const rule of KEYWORD_RULES) {
    if (!rule.kw.some(k => text.includes(k))) continue;
    hits++;
    if (!cat && rule.cat) cat = rule.cat;
    for (const k in rule.e) e[k] = (e[k] || 0) + rule.e[k];
    for (const k in (rule.rel || {})) rel[k] = (rel[k] || 0) + rule.rel[k];
    for (const k in rule.f) f[k] = (f[k] || 0) + rule.f[k];
    leanScore += rule.lean === 'L' ? 1 : rule.lean === 'R' ? -1 : 0;
    if (rule.lt) lt = rule.lt;
  }
  if (!hits) { e.happiness = 1; f.youth = 1; }
  const scale = /대폭|전면|전국민|모든|완전|파격/.test(text) ? 1.8 : /시범|일부|단계적|소폭/.test(text) ? 0.5 : 1;
  for (const k in e) e[k] *= scale; for (const k in f) f[k] = Math.round(f[k] * scale);
  const risks = [];
  if ((e.fiscal || 0) < -0.5) risks.push(['fiscal', '재원 마련 논란', '막대한 소요 재원에 대한 비판이 나옵니다.', 0.5, Math.min(3, Math.ceil(-e.fiscal))]);
  const worst = Object.entries(f).sort((a, b) => a[1] - b[1])[0];
  if (worst && worst[1] <= -6) risks.push(['protest', `${FACTIONS[worst[0]].name} 반발`, `${FACTIONS[worst[0]].name}이(가) 정책에 강하게 반발하고 있습니다.`, 0.5, worst[1] <= -10 ? 2 : 1]);
  if ((e.freedom || 0) < -1.5) risks.push(['legal', '위헌 소송', '기본권 침해를 이유로 헌법소원이 제기됐습니다.', 0.5, 2]);
  return {
    name: text.slice(0, 40), cat: cat || 'civil', summary: hits ? `키워드 분석으로 추정한 효과입니다. (${hits}개 영역 관련)` : '관련 영역을 특정하기 어려워 효과를 보수적으로 추정했습니다.',
    lt, lean: leanScore > 0 ? 'L' : leanScore < 0 ? 'R' : 'N', pc: Math.round(20 + 10 * scale), lag: 4, e, rel, f, r: risks,
  };
}

function registerCustomPolicy(s, text, a) {
  const id = 'custom_' + uid();
  const p = {
    id, cat: a.cat, name: a.name, custom: true, desc: `직접 입안한 정책: "${text}"`,
    options: [
      { id: 'cur', label: '현행 유지', cur: true, desc: '현행.' },
      { id: 'new', label: a.name, desc: a.summary, lt: a.lt, lean: a.lean, pc: a.pc, lag: a.lag, e: a.e, rel: a.rel, f: a.f, r: a.r },
    ],
  };
  s.customPolicies.push(p);
  s.policies[id] = 'cur';
  return p;
}

/* ---------------- 저장 ---------------- */
const SAVE_KEY = 'newkorea_save_v1';
function saveGame(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; } }
function loadGame() { try { const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) : null; } catch { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
