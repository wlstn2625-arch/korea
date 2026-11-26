/* =========================================================
 *  엔딩 컷신: 그 판의 실제 기록으로 만들어지는 짧은 영상
 *  세계 정복(지도가 파랗게 물듦) · 세계 패권(국력 순위 경주) · 복지 낙원(새벽 도시)
 *  기술 특이점(로켓 발사) · 50년 대장정(역사 몽타주)
 * ========================================================= */
const CINE = {
  sleep: ms => new Promise(r => setTimeout(r, ms)),
  skip: false,
};
function cineMusic() {
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C || (typeof SFX !== 'undefined' && !SFX.on)) return () => {};
    const c = new C(), g = c.createGain(); g.gain.value = 0.0001; g.connect(c.destination);
    g.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 1.5);
    const chords = [[262, 330, 392], [220, 277, 330], [175, 220, 262], [196, 247, 294], [262, 330, 392, 523]];
    const oscs = [];
    chords.forEach((ch, i) => ch.forEach(f => { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const og = c.createGain(); og.gain.setValueAtTime(0, c.currentTime + i * 2.4); og.gain.linearRampToValueAtTime(0.35, c.currentTime + i * 2.4 + 0.3); og.gain.linearRampToValueAtTime(0, c.currentTime + i * 2.4 + 2.6); o.connect(og).connect(g); o.start(c.currentTime + i * 2.4); o.stop(c.currentTime + i * 2.4 + 2.8); oscs.push(o); }));
    return () => { try { g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8); setTimeout(() => c.close(), 1000); } catch {} };
  } catch { return () => {}; }
}
async function cineCaption(el, text, hold = 1600) {
  if (CINE.skip) return;
  el.classList.remove('show'); await CINE.sleep(120); el.textContent = text; el.classList.add('show'); await CINE.sleep(hold);
}

/* ---- 장면들 ---- */
const CINE_SCENES = {
  async conquest(stage, cap) {
    const src = typeof mapBuilt !== 'undefined' && mapBuilt?.svg;
    const svg = src ? src.cloneNode(true) : null;
    if (svg) {
      svg.removeAttribute('id'); svg.classList.add('cn-map'); svg.querySelectorAll('.g-pins, .g-war, .g-front, .g-lbl, .g-city, .eu-mark').forEach(x => x.remove());
      svg.setAttribute('viewBox', `780 190 200 130`); stage.appendChild(svg);
      const lands = [...svg.querySelectorAll('.land[data-c]')];
      lands.forEach(l => { l.style.fill = '#3a3f45'; l.style.transition = 'fill .5s'; });
      const order = lands.map(l => ({ l, k: l.dataset.c, d: l.dataset.c === 'kr' ? -1 : (cinfo(l.dataset.c)?.km ?? 99999) })).sort((a, b) => a.d - b.d);
      const uniq = [...new Set(order.map(o => o.k))], total = uniq.length;
      const cnt = document.createElement('div'); cnt.className = 'cn-count'; stage.appendChild(cnt);
      cap.textContent = ''; await cineCaption(cap, '한반도의 작은 나라에서 시작했습니다.', 1500);
      order.filter(o => o.k === 'kr').forEach(o => o.l.style.fill = '#3f7fe0');
      const vb = [780, 190, 200, 130]; const target = [0, 0, 2000, 1040];
      const t0 = performance.now(), dur = 6500;
      cineCaption(cap, '이웃을 넘어, 바다를 건너…', 2600);
      await new Promise(res => {
        const step = now => {
          const k = Math.min(1, (now - t0) / dur), e = k * k * (3 - 2 * k);
          const cur = vb.map((v, i) => v + (target[i] - v) * e); svg.setAttribute('viewBox', cur.map(x => x.toFixed(1)).join(' '));
          const n = Math.floor(total * Math.min(1, k * 1.08)), got = new Set(uniq.slice(0, n));
          for (const o of order) if (got.has(o.k)) o.l.style.fill = '#3f7fe0';
          cnt.innerHTML = `<b>${Math.min(n, total)}</b><small>/ ${total}개국</small>`;
          if (k < 1 && !CINE.skip) requestAnimationFrame(step); else { order.forEach(o => o.l.style.fill = '#3f7fe0'); res(); }
        };
        requestAnimationFrame(step);
      });
    }
    await cineCaption(cap, '이제 세계 지도에 남은 색은 하나뿐입니다.', 2600);
  },
  async hegemon(stage, cap) {
    const ks = allCountryKeys().filter(k => cinfo(k) && !cinfo(k).isBloc && k !== 'kr' && !S.annexed?.[k]).map(k => ({ k, v: cinfo(k).eco * 0.55 + cinfo(k).mil * 0.45 })).sort((a, b) => b.v - a.v).slice(0, 7);
    const rows = [{ k: 'kr', v: 0, me: true }, ...ks]; const max = Math.max(...ks.map(x => x.v)) * 1.15;
    stage.innerHTML = `<div class="hg-race">${rows.map((r, i) => `<div class="hg-row ${r.me ? 'me' : ''}" data-k="${r.k}" style="top:${i * 54}px"><span class="hg-f">${r.me ? '🇰🇷' : cinfo(r.k).flag}</span><span class="hg-n">${r.me ? '대한민국' : esc(cname(r.k))}</span><div class="hg-bar"><i></i></div><b class="hg-r">${i + 1}</b></div>`).join('')}</div>`;
    await cineCaption(cap, '세계는 강대국들의 무대였습니다.', 1600);
    cineCaption(cap, '그리고 한 나라가 치고 올라왔습니다.', 2600);
    const els = [...stage.querySelectorAll('.hg-row')], t0 = performance.now(), dur = 5200;
    await new Promise(res => {
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = k * k * (3 - 2 * k);
        rows[0].v = max * 0.08 + (max * 1.02 - max * 0.08) * e;
        const sorted = [...rows].sort((a, b) => b.v - a.v);
        els.forEach(el => { const r = rows.find(x => x.k === el.dataset.k), idx = sorted.indexOf(r); el.style.top = idx * 54 + 'px'; el.querySelector('i').style.width = (r.v / max * 100).toFixed(1) + '%'; el.querySelector('.hg-r').textContent = idx + 1; });
        if (k < 1 && !CINE.skip) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    const crown = document.createElement('div'); crown.className = 'hg-crown'; crown.textContent = '👑'; stage.appendChild(crown);
    await cineCaption(cap, '세계 1위. 누구도 넘볼 수 없는 자리.', 2400);
  },
  async utopia(stage, cap) {
    stage.innerHTML = `<div class="ut-sky"><div class="ut-sun"></div><div class="ut-city">${Array.from({ length: 22 }, (_, i) => `<i style="height:${25 + ((i * 41) % 60)}%"></i>`).join('')}</div>
      <div class="ut-stats">${[['😊', '행복', S.stats.happiness.toFixed(0)], ['👶', '출산율', S.stats.tfr.toFixed(2) + '명'], ['⚖️', '지니', S.stats.gini.toFixed(3)], ['🏦', '채무', S.stats.debt.toFixed(0) + '%']].map(([ic, n, v], i) => `<div style="animation-delay:${1.2 + i * 0.5}s"><span>${ic}</span><b>${v}</b><small>${n}</small></div>`).join('')}</div></div>`;
    await cineCaption(cap, '긴 밤이 지나고…', 1600);
    await cineCaption(cap, '아이 울음소리가 다시 들리는 나라.', 2200);
    await cineCaption(cap, '모두가 내일을 기대하는 나라가 되었습니다.', 2400);
  },
  async tech(stage, cap) {
    stage.innerHTML = `<div class="tc-sky">${Array.from({ length: 60 }, () => `<i style="left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 2}s"></i>`).join('')}<div class="tc-pad"></div><div class="tc-rocket">🚀</div><div class="tc-smoke"></div><div class="tc-count"></div></div>`;
    const c = stage.querySelector('.tc-count');
    await cineCaption(cap, `기술 ${S.tech?.done?.length || 64}개를 모두 손에 넣었습니다.`, 1600);
    for (const n of ['3', '2', '1']) { if (CINE.skip) break; c.textContent = n; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); if (typeof SFX !== 'undefined') SFX.play('click'); await CINE.sleep(700); }
    c.textContent = ''; stage.querySelector('.tc-sky').classList.add('launch');
    await cineCaption(cap, '한국형 우주선, 발사.', 2400);
    await cineCaption(cap, '인류의 다음 시대는 이 나라에서 시작됩니다.', 2400);
  },
  async legacy(stage, cap) {
    const H = S.history || [], W = 600, Hh = 200;
    const pts = H.map((h, i) => `${(i / Math.max(1, H.length - 1) * W).toFixed(1)},${(Hh - (h.approval ?? 50) / 100 * Hh).toFixed(1)}`).join(' ');
    const pres = (S.presidents || []).slice(-6);
    stage.innerHTML = `<div class="lg-wrap"><div class="lg-year">${START_YEAR}</div><svg viewBox="0 0 ${W} ${Hh}" class="lg-chart"><polyline points="${pts}" /></svg>
      <div class="lg-pres">${pres.map((p, i) => `<div style="animation-delay:${2 + i * 0.6}s"><span class="grade-chip g-${p.grade}">${p.grade}</span> 제${p.no}대 ${esc(p.name)}</div>`).join('')}<div style="animation-delay:${2 + pres.length * 0.6}s"><span class="grade-chip">★</span> 제${termInfo(S).ord}대 ${esc(S.name)}</div></div></div>`;
    const y = stage.querySelector('.lg-year'), t0 = performance.now(), end = turnLabel(S.turn).year;
    const tick = now => { const k = Math.min(1, (now - t0) / 6000); y.textContent = Math.round(START_YEAR + (end - START_YEAR) * k); if (k < 1 && !CINE.skip) requestAnimationFrame(tick); else y.textContent = end; };
    requestAnimationFrame(tick);
    await cineCaption(cap, `${START_YEAR}년, 한 사람이 취임 선서를 했습니다.`, 2000);
    await cineCaption(cap, '정권이 바뀌고, 위기가 오고, 다시 일어섰습니다.', 2400);
    await cineCaption(cap, `그리고 ${end}년. 반세기의 역사가 완성되었습니다.`, 2400);
  },
};

async function playEndingCinema(id, then) {
  const v = typeof VICTORIES !== 'undefined' && VICTORIES.find(x => x.id === id); if (!v || !CINE_SCENES[id]) return then && then();
  CINE.skip = false;
  if (typeof setSpeed === 'function') setSpeed(0);
  const el = document.createElement('div'); el.className = `cinema cn-${id}${window.CINE_REC ? ' rec' : ''}`;
  el.innerHTML = `<div class="cn-bar top"></div><div class="cn-stage"></div><div class="cn-cap"></div><div class="cn-bar bot"></div>
    <div class="cn-title"><small>${v.icon} ${esc(v.name)} 엔딩</small><b>${esc(v.title)}</b><span>${esc(S.name)} 대통령 · ${turnLabel(S.turn).year}년</span></div>
    <button class="cn-skip">건너뛰기 ▶▶</button>`;
  document.body.appendChild(el);
  const stop = cineMusic();
  el.querySelector('.cn-skip').onclick = () => { CINE.skip = true; };
  await CINE.sleep(600);
  try { await CINE_SCENES[id](el.querySelector('.cn-stage'), el.querySelector('.cn-cap')); } catch (e) { console.error(e); }
  el.querySelector('.cn-cap').classList.remove('show');
  el.classList.add('final'); if (typeof SFX !== 'undefined') SFX.play('good');
  await CINE.sleep(CINE.skip ? 600 : 3200);
  stop(); el.classList.add('out'); await CINE.sleep(600); el.remove();
  then && then();
}

// 엔딩 카드 전에 컷신 먼저
if (typeof openVictoryCard === 'function') {
  const _ovc = openVictoryCard;
  openVictoryCard = function () { const id = S && vicState(S).pending; if (!id) return _ovc(); playEndingCinema(id, () => _ovc()); };
}
