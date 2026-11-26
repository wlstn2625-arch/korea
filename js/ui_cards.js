/* =========================================================
 *  B 정책 카드 덱: 정책을 그림 카드로 모으고,
 *  카드를 누르면 선택지 카드가 손패로 펼쳐져 국회에 "낸다"
 * ========================================================= */
const POL_ART = [
  [/대통령|정부 형태/, '🧑‍💼'], [/국회 구조/, '🏛️'], [/선거제도|선거 연령/, '🗳️'], [/지방분권/, '🏘️'], [/수도/, '🏙️'], [/국가보안법/, '🕵️'],
  [/소득세/, '💵'], [/법인세/, '🏢'], [/부가가치세/, '🧾'], [/상속|증여/, '👪'], [/종합부동산세/, '🏠'], [/금융투자/, '📈'], [/탄소세/, '🏭'],
  [/재벌|대기업/, '🏦'], [/반도체|AI 산업/, '💾'], [/한국은행|통화/, '💱'], [/소상공인|자영업/, '🏪'], [/통상/, '🚢'], [/공기업/, '⚡'],
  [/최저임금/, '💰'], [/근로시간/, '⏰'], [/정년/, '👴'], [/노조|노란봉투/, '✊'], [/플랫폼|특수고용/, '🛵'], [/국민연금/, '🏦'], [/기초연금/, '👵'],
  [/기본소득/, '🎁'], [/저출산/, '👶'], [/이민/, '🛂'], [/건강보험/, '🩺'], [/주택담보|대출/, '💳'], [/주택 공급/, '🏗️'], [/토지/, '🗺️'], [/임대차/, '🔑'],
  [/입시/, '📝'], [/학제/, '🏫'], [/사교육/, '📚'], [/무상교육/, '🎒'], [/디지털 교육|AI·디지털/, '💻'], [/병역/, '🪖'], [/국방비/, '🛡️'], [/핵 정책/, '☢️'],
  [/전시작전/, '🎖️'], [/대체복무/, '🕊️'], [/한미/, '🇺🇸'], [/대중국/, '🇨🇳'], [/대일본/, '🇯🇵'], [/대북/, '🇰🇵'], [/ODA|원조/, '🌍'],
  [/검찰/, '⚖️'], [/공수처|고위공직자/, '🔍'], [/경찰/, '👮'], [/사형/, '⛓️'], [/국민참여재판/, '👥'], [/대법원/, '🏛️'], [/형사/, '🚔'],
  [/성년/, '🎂'], [/혼인|가족/, '💍'], [/차별금지/, '🏳️‍🌈'], [/낙태|임신/, '🤰'], [/존엄사/, '🕯️'], [/성\(姓\)|자녀의 성/, '👶'], [/언론|표현/, '📰'],
  [/원자력/, '⚛️'], [/탄소중립/, '🌳'], [/재생에너지/, '☀️'], [/일회용품|순환/, '♻️'], [/의대/, '🩺'], [/비대면/, '📱'], [/필수의료|수가/, '🚑'],
];
const polArt = p => (POL_ART.find(([re]) => re.test(p.name)) || [])[1] || CATEGORIES.find(c => c.id === p.cat)?.icon || '📜';
const LT_ICON = { decree: '✍️', law: '🏛️', const: '📜' };

function seatsSvg() {
  const total = 300, rs = S.ruling === 'P' ? S.seats.P : S.seats[S.ruling] || 0;
  const oppMain = Object.entries(S.seats || {}).filter(([k]) => k !== (S.ruling === 'P' ? 'P' : S.ruling)).sort((a, b) => b[1] - a[1])[0]?.[1] || 0;
  let dots = '', n = 0;
  for (let r = 0; r < 7; r++) {
    const R = 46 + r * 11, cnt = Math.round(22 + r * 9);
    for (let i = 0; i < cnt && n < total; i++, n++) {
      const a = Math.PI * (i / (cnt - 1)), x = 150 - Math.cos(a) * R * 1.55, y = 128 - Math.sin(a) * R;
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" data-n="${n}"></circle>`;
    }
  }
  return { svg: `<svg viewBox="0 0 300 140" class="ar-seats">${dots}</svg>`, rs, oppMain };
}
function colorSeats(root) {
  const rs = S.ruling === 'P' ? S.seats.P : S.seats[S.ruling] || 0;
  const opp = Object.entries(S.seats || {}).filter(([k]) => k !== (S.ruling === 'P' ? 'P' : S.ruling)).sort((a, b) => b[1] - a[1])[0]?.[1] || 0;
  const cs = [...root.querySelectorAll('.ar-seats circle')].sort((a, b) => +a.getAttribute('cx') - +b.getAttribute('cx'));
  cs.forEach((c, i) => c.setAttribute('class', i < rs ? 'rul' : i < rs + opp ? 'opp' : 'etc'));
}

/* ---------- 카드 모음 ---------- */
function polCardHTML(p) {
  const locked = typeof policyLocked === 'function' && policyLocked(S, p);
  const cur = currentOption(p, S), bill = S.bills?.find(x => x.pid === p.id), pend = S.pending.find(x => x.pid === p.id);
  const A = (typeof CAT_ART !== 'undefined' && CAT_ART[p.cat]) || ['#22303e', '#4a5a6a'];
  const cheapest = Math.min(...p.options.filter(o => o.id !== cur.id).map(o => policyCost(S, o.cur ? { pc: 20 } : o)));
  const status = locked ? '<i class="pc-st lock">🔒 잠김</i>' : bill ? `<i class="pc-st bill">🏛️ 심의 ${Math.round(bill.progress)}%</i>` : pend ? `<i class="pc-st pend">⏳ 반영 ${Math.round((1 - pend.left / pend.lag) * 100)}%</i>` : !cur.cur ? '<i class="pc-st chg">✔ 바꿈</i>' : '';
  return `<button class="pol-card ${locked ? 'locked' : ''} ${!cur.cur ? 'changed' : ''}" data-pc="${p.id}" style="--c1:${A[0]};--c2:${A[1]}">
    ${isFinite(cheapest) && !locked ? `<span class="pc-cost">${Math.max(0, Math.round(cheapest / 10))}</span>` : ''}
    <span class="pc-art">${polArt(p)}</span>${status}
    <span class="pc-name">${esc(p.name)}</span>
    <span class="pc-cur">${cur.cur ? '현행' : '지금'}: ${esc(cur.label)}</span>
    <span class="pc-n">선택지 ${p.options.length}장</span>
  </button>`;
}
{
  const _rp2 = renderPolicies;
  renderPolicies = function () {
    _rp2();
    const pl = $('policy-list'); if (!pl || !S) return;
    const list = allPolicies().filter(p => p.cat === activeCat);
    pl.classList.add('pol-deck');
    pl.innerHTML = list.map(polCardHTML).join('') || '<div class="empty">이 분야에 정책이 없습니다.</div>';
    pl.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => {
      const p = policyById(b.dataset.pc, S);
      if (typeof policyLocked === 'function' && policyLocked(S, p)) { const E = ERAS[p.era - 1]; return toast(`🔒 ${E.icon} ${E.name} 단계에 해금 (대통령 Lv.${E.need.lv} · 국력 ${E.need.rank}위 이내)`); }
      openPolicyHand(p.id);
    });
  };
}

/* ---------- 손패: 선택지 카드를 국회에 낸다 ---------- */
let handSel = null;
function openPolicyHand(pid) {
  const p = policyById(pid, S); if (!p) return;
  setSpeed(0);
  const cur = currentOption(p, S), locked = S.enactedThisTurn.includes(p.id), bill = S.bills?.find(x => x.pid === p.id);
  const opts = p.options;
  if (handSel == null || !opts.some(o => o.id === handSel) || handSel === cur.id) handSel = (opts.find(o => o.id !== cur.id) || opts[0]).id;
  const A = (typeof CAT_ART !== 'undefined' && CAT_ART[p.cat]) || ['#22303e', '#4a5a6a'];
  const st = seatsSvg();
  const n = opts.length, spread = Math.min(14, 46 / Math.max(1, n - 1));
  const cards = opts.map((o, i) => {
    const isCur = o.id === cur.id, cost = isCur ? 0 : policyCost(S, o.cur ? { pc: 20 } : o), lt = isCur ? null : (o.cur ? cur.lt || 'law' : o.lt || 'decree');
    const ang = (i - (n - 1) / 2) * spread, sel = o.id === handSel;
    const fx = isCur ? '' : fxChips(o.cur ? (() => { const d = diffEffects(o, cur); return { e: d.e, rel: d.rel, f: o.f || {} }; })() : { e: o.e || {}, f: o.f || {}, rel: o.rel || {} }, 4);
    return `<div class="hc ${isCur ? 'cur' : ''} ${sel ? 'sel' : ''}" data-o="${o.id}" style="--r:${ang}deg;--i:${i};--n:${n};--c1:${A[0]};--c2:${A[1]}">
      ${isCur ? '<span class="hc-cur">시행 중</span>' : `<span class="hc-cost">${Math.round(cost / 10)}</span><span class="hc-lt" title="${LT_NAME[lt]}">${LT_ICON[lt]} ${LT_NAME[lt]}</span>`}
      <span class="hc-art">${o.cur ? '📌' : polArt(p)}</span>
      <span class="hc-name">${esc(o.label)}</span>
      <span class="ochips hc-fx">${fx}</span>
    </div>`;
  }).join('');
  openModal(`<div class="hand-scene">
    <div class="hs-top">
      <div class="hs-title"><span class="hs-art">${polArt(p)}</span><div><b>${esc(p.name)}</b><small class="txt-clamp" onclick="this.classList.toggle('open')">${esc(p.desc)}</small></div></div>
      <div class="hs-arena" id="hs-arena">${st.svg}<div class="ar-lbl">🏛️ 국회 본회의장 <small>여당 ${st.rs} · 야당 ${st.oppMain}</small></div><div class="ar-drop">여기로 올려서 내기</div></div>
      <div class="hs-gem" title="국고">${Math.round(S.pcap / 10)}<small>국고 ${won(S.pcap)}</small></div>
    </div>
    ${bill ? `<div class="hs-note">🏛️ 국회 심의 중: '${esc(optionOf(p, bill.oid).label)}' ${Math.round(bill.progress)}%</div>` : locked ? '<div class="hs-note">⏳ 이 분야는 이번 분기에 이미 바꿨습니다</div>' : ''}
    <div class="hs-hand" id="hs-hand">${cards}</div>
    <div class="hs-own"><input id="own-${p.id}" data-own="${p.id}" maxlength="80" placeholder="✍️ 나만의 카드 만들기: ${esc(typeof ownHint === 'function' ? ownHint(p) : '원하는 안을 문장으로')}"><button class="btn sm" id="hs-ownbtn">AI 분석</button></div>
    <div class="hs-btns"><button class="btn" onclick="closeModal()">닫기</button>${p.bg || p.options.some(o => o.pro) ? '<button class="btn" id="hs-explain">📖 해설</button>' : ''}<button class="btn primary hs-play" id="hs-play" ${locked || bill ? 'disabled' : ''}>🃏 이 카드를 국회에 낸다</button></div>
  </div>`);
  $('modal').classList.add('scene-mode', 'hand-mode');
  const root = $('modal-body');
  colorSeats(root);
  const play = () => { if ($('hs-play').disabled) return; const o = handSel; closeModal(); SFX.play('stamp'); setTimeout(() => openPreview(p.id, o), 120); };
  root.querySelectorAll('.hc').forEach(c => {
    c.onclick = () => { if (c.classList.contains('cur')) return toast('지금 시행 중인 카드입니다.'); handSel = c.dataset.o; root.querySelectorAll('.hc').forEach(x => x.classList.toggle('sel', x === c)); SFX.play('click'); };
    // 위로 끌어 올리면 내기
    let sy = null, dy = 0, sx = 0, dx = 0;
    c.addEventListener('pointerdown', e => { if (c.classList.contains('cur')) return; sy = e.clientY; sx = e.clientX; dy = dx = 0; c.setPointerCapture(e.pointerId); c.classList.add('drag'); });
    c.addEventListener('pointermove', e => { if (sy == null) return; dy = e.clientY - sy; dx = e.clientX - sx; c.style.setProperty('--dx', dx + 'px'); c.style.setProperty('--dy', Math.min(0, dy) + 'px'); $('hs-arena').classList.toggle('hot', dy < -110); });
    const up = () => { if (sy == null) return; sy = null; c.classList.remove('drag'); c.style.removeProperty('--dx'); c.style.removeProperty('--dy'); $('hs-arena').classList.remove('hot');
      if (dy < -110) { handSel = c.dataset.o; play(); } };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  });
  $('hs-play').onclick = play;
  if ($('hs-explain')) $('hs-explain').onclick = () => openExplain(p.id);
  const own = () => submitOwn(p.id);
  $('hs-ownbtn').onclick = own; $('own-' + p.id).onkeydown = e => { if (e.key === 'Enter') own(); };
}
