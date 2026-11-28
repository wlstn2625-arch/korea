/* =========================================================
 *  배경음악(BGM) — 상황에 따라 자동으로 곡을 바꾸고 부드럽게 넘김
 *  타이틀 · 평소 국정 · 전쟁 · 엔딩(승리/희망) · 몰락
 *  🎵 버튼으로 음악만 끄기 (효과음 🔊은 따로)
 * ========================================================= */
const BGM = (() => {
  const TRACKS = { title: 'bgm_title', game: 'bgm_game', war: 'bgm_war', crisis: 'bgm_crisis', victory: 'bgm_victory', somber: 'bgm_somber', hope: 'bgm_hope' };
  let on = true, cur = null, want = null, el = null, duck = 1, unlocked = false;
  try { on = localStorage.getItem('dg_music') !== 'off'; } catch {}
  const usable = () => location.protocol !== 'file:' && (typeof mediaOn !== 'function' || mediaOn());
  const VOL = 0.38;
  function fade(a, to, ms, done) {
    const from = a.volume, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); else done && done(); };
    requestAnimationFrame(step);
  }
  function play(name) {
    want = name;
    if (!on || !unlocked || !usable() || !TRACKS[name]) return;
    if (cur === name && el && !el.paused) return;
    const old = el; cur = name;
    const a = new Audio(`media/audio/${TRACKS[name]}.mp3`); a.loop = true; a.volume = 0; a.preload = 'auto';
    a.play().then(() => fade(a, VOL * duck, 1800)).catch(() => {});
    el = a;
    if (old) fade(old, 0, 1500, () => { old.pause(); old.src = ''; });
  }
  function stop(ms = 1200) { const old = el; el = null; cur = null; if (old) fade(old, 0, ms, () => { old.pause(); old.src = ''; }); }
  function setDuck(k) { duck = k; if (el) fade(el, VOL * duck, 500); }
  function toggle() { on = !on; try { localStorage.setItem('dg_music', on ? 'on' : 'off'); } catch {} if (on) { const w = want; cur = null; play(w || 'title'); } else stop(600); return on; }
  // 브라우저는 사용자가 한 번 누른 뒤에야 소리를 허용함
  addEventListener('pointerdown', () => { if (unlocked) return; unlocked = true; play(want || 'title'); }, { capture: true });
  return { play, stop, setDuck, toggle, get on() { return on; }, get cur() { return cur; } };
})();

/* ---------------- 상황에 맞게 곡 고르기 ---------------- */
function bgmAuto() {
  if (!S || $('game')?.classList.contains('hidden')) return BGM.play('title');
  if (S.over) return BGM.play('somber');
  if (S.war) return BGM.play('war');
  BGM.play('game');
}
{
  const _ra = renderAll; renderAll = function () { _ra(); try { if (!document.querySelector('.trailer')) bgmAuto(); } catch {} };
  if (typeof restart === 'function') { const _r = restart; restart = function (...a) { const r = _r.apply(this, a); BGM.play('title'); return r; }; }
}
// 엔딩 트레일러 동안은 음악을 멈추고(트레일러 자체 사운드), 엔딩 카드에서 승리곡
if (typeof playEndingCinema === 'function') {
  const _pec = playEndingCinema;
  playEndingCinema = function (id, then) { BGM.stop(800); return _pec(id, () => { BGM.play(id === 'utopia' ? 'hope' : 'victory'); then && then(); }); };
}
if (typeof showEnding === 'function') { const _se2 = showEnding; showEnding = function (...a) { const r = _se2.apply(this, a); BGM.play('somber'); return r; }; }
// 짧은 컷신(효과음 있는 영상) 동안 음악 줄이기
if (typeof playClip === 'function') {
  const _pc = playClip;
  playClip = async function (id, o = {}) { BGM.setDuck(0.25); try { return await _pc(id, o); } finally { BGM.setDuck(1); } };
}

/* ---------------- 🎵 버튼 ---------------- */
(function () {
  const hr = document.querySelector('.hud-right'); if (!hr || $('btn-music')) return;
  const b = document.createElement('button'); b.id = 'btn-music'; b.className = 'btn ghost'; b.title = '배경음악';
  const set = () => { b.textContent = BGM.on ? '🎵' : '🔕'; b.style.opacity = BGM.on ? 1 : .6; };
  set(); b.onclick = () => { BGM.toggle(); set(); };
  hr.insertBefore(b, $('btn-sound') || $('btn-settings'));
  // 타이틀 화면에도 작은 음악 버튼
  const st = document.querySelector('#start .ts-bar.top');
  if (st) { const t = document.createElement('button'); t.className = 'ts-music'; const s2 = () => { t.textContent = BGM.on ? '🎵 음악 켜짐' : '🔕 음악 꺼짐'; }; s2(); t.onclick = e => { e.stopPropagation(); BGM.toggle(); s2(); set(); }; st.appendChild(t); }
})();
