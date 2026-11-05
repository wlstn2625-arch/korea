/* =========================================================
 *  국내 정치 화면: 국회 반원 의석도, 정치 인물, 당 장악력·야당 협조도, 정치 행동, 선거 일정
 *  + 정치 사건 카드, 대선·정권 승계 카드, IMF 카드
 * ========================================================= */

/* ---------------- 국회 반원 의석도 ---------------- */
let _hemi = null;
function hemicycleSeats() {
  if (_hemi) return _hemi;
  const rows = 10, r0 = 0.36, rs = [...Array(rows)].map((_, i) => r0 + (1 - r0) * i / (rows - 1));
  const sum = rs.reduce((a, b) => a + b, 0);
  const counts = rs.map(r => Math.round(300 * r / sum)); counts[rows - 1] += 300 - counts.reduce((a, b) => a + b, 0);
  const seats = [];
  rs.forEach((r, i) => { const n = counts[i]; for (let j = 0; j < n; j++) { const th = Math.PI - Math.PI * (n === 1 ? 0.5 : j / (n - 1)); seats.push({ x: 100 + Math.cos(th) * r * 92, y: 100 - Math.sin(th) * r * 92, th }); } });
  seats.sort((a, b) => b.th - a.th);
  return (_hemi = seats);
}
function hemicycleSvg(s) {
  const order = ['L', 'N', 'P', 'R'], colors = [];
  for (const b of order) for (let i = 0; i < (s.seats[b] || 0); i++) colors.push(PARTY_COLOR[b]);
  const seats = hemicycleSeats();
  return `<svg viewBox="0 0 200 106" class="hemi" role="img" aria-label="국회 의석 분포">${seats.map((p, i) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6" fill="${colors[i] || '#666'}"/>`).join('')}
    <text x="100" y="92" text-anchor="middle" class="hemi-num">${rulingSeats(s)}</text><text x="100" y="102" text-anchor="middle" class="hemi-sub">여당 / 300석</text></svg>`;
}
const gauge = (label, v, hint) => `<div class="gauge"><div class="g-top"><span>${label}</span><b style="color:${v >= 60 ? 'var(--good)' : v >= 40 ? 'var(--mid)' : 'var(--bad)'}">${v.toFixed(0)}</b></div><div class="bar"><i style="width:${v}%;background:${v >= 60 ? 'var(--good)' : v >= 40 ? 'var(--mid)' : 'var(--bad)'}"></i></div><small class="muted">${hint}</small></div>`;
const avatar = (name, hue) => `<div class="avatar sm" style="background:hsl(${hue} 40% 42%)">${esc(name[0])}</div>`;
const nameHue = n => [...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

function renderDomestic() {
  const el = $('dom-slot'); if (!el || !S.dom) return;
  const d = S.dom, f = d.figures, opp = oppBloc(S), T = termInfo(S);
  const elections = nextElections(S).map(e => { const t = turnLabel(e.turn); return `<div class="elec ${e.left <= 2 ? 'soon' : ''}"><b>${esc(e.name)}</b><span>${t.year}년 ${t.q}분기 · ${e.left === 0 ? '이번 분기' : `${e.left}분기 남음`}</span></div>`; }).join('');
  const lv = S.lastVote;
  const acts = POL_ACTIONS.map(a => { const why = a.can?.(S) || ((d.cd[a.id] || 0) > S.turn ? `${d.cd[a.id] - S.turn}분기 후 가능` : null);
    return `<button class="pact" data-pact="${a.id}" ${why || S.pcap < a.pc ? 'disabled' : ''} title="${esc(why || a.desc)}"><span class="pi">${a.icon}</span><b>${a.name}</b><small>${won(a.pc)}${why ? ' · ' + esc(why) : ''}</small></button>`; }).join('');
  el.innerHTML = `<div class="dom">
    <div class="dom-top">
      <div class="dom-hemi">${hemicycleSvg(S)}
        <div class="hemi-leg">${['L', 'R', 'N', 'P'].filter(b => S.seats[b]).map(b => `<span><i style="background:${PARTY_COLOR[b]}"></i>${BLOC_NAME[b]}${b === S.ruling ? '(여당)' : b === opp ? '(제1야당)' : ''} ${S.seats[b]}</span>`).join('')}</div>
        ${lv ? `<div class="lastvote"><span class="muted small">최근 본회의 표결 · ${esc(lv.name)}</span><div class="vbar"><i style="width:${lv.yes / 3}%"></i><em style="left:${lv.need / 3}%"></em></div><span class="small">찬성 <b>${lv.yes}</b> · 반대 ${300 - lv.yes} · 가결선 ${lv.need} → <b class="${lv.yes >= lv.need ? 'good-t' : 'bad-t'}">${lv.yes >= lv.need ? '가결' : '부결'}</b></span></div>` : ''}
      </div>
      <div class="dom-side">
        <div class="pres-card">${avatar(S.name, nameHue(S.name))}<div><b>제${T.ord}대 대통령 ${esc(S.name)}</b><div class="muted small">${esc(PARTIES[S.party]?.name || '')} · 임기 ${T.year}년차 (${T.q}/20분기)${S.partyTerms > 1 ? ` · ${S.partyTerms}기 연속 집권` : ''}</div></div></div>
        <div class="figs">
          <div class="fig">${avatar(f.ruling, nameHue(f.ruling))}<div><b>${esc(f.ruling)}</b><small class="muted">여당 대표</small></div></div>
          <div class="fig">${avatar(f.opp, nameHue(f.opp))}<div><b>${esc(f.opp)}</b><small class="muted">제1야당 대표 · ${f.oppStyle}파</small></div></div>
          <div class="fig">${avatar(f.speaker, nameHue(f.speaker))}<div><b>${esc(f.speaker)}</b><small class="muted">국회의장</small></div></div>
        </div>
        ${gauge('당 장악력', d.unity, '낮으면 여당 의원들이 표결에서 이탈합니다')}
        ${gauge('야당 협조도', d.oppMood, d.coop > 0 ? `🤝 협치 중 (${d.coop}분기 남음)` : '높으면 야당 표가 넘어옵니다')}
        ${d.scandal > 20 ? `<div class="verdict bad small">⚠️ 측근 비리 리스크가 커지고 있습니다. 개각을 고려하세요.</div>` : ''}
      </div>
    </div>
    <h3 class="sec">🎯 대통령의 정치 행동</h3><div class="pacts">${acts}</div>
    <h3 class="sec">🗓️ 선거 일정</h3><div class="elecs">${elections}</div>
    ${d.pending.length ? `<div class="verdict">📌 결정을 기다리는 정치 현안 ${d.pending.length}건 <button class="btn sm primary" id="dom-open">처리하기</button></div>` : ''}
    ${(S.presidents || []).length ? `<h3 class="sec">🏛️ 역대 대통령</h3><div class="hall">${S.presidents.map(p => presRow(p)).join('')}</div>` : ''}
  </div>`;
  el.querySelectorAll('[data-pact]').forEach(b => b.onclick = () => act(polAction)(S, b.dataset.pact));
  $('dom-open') && ($('dom-open').onclick = () => openDomEventCard(d.pending[0].id));
}
function presRow(p) {
  const a = turnLabel(p.from), b = turnLabel(Math.max(p.from, p.to - 1));
  return `<div class="hall-row"><span class="grade-chip g-${p.grade}">${p.grade}</span><b>제${p.no}대 ${esc(p.name)}</b><span class="muted small">${esc(PARTIES[p.party]?.name || '')} · ${a.year}~${b.year} · 퇴임 지지율 ${p.approval.toFixed(0)}%${p.reason === 'impeach' ? ' · 탄핵' : ''}</span><span class="small">${esc(p.title)}</span></div>`;
}

/* ---------------- 정치 사건 카드 ---------------- */
function openDomEventCard(id) {
  const ev = S.dom.pending.find(x => x.id === id); if (!ev) return closeModal();
  setSpeed(0);
  const def = DOM_EVENTS[ev.key];
  openModal(`<div class="event">
    <div class="ev-banner ev-politics"><span class="ev-art">${def.icon}</span><span class="ev-kind">국내 정치</span><span class="ev-date">${turnLabel(S.turn).year}년 ${turnLabel(S.turn).q}분기</span></div>
    <h2>${esc(ev.title)}</h2><p class="ev-desc">${esc(ev.desc)}</p>
    <div class="ev-opts">${def.choices.map((c, i) => `<button class="ev-opt" data-i="${i}" ${c.pc && S.pcap < c.pc ? 'disabled' : ''}><span class="ev-lbl">${esc(c.label)}</span><span class="muted small">${esc(c.desc)}</span>${c.pc ? `<span class="ev-meta">${won(c.pc)}</span>` : ''}</button>`).join('')}</div>
  </div>`, { closable: false });
  document.querySelectorAll('.ev-opt').forEach(b => b.onclick = () => {
    const r = resolveDomEvent(S, id, +b.dataset.i);
    if (!r?.ok) return toast(esc(r?.msg || '처리할 수 없습니다.'));
    saveGame(S); renderAll();
    openModal(`<div class="event"><h2>${r.icon} ${esc(r.title)}</h2><p class="lead">대통령 결정: <b>${esc(r.choice)}</b></p><p>${esc(r.text)}</p>
      <div class="modal-actions"><button class="btn primary" onclick="closeModal()">계속</button></div></div>`);
  });
}

/* ---------------- 대선·정권 승계 ---------------- */
function openPresidentialCard() {
  const r = S.pendingSuccession; if (!r) return;
  setSpeed(0);
  const g = r.term;
  const winner = r.won ? r.rulingCandidate : r.oppCandidate;
  const newParty = r.won ? r.rulingParty : r.oppParty;
  openModal(`<div class="event">
    <div class="ev-banner ev-politics"><span class="ev-art">🗳️</span><span class="ev-kind">${r.reason === 'impeach' ? '탄핵에 따른 조기 대선' : '대통령 선거'}</span><span class="ev-date">제${r.no}대</span></div>
    <h2>${r.won ? '정권 재창출' : '정권 교체'}: ${esc(winner)} 당선</h2>
    <div class="pres-result">
      <div><b>${esc(r.rulingCandidate)}</b> <span class="muted small">여당 · ${esc(PARTIES[r.rulingParty]?.name || '')}</span><div class="vbar2"><i style="width:${r.share}%;background:${PARTY_COLOR[PARTY_LEAN[r.rulingParty]]}"></i></div><b>${r.share.toFixed(1)}%</b></div>
      <div><b>${esc(r.oppCandidate)}</b> <span class="muted small">야당 · ${esc(PARTIES[r.oppParty]?.name || '')}</span><div class="vbar2"><i style="width:${r.oppShare}%;background:${PARTY_COLOR[PARTY_LEAN[r.oppParty]]}"></i></div><b>${r.oppShare.toFixed(1)}%</b></div>
    </div>
    <div class="term-eval"><div class="grade g-${g.grade}">${g.grade}</div><div><b>제${g.no}대 ${esc(g.name)} 정부 평가: ${esc(g.title)}</b><div class="muted small">종합 ${g.total.toFixed(1)}점 · 퇴임 지지율 ${g.approval.toFixed(1)}% (임기 시작 대비 국정 성과로 평가)</div></div></div>
    <p>${r.won ? '같은 정당이 정권을 이어갑니다. 국정 연합과 지지층은 유지됩니다.' : `<b>${esc(PARTIES[newParty]?.name || '')}</b>(으)로 정권이 바뀝니다. 당신은 새 대통령이 되어 이 나라를 계속 이끕니다. 지지층·국정 연합·여야 구도가 뒤바뀝니다.`}</p>
    <label class="field">새 대통령 이름<input id="succ-name" value="${esc(winner)}" maxlength="12"></label>
    <div class="modal-actions"><button class="btn" id="succ-end">여기서 끝내기</button><button class="btn primary" id="succ-go">제${r.no}대 대통령으로 계속 ▶</button></div>
  </div>`, { closable: false });
  $('succ-go').onclick = () => {
    applySuccession(S, $('succ-name').value.trim() || winner);
    saveGame(S); closeModal(); renderAll(); refreshTicker();
    toast(`🇰🇷 제${S.presidentNo}대 대통령 ${esc(S.name)} 취임. 새 임기가 시작됩니다.`, 5000);
  };
  $('succ-end').onclick = () => {
    (S.presidents = S.presidents || []).push(r.term);
    S.pendingSuccession = null; S.over = true;
    S.ending = { type: 'retire', title: '역사 속으로', desc: `${S.presidents.length}명의 대통령, ${((S.turn) / 4).toFixed(1)}년의 대한민국 이야기가 막을 내립니다.`, score: finalScore(S) };
    saveGame(S); closeModal(); showEnding();
  };
}
function openImfCard() {
  setSpeed(0);
  openModal(`<div class="event">
    <div class="ev-banner ev-fiscal"><span class="ev-art">🆘</span><span class="ev-kind">국가 위기</span></div>
    <h2>IMF 구제금융</h2>
    <p class="ev-desc">국가채무와 재정적자가 한계를 넘어 외환·재정 위기가 터졌습니다. IMF의 긴급 자금을 받는 대가로 혹독한 긴축과 구조조정이 시작됩니다. 성장률이 곤두박질치고 실업이 늘었으며, 지지율이 15%p 떨어졌습니다. 국가채무비율이 180%를 넘으면 더는 버틸 수 없습니다.</p>
    <div class="modal-actions"><button class="btn primary" onclick="closeModal()">위기를 수습한다</button></div></div>`);
}
