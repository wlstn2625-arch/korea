/* =========================================================
 *  실사 영상·사진 (AI 생성, media/ 폴더)
 *  - 있으면 쓰고, 없으면(오프라인 단일 파일 등) 조용히 기존 연출로
 *  - 앱 오픈 스플래시 · 로그인 배경 · 분기 결산 대기 화면
 *  - 대화 장면 배경·인물 사진 · 결재 카드 인물 · 정책 분야 사진
 *  - 짧은 컷신: 취임 · 선전포고 · 핵 · 대선 · 몰락
 * ========================================================= */
const MEDIA = 'media/';
const CLIPS = new Set(['conq_flag', 'conq_tanks', 'conq_hill', 'conq_earth', 'heg_hall', 'heg_seoul', 'heg_fleet', 'uto_river', 'uto_kids', 'uto_baby',
  'tec_fab', 'tec_ignite', 'tec_space', 'leg_1960', 'leg_lapse', 'leg_window', 'r_title', 'r_inaug', 'r_war', 'r_nuke', 'r_elect', 'r_protest', 'r_fall', 'r_splash', 'r_loading']);
const mediaOn = () => { try { return localStorage.getItem('dg_video') !== 'off'; } catch { return true; } } ;
const mediaUsable = () => location.protocol !== 'file:' && mediaOn();
const imgUrl = id => `${MEDIA}img/${id}.jpg`;
const clipOK = {};
function clipLoad(id, ms = 2500) {
  if (!CLIPS.has(id) || clipOK[id] === false || !mediaUsable()) return Promise.resolve(null);
  return new Promise(res => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    let done = false; const fin = ok => { if (done) return; done = true; if (ok || clipOK[id] == null) clipOK[id] = ok ? true : clipOK[id]; res(ok ? v : null); };
    v.addEventListener('canplay', () => fin(true), { once: true });
    v.addEventListener('error', () => { clipOK[id] = false; fin(false); }, { once: true });
    setTimeout(() => fin(false), ms);
    v.src = `${MEDIA}${id}.mp4`; v.load();
  });
}
// 사진이 실제로 있는지(한 번만 확인)
const imgOK = {};
function imgCheck(id) {
  if (!mediaUsable()) return Promise.resolve(false);
  if (imgOK[id] != null) return Promise.resolve(imgOK[id]);
  return new Promise(r => { const i = new Image(); i.onload = () => r(imgOK[id] = true); i.onerror = () => r(imgOK[id] = false); i.src = imgUrl(id); });
}

/* ---------------- 짧은 컷신 ---------------- */
async function playClip(id, { title = '', sub = '', dur = 4200, kind = 'gold', from = 0.2 } = {}) {
  const v = await clipLoad(id); if (!v) return false;
  return new Promise(resolve => {
    const el = document.createElement('div'); el.className = `clipfx ${kind}`;
    el.innerHTML = `<div class="cf-vid"></div><div class="cf-grain"></div><div class="cf-bar top"></div><div class="cf-bar bot"></div>
      ${title ? `<div class="cf-title"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>` : ''}<button class="cf-skip">건너뛰기 ▶▶</button>`;
    el.querySelector('.cf-vid').appendChild(v);
    document.body.appendChild(el);
    try { v.currentTime = from; } catch {}
    v.play().catch(() => {});
    if (typeof SFX !== 'undefined' && title) setTimeout(() => SFX.play('stamp'), 900);
    let closed = false;
    const close = () => { if (closed) return; closed = true; el.classList.add('out'); setTimeout(() => { el.remove(); resolve(true); }, 600); };
    el.addEventListener('click', close); setTimeout(close, dur);
  });
}

/* ---------------- 앱 오픈 스플래시 ---------------- */
(async function splash() {
  if (!mediaUsable()) return;
  try { if (sessionStorage.getItem('dg_splash')) return; sessionStorage.setItem('dg_splash', '1'); } catch {}
  const el = document.createElement('div'); el.className = 'splash';
  el.innerHTML = `<div class="sp-bg" style="background-image:url(${imgUrl('bg_seoul_night')})"></div><div class="sp-vid"></div><div class="sp-vig"></div>
    <div class="sp-logo"><img src="icons/icon-192.png" alt=""><b>대권</b><small>THE SUPREME POWER</small></div><div class="sp-tap">화면을 누르면 시작</div>`;
  document.body.appendChild(el);
  const close = () => { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 900); };
  el.addEventListener('click', close);
  const v = await clipLoad('r_splash', 3000);
  if (v) { el.querySelector('.sp-vid').appendChild(v); v.play().catch(() => {}); }
  setTimeout(close, v ? 6200 : 2600);
})();

/* ---------------- 로그인(타이틀) 배경 ---------------- */
(async function titleBg() {
  const bg = document.querySelector('#start .ts-bg'); if (!bg) return;
  if (await imgCheck('bg_login')) { const p = document.createElement('div'); p.className = 'ts-photo'; p.style.backgroundImage = `url(${imgUrl('bg_login')})`; bg.insertBefore(p, bg.firstChild); }
  const v = await clipLoad('r_title', 6000); if (!v) return;
  v.loop = true; v.className = 'ts-video'; bg.insertBefore(v, bg.children[1] || null); v.play().catch(() => {});
})();

/* ---------------- 분기 결산 대기 화면 ---------------- */
const LOAD_TIPS = ['국고가 남으면 공장을 지으세요. 산업 수익이 매 분기 들어옵니다.', '지도 위 🏛️ 청와대 핀을 누르면 연설·지원금 같은 즉석 행동을 할 수 있어요.',
  '같은 정책도 그때 민심과 세계 경기에 따라 대성공이 되기도, 역풍이 되기도 합니다.', '정책 카드는 위로 끌어 올리면 국회에 냅니다.', '세계 패권 엔딩: 국력 1위를 2년 연속 지키세요.',
  '분쟁 중재에 성공하면 위협도가 내려가고 지지율이 오릅니다.', '핵무장은 강력하지만 강대국 관계가 폭락합니다.', '미국 대선 결과에 따라 동맹 분위기가 확 바뀝니다.'];
if (typeof afterQuarter === 'function') {
  const _aq2 = afterQuarter;
  afterQuarter = function (...a) {
    if (!mediaUsable() || S?.over) return _aq2.apply(this, a);
    const el = document.createElement('div'); el.className = 'qload';
    const pic = ['bg_loading1', 'bg_loading2', 'bg_loading3', 'bg_warroom', 'bg_seoul_night'][Math.floor(Math.random() * 5)];
    const t = turnLabel(S.turn);
    el.innerHTML = `<div class="ql-bg" style="background-image:url(${imgUrl(pic)})"></div><div class="ql-vid"></div><div class="ql-shade"></div>
      <div class="ql-box"><small>QUARTER REPORT</small><b>${t.year}년 ${t.q}분기</b><div class="ql-bar"><i></i></div><p>💡 ${esc(LOAD_TIPS[Math.floor(Math.random() * LOAD_TIPS.length)])}</p></div>`;
    document.body.appendChild(el);
    clipLoad('r_loading', 700).then(v => { if (v && el.isConnected) { v.loop = true; el.querySelector('.ql-vid').appendChild(v); v.play().catch(() => {}); } });
    let done = false; const go = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => el.remove(), 500); _aq2.apply(this, a); };
    el.addEventListener('click', go); setTimeout(go, 1500);
  };
}

/* ---------------- 대화 장면: 배경 사진·영상, 인물 사진 ---------------- */
const SCENE_BG = { politics: 'bg_assembly', society: 'bg_briefing', social: 'bg_briefing', disaster: 'bg_disaster', security: 'bg_warroom', extreme: 'bg_warroom',
  economy: 'bg_market', market: 'bg_market', fiscal: 'bg_market', inflation: 'bg_market', tech: 'bg_factory', brain: 'bg_factory', good: 'bg_office',
  diplo: 'bg_summit', diplomacy: 'bg_summit', legal: 'bg_briefing', protest: 'bg_briefing', housing: 'bg_seoul_night' };
const SCENE_CLIP = { protest: 'r_protest', social: 'r_protest', extreme: 'r_war', security: 'r_war' };
const portraitOf = cat => `pt_${cat}`;
if (typeof openScene === 'function') {
  const _os = openScene;
  openScene = function (o) {
    _os(o);
    if (!mediaUsable()) return;
    const sc = document.querySelector('#modal-body .scene'); if (!sc) return;
    const key = o.key || 'politics', cat = (typeof SC_CAST !== 'undefined' && SC_CAST[key]?.[0]) || 'const';
    const bg = SCENE_BG[key] || (S.turn % 2 ? 'bg_office_night' : 'bg_office');
    imgCheck(bg).then(ok => { if (!ok || !sc.isConnected) return; const p = document.createElement('div'); p.className = 'sc-photo'; p.style.backgroundImage = `url(${imgUrl(bg)})`; sc.insertBefore(p, sc.firstChild); sc.classList.add('photo'); });
    if (SCENE_CLIP[key]) clipLoad(SCENE_CLIP[key]).then(v => { if (!v || !sc.isConnected) return; v.loop = true; v.className = 'sc-bgvid'; sc.insertBefore(v, sc.querySelector('.sc-head')); v.play().catch(() => {}); sc.classList.add('photo'); });
    imgCheck(portraitOf(cat)).then(ok => { const ch = sc.querySelector('.sc-char:not(.side)'); if (!ok || !ch) return; ch.innerHTML = `<img src="${imgUrl(portraitOf(cat))}" alt="">`; ch.classList.add('portrait'); });
  };
}
// 결재 카드 인물
if (typeof openDeck === 'function') {
  const _od = openDeck;
  openDeck = function (...a) {
    _od.apply(this, a);
    if (!mediaUsable()) return;
    const list = sitState(S).list.filter(p => p.exp >= S.turn), top = list[0]; if (!top) return;
    const cat = (typeof CAT2MIN !== 'undefined' && CAT2MIN[top.cat]) || 'const';
    imgCheck(portraitOf(cat)).then(ok => { const w = document.querySelector('#modal-body .dk-who'); if (!ok || !w) return; w.style.backgroundImage = `url(${imgUrl(portraitOf(cat))})`; w.classList.add('photo'); });
  };
}
// 정책 분야 배너 사진
const CAT_PHOTO = { const: 'bg_assembly', tax: 'bg_market', econ: 'bg_factory', labor: 'bg_factory', welfare: 'bg_office', house: 'bg_seoul_night', edu: 'bg_office',
  defense: 'bg_dmz', diplo: 'bg_summit', justice: 'bg_briefing', civil: 'bg_seoul_night', env: 'bg_farm', health: 'bg_disaster' };
if (typeof renderPolicies === 'function') {
  const _rp3 = renderPolicies;
  renderPolicies = function () {
    _rp3();
    const b = document.querySelector('#cat-banner-slot .cat-banner'), id = CAT_PHOTO[activeCat]; if (!b || !id) return;
    imgCheck(id).then(ok => { if (ok && b.isConnected && !b.querySelector('.cb-photo')) { const p = document.createElement('div'); p.className = 'cb-photo'; p.style.backgroundImage = `url(${imgUrl(id)})`; b.insertBefore(p, b.firstChild); b.classList.add('photo'); } });
  };
}

/* ---------------- 짧은 컷신 연결 ---------------- */
{
  const btn = $('btn-start'), orig = btn.onclick;
  btn.onclick = function (e) { orig.call(this, e); if (S) playClip('r_inaug', { title: `제${S.presidentNo || 21}대 대통령 취임`, sub: `${S.name} 대통령`, dur: 4800 }); };
}
if (typeof diploAction === 'function') {
  const _da = diploAction;
  diploAction = function (s, aid, k, ...rest) { const r = _da(s, aid, k, ...rest); if (aid === 'war' && r?.ok !== false && s === S && S.war) playClip('r_war', { title: '선전포고', sub: `대한민국 대 ${cname(k)}`, kind: 'red', dur: 4200 }); return r; };
}
if (typeof playerNuke === 'function') {
  const _pn = playerNuke;
  playerNuke = function (s, pid) { const r = _pn(s, pid); if (r?.ok && s === S) playClip('r_nuke', { title: '핵 공격', sub: '돌이킬 수 없는 선택', kind: 'red', dur: 3800, from: 0.6 }); return r; };
}
if (typeof openNukeCard === 'function') {
  const _onc = openNukeCard;
  openNukeCard = function (...a) { const r = _onc.apply(this, a); playClip('r_nuke', { title: '핵 피격', sub: '대한민국이 핵 공격을 받았습니다', kind: 'red', dur: 3800, from: 0.6 }); return r; };
}
if (typeof openPresidentialCard === 'function') {
  const _opc = openPresidentialCard;
  openPresidentialCard = function (...a) {
    const r0 = S?.pendingSuccession; const res = _opc.apply(this, a);
    if (r0) { if (r0.won) playClip('r_elect', { title: '정권 재창출', sub: `${r0.rulingCandidate} 당선`, dur: 4200 });
      else playClip('r_fall', { title: r0.reason === 'impeach' ? '파면' : '정권 교체', sub: r0.reason === 'impeach' ? '헌법재판소, 대통령 파면 선고' : `${r0.oppCandidate} 당선`, kind: 'gray', dur: 4400 }); }
    return res;
  };
}
if (typeof showEnding === 'function') {
  const _se = showEnding;
  showEnding = function (...a) { const r = _se.apply(this, a); playClip('r_fall', { title: S?.ending?.title || '몰락', kind: 'gray', dur: 4600 }); return r; };
}

/* ---------------- 카드 그림: 무기·경제 기술, 산업, 정책 ---------------- */
const photoDiv = (cls, id) => `<div class="${cls}" style="background-image:url(${imgUrl(id)})"></div>`;
function decorateCards(root = document) {
  if (!mediaUsable()) return;
  root.querySelectorAll('.tnode[data-tid]:not(.ph)').forEach(n => { n.classList.add('ph'); n.insertAdjacentHTML('afterbegin', photoDiv('tn-img', 'tc_' + n.dataset.tid)); });
  root.querySelectorAll('.fac:not(.ph)').forEach(n => { const b = n.querySelector('[data-build]'); if (!b) return; n.classList.add('ph'); n.insertAdjacentHTML('afterbegin', photoDiv('fac-img', 'sc_' + b.dataset.build)); });
  root.querySelectorAll('.pol-card[data-pc]:not(.ph)').forEach(n => { n.classList.add('ph'); n.insertAdjacentHTML('afterbegin', photoDiv('pc-photo', 'pl_' + n.dataset.pc)); });
}
for (const fn of ['renderDefense', 'renderEconomy', 'renderPolicies']) {
  if (typeof window[fn] !== 'function') continue;
  const f = window[fn]; window[fn] = function (...a) { const r = f.apply(this, a); try { decorateCards(); } catch {} return r; };
}
if (typeof openPolicyHand === 'function') {
  const _oph = openPolicyHand;
  openPolicyHand = function (pid) { _oph(pid); if (!mediaUsable()) return; document.querySelectorAll('#modal-body .hc').forEach(c => { if (!c.classList.contains('cur')) c.insertAdjacentHTML('afterbegin', photoDiv('hc-photo', 'pl_' + pid)); }); const a = document.querySelector('#modal-body .hand-scene'); if (a) a.insertAdjacentHTML('afterbegin', photoDiv('hs-photo', 'pl_' + pid)); };
}
