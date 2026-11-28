/* =========================================================
 *  상황에 맞게 섞어 쓰는 게임 화면
 *  D 살아있는 지도: 사건 핀 · 청와대 원형 행동 메뉴
 *  C 집무실 대화: 사건·위기를 장관이 직접 보고, 말풍선으로 대답
 *  A 결재 카드 넘기기: 시국 정책안을 카드로 좌우로 넘겨 결정
 * ========================================================= */

/* ---------------- 등장인물 ---------------- */
const SC_CAST = {
  politics: ['const', '🧑‍💼'], society: ['civil', '👩‍💼'], disaster: ['civil', '🧑‍🚒'], security: ['defense', '👨‍✈️'], economy: ['econ', '👨‍💼'],
  tech: ['econ', '👩‍🔬'], good: ['const', '🙋'], diplo: ['diplo', '🤵'], extreme: ['global', '🧑‍✈️'],
  fiscal: ['tax', '👨‍💼'], protest: ['justice', '👮'], market: ['econ', '👨‍💼'], diplomacy: ['diplo', '🤵'], legal: ['justice', '👩‍⚖️'],
  social: ['civil', '👩‍💼'], brain: ['econ', '👩‍🔬'], inflation: ['tax', '👨‍💼'], housing: ['house', '👷'],
};
const SC_PROP = { politics: '📢', society: '🏙️', disaster: '🌊', security: '🚀', economy: '📉', tech: '🤖', good: '🎉', diplo: '🌐', extreme: '🚨',
  fiscal: '💸', protest: '✊', market: '📉', diplomacy: '🌐', legal: '⚖️', social: '🔥', brain: '🧳', inflation: '🛒', housing: '🏚️' };
const SC_SKY = { extreme: 'storm-red', disaster: 'storm', security: 'night', good: 'day', tech: 'day', economy: 'dusk', market: 'dusk' };
const CAT2MIN = { '경제': 'econ', '고용': 'labor', '산업': 'econ', '부동산': 'house', '금융': 'tax', '에너지': 'env', '민생': 'econ', '인구': 'welfare', '안전': 'civil', '의료': 'health', '복지': 'welfare', '지방': 'civil',
  '안보': 'defense', '정치': 'const', '전시': 'defense', '전후': 'defense', '방산': 'defense', '영토': 'defense', '외교': 'diplo', '국제': 'global', '과학': 'econ', '보건': 'health', 'AI 기획': 'const' };
const MIN_FACE = { const: '🧑‍💼', tax: '👨‍💼', econ: '👩‍💼', labor: '👷', welfare: '👩‍⚕️', house: '👷‍♂️', edu: '👩‍🏫', defense: '👨‍✈️', diplo: '🤵', justice: '👩‍⚖️', civil: '🧑‍💼', env: '🧑‍🔬', health: '🧑‍⚕️', global: '🕵️' };
function castOf(kind) {
  const [cat, face] = SC_CAST[kind] || ['const', '🧑‍💼'];
  const m = typeof ministerOf === 'function' ? ministerOf(cat) : { name: '참모', title: '대통령실' };
  return { face, name: m.name, title: m.title || '대통령실', hue: m.hue ?? 210 };
}

/* ---------------- 설명 글 → 아이콘 칩 ---------------- */
const SC_NAMES = (() => {
  const m = {};
  for (const k in STATS) { m[STATS[k].name] = ['s', k]; if (typeof STAT_SHORT !== 'undefined') m[STAT_SHORT[k]] = ['s', k]; }
  m['사법 신뢰'] = ['s', 'justice']; m['재정'] = ['s', 'fiscal']; m['성장률'] = ['s', 'gdp']; m['물가'] = ['s', 'infl']; m['채무'] = ['s', 'debt']; m['출산율'] = ['s', 'tfr'];
  for (const k in FACTIONS) m[FACTIONS[k].name] = ['f', k];
  m['재계'] = ['f', 'biz']; m['노동계'] = ['f', 'labor']; m['청년'] = ['f', 'youth']; m['노년'] = ['f', 'elder']; m['지방 세력'] = ['f', 'local']; m['군'] = ['f', 'mil']; m['법조계'] = ['f', 'legal']; m['의료계'] = ['f', 'medic'];
  for (const k in RELATIONS) { m[RELATIONS[k].name] = ['r', k]; m[RELATIONS[k].name + ' 관계'] = ['r', k]; }
  m['지지율'] = ['ap']; m['국고'] = ['pc']; m['야당 협조도'] = ['x', '🤝']; m['당 장악력'] = ['x', '🏛️']; m['위협도'] = ['x', '🎯']; m['세계 긴장'] = ['x', '🌐']; m['안보'] = ['s', 'security'];
  return m;
})();
function descChips(desc) {
  if (!desc) return { chips: '', rest: '' };
  const out = []; let rest = desc;
  const re = /([가-힣A-Za-z·\s]{1,10}?)\s*([+\-−]\s?\d+(?:\.\d+)?)\s*(%p|%)?/g; let m;
  while ((m = re.exec(desc))) {
    const name = m[1].trim().replace(/^(및|과|와|,)\s*/, ''); const v = parseFloat(m[2].replace('−', '-').replace(/\s/g, ''));
    const hit = SC_NAMES[name] || SC_NAMES[name.split(' ').pop()]; if (!hit || !isFinite(v)) continue;
    let html = '';
    if (hit[0] === 's') { const good = (STATS[hit[1]]?.good || 1) * v > 0; html = `<i class="fxc ${good ? 'g' : 'b'}">${STAT_ICON[hit[1]] || '•'}<b>${STAT_SHORT[hit[1]] || name}</b>${v > 0 ? '+' : ''}${v}</i>`; }
    else if (hit[0] === 'f') html = `<i class="fxc ${v > 0 ? 'g' : 'b'}">${FACTIONS[hit[1]].icon}${v > 0 ? '+' : ''}${v}</i>`;
    else if (hit[0] === 'r') html = `<i class="fxc ${v > 0 ? 'g' : 'b'}">${RELATIONS[hit[1]].flag}${v > 0 ? '+' : ''}${v}</i>`;
    else if (hit[0] === 'ap') html = `<i class="fxc ${v > 0 ? 'g' : 'b'}">📣<b>지지</b>${v > 0 ? '+' : ''}${v}</i>`;
    else if (hit[0] === 'pc') html = `<i class="fxc ${v > 0 ? 'g' : 'b'}">💰${v > 0 ? '+' : ''}${v}</i>`;
    else html = `<i class="fxc ${(hit[1] === '🎯' || hit[1] === '🌐') ? (v < 0 ? 'g' : 'b') : (v > 0 ? 'g' : 'b')}">${hit[1]}${v > 0 ? '+' : ''}${v}</i>`;
    out.push(html); rest = rest.replace(m[0], '');
  }
  rest = rest.replace(/[,.·\s]+$/g, '').replace(/^[,.·\s]+/g, '').replace(/\s*,\s*,+/g, ',').trim();
  const pm = desc.match(/(\d+)%\s*확률/); if (pm && !out.length) out.push(`<i class="fxc risk">🎲${pm[1]}%</i>`);
  return { chips: out.join(''), rest: rest.length > 2 ? rest : '' };
}

/* ---------------- C 집무실 장면 ---------------- */
let scTyping = null;
function typeLine(el, text, done) {
  clearInterval(scTyping); el.textContent = ''; let i = 0;
  const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fast) { el.textContent = text; done && done(); return; }
  scTyping = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(scTyping); scTyping = null; done && done(); } }, 22);
  el.closest('.sc-talk').onclick = () => { if (scTyping) { clearInterval(scTyping); scTyping = null; el.textContent = text; done && done(); } };
}
function skyline() { let h = ''; for (let i = 0; i < 14; i++) h += `<i style="height:${25 + ((i * 37) % 60)}%"></i>`; return h; }
function openScene(o) {
  const C = o.cast;
  openModal(`<div class="scene sky-${o.sky || 'dusk'} ${o.extreme ? 'extreme' : ''}">
    <div class="sc-room"><div class="sc-win"><div class="sc-skyline">${skyline()}</div><div class="sc-prop">${o.prop || ''}</div></div><div class="sc-flag">🇰🇷</div><div class="sc-desk"></div></div>
    <div class="sc-head"><span class="sc-kind">${esc(o.kind || '')}</span><b class="sc-title">${esc(o.title)}</b></div>
    <div class="sc-char" style="--h:${C.hue}">${C.face}</div>
    ${o.side ? `<div class="sc-char side">${o.side}</div>` : ''}
    <div class="sc-choices hidden">${o.choices.map((c, i) => `<button class="sc-ch ${c.best ? 'best' : ''}" data-i="${i}" ${c.disabled ? 'disabled' : ''} ${c.hide ? 'hidden' : ''}>
      <span class="sc-lbl">${esc(c.label)}${c.best ? ' <em class="sc-rec">추천</em>' : ''}</span><span class="ochips">${c.chips || ''}</span>${c.meta ? `<small>${esc(c.meta)}</small>` : ''}</button>`).join('')}</div>
    <div class="sc-talk"><div class="sc-name">${esc(C.title)} · ${esc(C.name)}</div><div class="sc-line"></div><div class="sc-more">▼</div></div>
  </div>`, { closable: false });
  $('modal').classList.add('scene-mode');
  SFX.play('open');
  const line = $('modal-body').querySelector('.sc-line'), chs = $('modal-body').querySelector('.sc-choices');
  typeLine(line, o.line, () => { chs.classList.remove('hidden'); $('modal-body').querySelector('.sc-more').classList.add('hidden'); });
  chs.querySelectorAll('.sc-ch').forEach(b => b.onclick = async () => {
    chs.querySelectorAll('.sc-ch').forEach(x => x.disabled = true); b.classList.add('picked');
    const r = await o.onPick(+b.dataset.i);
    if (!r) { chs.querySelectorAll('.sc-ch').forEach(x => x.disabled = false); b.classList.remove('picked'); return; }
    sceneResult(r);
  });
}
function sceneResult(r) {
  const body = $('modal-body'), sc = body.querySelector('.scene'); if (!sc) return;
  sc.querySelector('.sc-choices').classList.add('hidden');
  const ch = sc.querySelector('.sc-char'); ch.classList.add(r.ok === false ? 'sad' : 'happy');
  if (r.chips) { const f = document.createElement('div'); f.className = 'sc-float ochips'; f.innerHTML = r.chips; sc.appendChild(f); }
  if (r.badge) { const b = document.createElement('div'); b.className = `sc-badge ${r.ok === false ? 'fail' : 'ok'}`; b.textContent = r.badge; sc.appendChild(b); SFX.play(r.ok === false ? 'bad' : 'good'); }
  sc.querySelector('.sc-name').textContent = r.speaker || sc.querySelector('.sc-name').textContent;
  typeLine(sc.querySelector('.sc-line'), r.text, () => {
    const btn = document.createElement('button'); btn.className = 'btn primary sc-next'; btn.textContent = '계속 ▶'; btn.onclick = () => closeModal();
    sc.querySelector('.sc-talk').appendChild(btn); btn.focus();
  });
}
{ const _om = openModal; openModal = function (...a) { $('modal').classList.remove('scene-mode', 'deck-mode', 'hand-mode'); return _om.apply(this, a); }; }

// 정치·사회 사건 → 집무실 대화
openDomEventCard = function (id) {
  const ev = S.dom.pending.find(x => x.id === id); if (!ev) return closeModal();
  setSpeed(0);
  const def = DOM_EVENTS[ev.key], kind = (typeof EVENT_KINDS !== 'undefined' && EVENT_KINDS[def.kind]) || { name: '국내 정치' };
  const k = def.extreme ? 'extreme' : def.kind || 'politics';
  openScene({
    key: k, cast: castOf(k), kind: def.extreme ? `🚨 국가 비상 · ${kind.name}` : `${def.icon} ${kind.name}`, title: ev.title, prop: def.icon || SC_PROP[k], sky: SC_SKY[k], extreme: def.extreme,
    line: `대통령님, ${ev.desc}`,
    choices: def.choices.map(c => { const d = descChips(c.desc); return { label: c.label, chips: d.chips + (d.rest ? `<i class="fxc note">${esc(d.rest.slice(0, 40))}</i>` : ''), meta: c.pc ? `국고 ${won(c.pc)}` : '', disabled: c.pc && S.pcap < c.pc, hide: typeof choiceGone === 'function' && def.choices.filter(x => !choiceGone(S, x)).length >= 1 && choiceGone(S, c) }; }),
    onPick: i => {
      const r = resolveDomEvent(S, id, i);
      if (!r?.ok) { toast(esc(r?.msg || '처리할 수 없습니다.')); return null; }
      saveGame(S); renderAll();
      return { text: r.text, badge: '재가', chips: descChips(def.choices[i].desc).chips };
    },
  });
};

// 위기 → 집무실 대화 (성공·실패 판정)
openEventCard = function (cid) {
  const c = S.crises.find(x => x.id === cid); if (!c) return nextEvent();
  setSpeed(0);
  const evals = aiEvaluate(S, c), best = evals[0].i, p = c.pid && policyById(c.pid, S);
  const choices = c.options.map((o, i) => { const ev = evals.find(x => x.i === i), fx = expandSolution(S, c, o, true);
    return { label: o.label, best: i === best, chips: fxChips({ e: fx.e, rel: fx.rel, f: fx.f }, 5), meta: `성공 ${(ev.ok * 100).toFixed(0)}%${o.pc ? ` · 국고 ${won(o.pc)}` : ''}`, disabled: o.pc && S.pcap < o.pc }; });
  choices.push({ label: `🤖 ${ClaudeAI.enabled() ? 'Claude' : 'AI 참모'}에게 맡긴다`, chips: '', meta: '참모가 판단해 처리' });
  openScene({
    key: c.tpl, cast: castOf(c.tpl), kind: `${c.icon} ${c.kind}${c.good ? ' · 기회' : ` · 심각도 ${'●'.repeat(c.sev)}`}`, title: c.title, prop: SC_PROP[c.tpl] || c.icon, sky: c.good ? 'day' : SC_SKY[c.tpl] || 'dusk', extreme: c.sev >= 3,
    line: `대통령님, ${c.desc}${p ? ` (원인: ${p.name})` : ''}`,
    choices,
    onPick: async i => {
      const rec = i === c.options.length ? await aiResolve(c) : resolveCrisis(S, c.id, i, 'player');
      saveGame(S); renderAll();
      if (!rec) return { text: '처리했습니다.', badge: '완료' };
      return { ok: rec.success, badge: rec.success ? '성공' : '실패', text: `${rec.outcome}${rec.reasoning ? ` — ${rec.reasoning}` : ''}`, chips: fxChips({ e: rec.fx.e, rel: rec.fx.rel, f: rec.fx.f }, 5) };
    },
  });
};

/* ---------------- A 결재 카드 넘기기 ---------------- */
function meterVals() {
  const rel = ['us', 'cn', 'jp', 'eu'].reduce((a, k) => a + (S.rel[k] || 50), 0) / 4;
  return { people: S.approval / 100, money: clamp(S.pcap / 400, 0, 1), safe: S.stats.security / 100, world: rel / 100 };
}
function meterHits(fx) {
  const h = { people: 0, money: 0, safe: 0, world: 0 };
  const add = (k, v) => { h[k] = Math.max(h[k], Math.abs(v)); };
  if (fx.ap) add('people', fx.ap / 2); for (const k in fx.f || {}) add('people', fx.f[k] / 6);
  for (const k in fx.e || {}) { const v = fx.e[k]; if (['gdp', 'unemp', 'infl', 'debt', 'fiscal', 'innovation', 'housing'].includes(k)) add('money', v / (['gdp', 'unemp', 'infl', 'fiscal'].includes(k) ? 0.3 : 2)); else if (['security', 'safety'].includes(k)) add('safe', v / 2); else add('people', v / 3); }
  if (fx.pcap) add('money', fx.pcap / 10); if (fx.war) add('safe', 1);
  for (const k in fx.rel || {}) add('world', fx.rel[k] / 4); if (fx.threat || fx.tension) add('world', 1);
  return h;
}
let deckSel = 0;
function openDeck() {
  const list = sitState(S).list.filter(p => p.exp >= S.turn);
  setSpeed(0);
  const mv = meterVals();
  const top = list[0];
  if (!top) {
    openModal(`<div class="deck empty"><div class="dk-done">🗂️</div><h2>결재할 서류가 없습니다</h2><p class="muted">다음 분기에 새 안건이 올라옵니다.</p><div class="modal-actions"><button class="btn primary" onclick="closeModal()">닫기</button></div></div>`);
    $('modal').classList.add('scene-mode', 'deck-mode'); return;
  }
  deckSel = Math.min(deckSel, top.choices.length - 1);
  const c = top.choices[deckSel], hits = meterHits(c.fx || {}), min = CAT2MIN[top.cat] || 'const', m = typeof ministerOf === 'function' ? ministerOf(min) : { name: '', title: '' };
  const meter = (k, ic, v) => `<div class="dk-m"><div class="dk-ic"><i style="height:${Math.round(v * 100)}%"></i><span>${ic}</span></div><div class="dk-dot" style="transform:scale(${hits[k] ? clamp(0.5 + hits[k], 0.6, 1.6) : 0})"></div></div>`;
  openModal(`<div class="deck">
    <div class="dk-meters">${meter('people', '😊', mv.people)}${meter('money', '💰', mv.money)}${meter('safe', '🪖', mv.safe)}${meter('world', '🌏', mv.world)}</div>
    <div class="dk-stack">${list[1] ? '<div class="dk-ghost g2"></div>' : ''}${list[2] ? '<div class="dk-ghost g3"></div>' : ''}
      <div class="dk-card" id="dk-card">
        <div class="dk-who" style="--h:${m.hue ?? 210}"><span>${MIN_FACE[min] || '🧑‍💼'}</span><b class="dk-tag">${esc(m.title || '')} ${esc(m.name || '')}</b><em class="dk-yes">결재!</em><em class="dk-no">보류</em></div>
        <div class="dk-body"><h3>${esc(top.icon)} ${esc(top.title)}</h3><p>"${esc((top.desc || '').slice(0, 70))}"</p>
          ${top.choices.length > 1 ? `<div class="dk-opts">${top.choices.map((x, i) => `<button class="dk-opt ${i === deckSel ? 'on' : ''}" data-o="${i}">${esc(x.label)}</button>`).join('')}</div>` : ''}
          <div class="ochips dk-chips">${fxChips(c.fx || {}, 5)}</div>${c.pc ? `<div class="dk-cost">국고 ${won(c.pc)}</div>` : ''}</div>
      </div></div>
    <div class="dk-btns"><button class="dk-b no" id="dk-no">✖<small>보류</small></button><span class="dk-left">남은 서류 ${list.length}장</span><button class="dk-b yes" id="dk-yes" ${c.pc && S.pcap < c.pc ? 'disabled' : ''}>✔<small>결재</small></button></div>
    <div class="dk-hint">카드를 오른쪽으로 밀면 결재, 왼쪽은 보류 · <button class="link" onclick="closeModal()">나중에</button></div>
  </div>`);
  $('modal').classList.add('scene-mode', 'deck-mode');
  const card = $('dk-card');
  card.querySelectorAll('[data-o]').forEach(b => b.onclick = e => { e.stopPropagation(); deckSel = +b.dataset.o; openDeck(); });
  const decide = yes => {
    card.classList.add(yes ? 'fly-r' : 'fly-l');
    setTimeout(() => {
      if (yes) { const r = adoptSitPolicy(S, top.id, deckSel); if (r.ok) toast(r.msg, 3500); else { toast(esc(r.msg)); card.classList.remove('fly-r'); return; } }
      else { sitState(S).list = sitState(S).list.filter(x => x !== top); toast(`🗂️ '${top.title}' 보류`); SFX.play('click'); }
      deckSel = 0; saveGame(S); renderAll(); openDeck();
    }, 260);
  };
  $('dk-yes').onclick = () => decide(true); $('dk-no').onclick = () => decide(false);
  // 끌어서 넘기기
  let sx = null, dx = 0;
  card.addEventListener('pointerdown', e => { if (e.target.closest('[data-o]')) return; sx = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.style.transition = 'none'; });
  card.addEventListener('pointermove', e => { if (sx == null) return; dx = e.clientX - sx; card.style.transform = `translateX(${dx}px) rotate(${dx / 14}deg)`; card.style.setProperty('--yes', clamp(dx / 120, 0, 1)); card.style.setProperty('--no', clamp(-dx / 120, 0, 1)); });
  const up = () => { if (sx == null) return; sx = null; card.style.transition = ''; if (dx > 110 && !$('dk-yes').disabled) decide(true); else if (dx < -110) decide(false); else { card.style.transform = ''; card.style.setProperty('--yes', 0); card.style.setProperty('--no', 0); } };
  card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
}

/* ---------------- D 지도 핀 · 청와대 원형 메뉴 ---------------- */
const KR_PROV = () => (typeof MAP_DATA !== 'undefined' && MAP_DATA.prov?.kr) || [];
const hashN = (s, n) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % n; };
function provAt(id, avoid) {
  const P = KR_PROV().filter(p => p.c && !/서울|세종/.test(p.n) && !avoid.has(p.n)); if (!P.length) return null;
  const p = P[hashN(id, P.length)]; avoid.add(p.n); return p;
}
function pinsSvg() {
  if (!S || !KR_PROV().length) return '';
  const used = new Set(), out = [];
  const seoul = KR_PROV().find(p => /서울/.test(p.n)), sejong = KR_PROV().find(p => /세종/.test(p.n));
  const pin = (p, cls, icon, label, data) => unitG(p.c[0], p.c[1], `mpin ${cls}`, `<g class="mp-bob" ${data}><path d="M0 0 C-7 -8 -11 -13 -11 -19 A11 11 0 1 1 11 -19 C11 -13 7 -8 0 0Z"></path><text class="mp-ic" y="-15">${icon}</text>${label ? `<text class="mp-lb" y="10">${esc(label)}</text>` : ''}</g>`);
  if (seoul) out.push(pin(seoul, 'hq', '🏛️', '청와대', 'data-pin="hq"'));
  const sit = sitState(S).list.filter(p => p.exp >= S.turn).length;
  if (sit && seoul) out.push(pin({ c: [seoul.c[0] + 3.2, seoul.c[1] + 0.6] }, 'sit', '📥', `결재 ${sit}`, 'data-pin="deck"'));
  for (const c of S.crises || []) { const p = provAt(c.id, used); if (p) out.push(pin(p, 'crisis', EV_ART[c.tpl] || c.icon, c.kind, `data-pin="crisis" data-id="${c.id}"`)); }
  for (const ev of S.dom?.pending || []) { const def = DOM_EVENTS[ev.key]; const p = provAt(ev.id, used); if (p) out.push(pin(p, def?.extreme ? 'crisis' : 'dom', def?.icon || '📌', (ev.title || '').slice(0, 9), `data-pin="dom" data-id="${ev.id}"`)); }
  return out.join('');
}
function renderPins() {
  const svg = mapBuilt?.svg; if (!svg) return;
  let g = svg.querySelector('.g-pins');
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'g-pins'); svg.appendChild(g);
    g.addEventListener('click', e => {
      const t = e.target.closest('[data-pin]'); if (!t) return; e.stopPropagation(); SFX.play('click');
      const k = t.dataset.pin;
      if (k === 'hq') openRadial(t); else if (k === 'deck') openDeck();
      else if (k === 'crisis') openEventCard(t.dataset.id); else if (k === 'dom') openDomEventCard(t.dataset.id);
    });
  }
  g.innerHTML = pinsSvg();
}
const QUICK_ACTS = [
  { id: 'speech', icon: '📣', name: '연설', pc: 3, tip: '대국민 연설 (반응은 그날 분위기에 따라)', run: () => { const v = +(gauss() * 2 + 1.4 + (flowOf(S).mood || 0) * 0.04).toFixed(1); applyFx(S, { ap: v }); return [`대국민 연설 ${v >= 0 ? '호평' : '혹평'}`, { ap: v }]; } },
  { id: 'cash', icon: '💸', name: '지원금', pc: 15, tip: '민생 지원금 (지지·행복↑, 채무↑)', fx: { ap: 2, e: { happiness: 1, debt: 0.4, infl: 0.1 } } },
  { id: 'police', icon: '🚓', name: '치안', pc: 8, tip: '치안 강화 (치안↑, 자유 소폭↓)', fx: { e: { safety: 2, freedom: -0.5 } } },
  { id: 'house', icon: '🏠', name: '주택', pc: 12, tip: '공공주택 공급 (주거↑)', fx: { e: { housing: 1.5 }, mods: { housing: 0.3 } } },
  { id: 'school', icon: '🏫', name: '교육', pc: 10, tip: '교육 투자 (교육↑, 교육계↑)', fx: { e: { education: 1.5 }, f: { teach: 3 } } },
  { id: 'army', icon: '🎖️', name: '사열', pc: 6, tip: '국군 사열 (안보·군↑, 긴장↑)', fx: { e: { security: 1 }, f: { mil: 4 }, tension: 1 } },
  { id: 'factory', icon: '🏭', name: '공장', pc: 0, tip: '산업 시설 짓기 (경제 화면)', go: () => showTab('economy') },
  { id: 'deck', icon: '📥', name: '결재', pc: 0, tip: '시국 정책안 결재', go: () => openDeck() },
];
function closeRadial() { document.querySelector('.radial-menu')?.remove(); }
function openRadial(anchor) {
  closeRadial();
  const r = anchor.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const cd = S.quickCd || (S.quickCd = {});
  const el = document.createElement('div'); el.className = 'radial-menu';
  const R = Math.min(110, innerWidth / 3.6), n = QUICK_ACTS.length;
  const x0 = clamp(cx, R + 44, innerWidth - R - 44), y0 = clamp(cy, R + 60, innerHeight - R - 60);
  el.innerHTML = `<div class="rm-ring" style="left:${x0}px;top:${y0}px;width:${R * 2}px;height:${R * 2}px"></div><button class="rm-center" style="left:${x0}px;top:${y0}px" title="닫기">🏛️</button>` + QUICK_ACTS.map((a, i) => {
    const ang = -Math.PI / 2 + i * 2 * Math.PI / n, used = cd[a.id] === S.turn, poor = a.pc && S.pcap < a.pc;
    return `<button class="rm-b" data-q="${a.id}" style="left:${x0 + Math.cos(ang) * R}px;top:${y0 + Math.sin(ang) * R}px;animation-delay:${i * 35}ms" ${used || poor ? 'disabled' : ''} title="${esc(a.tip)}"><span>${a.icon}</span>${a.name}${a.pc ? `<small>${won(a.pc)}</small>` : ''}${used ? '<small>완료</small>' : ''}</button>`;
  }).join('') + `<div class="rm-tip" style="left:${x0}px;top:${y0 + R + 54}px">이번 분기 한 번씩 · 길게 보면 설명</div>`;
  document.body.appendChild(el); SFX.play('open');
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) { closeRadial(); return; }
    const a = QUICK_ACTS.find(x => x.id === b.dataset.q); closeRadial();
    if (a.go) return a.go();
    if (S.pcap < a.pc) return toast(`국고 ${won(a.pc)}이 필요합니다.`);
    S.pcap -= a.pc; cd[a.id] = S.turn;
    let label = a.tip.split(' (')[0], fx = a.fx;
    if (a.run) [label, fx] = a.run(); else applyFx(S, fx);
    addLog(S, 'good', `${a.icon} ${label}`);
    stampFx(a.name, label.slice(0, 10), 'blue');
    floatChips(fxChips(fx || {}, 4), lastPointer);
    saveGame(S); renderAll();
  });
}
function floatChips(html, at) {
  if (!html) return; const d = document.createElement('div'); d.className = 'chip-float ochips'; d.innerHTML = html;
  d.style.left = at.x + 'px'; d.style.top = at.y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 1800);
}

{
  if (typeof updateMap === 'function') { const _um = updateMap; updateMap = function (...a) { const r = _um.apply(this, a); try { renderPins(); } catch (e) { console.error(e); } return r; }; }
  const _ra = renderAll; renderAll = function () { _ra(); try { renderPins(); } catch (e) { console.error(e); } };
}
