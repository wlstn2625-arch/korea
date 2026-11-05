/* =========================================================
 *  각국 지도자 (가상 인물)
 *  - 정치체제·직함·성향 특성을 갖고, 선거·승계·쿠데타로 바뀜
 *  - 지도자 성향이 그 나라 AI의 공격성·대한(對韓) 관계·동맹 태도를 결정
 *  - 실존 인물이 아닙니다. 이름은 각 문화권 이름에서 무작위로 조합합니다.
 * ========================================================= */

const IDEOLOGIES = {
  dem:   { name: '민주주의', color: '#3e9b5f', agg: 8 },
  comm:  { name: '공산주의', color: '#c23b3b', agg: 32 },
  auth:  { name: '권위주의', color: '#d0812b', agg: 28 },
  mon:   { name: '왕정',     color: '#7a4fb5', agg: 18 },
  junta: { name: '군사정권', color: '#7b5a3a', agg: 40 },
  theo:  { name: '신정',     color: '#2f6f4f', agg: 34 },
};
// 정치체제 (지정이 없으면 대륙별 기본값)
const GOV = {
  us: 'dem', jp: 'dem', tw: 'dem', cn: 'comm', nk: 'comm', ru: 'auth', vnm: 'comm', lao: 'comm', cub: 'comm',
  sau: 'mon', are: 'mon', qat: 'mon', kwt: 'mon', bhr: 'mon', omn: 'mon', jor: 'mon', mar: 'mon', brn: 'mon', swz: 'mon', btn: 'mon',
  irn: 'theo', afg: 'theo', mmr: 'junta', mli: 'junta', bfa: 'junta', ner: 'junta', gin: 'junta', sdn: 'junta', tcd: 'junta',
  ind: 'dem', idn: 'dem', phl: 'dem', mng: 'dem', tha: 'dem', mys: 'dem', sgp: 'dem', lka: 'dem', npl: 'dem', bgd: 'dem', isr: 'dem', tur: 'auth',
  blr: 'auth', kaz: 'auth', uzb: 'auth', tkm: 'auth', tjk: 'auth', aze: 'auth', syr: 'auth', egy: 'auth', dza: 'auth', ven: 'auth', nic: 'auth', khm: 'auth', pak: 'dem', irq: 'dem', geo: 'dem', arm: 'dem', ukr: 'dem', mda: 'dem',
  zaf: 'dem', nga: 'dem', gha: 'dem', ken: 'dem', sen: 'dem', bwa: 'dem', nam: 'dem', eth: 'auth', eri: 'auth', rwa: 'auth', uga: 'auth', cmr: 'auth', ago: 'auth', zwe: 'auth', cog: 'auth', gnq: 'auth', tun: 'auth', lby: 'junta',
};
const REG_GOV = { Europe: 'dem', 'North America': 'dem', 'South America': 'dem', Oceania: 'dem', Asia: 'auth', Africa: 'auth' };
const govOf = k => GOV[k] || REG_GOV[cinfo(k)?.reg] || 'auth';
// 의원내각제 국가는 총리
const PM = new Set(['jp', 'gbr', 'deu', 'ind', 'can', 'aus', 'nzl', 'ita', 'esp', 'nld', 'bel', 'swe', 'nor', 'dnk', 'fin', 'aut', 'hun', 'cze', 'svk', 'grc', 'prt', 'irl', 'isr', 'pak', 'bgd', 'tha', 'mys', 'sgp', 'npl', 'jam', 'est', 'lva', 'hrv', 'svn', 'alb', 'irq', 'arm', 'geo', 'mng', 'lux', 'isl', 'mlt']);
function titleOf(k, gov) {
  if (k === 'nk') return '국무위원장';
  if (k === 'tw') return '총통';
  if (gov === 'comm') return k === 'cn' ? '국가주석' : '총서기';
  if (gov === 'mon') return ['gbr', 'jpn'].includes(k) ? '총리' : '국왕';
  if (gov === 'theo') return '최고지도자';
  if (gov === 'junta') return '군사위원회 의장';
  return PM.has(k) ? '총리' : '대통령';
}

/* ---------------- 성향 특성 ---------------- */
// agg: 공격성, rel: 대한 관계 보정, ally: 동맹 참전 의지, fta: FTA 비용 배율
const TRAITS = {
  aggressive:   { name: '호전적',   desc: '약한 이웃을 무력으로 압박합니다.', agg: 30 },
  expansionist: { name: '팽창주의', desc: '영토 확장을 노립니다. 전쟁에 이기면 합병합니다.', agg: 20 },
  pacifist:     { name: '평화주의', desc: '전쟁을 피하고 중재를 선호합니다.', agg: -30 },
  cautious:     { name: '신중함',   desc: '모험을 피합니다.', agg: -12 },
  nationalist:  { name: '민족주의', desc: '자국 우선. 외국에 대한 경계가 큽니다.', agg: 10, rel: -5 },
  proUS:        { name: '친미',     desc: '미국 진영과 가깝습니다. 한미동맹이 유지되면 한국에 우호적입니다.', relFn: s => (dip(s, 'us').alliance ? 8 : -4) },
  proCN:        { name: '친중',     desc: '중국 진영과 가깝습니다. 한국이 미국 편에 설수록 냉담합니다.', relFn: s => (dip(s, 'us').alliance ? -6 : 6) + (s.rel.cn - 46) * 0.1 },
  pragmatic:    { name: '실용주의', desc: '이념보다 이익. FTA·협력에 적극적입니다.', rel: 4, fta: 0.7 },
  isolationist: { name: '고립주의', desc: '남의 전쟁에 끼지 않습니다.', ally: -1, agg: -5 },
  opportunist:  { name: '기회주의', desc: '이미 전쟁 중인 약한 나라를 노립니다.', agg: 12 },
  koreaFriend:  { name: '지한파',   desc: '한국 문화와 경제를 높이 평가합니다.', rel: 10 },
  hardliner:    { name: '강경파',   desc: '협상보다 압박. 무리한 요구를 하기도 합니다.', agg: 15, rel: -6 },
};
// 체제별로 잘 나오는 특성
const TRAIT_POOL = {
  dem: ['pragmatic', 'pragmatic', 'cautious', 'pacifist', 'nationalist', 'koreaFriend', 'proUS', 'isolationist'],
  comm: ['nationalist', 'hardliner', 'cautious', 'proCN', 'aggressive', 'pragmatic'],
  auth: ['nationalist', 'aggressive', 'opportunist', 'pragmatic', 'hardliner', 'cautious', 'proCN', 'expansionist'],
  mon: ['pragmatic', 'cautious', 'proUS', 'koreaFriend', 'nationalist'],
  junta: ['aggressive', 'hardliner', 'opportunist', 'nationalist', 'expansionist'],
  theo: ['hardliner', 'nationalist', 'aggressive', 'isolationist'],
};
// 핵심국은 성향 일부를 고정 (지도자가 바뀌어도 국가 노선의 기본은 유지)
const FIXED_TRAITS = { cn: ['nationalist'], ru: ['nationalist'], nk: ['hardliner'], us: [], jp: ['cautious'], tw: ['proUS'], isr: ['hardliner'], irn: ['hardliner'] };

/* ---------------- 이름 (가상) ---------------- */
const NAMES = {
  zh: { sur: ['왕', '리', '장', '류', '천', '양', '자오', '저우', '쉬', '쑨', '마', '후'], given: ['지펑', '하이린', '웨이둥', '젠궈', '밍청', '수란', '중화', '리신', '창허', '원보', '쥔', '샤오핑'], eastern: true },
  ja: { sur: ['사토', '스즈키', '다카하시', '다나카', '와타나베', '이토', '야마모토', '나카무라', '고바야시', '가토'], given: ['겐이치', '히로시', '다쿠야', '마사토', '유코', '나오키', '사토시', '아키라', '레이코', '고지'], eastern: true, space: true },
  ko: { sur: ['김', '리', '박', '최', '정', '한', '조', '윤'], given: ['정철', '영남', '성호', '명수', '광혁', '은희', '철룡', '혁진'], eastern: true },
  mn: { sur: ['바트', '오윤', '간', '체렌'], given: ['에르데네', '바야르', '수흐바타르', '돌고르', '나란', '테무진'] },
  en: { sur: ['하트웰', '모리슨', '캘러핸', '브룩스', '웬트워스', '해리슨', '애시퍼드', '골드버그', '맥닐', '펠프스', '로던', '셰리든'], given: ['제임스', '캐서린', '로버트', '엘리너', '대니얼', '마거릿', '토머스', '헬렌', '윌리엄', '그레이스', '조너선', '앨리스'] },
  es: { sur: ['가르시아', '로드리게스', '마르티네스', '페르난데스', '로페스', '모랄레스', '에레라', '바르가스', '멘도사', '카스티요'], given: ['카를로스', '루시아', '하비에르', '마리아', '안드레스', '이사벨', '디에고', '카밀라', '라파엘', '소피아'] },
  pt: { sur: ['실바', '산투스', '올리베이라', '코스타', '페레이라', '알메이다', '카르발류'], given: ['주앙', '아나', '페드루', '베아트리스', '루이스', '마리아나', '하파엘'] },
  fr: { sur: ['르블랑', '모로', '포르니에', '지라르', '랑베르', '보네', '뒤랑', '루소'], given: ['프랑수아', '카미유', '앙투안', '엘로디', '피에르', '마틸드', '로랑', '클레르'] },
  de: { sur: ['베버', '슈미트', '호프만', '바그너', '베커', '슐츠', '피셔', '노이만'], given: ['프리드리히', '안겔리카', '마르쿠스', '자비네', '클라우스', '레나테', '토비아스', '우테'] },
  it: { sur: ['로시', '페라리', '콜롬보', '리치', '마리노', '그레코', '브루노', '갈리'], given: ['마르코', '줄리아', '알레산드로', '키아라', '로렌초', '프란체스카', '조반니', '엘레나'] },
  slav: { sur: ['볼코프', '노박', '코발렌코', '페트로프', '레베데프', '코작', '모로조프', '즈베레프'], given: ['드미트리', '올가', '세르게이', '나탈리야', '안드레이', '이리나', '미하일', '타티아나'] },
  nord: { sur: ['안데르센', '린드크비스트', '한센', '스벤손', '요한센', '닐센', '빅룬드'], given: ['에리크', '잉리드', '라르스', '시그리드', '올라프', '아스트리드', '닐스'] },
  ar: { sur: ['알하킴', '알라시드', '알만수르', '알파이살', '하다드', '나세르', '살레', '알자예드'], given: ['칼리드', '파티마', '오마르', '라일라', '유세프', '아미라', '하산', '타리크'] },
  fa: { sur: ['호세이니', '라흐마니', '모하마디', '카리미', '자파리'], given: ['알리레자', '마흐무드', '레자', '파르비즈', '하미드'] },
  tr: { sur: ['일디즈', '데미르', '샤힌', '아이든', '쾨세'], given: ['메흐메트', '아이셰', '무스타파', '엘리프', '케말'] },
  he: { sur: ['레비', '코헨', '미즈라히', '페레츠', '비톤'], given: ['요나탄', '노아', '아비', '탈', '다비드'] },
  in: { sur: ['샤르마', '파텔', '싱', '쿠마르', '굽타', '라오', '메논', '레디'], given: ['라제시', '프리야', '아르준', '아난야', '비크람', '카비타', '산자이', '미라'] },
  sea: { sur: ['응우옌', '산토스', '위자야', '수완', '탄', '이스마일', '레', '림'], given: ['안', '마리아', '부디', '시리', '하이', '누르', '마닐라', '티엔'] },
  tk: { sur: ['누르벡', '사파로프', '아이트마토프', '토카예프', '라히모프'], given: ['아스카르', '굴나라', '테무르', '디나라', '바흐티요르'] },
  af: { sur: ['오콘쿼', '음베키', '케냐타', '디알로', '므왕기', '오비', '반다', '투레'], given: ['쿠와메', '아마라', '은도우', '자이납', '오바', '파투', '키마니', '음와리'] },
};
const CULTURE = { us: 'en', can: 'en', gbr: 'en', irl: 'en', aus: 'en', nzl: 'en', cn: 'zh', tw: 'zh', jp: 'ja', nk: 'ko', mng: 'mn', bra: 'pt', prt: 'pt', ago: 'pt', moz: 'pt',
  fra: 'fr', bel: 'fr', lux: 'fr', che: 'de', deu: 'de', aut: 'de', nld: 'de', ita: 'it', esp: 'es', mex: 'es', irn: 'fa', afg: 'fa', tur: 'tr', aze: 'tr', isr: 'he', grc: 'it', cyp: 'it', mlt: 'it',
  ind: 'in', pak: 'in', bgd: 'in', npl: 'in', lka: 'in', btn: 'in', phl: 'sea', isl: 'nord' };
const SUB_CULTURE = { 'Northern Europe': 'nord', 'Eastern Europe': 'slav', 'Southern Europe': 'slav', 'Western Europe': 'de', 'Western Asia': 'ar', 'Northern Africa': 'ar', 'Southern Asia': 'in', 'Central Asia': 'tk', 'South-Eastern Asia': 'sea',
  'Northern America': 'en', 'Central America': 'es', 'Caribbean': 'es', 'South America': 'es', 'Australia and New Zealand': 'en' };
function cultureOf(k) { const m = typeof MAP_DATA !== 'undefined' && MAP_DATA.countries[k]; return CULTURE[k] || SUB_CULTURE[m?.sub] || (m?.reg === 'Africa' ? 'af' : m?.reg === 'Oceania' ? 'en' : 'en'); }

// 결정적 난수 (나라·세대가 같으면 같은 지도자)
function hashRnd(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

function genLeader(s, k, gen, gov) {
  const r = hashRnd(`${k}:${gen}:${s.seed || 0}`);
  gov = gov || govOf(k);
  const pool = NAMES[cultureOf(k)] || NAMES.en;
  const sur = pool.sur[Math.floor(r() * pool.sur.length)], given = pool.given[Math.floor(r() * pool.given.length)];
  const name = pool.eastern ? `${sur}${pool.space || given.length <= 1 ? ' ' : ''}${given}` : `${given} ${sur}`;
  const traits = [...(FIXED_TRAITS[k] || [])];
  const tp = TRAIT_POOL[gov];
  const want = isCore(k) ? 3 : 2;
  let guard = 0;
  while (traits.length < want && guard++ < 30) {
    const t = tp[Math.floor(r() * tp.length)];
    if (traits.includes(t)) continue;
    if ((t === 'pacifist' && traits.some(x => ['aggressive', 'expansionist', 'hardliner'].includes(x))) || (['aggressive', 'expansionist'].includes(t) && traits.includes('pacifist'))) continue;
    if ((t === 'proUS' && traits.includes('proCN')) || (t === 'proCN' && traits.includes('proUS'))) continue;
    traits.push(t);
  }
  const age = 48 + Math.floor(r() * 26);
  return { name, gov, title: titleOf(k, gov), traits, gen, since: s.turn || 0, age, avatarHue: Math.floor(r() * 360) };
}

function leaderAgg(s, k) {
  const L = s.leaders?.[k]; if (!L) return 20;
  return clamp(IDEOLOGIES[L.gov].agg + L.traits.reduce((a, t) => a + (TRAITS[t].agg || 0), 0), 0, 100);
}
function leaderRelDelta(s, k, L) {
  L = L || s.leaders?.[k]; if (!L) return 0;
  return L.traits.reduce((a, t) => a + (TRAITS[t].rel || 0) + (TRAITS[t].relFn ? TRAITS[t].relFn(s) : 0), 0);
}
const hasTrait = (s, k, t) => !!s.leaders?.[k]?.traits.includes(t);

// 지도자 교체: 관계 보정을 새 지도자 성향으로 갈아끼움
function replaceLeader(s, k, reason, newGov) {
  const old = s.leaders[k];
  const L = genLeader(s, k, (old?.gen || 0) + 1, newGov || old?.gov);
  const d = leaderRelDelta(s, k, L) - leaderRelDelta(s, k, old);
  s.relMods[k] = (s.relMods[k] || 0) + d; s.rel[k] = clamp(relOf(s, k) + d * 0.5, 0, 100);
  s.leaders[k] = L;
  const txt = `${cflag(k)} ${cname(k)}: ${reason} — 새 ${L.title} ${L.name} 취임 (${L.traits.map(t => TRAITS[t].name).join('·')})`;
  // 작은 나라의 평범한 정권 교체는 뉴스에서 생략
  if (isCore(k) || cinfo(k).eco >= 40 || Math.abs(d) >= 5 || !/선거/.test(reason)) worldNews(s, txt, Math.abs(d) >= 5 ? (d > 0 ? 'good' : 'bad') : 'info');
  return L;
}

/* ---------------- 지도자 교체 (분기마다) ---------------- */
function leadersTurn(s) {
  for (const k of Object.keys(s.leaders)) {
    if (s.annexed[k] || s.world?.owner?.[k]) continue;
    const L = s.leaders[k], years = (s.turn - L.since) / 4;
    if (L.gov === 'dem') {
      // 4~5년마다 선거: 현직 재선 가능성은 성향과 무관하게 45%
      if (years >= 4 && Math.random() < 0.3) { if (Math.random() < 0.45) { L.since = s.turn; if (isCore(k) || cinfo(k).eco >= 40) worldNews(s, `${cflag(k)} ${cname(k)}: 선거에서 ${L.title} ${L.name} 재선`, 'info'); } else replaceLeader(s, k, '선거로 정권 교체'); }
    } else if (L.gov === 'junta') {
      if (Math.random() < 0.025) replaceLeader(s, k, '쿠데타', Math.random() < 0.3 ? 'dem' : 'junta');
    } else {
      if (Math.random() < 0.006 + Math.max(0, L.age + years - 75) * 0.003) replaceLeader(s, k, L.gov === 'mon' ? '왕위 계승' : '권력 승계');
      else if (L.gov === 'auth' && Math.random() < 0.004) replaceLeader(s, k, '민주화 시위로 정권 붕괴', 'dem');
    }
  }
}

/* ---------------- 규칙 기반 지도자 대화 (Claude가 없을 때) ---------------- */
function ruleLeaderTalk(s, k, msg) {
  const L = s.leaders[k], r = relOf(s, k), tr = t => L.traits.includes(t);
  const has = (...w) => w.some(x => msg.includes(x));
  let d = 0, reply;
  const warm = r >= 65, cold = r < 35;
  if (has('위협', '전쟁', '침공', '각오', '경고', '제재')) {
    d = tr('hardliner') || tr('nationalist') || tr('aggressive') ? -8 : -4;
    reply = tr('aggressive') || tr('hardliner') ? `협박은 통하지 않소. ${cname(k)} 국민은 굴복하지 않을 것이오. 선을 넘으면 그 대가를 치르게 될 거요.` : '그런 말씀은 양국 관계에 도움이 되지 않습니다. 대화로 풀어 갔으면 합니다.';
  } else if (has('FTA', '무역', '투자', '경제', '협력', '반도체')) {
    d = tr('pragmatic') ? 6 : tr('isolationist') || tr('nationalist') ? 1 : 3;
    reply = tr('pragmatic') ? '좋습니다. 이익이 되는 거래라면 언제든 환영입니다. 실무진에게 바로 협상을 지시하겠습니다.' : cold ? '경제 협력은 신뢰가 먼저입니다. 귀국의 태도부터 지켜보겠습니다.' : '경제 협력 제안은 검토해 보겠습니다. 구체적인 안을 보내 주십시오.';
  } else if (has('동맹', '안보', '군사', '함께')) {
    d = tr('isolationist') ? -1 : warm ? 5 : 1;
    reply = tr('isolationist') ? '우리는 다른 나라의 분쟁에 휘말리고 싶지 않습니다. 이해해 주십시오.' : warm ? '귀국은 믿을 만한 친구입니다. 안보 협력을 한 단계 높이는 방안을 논의합시다.' : '안보 협력은 아직 이르다고 봅니다. 관계를 더 쌓아 갑시다.';
  } else if (has('원조', '지원', '도움', '백신', '재건')) {
    d = 4; reply = '귀국의 호의에 깊이 감사드립니다. 우리 국민도 이 마음을 잊지 않을 겁니다.';
  } else if (has('평화', '대화', '화해', '친구', '우정', '존중')) {
    d = tr('pacifist') ? 6 : tr('hardliner') ? 1 : 3;
    reply = tr('hardliner') ? '말보다 행동을 보여 주시오. 그러면 우리도 응할 것이오.' : '평화와 상호 존중, 저도 같은 생각입니다. 양국의 미래를 위해 함께 노력합시다.';
  } else {
    d = warm ? 2 : cold ? -1 : 1;
    reply = warm ? '언제나 반갑습니다, 대통령님. 우리 두 나라의 우정이 계속되길 바랍니다.' : cold ? '용건을 분명히 말씀해 주시겠습니까.' : '말씀 잘 들었습니다. 우리 정부도 신중히 검토하겠습니다.';
  }
  return { reply, relDelta: d, mood: d >= 4 ? '우호적' : d <= -4 ? '불쾌함' : '중립' };
}

HOOKS.migrate.push(s => {
  if (!s.seed) s.seed = Math.floor(Math.random() * 1e6);
  if (!s.leaders) {
    s.leaders = {};
    for (const k of allCountryKeys()) {
      if (CORE_INFO[k]?.bloc) continue;
      const L = genLeader(s, k, 1);
      L.since = -Math.floor(Math.random() * 16); // 이미 재임 중인 기간
      s.leaders[k] = L;
      // 핵심국은 이미 관계 수치에 국가 노선이 반영돼 있으므로 지도자 성향 보정을 약하게
      const d = leaderRelDelta(s, k, L) * (isCore(k) ? 0.4 : 1);
      s.relMods[k] = (s.relMods[k] || 0) + d; s.rel[k] = clamp(relOf(s, k) + d * 0.6, 0, 100);
    }
  }
});
HOOKS.postTurn.push(leadersTurn);
