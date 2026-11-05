/* =========================================================
 *  조약 협상 (빅토리아식): 조항 카드를 조립하고 상대의 수락 가능성을 보며 협상
 *  - 요구 카드(우리가 받는 것)는 수락 가능성을 깎고, 제공 카드(우리가 주는 것)는 올림
 *  - 관계·진영·체제·지도자 성향·국력 차이가 기본 점수
 *  - AI 지도자가 먼저 조약안을 보내오기도 함
 * ========================================================= */
const RESOURCE_EXPORTERS = new Set(['sau', 'are', 'qat', 'kwt', 'omn', 'irq', 'irn', 'aus', 'can', 'ru', 'idn', 'mys', 'brn', 'nor', 'kaz', 'us', 'chl', 'per', 'mng', 'dza', 'nga', 'ago', 'bra', 'zaf']);
const poorK = k => clamp(1.6 - cinfo(k).eco / 70, 0.5, 1.5);   // 가난한 나라일수록 원조를 크게 평가
const isNationalist = (s, k) => hasTrait(s, k, 'nationalist') || hasTrait(s, k, 'hardliner');

// side: ask(우리가 받음) / give(우리가 줌). val(s,k): 상대 입장에서의 수락 점수 변화
const ARTICLES = [
  { id: 'fta', side: 'ask', icon: '📦', name: 'FTA 체결', desc: '관세 철폐. 무역 이익↑, 농어민 반발.',
    avail: (s, k) => !dip(s, k).fta && k !== 'nk' && !(cinfo(k).eu && !dip(s, 'eu').fta),
    val: (s, k) => -(12 + (isNationalist(s, k) ? 8 : 0) + (hasTrait(s, k, 'isolationist') ? 6 : 0) - (hasTrait(s, k, 'pragmatic') ? 8 : 0)),
    apply: (s, k) => { dip(s, k).fta = true; s.mods.gdp += 0.08 * ecoK(k); s.factions.farm -= Math.round(5 * ecoK(k)); s.factions.biz += Math.round(4 * ecoK(k)); } },
  { id: 'alliance', side: 'ask', icon: '🛡️', name: '상호 방위 조약', desc: '동맹. 안보↑, 상대 진영 반발.',
    avail: (s, k) => !dip(s, k).alliance && k !== 'nk',
    val: (s, k) => -(30 + (hasTrait(s, k, 'isolationist') ? 15 : 0)) + (inConflict(s, k, 'war') || inConflict(s, k, 'border') ? 15 : 0) + clamp((milPower(s) - cinfo(k).mil) * 0.3, -10, 12),
    apply: (s, k) => { dip(s, k).alliance = true; s.mods.security += Math.max(1, Math.round(cinfo(k).mil / 20)); if (['us', 'jp', 'tw'].includes(k) || NATO.has(k)) s.relMods.cn -= isCore(k) ? 8 : 2; if (k === 'cn' || k === 'ru') { s.relMods.us -= 12; s.relMods.jp -= 6; } } },
  { id: 'energy', side: 'ask', icon: '⛽', name: '자원·에너지 장기 공급', desc: 'LNG·원유·광물을 안정적으로 확보. 물가↓, 중화학 산업↑.',
    avail: (s, k) => RESOURCE_EXPORTERS.has(k),
    val: () => -14, apply: s => { s.mods.infl -= 0.12; s.sectorShock = s.sectorShock || {}; s.sectorShock.heavy = (s.sectorShock.heavy || 0) + 2; } },
  { id: 'invest', side: 'ask', icon: '🏦', name: '한국 투자 유치', desc: '상대국 기업·국부펀드가 한국에 투자. 성장률↑.',
    avail: (s, k) => cinfo(k).eco >= 40, val: (s, k) => -(10 + cinfo(k).eco * 0.08),
    apply: (s, k) => { s.mods.gdp += 0.05 * ecoK(k); s.sectorShock = s.sectorShock || {}; s.sectorShock.semi = (s.sectorShock.semi || 0) + 1.5; } },
  { id: 'support', side: 'ask', icon: '🗳️', name: '국제무대 지지 표명', desc: '유엔·국제기구에서 한국 입장 지지. 지지율↑.',
    val: () => -7, apply: s => { s.approval = clamp(s.approval + 1, 0, 100); } },
  { id: 'labor', side: 'ask', icon: '🧳', name: '인력 송출 협정', desc: '부족한 산업 인력 확보. 농어촌·조선소 숨통.',
    avail: (s, k) => cinfo(k).eco < 55, val: () => -4, apply: s => { s.factions.farm += 3; s.sectorShock = s.sectorShock || {}; s.sectorShock.ship = (s.sectorShock.ship || 0) + 1; s.sectorShock.agri = (s.sectorShock.agri || 0) + 1; } },
  { id: 'base', side: 'ask', icon: '⚓', name: '군사 기지 접근권', desc: '우리 군의 기지 사용·기항. 안보·전력 투사↑, 주변국 경계.',
    avail: (s, k) => k !== 'nk' && k !== 'cn' && k !== 'ru', val: (s, k) => -(22 + (isNationalist(s, k) ? 10 : 0)),
    apply: s => { s.mods.security += 1.5; s.relMods.cn -= 2; } },
  { id: 'apology', side: 'ask', icon: '📜', name: '과거사 사과·배상', desc: '역사 문제의 공식 사과와 피해 배상. 국내 여론 크게 환영.',
    avail: (s, k) => k === 'jp', val: (s, k) => -(58 + (isNationalist(s, k) ? 15 : 0)), apply: s => { s.approval = clamp(s.approval + 4, 0, 100); s.factions.lib += 6; s.factions.elder += 3; } },
  { id: 'denuke', side: 'ask', icon: '☢️', name: '비핵화 조치', desc: '핵시설 동결·사찰 수용. 안보 대폭↑.',
    avail: (s, k) => k === 'nk' && !s.annexed.nk, val: () => -48, apply: s => { s.stats.security += 6; s.mods.security += 6; s.approval = clamp(s.approval + 3, 0, 100); } },

  { id: 'aid1', side: 'give', icon: '💵', name: '경제 원조 ₩1조', desc: '국고에서 즉시 지출.', cost: 10,
    avail: (s, k) => cinfo(k).eco < 85, val: (s, k) => 9 * poorK(k), apply: () => {} },
  { id: 'aid3', side: 'give', icon: '💰', name: '경제 원조 ₩3조', desc: '국고에서 즉시 지출.', cost: 30,
    avail: (s, k) => cinfo(k).eco < 85, val: (s, k) => 22 * poorK(k), apply: () => {} },
  { id: 'market', side: 'give', icon: '🚢', name: '시장 개방(관세 인하)', desc: '상대국 상품에 시장을 엽니다. 농어민·일부 산업 반발.',
    val: (s, k) => 10 + (hasTrait(s, k, 'pragmatic') ? 5 : 0), apply: s => { s.factions.farm -= 4; s.mods.gdp += 0.02; } },
  { id: 'tech', side: 'give', icon: '🔬', name: '기술 이전', desc: '반도체·원전·조선 기술 일부 공유. 산업 경쟁력 소폭↓.',
    val: (s, k) => 13 + (cinfo(k).eco < 60 ? 7 : 0), apply: s => { s.mods.innovation -= 0.8; } },
  { id: 'arms', side: 'give', icon: '🪖', name: '무기 판매 계약', desc: 'K-방산 수출. 국고 +₩1.5조, 방산 호황, 상대국의 적국은 반발.',
    avail: (s, k) => k !== 'nk', val: (s, k) => 8 + (inConflict(s, k) ? 12 : 0) + (hasTrait(s, k, 'aggressive') ? 4 : 0),
    apply: (s, k) => { s.pcap += 15; s.sectorShock = s.sectorShock || {}; s.sectorShock.ship = (s.sectorShock.ship || 0) + 3; for (const c of (s.world?.conflicts || [])) if (c.b === k) relBump(s, c.a, -8, -4); } },
  { id: 'infra', side: 'give', icon: '🏗️', name: '인프라 투자 ₩4조', desc: '도로·항만·발전소 건설. 우리 건설사 수주.', cost: 40,
    avail: (s, k) => cinfo(k).eco < 75, val: (s, k) => 20 * poorK(k), apply: s => { s.sectorShock = s.sectorShock || {}; s.sectorShock.build = (s.sectorShock.build || 0) + 2; } },
  { id: 'visa', side: 'give', icon: '🎓', name: '비자 면제·인적 교류', desc: '관광·유학 교류 확대.', val: () => 6,
    apply: s => { s.sectorShock = s.sectorShock || {}; s.sectorShock.culture = (s.sectorShock.culture || 0) + 1.5; } },
];
const artById = id => ARTICLES.find(a => a.id === id);

// 상대의 기본 태도 (조항과 무관한 부분)
function treatyBase(s, k) {
  const L = s.leaders?.[k], c = cinfo(k), out = [];
  out.push(['관계', Math.round((relOf(s, k) - 50) * 0.6)]);
  const mc = campOf(s, 'kr'), tc = campOf(s, k);
  if (mc === tc) out.push(['같은 진영', 10]); else if (tc !== 'south' && mc !== 'south') out.push(['적대 진영', -15]); else out.push(['비동맹국', -3]);
  if (L) {
    out.push([`체제: ${IDEOLOGIES[L.gov].name}`, L.gov === 'dem' ? 5 : L.gov === 'comm' ? -6 : -2]);
    for (const t of L.traits) { const v = { pragmatic: 8, koreaFriend: 12, nationalist: -6, hardliner: -8, isolationist: -5, pacifist: 3, aggressive: -3 }[t]; if (v) out.push([`${L.name}: ${TRAITS[t].name}`, v]); }
  }
  const pr = milPower(s) / Math.max(10, c.mil);
  if (pr > 1.4) out.push(['우리 국력이 압도적', Math.round(Math.min(10, (pr - 1) * 8))]); else if (pr < 0.6) out.push(['상대가 더 강대국', -6]);
  if (k === 'jp') out.push(['과거사 갈등', -10]);
  if (k === 'cn' && dip(s, 'us').alliance) out.push(['한미동맹 경계', -8]);
  if (dip(s, k).sanction) out.push(['한국이 제재 중', -25]);
  if (s.war && (s.war.k === k || s.war.enemyAllies.includes(k))) out.push(['전쟁 중', -100]);
  return out;
}
function treatyScore(s, k, picks) {
  const parts = treatyBase(s, k);
  for (const id of picks) { const a = artById(id); parts.push([`${a.icon} ${a.name}`, Math.round(a.val(s, k))]); }
  const score = parts.reduce((a, [, v]) => a + v, 0);
  const chance = clamp(Math.round(50 + score * 2.2), 2, 97);
  return { parts, score, chance };
}
function treatyCost(picks) { return 5 + picks.reduce((a, id) => a + (artById(id).cost || 0), 0); }

function proposeTreaty(s, k, picks) {
  if (!picks.length) return { ok: false, msg: '조항을 하나 이상 넣으세요.' };
  if (!picks.some(id => artById(id).side === 'ask')) return { ok: false, msg: '요구 조항이 없으면 그냥 원조입니다. 받을 것을 하나 이상 넣으세요.' };
  if ((s.treatyCd?.[k] || 0) > s.turn) return { ok: false, msg: `${cname(k)}이(가) 최근 제안을 거절했습니다. ${s.treatyCd[k] - s.turn}분기 뒤에 다시 제안하세요.` };
  const cost = treatyCost(picks);
  if (s.pcap < cost) return { ok: false, msg: `국고 ${won(cost)}이(가) 필요합니다.` };
  const { chance } = treatyScore(s, k, picks);
  s.pcap -= 5;
  if (Math.random() * 100 < chance) { signTreaty(s, k, picks, 'kr'); return { ok: true, accepted: true, chance }; }
  s.treatyCd = s.treatyCd || {}; s.treatyCd[k] = s.turn + 2;
  relBump(s, k, -3, -1);
  addLog(s, 'bad', `📜 ${cname(k)}이(가) 조약 제안을 거절했습니다. (수락 가능성 ${chance}%)`);
  return { ok: true, accepted: false, chance };
}
function signTreaty(s, k, picks, by) {
  for (const id of picks) { const a = artById(id); if (a.cost) s.pcap -= a.cost; a.apply(s, k); }
  for (const f in s.factions) s.factions[f] = clamp(s.factions[f], 0, 100);
  relBump(s, k, 6, 4);
  (s.treaties = s.treaties || []).push({ k, turn: s.turn, arts: [...picks] });
  const names = picks.map(id => artById(id).name).join(' · ');
  addLog(s, 'good', `📜 ${cname(k)}과(와) 조약 체결: ${names}`);
  if (typeof worldNews === 'function') worldNews(s, `📜 대한민국·${cname(k)} 조약 체결 (${names})`, 'good');
}

/* ---------------- AI가 먼저 보내는 조약안 ---------------- */
function aiTreatyProposals(s) {
  s.world.proposals = s.world.proposals || [];
  if (s.world.proposals.length >= 2 || Math.random() > 0.45) return;
  for (const k of Object.keys(s.leaders || {})) {
    if (!alive(s, k) || relOf(s, k) < 58) continue;
    if (!(hasTrait(s, k, 'pragmatic') || hasTrait(s, k, 'koreaFriend')) || Math.random() > 0.014 * (isCore(k) ? 4 : 1)) continue;
    // 상대가 우리에게 원하는 것(우리 쪽 give)과 대가로 주는 것(우리 쪽 ask)
    const gives = ARTICLES.filter(a => a.side === 'give' && !a.cost && (!a.avail || a.avail(s, k))).sort(() => Math.random() - 0.5).slice(0, 1 + (Math.random() < 0.4 ? 1 : 0));
    const asks = ARTICLES.filter(a => a.side === 'ask' && !['apology', 'denuke', 'base'].includes(a.id) && (!a.avail || a.avail(s, k))).sort(() => Math.random() - 0.5).slice(0, 1);
    if (!asks.length) continue;
    s.world.proposals.push({ id: uid(), k, picks: [...asks, ...gives].map(a => a.id), turn: s.turn });
    if (typeof worldNews === 'function') worldNews(s, `📨 ${cname(k)}이(가) 대한민국에 조약을 제안했습니다.`, 'good');
    break; // 한 분기에 한 건
  }
}
function answerProposal(s, id, yes) {
  const p = s.world.proposals.find(x => x.id === id); if (!p) return null;
  if (yes) { const cost = treatyCost(p.picks) - 5; if (s.pcap < cost) return { ok: false, msg: `국고 ${won(cost)}이(가) 필요합니다.` }; }
  s.world.proposals = s.world.proposals.filter(x => x !== p);
  if (yes) { signTreaty(s, p.k, p.picks, p.k); return { ok: true, msg: `${cname(p.k)}과(와) 조약을 체결했습니다.` }; }
  relBump(s, p.k, -4, -2); addLog(s, 'info', `📜 ${cname(p.k)}의 조약 제안을 거절했습니다.`);
  return { ok: true, msg: '제안을 거절했습니다.' };
}

HOOKS.migrate.push(s => { if (!s.treaties) s.treaties = []; if (!s.treatyCd) s.treatyCd = {}; if (s.world && !s.world.proposals) s.world.proposals = []; });
HOOKS.postTurn.push(s => { if (s.world) aiTreatyProposals(s); });

/* =========================================================
 *  조약 협상 화면
 * ========================================================= */
let treatyPicks = [];
function openTreaty(k, picks) {
  treatyPicks = picks ? [...picks] : [];
  setSpeed(0);
  renderTreaty(k);
}
function renderTreaty(k) {
  const c = cinfo(k), L = S.leaders[k];
  const avail = side => ARTICLES.filter(a => a.side === side && (!a.avail || a.avail(S, k)));
  const card = a => { const on = treatyPicks.includes(a.id), v = Math.round(a.val(S, k));
    return `<button class="tcard ${a.side} ${on ? 'on' : ''}" data-art="${a.id}"><span class="tc-ic">${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small><span class="tc-v ${v >= 0 ? 'good-t' : 'bad-t'}">${v >= 0 ? '+' : ''}${v}</span>${a.cost ? `<span class="tc-cost">${won(a.cost)}</span>` : ''}</button>`; };
  const { parts, score, chance } = treatyScore(S, k, treatyPicks);
  const verdict = chance >= 65 ? ['수락할 것 같습니다', 'good-t'] : chance >= 40 ? ['고민하고 있습니다', 'mid-t'] : ['거절할 것 같습니다', 'bad-t'];
  const reply = !treatyPicks.length ? '어떤 조약을 원하시는지 들어 보겠습니다.' : chance >= 65 ? '이 조건이라면 서명할 용의가 있습니다.' : chance >= 40 ? '나쁘지 않지만, 조금 더 성의를 보여 주시죠.' : '이런 조건으로는 우리 국민을 설득할 수 없습니다.';
  const cost = treatyCost(treatyPicks), cd = (S.treatyCd?.[k] || 0) > S.turn;
  openModal(`<div class="treaty">
    <div class="tr-head">${L ? `<div class="avatar" style="background:hsl(${L.avatarHue} 45% 42%)">${esc(L.name.replace(/\s/g, '')[0])}</div>` : ''}<div><h2>📜 ${c.flag} ${esc(c.name)}과(와) 조약 협상</h2><div class="muted small">${L ? `${esc(L.title)} ${esc(L.name)} · ${L.traits.map(t => TRAITS[t].name).join('·')}` : ''} · 관계 ${relOf(S, k).toFixed(0)}</div>
      <div class="tr-reply">“${esc(reply)}”</div></div></div>
    <div class="tr-grid">
      <div><h4 class="sec">📥 우리가 요구 <span class="muted small">(받는 것)</span></h4><div class="tcards">${avail('ask').map(card).join('') || '<div class="muted small">요구할 수 있는 조항이 없습니다.</div>'}</div></div>
      <div><h4 class="sec">📤 우리가 제공 <span class="muted small">(주는 것)</span></h4><div class="tcards">${avail('give').map(card).join('')}</div></div>
    </div>
    <div class="accept">
      <div class="acc-top"><span>수락 가능성</span><b class="${verdict[1]}">${chance}%</b><span class="${verdict[1]}">${verdict[0]}</span></div>
      <div class="acc-bar"><i style="width:${chance}%"></i><em style="left:50%"></em></div>
      <div class="acc-parts">${parts.map(([n, v]) => `<span class="${v >= 0 ? 'good-t' : 'bad-t'}">${esc(n)} ${v >= 0 ? '+' : ''}${v}</span>`).join('')}<span class="acc-sum">합계 ${score >= 0 ? '+' : ''}${score}</span></div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="tr-auto" ${!treatyPicks.some(id => artById(id).side === 'ask') ? 'disabled' : ''}>🤖 수락 가능하게 조정</button>
      <button class="btn" onclick="closeModal()">닫기</button>
      <button class="btn primary" id="tr-send" ${cd || S.pcap < cost ? 'disabled' : ''}>${cd ? `재제안 대기 ${S.treatyCd[k] - S.turn}분기` : `조약 제안 (${won(cost)})`}</button>
    </div></div>`);
  document.querySelectorAll('[data-art]').forEach(b => b.onclick = () => {
    const id = b.dataset.art; treatyPicks = treatyPicks.includes(id) ? treatyPicks.filter(x => x !== id) : [...treatyPicks, id]; renderTreaty(k);
  });
  $('tr-auto').onclick = () => {
    // 비용 대비 효과가 좋은 당근부터 얹어 수락 가능성 65% 이상으로
    const pool = ARTICLES.filter(a => a.side === 'give' && !treatyPicks.includes(a.id) && (!a.avail || a.avail(S, k)))
      .sort((a, b) => (b.val(S, k) / (1 + (b.cost || 0) / 10 + (b.id === 'tech' ? 2 : 0))) - (a.val(S, k) / (1 + (a.cost || 0) / 10 + (a.id === 'tech' ? 2 : 0))));
    for (const a of pool) { if (treatyScore(S, k, treatyPicks).chance >= 65) break; if (S.pcap < treatyCost([...treatyPicks, a.id])) continue; treatyPicks.push(a.id); }
    renderTreaty(k);
    if (treatyScore(S, k, treatyPicks).chance < 65) toast('당근을 다 얹어도 65%에 못 미칩니다. 요구를 줄여 보세요.');
  };
  $('tr-send').onclick = () => {
    const r = proposeTreaty(S, k, treatyPicks);
    if (!r.ok) return toast(esc(r.msg));
    saveGame(S); renderAll();
    openModal(`<div class="event"><div class="ev-stamp ${r.accepted ? 'ok' : 'fail'}">${r.accepted ? '서명' : '거절'}</div>
      <h2>${c.flag} ${esc(c.name)} ${r.accepted ? '조약 체결!' : '조약 거절'}</h2>
      <p class="lead">${r.accepted ? `${esc(L?.name || c.name)}: “양국의 새로운 장을 엽시다.”` : `${esc(L?.name || c.name)}: “지금 조건으로는 어렵습니다.” (수락 가능성 ${r.chance}%)`}</p>
      ${r.accepted ? `<div class="box"><h4>조약 내용</h4><ul>${treatyPicks.map(id => `<li>${artById(id).icon} ${esc(artById(id).name)}</li>`).join('')}</ul></div>` : '<p class="muted">관계가 조금 떨어졌고, 2분기 동안 다시 제안할 수 없습니다.</p>'}
      <div class="modal-actions"><button class="btn primary" onclick="closeModal()">확인</button></div></div>`);
  };
}

// 상대가 보낸 조약안 카드
function openProposalCard(id) {
  const p = S.world.proposals.find(x => x.id === id); if (!p) return;
  setSpeed(0);
  const c = cinfo(p.k), L = S.leaders[p.k];
  const asks = p.picks.filter(x => artById(x).side === 'ask'), gives = p.picks.filter(x => artById(x).side === 'give');
  const li = ids => ids.map(x => `<li>${artById(x).icon} <b>${esc(artById(x).name)}</b> <span class="muted small">${esc(artById(x).desc)}</span></li>`).join('');
  openModal(`<div class="event">
    <div class="ev-banner ev-diplomacy"><span class="ev-art">📨</span><span class="ev-kind">조약 제안</span><span class="ev-date">${c.flag} ${esc(c.name)}</span></div>
    <h2>${esc(c.name)}이(가) 조약을 제안했습니다</h2>
    <p class="lead">${L ? `${esc(L.title)} ${esc(L.name)}: “우리 두 나라 모두에게 이익이 되는 제안입니다.”` : ''}</p>
    <div class="two"><div class="box gain"><h4>📥 우리가 받는 것</h4><ul>${li(asks)}</ul></div><div class="box loss"><h4>📤 우리가 주는 것</h4><ul>${li(gives)}</ul></div></div>
    <div class="modal-actions"><button class="btn" id="pr-no">거절</button><button class="btn" id="pr-counter">역제안</button><button class="btn primary" id="pr-yes">서명</button></div></div>`, { closable: false });
  const done = yes => { const r = answerProposal(S, id, yes); if (r && !r.ok) return toast(esc(r.msg)); saveGame(S); renderAll(); closeModal(); if (r) toast(esc(r.msg)); };
  $('pr-yes').onclick = () => done(true);
  $('pr-no').onclick = () => done(false);
  $('pr-counter').onclick = () => { S.world.proposals = S.world.proposals.filter(x => x.id !== id); openTreaty(p.k, p.picks); };
}
