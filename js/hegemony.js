/* =========================================================
 *  패권 외교 (현실의 강대국처럼): 압박 요구·표적 제재·안보 보장·무기 판매·정권 교체 공작
 *  - 상대 AI는 국력 차·관계·제재 피해·지도자 성향·핵 보유로 굴복/거부를 판단
 *  - 안보를 보장한 나라는 세력권: 반한 연합에 안 들어가고 매 분기 이권(국고)을 줌
 *  - 세력권 나라가 침공당하면 대통령이 결정(참전·무기 지원·외면 → 신뢰도)
 * ========================================================= */
const might = (s, k) => k === 'kr' ? krMight(s) : theirMight(s, k);
function hegState(s) { if (!s.heg) s.heg = { sphere: {}, sanc: {}, cd: {}, cred: 70, log: [] }; return s.heg; }
function hegLog(s, k, text, type = 'info') { const H = hegState(s); H.log.unshift({ turn: s.turn, k, text, type }); if (H.log.length > 30) H.log.length = 30; addLog(s, type === 'bad' ? 'bad' : type === 'good' ? 'good' : 'info', text); if (type !== 'info' && s.world && typeof worldNews === 'function') worldNews(s, text, type); }
const inSphere = (s, k) => hegState(s).sphere[k] != null;
const hegCd = (s, k, id) => (hegState(s).cd[`${k}:${id}`] || 0) > s.turn;
const setCd = (s, k, id, n) => { hegState(s).cd[`${k}:${id}`] = s.turn + n; };

// 상대가 우리 요구를 받아들일 확률과 근거
function complyChance(s, k) {
  const ratio = might(s, 'kr') / Math.max(1, might(s, k)), rel = relOf(s, k), H = hegState(s);
  const tr = t => typeof hasTrait === 'function' && hasTrait(s, k, t);
  const parts = [['국력 차', (ratio - 1.5) * 0.25], ['관계', (rel - 50) / 160], ['제재 피해', Math.min(0.3, (H.sanc[k] || 0) / 60)]];
  if (tr('hardliner') || tr('nationalist')) parts.push(['강경·민족주의', -0.2]);
  if (tr('pragmatic') || tr('opportunist')) parts.push(['실용주의', 0.1]);
  if (tr('koreaFriend')) parts.push(['지한파', 0.1]);
  if (cinfo(k).nukes) parts.push(['핵보유국', -0.3]);
  if (dip(s, k).alliance) parts.push(['동맹국', 0.1]);
  const rivalGuard = ['us', 'cn', 'ru'].find(p => p !== k && dip(s, p) && typeof campOf === 'function' && campOf(s, k) === campOf(s, p) && campOf(s, p) !== campOf(s, 'kr'));
  if (rivalGuard) parts.push([`${cname(rivalGuard)}의 비호`, -0.15]);
  const p = clamp(0.22 + parts.reduce((a, x) => a + x[1], 0), 0.03, 0.9);
  return { p, why: parts.filter(x => Math.abs(x[1]) >= 0.02).map(([n, v]) => `${n} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`).join(' · ') };
}
const DEMANDS = [
  { id: 'market', icon: '📦', name: '시장 개방', desc: '관세 철폐(FTA 자동 체결). 무역 이익 증가.', ok: (s, k) => { dip(s, k).fta = true; relBump(s, k, -6, -3); } , can: (s, k) => dip(s, k).fta ? '이미 FTA가 있습니다.' : null },
  { id: 'base', icon: '🪖', name: '군사기지 제공', desc: '우리 군 주둔. 안보 +2, 원거리 전쟁 상륙·작전 유리.', ok: (s, k) => { hegState(s).bases = { ...(hegState(s).bases || {}), [k]: s.turn }; s.stats.security += 2; relBump(s, k, -8, -4); relBump(s, 'cn', -3, -2); } , can: (s, k) => hegState(s).bases?.[k] ? '이미 기지가 있습니다.' : null },
  { id: 'resource', icon: '⛏️', name: '자원 이권', desc: '광물·에너지 개발권. 성장률 상승.', ok: (s, k) => { s.mods.gdp += 0.04 * ecoK(k) + 0.02; relBump(s, k, -8, -4); } },
  { id: 'camp', icon: '🧭', name: '우리 진영 합류', desc: '반대 진영에서 이탈해 세력권에 들어옵니다.', ok: (s, k) => { const L = s.leaders?.[k]; if (L) L.traits = [...L.traits.filter(t => t !== 'proCN' && t !== 'proUS'), 'koreaFriend'].slice(-3); hegState(s).sphere[k] = s.turn; relBump(s, k, -3, 4); } , can: (s, k) => inSphere(s, k) ? '이미 세력권입니다.' : null },
];
function makeDemand(s, k, did) {
  const D = DEMANDS.find(x => x.id === did); if (!D) return { ok: false };
  if (eraOf(s) < 2) return { ok: false, msg: '지역 강국 단계부터 가능합니다.' };
  if (hegCd(s, k, 'demand')) return { ok: false, msg: '최근에 요구했습니다. 4분기 뒤에 다시 할 수 있습니다.' };
  const why = D.can?.(s, k); if (why) return { ok: false, msg: why };
  setCd(s, k, 'demand', 4);
  const c = complyChance(s, k);
  if (Math.random() < c.p) { D.ok(s, k); s.cnt = s.cnt || {}; s.cnt.demand = (s.cnt.demand || 0) + 1; hegLog(s, k, `👑 ${cflag(k)} ${cname(k)}, 대한민국의 '${D.name}' 요구에 굴복`, 'good'); if (typeof addThreat === 'function') addThreat(s, 2); return { ok: true, msg: `${jga(cname(k))} 요구를 받아들였습니다! (${D.icon} ${D.name})` }; }
  relBump(s, k, -10, -6); dip(s, k).casusBelli = s.turn + 4;
  hegLog(s, k, `${cflag(k)} ${cname(k)}, '${D.name}' 요구 거부 — 제재·무력 명분이 생겼습니다`, 'bad');
  return { ok: true, msg: `${jga(cname(k))} 거부했습니다. (확률 ${Math.round(c.p * 100)}%) 이제 제재하거나 최후통첩 없이도 전쟁 명분이 있습니다.` };
}
function guarantee(s, k) {
  if (eraOf(s) < 2) return { ok: false, msg: '지역 강국 단계부터 가능합니다.' };
  if (inSphere(s, k)) { delete hegState(s).sphere[k]; hegState(s).cred = clamp(hegState(s).cred - 8, 0, 100); relBump(s, k, -15, -10); return { ok: true, msg: `${cname(k)}에 대한 안보 보장을 철회했습니다. 신뢰도가 떨어졌습니다.` }; }
  if (['us', 'cn', 'ru'].includes(k) || cinfo(k).nukes) return { ok: false, msg: '강대국·핵보유국은 보호할 수 없습니다.' };
  if (might(s, k) > might(s, 'kr') * 0.7) return { ok: false, msg: '우리보다 크게 약한 나라만 보호할 수 있습니다.' };
  if (relOf(s, k) < 40) return { ok: false, msg: '관계 40 이상이어야 받아들입니다.' };
  const cost = Math.round(15 + cinfo(k).eco * 0.15); if (s.pcap < cost) return { ok: false, msg: `국고 ${won(cost)}이(가) 필요합니다.` };
  s.pcap -= cost; hegState(s).sphere[k] = s.turn; relBump(s, k, 12, 8); dip(s, k).sanction = false;
  for (const p of ['cn', 'ru']) if (typeof campOf === 'function' && campOf(s, k) === campOf(s, p)) relBump(s, p, -5, -3);
  hegLog(s, k, `🛡️ ${cflag(k)} ${cname(k)}의 독립을 보장했습니다. 대한민국 세력권에 들어왔습니다.`, 'good');
  return { ok: true, msg: `🛡️ ${cname(k)} 안보 보장 — 세력권 편입` };
}
function armsSale(s, k) {
  if (hegCd(s, k, 'arms')) return { ok: false, msg: '최근에 거래했습니다.' };
  if (dip(s, k).sanction) return { ok: false, msg: '제재 중인 나라입니다.' };
  if (relOf(s, k) < 45) return { ok: false, msg: '관계 45 이상이어야 합니다.' };
  setCd(s, k, 'arms', 4);
  const gain = Math.round(10 + cinfo(k).eco * 0.25 + (typeof techBonus === 'function' ? techBonus(s).mil * 0.1 : 0));
  s.pcap += gain; relBump(s, k, 6, 3); s.geo && (s.geo.boost[k] = (s.geo.boost[k] || 0) - 2); s.factions.mil = clamp(s.factions.mil + 2, 0, 100);
  for (const p of ['cn', 'ru']) if (typeof campOf === 'function' && campOf(s, p) !== campOf(s, k) && Math.random() < 0.3) relBump(s, p, -2, -1);
  return { ok: true, msg: `🚚 ${cname(k)}에 K-방산 무기를 판매했습니다. 국고 +${won(gain)}` };
}
function sanctionAllies(s, k) {
  const H = hegState(s); if (!dip(s, k).sanction) return { ok: false, msg: '먼저 경제 제재를 하세요.' };
  if (hegCd(s, k, 'coal')) return { ok: false, msg: '이미 동참을 요청했습니다.' };
  if (s.pcap < 15) return { ok: false, msg: `국고 ${won(15)}이(가) 필요합니다.` };
  s.pcap -= 15; setCd(s, k, 'coal', 8);
  const join = ['us', 'jp', 'eu', 'gbr', 'aus', 'can', ...Object.keys(H.sphere)].filter(x => x !== k && cinfo(x) && relOf(s, x) >= 55 && relOf(s, x) > relOf(s, k) + 10);
  H.sancPartners = { ...(H.sancPartners || {}), [k]: join };
  hegLog(s, k, `🚫 ${cname(k)} 제재에 ${join.length}개국 동참: ${join.slice(0, 6).map(cname).join(', ')}`, join.length ? 'good' : 'info');
  return { ok: true, msg: `${join.length}개국이 제재에 동참했습니다.` };
}
function covertOp(s, k) {
  if (eraOf(s) < 3) return { ok: false, msg: '세계 강국 단계부터 가능합니다.' };
  if (hegCd(s, k, 'covert')) return { ok: false, msg: '공작이 들통난 지 얼마 안 됐습니다.' };
  if (s.pcap < 40) return { ok: false, msg: `국고 ${won(40)}이(가) 필요합니다.` };
  s.pcap -= 40; setCd(s, k, 'covert', 8);
  const gov = s.leaders?.[k]?.gov;
  const p = clamp(0.3 + (dip(s, k).sanction ? 0.15 : 0) + Math.min(0.2, (hegState(s).sanc[k] || 0) / 100) - (['comm', 'junta', 'theo', 'auth', 'mon'].includes(gov) ? 0.08 : 0) - (cinfo(k).core ? 0.15 : 0), 0.08, 0.7);
  if (Math.random() < p) {
    if (typeof replaceLeader === 'function') replaceLeader(s, k, '대한민국의 지원을 받은 세력이 정권을 잡음');
    const L = s.leaders?.[k]; if (L) L.traits = [...L.traits.filter(t => !['proCN', 'hardliner', 'aggressive'].includes(t)), 'koreaFriend'].slice(-3);
    s.rel[k] = Math.max(relOf(s, k), 65); hegState(s).sphere[k] = s.turn; dip(s, k).sanction = false;
    hegLog(s, k, `🕶️ ${cname(k)}에 친한 정권이 들어섰습니다. (공작 성공 확률 ${Math.round(p * 100)}%)`, 'good');
    return { ok: true, msg: `🕶️ 정권 교체 성공! ${jga(cname(k))} 세력권에 들어왔습니다.` };
  }
  relBump(s, k, -30, -25); if (typeof addThreat === 'function') addThreat(s, 8, `${cname(k)} 정권 교체 공작 발각`); if (s.dom) s.dom.scandal += 10; s.approval = clamp(s.approval - 3, 0, 100);
  hegLog(s, k, `🕶️ ${cname(k)} 정권 교체 공작이 발각됐습니다! 국제적 비난이 쏟아집니다.`, 'bad');
  return { ok: true, msg: `공작이 실패하고 발각됐습니다. (성공 확률 ${Math.round(p * 100)}%)` };
}

// 분기 처리: 제재 피해 누적→굴복·정권 붕괴, 세력권 이권, 세력권 침공 감시
function hegTurn(s, report) {
  const H = hegState(s); report.heg = [];
  for (const k of Object.keys(s.diplo || {})) {
    const d = s.diplo[k]; if (!cinfo(k) || s.annexed[k]) continue;
    if (d.sanction) {
      const partners = (H.sancPartners?.[k] || []).length;
      H.sanc[k] = (H.sanc[k] || 0) + (might(s, 'kr') / Math.max(5, might(s, k))) * 2 + partners * 1.2;
      if (s.leaders?.[k] && H.sanc[k] > 25 && Math.random() < Math.min(0.35, (H.sanc[k] - 25) / 120)) {
        const c = complyChance(s, k);
        if (Math.random() < c.p + 0.2) { d.sanction = false; H.sanc[k] = 0; relBump(s, k, 8, 4); const D = DEMANDS.find(x => x.id === (d.fta ? 'resource' : 'market')); D.ok(s, k); hegLog(s, k, `🏳️ ${cname(k)}, 제재에 굴복 — ${D.name}을(를) 받아들이고 제재 해제를 요청했습니다.`, 'good'); report.heg.push(`🏳️ ${cname(k)} 제재 굴복`); }
        else if (typeof replaceLeader === 'function' && Math.random() < 0.5) { replaceLeader(s, k, '제재로 경제가 무너지며 정권 붕괴'); H.sanc[k] *= 0.4; hegLog(s, k, `💥 ${cname(k)} 정권이 제재 끝에 무너졌습니다.`, 'good'); report.heg.push(`💥 ${cname(k)} 정권 붕괴`); }
      }
    } else if (H.sanc[k]) H.sanc[k] = Math.max(0, H.sanc[k] - 3);
  }
  // 세력권: 이권 수입, 관계 유지, 침공당하면 대통령에게
  let tribute = 0;
  for (const k of Object.keys(H.sphere)) {
    if (!cinfo(k) || s.annexed[k] || s.world?.owner?.[k]) { delete H.sphere[k]; continue; }
    tribute += 2 + cinfo(k).eco * 0.04; s.rel[k] = clamp(relOf(s, k) + 0.3, 0, 100);
    const war = (s.world?.conflicts || []).find(c => c.type === 'war' && c.b === k && !c.krAlerted);
    if (war) { war.krAlerted = true; (H.alerts = H.alerts || []).push({ a: war.a, b: k, cid: war.id }); }
  }
  if (tribute) { s.pcap += tribute; report.heg.push(`👑 세력권 이권 +${won(tribute)}`); }
  H.lastTribute = tribute;
}
// 세력권 나라 피침 카드
if (typeof DOM_EVENTS !== 'undefined') DOM_EVENTS.clientAttacked = {
  w: 60, kind: 'security', extreme: true, icon: '🛡️', cond: s => (hegState(s).alerts || []).length > 0,
  make: s => { const A = hegState(s).alerts.shift(); return { title: `보호국 ${cname(A.b)}, ${cname(A.a)}의 침공을 받다`, desc: `대한민국이 독립을 보장한 ${cname(A.b)}이(가) ${cname(A.a)}의 전면 침공을 받았습니다. 세계가 대한민국의 약속이 진짜인지 지켜보고 있습니다. (세력권 신뢰도 ${hegState(s).cred.toFixed(0)})`, a: A.a, b: A.b, cid: A.cid }; },
  choices: [
    { label: '참전해 지킨다', desc: '침략국과 전쟁. 신뢰도 크게 상승.', run: (s, ev) => { if (s.war) return '이미 다른 전쟁 중이라 참전할 수 없습니다. 무기 지원으로 대신합니다.'; s.world.conflicts = s.world.conflicts.filter(c => c.id !== ev.cid); startWar(s, ev.a, 'them', 'concession'); hegState(s).cred = clamp(hegState(s).cred + 15, 0, 100); for (const k of Object.keys(hegState(s).sphere)) relBump(s, k, 6, 3); return `${cname(ev.b)}을(를) 지키기 위해 ${cname(ev.a)}에 맞서 참전했습니다!`; } },
    { label: '무기·자금 지원', desc: '국고 ₩2조. 피침국 전력 강화, 신뢰도 유지.', pc: 20, run: (s, ev) => { const c = s.world.conflicts.find(x => x.id === ev.cid); if (c) { c.krRole = 'armsB'; c.progress = (c.progress || 0) - 10; } relBump(s, ev.b, 10, 5); relBump(s, ev.a, -12, -8); hegState(s).cred = clamp(hegState(s).cred + 3, 0, 100); return `${cname(ev.b)}에 무기와 자금을 보냈습니다.`; } },
    { label: '외면한다', desc: '신뢰도 -20, 세력권 모든 나라 관계 -10.', run: (s, ev) => { const H = hegState(s); H.cred = clamp(H.cred - 20, 0, 100); for (const k of Object.keys(H.sphere)) relBump(s, k, -10, -6); if (Math.random() < 0.5) delete H.sphere[ev.b]; return `${cname(ev.b)}을(를) 외면했습니다. 세력권 나라들이 동요합니다.`; } },
  ] };

/* ---------------- 국가 패널에 '패권 외교' 칸 추가 ---------------- */
if (typeof renderCountryPanel === 'function') (function () {
  const f = renderCountryPanel;
  renderCountryPanel = function () {
    f();
    const slot = $('cpanel-slot'), k = selCountry, c = cinfo(k);
    if (!slot || !c || c.isBloc || k === 'kr' || S.annexed[k] || S.terr?.[k] || S.world?.owner?.[k]) return;
    const H = hegState(S), era = eraOf(S), cc = complyChance(S, k), d = dip(S, k);
    const btn = (attr, label, sub, dis) => `<button class="hact" ${attr} ${dis ? 'disabled' : ''}><b>${label}</b><small>${esc(sub)}</small></button>`;
    const box = document.createElement('div'); box.className = 'heg-box';
    box.innerHTML = `<h4 class="sec">👑 패권 외교 ${era < 2 ? `<span class="muted small">🔒 지역 강국 단계부터 (현재 ${ERAS[era - 1].name})</span>` : `<span class="muted small">${ERAS[era - 1].icon} ${ERAS[era - 1].name} · 세력권 신뢰도 ${H.cred.toFixed(0)}</span>`}</h4>
      <div class="muted small">상대 AI 판단: 우리 요구를 받아들일 확률 <b>${Math.round(cc.p * 100)}%</b> (${esc(cc.why || '변수 없음')})${H.sanc[k] ? ` · 제재 피해 누적 ${H.sanc[k].toFixed(0)}` : ''}${inSphere(S, k) ? ' · 🛡️ 대한민국 세력권' : ''}</div>
      <div class="hacts">
        ${DEMANDS.map(D => btn(`data-hd="${D.id}"`, `${D.icon} ${D.name} 요구`, D.desc, era < 2 || hegCd(S, k, 'demand') || D.can?.(S, k))).join('')}
        ${btn('data-hg="1"', inSphere(S, k) ? '🛡️ 안보 보장 철회' : '🛡️ 안보 보장(세력권)', inSphere(S, k) ? '신뢰도 하락' : `약소국 보호. 매 분기 이권, 반한 연합 불참 · ${won(Math.round(15 + c.eco * 0.15))}`, era < 2)}
        ${btn('data-ha="1"', '🚚 무기 판매', '국고 수입, 관계 +6 (4분기마다)', hegCd(S, k, 'arms') || d.sanction)}
        ${btn('data-hs="1"', '🚫 동맹국 제재 동참 요청', d.sanction ? `제재 효과 강화 · ${won(15)}` : '먼저 외교 행동에서 경제 제재', !d.sanction || hegCd(S, k, 'coal'))}
        ${btn('data-hc="1"', '🕶️ 정권 교체 공작', era < 3 ? '🔒 세계 강국 단계부터' : `친한 정권 수립. 발각되면 큰 역풍 · ${won(40)}`, era < 3 || hegCd(S, k, 'covert'))}
      </div>`;
    slot.querySelector('.cpanel')?.appendChild(box);
    box.querySelectorAll('[data-hd]').forEach(b => b.onclick = () => act(makeDemand)(S, k, b.dataset.hd));
    box.querySelector('[data-hg]').onclick = () => act(guarantee)(S, k);
    box.querySelector('[data-ha]').onclick = () => act(armsSale)(S, k);
    box.querySelector('[data-hs]').onclick = () => act(sanctionAllies)(S, k);
    box.querySelector('[data-hc]').onclick = () => act(covertOp)(S, k);
  };
})();

HOOKS.migrate.push(s => { hegState(s); });
HOOKS.postTurn.push(hegTurn);
