/* =========================================================
 *  국방 무기 개발 트리 (스킬 트리처럼 국고로 찍기)
 *  - 6개 계통: 육군·해군·공군·미사일·방공·사이버·우주·전략
 *  - 동시에 2개까지 개발, 분기마다 진행, 완료되면 전력·전투에 바로 반영
 * ========================================================= */
// tree: mil(국방) / eco(경제)
const TECH_BRANCHES = [
  { id: 'army', name: '육군', icon: '🪖' },
  { id: 'navy', name: '해군', icon: '⚓' },
  { id: 'air', name: '공군', icon: '✈️' },
  { id: 'missile', name: '미사일·방공', icon: '🚀' },
  { id: 'cyber', name: '사이버·우주', icon: '🛰️' },
  { id: 'strat', name: '전략·방산', icon: '☢️' },
  { id: 'ind', name: '제조·산업', icon: '🏭', tree: 'eco' },
  { id: 'ai', name: 'AI·반도체', icon: '💾', tree: 'eco' },
  { id: 'energy', name: '에너지', icon: '⚡', tree: 'eco' },
  { id: 'fin', name: '금융·무역', icon: '💹', tree: 'eco' },
  { id: 'infra', name: '인프라·물류', icon: '🚄', tree: 'eco' },
  { id: 'people', name: '인재·인구', icon: '🎓', tree: 'eco' },
];
const TECH_TREES = { mil: { name: '국방 무기', icon: '🪖' }, eco: { name: '경제 발전', icon: '📈' } };
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
  // 추가 국방 기술
  { id: 'a6', br: 'army', tier: 1, name: '차륜형 장갑차 기동군단', icon: '🚙', cost: 30, time: 2, b: { divs: 2, org: 0.3, mil: 2 }, desc: '빠른 기동으로 돌파 후 전과 확대.' },
  { id: 'a7', br: 'army', tier: 3, req: ['a2'], name: '레이저 대공무기(천광)', icon: '🔦', cost: 55, time: 3, b: { cas: 0.93, enemyAir: 0.95, mil: 3 }, desc: '드론·포탄을 레이저로 요격.' },
  { id: 'n6', br: 'navy', tier: 2, req: ['n1'], name: '무인 수상정·기뢰전 전대', icon: '🛥️', cost: 35, time: 2, b: { navy: 10, mil: 2 }, desc: '적 항구를 기뢰로 봉쇄하고 무인정으로 정찰.' },
  { id: 'n7', br: 'navy', tier: 3, req: ['n2'], name: '이지스 구축함 추가 건조', icon: '🛡️', cost: 70, time: 4, b: { navy: 20, nuke: 0.9, mil: 4 }, desc: '해상 탄도탄 요격 능력.' },
  { id: 'f5', br: 'air', tier: 2, req: ['f1'], name: '대형 수송기·공중강습여단', icon: '🪂', cost: 40, time: 3, b: { landing: 0.08, divs: 1, mil: 2 }, desc: '적 후방에 공수부대를 투입합니다.' },
  { id: 'f6', br: 'air', tier: 3, req: ['f2'], name: '장거리 공대지 순항미사일', icon: '🎯', cost: 50, time: 3, b: { missile: 0.3, air: 5, mil: 3 }, desc: '적 지휘부를 멀리서 타격.' },
  { id: 'm6', br: 'missile', tier: 2, req: ['m1'], name: '장사정포 요격체계(한국형 아이언돔)', icon: '🧱', cost: 50, time: 3, b: { cas: 0.9, mil: 3 }, desc: '수도권을 노리는 포탄을 막아냅니다.', done: s => { s.stats.safety += 2; } },
  { id: 'm7', br: 'missile', tier: 4, req: ['m4'], name: 'SLBM 전력화', icon: '🌊', cost: 80, time: 4, b: { missile: 0.4, nuke: 0.85, mil: 5 }, desc: '잠수함에서 쏘는 보복 타격 수단.' },
  { id: 'c5', br: 'cyber', tier: 3, req: ['c3'], name: '양자암호 군 통신망', icon: '🔐', cost: 55, time: 3, b: { org: 0.3, quality: 0.03, mil: 2 }, desc: '해킹·도청이 불가능한 지휘망.' },
  { id: 'c6', br: 'cyber', tier: 4, req: ['c4'], name: '저궤도 군 위성 통신망', icon: '📡', cost: 75, time: 4, b: { quality: 0.05, landing: 0.05, mil: 4 }, desc: '전장 어디서나 실시간 연결.' },
  { id: 's6', br: 'strat', tier: 2, req: ['s2'], name: '전시작전통제권 전환', icon: '🎖️', cost: 30, time: 3, b: { quality: 0.03, mil: 4 }, desc: '우리 군이 연합군을 지휘합니다. 미국과 조율 부담.', done: s => { relBump(s, 'us', -3, -1); s.factions.con = clamp(s.factions.con + 3, 0, 100); } },
  { id: 's7', br: 'strat', tier: 1, name: '국방과학연구소 확대', icon: '🔬', cost: 30, time: 2, b: { equip: 0.001, mil: 1 }, desc: '국방 R&D가 민간 기술로도 퍼집니다.', done: s => { s.stats.innovation += 1; } },
  // 경제 발전 (fx: 완료 시 지속 효과 / b.income: 국고 수입)
  { id: 'e1', br: 'ind', tier: 1, name: '스마트공장 보급', icon: '🤖', cost: 25, time: 2, fx: { gdp: 0.05 }, b: { income: 4 }, desc: '중소기업 생산성 혁신.' },
  { id: 'e2', br: 'ind', tier: 2, req: ['e1'], name: '소재·부품·장비 국산화', icon: '🔩', cost: 40, time: 3, fx: { gdp: 0.06, innovation: 1 }, b: { income: 5 }, desc: '공급망 자립. 수출 규제에 흔들리지 않습니다.' },
  { id: 'e3', br: 'ind', tier: 3, req: ['e2'], name: '미래차·2차전지 클러스터', icon: '🔋', cost: 60, time: 3, fx: { gdp: 0.1, unemp: -0.1 }, b: { income: 8 }, desc: '전기차·배터리 세계 1위 도전.' },
  { id: 'e4', br: 'ind', tier: 4, req: ['e3'], name: '첨단 제조 메가클러스터', icon: '🏙️', cost: 100, time: 5, fx: { gdp: 0.15, unemp: -0.15 }, b: { income: 12 }, desc: '반도체·바이오·로봇을 한데 묶은 산업 수도.' },
  { id: 'e5', br: 'ai', tier: 1, name: 'AI 데이터센터 단지', icon: '🗄️', cost: 35, time: 2, fx: { innovation: 2 }, b: { income: 4 }, desc: '전력·냉각 특구에 초대형 데이터센터.' },
  { id: 'e6', br: 'ai', tier: 2, req: ['e5'], name: 'HBM·차세대 메모리', icon: '💾', cost: 55, time: 3, fx: { gdp: 0.1, innovation: 2 }, b: { income: 8 }, desc: 'AI 칩 시장을 장악합니다.' },
  { id: 'e7', br: 'ai', tier: 3, req: ['e6'], name: '국가 AI 컴퓨팅 인프라', icon: '🧠', cost: 75, time: 4, fx: { gdp: 0.08, innovation: 4 }, b: { income: 6 }, desc: '모든 기업·연구소가 쓰는 공공 GPU.' },
  { id: 'e8', br: 'ai', tier: 4, req: ['e7'], name: '양자컴퓨터 상용화', icon: '⚛️', cost: 110, time: 6, fx: { gdp: 0.1, innovation: 5 }, b: { income: 8 }, desc: '세계 3대 양자 강국.' },
  { id: 'e9', br: 'energy', tier: 1, name: '차세대 지능형 전력망', icon: '🔌', cost: 30, time: 2, fx: { gdp: 0.03, env: 1 }, desc: '블랙아웃 위험 감소.' },
  { id: 'e10', br: 'energy', tier: 2, req: ['e9'], name: 'SMR 소형모듈원전', icon: '☢️', cost: 60, time: 4, fx: { gdp: 0.05, env: 2, infl: -0.1 }, b: { income: 5 }, desc: '값싼 전기, 수출도 가능.' },
  { id: 'e11', br: 'energy', tier: 2, req: ['e9'], name: '수소 경제 전환', icon: '💧', cost: 50, time: 3, fx: { env: 3, gdp: 0.04 }, desc: '수소차·수소발전 생태계.' },
  { id: 'e12', br: 'energy', tier: 3, req: ['e10', 'e11'], name: '핵융합 실증로', icon: '☀️', cost: 120, time: 7, fx: { gdp: 0.12, env: 4, innovation: 3 }, b: { income: 6 }, desc: '인공 태양. 에너지 걱정이 사라집니다.' },
  { id: 'e13', br: 'fin', tier: 1, name: 'MSCI 선진국 지수 편입', icon: '📊', cost: 30, time: 2, fx: { gdp: 0.05 }, b: { income: 6 }, desc: '외국인 투자 자금 대거 유입.' },
  { id: 'e14', br: 'fin', tier: 2, req: ['e13'], name: '원화 국제화·외환시장 개방', icon: '💱', cost: 45, time: 3, fx: { infl: -0.1 }, b: { income: 10 }, desc: '원화가 국제 결제 통화로.' },
  { id: 'e15', br: 'fin', tier: 3, req: ['e14'], name: '동북아 금융허브', icon: '🏦', cost: 70, time: 4, fx: { gdp: 0.08 }, b: { income: 12 }, desc: '여의도·부산이 아시아 금융 중심지로.' },
  { id: 'e16', br: 'fin', tier: 2, req: ['e13'], name: '국부펀드 확대', icon: '🪙', cost: 50, time: 3, fx: { fiscal: 0.3 }, b: { income: 8 }, desc: '외환보유고를 굴려 수익을 냅니다.' },
  { id: 'e17', br: 'infra', tier: 1, name: 'GTX 광역급행철도', icon: '🚆', cost: 40, time: 3, fx: { housing: 2, happiness: 1 }, desc: '수도권 출퇴근 30분 시대. 집값 안정.' },
  { id: 'e18', br: 'infra', tier: 1, name: '스마트항만·물류 자동화', icon: '🏗️', cost: 35, time: 2, fx: { gdp: 0.05 }, b: { income: 6 }, desc: '부산항이 세계 3대 항만으로.' },
  { id: 'e19', br: 'infra', tier: 2, req: ['e18'], name: '신공항·관광 허브', icon: '🛫', cost: 50, time: 3, fx: { gdp: 0.04 }, b: { income: 8 }, desc: '관광객 3천만 명 시대.' },
  { id: 'e20', br: 'infra', tier: 3, req: ['e17', 'e18'], name: '유라시아 대륙철도 연결', icon: '🚄', cost: 80, time: 5, fx: { gdp: 0.08 }, b: { income: 10 }, desc: '부산에서 유럽까지 기차로.', done: s => { relBump(s, 'ru', 4, 2); relBump(s, 'cn', 4, 2); relBump(s, 'eu', 3, 2); } },
  { id: 'e21', br: 'people', tier: 1, name: '이공계 인재 10만 양성', icon: '🧪', cost: 30, time: 2, fx: { innovation: 2, education: 2 }, desc: '과학고·대학원 대폭 확대.' },
  { id: 'e22', br: 'people', tier: 2, req: ['e21'], name: '해외 우수 인재 이민 비자', icon: '🛂', cost: 35, time: 2, fx: { innovation: 2, gdp: 0.04 }, desc: '세계의 엔지니어를 데려옵니다.' },
  { id: 'e23', br: 'people', tier: 2, req: ['e21'], name: '출산·육아 국가책임제', icon: '🍼', cost: 60, time: 4, fx: { tfr: 0.05, happiness: 2, fiscal: -0.2 }, desc: '아이 키우는 비용을 국가가 책임집니다.' },
  { id: 'e24', br: 'people', tier: 3, req: ['e22'], name: '평생교육·AI 재교육', icon: '📚', cost: 45, time: 3, fx: { unemp: -0.2, education: 2 }, desc: '일자리 전환을 돕습니다.' },
];
const techById = id => TECHS.find(t => t.id === id);
const TECH_SLOTS = 2; // 국방·경제 트리마다 동시 개발 수
const treeOf = t => TECH_BRANCHES.find(b => b.id === t.br)?.tree || 'mil';

function techState(s) { if (!s.tech) s.tech = { done: [], active: [] }; return s.tech; }
const techDone = (s, id) => techState(s).done.includes(id);
function techBonus(s) {
  const r = { divs: 0, quality: 0, air: 0, navy: 0, equip: 0, org: 0, landing: 0, missile: 1, cas: 1, enemyAir: 1, nuke: 1, mobilize: 0, mil: 0, income: 0 };
  for (const id of (s.tech?.done || [])) {
    const b = techById(id)?.b || {};
    for (const k in b) if (['missile'].includes(k)) r.missile += b[k]; else if (['cas', 'enemyAir', 'nuke'].includes(k)) r[k] *= b[k]; else r[k] += b[k];
  }
  for (const b of Object.values(s.fb || {})) for (const k in b) if (k in r) { if (['cas', 'enemyAir', 'nuke'].includes(k)) r[k] *= b[k]; else r[k] += b[k]; } // 국가 중점 보너스
  return r;
}
function techWhyNot(s, t) {
  const T = techState(s);
  if (T.done.includes(t.id)) return '완료';
  if (T.active.some(a => a.id === t.id)) return '개발 중';
  const miss = (t.req || []).filter(r => !T.done.includes(r));
  if (miss.length) return `선행: ${miss.map(r => techById(r).name).join(', ')}`;
  if (T.active.filter(a => treeOf(techById(a.id)) === treeOf(t)).length >= TECH_SLOTS) return `${TECH_TREES[treeOf(t)].name} 동시 개발은 ${TECH_SLOTS}개까지`;
  if (s.pcap < t.cost) return `국고 ${won(t.cost)} 필요`;
  return null;
}
function startTech(s, id) {
  const t = techById(id); if (!t) return { ok: false, msg: '알 수 없는 무기입니다.' };
  const why = techWhyNot(s, t); if (why) return { ok: false, msg: why };
  s.pcap -= t.cost; techState(s).active.push({ id, left: t.time });
  s.cnt = s.cnt || {}; s.cnt.tech = (s.cnt.tech || 0) + 1;
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
    for (const k in (t.fx || {})) { if (s.mods[k] != null) s.mods[k] += t.fx[k]; if (s.stats[k] != null) s.stats[k] += t.fx[k] * 0.5; }
    s.cnt = s.cnt || {}; s.cnt.techDone = (s.cnt.techDone || 0) + 1;
    if (treeOf(t) === 'mil') s.stats.security += 0.5;
    report.techDone.push(`${t.icon} ${t.name}`);
    addLog(s, 'good', `${t.icon} ${t.name} 실전 배치 완료!`);
    if (typeof worldNews === 'function') worldNews(s, `${t.icon} 대한민국, ${t.name} 실전 배치`, 'good');
  }
}
HOOKS.migrate.push(s => { techState(s); });
HOOKS.postTurn.push(techTurn);
