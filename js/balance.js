/* =========================================================
 *  세력 균형: 내가 강해질수록 세계가 뭉쳐 견제하고, 영토를 조금씩 갉아먹으려 함
 *  1) 패권 견제: 국력이 다른 강대국을 압도할수록 위협도의 '바닥'이 올라감
 *  2) 반한 동맹: 연합이 3개국 이상이면 이름 있는 동맹 결성, 맹주·결속력·합산 전력
 *     강대국(미·중·러)은 우리가 1위가 되면 관계와 무관하게 합류(세력 균형)
 *  3) 살라미 전술: 국경 침투(점령지 갉아먹기)·반군 지원·해상 봉쇄·외딴 영토 기습
 *     → 대통령이 막을지(군단 파견·보복 공격) 결정. 두 번 뚫리면 그 땅을 빼앗김
 *  4) 두 번째 전선: 우리가 전쟁 중이면 이웃 연합국이 틈을 타 적 편에 가담
 * ========================================================= */
const ALLIANCE_NAMES = { west: '자유 수호 동맹', east: '유라시아 안보조약기구', south: '비동맹 상호방위 연합', mixed: '반패권 국제 연합' };
function balState(s) { const G = geoState(s); if (!G.bal) G.bal = { nibbles: [], lastNibble: -99, front2: -99 }; return G.bal; }
// 다른 강대국 상위 5개국 평균 대비 우리 국력
function hegemonyRatio(s) {
  const others = allCountryKeys().filter(k => { const c = cinfo(k); return c && !c.isBloc && k !== 'kr' && !s.annexed[k] && !s.world?.owner?.[k] && !s.terr?.[k]; })
    .map(k => theirMight(s, k)).sort((a, b) => b - a).slice(0, 5);
  const avg = others.reduce((a, x) => a + x, 0) / Math.max(1, others.length);
  return krMight(s) / Math.max(1, avg);
}
function allianceInfo(s) {
  const G = geoState(s), m = G.coalition;
  if (m.length < 3) return null;
  const lead = [...m].sort((a, b) => theirMight(s, b) - theirMight(s, a))[0];
  const camps = new Set(m.map(k => typeof campOf === 'function' ? campOf(s, k) : 'mixed'));
  const name = G.allianceName || (camps.size === 1 ? ALLIANCE_NAMES[[...camps][0]] : ALLIANCE_NAMES.mixed);
  const power = m.reduce((a, k) => a + theirMight(s, k) * (['us', 'cn', 'ru'].includes(k) ? 1 : Math.max(0.45, nearness(s, k))), 0);
  const cohesion = clamp(30 + G.threat * 0.6 + m.length * 1.5 - (G.bal?.splits || 0) * 10, 0, 100);
  return { name, lead, power, cohesion, members: m };
}

function balanceTurn(s, report) {
  const G = geoState(s), B = balState(s);
  const hr = hegemonyRatio(s);
  // 1) 패권 견제: 압도적이면 위협도가 일정 이하로 내려가지 않음
  const floor = clamp((hr - 1.2) * 22, 0, 70);
  if (G.threat < floor) { G.threat = floor; if (!B.floorNoted && floor >= 30) { B.floorNoted = true; geoLog(s, null, `🌐 대한민국의 국력이 다른 강대국을 압도하면서 세계가 견제를 시작했습니다. (국력비 ${hr.toFixed(1)}배, 위협도 하한 ${floor.toFixed(0)})`, 'bad'); } }
  // 강대국의 세력 균형: 우리가 1위급이면 관계와 상관없이 연합에 합류
  B.great = B.great || {};
  for (const k of Object.keys(B.great)) { if (hr < 1.25 || !cinfo(k) || s.annexed[k] || s.terr?.[k]) { delete B.great[k]; continue; } if (!G.coalition.includes(k)) { G.coalition.push(k); G.stance[k] = 'coalition'; } }
  if (hr > 1.6) for (const k of ['us', 'cn', 'ru']) {
    if (!cinfo(k) || s.annexed[k] || s.world?.owner?.[k] || s.terr?.[k] || G.coalition.includes(k) || s.heg?.sphere?.[k] != null) continue;
    if (Math.random() < 0.15 + (hr - 1.6) * 0.1) { B.great[k] = s.turn; G.coalition.push(k); G.stance[k] = 'coalition'; if (dip(s, k).alliance && k === 'us') { dip(s, k).alliance = false; relBump(s, 'us', -10, -8); } geoLog(s, k, `${jga(cname(k))} 세력 균형을 위해 반한 연합에 합류했습니다.`, 'bad'); report.geo?.push(`${cflag(k)} ${cname(k)} 반한 연합 합류`); }
  }
  // 2) 동맹 결성
  const A = allianceInfo(s);
  if (A && !G.allianceName) { G.allianceName = A.name; geoLog(s, A.lead, `⚔️ ${A.lead ? cname(A.lead) : ''} 주도로 '${A.name}'이(가) 결성됐습니다! 회원국 ${A.members.length}개국이 상호 방위를 약속했습니다.`, 'bad'); report.geo?.push(`⚔️ '${A.name}' 결성`); }
  if (!A && G.allianceName && G.coalition.length < 2) { geoLog(s, null, `🕊️ '${G.allianceName}'이(가) 해체됐습니다.`, 'good'); G.allianceName = null; }
  // 4) 두 번째 전선: 전쟁 중이면 이웃 연합국이 적 편에 가담
  if (s.war && A && s.turn - B.front2 >= 4 && Math.random() < 0.25 + A.cohesion / 300) {
    const join = A.members.filter(k => k !== s.war.k && !s.war.enemyAllies.includes(k) && nearness(s, k) >= 0.6 && theirMight(s, k) > 15).slice(0, 2);
    if (join.length) { s.war.enemyAllies.push(...join); B.front2 = s.turn; geoLog(s, join[0], `🗡️ ${join.map(cname).join('·')}이(가) 틈을 타 ${cname(s.war.k)} 편으로 참전했습니다! 두 번째 전선이 열렸습니다.`, 'bad'); report.geo?.push(`🗡️ ${join.map(cname).join('·')} 참전`); }
  }
  // 3) 살라미 전술: 위협도·결속력에 따라 분기마다 확률적으로
  if (G.coalition.length >= 2 && G.threat >= 35 && !s.war && s.turn - B.lastNibble >= 2 && Math.random() < 0.18 + G.threat / 300 + (A ? A.cohesion / 500 : 0)) {
    const ev = pickNibble(s); if (ev) { B.lastNibble = s.turn; B.nibbles.push(ev); }
  }
}
// 갉아먹을 대상 고르기: 연합국과 가까운 우리 점령지(저항 높을수록 노림), 없으면 본토 국경·해상
function pickNibble(s) {
  const G = geoState(s), coal = G.coalition.filter(k => cinfo(k) && !s.annexed[k]);
  const cands = [];
  for (const [k, t] of Object.entries(s.terr || {})) {
    if (t.full || RULES[t.rule]?.puppet && Math.random() < 0.5) continue;
    for (const a of coal) { const near = typeof neighborsOf === 'function' && neighborsOf(a)?.includes?.(k); const sameSub = cinfo(a)?.sub === cinfo(k)?.sub; if (near || sameSub) cands.push({ a, k, w: (near ? 2 : 1) * (1 + t.resist / 50) * (1 + theirMight(s, a) / 60) * (t.nib ? 4 : 1) }); } // 한 번 뚫린 곳을 집요하게 노림
  }
  const type = cands.length ? (Math.random() < 0.55 ? 'raid' : Math.random() < 0.6 ? 'proxy' : 'island') : 'blockade';
  if (type === 'blockade') { const a = [...coal].sort((x, y) => theirMight(s, y) - theirMight(s, x))[0]; return a ? { type, a, turn: s.turn } : null; }
  let r = Math.random() * cands.reduce((x, c) => x + c.w, 0); const c = cands.find(x => (r -= x.w) <= 0) || cands[0];
  return { type, a: c.a, k: c.k, turn: s.turn };
}
// 막을 확률: 우리 국력(투사력)·현지 군사기지·총독 vs 공격국
function defendChance(s, ev) {
  const t = s.terr?.[ev.k], base = t?.lv?.base || 0;
  const reach = typeof reachOf === 'function' ? reachOf(s, ev.a) : 1;
  const r = (krMight(s) * reach) / Math.max(5, theirMight(s, ev.a) * 2);
  return clamp(0.35 + Math.log2(Math.max(0.1, r)) * 0.18 + base * 0.1 + (typeof regionOf === 'function' && s.govs?.[regionOf(ev.k)]?.traits?.includes('general') ? 0.08 : 0), 0.12, 0.93);
}
function cedeTerritory(s, k, to) {
  if (!s.terr?.[k]) return;
  delete s.terr[k]; s.annexed[k] = false; if (s.occupied) delete s.occupied[k];
  s.world.owner = s.world.owner || {}; s.world.owner[k] = to;
  s.approval = clamp(s.approval - 5, 0, 100); s.scoreBonus = (s.scoreBonus || 0) - 3;
  geoLog(s, to, `🏴 ${jga(cname(to))} ${cname(k)}을(를) 빼앗아 갔습니다!`, 'bad');
}
const NIBBLE_TXT = {
  raid: (s, e) => ({ title: `${cname(e.a)}군, ${cname(e.k)} 국경 침투`, desc: `${cname(e.a)} 정규군이 "현지 동포 보호"를 명분으로 ${cname(e.k)} 국경 마을 여러 곳을 점거했습니다. ${s.terr[e.k]?.nib ? '이미 한 번 밀린 곳입니다. 또 밀리면 이 땅 전체를 잃습니다!' : '그냥 두면 점점 더 깊이 들어올 것입니다.'}` }),
  proxy: (s, e) => ({ title: `${cname(e.a)}, ${cname(e.k)} 반군에 무기 지원`, desc: `${cname(e.a)} 정보기관이 ${cname(e.k)}의 무장 독립 세력에 무기와 자금을 대고 있다는 정황이 포착됐습니다. 저항이 거세질 것입니다.` }),
  island: (s, e) => ({ title: `${cname(e.a)}, ${cname(e.k)} 외딴 섬·항만 기습 점거`, desc: `${cname(e.a)} 해병대가 ${cname(e.k)}의 외딴 섬과 항만을 기습 점거하고 "역사적 영토"라고 주장합니다.` }),
  blockade: (s, e) => ({ title: `${cname(e.a)} 주도 해상 봉쇄`, desc: `${cname(e.a)} 해군이 우리 상선의 주요 항로를 막아섰습니다. 수출입이 끊기고 국고 수입이 줄고 있습니다.` }),
};
if (typeof DOM_EVENTS !== 'undefined') DOM_EVENTS.nibble = {
  w: 80, kind: 'security', extreme: true, icon: '🗡️', cond: s => (geoState(s).bal?.nibbles || []).some(e => e.type === 'blockade' || s.terr?.[e.k]),
  make: s => { const B = balState(s); B.nibbles = B.nibbles.filter(e => e.type === 'blockade' || s.terr?.[e.k]); const e = B.nibbles.shift(); const t = NIBBLE_TXT[e.type](s, e);
    const p = defendChance(s, e); return { ...t, desc: `${t.desc} (군단 파견 시 격퇴 확률 ${Math.round(p * 100)}%)`, e }; },
  choices: [
    { label: '군단 파견해 격퇴', desc: '국고 ₩1.5조. 격퇴하면 위신↑·공격국 관계↓, 실패하면 피해.', pc: 15, run: (s, ev) => {
      const e = ev.e, p = defendChance(s, e), t = s.terr?.[e.k];
      if (Math.random() < p) { relBump(s, e.a, -8, -4); s.approval = clamp(s.approval + 1.5, 0, 100); if (t) t.resist = clamp(t.resist - 5, 0, 100); (s.cnt = s.cnt || {}).repel = (s.cnt.repel || 0) + 1; return `격퇴 성공! ${cname(e.a)}군이 물러났습니다. (확률 ${Math.round(p * 100)}%)`; }
      return nibbleLoss(s, e, `격퇴에 실패했습니다. (확률 ${Math.round(p * 100)}%) `); } },
    { label: '보복 전쟁', desc: '공격국에 선전포고. 연합 전체와 맞설 각오가 필요합니다.', run: (s, ev) => { if (s.war) return '이미 전쟁 중입니다. ' + nibbleLoss(s, ev.e, ''); s.rel[ev.e.a] = Math.min(relOf(s, ev.e.a), 10); dip(s, ev.e.a).casusBelli = s.turn + 2; startWar(s, ev.e.a, 'kr', 'concession'); return `${cname(ev.e.a)}에 보복 선전포고했습니다!`; } },
    { label: '외교적 항의만', desc: '피해를 감수합니다.', run: (s, ev) => nibbleLoss(s, ev.e, '항의 성명만 냈습니다. ') },
  ] };
function nibbleLoss(s, e, pre) {
  if (e.type === 'blockade') { s.stats.gdp -= 0.25; s.pcap = Math.max(0, s.pcap - 25); s.mods.gdp -= 0.03; return pre + '봉쇄로 무역이 막혀 성장률과 국고가 타격을 입었습니다.'; }
  const t = s.terr?.[e.k]; if (!t) return pre;
  if (e.type === 'proxy') { t.resist = clamp(t.resist + 18, 0, 100); return pre + `${cname(e.k)}의 저항이 크게 올랐습니다.`; }
  t.nib = (t.nib || 0) + 1; t.dev = clamp(t.dev - 8, 5, 100); t.resist = clamp(t.resist + 8, 0, 100);
  if (t.nib >= 2 || e.type === 'island' && t.nib >= 2) { cedeTerritory(s, e.k, e.a); return pre + `결국 ${cname(e.k)}을(를) ${cname(e.a)}에 빼앗겼습니다!`; }
  return pre + `${cname(e.k)} 일부를 빼앗겼습니다. 한 번 더 밀리면 전부 잃습니다! (점령지 화면에서 군사기지를 지으면 막기 쉬워집니다)`;
}
HOOKS.postTurn.push(balanceTurn);

/* ---------------- 화면: 국제 반응 패널에 동맹·견제 정보 ---------------- */
if (typeof renderGeoPanel === 'function') (function () {
  const f = renderGeoPanel;
  renderGeoPanel = function () {
    f(); const box = document.querySelector('#geo-slot .geo-box'); if (!box || !S) return;
    const A = allianceInfo(S), hr = hegemonyRatio(S), B = balState(S);
    const d = document.createElement('div'); d.className = 'bal-box';
    d.innerHTML = `<div class="wlabel">⚖️ 세력 균형</div>
      <div class="small">대한민국 국력은 다른 강대국 상위 5개국 평균의 <b>${hr.toFixed(1)}배</b>${hr > 1.2 ? ` — 세계가 견제합니다 (위협도 하한 ${clamp((hr - 1.2) * 22, 0, 70).toFixed(0)})` : ''}</div>
      ${A ? `<div class="alliance"><b>⚔️ ${esc(A.name)}</b> <span class="muted small">맹주 ${cflag(A.lead)} ${esc(cname(A.lead))} · ${A.members.length}개국</span>
        <div class="wrow"><span>결속력</span>${meter(A.cohesion, 'sur')}<em>${A.cohesion.toFixed(0)}</em></div>
        <div class="wrow"><span>동맹 전력</span>${meter(A.power / Math.max(1, A.power + krMight(S)) * 100, 'exh', 50)}<em>${A.power.toFixed(0)}</em></div>
        <div class="muted small">우리 전력 ${krMight(S).toFixed(0)}. 동맹 전력이 우리를 넘고 위협도가 높으면 연합군이 선전포고합니다. 그 전에도 국경 침투·반군 지원·해상 봉쇄로 영토를 갉아먹습니다. 우리가 전쟁 중이면 이웃 회원국이 두 번째 전선을 엽니다.</div></div>`
        : '<div class="muted small">아직 반한 동맹은 없습니다.</div>'}
      <div class="muted small">🛡️ 막는 법: 점령지에 군사기지·경찰망 짓기, 군 출신 총독, 격퇴 성공으로 위신 쌓기, 관대한 평화·독립 승인으로 위협도 낮추기, 약소국을 세력권으로 끌어와 동맹을 갈라놓기.</div>`;
    box.insertBefore(d, box.querySelector('.wlabel'));
  };
})();
