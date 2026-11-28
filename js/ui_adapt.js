/* =========================================================
 *  합병에 맞춘 화면: 지역 통치 카드 · 외교 관계 표시 · 효과 칩 정리
 * ========================================================= */
// 효과 칩에서 사라진 나라 관계는 빼기
if (typeof fxChips === 'function') {
  const _fc = fxChips;
  fxChips = function (fx, max) {
    if (S && fx?.rel) { const rel = { ...fx.rel }; for (const k of goneCore(S)) delete rel[k]; fx = { ...fx, rel }; }
    return _fc(fx, max);
  };
}

// 국정 현황 '외교 관계': 편입한 나라는 막대 대신 '대한민국 영토'
{
  const _rs = renderSide;
  renderSide = function () {
    _rs();
    const el = $('rel-list'); if (!el || !S) return;
    el.innerHTML = Object.entries(RELATIONS).map(([k, m]) => isGone(S, k)
      ? `<div class="bar-row gone"><span>${m.flag} ${m.name}</span><span class="rel-gone">🗺️ 대한민국 영토${S.terr?.[k] ? ` · ${RULES[S.terr[k].rule]?.name || ''}` : ''}</span><span class="n">—</span></div>`
      : bar(`${m.flag} ${m.name}`, S.rel[k])).join('');
  };
}

// 정책 카드: 그 나라 전용 정책 → '지역 통치' 카드
const ruleOf = k => S.terr?.[k]?.rule;
{
  const _rp = renderPolicies;
  renderPolicies = function () {
    _rp();
    if (!S) return;
    document.querySelectorAll('.pol-card[data-pc]').forEach(c => {
      const p = policyById(c.dataset.pc, S); if (!policyObsolete(S, p)) return;
      const k = POLICY_TIES[p.id], R = RULES[ruleOf(k)];
      c.classList.add('obsolete');
      c.querySelector('.pc-name').textContent = `${cname(k)} 지역 통치`;
      c.querySelector('.pc-cur').textContent = `지금: ${R ? R.icon + ' ' + R.name : '통치 방식 미정'}`;
      c.querySelector('.pc-n').textContent = `(구 ${p.name})`;
      c.querySelector('.pc-st')?.remove(); c.querySelector('.pc-cost')?.remove();
      c.insertAdjacentHTML('beforeend', '<i class="pc-st chg">🗺️ 통치</i>');
      c.onclick = () => openRuleHand(k, p);
    });
  };
}
if (typeof openPolicyHand === 'function') {
  const _oph2 = openPolicyHand;
  openPolicyHand = function (pid) { const p = policyById(pid, S); if (policyObsolete(S, p)) return openRuleHand(POLICY_TIES[pid], p); return _oph2(pid); };
}
// 통치 방식 손패
function openRuleHand(k, p) {
  const t = S.terr?.[k];
  if (!t) { toast(`🗺️ ${cname(k)}은(는) 대한민국에 완전히 통합되었습니다.`); return; }
  setSpeed(0);
  const keys = Object.keys(RULES).filter(r => !(r === 'puppet' && k === 'nk' && t.integ > 50)), n = keys.length;
  const cards = keys.map((r, i) => {
    const R = RULES[r], cur = t.rule === r, ang = (i - (n - 1) / 2) * 9;
    return `<div class="hc ${cur ? 'cur' : ''}" data-r="${r}" style="--r:${ang}deg;--i:${i};--n:${n};--c1:#1d2a39;--c2:#3a5a7a">
      ${cur ? '<span class="hc-cur">현재 방식</span>' : `<span class="hc-cost">${Math.round(15 / 10)}</span>`}
      <span class="hc-art">${R.icon}</span><span class="hc-name">${esc(R.name)}</span>
      <span class="ochips hc-fx"><i class="fxc ${R.ext >= 1 ? 'g' : ''}">💰 징수 ×${R.ext}</i><i class="fxc ${R.resist > 0 ? 'b' : 'g'}">✊ 저항 ${R.resist > 0 ? '+' : ''}${R.resist}</i><i class="fxc g">🤝 통합 +${R.integ}</i></span></div>`;
  }).join('');
  openModal(`<div class="hand-scene">
    <div class="hs-top"><div class="hs-title"><span class="hs-art">${cinfo(k)?.flag || '🗺️'}</span><div><b>${esc(cname(k))} 지역 통치</b><small>${esc(cname(k))}은(는) 이제 대한민국 영토입니다. ${p ? `'${esc(p.name)}'은(는) 더 이상 외교 정책이 아니라 통치 방침입니다.` : ''} 저항 ${Math.round(t.resist)} · 통합 ${Math.round(t.integ)} · 개발 ${Math.round(t.dev)}</small></div></div>
      <div class="hs-arena"><div class="ar-lbl">🗺️ 통치 방식 고르기 <small>개편 비용 ${won(15)} · 2분기마다</small></div></div>
      <div class="hs-gem">${Math.round(S.pcap / 10)}<small>국고 ${won(S.pcap)}</small></div></div>
    <div class="hs-note">카드를 눌러 통치 방식을 바꾸세요. 자세한 운영(징수·징병·투자)은 국방·영토 탭에서.</div>
    <div class="hs-hand">${cards}</div>
    <div class="hs-btns"><button class="btn" onclick="closeModal()">닫기</button><button class="btn" id="rh-terr">🗺️ 국방·영토 탭에서 자세히</button></div></div>`);
  $('modal').classList.add('scene-mode', 'hand-mode');
  document.querySelectorAll('#modal-body .hc[data-r]').forEach(c => c.onclick = () => {
    if (c.classList.contains('cur')) return toast('지금 쓰고 있는 통치 방식입니다.');
    const r = setTerr(S, k, 'rule', c.dataset.r);
    if (r?.ok === false) return toast(esc(r.msg));
    if (typeof stampFx === 'function') stampFx('통치', RULES[c.dataset.r].name, 'blue');
    saveGame(S); closeModal(); renderAll();
  });
  $('rh-terr').onclick = () => { closeModal(); showTab('defense'); };
}

// 국가 중점: 상황에 맞게 바뀐 중점 표시
if (typeof renderFocus === 'function') {
  const _rf = renderFocus;
  renderFocus = function (...a) {
    const r = _rf.apply(this, a);
    if (S) document.querySelectorAll('.fc-node[data-fc]').forEach(n => { const f = focusById(n.dataset.fc); if (f?.adaptedBy && isGone(S, f.adaptedBy)) n.classList.add('adapted'); });
    return r;
  };
}

// 정책 손패: 의미 없어진 선택지 카드 흐리게
if (typeof openPolicyHand === 'function') {
  const _oph3 = openPolicyHand;
  openPolicyHand = function (pid) { _oph3(pid); if (!S) return; document.querySelectorAll('#modal-body .hc[data-o]').forEach(c => { if (optionObsolete(S, pid, c.dataset.o)) { c.classList.add('cur', 'obsolete'); c.querySelector('.hc-name').insertAdjacentHTML('afterend', '<span class="hc-cur" style="top:auto;bottom:8px;background:#2f6fe0">🗺️ 영토라 불필요</span>'); } }); };
}
