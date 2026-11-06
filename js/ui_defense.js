/* =========================================================
 *  국방·영토 화면: 무기 개발 트리, 점령지 통치, 강화 회의 카드
 * ========================================================= */
let defView = 'tech';
const BONUS_TXT = { divs: v => `사단 +${v}`, quality: v => `전투력(질) +${Math.round(v * 100)}%`, air: v => `공군력 +${v}`, navy: v => `해군력 +${v}`,
  equip: v => `장비 보충 +${(v * 1000).toFixed(0)}‰/일`, org: v => `조직력 회복 +${v}/일`, landing: v => `상륙 성공률 +${Math.round(v * 100)}%p`, missile: v => `미사일 위력 +${Math.round(v * 100)}%`,
  cas: v => `아군 사상자 -${Math.round((1 - v) * 100)}%`, enemyAir: v => `적 공군력 -${Math.round((1 - v) * 100)}%`, nuke: v => `피핵 위험 -${Math.round((1 - v) * 100)}%`, mobilize: v => `총동원 사단 +${Math.round(v * 100)}%p`,
  income: v => `국고 +${won(v)}/분기` };
const bonusList = (b, fx) => [...Object.entries(fx || {}).map(([k, v]) => `${STATS[k].name} ${['gdp', 'unemp', 'infl', 'fiscal', 'tfr'].includes(k) ? `${v > 0 ? '+' : ''}${v.toFixed(2)}${k === 'tfr' ? '명' : '%p'}` : fmtStat(k, v, true)}`), ...Object.entries(b || {}).filter(([k]) => k !== 'mil' && BONUS_TXT[k]).map(([k, v]) => BONUS_TXT[k](v))].join(' · ');

function renderDefense() {
  const el = $('tab-defense'); if (!el || !S) return;
  const nT = Object.keys(S.terr || {}).length;
  const badge = $('terr-badge'); if (badge) { const hot = Object.values(S.terr || {}).filter(t => t.resist >= 70).length; badge.textContent = hot || nT; badge.classList.toggle('hidden', !nT); badge.classList.toggle('info', !hot); }
  el.innerHTML = `<div class="def-tabs"><button class="btn sm ${defView === 'tech' ? 'primary' : ''}" data-dv="tech">🪖 무기 개발</button><button class="btn sm ${defView === 'eco' ? 'primary' : ''}" data-dv="eco">📈 경제 발전</button><button class="btn sm ${defView === 'terr' ? 'primary' : ''}" data-dv="terr">🏴 점령지 통치 ${nT ? `(${nT})` : ''}</button></div>
    <div id="def-body">${defView === 'tech' ? techHTML('mil') : defView === 'eco' ? techHTML('eco') : terrHTML()}</div>`;
  el.querySelectorAll('[data-dv]').forEach(b => b.onclick = () => { defView = b.dataset.dv; renderDefense(); });
  el.querySelectorAll('[data-tech]').forEach(b => b.onclick = () => act(startTech)(S, b.dataset.tech));
  el.querySelectorAll('[data-tcancel]').forEach(b => b.onclick = () => act(cancelTech)(S, b.dataset.tcancel));
  el.querySelectorAll('[data-tset]').forEach(b => b.onclick = () => { const [k, f, v] = b.dataset.tset.split('|'); act(setTerr)(S, k, f, f === 'rule' ? v : +v); });
  el.querySelectorAll('[data-trel]').forEach(b => b.onclick = () => { if (b.dataset.armed) act(releaseTerritory)(S, b.dataset.trel, false); else { b.dataset.armed = 1; b.textContent = '한 번 더 누르면 독립 승인'; } });
  el.querySelectorAll('[data-topen]').forEach(b => b.onclick = () => { terrOpen = terrOpen === b.dataset.topen ? null : b.dataset.topen; renderDefense(); });
  el.querySelectorAll('[data-tauto]').forEach(b => b.onclick = () => act(setGov)(S, b.dataset.tauto, 'auto', !S.terr[b.dataset.tauto].auto));
  el.querySelectorAll('[data-tdir]').forEach(x => x.onchange = () => act(setGov)(S, x.dataset.tdir, 'dir', x.value));
  el.querySelectorAll('[data-gall]').forEach(b => b.onclick = () => act(setGov)(S, '*', 'auto', b.dataset.gall === '1'));
  el.querySelectorAll('[data-gdir]').forEach(b => b.onclick = () => { act(setGov)(S, '*', 'dir', b.dataset.gdir); govSettings(S).defDir = b.dataset.gdir; });
  el.querySelectorAll('[data-gov]').forEach(b => b.onclick = () => { const [f, v] = b.dataset.gov.split('|'); act(setGov)(S, f, null, +v); });
  el.querySelectorAll('[data-gnew]').forEach(b => b.onclick = () => { const G = govSettings(S); G.autoNew = G.autoNew === false; saveGame(S); renderDefense(); });
  el.querySelectorAll('[data-tb]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.tb.split('|'); act(terrBuild)(S, k, id); });
  el.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.tp.split('|'); act(terrPolicy)(S, k, id); });
  el.querySelectorAll('[data-tsup]').forEach(b => b.onclick = () => act(suppressTerritory)(S, b.dataset.tsup));
  el.querySelectorAll('[data-tfocus]').forEach(b => b.onclick = () => { showTab('world'); zoomTo(b.dataset.tfocus); });
}

function techHTML(tree) {
  const T = techState(S), tb = techBonus(S), f = ourForces(S);
  const inTree = t => treeOf(t) === tree;
  const myActive = T.active.filter(a => inTree(techById(a.id)));
  const active = myActive.map(a => { const t = techById(a.id); return `<div class="tech-run"><span>${t.icon} <b>${esc(t.name)}</b></span>${meter((t.time - a.left) / t.time * 100, 'eq')}<span class="muted small">${a.left}분기 남음</span><button class="btn sm ghost" data-tcancel="${t.id}">중단</button></div>`; }).join('');
  const col = br => {
    const list = TECHS.filter(t => t.br === br.id).sort((a, b) => a.tier - b.tier);
    return `<div class="tcol"><div class="tcol-h">${br.icon} ${br.name}</div>${list.map(t => {
      const done = T.done.includes(t.id), run = T.active.find(a => a.id === t.id), why = techWhyNot(S, t);
      const st = done ? 'done' : run ? 'run' : why && /선행/.test(why) ? 'locked' : 'open';
      return `<div class="tnode ${st}" title="${esc(t.desc)}">
        <div class="tn-h"><span class="tn-ic">${t.icon}</span><b>${esc(t.name)}</b></div>
        <div class="tn-b">${esc(bonusList(t.b, t.fx))}</div>
        <div class="tn-d muted">${esc(t.desc)}</div>
        ${done ? '<div class="tn-s">✅ 실전 배치</div>' : run ? `<div class="tn-s">${meter((t.time - run.left) / t.time * 100, 'eq')} ${run.left}분기</div>`
          : `<button class="btn sm ${why ? '' : 'primary'}" data-tech="${t.id}" ${why ? 'disabled' : ''}>${why && !/국고/.test(why) ? esc(why) : `개발 ${won(t.cost)} · ${t.time}분기`}</button>`}
      </div>`; }).join('')}</div>`;
  };
  const doneN = TECHS.filter(t => inTree(t) && T.done.includes(t.id)).length, totalN = TECHS.filter(inTree).length;
  const branches = TECH_BRANCHES.filter(b => (b.tree || 'mil') === tree);
  if (tree === 'eco') return `<div class="def-sum">
      <div><span>성장률</span><b>${fmtStat('gdp', S.stats.gdp)}</b></div><div><span>혁신 지수</span><b>${S.stats.innovation.toFixed(0)}</b></div>
      <div><span>기술 국고 수입</span><b>+${won(TECHS.filter(t => inTree(t) && T.done.includes(t.id)).reduce((a, t) => a + (t.b?.income || 0), 0))}/분기</b></div>
      <div><span>개발 완료</span><b>${doneN}/${totalN}</b></div>
    </div>
    <p class="muted small">국고로 경제 기술을 개발하면 성장률·혁신·고용 등이 오래도록 오르고, 일부는 매 분기 국고 수입을 늘립니다. 국방 무기와 별도로 동시에 ${TECH_SLOTS}개까지.</p>
    ${active ? `<div class="tech-active"><div class="wlabel">개발 중 (${myActive.length}/${TECH_SLOTS})</div>${active}</div>` : ''}
    <div class="ttree">${branches.map(col).join('')}</div>`;
  return `<div class="def-sum">
      <div><span>사단</span><b>${Math.round(f.divs)}</b></div><div><span>전투력</span><b>${f.quality.toFixed(2)}</b></div>
      <div><span>공군력</span><b>${Math.round(f.air)}</b></div><div><span>해군력</span><b>${Math.round(f.navy)}</b></div>
      <div><span>군사력 점수</span><b>${Math.round(milPower(S))}</b></div><div><span>핵</span><b>${hasNukes(S, 'kr') ? '보유' : '없음'}</b></div>
    </div>
    <p class="muted small">국고로 무기를 개발하면 완료된 분기부터 전쟁의 전력·작전에 바로 반영됩니다. 동시에 ${TECH_SLOTS}개까지, 중단하면 40% 환불. 개발 완료 ${doneN}/${totalN}</p>
    ${active ? `<div class="tech-active"><div class="wlabel">개발 중 (${myActive.length}/${TECH_SLOTS})</div>${active}</div>` : ''}
    <div class="ttree">${branches.map(col).join('')}</div>`;
}

let terrOpen = null;
// 총독부 위임 패널 + 점령지 요약 표 (한 줄씩, 누르면 상세)
function govPanelHTML(ks) {
  const G = govSettings(S), nAuto = ks.filter(k => S.terr[k].auto).length;
  const chips = (field, list) => list.map(([v, n]) => `<button class="chip ${G[field] === v ? 'on' : ''}" data-gov="${field}|${v}">${n}</button>`).join('');
  return `<div class="gov-box">
    <div class="gov-h"><b>🤖 총독부 위임</b><span class="muted small">위임한 점령지는 참모가 매 분기 징수·징병·투자·개발 사업·현지 정책·치안 작전을 알아서 정하고, 통치 방식 변경과 봉기 같은 중요한 결정만 대통령에게 카드로 올립니다.</span></div>
    <div class="row-btns"><button class="btn sm ${nAuto === ks.length ? '' : 'primary'}" data-gall="1">🤖 전체 위임 (${nAuto}/${ks.length})</button><button class="btn sm ghost" data-gall="0">전체 직접 관리</button>
      <button class="chip ${G.autoNew !== false ? 'on' : ''}" data-gnew="1">새 점령지 자동 위임 ${G.autoNew !== false ? 'ON' : 'OFF'}</button></div>
    <div class="tseg"><span>전체 방침</span><div>${Object.entries(GOV_DIRECTIVES).map(([id, d]) => `<button class="chip" data-gdir="${id}" title="${esc(d.desc)}">${d.icon} ${d.name}</button>`).join('')}</div></div>
    <div class="tseg"><span>분기 예산</span><div>${chips('budget', [[10, '₩1조'], [30, '₩3조'], [60, '₩6조'], [120, '₩12조']])}</div></div>
    <div class="tseg"><span>국고 최소 유지</span><div>${chips('reserve', [[50, '₩5조'], [100, '₩10조'], [200, '₩20조']])}</div></div>
  </div>
  <div class="terr-table">${ks.map(k => { const t = S.terr[k], o = terrOutput(S, k), R = RULES[t.rule], net = o.capital - o.upkeep, d = GOV_DIRECTIVES[t.dir || 'balance'];
    return `<div class="tr-row ${terrOpen === k ? 'open' : ''} ${t.resist >= 75 ? 'hot' : ''}">
      <button class="tr-main" data-topen="${k}"><span class="tflag">${cflag(k)}</span><span class="tr-name"><b>${esc(cname(k))}</b><small>${R.icon} ${R.name}${t.full ? ' · 본토' : ''}</small></span>
        <span class="tr-m"><small>저항</small>${meter(t.resist, 'sur', 75)}</span><span class="tr-m"><small>통합</small>${meter(t.integ, 'mp')}</span>
        <span class="tr-inc ${net >= 0 ? 'good-t' : 'bad-t'}">${net >= 0 ? '+' : ''}${won(net)}</span><span class="tr-caret">${terrOpen === k ? '▾' : '▸'}</span></button>
      <button class="chip ${t.auto ? 'on' : ''}" data-tauto="${k}">${t.auto ? '🤖 위임' : '✋ 직접'}</button>
      <select data-tdir="${k}" ${t.auto ? '' : 'disabled'} title="${esc(d.desc)}">${Object.entries(GOV_DIRECTIVES).map(([id, x]) => `<option value="${id}" ${id === (t.dir || 'balance') ? 'selected' : ''}>${x.icon} ${x.name}</option>`).join('')}</select>
    </div>`; }).join('')}</div>
  <div class="muted small">줄을 누르면 상세 관리 화면이 열립니다.</div>`;
}
function terrHTML() {
  const ks = Object.keys(S.terr || {});
  if (!ks.length) return `<div class="empty">아직 점령지가 없습니다.<br><span class="muted small">전쟁에서 이기면 강화 회의에서 합병하거나 괴뢰 정부를 세울 수 있습니다. 그러면 이곳에서 통치 방식과 징수·징병·투자를 정합니다.</span></div>`;
  const tot = ks.reduce((a, k) => { const o = terrOutput(S, k); a.cap += o.capital - o.upkeep; a.divs += o.divs; a.gdp += o.gdp; a.mil += o.mil; return a; }, { cap: 0, divs: 0, gdp: 0, mil: 0 });
  return `<div class="def-sum">
      <div><span>💰 자본(국고)</span><b class="${tot.cap >= 0 ? 'good-t' : 'bad-t'}">${tot.cap >= 0 ? '+' : ''}${won(tot.cap)}/분기</b></div>
      <div><span>👥 인력</span><b>사단 +${tot.divs.toFixed(1)}</b></div>
      <div><span>🛡️ 국방력</span><b>군사력 +${tot.mil.toFixed(0)}</b></div>
      <div><span>⛏️ 자원</span><b>성장률 +${tot.gdp.toFixed(2)}%p</b></div>
    </div>
    ${govPanelHTML(ks)}
    ${ks.filter(k => terrOpen === k).map(k => {
      const t = S.terr[k], o = terrOutput(S, k), R = RULES[t.rule], c = cinfo(k);
      const seg = (f) => `<div class="tseg"><span>${LEVELS[f].name}</span><div>${LEVELS[f].opts.map((n, i) => `<button class="chip ${t[f] === i ? 'on' : ''}" data-tset="${k}|${f}|${i}">${n}${f === 'invest' && i ? ` ${won(LEVELS.invest.cost[i])}` : ''}</button>`).join('')}</div></div>`;
      return `<div class="terr ${t.resist >= 75 ? 'hot' : ''}">
        ${t.auto ? `<div class="gov-note">🤖 총독부 위임 중 (${GOV_DIRECTIVES[t.dir || 'balance'].icon} ${GOV_DIRECTIVES[t.dir || 'balance'].name}) — 아래 설정은 다음 분기 참모가 다시 조정합니다. 직접 만지려면 위임을 끄세요.${(t.govLog || []).length ? `<br><span class="muted">최근 조치: ${esc(t.govLog.slice(0, 3).join(' / '))}</span>` : ''}</div>` : ''}
        <div class="terr-h"><span class="tflag">${cflag(k)}</span><div><b>${esc(cname(k))}</b> <span class="tag">${R.icon} ${R.name}</span>${t.full ? ' <span class="tag good">본토 편입 완료</span>' : ''}
          <div class="muted small">인구 ${fmtPop(terrPop(k))} · 경제력 ${c.eco} · 군사력 ${c.mil} · 통치 ${S.turn - t.since}분기째</div></div>
          <button class="btn sm ghost" data-tfocus="${k}">🗺️</button></div>
        <div class="terr-bars">
          <div class="wrow"><span>✊ 저항</span>${meter(t.resist, 'sur', 75)}<em>${t.resist.toFixed(0)}</em></div>
          <div class="wrow"><span>🤝 통합</span>${meter(t.integ, 'mp')}<em>${t.integ.toFixed(0)}</em></div>
          <div class="wrow"><span>🏗️ 개발</span>${meter(t.dev, 'eq')}<em>${t.dev.toFixed(0)}</em></div>
        </div>
        <div class="terr-out">
          <span>💰 ${o.capital - o.upkeep >= 0 ? '+' : ''}${won(o.capital - o.upkeep)}<small>수입 ${won(o.capital)} · 유지 ${won(o.upkeep)}</small></span>
          <span>👥 사단 +${o.divs.toFixed(1)}</span><span>🛡️ 군사력 +${o.mil.toFixed(0)}</span><span>⛏️ 성장 +${o.gdp.toFixed(2)}%p</span>
        </div>
        <div class="wlabel">통치 방식 <span class="muted">(바꾸면 ${won(15)}, 2분기 쿨타임)</span></div>
        <div class="trules">${Object.entries(RULES).map(([id, r]) => `<button class="trule ${t.rule === id ? 'on' : ''}" data-tset="${k}|rule|${id}" title="${esc(r.desc)}"><b>${r.icon} ${r.name}</b><small>${esc(r.desc)}</small></button>`).join('')}</div>
        ${seg('extract')}${seg('conscript')}${seg('invest')}
        <div class="wlabel">🏗️ 개발 사업 <span class="muted">(동시 2개, 최대 3단계 · 진행 중: ${(t.proj || []).map(pj => { const P = TERR_PROJECTS.find(x => x.id === pj.id); return `${P.icon}${P.name} ${pj.left}분기`; }).join(', ') || '없음'})</span></div>
        <div class="tprojs">${TERR_PROJECTS.map(P => { const lv = t.lv?.[P.id] || 0, busy = (t.proj || []).filter(x => x.id === P.id).length, nx = lv + busy, cost = projCost(k, P.id, nx);
          return `<button class="tproj" data-tb="${k}|${P.id}" ${nx >= 3 || (t.proj || []).length >= 2 || S.pcap < cost ? 'disabled' : ''} title="${esc(P.desc)}">
            <span class="ic">${P.icon}</span><span class="tx"><b>${P.name}</b><small>${esc(P.desc)}</small></span>
            <span class="lv">${[0, 1, 2].map(i => `<i class="${i < lv ? 'on' : i < nx ? 'run' : ''}"></i>`).join('')}</span>
            <span class="cost">${nx >= 3 ? '최대' : won(cost)}</span></button>`; }).join('')}</div>
        <div class="wlabel">📜 현지 정책 <span class="muted">(누르면 시행/폐지)</span></div>
        <div class="tpols">${TERR_POLICIES.map(P => `<button class="chip ${t.pol?.[P.id] ? 'on' : ''}" data-tp="${k}|${P.id}" title="${esc(P.desc)}">${P.icon} ${P.name}${t.pol?.[P.id] ? ' ✓' : ` ${won(P.cost)}`}</button>`).join('')}</div>
        <div class="muted small">${TERR_POLICIES.filter(P => t.pol?.[P.id]).map(P => `${P.icon} ${P.desc}`).join(' / ') || '시행 중인 현지 정책이 없습니다. 칩에 마우스를 올리면 설명이 나옵니다.'}</div>
        ${t.resist >= 75 ? `<div class="wnuke">✊ 저항이 위험 수준입니다. 2분기 연속 최고치면 독립 봉기로 잃습니다. 징수·징병을 낮추거나 투자·자치로 달래세요.</div>` : ''}
        <div class="row-btns">${R.puppet ? '' : `<button class="btn sm" data-tsup="${k}" ${(t.supCd || 0) > S.turn ? 'disabled' : ''}>🪖 치안 작전 ${won(15)} <span class="muted small">저항 -15</span></button>`}<button class="btn sm ghost" data-trel="${k}">🕊️ 독립 승인</button></div>
      </div>`; }).join('')}`;
}

/* ---------------- 강화 회의 카드 ---------------- */
function openPeaceCard() {
  const P = S.peacePending; if (!P || !$('modal').classList.contains('hidden')) return;
  setSpeed(0);
  const k = P.k, c = cinfo(k);
  openModal(`<div class="event peace">
    <div class="ev-banner ev-good"><span class="ev-art">🏳️</span><span class="ev-kind">강화 회의</span><span class="ev-date">${cflag(k)} ${esc(cname(k))}</span></div>
    <h2>${esc(cname(k))} 항복 — 강화 조건을 정하십시오</h2>
    <p class="ev-desc">${esc(cname(k))} 정부가 무조건 항복 문서에 서명했습니다. 인구 ${fmtPop(terrPop(k))}, 경제력 ${c.eco}, 군사력 ${c.mil}. 승자로서 무엇을 요구할지 대통령이 결정합니다.</p>
    <div class="ev-opts">${PEACE_TERMS.map(t => { const why = t.can(S, k); return `<button class="ev-opt" data-pt="${t.id}" ${why ? 'disabled' : ''}><b>${t.icon} ${esc(t.name(k))}</b><span>${esc(why || t.desc(k))}</span></button>`; }).join('')}</div>
  </div>`, { closable: false });
  document.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => {
    const r = applyPeace(S, b.dataset.pt); if (r.ok === false) return toast(esc(r.msg));
    saveGame(S); closeModal(); toast(esc(r.msg), 4000); renderAll();
    if (S.terr?.[k]) { defView = 'terr'; showTab('defense'); }
  });
}
