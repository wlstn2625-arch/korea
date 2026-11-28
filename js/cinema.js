/* =========================================================
 *  엔딩 트레일러: 영화 예고편식 모션 그래픽
 *  - 2.39:1 화면, 필름 그레인·비네팅·색보정·렌즈 플레어·불씨·먼지 입자
 *  - 컷마다 베이스 히트, 드론음, 휘익 전환음 (Web Audio로 합성)
 *  - 그 판의 실제 기록(점령국·대통령·지지율·지표)으로 장면을 만듦
 *  - 녹화용: 쓰인 소리 신호를 기록해 두었다가 OfflineAudioContext로 WAV를 뽑을 수 있음
 * ========================================================= */
const TR = { skip: false, cues: [], t0: 0, ac: null, base: 0, out: null, fx: null, root: null, parts: [], shake: 0 };
const trT = () => (performance.now() - TR.t0) / 1000;
const trSleep = ms => new Promise(r => { if (TR.skip) return r(); const t = setTimeout(r, ms); TR._w = () => { clearTimeout(t); r(); }; });
const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

/* ---------------- 소리 ---------------- */
function trSound(ctx, dest) {
  const noiseBuf = (() => { const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return n; })();
  const echo = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(); echo.delayTime.value = 0.32; fb.gain.value = 0.38; wet.gain.value = 0.35;
  echo.connect(fb).connect(echo); echo.connect(wet).connect(dest);
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const noise = (t, dur, type, f0, f1, peak, send = true) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = type; f.Q.value = type === 'bandpass' ? 1.2 : 0.7;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); s.connect(f).connect(g).connect(dest); if (send) g.connect(echo);
    return { s, g, go: (a, d) => { env(g, t, a, peak, d); s.start(t); s.stop(t + a + d + 0.05); } };
  };
  const tone = (t, type, f0, f1, a, d, peak, send = true) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d); o.connect(g).connect(dest); if (send) g.connect(echo); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + 0.05); };
  return {
    hit(t) { tone(t, 'sine', 62, 28, 0.005, 1.4, 0.9); tone(t, 'triangle', 110, 40, 0.005, 0.5, 0.25); noise(t, 0.5, 'lowpass', 1400, 120, 0.5).go(0.003, 0.45); },
    boom(t) { this.hit(t); tone(t, 'sine', 45, 22, 0.01, 3.2, 1); noise(t, 2.4, 'lowpass', 3000, 80, 0.45).go(0.01, 2.3); [110, 165, 220, 261.6, 329.6].forEach((f, i) => tone(t + 0.02, 'sawtooth', f, 0, 0.25, 3.6, 0.045 - i * 0.004)); },
    whoosh(t, dur = 0.9) { noise(t, dur, 'bandpass', 250, 3200, 0.35, false).go(dur * 0.75, dur * 0.25); },
    riser(t, dur = 2.5) { noise(t, dur, 'bandpass', 300, 5000, 0.22, false).go(dur * 0.95, 0.08); tone(t, 'sawtooth', 110, 440, dur * 0.95, 0.08, 0.05, false); },
    tick(t) { tone(t, 'square', 2200, 0, 0.002, 0.05, 0.08, false); tone(t, 'sine', 90, 50, 0.002, 0.18, 0.4, false); },
    drone(t, dur) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(220, t); f.frequency.linearRampToValueAtTime(900, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 2); g.gain.setValueAtTime(0.11, t + dur - 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      f.connect(g).connect(dest); [55, 55.6, 82.4, 110.3].forEach(fr => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + dur + 0.1); });
      const sh = ctx.createOscillator(), sg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); sh.type = 'sine'; sh.frequency.value = 880; lfo.frequency.value = 5.5; lg.gain.value = 0.012;
      lfo.connect(lg).connect(sg.gain); sg.gain.value = 0.018; sh.connect(sg).connect(dest); sg.connect(echo); sh.start(t + 3); lfo.start(t + 3); sh.stop(t + dur); lfo.stop(t + dur);
    },
  };
}
function trCue(type, arg) {
  if (TR.skip && type !== 'boom') return;
  const t = trT(); TR.cues.push({ t, type, arg });
  try { if (TR.ac && TR.snd) TR.snd[type](TR.base + t + 0.02, arg); } catch {}
}
// 녹화용: 기록된 소리를 WAV(base64)로
async function trRenderAudio(dur) {
  const sr = 44100, ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
  const snd = trSound(ctx, comp);
  for (const c of TR.cues) try { snd[c.type](c.t + 0.02, c.arg); } catch {}
  const buf = await ctx.startRendering();
  const len = buf.length, out = new DataView(new ArrayBuffer(44 + len * 4)); const w = (o, s) => [...s].forEach((ch, i) => out.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + len * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1); for (let i = 0; i < len; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  let bin = ''; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(bin);
}

/* ---------------- 화면 효과(그레인·입자) ---------------- */
function trFxLoop() {
  const cv = TR.fx; if (!cv || !cv.isConnected) return;
  const g = cv.getContext('2d'), W = cv.width = cv.clientWidth, H = cv.height = cv.clientHeight;
  // 입자
  for (const p of TR.parts) { p.x += p.vx; p.y += p.vy; p.life -= 1; p.vy += p.g || 0; }
  TR.parts = TR.parts.filter(p => p.life > 0 && p.y > -40 && p.y < H + 40);
  g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
  for (const p of TR.parts) { const a = Math.min(1, p.life / 40) * p.a; const r = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); r.addColorStop(0, `hsla(${p.h},100%,${p.l}%,${a})`); r.addColorStop(1, `hsla(${p.h},100%,${p.l}%,0)`); g.fillStyle = r; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  // 상시 입자
  const mode = TR.ambient || 'dust';
  if (mode === 'embers' && Math.random() < 0.7) TR.parts.push({ x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 0.8, vy: -1 - Math.random() * 1.8, r: 2 + Math.random() * 4, h: 28 + Math.random() * 15, l: 60, a: 0.9, life: 200 + Math.random() * 120 });
  if (mode === 'dust' && Math.random() < 0.35) TR.parts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.3, vy: -0.1 - Math.random() * 0.2, r: 1 + Math.random() * 2.5, h: 40, l: 85, a: 0.35, life: 160 });
  // 필름 그레인
  if (!TR.noise) { TR.noise = document.createElement('canvas'); TR.noise.width = TR.noise.height = 160; const n = TR.noise.getContext('2d'), id = n.createImageData(160, 160); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } n.putImageData(id, 0, 0); }
  g.globalAlpha = 0.07; const ox = Math.random() * 160, oy = Math.random() * 160;
  for (let x = -ox; x < W; x += 160) for (let y = -oy; y < H; y += 160) g.drawImage(TR.noise, x, y);
  g.globalAlpha = 1;
  // 카메라 흔들림
  if (TR.root) { TR.shake *= 0.9; const s = TR.shake; TR.root.querySelector('.tr-cam').style.transform = s > 0.2 ? `translate(${(Math.random() - 0.5) * s}px,${(Math.random() - 0.5) * s}px)` : ''; }
  requestAnimationFrame(trFxLoop);
}
function trSparks(n = 60, x, y) {
  const cv = TR.fx; if (!cv) return; const W = cv.clientWidth, H = cv.clientHeight; x = x ?? W / 2; y = y ?? H / 2;
  for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = 2 + Math.random() * 7; TR.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.06, r: 2 + Math.random() * 3, h: 30 + Math.random() * 20, l: 65, a: 1, life: 50 + Math.random() * 50 }); }
}
function trHit(big) { trCue(big ? 'boom' : 'hit'); TR.shake = big ? 26 : 14; const f = TR.root.querySelector('.tr-flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

/* ---------------- 장면 부품 ---------------- */
function trShot(html, cls = '') { const cam = TR.root.querySelector('.tr-cam'); cam.querySelector('.tr-shot')?.classList.add('gone'); setTimeout(() => cam.querySelectorAll('.tr-shot.gone').forEach(x => x.remove()), 700); const d = document.createElement('div'); d.className = 'tr-shot ' + cls; d.innerHTML = html; cam.appendChild(d); return d; }
async function shotCard(lines, { dur = 2200, hit = false, big = false, small = '' } = {}) {
  if (TR.skip) return;
  trCue('whoosh', 0.7);
  const d = trShot(`<div class="tr-card ${big ? 'big' : ''}">${small ? `<small>${esc(small)}</small>` : ''}${lines.map((l, i) => `<div style="animation-delay:${0.15 + i * 0.45}s">${esc(l)}</div>`).join('')}</div>`, 'black');
  if (hit) setTimeout(() => !TR.skip && trHit(), 150);
  await trSleep(dur); d.classList.add('fadeout'); await trSleep(350);
}
function mapClone() {
  const src = typeof mapBuilt !== 'undefined' && mapBuilt?.svg; if (!src) return null;
  const svg = src.cloneNode(true); svg.removeAttribute('id'); svg.setAttribute('class', 'tr-map');
  svg.querySelectorAll('.g-pins, .g-war, .g-front, .g-lbl, .g-city, .eu-mark, .g-prov, .mpin').forEach(x => x.remove());
  svg.querySelectorAll('.land').forEach(l => { l.removeAttribute('style'); });
  const ns = 'http://www.w3.org/2000/svg', fx = document.createElementNS(ns, 'g'); fx.setAttribute('class', 'tr-mfx'); svg.appendChild(fx);
  return svg;
}
const MPOS = k => k === 'kr' ? (MAP_DATA.cities?.['서울'] || MAP_DATA.countries.kr.c) : MAP_DATA.countries?.[k]?.c;
function animViewBox(svg, from, to, dur) {
  const t0 = performance.now();
  return new Promise(res => { const step = now => { const k = Math.min(1, (now - t0) / dur), e = ease(k); svg.setAttribute('viewBox', from.map((v, i) => (v + (to[i] - v) * e).toFixed(2)).join(' ')); if (k < 1 && !TR.skip && svg.isConnected) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
}
function mapPulse(svg, k, cls = '') {
  const p = MPOS(k); if (!p) return; const ns = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < 3; i++) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 2); c.setAttribute('class', 'tr-pulse ' + cls); c.style.animationDelay = i * 0.5 + 's'; svg.querySelector('.tr-mfx').appendChild(c); }
}
function mapArc(svg, from, to, cls = '') {
  const a = MPOS(from), b = MPOS(to); if (!a || !b) return; const ns = 'http://www.w3.org/2000/svg';
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.35;
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', `M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`); p.setAttribute('class', 'tr-arc ' + cls);
  svg.querySelector('.tr-mfx').appendChild(p); const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; requestAnimationFrame(() => { p.style.strokeDashoffset = 0; });
  setTimeout(() => mapPulse(svg, to, 'hot'), 900);
}
function colorLand(svg, ks, cls) { const set = new Set(ks); svg.querySelectorAll('.land[data-c]').forEach(l => { if (set.has(l.dataset.c)) l.classList.add(cls); }); }
async function shotNumber(to, label, { from = 0, dur = 2200, dec = 0, suffix = '' } = {}) {
  if (TR.skip) return;
  const d = trShot(`<div class="tr-num"><b>0</b><small>${esc(label)}</small></div>`, 'black'); const b = d.querySelector('b'); trCue('riser', dur / 1000);
  const t0 = performance.now(); let last = -1;
  await new Promise(res => { const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e; b.textContent = v.toFixed(dec) + suffix; const q = Math.floor(k * 14); if (q !== last) { last = q; if (k < 1) trCue('tick'); } if (k < 1 && !TR.skip) requestAnimationFrame(step); else { b.textContent = to.toFixed(dec) + suffix; res(); } }; requestAnimationFrame(step); });
  trHit(); d.classList.add('lock'); await trSleep(1300); d.classList.add('fadeout'); await trSleep(300);
}
async function shotTitle(v) {
  TR.ambient = 'embers'; trCue('riser', 1.6); await trSleep(1500);
  const d = trShot(`<div class="tr-flare"></div><div class="tr-title"><small>${esc(v.name)} 엔딩</small><b data-t="${esc(v.title)}">${esc(v.title)}</b><span>${esc(S.name)} 대통령 · ${turnLabel(S.turn).year}년</span></div>`, 'black title');
  trHit(true); trSparks(140);
  await trSleep(TR.skip ? 900 : 4600);
}

// 실사 영상 컷 (없으면 false → 각본이 코드 장면으로 대신함)
async function shotVideo(id, { dur = 3600, cap = '', hit = false, from = 0.3, zoom = true, look = '' } = {}) {
  if (TR.skip || typeof clipLoad !== 'function') return false;
  const v = await clipLoad(id, 2500); if (!v || TR.skip) return false;
  trCue('whoosh', 0.6);
  const d = trShot(`<div class="tr-vwrap ${zoom ? 'zoom' : ''} ${look}"></div>${cap ? `<div class="tr-vcap">${esc(cap)}</div>` : ''}`, 'video');
  d.querySelector('.tr-vwrap').appendChild(v); v.className = 'tr-video';
  try { v.currentTime = from; } catch {}
  if (typeof clipSound === 'function' && !window.CINE_REC) clipSound(v, 0.7); else v.play().catch(() => {});
  if (hit) setTimeout(() => !TR.skip && trHit(), 250);
  await trSleep(dur); return true;
}
const TRAILER_CLIPS = { conquest: ['conq_flag', 'conq_tanks', 'conq_hill', 'conq_earth'], hegemon: ['heg_fleet', 'heg_seoul', 'heg_hall'], utopia: ['uto_river', 'uto_baby', 'uto_kids'], tech: ['tec_fab', 'tec_ignite', 'tec_space'], legacy: ['leg_1960', 'leg_lapse', 'leg_window'] };

/* ---------------- 엔딩별 각본 ---------------- */
const TRAILERS = {
  async conquest() {
    const svg = mapClone();
    await shotCard([`${START_YEAR}년.`], { small: '대한민국', dur: 1900 });
    await shotVideo('conq_flag', { dur: 3800 });
    if (svg) {
      const d = trShot('', 'map'); d.appendChild(svg); colorLand(svg, ['kr'], 'mine'); svg.setAttribute('viewBox', '850 255 60 40'); mapPulse(svg, 'kr', 'gold');
      TR.ambient = 'dust'; await animViewBox(svg, [850, 255, 60, 40], [820, 235, 120, 80], 2600);
    }
    await shotCard(['작은 나라였다.'], { hit: true, dur: 1700 });
    await shotVideo('conq_tanks', { dur: 3600, hit: true });
    if (svg) {
      const d = trShot('', 'map'); d.appendChild(svg);
      const keys = [...new Set([...svg.querySelectorAll('.land[data-c]')].map(l => l.dataset.c))].filter(k => k !== 'kr').sort((a, b) => (cinfo(a)?.km ?? 9e9) - (cinfo(b)?.km ?? 9e9));
      const big = ['jp', 'cn', 'ru', 'ind', 'us', 'deu', 'bra', 'gbr', 'aus', 'sau'].filter(k => MPOS(k));
      TR.ambient = 'embers'; const t0 = performance.now(), dur = 6200; let ai = 0;
      const vb = animViewBox(svg, [820, 235, 120, 80], [0, 0, 2000, 1040], dur);
      await new Promise(res => { const step = now => { const k = Math.min(1, (now - t0) / dur), n = Math.floor(keys.length * Math.min(1, k * 1.1)); colorLand(svg, keys.slice(0, n), 'mine');
        if (ai < big.length && k > ai / big.length * 0.85) { mapArc(svg, 'kr', big[ai]); if (ai % 3 === 0) trHit(); else trCue('whoosh', 0.5); ai++; }
        if (k < 1 && !TR.skip) requestAnimationFrame(step); else { colorLand(svg, keys, 'mine'); res(); } }; requestAnimationFrame(step); });
      await vb;
    }
    await shotVideo('conq_hill', { dur: 3800, hit: true });
    await shotNumber(worldOwned(S) || 195, '개국을 손에 넣다', { from: 1, dur: 2000 });
    await shotCard(['그리고 세계는', '하나의 깃발 아래 섰다.'], { dur: 2600 });
    if (await shotVideo('conq_earth', { dur: 4400 })) return;
    if (svg) { const d = trShot('', 'map gold'); d.appendChild(svg); ['us', 'cn', 'ru', 'bra', 'aus', 'deu', 'ind', 'egy'].forEach((k, i) => setTimeout(() => mapPulse(svg, k, 'gold'), i * 150)); await animViewBox(svg, [0, 0, 2000, 1040], [150, 80, 1700, 884], 2600); }
  },
  async hegemon() {
    const svg = mapClone();
    await shotCard(['세계는', '강대국의 것이었다.'], { dur: 2400 });
    if (svg) { const d = trShot('', 'map'); d.appendChild(svg); colorLand(svg, ['us', 'cn', 'ru'], 'rival'); colorLand(svg, ['kr'], 'mine'); ['us', 'cn', 'ru'].forEach((k, i) => setTimeout(() => { mapPulse(svg, k, 'red'); trCue('hit'); TR.shake = 8; }, 400 + i * 700)); await animViewBox(svg, [100, 60, 1800, 936], [300, 120, 1300, 676], 3200); }
    await shotCard(['그 질서가', '무너졌다.'], { hit: true, dur: 2000 });
    await shotVideo('heg_fleet', { dur: 3400, hit: true });
    await shotVideo('heg_seoul', { dur: 3400 });
    if (svg) { const d = trShot('', 'map gold'); d.appendChild(svg); svg.querySelectorAll('.rival').forEach(l => l.classList.replace('rival', 'fallen')); mapPulse(svg, 'kr', 'gold');
      ['jp', 'cn', 'us', 'ru', 'ind', 'deu', 'gbr', 'aus'].forEach((k, i) => setTimeout(() => { mapArc(svg, 'kr', k, 'gold'); trCue('whoosh', 0.4); }, 300 + i * 380)); TR.ambient = 'embers'; await animViewBox(svg, [300, 120, 1300, 676], [700, 200, 360, 187], 4200); }
    await shotNumber(1, '국력 세계 순위', { from: 30, dur: 2200, suffix: '위' });
    if (!(await shotVideo('heg_hall', { dur: 4400, cap: '누구도 넘볼 수 없는 자리.' }))) await shotCard(['누구도', '넘볼 수 없는 자리.'], { dur: 2200 });
  },
  async utopia() {
    await shotCard(['합계출산율 0.72명.'], { small: '세계 최저', dur: 2200 });
    if (await shotVideo('uto_river', { dur: 4200 })) { /* 실사 일출 */ } else {
    const d = trShot(`<div class="tr-dawn"><div class="sun"></div><div class="city">${Array.from({ length: 34 }, (_, i) => `<i style="height:${20 + ((i * 47) % 62)}%;animation-delay:${(i % 9) * 0.25}s"></i>`).join('')}</div><div class="haze"></div></div>`, 'dawn');
    TR.ambient = 'dust'; trCue('riser', 4.5); await trSleep(5200); }
    await shotNumber(S.stats.tfr, '합계출산율', { from: 0.72, dur: 2200, dec: 2, suffix: '명' });
    await shotVideo('uto_baby', { dur: 3600 });
    await shotNumber(S.stats.happiness, '국민 행복도', { from: 31, dur: 1800 });
    if (!(await shotVideo('uto_kids', { dur: 4400, cap: '아이들의 웃음소리가 다시 들리는 나라.' }))) await shotCard(['아이들의 웃음소리가', '다시 들리는 나라.'], { dur: 2600 });
  },
  async tech() {
    const names = (typeof TECHS !== 'undefined' ? TECHS : []).map(t => t.name).sort(() => Math.random() - 0.5).slice(0, 22);
    await shotCard([`${S.tech?.done?.length || 64}개의 기술.`], { dur: 1900 });
    await shotVideo('tec_fab', { dur: 3400 });
    const d = trShot(`<svg class="tr-net" viewBox="0 0 1000 420"></svg>`, 'net'), sv = d.querySelector('svg'), ns = 'http://www.w3.org/2000/svg', pts = [];
    for (let i = 0; i < names.length; i++) { if (TR.skip) break; const x = 60 + Math.random() * 880, y = 40 + Math.random() * 340; pts.push([x, y]);
      const near = pts.slice(0, -1).map(p => [p, Math.hypot(p[0] - x, p[1] - y)]).sort((a, b) => a[1] - b[1]).slice(0, 2);
      for (const [p] of near) { const l = document.createElementNS(ns, 'line'); l.setAttribute('x1', p[0]); l.setAttribute('y1', p[1]); l.setAttribute('x2', x); l.setAttribute('y2', y); sv.appendChild(l); }
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 4); sv.appendChild(c);
      const t = document.createElementNS(ns, 'text'); t.setAttribute('x', x + 8); t.setAttribute('y', y - 6); t.textContent = names[i]; sv.appendChild(t);
      trCue('tick'); await trSleep(150); }
    await trSleep(500);
    for (const n of ['3', '2', '1']) { if (TR.skip) break; trShot(`<div class="tr-count">${n}</div>`, 'black'); trHit(); await trSleep(800); }
    if (await shotVideo('tec_ignite', { dur: 4200, hit: true })) { TR.shake = 22; await shotVideo('tec_space', { dur: 4000 }); } else {
    const r = trShot(`<div class="tr-launch"><div class="stars"></div><svg class="rocket" viewBox="0 0 120 400"><defs><linearGradient id="rk" x1="0" x2="1"><stop offset="0" stop-color="#8a96a8"/><stop offset=".45" stop-color="#f4f7fb"/><stop offset="1" stop-color="#6b7688"/></linearGradient><radialGradient id="fl" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#ffe08a"/><stop offset=".6" stop-color="#ff7a1a"/><stop offset="1" stop-color="#ff3d00" stop-opacity="0"/></radialGradient></defs>
      <path class="flame" d="M38 300 Q60 420 82 300 Z" fill="url(#fl)"/><path d="M60 10 C88 50 92 110 90 290 L30 290 C28 110 32 50 60 10 Z" fill="url(#rk)"/><path d="M30 230 L8 300 L30 290 Z M90 230 L112 300 L90 290 Z" fill="#c8323a"/><circle cx="60" cy="110" r="13" fill="#1e3a6a" stroke="#cfd8e6" stroke-width="4"/><rect x="40" y="170" width="40" height="8" fill="#c8323a"/><text x="60" y="215" text-anchor="middle" font-size="16" font-weight="900" fill="#1e3a6a">KOREA</text></svg><div class="smoke"></div></div>`, 'launch');
    TR.ambient = 'embers'; trHit(true); let k = 0; const iv = setInterval(() => { TR.shake = Math.max(TR.shake, 10); trSparks(10, r.clientWidth / 2, r.clientHeight * 0.95); if (++k > 30) clearInterval(iv); }, 120);
    await trSleep(4200); clearInterval(iv); }
    await shotCard(['인류의 다음 시대는', '이곳에서 시작된다.'], { dur: 2600 });
  },
  async legacy() {
    const end = turnLabel(S.turn).year, pres = [...(S.presidents || []).slice(-7).map(p => [p.no, p.name, p.grade]), [termInfo(S).ord, S.name, '★']];
    await shotCard([`${START_YEAR}년.`], { small: '취임 선서', dur: 1900 });
    await shotVideo('leg_1960', { dur: 3800, look: 'oldfilm' });
    for (const [no, name, g] of pres) { if (TR.skip) break; trShot(`<div class="tr-pres"><small>제${no}대 대통령</small><b>${esc(name)}</b><em class="g-${g}">${g}</em></div>`, 'black'); trCue('hit'); TR.shake = 6; await trSleep(Math.max(450, 2400 / pres.length)); }
    await shotVideo('leg_lapse', { dur: 4000 });
    const H = S.history || [], W = 1000, Hh = 300, pts = H.map((h, i) => `${(i / Math.max(1, H.length - 1) * W).toFixed(1)},${(Hh - (h.approval ?? 50) / 100 * Hh).toFixed(1)}`).join(' ');
    const d = trShot(`<div class="tr-chart"><div class="yr">${START_YEAR}</div><svg viewBox="-10 -10 ${W + 20} ${Hh + 20}"><polyline points="${pts}"/></svg><small>지지율 ${H.length}분기의 기록</small></div>`, 'chart');
    const y = d.querySelector('.yr'), t0 = performance.now(); trCue('riser', 4);
    await new Promise(res => { const step = now => { const k = Math.min(1, (now - t0) / 4200); y.textContent = Math.round(START_YEAR + (end - START_YEAR) * k); if (k < 1 && !TR.skip) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    await shotCard([`${end}년.`], { hit: true, dur: 1700 });
    if (!(await shotVideo('leg_window', { dur: 4600, cap: '반세기. 역사가 당신을 기억한다.' }))) await shotCard(['반세기.', '역사가 당신을 기억한다.'], { dur: 2600 });
  },
};

async function playEndingCinema(id, then) {
  const v = typeof VICTORIES !== 'undefined' && VICTORIES.find(x => x.id === id); if (!v || !TRAILERS[id]) return then && then();
  TR.skip = false; TR.cues = []; TR.parts = []; TR.ambient = 'dust';
  if (typeof setSpeed === 'function') setSpeed(0);
  const el = document.createElement('div'); el.className = `trailer${window.CINE_REC ? ' rec' : ''}`;
  el.innerHTML = `<div class="tr-cam"></div><canvas class="tr-fx"></canvas><div class="tr-vig"></div><div class="tr-flash"></div><div class="tr-bar top"></div><div class="tr-bar bot"></div><button class="tr-skip">건너뛰기 ▶▶</button>`;
  document.body.appendChild(el); TR.root = el; TR.fx = el.querySelector('.tr-fx');
  try { const C = window.AudioContext || window.webkitAudioContext; if (C && (typeof SFX === 'undefined' || SFX.on) && !window.CINE_REC) { TR.ac = new C(); const comp = TR.ac.createDynamicsCompressor(); comp.connect(TR.ac.destination); TR.snd = trSound(TR.ac, comp); TR.base = TR.ac.currentTime; } else { TR.ac = null; } } catch { TR.ac = null; }
  TR.t0 = performance.now();
  el.querySelector('.tr-skip').onclick = () => { TR.skip = true; TR._w && TR._w(); };
  requestAnimationFrame(trFxLoop);
  if (typeof clipLoad === 'function') (TRAILER_CLIPS[id] || []).forEach(c => clipLoad(c, 9000));
  const est = { conquest: 38, hegemon: 34, utopia: 32, tech: 32, legacy: 34 }[id] || 34;
  if (TR.snd) TR.snd.drone(TR.base + 0.1, est); TR.cues.push({ t: 0.1, type: 'drone', arg: est });
  await trSleep(500);
  try { await TRAILERS[id](); } catch (e) { console.error(e); }
  TR.skip = false; await shotTitle(v);
  el.classList.add('out'); await new Promise(r => setTimeout(r, 900));
  TR.duration = trT();
  try { TR.ac && setTimeout(() => TR.ac.close(), 1500); } catch {}
  el.remove(); TR.root = null;
  then && then();
}

// 엔딩 카드 전에 트레일러 먼저
if (typeof openVictoryCard === 'function') {
  const _ovc = openVictoryCard;
  openVictoryCard = function () { const id = S && vicState(S).pending; if (!id) return _ovc(); playEndingCinema(id, () => _ovc()); };
}
