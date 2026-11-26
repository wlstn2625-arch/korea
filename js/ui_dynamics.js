/* =========================================================
 *  변수 시뮬레이션 화면: 시국 정책안 · 세계 흐름 · 전장 변수 알림
 * ========================================================= */
(function () {
  // 정책 탭 맨 위에 시국 정책안, 국정 현황 탭 맨 위에 세계 흐름
  const pol = $('tab-policy'), st = $('tab-status');
  if (pol && !$('sit-board')) { const d = document.createElement('div'); d.id = 'sit-board'; pol.insertBefore(d, pol.firstChild); }
  if (st && !$('flow-panel')) { const d = document.createElement('div'); d.id = 'flow-panel'; d.className = 'panel'; st.insertBefore(d, st.firstChild); }
})();

let sitBusy = false;
function renderSitBoard() {
  const el = $('sit-board'); if (!el || !S) return;
  const list = sitState(S).list.filter(p => p.exp >= S.turn);
  const ai = typeof ClaudeAI !== 'undefined' && ClaudeAI.enabled();
  el.innerHTML = `<div class="sit-head"><b>🧭 시국 정책안</b> <span class="muted small">지금 나라 상황을 보고 참모진이 올린 안건. ${list.length ? '결정은 다음 분기까지' : '다음 분기에 새 안건이 올라옵니다'} · 같은 선택도 그때 흐름·민심·운에 따라 성과가 달라집니다</span></div>
    <div class="sit-list">${list.map(p => `<div class="sit-card ${p.ai ? 'ai' : ''}">
      <div class="sit-t"><span class="sit-ic">${esc(p.icon)}</span><div><h4>${esc(p.title)}</h4><div class="muted small">${esc(p.cat)}${p.ai ? ' · 🧠 Claude 기획' : ''} · ${p.exp > S.turn ? `${p.exp - S.turn + 1}분기 남음` : '이번 분기까지'}</div></div></div>
      <p class="pdesc">${esc(p.desc || '')}</p>
      <div class="sit-ch">${p.choices.map((c, i) => `<button class="sit-opt" data-sit="${p.id}" data-i="${i}" ${c.pc && S.pcap < c.pc ? 'disabled' : ''}>
        <b>${esc(c.label)}</b>${c.pc ? ` <span class="tag">${won(c.pc)}</span>` : ''}<span class="muted small">${esc(fxText(c.fx || {}) || '큰 변화 없음')}</span></button>`).join('')}</div>
    </div>`).join('') || '<div class="empty small">지금은 올라온 안건이 없습니다.</div>'}</div>
    ${ai ? `<div class="sit-ai"><input id="sit-hint" maxlength="60" placeholder="AI에게 주문 (선택) 예) 청년 표심, 전쟁 비용, 중국 견제"><button class="btn sm primary" id="sit-ai-btn" ${sitBusy ? 'disabled' : ''}>${sitBusy ? '기획 중…' : '🧠 AI 정책 기획'}</button></div>` : '<div class="muted small sit-ai">⚙️ 설정에서 Claude AI를 켜면 지금 상황에 맞춘 정책안을 AI가 직접 기획해 줍니다.</div>'}`;
  el.querySelectorAll('[data-sit]').forEach(b => b.onclick = () => {
    const r = adoptSitPolicy(S, b.dataset.sit, +b.dataset.i);
    toast(r.msg, 4200);
    if (r.ok) { saveGame(S); renderAll(); }
  });
  const ab = $('sit-ai-btn');
  if (ab) ab.onclick = async () => {
    sitBusy = true; renderSitBoard();
    try { const p = await aiSitPolicy(S, ($('sit-hint')?.value || '').trim()); toast(`🧠 새 정책안: ${p.title}`); saveGame(S); }
    catch (e) { toast('AI 기획 실패: ' + (e.message || e)); }
    sitBusy = false; renderSitBoard();
  };
}

function renderFlowPanel() {
  const el = $('flow-panel'); if (!el || !S) return;
  const F = flowOf(S), h = F.hist, prev = h.length > 1 ? h[h.length - 2] : null;
  const arrow = k => !prev || prev[k] == null ? '' : F[k] - prev[k] > 3 ? '<i class="up">▲</i>' : F[k] - prev[k] < -3 ? '<i class="dn">▼</i>' : '';
  const tone = (k, v) => ({ econ: v > 15 ? 'good' : v < -15 ? 'bad' : '', oil: v > 130 ? 'bad' : v < 85 ? 'good' : '', us: v < -30 ? 'bad' : v > 30 ? 'good' : '', cn: v > 60 ? 'bad' : v < 30 ? 'good' : '', tech: v > 60 ? 'good' : '', climate: v > 55 ? 'bad' : '', mood: v > 5 ? 'good' : v < -10 ? 'bad' : '' }[k]);
  const lp = S.lastPerf && S.turn - S.lastPerf.turn <= 1 ? S.lastPerf : null;
  el.innerHTML = `<h3>🌐 세계 흐름 <span class="muted small">판마다 다르게 움직입니다</span></h3>
    <div class="flow-grid">${Object.entries(FLOW_INFO).map(([k, m]) => `<div class="flow-i ${tone(k, F[k]) || ''}"><span>${m.icon} ${m.name}</span><b>${m.fmt(F[k])}${arrow(k)}</b></div>`).join('')}</div>
    <div class="muted small">다음 미국 대선: ${turnLabel(F.nextUsElect).year}년 · 흐름은 성장률·물가·실업·대미/대중 관계·재난 빈도·지지율에 매 분기 영향을 줍니다.</div>
    ${lp ? `<div class="flow-perf">최근 정책 성과: <b>${({ great: '🌟 대성공', ok: '✅ 순조', weak: '😐 기대 이하', back: '🌪️ 역풍' })[lp.perf]}</b> — ${esc(lp.name)} <span class="muted small">(${esc(lp.why)})</span></div>` : ''}
    ${(S.flowNews || []).slice(0, 3).map(n => `<div class="small flow-news ${n.type}">${esc(n.text)}</div>`).join('')}`;
}

const _renderAllDyn = renderAll;
renderAll = function () { _renderAllDyn(); try { renderSitBoard(); renderFlowPanel(); } catch (e) { console.error(e); } };

// 전장 변수 알림
if (typeof renderWarPanel === 'function') {
  const _rwp = renderWarPanel;
  renderWarPanel = function (...a) {
    const r = _rwp(...a);
    const T = S?.war?.theater;
    if (T?.varFx?.length) { const v = T.varFx.splice(0); v.slice(-2).forEach(x => toast(`⚔️ ${x.text}`, 3800)); }
    return r;
  };
}
