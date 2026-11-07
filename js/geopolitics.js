/* =========================================================
 *  국제 정세의 반응: 대한민국이 팽창하면 각국 AI가 저마다 판단
 *  - 위협도(0~100): 합병·괴뢰국·침략 전쟁·식민 통치·핵무장으로 오르고, 평화적 행동으로 내려감
 *  - 각국 AI는 거리·관계·국력 차·지도자 성향으로 균형(반한 연합)·편승(보호 요청)·관망을 고르고 근거를 남김
 *  - 반한 연합: FTA 파기·제재·군비 증강, 강해지면 연합군 선전포고
 *  - 유엔 안보리 결의, 연합의 점령지 반환 최후통첩, 약소국의 보호 요청, 미국의 동맹 재검토
 * ========================================================= */
const jga = w => w + (typeof iga === 'function' ? iga(w) : '이(가)');
const STANCE = {
  coalition: { name: '반한 연합', color: '#a3242b', icon: '⚔️' },
  wary: { name: '경계', color: '#d9822b', icon: '⚠️' },
  neutral: { name: '관망', color: '#7d8796', icon: '➖' },
  friendly: { name: '우호', color: '#3e9b5f', icon: '🙂' },
  bandwagon: { name: '편승·보호 희망', color: '#5aa9d6', icon: '🤲' },
  ours: { name: '동맹·보호국', color: '#3d7be0', icon: '🛡️' },
};
function geoState(s) {
  if (!s.geo) s.geo = { threat: 0, coalition: [], stance: {}, boost: {}, log: [], lastUN: -99, lastCoalWar: -99, lastUlt: -99, protectCand: null, notedNuke: false };
  return s.geo;
}
const geoBoost = k => (typeof S !== 'undefined' && S?.geo?.boost?.[k]) || 0;
function geoLog(s, k, text, type = 'info') {
  const G = geoState(s); G.log.unshift({ turn: s.turn, k, text, type }); if (G.log.length > 40) G.log.length = 40;
  if (type !== 'info' && typeof worldNews === 'function' && s.world) worldNews(s, `${k ? cflag(k) + ' ' : ''}${text}`, type);
}
function addThreat(s, v, why) {
  const G = geoState(s); G.threat = clamp(G.threat + v, 0, 100);
  if (why && Math.abs(v) >= 3) geoLog(s, null, `🌐 위협도 ${v > 0 ? '+' : ''}${v.toFixed(0)}: ${why} (현재 ${G.threat.toFixed(0)})`, v > 0 ? 'bad' : 'good');
}

// 팽창 행동에 위협도를 매김 (원래 함수를 감쌈)
(function wrapExpansion() {
  const g = typeof window !== 'undefined' ? window : globalThis;
  const wrap = (name, fn) => { const f = g[name]; if (typeof f === 'function') g[name] = function (...a) { const before = { ...(a[0]?.terr || {}) }; const r = f.apply(this, a); try { fn(a, r, before); } catch { } return r; }; };
  wrap('annex', ([s, k, peaceful]) => addThreat(s, k === 'nk' ? (peaceful ? 2 : 5) : (peaceful ? 3 : 6) + 13 * ecoK(k), `${cname(k)} ${k === 'nk' ? '통일' : '합병'}`));
  wrap('startWar', ([s, k, aggr]) => { if (aggr === 'kr') addThreat(s, k === 'nk' && s.war?.allies?.includes('us') ? 3 : 8, `${cname(k)}에 선전포고`); });
  wrap('applyPeace', ([s, choice], r) => { if (!r?.ok) return; if (choice === 'puppet') addThreat(s, 8, '괴뢰 정부 수립'); if (choice === 'lenient') addThreat(s, -12, '관대한 평화'); if (choice === 'reparation') addThreat(s, 3, '배상 강요'); });
  wrap('releaseTerritory', ([s, k, hostile], r) => { if (r?.ok && !hostile) addThreat(s, -10, `${cname(k)} 독립 승인`); });
  wrap('intervene', ([s, cid, act], r) => { if (r?.ok && act === 'mediate' && /멈췄습니다/.test(r.msg || '')) addThreat(s, -3, '분쟁 중재 성공'); });
})();

// 나라 k가 대한민국 세력권과 얼마나 가까운가 (0.25~1)
function nearness(s, k) {
  const held = ['kr', ...Object.keys(s.terr || {})];
  const c = cinfo(k); if (!c) return 0.25;
  const subSame = held.some(h => cinfo(h)?.sub === c.sub);
  if (typeof neighborsOf === 'function' && held.some(h => neighborsOf(h)?.includes?.(k))) return subSame ? 1 : 0.8;
  if (subSame) return 0.75;
  if (held.some(h => cinfo(h)?.reg === c.reg)) return 0.45;
  return 0.2;
}
const krMight = s => (typeof krPower === 'function' ? krPower(s) : milPower(s));
const theirMight = (s, k) => cinfo(k).eco * 0.55 + (typeof power === 'function' && s.world ? power(s, k) : cinfo(k).mil) * 0.45;

// 각국 AI 판단: 점수와 근거를 함께 냄
function judge(s, k) {
  const G = geoState(s), rel = relOf(s, k), near = nearness(s, k), ratio = theirMight(s, k) / Math.max(1, krMight(s));
  const agg = typeof leaderAgg === 'function' ? leaderAgg(s, k) : 30, d = dip(s, k);
  if (d.alliance || s.terr?.[k] || s.heg?.sphere?.[k] != null) return { stance: 'ours', why: d.alliance ? '대한민국과 동맹' : s.terr?.[k] ? '대한민국의 보호국' : '대한민국 세력권(안보 보장)' };
  if (s.geo?.bal?.great?.[k] != null) return { stance: 'coalition', why: '세력 균형(패권 견제)', balance: 99, bandwagon: 0, fear: G.threat };
  const fear = G.threat * near * (1.2 - rel / 120);
  const why = [`위협 체감 ${fear.toFixed(0)}`, `거리 ${near >= 0.85 ? '인접' : near >= 0.6 ? '같은 대륙' : '원거리'}`, `관계 ${rel.toFixed(0)}`, `국력비 ${ratio.toFixed(2)}`];
  const tr = t => typeof hasTrait === 'function' && hasTrait(s, k, t);
  if (tr('pacifist')) why.push('평화주의'); if (tr('hardliner') || tr('nationalist')) why.push('강경·민족주의'); if (tr('koreaFriend')) why.push('지한파');
  const weight = Math.min(1, 0.3 + (cinfo(k).eco + cinfo(k).mil) / 70); // 작은 나라는 연합을 주도하지 못함
  let balance = fear * (0.5 + Math.min(1.5, ratio)) * weight + (agg - 30) * 0.3 + (tr('hardliner') || tr('nationalist') ? 8 : 0) - (tr('pacifist') || tr('isolationist') ? 12 : 0) - (tr('koreaFriend') ? 10 : 0);
  let bandwagon = fear * (ratio < 0.3 ? 1.1 : 0.2) + (tr('pragmatic') || tr('opportunist') ? 8 : 0) + (rel - 50) * 0.3;
  if (near <= 0.2) balance *= 0.6; // 먼 나라는 웬만해선 끼어들지 않음
  if (['us', 'cn', 'ru'].includes(k)) { balance += 10; bandwagon -= 40; }
  const stance = balance > 45 ? 'coalition' : bandwagon > 32 && near >= 0.6 ? 'bandwagon' : fear > 18 ? 'wary' : rel >= 62 ? 'friendly' : 'neutral';
  return { stance, why: why.join(' · '), balance, bandwagon, fear };
}

function geoTurn(s, report) {
  const G = geoState(s); report.geo = [];
  // 위협도 자연 감소, 진행 중인 강압 통치·핵무장은 계속 올림
  let drift = -1.5;
  for (const t of Object.values(s.terr || {})) { if (t.rule === 'colony') drift += 0.6; if (t.pol?.martial) drift += 0.3; }
  if (hasNukes(s, 'kr') && !G.notedNuke) { G.notedNuke = true; addThreat(s, 12, '핵보유국 등장'); }
  G.threat = clamp(G.threat + drift, 0, 100);
  // 위협도가 낮으면 각국 판단도 굳이 바꾸지 않음
  const keys = allCountryKeys().filter(k => { const c = cinfo(k); return c && !c.isBloc && k !== 'kr' && !s.annexed[k] && !s.world?.owner?.[k]; });
  const before = new Set(G.coalition);
  const coal = [];
  for (const k of keys) {
    const j = judge(s, k), prev = G.stance[k];
    // 판단은 한 번에 휙 바뀌지 않음: 연합 가입·탈퇴는 확률적으로
    let st = j.stance;
    if (st === 'coalition' && prev !== 'coalition' && Math.random() > 0.45) st = 'wary';
    if (prev === 'coalition' && st !== 'coalition' && (j.balance > 30 || (G.threat > 25 && Math.random() > 0.35))) st = 'coalition'; // 한 번 가입하면 쉽게 안 나감
    G.stance[k] = st;
    if (st === 'coalition') coal.push(k);
    if (st !== prev && (st === 'coalition' || prev === 'coalition' || st === 'bandwagon') && (isCore(k) || cinfo(k).eco >= 30 || nearness(s, k) >= 0.85)) {
      const msg = st === 'coalition' ? `${cname(k)}, 반한 연합 가입` : prev === 'coalition' ? `${cname(k)}, 반한 연합 탈퇴` : `${cname(k)}, 대한민국 쪽으로 기울어`;
      geoLog(s, k, `${msg} — AI 판단 근거: ${j.why}`, st === 'coalition' ? 'bad' : 'good');
      report.geo.push(`${cflag(k)} ${msg}`);
    }
  }
  G.coalition = coal;
  // 연합 효과: FTA 파기, 관계 악화, 군비 증강
  for (const k of coal) {
    s.relMods[k] = (s.relMods[k] || 0) - 0.6;
    if (!before.has(k) && dip(s, k).fta) { dip(s, k).fta = false; geoLog(s, k, `${jga(cname(k))} 대한민국과의 FTA를 파기했습니다.`, 'bad'); }
    G.boost[k] = Math.min(40, (G.boost[k] || 0) + 1.2 + G.threat / 60);
  }
  for (const k of Object.keys(G.boost)) if (!coal.includes(k)) G.boost[k] = Math.max(0, G.boost[k] - 1);
  if (coal.length >= 3) s.stats.gdp -= 0.02 * Math.min(10, coal.length);
  // 미국: 위협도가 아주 높으면 동맹 재검토
  if (G.threat > 75 && dip(s, 'us').alliance && Math.random() < 0.15 && !(s.war && s.war.allies.includes('us'))) {
    dip(s, 'us').alliance = false; relBump(s, 'us', -15, -10);
    geoLog(s, 'us', '미국이 "통제 불능의 팽창"을 이유로 한미동맹을 사실상 정지했습니다.', 'bad'); report.geo.push('🇺🇸 미국, 한미동맹 정지');
  }
  // 연합군 선전포고
  const coalPow = coal.reduce((a, k) => a + theirMight(s, k) * nearness(s, k), 0);
  if (!s.war && coal.length >= 3 && G.threat > 55 && coalPow > krMight(s) * 1.3 && s.turn - G.lastCoalWar >= 12 && Math.random() < 0.12) {
    const lead = [...coal].sort((a, b) => theirMight(s, b) * nearness(s, b) - theirMight(s, a) * nearness(s, a))[0];
    G.lastCoalWar = s.turn;
    const msg = startWar(s, lead, 'them', 'concession');
    if (s.war) { const extra = coal.filter(k => k !== lead && nearness(s, k) >= 0.6).slice(0, 4); s.war.enemyAllies = [...new Set([...s.war.enemyAllies, ...extra])]; s.war.coalition = true; }
    geoLog(s, lead, `⚔️ ${cname(lead)} 주도 반한 연합군이 선전포고했습니다! (${coal.slice(0, 5).map(cname).join(', ')})`, 'bad');
    report.geo.push(`⚔️ 반한 연합군 선전포고 (${cname(lead)} 주도)`); report.world?.events?.push(msg);
  }
  // 약소국의 보호 요청 후보
  const cand = keys.filter(k => G.stance[k] === 'bandwagon' && !dip(s, k).alliance && !s.terr?.[k]).sort((a, b) => cinfo(b).eco - cinfo(a).eco)[0];
  G.protectCand = cand || null;
}

/* ---------------- 사건 카드 ---------------- */
if (typeof DOM_EVENTS !== 'undefined') Object.assign(DOM_EVENTS, {
  unResolution: { w: 6, kind: 'security', extreme: true, icon: '🇺🇳', cond: s => geoState(s).threat >= 45 && s.turn - geoState(s).lastUN >= 6,
    make: s => { geoState(s).lastUN = s.turn; const n = geoState(s).coalition.length; return { title: '유엔 안보리, 대한민국 규탄 결의안 상정', desc: `위협도 ${geoState(s).threat.toFixed(0)}. 반한 연합 ${n}개국이 대한민국의 팽창을 "국제 평화에 대한 위협"으로 규정하고 제재 결의안을 냈습니다. 통과되면 전면 경제 제재가 시작됩니다.` }; },
    choices: [
      { label: '결의 수용·점령지 일부 반환', desc: '가장 저항이 큰 점령지를 독립시키고 위협도 -15.', run: s => { const t = Object.values(s.terr || {}).filter(x => x.k !== 'nk').sort((a, b) => b.resist - a.resist)[0]; if (t) releaseTerritory(s, t.k, false); addThreat(s, -15, '유엔 결의 수용'); return t ? `${cname(t.k)}의 독립을 승인하고 결의를 받아들였습니다.` : '결의를 받아들이고 자제를 약속했습니다.'; } },
      { label: '상임이사국 설득', desc: '국고 ₩3조. 미국·중국과의 관계가 좋으면 거부권으로 막아냅니다.', pc: 30, run: s => { const veto = Math.random() < clamp((Math.max(relOf(s, 'us'), relOf(s, 'cn')) - 40) / 60, 0.1, 0.85); if (veto) { addThreat(s, -4, '외교적 수습'); return `${relOf(s, 'us') >= relOf(s, 'cn') ? '미국' : '중국'}이 거부권을 행사해 결의안이 부결됐습니다.`; } s.stats.gdp -= 0.3; s.mods.gdp -= 0.1; return '설득에 실패했습니다. 결의안이 통과되어 제재가 시작됩니다.'; } },
      { label: '거부·정면 돌파', desc: '제재(성장률 -0.4, 지속 -0.15), 서방 관계 악화, 지지층 결집.', run: s => { s.stats.gdp -= 0.4; s.mods.gdp -= 0.15; relBump(s, 'us', -8, -5); relBump(s, 'eu', -10, -6); s.approval += 2; addThreat(s, 4, '유엔 결의 거부'); return '"내정 간섭"이라며 결의를 거부했습니다. 국제 제재가 시작됐습니다.'; } },
    ] },
  coalitionUlt: { w: 5, kind: 'security', extreme: true, icon: '📜', cond: s => geoState(s).coalition.length >= 3 && Object.keys(s.terr || {}).some(k => k !== 'nk') && s.turn - geoState(s).lastUlt >= 8 && !s.war,
    make: s => { const G = geoState(s); G.lastUlt = s.turn; const k = Object.keys(s.terr).filter(x => x !== 'nk').sort((a, b) => cinfo(b).eco - cinfo(a).eco)[0]; return { title: `반한 연합의 최후통첩: ${cname(k)} 반환`, desc: `${G.coalition.slice(0, 5).map(cname).join(', ')} 등 ${G.coalition.length}개국이 ${cname(k)}에서 즉시 철수하지 않으면 군사 행동에 나서겠다고 통보했습니다.`, k }; },
    choices: [
      { label: '철수·반환', desc: '점령지를 잃고 위협도 -18. 연합 결속 약화.', run: (s, ev) => { releaseTerritory(s, ev.k, false); addThreat(s, -18, '최후통첩 수용'); return `${cname(ev.k)}에서 철수했습니다.`; } },
      { label: '배상금으로 무마', desc: '국고 ₩6조. 위협도 -6.', pc: 60, run: s => { addThreat(s, -6, '외교적 무마'); return '거액의 경제 협력을 약속하고 시간을 벌었습니다.'; } },
      { label: '거부', desc: '위협도 +6. 연합군 선전포고 위험이 크게 오릅니다.', run: s => { addThreat(s, 6, '최후통첩 거부'); geoState(s).lastCoalWar = -99; s.approval += 1.5; return '"한 치의 땅도 내줄 수 없다"며 거부했습니다.'; } },
    ] },
  protectRequest: { w: 4, kind: 'good', icon: '🤲', cond: s => !!geoState(s).protectCand && cinfo(geoState(s).protectCand),
    make: s => { const k = geoState(s).protectCand; return { title: `${cname(k)}, 대한민국의 보호를 요청`, desc: `대한민국의 힘을 본 ${cname(k)} 정부가 "맞서기보다 손을 잡겠다"며 보호국 편입 또는 동맹을 요청했습니다. (AI 판단 근거: ${judge(s, k).why})`, k }; },
    choices: [
      { label: '보호국으로 받아들임', desc: '괴뢰 정부(보호국)로 편입. 이권·병력, 위협도 +4.', run: (s, ev) => { createTerritory(s, ev.k, 'puppet', true); dip(s, ev.k).alliance = true; s.rel[ev.k] = Math.max(s.rel[ev.k], 75); addThreat(s, 4, `${cname(ev.k)} 보호국화`); return `${jga(cname(ev.k))} 대한민국의 보호국이 되었습니다.`; } },
      { label: '대등한 동맹', desc: '동맹 체결, 관계 +12. 위협도 변화 없음.', run: (s, ev) => { dip(s, ev.k).alliance = true; relBump(s, ev.k, 12, 8); return `${cname(ev.k)}과(와) 동맹을 맺었습니다.`; } },
      { label: '정중히 거절', desc: '관계 -4, 위협도 -2.', run: (s, ev) => { relBump(s, ev.k, -4, -2); addThreat(s, -2); return '"주권을 존중한다"며 거절했습니다.'; } },
    ] },
});

/* ---------------- 지도·화면 ---------------- */
function stanceOf(s, k) { const G = geoState(s); if (dip(s, k).alliance || s.terr?.[k] || s.heg?.sphere?.[k] != null) return 'ours'; return G.stance[k] || (relOf(s, k) >= 62 ? 'friendly' : 'neutral'); }
function renderGeoPanel() {
  const slot = $('geo-slot'); if (!slot || !S) return;
  const G = geoState(S), th = G.threat, col = th >= 60 ? 'var(--bad)' : th >= 35 ? 'var(--mid)' : 'var(--good)';
  const coal = G.coalition.map(k => ({ k, m: theirMight(S, k) * nearness(S, k) })).sort((a, b) => b.m - a.m);
  const coalPow = coal.reduce((a, x) => a + x.m, 0), mine = krMight(S);
  const counts = {}; for (const k of Object.keys(G.stance)) { const st = stanceOf(S, k); counts[st] = (counts[st] || 0) + 1; }
  slot.innerHTML = `<div class="geo-box">
    <h3>🌐 국제 사회의 반응 <span class="muted small">각국 AI가 거리·관계·국력·지도자 성향으로 판단</span></h3>
    <div class="wrow"><span>위협도</span>${meter(th, 'sur', 50)}<em style="color:${col}">${th.toFixed(0)}</em></div>
    <div class="muted small">합병·괴뢰국·침략·식민 통치·핵무장으로 오르고, 시간이 지나거나 관대한 평화·독립 승인·중재로 내려갑니다. 45 이상이면 유엔 결의, 50 이상이면 연합군 선전포고 위험.</div>
    <div class="geo-counts">${Object.entries(STANCE).map(([id, x]) => `<span style="--c:${x.color}">${x.icon} ${x.name} <b>${counts[id] || 0}</b></span>`).join('')}</div>
    ${coal.length ? `<div class="wlabel">⚔️ 반한 연합 ${coal.length}개국 · 연합 전력 ${coalPow.toFixed(0)} vs 대한민국 ${mine.toFixed(0)}</div>
      <div class="geo-coal">${coal.slice(0, 10).map(x => `<button class="chip" data-gk="${x.k}">${cflag(x.k)} ${esc(cname(x.k))}${G.boost[x.k] ? ` <small>군비+${G.boost[x.k].toFixed(0)}</small>` : ''}</button>`).join('')}</div>` : '<div class="muted small">아직 반한 연합은 없습니다.</div>'}
    <div class="wlabel">🧠 AI 판단 기록</div>
    <div class="wlog">${G.log.slice(0, 8).map(l => `<div class="${l.type}">${turnLabel(l.turn).year}.${turnLabel(l.turn).q}Q ${esc(l.text)}</div>`).join('') || '<div class="muted">아직 특별한 반응이 없습니다. 나라를 합병하거나 전쟁을 일으키면 세계가 움직입니다.</div>'}</div>
    <div class="row-btns"><button class="btn sm" id="geo-map">🗺️ 대한 태도 지도로 보기</button>${typeof ClaudeAI !== 'undefined' && ClaudeAI.enabled() ? '<button class="btn sm" id="geo-claude">🤖 Claude 국제정세 분석</button>' : ''}</div>
    <div id="geo-claude-out" class="adv-claude"></div>
  </div>`;
  slot.querySelectorAll('[data-gk]').forEach(b => b.onclick = () => { selCountry = b.dataset.gk; zoomTo(selCountry); renderCountryPanel(); updateMap(); });
  $('geo-map').onclick = () => { mapMode = 'stance'; document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('primary', x.dataset.mode === 'stance')); updateMap(); mapView = null; zoomTo('kr'); };
  const cb = $('geo-claude'); if (cb) cb.onclick = async () => {
    cb.disabled = true; $('geo-claude-out').textContent = 'Claude가 국제 정세를 분석하고 있습니다…';
    const facts = `위협도 ${th.toFixed(0)}, 반한 연합: ${coal.map(x => cname(x.k)).join(', ') || '없음'}, 편승 희망: ${Object.keys(G.stance).filter(k => G.stance[k] === 'bandwagon').map(cname).join(', ') || '없음'}, 점령지·보호국: ${Object.keys(S.terr || {}).map(cname).join(', ') || '없음'}, 최근 AI 판단: ${G.log.slice(0, 6).map(l => l.text).join(' / ')}`;
    try { $('geo-claude-out').textContent = await ClaudeAI.metricAdvice(S, '국제 정세(대한민국에 대한 각국의 경계)', `위협도 ${th.toFixed(0)}`, facts, '독립 승인, 관대한 평화, 분쟁 중재, 동맹 강화, 보호국 수용'); }
    catch { $('geo-claude-out').textContent = 'Claude 호출에 실패했습니다.'; }
  };
}

HOOKS.migrate.push(s => { geoState(s); });
HOOKS.postTurn.push(geoTurn);
