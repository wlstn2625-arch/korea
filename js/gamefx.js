/* =========================================================
 *  게임 느낌 연출 (화면 전용)
 *  - 효과를 글 대신 아이콘 칩으로 · 긴 설명은 접어 두기
 *  - 국정 지표를 원형 게이지로 · 정책 분야 아트 배너
 *  - 결재 도장 쾅 · 국고 동전 · 클릭 물결 · 효과음(끄기 가능)
 * ========================================================= */

/* ---------------- 아이콘 칩 ---------------- */
const STAT_ICON = { gdp: '📈', unemp: '👷', infl: '🛒', debt: '🏦', fiscal: '💵', tfr: '👶', gini: '⚖️', security: '🛡️', education: '🎓', safety: '🚓', justice: '🧑‍⚖️', housing: '🏠', env: '🌳', innovation: '🔬', welfare: '🤝', freedom: '🕊️', health: '🏥', happiness: '😊' };
const STAT_SHORT = { gdp: '성장', unemp: '실업', infl: '물가', debt: '채무', fiscal: '재정', tfr: '출산', gini: '불평등', security: '안보', education: '교육', safety: '치안', justice: '사법', housing: '주거', env: '환경', innovation: '산업', welfare: '복지', freedom: '자유', health: '의료', happiness: '행복' };
function chipNum(k, v) {
  const d = Math.abs(v) < 0.1 ? 2 : Math.abs(v) < 1 ? 1 : 0;
  return `${v > 0 ? '+' : ''}${(+v).toFixed(d)}`;
}
// good: 지표가 좋아지는 방향이면 초록
function fxChips(fx, max = 6) {
  const out = [];
  for (const k in fx.e || {}) { const v = fx.e[k]; if (!v) continue; const good = (STATS[k]?.good || 1) * v > 0; out.push({ w: Math.abs(v) / (k === 'tfr' ? 0.02 : k === 'gini' ? 0.005 : ['gdp', 'unemp', 'infl', 'fiscal'].includes(k) ? 0.2 : 2), html: `<i class="fxc ${good ? 'g' : 'b'}" title="${STATS[k]?.name || k}">${STAT_ICON[k] || '•'}<b>${STAT_SHORT[k] || k}</b>${chipNum(k, v)}</i>` }); }
  for (const k in fx.mods || {}) { const v = fx.mods[k]; if (!v) continue; const good = (STATS[k]?.good || 1) * v > 0; out.push({ w: Math.abs(v) * 3, html: `<i class="fxc ${good ? 'g' : 'b'} lasting" title="${STATS[k]?.name || k} (지속)">${STAT_ICON[k] || '•'}<b>${STAT_SHORT[k] || k}</b>${chipNum(k, v)}⟳</i>` }); }
  if (fx.ap) out.push({ w: Math.abs(fx.ap) * 2, html: `<i class="fxc ${fx.ap > 0 ? 'g' : 'b'}" title="지지율">📣<b>지지</b>${chipNum('ap', fx.ap)}</i>` });
  if (fx.pcap) out.push({ w: 9, html: `<i class="fxc ${fx.pcap > 0 ? 'g' : 'b'}" title="국고">💰<b>국고</b>${fx.pcap > 0 ? '+' : '−'}${won(Math.abs(fx.pcap))}</i>` });
  for (const k in fx.rel || {}) { const v = fx.rel[k]; if (!v) continue; const flag = RELATIONS[k]?.flag || (typeof cinfo === 'function' && cinfo(k)?.flag) || '🏳️'; out.push({ w: Math.abs(v) / 2, html: `<i class="fxc ${v > 0 ? 'g' : 'b'}" title="${RELATIONS[k]?.name || k} 관계">${flag}${chipNum(k, v)}</i>` }); }
  for (const k in fx.f || {}) { const v = fx.f[k]; if (!v) continue; out.push({ w: Math.abs(v) / 3, html: `<i class="fxc ${v > 0 ? 'g' : 'b'} fct" title="${FACTIONS[k]?.name || k} 지지">${FACTIONS[k]?.icon || '👥'}${chipNum(k, v)}</i>` }); }
  if (fx.threat) out.push({ w: 3, html: `<i class="fxc ${fx.threat < 0 ? 'g' : 'b'}" title="위협도">🎯${chipNum('t', fx.threat)}</i>` });
  if (fx.tension) out.push({ w: 2, html: `<i class="fxc ${fx.tension < 0 ? 'g' : 'b'}" title="세계 긴장">🌐${chipNum('t', fx.tension)}</i>` });
  out.sort((a, b) => b.w - a.w);
  const extra = fx.risk ? `<i class="fxc risk" title="${esc(fx.risk.text)}">🎲${Math.round(fx.risk.p * 100)}%</i>` : '';
  return out.slice(0, max).map(x => x.html).join('') + extra;
}

/* ---------------- 효과음 (Web Audio로 합성, 파일 없음) ---------------- */
const SFX = (() => {
  let ctx = null, on = true;
  try { on = localStorage.getItem('dg_sound') !== 'off'; } catch {}
  const ac = () => { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  function tone(freq, dur, type = 'sine', vol = 0.08, slide = 0, delay = 0) {
    const c = ac(); if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.15, lp = 600) {
    const c = ac(); if (!c) return; const n = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
    s.buffer = n; s.connect(f).connect(g).connect(c.destination); s.start();
  }
  const fx = {
    click: () => tone(1250, 0.05, 'triangle', 0.035),
    open: () => { tone(420, 0.12, 'sine', 0.04, 260); },
    stamp: () => { noise(0.25, 0.35, 380); tone(90, 0.25, 'sine', 0.18, -40); },
    coin: () => { tone(1320, 0.08, 'square', 0.03); tone(1760, 0.14, 'square', 0.03, 0, 0.07); },
    good: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.05, 0, i * 0.08)); },
    bad: () => { tone(220, 0.3, 'sawtooth', 0.04, -80); },
  };
  return { play: k => { if (on) try { fx[k]?.(); } catch {} }, get on() { return on; }, toggle() { on = !on; try { localStorage.setItem('dg_sound', on ? 'on' : 'off'); } catch {} if (on) fx.good(); return on; } };
})();

/* ---------------- 도장·동전·물결 ---------------- */
function stampFx(text = '결재', sub = '', kind = 'red') {
  const el = document.createElement('div'); el.className = `stamp-fx ${kind}`;
  el.innerHTML = `<div class="st-seal"><b>${esc(text)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  document.body.appendChild(el); SFX.play('stamp');
  setTimeout(() => document.querySelector('.stage, #game')?.classList.add('shake-mini'), 180);
  setTimeout(() => document.querySelector('.stage, #game')?.classList.remove('shake-mini'), 520);
  setTimeout(() => el.remove(), 1500);
}
let lastPointer = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY }; }, true);
function coinFx(n = 6, from = lastPointer) {
  const to = $('hdr-pcap')?.closest('.res')?.getBoundingClientRect(); if (!to) return;
  const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i'); c.className = 'coin-fx'; c.textContent = '🪙';
    const sx = from.x + (Math.random() - 0.5) * 60, sy = from.y + (Math.random() - 0.5) * 40;
    c.style.left = sx + 'px'; c.style.top = sy + 'px';
    document.body.appendChild(c);
    const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 200, my = Math.min(sy, ty) - 80 - Math.random() * 80;
    c.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: `translate(${mx - sx}px, ${my - sy}px) translate(-50%,-50%) scale(1.2)`, opacity: 1, offset: 0.45 }, { transform: `translate(${tx - sx}px, ${ty - sy}px) translate(-50%,-50%) scale(.6)`, opacity: 0.9 }],
      { duration: 750 + i * 70, easing: 'cubic-bezier(.3,.6,.4,1)', delay: i * 40 }).onfinish = () => { c.remove(); if (i === 0) SFX.play('coin'); };
  }
}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn, .opt, .sit-opt, .pact, .chip, .dock button, .party-opt, .speed button, .dact button, .res'); if (!b || b.disabled) return;
  const r = b.getBoundingClientRect(), box = document.createElement('span'), w = document.createElement('span'); box.className = 'ripple-box'; w.className = 'ripple-fx';
  const s = Math.max(r.width, r.height) * 2; w.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  box.appendChild(w); b.appendChild(box); setTimeout(() => box.remove(), 600);
  SFX.play('click');
});

/* ---------------- 결과에 연출 붙이기 ---------------- */
function wrapFx(name, onOk) {
  const f = window[name]; if (typeof f !== 'function') return;
  window[name] = function (...a) { const r = f.apply(this, a); try { if (r && r.ok !== false && !r.refused) onOk(r, a); else if (r && r.ok === false) SFX.play('bad'); } catch {} return r; };
}
wrapFx('enactPolicy', r => { if (r.bill) stampFx('발의', '국회 제출', 'blue'); else if (r.passed === false) { stampFx('부결', '', 'gray'); SFX.play('bad'); } else stampFx('결재', '대통령'); });
wrapFx('adoptSitPolicy', r => stampFx(r.perf?.id === 'back' ? '역풍' : r.perf?.id === 'great' ? '대성공' : '결재', r.perf?.name || '', r.perf?.id === 'back' ? 'gray' : 'red'));
wrapFx('buildFactory', () => stampFx('착공', '산업 시설', 'blue'));
wrapFx('diploAction', r => { if (/❌/.test(r.msg || '')) SFX.play('bad'); else stampFx('서명', '외교', 'blue'); });
wrapFx('financeAction', () => coinFx(8));
wrapFx('repayDebt', () => stampFx('상환', '나랏빚', 'blue'));
wrapFx('resolveDomEvent', () => stampFx('재가', '', 'red'));

// 국고가 늘면 동전이 날아감
{
  let prevP = null;
  const _rh = renderHeader;
  renderHeader = function () { _rh(); if (!S) return; if (prevP != null && S.pcap - prevP >= 10) coinFx(Math.min(10, 3 + Math.round((S.pcap - prevP) / 30))); prevP = S.pcap; };
}

/* ---------------- 긴 설명은 접어 두기 ---------------- */
const CLAMP_SEL = '.tab .muted.small, .tab .pdesc, .tab p.muted, .tab .hint, .cpanel .muted.small, .sys-head .muted';
function clampTexts(root) {
  root.querySelectorAll(CLAMP_SEL).forEach(el => {
    if (el.dataset.cl || el.closest('button, .opt, .sit-opt, .pact, .fxc, label, .stat-row, .bar-row, .brow, .ms-row, h3, h4')) return;
    el.dataset.cl = 1;
    const len = el.textContent.trim().length; if (len < 70) return;
    el.classList.add('txt-clamp'); el.title = '눌러서 펼치기';
    el.addEventListener('click', () => el.classList.toggle('open'));
  });
}
{
  let pend = false;
  const mo = new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; const pb = document.querySelector('.panel-body'); if (pb) clampTexts(pb); }); });
  const pb = document.querySelector('.panel-body'); if (pb) mo.observe(pb, { childList: true, subtree: true });
}

/* ---------------- 정책: 분야 아트 배너 + 선택지에 효과 칩 ---------------- */
const CAT_ART = { const: ['#3b2a64', '#7a4fc9', '🏛️', '📜'], tax: ['#5a4310', '#c99a2e', '💰', '🧾'], econ: ['#123a4a', '#2a8fb0', '🏭', '⚙️'], labor: ['#4a2e12', '#c4782a', '🦺', '🔧'],
  welfare: ['#5a1d3b', '#d0628f', '🍼', '❤️'], house: ['#18402c', '#3fa06a', '🏠', '🏗️'], edu: ['#1b3460', '#4f86d9', '🏫', '📚'], defense: ['#2c3a1c', '#6f8f3a', '🪖', '🚀'],
  diplo: ['#0f3b4f', '#2fa3c7', '🌏', '🤝'], justice: ['#3a1d1d', '#b4463f', '⚖️', '🔨'], civil: ['#38264a', '#9a6ad0', '👨‍👩‍👧', '💍'], env: ['#183e1d', '#4fb04f', '⚡', '🌱'], health: ['#103f3f', '#33b3a8', '🩺', '💊'] };
function catBanner() {
  const c = CATEGORIES.find(x => x.id === activeCat); if (!c) return '';
  const A = CAT_ART[c.id] || ['#22303e', '#4a5a6a', c.icon, '✨'];
  const list = allPolicies().filter(p => p.cat === c.id), changed = list.filter(p => !currentOption(p, S).cur).length;
  return `<div class="cat-banner" style="--c1:${A[0]};--c2:${A[1]}"><span class="cb-art a1">${A[2]}</span><span class="cb-art a2">${A[3]}</span>
    <div class="cb-t"><small>정책 분야</small><b>${c.icon} ${esc(c.name)}</b><span>제도 ${list.length}개 · 바꾼 것 ${changed}개</span></div>
    <div class="cb-prog"><i style="width:${list.length ? Math.round(changed / list.length * 100) : 0}%"></i></div></div>`;
}
{
  const _rp = renderPolicies;
  renderPolicies = function () {
    _rp();
    const pl = $('policy-list'); if (!pl || !S) return;
    if (!$('cat-banner-slot')) { const d = document.createElement('div'); d.id = 'cat-banner-slot'; pl.parentNode.insertBefore(d, pl); }
    $('cat-banner-slot').innerHTML = catBanner();
    pl.querySelectorAll('.opt[data-p][data-o]').forEach(b => {
      if (b.querySelector('.ochips')) return;
      const p = policyById(b.dataset.p, S), o = p && optionOf(p, b.dataset.o); if (!o || o.cur && b.classList.contains('current')) return;
      const html = fxChips({ e: o.e || {}, f: o.f || {}, rel: o.rel || {} }, 4); if (!html) return;
      const d = document.createElement('span'); d.className = 'ochips'; d.innerHTML = html; b.appendChild(d);
    });
  };
}

/* ---------------- 국정 지표: 원형 게이지 ---------------- */
function gaugeVal(k, v) {
  const m = STATS[k]; let p;
  if (m.max === 100 && m.min === 0) p = v / 100;
  else { const lo = { gdp: -2, unemp: 1, infl: 0, debt: 0, fiscal: -8, tfr: 0.5, gini: 0.25 }[k] ?? m.min, hi = { gdp: 5, unemp: 8, infl: 6, debt: 120, fiscal: 3, tfr: 2.1, gini: 0.45 }[k] ?? m.max; p = (v - lo) / (hi - lo); }
  p = clamp(p, 0, 1);
  const goodness = k === 'infl' ? 1 - Math.min(1, Math.abs(v - 2) / 3) : m.good > 0 ? p : 1 - p;
  return { p, goodness };
}
{
  const _rs = renderSide;
  renderSide = function () {
    _rs();
    const el = $('stat-list'); if (!el || !S) return;
    const prev = S.history.length > 1 ? S.history[S.history.length - 2] : S.history[0];
    el.classList.add('gauges');
    el.innerHTML = Object.entries(STATS).map(([k, m]) => {
      const v = S.stats[k], d = v - prev.stats[k], { p, goodness } = gaugeVal(k, v);
      const col = goodness >= 0.6 ? 'var(--good)' : goodness >= 0.35 ? 'var(--mid)' : 'var(--bad)';
      const C = 2 * Math.PI * 22, show = Math.abs(d) >= Math.pow(10, -m.dec) / 2;
      return `<div class="gz" title="${m.name} ${fmtStat(k, v)}"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="22" class="gz-bg"/><circle cx="28" cy="28" r="22" class="gz-fg" style="stroke:${col};stroke-dasharray:${(C * p).toFixed(1)} ${C.toFixed(1)}"/></svg>
        <span class="gz-ic">${STAT_ICON[k]}</span><b>${fmtStat(k, v)}</b><small>${m.name}</small>${show ? `<em class="${deltaClass(k, d)}">${d > 0 ? '▲' : '▼'}${Math.abs(d).toFixed(m.dec)}</em>` : ''}</div>`;
    }).join('');
  };
}

/* ---------------- 시국 정책안: 글 대신 칩 ---------------- */
if (typeof renderSitBoard === 'function') {
  const _sb = renderSitBoard;
  renderSitBoard = function () {
    _sb();
    const el = $('sit-board'); if (!el || !S) return;
    const head = el.querySelector('.sit-head .muted'); if (head) head.textContent = '지금 상황에 맞춰 올라온 안건 · 결과는 운과 흐름에 따라 달라짐';
    el.querySelectorAll('.sit-opt').forEach(b => {
      const p = sitState(S).list.find(x => x.id === b.dataset.sit), c = p?.choices[+b.dataset.i]; if (!c) return;
      const sm = b.querySelector('.muted.small'); if (sm) { sm.outerHTML = `<span class="ochips">${fxChips(c.fx || {}) || '<i class="fxc">변화 적음</i>'}</span>`; }
    });
  };
}

/* ---------------- 소리 켜고 끄기 버튼 (상단) ---------------- */
(function () {
  const hr = document.querySelector('.hud-right'); if (!hr || $('btn-sound')) return;
  const b = document.createElement('button'); b.id = 'btn-sound'; b.className = 'btn ghost'; b.title = '효과음';
  const set = () => { b.textContent = SFX.on ? '🔊' : '🔇'; };
  set(); b.onclick = () => { SFX.toggle(); set(); };
  hr.insertBefore(b, $('btn-settings'));
})();

// 패널 열 때 효과음
{
  const _st = showTab;
  showTab = function (name, toggle) { const was = openPanelName; _st(name, toggle); if (openPanelName && openPanelName !== was) SFX.play('open'); };
}
