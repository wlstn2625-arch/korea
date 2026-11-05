/* =========================================================
 *  국방 무기 개발 트리 (스킬 트리처럼 국고로 찍기)
 *  - 6개 계통: 육군·해군·공군·미사일·방공·사이버·우주·전략
 *  - 동시에 2개까지 개발, 분기마다 진행, 완료되면 전력·전투에 바로 반영
 * ========================================================= */
const TECH_BRANCHES = [
  { id: 'army', name: '육군', icon: '🪖' },
  { id: 'navy', name: '해군', icon: '⚓' },
  { id: 'air', name: '공군', icon: '✈️' },
  { id: 'missile', name: '미사일·방공', icon: '🚀' },
  { id: 'cyber', name: '사이버·우주', icon: '🛰️' },
  { id: 'strat', name: '전략·방산', icon: '☢️' },
];
// b: 전투 보너스 (divs 사단, quality 질, air 공군력, navy 해군력, equip 장비 보충/일, org 조직력 회복/일,
//    landing 상륙 성공률, missile 미사일 작전 배율, cas 아군 사상자 배율, enemyAir 적 공군 배율, nuke 피핵 위험 배율,
//    mobilize 총동원 추가, mil 군사력 점수, income 국고 수입/분기)
const TECHS = [
  // 육군
  { id: 'a1', br: 'army', tier: 1, name: 'K2 전차 추가 양산', icon: '🛡️', cost: 30, time: 2, b: { divs: 3, quality: 0.03, mil: 3 }, desc: '기갑 사단 증강.' },
  { id: 'a2', br: 'army', tier: 2, req: ['a1'], name: 'K9A3 자주포·천무 확충', icon: '💥', cost: 40, time: 2, b: { quality: 0.06, mil: 3 }, desc: '화력 우세로 공세·방어 모두 강해집니다.' },
  { id: 'a3', br: 'army', tier: 2, req: ['a1'], name: '워리어 플랫폼(보병 전투체계)', icon: '🎯', cost: 35, time: 2, b: { quality: 0.04, cas: 0.92, mil: 2 }, desc: '보병 생존성 향상, 사상자 감소.' },
  { id: 'a4', br: 'army', tier: 3, req: ['a2', 'a3'], name: '유무인 복합 전투단', icon: '🤖', cost: 70, time: 4, b: { divs: 5, quality: 0.07, cas: 0.9, mil: 6 }, desc: '무인 차량과 로봇이 함께 싸웁니다.' },
  { id: 'a5', br: 'army', tier: 4, req: ['a4'], name: '전군 드론 전투단', icon: '🛸', cost: 90, time: 4, b: { divs: 4, quality: 0.1, mil: 7 }, desc: '사단마다 자폭·정찰 드론 대대 편성.' },
  // 해군
  { id: 'n1', br: 'navy', tier: 1, name: 'KDDX 차기 구축함', icon: '🚢', cost: 40, time: 3, b: { navy: 15, mil: 3 }, desc: '이지스급 방공·대잠 구축함.' },
  { id: 'n2', br: 'navy', tier: 2, req: ['n1'], name: '3천 톤급 잠수함 추가', icon: '🐋', cost: 45, time: 3, b: { navy: 15, mil: 3 }, desc: 'SLBM 탑재 잠수함 전단.' },
  { id: 'n3', br: 'navy', tier: 2, req: ['n1'], name: '대형 상륙함·해병 기동군단', icon: '⚓', cost: 50, time: 3, b: { landing: 0.15, divs: 2, mil: 2 }, desc: '바다 건너 상륙 작전 성공률이 크게 오릅니다.' },
  { id: 'n4', br: 'navy', tier: 3, req: ['n2', 'n3'], name: '경항공모함', icon: '🛳️', cost: 80, time: 4, b: { navy: 25, air: 10, landing: 0.1, mil: 6 }, desc: '원거리 전력 투사.' },
  { id: 'n5', br: 'navy', tier: 4, req: ['n2'], name: '핵추진 잠수함', icon: '⚛️', cost: 120, time: 6, b: { navy: 35, mil: 7 }, desc: '무제한 잠항. 중국이 반발합니다.', done: s => { relBump(s, 'cn', -6, -4); } },
  // 공군
  { id: 'f1', br: 'air', tier: 1, name: 'KF-21 블록2 양산', icon: '✈️', cost: 50, time: 3, b: { air: 20, mil: 4 }, desc: '국산 전투기 공대지 능력 강화.' },
  { id: 'f2', br: 'air', tier: 2, req: ['f1'], name: '공중급유기·조기경보기', icon: '📡', cost: 35, time: 2, b: { air: 10, landing: 0.05, mil: 2 }, desc: '작전 반경과 제공권 유지력 증가.' },
  { id: 'f3', br: 'air', tier: 3, req: ['f1'], name: '스텔스 무인 편대기', icon: '🦅', cost: 70, time: 4, b: { air: 25, mil: 5 }, desc: '유인기와 함께 나는 무인 윙맨.' },
  { id: 'f4', br: 'air', tier: 4, req: ['f2', 'f3'], name: '6세대 전투기 개발', icon: '🌠', cost: 130, time: 7, b: { air: 40, mil: 8 }, desc: '세계 최정상급 제공 전투기.', done: s => { s.stats.innovation += 2; } },
  // 미사일·방공
  { id: 'm1', br: 'missile', tier: 1, name: 'L-SAM 다층 방공망', icon: '🛡️', cost: 40, time: 3, b: { cas: 0.92, nuke: 0.8, mil: 3 }, desc: '적 미사일·항공기 요격.', done: s => { s.stats.security += 2; } },
  { id: 'm2', br: 'missile', tier: 1, name: '현무 미사일 전력 확충', icon: '🚀', cost: 35, time: 2, b: { missile: 0.5, mil: 3 }, desc: '미사일 정밀 타격 효과 +50%.' },
  { id: 'm3', br: 'missile', tier: 2, req: ['m2'], name: '정찰위성 군집', icon: '🛰️', cost: 45, time: 3, b: { quality: 0.04, landing: 0.05, missile: 0.2, mil: 2 }, desc: '적 움직임을 실시간 파악.' },
  { id: 'm4', br: 'missile', tier: 3, req: ['m3'], name: '극초음속 미사일', icon: '☄️', cost: 90, time: 5, b: { missile: 0.8, mil: 6 }, desc: '요격 불가능한 타격 수단.', done: s => { s.stats.security += 2; } },
  { id: 'm5', br: 'missile', tier: 3, req: ['m1', 'm3'], name: '킬체인·미사일 방어 통합', icon: '🧿', cost: 80, time: 4, b: { nuke: 0.5, cas: 0.95, mil: 4 }, desc: '적이 핵을 쓸 엄두를 못 내게 만듭니다.', done: s => { s.stats.security += 3; } },
  // 사이버·우주
  { id: 'c1', br: 'cyber', tier: 1, name: '사이버사령부 확장', icon: '💻', cost: 25, time: 2, b: { mil: 2 }, desc: '전쟁 중 "사이버 공격" 작전 사용 가능.' },
  { id: 'c2', br: 'cyber', tier: 2, req: ['c1'], name: '전자전기 도입', icon: '📶', cost: 40, time: 3, b: { enemyAir: 0.88, mil: 3 }, desc: '적 레이더·통신 교란. 적 공군력 -12%.' },
  { id: 'c3', br: 'cyber', tier: 2, req: ['c1'], name: 'AI 지휘통제체계', icon: '🧠', cost: 60, time: 4, b: { org: 0.6, quality: 0.05, mil: 4 }, desc: '조직력 회복이 빨라집니다.', done: s => { s.stats.innovation += 1; } },
  { id: 'c4', br: 'cyber', tier: 3, req: ['c2', 'c3'], name: '우주작전단·위성 요격', icon: '🌌', cost: 90, time: 5, b: { enemyAir: 0.85, missile: 0.3, mil: 6 }, desc: '적 위성을 무력화합니다.' },
  // 전략·방산
  { id: 's1', br: 'strat', tier: 1, name: 'K-방산 수출 드라이브', icon: '🏭', cost: 30, time: 2, b: { equip: 0.002, income: 10, mil: 1 }, desc: '방산 수출로 국고 수입 +₩1조/분기, 전시 장비 보충↑.', done: s => { s.factions.mil = clamp(s.factions.mil + 5, 0, 100); } },
  { id: 's2', br: 'strat', tier: 1, name: '예비군 정예화', icon: '🎖️', cost: 35, time: 2, b: { mobilize: 0.15, divs: 2, mil: 2 }, desc: '총동원 시 사단 +40%(기본 +25%).' },
  { id: 's3', br: 'strat', tier: 2, req: ['s1'], name: '전시 탄약 비축 공장', icon: '📦', cost: 40, time: 2, b: { equip: 0.003, mil: 2 }, desc: '장기전에서 장비가 덜 바닥납니다.' },
  { id: 's4', br: 'strat', tier: 2, req: ['s1'], name: '핵 잠재력(재처리·농축)', icon: '⚗️', cost: 60, time: 4, b: { mil: 3 }, desc: '마음먹으면 핵무장이 가능한 수준. 미국·일본이 경계합니다.', done: s => { relBump(s, 'us', -4, -2); relBump(s, 'jp', -4, -2); s.stats.security += 2; } },
  { id: 's5', br: 'strat', tier: 3, req: ['s4'], name: '독자 핵무장', icon: '☢️', cost: 150, time: 6, b: { mil: 15 }, desc: '핵보유국이 됩니다. 핵 보복이 가능해지고 적의 핵 위협이 줄지만, 미국·중국·일본·EU와 관계가 크게 나빠집니다.',
    done: s => { relBump(s, 'us', -18, -12); relBump(s, 'cn', -22, -15); relBump(s, 'jp', -18, -12); relBump(s, 'eu', -12, -8); relBump(s, 'ru', -6, -4); s.stats.security += 10; addLog(s, 'bad', '☢️ 대한민국이 핵보유국이 되었습니다. 국제 사회가 제재를 논의합니다.'); } },
];
const techById = id => TECHS.find(t => t.id === id);
const TECH_SLOTS = 2;

function techState(s) { if (!s.tech) s.tech = { done: [], active: [] }; return s.tech; }
const techDone = (s, id) => techState(s).done.includes(id);
function techBonus(s) {
  const r = { divs: 0, quality: 0, air: 0, navy: 0, equip: 0, org: 0, landing: 0, missile: 1, cas: 1, enemyAir: 1, nuke: 1, mobilize: 0, mil: 0, income: 0 };
  for (const id of (s.tech?.done || [])) {
    const b = techById(id)?.b || {};
    for (const k in b) if (['missile'].includes(k)) r.missile += b[k]; else if (['cas', 'enemyAir', 'nuke'].includes(k)) r[k] *= b[k]; else r[k] += b[k];
  }
  return r;
}
function techWhyNot(s, t) {
  const T = techState(s);
  if (T.done.includes(t.id)) return '완료';
  if (T.active.some(a => a.id === t.id)) return '개발 중';
  const miss = (t.req || []).filter(r => !T.done.includes(r));
  if (miss.length) return `선행: ${miss.map(r => techById(r).name).join(', ')}`;
  if (T.active.length >= TECH_SLOTS) return `동시 개발은 ${TECH_SLOTS}개까지`;
  if (s.pcap < t.cost) return `국고 ${won(t.cost)} 필요`;
  return null;
}
function startTech(s, id) {
  const t = techById(id); if (!t) return { ok: false, msg: '알 수 없는 무기입니다.' };
  const why = techWhyNot(s, t); if (why) return { ok: false, msg: why };
  s.pcap -= t.cost; techState(s).active.push({ id, left: t.time });
  s.factions.mil = clamp(s.factions.mil + 1, 0, 100);
  addLog(s, 'info', `${t.icon} ${t.name} 개발 착수 (${won(t.cost)}, ${t.time}분기)`);
  return { ok: true, msg: `${t.icon} ${t.name} 개발에 착수했습니다. ${t.time}분기 뒤 실전 배치됩니다.` };
}
function cancelTech(s, id) {
  const T = techState(s), a = T.active.find(x => x.id === id); if (!a) return { ok: false };
  T.active = T.active.filter(x => x !== a); s.pcap += Math.round(techById(id).cost * 0.4);
  return { ok: true, msg: '개발을 중단했습니다. 비용의 40%를 돌려받았습니다.' };
}
function techTurn(s, report) {
  const T = techState(s); report.techDone = [];
  for (const a of [...T.active]) {
    if (--a.left > 0) continue;
    T.active = T.active.filter(x => x !== a); T.done.push(a.id);
    const t = techById(a.id); t.done?.(s);
    s.stats.security += 0.5;
    report.techDone.push(`${t.icon} ${t.name}`);
    addLog(s, 'good', `${t.icon} ${t.name} 실전 배치 완료!`);
    if (typeof worldNews === 'function') worldNews(s, `${t.icon} 대한민국, ${t.name} 실전 배치`, 'good');
  }
}
HOOKS.migrate.push(s => { techState(s); });
HOOKS.postTurn.push(techTurn);
