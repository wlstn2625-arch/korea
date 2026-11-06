/* =========================================================
 *  온라인 게임식 진행: 임무(퀘스트)·대통령 레벨·업적·국력 세계 순위
 *  - 화면 왼쪽 위 임무 추적기, 완료하면 보상(국고·경험치) 연출
 *  - 레벨 업, 업적 달성 팝업
 * ========================================================= */
const cntOf = (s, k) => s.cnt?.[k] || 0;
function bumpCnt(s, k, n = 1) { s.cnt = s.cnt || {}; s.cnt[k] = (s.cnt[k] || 0) + n; }

// 주요 행동을 셀 수 있게 감쌈 (성공했을 때만)
function wrapCount(name, key, test) {
  const f = window[name]; if (typeof f !== 'function') return;
  window[name] = function (...a) { const r = f.apply(this, a); try { if (r && r.ok !== false && (!test || test(r, a))) bumpCnt(a[0], typeof key === 'function' ? key(r, a) : key, 1); } catch { } return r; };
}
wrapCount('buildFactory', 'build');
wrapCount('enactPolicy', 'policy');
wrapCount('polAction', 'polact');
wrapCount('diploAction', (r, a) => a[1] === 'fta' ? 'fta' : a[1] === 'summit' || a[1] === 'aid' ? 'diplo' : 'diploOther');
wrapCount('intervene', 'mediate', (r, a) => a[2] === 'mediate' && /멈췄습니다/.test(r.msg || ''));
wrapCount('signTreaty', 'treaty');
(() => { const f = window.repayDebt; if (f) window.repayDebt = function (s, pts) { const before = s.stats.debt, r = f(s, pts); if (r?.ok) bumpCnt(s, 'repay', Math.round(before - s.stats.debt)); return r; }; })();

/* ---------------- 임무 ---------------- */
// k: 횟수 카운터, st: 상태 목표(hi: 이상 / lo: 이하)
const MISSION_POOL = [
  { id: 'build', icon: '🏭', t: n => `공장 ${n}곳 착공`, k: 'build', n: [1, 2], xp: 40, gold: 20 },
  { id: 'tech', icon: '🔬', t: n => `기술·무기 ${n}종 개발 착수`, k: 'tech', n: [1, 2], xp: 40, gold: 20 },
  { id: 'policy', icon: '📜', t: n => `정책 ${n}개 시행`, k: 'policy', n: [1, 2, 3], xp: 35, gold: 15 },
  { id: 'polact', icon: '🎙️', t: n => `정치 행동 ${n}회`, k: 'polact', n: [2, 3], xp: 25, gold: 10 },
  { id: 'diplo', icon: '🤝', t: n => `정상회담·원조 ${n}회`, k: 'diplo', n: [1, 2], xp: 30, gold: 15 },
  { id: 'fta', icon: '📦', t: () => 'FTA 1건 체결', k: 'fta', n: [1], xp: 60, gold: 30, cond: s => typeof ftaRecs === 'function' && ftaRecs(s, 1).length },
  { id: 'repay', icon: '🏦', t: n => `나랏빚 ${n}%p 상환`, k: 'repay', n: [3, 5, 10], xp: 45, gold: 0, cond: s => s.stats.debt > 30 },
  { id: 'mediate', icon: '🕊️', t: () => '국제 분쟁 중재 성공', k: 'mediate', n: [1], xp: 70, gold: 30, cond: s => (s.world?.conflicts || []).some(c => c.type !== 'cyber') },
  { id: 'appr', icon: '📣', t: v => `지지율 ${v}% 달성`, st: s => s.approval, hi: s => Math.min(75, Math.round(s.approval + 4)), xp: 50, gold: 25 },
  { id: 'gdp', icon: '📈', t: v => `성장률 ${v}% 달성`, st: s => s.stats.gdp, hi: s => +Math.max(2, s.stats.gdp + 0.4).toFixed(1), xp: 55, gold: 25 },
  { id: 'debt', icon: '📉', t: v => `국가채무 ${v}% 이하`, st: s => s.stats.debt, lo: s => Math.max(10, Math.floor(s.stats.debt - 5)), xp: 50, gold: 20, cond: s => s.stats.debt > 20 },
  { id: 'capture', icon: '🚩', t: n => `적 도시 ${n}곳 점령`, k: 'capture', n: [1, 2], xp: 70, gold: 30, cond: s => !!s.war?.theater },
  { id: 'ops', icon: '🎯', t: n => `작전 명령 ${n}회`, k: 'ops', n: [2, 3], xp: 35, gold: 15, cond: s => !!s.war?.theater },
  { id: 'terrb', icon: '🏗️', t: n => `점령지 개발 사업 ${n}건`, k: 'terrBuild', n: [1, 2], xp: 45, gold: 20, cond: s => Object.keys(s.terr || {}).length },
];
function newMission(s) {
  const have = new Set((s.missions || []).map(m => m.id));
  const pool = MISSION_POOL.filter(m => !have.has(m.id) && (!m.cond || m.cond(s)));
  const m = pool[Math.floor(Math.random() * pool.length)]; if (!m) return null;
  if (m.k) { const n = m.n[Math.floor(Math.random() * m.n.length)]; return { id: m.id, n, base: cntOf(s, m.k), turn: s.turn }; }
  return { id: m.id, v: m.hi ? m.hi(s) : m.lo(s), turn: s.turn };
}
function missionProg(s, ms) {
  const m = MISSION_POOL.find(x => x.id === ms.id); if (!m) return { m: null, cur: 0, goal: 1, done: false };
  if (m.k) { const cur = Math.max(0, cntOf(s, m.k) - ms.base); return { m, cur: Math.min(cur, ms.n), goal: ms.n, done: cur >= ms.n, label: m.t(ms.n) }; }
  const v = m.st(s);
  if (m.hi) return { m, cur: v, goal: ms.v, done: v >= ms.v, label: m.t(ms.v), pct: clamp(v / ms.v, 0, 1) };
  return { m, cur: v, goal: ms.v, done: v <= ms.v, label: m.t(ms.v), pct: clamp(ms.v / Math.max(v, 1), 0, 1) };
}
function ensureMissions(s) {
  s.missions = (s.missions || []).filter(ms => MISSION_POOL.some(m => m.id === ms.id));
  while (s.missions.length < 3) { const m = newMission(s); if (!m) break; s.missions.push(m); }
}
const xpNeed = lv => 80 + lv * 40;
function gainXp(s, xp) {
  s.xp = (s.xp || 0) + xp; s.lv = s.lv || 1; const ups = [];
  while (s.xp >= xpNeed(s.lv)) { s.xp -= xpNeed(s.lv); s.lv++; const bonus = 10 + s.lv * 5; s.pcap += bonus; s.approval = clamp(s.approval + 0.5, 0, 100); ups.push({ lv: s.lv, bonus }); addLog(s, 'good', `⭐ 대통령 레벨 ${s.lv} 달성! 국고 +${won(bonus)}`); }
  return ups;
}
// 완료된 임무 정산 (보상 지급 후 새 임무)
function checkMissions(s) {
  ensureMissions(s);
  const done = [];
  for (const ms of [...s.missions]) {
    const p = missionProg(s, ms); if (!p.done) continue;
    s.missions = s.missions.filter(x => x !== ms);
    s.pcap += p.m.gold; bumpCnt(s, 'missions');
    const ups = gainXp(s, p.m.xp);
    addLog(s, 'good', `✅ 임무 완료: ${p.label} (+${won(p.m.gold)}, 경험치 +${p.m.xp})`);
    done.push({ label: p.label, icon: p.m.icon, gold: p.m.gold, xp: p.m.xp, ups });
  }
  ensureMissions(s);
  return done;
}
function rerollMission(s, i) {
  if ((s.rerollTurn ?? -1) === s.turn) return { ok: false, msg: '임무 교체는 분기에 한 번만 할 수 있습니다.' };
  const ms = s.missions[i]; if (!ms) return { ok: false };
  s.missions.splice(i, 1); const m = newMission(s); if (m) s.missions.splice(i, 0, m); s.rerollTurn = s.turn;
  return { ok: true, msg: '새 임무를 받았습니다.' };
}

/* ---------------- 국력 세계 순위 ---------------- */
function krPower(s) {
  let eco = cinfo('kr').eco * (s.gdpIdx || 1);
  for (const k in (s.terr || {})) { const t = s.terr[k]; eco += cinfo(k).eco * (RULES[t.rule].puppet ? 0.25 : 0.3 + 0.7 * t.integ / 100); }
  return eco * 0.55 + milPower(s) * 0.75 * 0.45;
}
function powerRank(s) {
  const me = krPower(s); let rank = 1;
  for (const k of allCountryKeys()) {
    const c = cinfo(k); if (!c || c.isBloc || k === 'kr' || s.annexed?.[k] || s.world?.owner?.[k] || s.terr?.[k]) continue;
    const p = c.eco * 0.55 + (typeof power === 'function' && s.world ? power(s, k) : c.mil) * 0.45;
    if (p > me) rank++;
  }
  return { rank, score: me };
}
HOOKS.postTurn.push(s => { s.gdpIdx = (s.gdpIdx || 1) * (1 + s.stats.gdp / 400); const r = powerRank(s); s.bestRank = Math.min(s.bestRank || 99, r.rank); });

/* ---------------- 업적 ---------------- */
const ACHIEVEMENTS = [
  { id: 'f1', icon: '🏭', name: '산업 대통령', desc: '첫 공장 착공', ok: s => cntOf(s, 'build') >= 1 },
  { id: 'f2', icon: '🔬', name: '기술 입국', desc: '기술·무기 10종 개발 완료', ok: s => (s.tech?.done || []).length >= 10 },
  { id: 'f3', icon: '🚀', name: '첨단 강군', desc: '국방 무기 20종 개발 완료', ok: s => (s.tech?.done || []).filter(id => treeOf(techById(id)) === 'mil').length >= 20 },
  { id: 'f4', icon: '📦', name: '통상 대국', desc: 'FTA 3건 새로 체결', ok: s => cntOf(s, 'fta') >= 3 },
  { id: 'f5', icon: '📣', name: '국민 대통령', desc: '지지율 70% 돌파', ok: s => s.approval >= 70 },
  { id: 'f6', icon: '🏦', name: '빚 없는 나라', desc: '국가채무 30% 이하', ok: s => s.stats.debt <= 30 },
  { id: 'f7', icon: '📈', name: '제2의 한강의 기적', desc: '성장률 4% 돌파', ok: s => s.stats.gdp >= 4 },
  { id: 'f8', icon: '🕊️', name: '평화의 중재자', desc: '분쟁 중재 3회 성공', ok: s => cntOf(s, 'mediate') >= 3 },
  { id: 'f9', icon: '🚩', name: '첫 승전', desc: '전쟁에서 적 도시 점령', ok: s => cntOf(s, 'capture') >= 1 },
  { id: 'f10', icon: '🗺️', name: '영토 확장', desc: '점령지·괴뢰국 1곳 이상', ok: s => Object.keys(s.terr || {}).length >= 1 },
  { id: 'f11', icon: '🇰🇷', name: '한반도 통일', desc: '남북 통일 달성', ok: s => !!s.annexed?.nk },
  { id: 'f12', icon: '🤝', name: '완전한 통합', desc: '점령지를 본토로 완전 통합', ok: s => Object.values(s.terr || {}).some(t => t.full) },
  { id: 'f13', icon: '☢️', name: '핵보유국', desc: '독자 핵무장', ok: s => typeof hasNukes === 'function' && hasNukes(s, 'kr') },
  { id: 'f14', icon: '🏅', name: '세계 10강', desc: '국력 세계 10위 이내', ok: s => (s.bestRank || 99) <= 10 },
  { id: 'f15', icon: '🥈', name: '세계 5강', desc: '국력 세계 5위 이내', ok: s => (s.bestRank || 99) <= 5 },
  { id: 'f16', icon: '👑', name: '세계 최강국', desc: '국력 세계 1위', ok: s => (s.bestRank || 99) <= 1 },
  { id: 'f17', icon: '✅', name: '성실한 국정', desc: '임무 20개 완료', ok: s => cntOf(s, 'missions') >= 20 },
  { id: 'f18', icon: '⭐', name: '노련한 정치가', desc: '대통령 레벨 10', ok: s => (s.lv || 1) >= 10 },
  { id: 'f19', icon: '🔁', name: '정권 재창출', desc: '대선에서 승리', ok: s => (s.partyTerms || 1) >= 2 },
  { id: 'f20', icon: '💰', name: '부자 나라', desc: '국고 ₩100조 보유', ok: s => s.pcap >= 1000 },
];
function checkAchievements(s) {
  s.ach = s.ach || {}; const got = [];
  for (const a of ACHIEVEMENTS) if (!s.ach[a.id]) { let ok = false; try { ok = a.ok(s); } catch { } if (ok) { s.ach[a.id] = s.turn; s.pcap += 15; gainXp(s, 30); got.push(a); addLog(s, 'good', `🏆 업적 달성: ${a.name} (${a.desc})`); } }
  return got;
}

/* ---------------- 화면 ---------------- */
let questOpen = !matchMedia('(max-width: 760px)').matches;
function renderQuest() {
  if (!S || S.over) return;
  let q = $('quest');
  if (!q) { q = document.createElement('div'); q.id = 'quest'; q.className = 'quest'; document.querySelector('.stage')?.appendChild(q); }
  ensureMissions(S);
  const r = powerRank(S), lv = S.lv || 1, xp = S.xp || 0;
  q.classList.toggle('closed', !questOpen);
  q.innerHTML = `<button class="q-head" id="q-toggle"><span class="q-lv">Lv.${lv}</span><span class="q-xp"><i style="width:${(xp / xpNeed(lv) * 100).toFixed(0)}%"></i></span><span class="q-rank">🏆 국력 ${r.rank}위</span><span class="q-caret">${questOpen ? '▾' : '▸'}</span></button>
    ${questOpen ? `<div class="q-body">
      ${(() => { if (typeof eraOf !== 'function') return ''; const E = ERAS[eraOf(S) - 1], p = eraProgress(S);
        return `<div class="q-era"><b>${E.icon} ${E.name}</b>${p ? `<small>다음: ${p.next.icon} ${p.next.name} — Lv.${p.next.need.lv} ${p.lvOk ? '✅' : ''} · 국력 ${p.next.need.rank}위 이내 ${p.rankOk ? '✅' : `(현재 ${p.rank}위)`}</small>` : '<small>최고 단계</small>'}
          ${eraOf(S) >= 2 ? `<button class="chip ${S.pmAuto ? 'on' : ''}" id="q-pm">🧑‍💼 내정 총리 위임 ${S.pmAuto ? 'ON' : 'OFF'}</button>` : ''}</div>`; })()}
      ${(() => { const ks = Object.keys(S.terr || {}); if (!ks.length && !(typeof eraOf === 'function' && eraOf(S) >= 2)) return '';
        const nA = ks.filter(k => S.terr[k].auto).length;
        return `<div class="q-auto"><b>⚙️ 자동 운영</b>
          ${ks.length ? `<button class="chip ${nA === ks.length ? 'on' : ''}" id="q-gov">🤖 점령지 ${nA}/${ks.length} 위임${nA < ks.length ? ' · 전체 맡기기' : ''}</button>` : ''}
          <button class="chip ${S.autoAI ? 'on' : ''}" id="q-crisis">🚨 위기 AI 참모 ${S.autoAI ? 'ON' : 'OFF'}</button></div>`; })()}
      <div class="q-title">📋 임무 <span class="muted">완료하면 국고·경험치</span></div>
      ${S.missions.map((ms, i) => { const p = missionProg(S, ms); if (!p.m) return '';
        const pct = p.pct != null ? p.pct : p.cur / p.goal;
        return `<div class="q-m ${p.done ? 'done' : ''}"><span class="qi">${p.m.icon}</span><div class="qt"><b>${esc(p.label)}</b>
          <span class="q-bar"><i style="width:${(clamp(pct, 0, 1) * 100).toFixed(0)}%"></i></span>
          <small>${p.m.k ? `${p.cur}/${p.goal}` : `현재 ${p.m.id === 'appr' || p.m.id === 'debt' ? p.cur.toFixed(1) + '%' : p.cur.toFixed(1) + '%'}`} · 보상 ${p.m.gold ? won(p.m.gold) + ' · ' : ''}XP ${p.m.xp}</small></div>
          <button class="q-rr" data-rr="${i}" title="다른 임무로 교체 (분기 1회)">↻</button></div>`; }).join('')}
      <button class="q-ach" id="q-ach">🏆 업적 ${Object.keys(S.ach || {}).length}/${ACHIEVEMENTS.length} · 국력 점수 ${r.score.toFixed(0)}</button>
    </div>` : ''}`;
  $('q-toggle').onclick = () => { questOpen = !questOpen; renderQuest(); };
  if ($('q-gov')) $('q-gov').onclick = () => { if (typeof defView !== 'undefined') { defView = 'terr'; } setGov(S, '*', 'auto', true); saveGame(S); renderAll(); showTab('defense'); toast('🤖 모든 점령지를 총독부에 맡겼습니다. 방침·예산은 이 화면에서 정하세요.', 4000); };
  if ($('q-crisis')) $('q-crisis').onclick = () => { S.autoAI = !S.autoAI; if ($('auto-ai')) $('auto-ai').checked = S.autoAI; saveGame(S); renderQuest(); toast(S.autoAI ? '🚨 돌발 위기는 AI 참모가 해결하고 보고합니다.' : '돌발 위기를 직접 결정합니다.'); };
  if ($('q-pm')) $('q-pm').onclick = () => { S.pmAuto = !S.pmAuto; saveGame(S); renderQuest(); toast(S.pmAuto ? '🧑‍💼 국내 정치 현안은 국무총리가 처리합니다. 국가 비상·점령지 카드는 계속 대통령에게 옵니다.' : '국내 현안을 직접 결정합니다.', 4000); };
  q.querySelectorAll('[data-rr]').forEach(b => b.onclick = () => { const r = rerollMission(S, +b.dataset.rr); toast(esc(r.msg || '')); saveGame(S); renderQuest(); });
  if ($('q-ach')) $('q-ach').onclick = openAchievements;
}
function openAchievements() {
  const r = powerRank(S);
  openModal(`<h2>🏆 업적과 국력</h2>
    <p class="lead">대통령 레벨 ${S.lv || 1} · 국력 세계 ${r.rank}위 (최고 ${S.bestRank || r.rank}위) · 완료한 임무 ${cntOf(S, 'missions')}개</p>
    <div class="ach-grid">${ACHIEVEMENTS.map(a => `<div class="ach ${S.ach?.[a.id] != null ? 'on' : ''}"><span>${a.icon}</span><b>${a.name}</b><small>${a.desc}</small></div>`).join('')}</div>`);
}
// 보상 연출: 동전이 튀는 카드
function rewardPop(title, sub, big) {
  const st = document.querySelector('.stage'); if (!st) return;
  const d = document.createElement('div'); d.className = `reward-pop ${big ? 'big' : ''}`;
  d.innerHTML = `<b>${title}</b><small>${sub}</small>${reduceMotion() ? '' : Array.from({ length: big ? 14 : 8 }, (_, i) => `<i style="--a:${(i / (big ? 14 : 8)) * 360}deg;--d:${50 + Math.random() * 60}px">${big ? '⭐' : '🪙'}</i>`).join('')}`;
  st.appendChild(d); setTimeout(() => d.remove(), 2600);
}
const popQueue = [];
function flushPops() { const f = popQueue.shift(); if (!f) return; f(); setTimeout(flushPops, 2100); }
function runProgress() {
  if (!S || S.over) return;
  const done = checkMissions(S), ach = checkAchievements(S);
  const wasEmpty = !popQueue.length;
  for (const d of done) { popQueue.push(() => rewardPop(`${d.icon} 임무 완료!`, `${esc(d.label)} · ${d.gold ? `+${won(d.gold)} · ` : ''}XP +${d.xp}`)); for (const u of d.ups) popQueue.push(() => rewardPop(`⭐ LEVEL UP! Lv.${u.lv}`, `대통령 레벨이 올랐습니다 · 국고 +${won(u.bonus)}`, true)); }
  for (const a of ach) popQueue.push(() => rewardPop(`🏆 업적 달성: ${a.name}`, `${a.desc} · +${won(15)}`, true));
  if (done.length || ach.length) { saveGame(S); renderHeader(); }
  if (wasEmpty && popQueue.length) flushPops();
  renderQuest();
}
// 화면을 다시 그릴 때마다(행동 직후) 진행 확인
const _renderAll = renderAll;
renderAll = function () { _renderAll(); runProgress(); };
