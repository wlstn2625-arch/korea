/* =========================================================
 *  대한민국 주도 국제기구 (UN을 대신하는 새 국제 질서)
 *  - 만드는 법: UN 탈퇴·신기구 창설 같은 안건이 통과되거나, 국력 상위권에서 직접 창설
 *  - 운영: 회원국 초대·축출 / 산하 기관 설립 / 분장금 수준 / 분기마다 결의안 1건
 *  - 정당성(신뢰): 회원국 수·공정성에 따라 오르내림. 낮으면 회원국이 탈퇴
 *  - 효과: 분담금 수입, 회원국 관계·무역, 반한 연합에서 빠짐, 위협도 감소
 * ========================================================= */
const LEAGUE_ORGANS = [
  { id: 'council', icon: '🛡️', name: '안전보장이사회', cost: 30, desc: '제재·무력 개입 결의를 할 수 있게 됨. 위협도 -5.', on: s => { if (typeof addThreat === 'function') addThreat(s, -5); } },
  { id: 'pko', icon: '🪖', name: '평화유지군', cost: 25, desc: '분쟁 지역에 파병해 분쟁을 끝낼 수 있음(결의안 "평화 유지 파병"). 정당성 +5.', on: s => { s.league.legit += 5; } },
  { id: 'bank', icon: '🏦', name: '국제개발은행', cost: 35, desc: '개도국 회원 관계 매 분기 +1, 성장률 +0.04(지속). 분담금의 일부를 개발 지원에 씀.', on: s => { s.mods.gdp += 0.04; } },
  { id: 'market', icon: '🚢', name: '공동시장', cost: 40, desc: '회원국 수에 비례해 성장률 상승(회원 10개국마다 +0.05). 농어민 반발.', on: s => { s.factions.farm = clamp(s.factions.farm - 6, 0, 100); } },
  { id: 'currency', icon: '💱', name: '원화 기축통화', cost: 50, need: 'market', desc: '원화를 기구 결제 통화로. 물가 -0.3, 재정 +0.3, 국채 이자 부담 감소.', on: s => { s.mods.infl -= 0.3; s.mods.fiscal += 0.3; } },
  { id: 'rights', icon: '⚖️', name: '인권·사법위원회', cost: 20, desc: '정당성 +10, 정당성 하락 완화. 우리도 감시받음(자유·인권 +2).', on: s => { s.league.legit += 10; s.mods.freedom += 2; } },
  { id: 'space', icon: '🛰️', name: '우주·기술 기구', cost: 30, desc: '회원국 기술 협력: 산업 경쟁력 +3(지속).', on: s => { s.mods.innovation += 3; } },
];
const DUES = [
  { id: 'low', name: '낮게', mul: 0.5, sat: 1.2 }, { id: 'mid', name: '보통', mul: 1, sat: 0 }, { id: 'high', name: '높게', mul: 1.7, sat: -1.5 },
];
const RESOLUTIONS = [
  { id: 'sanction', icon: '🚫', name: '공동 제재', need: 'council', target: 'nonmember', desc: '회원국 전체가 대상국을 제재. 대상국 관계·국력 하락, 국고 +(압류 자산).' },
  { id: 'peace', icon: '🕊️', name: '평화 유지 파병', need: 'pko', target: 'conflict', desc: '분쟁 하나를 끝냄. 정당성 +6, 분쟁 당사국 관계 +.' },
  { id: 'aid', icon: '📦', name: '인도적 지원', target: 'none', desc: '국고 ₩2조. 정당성 +4, 회원국 관계 +2.' },
  { id: 'climate', icon: '🌳', name: '기후 협약', target: 'none', desc: '환경 +2(지속), 회원국 관계 +1, 재계 반발.' },
  { id: 'trade', icon: '📦', name: '관세 철폐', need: 'market', target: 'none', desc: '성장률 +0.05(지속). 농어민 -4.' },
  { id: 'recognize', icon: '🏳️', name: '영토 편입 승인', target: 'none', desc: '우리 점령지 저항 -10, 정당성 -6(공정성 논란).' },
  { id: 'reform', icon: '📜', name: '헌장 개정(한국 권한 강화)', target: 'none', desc: '분담금 수입 +30%(영구), 정당성 -12. 탈퇴국이 생길 수 있음.' },
];

function leagueOf(s) { return s.league || null; }
const leagueOn = s => !!s?.league;
const isMember = (s, k) => !!s.league?.members?.includes(k);
const organ = (s, id) => !!s.league?.organs?.includes(id);
function leagueCandidates(s) {
  return allCountryKeys().filter(k => { const c = cinfo(k); return c && !c.isBloc && k !== 'kr' && !s.annexed?.[k] && !s.world?.owner?.[k] && !(typeof isGone === 'function' && isGone(s, k)) && !isMember(s, k); });
}
function foundLeague(s, name) {
  if (s.league) return { ok: false, msg: '이미 국제기구가 있습니다.' };
  if (s.pcap < 30) return { ok: false, msg: `창설 비용 ${won(30)}이(가) 필요합니다.` };
  s.pcap -= 30;
  // 괴뢰 정부·동맹·보호국은 창립 회원국
  const founders = Object.keys(s.diplo || {}).filter(k => cinfo(k) && !cinfo(k).isBloc && (dip(s, k).alliance || s.heg?.sphere?.[k] != null || (s.terr?.[k] && RULES[s.terr[k].rule]?.puppet)));
  s.league = { name: (name || '').trim() || '서울 국제평화기구', founded: s.turn, members: founders, organs: [], legit: 45, dues: 'mid', duesBoost: 1, lastRes: -1, log: [] };
  s.unLeft = true;
  leagueLog(s, `🏛️ ${s.league.name} 창설! 창립 회원국 ${founders.length}개국${founders.length ? `: ${founders.slice(0, 8).map(cname).join(', ')}` : ''}`);
  if (typeof addThreat === 'function') addThreat(s, -4, '새 국제기구 창설');
  return { ok: true, msg: `🏛️ ${s.league.name}을(를) 창설했습니다.` };
}
function leagueLog(s, text, type = 'good') { s.league?.log.unshift({ turn: s.turn, text }); if (s.league?.log.length > 30) s.league.log.length = 30; addLog(s, type, text); if (s.world && typeof worldNews === 'function') worldNews(s, text, type); }

// 가입 확률: 관계·우리 국력·정당성·회원 수(눈덩이)·적대 진영
function joinChance(s, k) {
  const L = s.league, c = cinfo(k); let rank = 20; try { const r = powerRank(s); rank = (typeof r === 'number' ? r : r?.rank) ?? 20; } catch {}
  let p = (relOf(s, k) - 40) / 80 + (L.legit - 40) / 120 + L.members.length / 120 + (20 - rank) / 60;
  if (['us', 'cn', 'ru'].includes(k)) p -= 0.35; if (c.nukes) p -= 0.1;
  if (s.geo?.stance?.[k] === 'coalition') p -= 0.35; if (s.geo?.stance?.[k] === 'bandwagon') p += 0.2;
  if (dip(s, k).sanction) p -= 0.3; if (c.eco < 30) p += 0.08;
  return clamp(p, 0.03, 0.95);
}
function inviteMember(s, k) {
  const L = s.league; if (!L) return { ok: false, msg: '국제기구가 없습니다.' };
  if (isMember(s, k)) return { ok: false, msg: '이미 회원국입니다.' };
  if ((L.invCd?.[k] || 0) > s.turn) return { ok: false, msg: '최근에 초대를 거절했습니다. 다음 분기에 다시.' };
  if (s.pcap < 5) return { ok: false, msg: `외교 비용 ${won(5)}이(가) 필요합니다.` };
  s.pcap -= 5;
  const p = joinChance(s, k);
  if (Math.random() < p) { L.members.push(k); relBump(s, k, 5, 4); L.legit = clamp(L.legit + 1, 0, 100); leagueLog(s, `🤝 ${cname(k)}, ${L.name} 가입 (가입 확률 ${Math.round(p * 100)}%)`); return { ok: true, msg: `🤝 ${cname(k)}이(가) 가입했습니다!` }; }
  (L.invCd = L.invCd || {})[k] = s.turn + 2; relBump(s, k, -1, 0);
  return { ok: true, msg: `❌ ${cname(k)}이(가) 가입을 거절했습니다. (확률 ${Math.round(p * 100)}%)` };
}
function expelMember(s, k) { const L = s.league; if (!isMember(s, k)) return { ok: false }; L.members = L.members.filter(x => x !== k); relBump(s, k, -15, -8); L.legit = clamp(L.legit - 5, 0, 100); leagueLog(s, `🚪 ${cname(k)}을(를) ${L.name}에서 축출했습니다.`, 'bad'); return { ok: true, msg: `${cname(k)} 축출` }; }
function buildOrgan(s, id) {
  const L = s.league, o = LEAGUE_ORGANS.find(x => x.id === id); if (!L || !o) return { ok: false };
  if (organ(s, id)) return { ok: false, msg: '이미 있습니다.' };
  if (o.need && !organ(s, o.need)) return { ok: false, msg: `먼저 ${LEAGUE_ORGANS.find(x => x.id === o.need).name}이(가) 필요합니다.` };
  if (s.pcap < o.cost) return { ok: false, msg: `국고 ${won(o.cost)}이(가) 필요합니다.` };
  s.pcap -= o.cost; L.organs.push(id); o.on(s); L.legit = clamp(L.legit, 0, 100);
  leagueLog(s, `${o.icon} ${L.name} 산하 ${o.name} 설립`);
  return { ok: true, msg: `${o.icon} ${o.name} 설립` };
}
function passResolution(s, id, target) {
  const L = s.league, R = RESOLUTIONS.find(x => x.id === id); if (!L || !R) return { ok: false };
  if (L.lastRes === s.turn) return { ok: false, msg: '결의안은 분기에 한 번만 낼 수 있습니다.' };
  if (R.need && !organ(s, R.need)) return { ok: false, msg: `${LEAGUE_ORGANS.find(x => x.id === R.need).name}이(가) 있어야 합니다.` };
  // 표결: 회원국 찬성률 = 정당성 + 관계
  const yes = L.members.filter(k => Math.random() < clamp(0.35 + (relOf(s, k) - 50) / 100 + (L.legit - 50) / 100 - (target && k === target ? 1 : 0), 0.05, 0.98)).length;
  const total = Math.max(1, L.members.length), pass = L.members.length === 0 || yes / total >= 0.5;
  L.lastRes = s.turn;
  if (!pass) { L.legit = clamp(L.legit - 3, 0, 100); leagueLog(s, `🗳️ 결의안 '${R.name}' 부결 (찬성 ${yes}/${total})`, 'bad'); return { ok: true, msg: `🗳️ 부결 (찬성 ${yes}/${total})` }; }
  let msg = '';
  if (id === 'sanction') { dip(s, target).sanction = true; relBump(s, target, -15, -10); s.pcap += 15; if (s.world?.power) {} (L.sanctioned = L.sanctioned || {})[target] = s.turn + 8; msg = `${cname(target)} 공동 제재 (회원국 ${total}개국 동참, 압류 자산 +${won(15)})`; }
  else if (id === 'peace') { const c = (s.world?.conflicts || []).find(x => x.id === target) || (s.world?.conflicts || [])[0]; if (c) { s.world.conflicts = s.world.conflicts.filter(x => x !== c); relBump(s, c.a, 6, 3); if (c.b !== c.a) relBump(s, c.b, 6, 3); msg = `${cname(c.a)}${c.b !== c.a ? '·' + cname(c.b) : ''} 분쟁에 평화유지군 파병, 분쟁 종식`; } else msg = '끝낼 분쟁이 없었습니다'; L.legit += 6; }
  else if (id === 'aid') { s.pcap -= 20; L.legit += 4; for (const k of L.members) relBump(s, k, 2, 1); msg = '인도적 지원 실시'; }
  else if (id === 'climate') { s.mods.env += 2; s.factions.biz = clamp(s.factions.biz - 3, 0, 100); for (const k of L.members) relBump(s, k, 1, 1); msg = '기후 협약 채택'; }
  else if (id === 'trade') { s.mods.gdp += 0.05; s.factions.farm = clamp(s.factions.farm - 4, 0, 100); msg = '회원국 관세 철폐'; }
  else if (id === 'recognize') { for (const t of Object.values(s.terr || {})) t.resist = clamp(t.resist - 10, 0, 100); L.legit -= 6; msg = '점령지 편입 승인'; }
  else if (id === 'reform') { L.duesBoost = (L.duesBoost || 1) * 1.3; L.legit -= 12; msg = '헌장 개정: 한국 권한 강화'; }
  L.legit = clamp(L.legit, 0, 100);
  leagueLog(s, `🗳️ 결의안 '${R.name}' 가결 (찬성 ${yes}/${total}) — ${msg}`);
  return { ok: true, msg: `🗳️ 가결: ${msg}` };
}
function duesIncome(s) {
  const L = s.league; if (!L) return 0; const D = DUES.find(x => x.id === L.dues) || DUES[1];
  return Math.round(L.members.reduce((a, k) => a + (cinfo(k)?.eco || 10) * 0.06, 0) * D.mul * (L.duesBoost || 1) * (organ(s, 'bank') ? 0.8 : 1));
}

// 분기 처리
HOOKS.postTurn.push(s => {
  const L = s.league; if (!L) return;
  const D = DUES.find(x => x.id === L.dues) || DUES[1];
  const inc = duesIncome(s); s.pcap += inc; L.lastIncome = inc;
  // 정당성: 회원 수(+), 우리가 전쟁 중이면(-), 인권위 있으면 하락 완화, 50으로 천천히 수렴
  let drift = (50 - L.legit) * 0.05 + Math.min(4, L.members.length / 8) + D.sat;
  if (s.war) drift -= isMember(s, s.war.k) ? 6 : 2;
  if (organ(s, 'rights') && drift < 0) drift *= 0.5;
  L.legit = clamp(L.legit + drift, 0, 100);
  // 회원국 관계: 기구 안에 있으면 조금씩 가까워짐(개발은행이면 개도국 더)
  for (const k of L.members) relBump(s, k, 0.6 + (organ(s, 'bank') && cinfo(k)?.eco < 40 ? 1 : 0), 0.2);
  // 탈퇴: 정당성이 낮거나, 관계가 나쁘거나, 분담금이 높으면
  for (const k of [...L.members]) {
    const p = clamp((35 - L.legit) / 100 + (30 - relOf(s, k)) / 100 + (D.id === 'high' ? 0.04 : 0) + (s.war?.k === k ? 1 : 0), 0, 0.9);
    if (Math.random() < p) { L.members = L.members.filter(x => x !== k); leagueLog(s, `🚪 ${cname(k)}, ${L.name} 탈퇴`, 'bad'); }
  }
  // 회원국이 우리 영토가 되면 회원 명단에서 빠짐
  L.members = L.members.filter(k => !s.annexed?.[k] && !(typeof isGone === 'function' && isGone(s, k)));
  // 가끔 스스로 가입 신청
  if (L.legit > 55 && Math.random() < 0.35) { const cs = leagueCandidates(s).filter(k => relOf(s, k) >= 55); const k = cs[Math.floor(Math.random() * cs.length)]; if (k && Math.random() < joinChance(s, k)) { L.members.push(k); leagueLog(s, `📨 ${cname(k)}이(가) 스스로 ${L.name}에 가입했습니다`); } }
  if (typeof addThreat === 'function') addThreat(s, -Math.min(2, L.members.length / 20) * (L.legit / 60));
});
// 공동시장 효과(한 분기만 반영)
HOOKS.preMacro.push(s => { if (organ(s, 'market')) { s._lm = Math.floor(s.league.members.length / 10) * 0.05; s.mods.gdp += s._lm; } });
HOOKS.postMacro.push(s => { if (s._lm) { s.mods.gdp -= s._lm; s._lm = 0; } });
// 회원국은 반한 연합에 들어가지 않음(정당성이 아주 낮으면 예외)
if (typeof judge === 'function') {
  const _jd = judge;
  judge = function (s, k) { const j = _jd(s, k); if (isMember(s, k) && (s.league?.legit ?? 0) >= 25 && j.stance === 'coalition') return { ...j, stance: 'wary', why: `${s.league.name} 회원국이라 연합 불참` }; return j; };
}
// UN 결의 사건: 탈퇴했으면 안 나옴
if (DOM_EVENTS.unResolution) { const c0 = DOM_EVENTS.unResolution.cond; DOM_EVENTS.unResolution.cond = s => !s.unLeft && c0(s); }

// 안건으로 만들기: UN 탈퇴·국제기구 창설 같은 선택지가 통과되면 기구가 생김
const LEAGUE_RE = /(UN|유엔|국제연합).*(탈퇴|대체|해체)|(국제|세계|평화|아시아|글로벌).{0,8}(기구|연합|공동체|동맹기구|연맹)\s*(창설|설립|출범)|신\s*국제/;
{
  const _ap = applyPassed;
  applyPassed = function (s, p, opt, old) {
    _ap(s, p, opt, old);
    try {
      const text = `${opt.label} ${opt.desc || ''}`;
      if (!s.league && LEAGUE_RE.test(text)) { const nm = (opt.label.match(/([가-힣A-Za-z·\s]{2,14}(기구|연합|공동체|연맹))/) || [])[1]; s.pcap += 30; foundLeague(s, nm && !/UN|유엔/.test(nm) ? nm.replace(/^.*(신|새)\s*/, '').trim() : ''); s.leagueNew = true; }
      else if (/(UN|유엔).*탈퇴/.test(text)) s.unLeft = true;
    } catch {}
  };
}
HOOKS.migrate.push(s => { if (s.league) { s.league.log = s.league.log || []; s.league.organs = s.league.organs || []; } });

/* =========================================================
 *  화면: 외교 탭 카드 + 운영 화면 + 지도 팝업 버튼
 * ========================================================= */
function leagueCardHTML() {
  const L = S.league; let rank = 20; try { const r = powerRank(S); rank = (typeof r === 'number' ? r : r?.rank) ?? 20; } catch {}
  if (!L) {
    const can = rank <= 5 || Object.keys(S.terr || {}).length >= 5;
    return `<div class="lg-card empty"><div class="lg-h"><span>🏛️</span><div><b>대한민국 주도 국제기구</b><small>${can ? 'UN을 대신할 새 국제 질서를 세울 수 있습니다.' : `국력 5위 이내 또는 점령지 5곳 이상이면 창설 가능 (지금 ${rank}위)`}</small></div></div>
      <div class="lg-row"><input id="lg-name" maxlength="16" placeholder="기구 이름 (예: 서울 국제평화기구)"><button class="btn primary sm" id="lg-found" ${can ? '' : 'disabled'}>🏛️ 창설 ${won(30)}</button></div></div>`;
  }
  return `<div class="lg-card"><div class="lg-h"><span>🏛️</span><div><b>${esc(L.name)}</b><small>${turnLabel(L.founded).year}년 창설 · 회원국 ${L.members.length}개국 · 기관 ${L.organs.length}/${LEAGUE_ORGANS.length}</small></div><button class="btn primary sm" id="lg-open">운영</button></div>
    <div class="lg-meter"><span>신뢰(정당성)</span><div class="cp-bar"><i style="width:${L.legit}%;background:hsl(${L.legit * 1.2} 65% 50%)"></i></div><b>${Math.round(L.legit)}</b></div>
    <div class="lg-flags">${L.members.slice(0, 24).map(cflag).join('')}${L.members.length > 24 ? ` +${L.members.length - 24}` : ''}</div>
    <div class="muted small">분담금 수입 분기 ${won(L.lastIncome ?? duesIncome(S))}${L.lastRes === S.turn ? ' · 이번 분기 결의 완료' : ' · 결의안 제출 가능'}</div></div>`;
}
function bindLeagueCard(root) {
  root.querySelector('#lg-found')?.addEventListener('click', () => { const r = foundLeague(S, root.querySelector('#lg-name').value); toast(esc(r.msg)); if (r.ok) { stampFx?.('창설', S.league.name, 'blue'); saveGame(S); renderAll(); openLeague(); } });
  root.querySelector('#lg-open')?.addEventListener('click', () => openLeague());
}
{
  const _rw = renderWorld;
  renderWorld = function (...a) {
    const r = _rw.apply(this, a); const el = $('tab-world'); if (!el || !S) return r;
    let slot = $('league-slot'); if (!slot) { slot = document.createElement('div'); slot.id = 'league-slot'; el.insertBefore(slot, $('situation-slot') || el.firstChild); }
    slot.innerHTML = leagueCardHTML(); bindLeagueCard(slot); return r;
  };
}
let lgTab = 'members';
function openLeague(tab) {
  const L = S.league; if (!L) return; if (tab) lgTab = tab; setSpeed(0);
  const D = DUES.find(x => x.id === L.dues);
  const tabs = [['members', '🌐 회원국'], ['organs', '🏢 산하 기관'], ['res', '🗳️ 결의안'], ['dues', '💰 분담금'], ['log', '📜 기록']];
  let body = '';
  if (lgTab === 'members') {
    const cand = leagueCandidates(S).map(k => ({ k, p: joinChance(S, k) })).sort((a, b) => b.p - a.p).slice(0, 18);
    body = `<h4>회원국 ${L.members.length}개국</h4><div class="lg-list">${L.members.map(k => `<div class="lg-item"><span>${cflag(k)} ${esc(cname(k))}</span><small>관계 ${Math.round(relOf(S, k))}</small><button class="btn sm" data-ex="${k}">축출</button></div>`).join('') || '<div class="muted small">아직 회원국이 없습니다. 아래에서 초대하세요.</div>'}</div>
      <h4>초대할 나라 <small class="muted">(가입 확률 높은 순, 초대 ${won(5)})</small></h4><div class="lg-list">${cand.map(({ k, p }) => `<div class="lg-item"><span>${cflag(k)} ${esc(cname(k))}</span><small>가입 ${Math.round(p * 100)}%</small><button class="btn sm primary" data-inv="${k}">초대</button></div>`).join('')}</div>`;
  } else if (lgTab === 'organs') {
    body = `<div class="lg-grid">${LEAGUE_ORGANS.map(o => { const have = organ(S, o.id), lock = o.need && !organ(S, o.need); return `<div class="lg-organ ${have ? 'have' : ''}"><span>${o.icon}</span><b>${o.name}</b><small>${esc(o.desc)}</small>${have ? '<em>✅ 운영 중</em>' : `<button class="btn sm ${lock ? '' : 'primary'}" data-org="${o.id}" ${lock || S.pcap < o.cost ? 'disabled' : ''}>${lock ? '선행 기관 필요' : `설립 ${won(o.cost)}`}</button>`}</div>`; }).join('')}</div>`;
  } else if (lgTab === 'res') {
    const done = L.lastRes === S.turn;
    const nonMembers = leagueCandidates(S).filter(k => cinfo(k).eco >= 20 || relOf(S, k) < 40).sort((a, b) => relOf(S, a) - relOf(S, b)).slice(0, 25);
    const conf = S.world?.conflicts || [];
    body = `<p class="muted small">분기마다 결의안 1건. 회원국 과반이 찬성해야 통과합니다(정당성·관계에 따라).</p><div class="lg-grid">${RESOLUTIONS.map(R => { const lock = R.need && !organ(S, R.need);
      const pick = R.target === 'nonmember' ? `<select data-tg="${R.id}">${nonMembers.map(k => `<option value="${k}">${cflag(k)} ${esc(cname(k))}</option>`).join('')}</select>` : R.target === 'conflict' ? `<select data-tg="${R.id}">${conf.map(c => `<option value="${c.id}">${esc(cname(c.a))}${c.b !== c.a ? '↔' + esc(cname(c.b)) : ''}</option>`).join('') || '<option value="">분쟁 없음</option>'}</select>` : '';
      return `<div class="lg-organ"><span>${R.icon}</span><b>${R.name}</b><small>${esc(R.desc)}</small>${pick}<button class="btn sm ${lock || done ? '' : 'primary'}" data-res="${R.id}" ${lock || done ? 'disabled' : ''}>${lock ? '기관 필요' : done ? '이번 분기 완료' : '표결에 부치기'}</button></div>`; }).join('')}</div>`;
  } else if (lgTab === 'dues') {
    body = `<p>회원국이 내는 분담금 수준을 정합니다. 높을수록 수입이 늘지만 신뢰가 떨어지고 탈퇴가 늘어납니다.</p><div class="lg-dues">${DUES.map(d => `<button class="btn ${L.dues === d.id ? 'primary' : ''}" data-dues="${d.id}">${d.name}<small>수입 ×${d.mul} · 신뢰 ${d.sat > 0 ? '+' : ''}${d.sat}/분기</small></button>`).join('')}</div>
      <p class="muted small">지금 분기 수입 예상: ${won(duesIncome(S))}${L.duesBoost > 1 ? ` (헌장 개정 효과 ×${L.duesBoost.toFixed(2)})` : ''}</p>`;
  } else body = `<div class="lg-log">${L.log.map(x => `<div><small>${turnLabel(x.turn).year}.${turnLabel(x.turn).q}Q</small> ${esc(x.text)}</div>`).join('') || '<div class="muted">기록 없음</div>'}</div>`;
  openModal(`<div class="lg-modal"><div class="lg-top"><span class="lg-emblem">🏛️</span><div><h2>${esc(L.name)}</h2><div class="lg-meter"><span>신뢰</span><div class="cp-bar"><i style="width:${L.legit}%;background:hsl(${L.legit * 1.2} 65% 50%)"></i></div><b>${Math.round(L.legit)}</b></div>
    <small class="muted">회원국 ${L.members.length} · 기관 ${L.organs.length} · 분담금 ${D.name} · 국고 ${won(S.pcap)}</small></div></div>
    <div class="lg-tabs">${tabs.map(([id, n]) => `<button class="chip ${lgTab === id ? 'active' : ''}" data-lt="${id}">${n}</button>`).join('')}</div><div class="lg-body">${body}</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">닫기</button></div></div>`);
  const m = $('modal-body'), redo = (r) => { if (r?.msg) toast(esc(r.msg), 3500); saveGame(S); renderAll(); openLeague(); };
  m.querySelectorAll('[data-lt]').forEach(b => b.onclick = () => openLeague(b.dataset.lt));
  m.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { const k = b.dataset.inv; const r = inviteMember(S, k); if (/가입했습니다/.test(r.msg || '') && typeof mapFly === 'function') mapFly(mapXY('kr'), mapXY(k), '🏛️', { trail: '#7fb2ff' }); redo(r); });
  m.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => redo(expelMember(S, b.dataset.ex)));
  m.querySelectorAll('[data-org]').forEach(b => b.onclick = () => { const r = buildOrgan(S, b.dataset.org); if (r.ok) stampFx?.('설립', '', 'blue'); redo(r); });
  m.querySelectorAll('[data-res]').forEach(b => b.onclick = () => { const id = b.dataset.res, tg = m.querySelector(`[data-tg="${id}"]`)?.value; const r = passResolution(S, id, tg); if (r.ok) stampFx?.(/가결/.test(r.msg) ? '가결' : '부결', '', /가결/.test(r.msg) ? 'red' : 'gray'); redo(r); });
  m.querySelectorAll('[data-dues]').forEach(b => b.onclick = () => { L.dues = b.dataset.dues; redo({ msg: `분담금: ${DUES.find(x => x.id === L.dues).name}` }); });
}
// 안건 통과로 기구가 생기면 바로 알려 주고 운영 화면 열기
if (typeof renderAll === 'function') {
  const _ra = renderAll; renderAll = function () { _ra(); if (S?.leagueNew) { S.leagueNew = false; setTimeout(() => { toast(`🏛️ ${S.league.name}이(가) 출범했습니다! 회원국을 모으고 기관을 세우세요.`, 5000); openLeague('members'); }, 600); } };
}
// 지도 팝업: 기구 초대 버튼
if (typeof openCountryPop === 'function') {
  const _ocp = openCountryPop;
  openCountryPop = function (k, x, y, pid) {
    _ocp(k, x, y, pid);
    const acts = document.querySelector('.cpop .cp-acts'); if (!acts || !S?.league || S.war?.k === k || S.annexed?.[k]) return;
    const mem = isMember(S, k), b = document.createElement('button'); b.className = 'cp-b';
    b.innerHTML = mem ? `<span>🏛️</span><b>회원국</b><small>${esc(S.league.name.slice(0, 6))}</small>` : `<span>🏛️</span><b>기구 초대</b><small>${Math.round(joinChance(S, k) * 100)}%</small>`;
    b.onclick = () => { if (mem) return openLeague('members'); const r = inviteMember(S, k); toast(esc(r.msg), 3500); if (/가입했습니다/.test(r.msg || '')) mapFly(mapXY('kr'), mapXY(k), '🏛️', { trail: '#7fb2ff' }); saveGame(S); closeCountryPop(); renderAll(); };
    acts.insertBefore(b, acts.lastElementChild);
  };
}
