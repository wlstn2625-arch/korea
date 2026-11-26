/* =========================================================
 *  엔딩 화면: 목표 진행도 · 엔딩 연출 · 명예의 전당
 * ========================================================= */
(function () {
  const st = $('tab-status');
  if (st && !$('vic-panel')) { const d = document.createElement('div'); d.id = 'vic-panel'; d.className = 'panel'; st.insertBefore(d, st.firstChild); }
})();

function renderVictoryPanel() {
  const el = $('vic-panel'); if (!el || !S) return;
  const V = vicState(S);
  el.innerHTML = `<h3>🏁 엔딩 목표 <span class="muted small">하나만 달성해도 엔딩 · 이후 계속 통치 가능</span></h3>
    <div class="vic-list">${VICTORIES.map(v => {
      let pr = { p: 0, text: '' }; try { pr = v.progress(S); } catch {}
      const won = V.won.find(w => w.id === v.id);
      return `<div class="vic-row ${won ? 'won' : ''}"><span class="vic-ic">${v.icon}</span><div class="vic-b"><div class="vic-t"><b>${v.name}</b>${won ? `<em>🏆 달성 ${turnLabel(won.turn).year}년</em>` : `<em>${Math.round(pr.p * 100)}%</em>`}</div>
        <div class="vic-bar"><i style="width:${won ? 100 : Math.round(pr.p * 100)}%"></i></div><small>${esc(won ? v.desc : pr.text)}</small></div></div>`;
    }).join('')}</div>`;
}
{ const _ra = renderAll; renderAll = function () { _ra(); try { renderVictoryPanel(); } catch (e) { console.error(e); } }; }

function winsLog() { try { return JSON.parse(localStorage.getItem('dg_wins') || '[]'); } catch { return []; } }
function recordWin(v, grade) {
  const w = winsLog(); w.unshift({ id: v.id, diff: S.difficulty, name: S.name, year: turnLabel(S.turn).year, grade, at: Date.now() });
  try { localStorage.setItem('dg_wins', JSON.stringify(w.slice(0, 50))); } catch {}
}

function openVictoryCard() {
  const V = vicState(S), id = V.pending; if (!id) return nextEvent();
  const v = VICTORIES.find(x => x.id === id); V.pending = null;
  setSpeed(0);
  const sc = typeof finalScore === 'function' ? finalScore(S) : { grade: '-', total: 0, title: '' };
  recordWin(v, sc.grade); if (typeof recordClear === 'function' && sc.grade) recordClear(S.difficulty, sc.grade);
  const D = DIFFICULTY[S.difficulty] || {};
  const confetti = Array.from({ length: 60 }, (_, i) => `<i style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * 1.6).toFixed(2)}s;animation-duration:${(2.4 + Math.random() * 2).toFixed(2)}s;background:hsl(${Math.floor(Math.random() * 360)} 90% 60%);transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`).join('');
  openModal(`<div class="victory">
    <div class="vc-confetti">${confetti}</div>
    <div class="vc-rays"></div>
    <div class="vc-trophy">🏆</div>
    <div class="vc-kind">${v.icon} ${esc(v.name)} 엔딩</div>
    <h2 class="vc-title">${esc(v.title)}</h2>
    <p class="vc-desc">${esc(v.desc)}<br><b>${esc(S.name)} 대통령 · ${turnLabel(S.turn).year}년 달성</b></p>
    <div class="vc-grid">
      <div><small>국가 등급</small><b>${D.icon || ''} ${esc(D.name || '')}</b></div>
      <div><small>최종 평가</small><b class="vc-grade">${sc.grade}</b></div>
      <div><small>걸린 시간</small><b>${Math.floor(S.turn / 4)}년 ${S.turn % 4}분기</b></div>
      <div><small>국력 순위</small><b>${rankNow(S)}위</b></div>
      <div><small>점령·합병</small><b>${worldOwned(S)}개국</b></div>
      <div><small>지지율</small><b>${S.approval.toFixed(0)}%</b></div>
    </div>
    <div class="vc-btns"><button class="btn" id="vc-cont">👑 계속 통치하기</button><button class="btn primary" id="vc-new">🏆 명예의 전당 · 새 게임</button></div>
  </div>`, { closable: false });
  $('modal').classList.add('scene-mode', 'victory-mode');
  SFX.play('good'); setTimeout(() => SFX.play('good'), 450); setTimeout(() => stampFx('엔딩', v.name, 'red'), 900);
  saveGame(S);
  $('vc-cont').onclick = () => { closeModal(); toast(`👑 무한 모드: 남은 엔딩에 계속 도전할 수 있습니다.`, 4500); };
  $('vc-new').onclick = () => { closeModal(); restart(); };
}

// 분기 결산 뒤 엔딩 카드
if (typeof afterQuarter === 'function') {
  const _aq = afterQuarter;
  afterQuarter = function (...a) {
    const r = _aq.apply(this, a);
    if (S && vicState(S).pending) { eventQueue.push(() => openVictoryCard()); if ($('modal').classList.contains('hidden')) nextEvent(); }
    return r;
  };
}

// 시작 화면: 달성한 엔딩 트로피
{
  const _rs = renderStart;
  renderStart = function () {
    _rs();
    const box = $('diff-desc'); if (!box) return;
    let t = $('win-row'); if (!t) { t = document.createElement('div'); t.id = 'win-row'; t.className = 'win-row'; box.after(t); }
    const w = winsLog(); const got = new Set(w.map(x => x.id));
    t.innerHTML = `<span>🏆 엔딩 ${got.size}/${VICTORIES.length}</span>${VICTORIES.map(v => `<i class="${got.has(v.id) ? 'on' : ''}" title="${esc(v.name)}${got.has(v.id) ? ' (달성)' : ''}">${v.icon}</i>`).join('')}${w[0] ? `<small>최근: ${esc(w[0].name)} · ${esc(VICTORIES.find(v => v.id === w[0].id)?.name || '')} · ${esc(DIFFICULTY[w[0].diff]?.name || '')} ${esc(w[0].grade || '')}</small>` : ''}`;
  };
}
if (!$('start').classList.contains('hidden')) renderStart();
