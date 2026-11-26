/* =========================================================
 *  승리 조건 (엔딩)
 *  여러 갈래 중 하나를 달성하면 엔딩. 엔딩 뒤에도 "계속 통치"로 이어갈 수 있음
 * ========================================================= */
const VICTORY_TERM_TURNS = 200; // 50년

const rankNow = s => { try { const r = powerRank(s); return (typeof r === 'number' ? r : r?.rank) ?? 99; } catch { return 99; } };
// 독립국(다른 나라에 병합되지 않은 나라) 중 우리 것이 아닌 나라
function worldRivals(s) {
  return allCountryKeys().filter(k => { const c = cinfo(k); return c && !c.isBloc && k !== 'kr' && !s.annexed?.[k] && !s.terr?.[k] && !s.world?.owner?.[k]; });
}
function worldOwned(s) { return allCountryKeys().filter(k => s.annexed?.[k] || s.terr?.[k]).length; }

const VICTORIES = [
  { id: 'conquest', icon: '🌍', name: '세계 정복', title: '천하통일', desc: '지구상의 모든 독립국을 점령·합병합니다.',
    progress: s => { const own = worldOwned(s), rest = worldRivals(s).length; return { p: own / Math.max(1, own + rest), text: `점령·합병 ${own}개국 · 남은 독립국 ${rest}개` }; },
    done: s => worldRivals(s).length === 0 },
  { id: 'hegemon', icon: '👑', name: '세계 패권', title: '팍스 코리아나', desc: '국력 세계 1위를 8분기(2년) 연속 지킵니다.',
    progress: s => { const r = rankNow(s), st = s.vic?.streak?.hegemon || 0; return { p: r === 1 ? Math.min(1, st / 8) : Math.max(0, (20 - r) / 19) * 0.5, text: r === 1 ? `세계 1위 ${st}/8분기 연속` : `지금 국력 ${r}위 → 1위가 되어야 함` }; },
    done: s => (s.vic?.streak?.hegemon || 0) >= 8 },
  { id: 'unify', icon: '🕊️', name: '통일 강국', title: '통일 대한민국', desc: '북한과 통일하고, 국민 행복 60 · 지지율 55%를 넘깁니다.',
    progress: s => { const u = !!s.annexed?.nk, h = s.stats.happiness, a = s.approval; return { p: (u ? 0.6 : 0) + Math.min(0.2, h / 60 * 0.2) + Math.min(0.2, a / 55 * 0.2), text: `${u ? '✅ 통일' : '❌ 통일 전'} · 행복 ${h.toFixed(0)}/60 · 지지율 ${a.toFixed(0)}/55%` }; },
    done: s => !!s.annexed?.nk && s.stats.happiness >= 60 && s.approval >= 55 },
  { id: 'utopia', icon: '🌈', name: '복지 낙원', title: '모두가 행복한 나라', desc: '행복 75 · 출산율 1.3 · 지니 0.28 이하 · 채무 60% 이하를 4분기 연속 유지합니다.',
    progress: s => { const st = s.stats, ok = [st.happiness >= 75, st.tfr >= 1.3, st.gini <= 0.28, st.debt <= 60], k = s.vic?.streak?.utopia || 0;
      return { p: ok.filter(Boolean).length / 4 * 0.6 + Math.min(1, k / 4) * 0.4, text: `행복 ${st.happiness.toFixed(0)}/75 ${ok[0] ? '✅' : ''} · 출산 ${st.tfr.toFixed(2)}/1.3 ${ok[1] ? '✅' : ''} · 지니 ${st.gini.toFixed(3)}/0.28 ${ok[2] ? '✅' : ''} · 채무 ${st.debt.toFixed(0)}/60% ${ok[3] ? '✅' : ''} · 유지 ${k}/4` }; },
    done: s => (s.vic?.streak?.utopia || 0) >= 4 },
  { id: 'tech', icon: '🚀', name: '기술 특이점', title: '미래를 연 나라', desc: '국방·경제 기술 트리를 모두 완성합니다.',
    progress: s => { const n = s.tech?.done?.length || 0, t = typeof TECHS !== 'undefined' ? TECHS.length : 64; return { p: n / t, text: `기술 ${n}/${t}개 완성` }; },
    done: s => typeof TECHS !== 'undefined' && (s.tech?.done?.length || 0) >= TECHS.length },
  { id: 'legacy', icon: '📜', name: '50년 대장정', title: '반세기의 역사', desc: `${START_YEAR + 50}년까지 나라를 이끌면 역사가 최종 평가합니다.`,
    progress: s => ({ p: Math.min(1, s.turn / VICTORY_TERM_TURNS), text: `${turnLabel(s.turn).year}년 / ${START_YEAR + 50}년` }),
    done: s => s.turn >= VICTORY_TERM_TURNS },
];

function vicState(s) { return (s.vic = s.vic || { won: [], streak: {}, pending: null }); }
function victoryCheck(s) {
  const V = vicState(s);
  V.streak.hegemon = rankNow(s) === 1 ? (V.streak.hegemon || 0) + 1 : 0;
  const st = s.stats;
  V.streak.utopia = st.happiness >= 75 && st.tfr >= 1.3 && st.gini <= 0.28 && st.debt <= 60 ? (V.streak.utopia || 0) + 1 : 0;
  if (V.pending) return;
  for (const v of VICTORIES) {
    if (V.won.some(w => w.id === v.id)) continue;
    let ok = false; try { ok = v.done(s); } catch {}
    if (ok) {
      const score = typeof finalScore === 'function' ? finalScore(s) : null;
      V.won.push({ id: v.id, turn: s.turn, grade: score?.grade });
      V.pending = v.id;
      addLog(s, 'good', `🏆 엔딩 달성: ${v.icon} ${v.name} — ${v.title}`);
      break;
    }
  }
}
HOOKS.postTurn.push(victoryCheck);
HOOKS.migrate.push(s => { vicState(s); });
// 가장 가까운 목표 (안내용)
function nearestVictory(s) {
  return VICTORIES.filter(v => !vicState(s).won.some(w => w.id === v.id)).map(v => { let pr = { p: 0, text: '' }; try { pr = v.progress(s); } catch {} return { v, ...pr }; }).sort((a, b) => b.p - a.p)[0];
}
