/* =========================================================
 *  다양한 국정 사건 카드 (사회·재난·안보·경제·과학·희소식·국가 비상)
 *  - domestic.js의 DOM_EVENTS에 합쳐짐
 *  - kind: 카드 배너 종류, extreme: '국가 비상' 극한 위기
 *  - 한 번 나온 사건은 한동안(12분기) 다시 나오지 않음 → 골고루 등장
 * ========================================================= */
const pick = a => a[Math.floor(Math.random() * a.length)];
const fx = (s, o) => { for (const k in o) if (s.stats[k] != null) s.stats[k] += o[k]; };
const coin = p => Math.random() < p;

const EVENT_KINDS = {
  politics: { cls: 'ev-politics', name: '국내 정치' },
  society: { cls: 'ev-social', name: '사회' },
  disaster: { cls: 'ev-disaster', name: '재난' },
  security: { cls: 'ev-security', name: '안보' },
  economy: { cls: 'ev-market', name: '경제' },
  tech: { cls: 'ev-tech', name: '과학·기술' },
  good: { cls: 'ev-good', name: '희소식' },
};

Object.assign(DOM_EVENTS, {
  /* ---------- 정치 (뻔하지 않은 것들) ---------- */
  deepfake: { w: 2, kind: 'politics', cond: s => true, icon: '🎭',
    make: s => ({ title: '대통령 딥페이크 영상 확산', desc: `대통령이 "${pick(['국민연금을 폐지하겠다', '징병제를 3년으로 늘리겠다', '수도를 세종으로 옮기겠다', '부가세를 20%로 올리겠다'])}"고 말하는 가짜 영상이 SNS에서 수백만 회 재생됐습니다. 해외 서버에서 유포가 계속됩니다.` }),
    choices: [
      { label: '수사 의뢰·팩트체크', desc: '지지율 -0.5, 사법 신뢰 +1.', run: s => { s.approval -= 0.5; fx(s, { justice: 1 }); return '경찰청 사이버수사대가 유포 조직 추적에 나섰습니다.'; } },
      { label: 'AI 워터마크 의무화', desc: '가짜 영상 방지법 추진. 혁신 -1, 표현의 자유 -1, 안전 +2.', pc: 10, run: s => { fx(s, { innovation: -1, freedom: -1, safety: 2 }); bump(s, 'elder', 3); return 'AI 생성물 표시 의무화 법안을 발의했습니다.'; } },
      { label: '대통령이 직접 패러디로 응수', desc: '도박: 성공하면 지지율 +3, 실패하면 -2.', run: s => { if (coin(0.55)) { s.approval += 3; bump(s, 'youth', 5); return '"제 진짜 공약은 이겁니다" 영상이 더 크게 화제가 됐습니다.'; } s.approval -= 2; return '"가볍다"는 비판이 쏟아졌습니다.'; } },
    ] },
  courtRuling: { w: 2, kind: 'politics', cond: s => s.turn >= 3, icon: '⚖️',
    make: s => ({ title: '헌법재판소, 정부 시행령 위헌 결정', desc: `헌재가 ${pick(['재난지원금 지급 기준', '집회 신고 제한', '공공기관 이전 고시', '수사기관 통신조회 규정'])} 시행령에 대해 재판관 ${pick(['6 대 3', '7 대 2', '5 대 4(헌법불합치)'])} 의견으로 위헌 결정을 내렸습니다.` }),
    choices: [
      { label: '결정 존중·즉시 개정', desc: '사법 신뢰 +2, 지지율 -0.5.', run: s => { fx(s, { justice: 2 }); s.approval -= 0.5; bump(s, 'legal', 4); return '"헌재 결정을 존중한다"며 시행령을 고쳤습니다.'; } },
      { label: '법률로 격상해 재추진', desc: '국고 소요, 야당 협조도 -6, 지지층 결집.', pc: 10, run: s => { s.dom.oppMood -= 6; bump(s, facBase(s), 3); return '같은 내용을 법률로 만들어 국회에 냈습니다.'; } },
      { label: '헌재를 공개 비판', desc: '사법 신뢰 -3, 법조계 반발, 지지층 +.', run: s => { fx(s, { justice: -3 }); bump(s, 'legal', -8); bump(s, facBase(s), 4); s.dom.oppMood -= 4; return '"민의를 거스른 결정"이라고 비판했습니다. 사법부 독립 논란이 커집니다.'; } },
    ] },
  prosecutorRevolt: { w: 2, kind: 'politics', cond: s => s.turn >= 2, icon: '🧑‍⚖️',
    make: s => ({ title: '공소청장, 법무부 지휘에 공개 반기', desc: '공소청장이 기자회견을 열어 "정치적 사건에 대한 장관 지휘를 거부한다"고 선언했습니다. 일선 검사들이 연판장을 돌리고 있습니다.' }),
    choices: [
      { label: '징계·해임', desc: '당 장악력 +4, 사법 신뢰 -2, 야당 협조도 -6.', run: s => { s.dom.unity += 4; fx(s, { justice: -2 }); s.dom.oppMood -= 6; bump(s, 'legal', -5); return '공소청장을 해임했습니다. "검찰 길들이기" 논란이 일었습니다.'; } },
      { label: '수사 독립성 보장 선언', desc: '사법 신뢰 +3, 당 장악력 -4.', run: s => { fx(s, { justice: 3 }); s.dom.unity -= 4; bump(s, 'legal', 5); return '"수사 지휘권을 행사하지 않겠다"고 선언했습니다.'; } },
      { label: '물밑 조율', desc: '조용히 봉합. 국고 소요.', pc: 8, run: s => { s.dom.scandal += 3; return '비공개 회동으로 갈등을 덮었습니다. 불씨는 남았습니다.'; } },
    ] },
  mayorRebel: { w: 2, kind: 'politics', cond: s => true, icon: '🏙️',
    make: s => { const city = pick(['서울시장', '부산시장', '경기지사', '대구시장', '광주시장']); return { title: `${city}, 정부 정책에 정면 반기`, desc: `${city}이 "중앙정부 정책을 우리 지역에서는 시행하지 않겠다"며 독자 노선을 선언했습니다. 차기 대권 주자로 급부상 중입니다.` }; },
    choices: [
      { label: '교부금으로 압박', desc: '지방 세력 -6, 재정 +0.1, 지지율 -0.5.', run: s => { bump(s, 'local', -6); fx(s, { fiscal: 0.1 }); s.approval -= 0.5; return '지방교부세 배분을 조정해 압박했습니다.'; } },
      { label: '자치분권 확대로 포용', desc: '지방 세력 +6, 재정 -0.1.', run: s => { bump(s, 'local', 6); fx(s, { fiscal: -0.1 }); return '"지방이 실험하게 두자"며 권한을 넘겼습니다.'; } },
      { label: '직접 만나 담판', desc: '60% 확률로 합의(지지율 +2), 실패 시 -1.', pc: 8, run: s => { if (coin(0.6)) { s.approval += 2; return '공동 기자회견으로 갈등을 봉합했습니다.'; } s.approval -= 1; return '회동 직후 "대통령이 귀를 닫았다"는 발표가 나왔습니다.'; } },
    ] },
  healthRumor: { w: 1, kind: 'politics', cond: s => s.turn >= 4, icon: '🩺',
    make: s => ({ title: '대통령 건강 이상설', desc: `대통령이 ${pick(['열흘째', '일주일째', '2주째'])} 공개 일정에 나타나지 않자 "중병설"이 퍼졌습니다. 환율이 출렁입니다.` }),
    choices: [
      { label: '검진 결과 공개', desc: '지지율 +1, 루머 해소.', run: s => { s.approval += 1; return '주치의가 정상 소견을 발표했습니다.'; } },
      { label: '강행군 일정으로 반박', desc: '지지율 +2, 국고 소요.', pc: 6, run: s => { s.approval += 2; return '하루 다섯 곳 민생 현장을 돌며 건재를 과시했습니다.'; } },
      { label: '무대응', desc: '경제 불안 -0.05, 의혹 지속.', run: s => { fx(s, { gdp: -0.05 }); s.dom.scandal += 4; return '"답할 가치가 없다"고 했지만 소문은 커졌습니다.'; } },
    ] },
  youthParty: { w: 2, kind: 'politics', cond: s => s.turn >= 4, icon: '🚀',
    make: s => ({ title: '30대 창당 돌풍', desc: `${randName()} 전 스타트업 대표가 만든 신당이 2030 지지율 1위로 올라섰습니다. "기성 정치 전부 교체"를 외칩니다.` }),
    choices: [
      { label: '핵심 인사 영입 제안', desc: '청년 +6, 당 장악력 -4.', run: s => { bump(s, 'youth', 6); s.dom.unity -= 4; return '당 지도부 자리를 내주며 영입했습니다. 중진들이 불쾌해합니다.'; } },
      { label: '청년 공약 흡수', desc: '청년 +3, 재정 -0.1.', run: s => { bump(s, 'youth', 3); fx(s, { fiscal: -0.1 }); return '신당의 대표 공약을 정부 정책으로 가져왔습니다.'; } },
      { label: '찻잔 속 태풍 취급', desc: '청년 -3, 다음 선거 -1%p.', run: s => { bump(s, 'youth', -3); s.dom.campaign -= 1; return '무시했지만 신당 지지율은 더 올랐습니다.'; } },
    ] },
  wiretap: { w: 1, kind: 'security', cond: s => true, icon: '🎧',
    make: s => { const k = pick(['us', 'cn', 'ru']); return { title: `${cname(k)}의 대통령실 도청 의혹`, desc: `유출된 기밀문서에 ${cname(k)} 정보기관이 대통령실 회의를 감청한 정황이 담겨 있습니다.`, k }; },
    choices: [
      { label: '공식 항의·해명 요구', desc: '해당국 관계 -6, 지지율 +1.5.', run: (s, ev) => { relBump(s, ev.k, -6, -4); s.approval += 1.5; return `${cname(ev.k)} 대사를 초치해 강하게 항의했습니다.`; } },
      { label: '조용히 넘어감', desc: '관계 유지, 지지율 -2.', run: s => { s.approval -= 2; return '"동맹(우방) 간 신뢰에 문제없다"고 했다가 굴욕 외교 비판을 받았습니다.'; } },
      { label: '보안 체계 전면 개편', desc: '안보 +2, 국고 소요.', pc: 15, run: s => { fx(s, { security: 2 }); return '대통령실 통신망을 전면 교체하고 방첩 조직을 강화했습니다.'; } },
    ] },
  eggThrow: { w: 1, kind: 'politics', cond: s => s.approval < 50, icon: '🥚',
    make: s => ({ title: '민생 행보 중 계란 투척', desc: `${pick(['대구 서문시장', '광주 양동시장', '부산 자갈치시장', '전주 남부시장'])} 방문 중 한 시민이 대통령에게 계란을 던졌습니다. 영상이 퍼지고 있습니다.` }),
    choices: [
      { label: '선처 지시', desc: '지지율 +2.', run: s => { s.approval += 2; return '"국민의 분노도 정치인의 몫"이라며 처벌을 원치 않는다고 했습니다.'; } },
      { label: '그 시민을 직접 만남', desc: '도박: 성공하면 지지율 +4, 실패하면 -1.', pc: 4, run: s => { if (coin(0.6)) { s.approval += 4; return '자영업 폐업 사연을 듣고 함께 눈물을 흘린 장면이 화제가 됐습니다.'; } s.approval -= 1; return '"보여주기 쇼"라는 비판이 나왔습니다.'; } },
      { label: '경호 강화', desc: '자유 -1, 안전 +1.', run: s => { fx(s, { freedom: -1, safety: 1 }); return '현장 행사 경호를 대폭 강화했습니다.'; } },
    ] },

  /* ---------- 사회 ---------- */
  exam: { w: 1, kind: 'society', cond: s => turnLabel(s.turn).q === 4, icon: '📝',
    make: s => ({ title: '수능 출제 오류 파문', desc: `${pick(['국어', '수학', '영어', '과학탐구'])} 영역 한 문항에 정답이 없다는 이의 신청이 쏟아졌습니다. 50만 수험생의 당락이 걸렸습니다.` }),
    choices: [
      { label: '전원 정답 처리', desc: '교육 -1, 지지율 -0.5.', run: s => { fx(s, { education: -1 }); s.approval -= 0.5; return '해당 문항을 전원 정답 처리했습니다. 상위권 수험생들이 반발합니다.'; } },
      { label: '평가원장 경질·출제 체계 개편', desc: '교육 +1, 교원 -3.', pc: 6, run: s => { fx(s, { education: 1 }); bump(s, 'teach', -3); return '출제 시스템을 외부 검증 체계로 바꿉니다.'; } },
      { label: '오류 불인정', desc: '도박: 법원이 정부 편이면 무사, 아니면 지지율 -4.', run: s => { if (coin(0.4)) return '법원이 평가원 손을 들어줬습니다.'; s.approval -= 4; fx(s, { justice: -1 }); return '법원이 오류를 인정했습니다. 대혼란이 벌어졌습니다.'; } },
    ] },
  teacherRally: { w: 1, kind: 'society', cond: s => s.factions.teach < 55, icon: '🍎',
    make: s => ({ title: '교사 20만 명 국회 앞 집회', desc: '학부모 악성 민원에 시달리던 교사의 비극 이후, 교사들이 교권 보호 입법을 요구하며 거리로 나왔습니다.' }),
    choices: [
      { label: '교권 보호 특별법', desc: '교원 +10, 교육 +1, 자유 -0.5.', pc: 8, run: s => { bump(s, 'teach', 10); fx(s, { education: 1, freedom: -0.5 }); return '아동학대 면책·민원 대응팀 신설을 담은 특별법을 추진합니다.'; } },
      { label: '학부모·교사 대화 기구', desc: '교원 +3, 사회 통합.', run: s => { bump(s, 'teach', 3); fx(s, { happiness: 0.5 }); return '교육 3주체 협의회를 만들었습니다.'; } },
    ] },
  migrantDeath: { w: 1, kind: 'society', cond: s => true, icon: '🏭',
    make: s => ({ title: '이주노동자 집단 참사', desc: `${pick(['경기도 화성', '충남 아산', '경남 김해', '전남 영암'])}의 공장 화재로 이주노동자 다수가 숨졌습니다. 외신이 "한국의 그림자"로 보도합니다.` }),
    choices: [
      { label: '중대재해 엄정 수사', desc: '안전 +2, 기업 -5, 노동 +4.', run: s => { fx(s, { safety: 2 }); bump(s, 'biz', -5); bump(s, 'labor', 4); return '사업주를 구속 수사하고 전국 공장 일제 점검에 들어갔습니다.'; } },
      { label: '고용허가제 개편', desc: '외국 인력 처우 개선. 성장 +0.03, 재정 -0.05.', pc: 8, run: s => { fx(s, { gdp: 0.03, fiscal: -0.05, freedom: 1 }); return '사업장 변경 자유와 숙소 기준을 강화했습니다.'; } },
      { label: '유감 표명', desc: '외교 이미지 -, 지지율 -0.5.', run: s => { s.approval -= 0.5; relBump(s, 'eu', -2, -1); return '유감을 표했지만 후속 대책이 없다는 비판이 나왔습니다.'; } },
    ] },
  loneliness: { w: 1, kind: 'society', cond: s => s.stats.happiness < 50, icon: '🏚️',
    make: s => ({ title: '고독사 통계 충격', desc: '한 해 고독사가 4천 명을 넘었고, 그중 절반이 50~60대 남성이라는 통계가 나왔습니다.' }),
    choices: [
      { label: '외로움부 장관 신설', desc: '행복 +1, 재정 -0.05.', pc: 8, run: s => { fx(s, { happiness: 1, fiscal: -0.05 }); bump(s, 'elder', 3); return '영국·일본처럼 외로움 전담 장관을 두기로 했습니다.'; } },
      { label: '지자체 돌봄 연계', desc: '지방 +3, 복지 +1.', run: s => { bump(s, 'local', 3); fx(s, { welfare: 1 }); return '통·반장과 집배원이 1인 가구를 살피는 체계를 만들었습니다.'; } },
    ] },

  /* ---------- 재난 ---------- */
  earthquake: { w: 1.5, kind: 'disaster', extreme: true, cond: s => true, icon: '🌋',
    make: s => { const c = pick(['경주', '포항', '울산', '창원', '홍성']); return { title: `${c} 규모 6.${3 + Math.floor(Math.random() * 5)} 강진`, desc: `관측 사상 최대 지진이 ${c}를 덮쳤습니다. 아파트가 기울고 고속철도가 멈췄습니다. 인근 원전 단지의 안전 점검 결과에 온 국민의 눈이 쏠려 있습니다.` }; },
    choices: [
      { label: '특별재난지역·추경 편성', desc: '재정 -0.4, 지지율 +2, 행복 회복.', run: s => { fx(s, { fiscal: -0.4, happiness: 1 }); s.approval += 2; return '피해 지역을 특별재난지역으로 선포하고 추경을 편성했습니다.'; } },
      { label: '전국 내진 대개조 착수', desc: '국고 소요, 안전 +4, 건설 경기 +.', pc: 25, run: s => { fx(s, { safety: 4, gdp: 0.05 }); s.mods.safety = (s.mods.safety || 0) + 0.5; return '노후 건물·교량 내진 보강 10년 계획을 발표했습니다.'; } },
      { label: '원전 일시 정지·정밀 점검', desc: '안전 +2, 성장 -0.1, 환경 단체 호평.', run: s => { fx(s, { safety: 2, gdp: -0.1 }); return '인근 원전을 멈추고 정밀 점검에 들어갔습니다.'; } },
    ] },
  blackout: { w: 1.5, kind: 'disaster', extreme: true, cond: s => true, icon: '🔌',
    make: s => ({ title: '수도권 대정전 (블랙아웃)', desc: `${pick(['기록적 한파', '기록적 폭염', '송전망 화재', '변전소 연쇄 고장'])}로 수도권 2,600만 명이 ${pick(['6시간', '9시간', '하루'])} 넘게 전기 없이 지냈습니다. 지하철이 멈추고 반도체 공장 라인이 섰습니다.` }),
    choices: [
      { label: '원전 가동률 최대로', desc: '성장 +0.05, 환경 -1, 전력 안정.', run: s => { fx(s, { gdp: 0.05, env: -1 }); return '원전을 최대 출력으로 돌려 전력 예비율을 확보했습니다.'; } },
      { label: 'LNG 긴급 도입', desc: '국고 소요, 물가 +0.2.', pc: 20, run: s => { fx(s, { infl: 0.2 }); return '현물 시장에서 LNG를 웃돈을 주고 사 왔습니다.'; } },
      { label: '산업용 전력 순환 제한', desc: '성장 -0.2, 지지율 -1, 가정 우선.', run: s => { fx(s, { gdp: -0.2 }); s.approval -= 1; bump(s, 'biz', -6); return '공장 전력을 돌아가며 끊어 가정 전기를 지켰습니다.'; } },
    ] },
  baekdu: { w: 1, kind: 'disaster', extreme: true, cond: s => s.turn >= 6, icon: '🌋',
    make: s => ({ title: '백두산 분화 징후 포착', desc: '천지 주변 지진이 하루 수백 회로 늘고 지표가 부풀어 오르고 있습니다. 분화하면 화산재가 한반도와 일본을 덮고 항공이 마비됩니다.' }),
    choices: [
      { label: '남북·중국 공동 관측 제안', desc: '북한 관계 +6, 중국 +3, 대비 +.', pc: 10, run: s => { relBump(s, 'nk', 6, 4); relBump(s, 'cn', 3, 2); fx(s, { safety: 1 }); return '분단 이후 첫 남북 공동 화산 관측단이 꾸려졌습니다.'; } },
      { label: '전국 화산재 대비 체계', desc: '안전 +2, 재정 -0.15.', run: s => { fx(s, { safety: 2, fiscal: -0.15 }); return '방진 마스크 비축, 항공·정수장 대응 매뉴얼을 만들었습니다.'; } },
      { label: '과학계 판단 기다리기', desc: '도박: 30% 확률로 소규모 분화(성장 -0.3, 행복 -2).', run: s => { if (coin(0.3)) { fx(s, { gdp: -0.3, happiness: -2 }); s.approval -= 3; return '소규모 분화가 일어났고 화산재로 동해안 항공편이 일주일 멈췄습니다. 대비 부족 비판이 쏟아졌습니다.'; } return '활동이 잦아들었습니다.'; } },
    ] },
  reactor: { w: 1, kind: 'disaster', extreme: true, cond: s => true, icon: '☢️',
    make: s => ({ title: `${pick(['고리', '한빛', '한울', '월성'])} 원전 냉각계통 이상`, desc: '원자로 냉각수 펌프가 연쇄 고장을 일으켰습니다. 방사능 누출은 아직 없지만 인근 주민이 대피를 시작했고, 일본·중국이 정보 공개를 요구합니다.' }),
    choices: [
      { label: '즉시 정지·전면 공개', desc: '안전 +2, 성장 -0.15, 국제 신뢰 +.', run: s => { fx(s, { safety: 2, gdp: -0.15 }); relBump(s, 'jp', 3, 2); relBump(s, 'cn', 3, 2); return '원자로를 정지하고 실시간 방사선 수치를 공개했습니다.'; } },
      { label: 'IAEA 조사 요청', desc: '국고 소요, 사법·국제 신뢰 +.', pc: 10, run: s => { fx(s, { justice: 1, safety: 1 }); relBump(s, 'eu', 3, 2); return '국제원자력기구 조사단이 도착했습니다.'; } },
      { label: '"안전하다" 발표하고 계속 가동', desc: '도박: 80%는 무사, 20%는 은폐 논란(지지율 -8).', run: s => { if (coin(0.8)) { fx(s, { gdp: 0.05 }); return '펌프가 복구됐고 전력 공급도 지켰습니다.'; } s.approval -= 8; fx(s, { justice: -3, safety: -3 }); s.dom.scandal += 15; return '내부 고발로 초기 수치 축소 사실이 드러났습니다. 은폐 의혹이 정권을 덮쳤습니다.'; } },
    ] },
  bridge: { w: 1, kind: 'disaster', cond: s => s.stats.safety < 85, icon: '🌉',
    make: s => ({ title: `${pick(['분당', '대구', '청주', '인천'])} 도심 교량 붕괴`, desc: '출근길 교량 일부가 무너져 차량 여러 대가 추락했습니다. 30년 전 준공된 교량이었습니다.' }),
    choices: [
      { label: '노후 인프라 전수 점검', desc: '안전 +3, 국고 소요.', pc: 15, run: s => { fx(s, { safety: 3 }); return '전국 노후 교량·터널 1만여 곳을 긴급 점검합니다.'; } },
      { label: '지자체 책임 추궁', desc: '지방 -5, 지지율 +0.5.', run: s => { bump(s, 'local', -5); s.approval += 0.5; return '관리 주체인 지자체에 대한 감사를 지시했습니다.'; } },
    ] },

  /* ---------- 안보 ---------- */
  cyberAttack: { w: 1.5, kind: 'security', extreme: true, cond: s => true, icon: '💻',
    make: s => ({ title: '국가 전산망 마비', desc: `${pick(['정체불명의 해커 조직', '북한 연계 해킹 그룹', '국제 랜섬웨어 조직'])}이 정부 행정망과 ${pick(['주요 은행', '공항 관제 시스템', '병원 전산', '철도 예매'])}을 동시에 마비시켰습니다. 복구 대가로 비트코인을 요구합니다.` }),
    choices: [
      { label: '몸값 지불하고 즉시 복구', desc: '국고 소요, 빠른 복구, 나쁜 선례.', pc: 15, run: s => { fx(s, { security: -1 }); return '비공개로 대가를 치르고 시스템을 되살렸습니다. 다음 공격의 표적이 될 수 있습니다.'; } },
      { label: '자체 복구 강행', desc: '성장 -0.15, 행복 -1, 원칙 고수.', run: s => { fx(s, { gdp: -0.15, happiness: -1, security: 1 }); return '열흘 걸려 백업으로 복구했습니다. 국민 불편이 컸습니다.'; } },
      { label: '동맹과 반격 작전', desc: '안보 +2, 미국 +3. 50% 확률로 배후 색출(북한 관계 -6).', pc: 10, run: s => { fx(s, { security: 2 }); relBump(s, 'us', 3, 2); if (coin(0.5)) { relBump(s, 'nk', -6, -4); return '한미 사이버사령부가 공격 서버를 무력화하고 배후를 공개했습니다.'; } return '서버는 무력화했지만 배후는 끝내 밝히지 못했습니다.'; } },
    ] },
  defectors: { w: 1, kind: 'security', extreme: true, cond: s => !s.annexed?.nk, icon: '🚤',
    make: s => ({ title: '북한 주민 대규모 해상 탈북', desc: `목선 ${10 + Math.floor(Math.random() * 30)}척에 나눠 탄 북한 주민 ${300 + Math.floor(Math.random() * 900)}명이 동해 NLL을 넘어왔습니다. 북한은 "납치"라며 송환을 요구하고 해안포 포문을 열었습니다.` }),
    choices: [
      { label: '전원 수용', desc: '북한 관계 -10, 재정 -0.1, 인권 평가 +.', run: s => { relBump(s, 'nk', -10, -6); fx(s, { fiscal: -0.1, freedom: 1 }); relBump(s, 'us', 2, 1); bump(s, 'con', 4); return '"자유를 찾아온 국민"이라며 전원을 받아들였습니다.'; } },
      { label: '원하는 사람만 송환', desc: '북한 관계 +2, 인권 단체 반발.', run: s => { relBump(s, 'nk', 2, 2); bump(s, 'con', -3); return '개별 의사를 확인해 귀환 희망자만 판문점으로 돌려보냈습니다.'; } },
      { label: '경계 태세 격상 후 수용', desc: '안보 +2, 국고 소요, 북한 관계 -8.', pc: 10, run: s => { fx(s, { security: 2 }); relBump(s, 'nk', -8, -5); return '전군 경계 태세를 올린 뒤 전원 수용했습니다.'; } },
    ] },
  spyRing: { w: 1, kind: 'security', cond: s => true, icon: '🕵️',
    make: s => { const k = pick(['cn', 'ru', 'nk']); return { title: `${cname(k)} 연계 산업스파이 조직 적발`, desc: `${pick(['반도체 공정', '방산 레이더', '배터리 소재', '조선 설계'])} 기술을 빼돌린 조직이 적발됐습니다. 현직 연구원도 포함돼 있습니다.`, k }; },
    choices: [
      { label: '간첩법 적용 범위 확대', desc: '안보 +2, 자유 -1, 해당국 관계 -4.', run: (s, ev) => { fx(s, { security: 2, freedom: -1 }); relBump(s, ev.k, -4, -3); return '외국 정보기관 전반으로 간첩죄 적용을 넓혔습니다.'; } },
      { label: '외교관 추방', desc: '해당국 관계 -8, 지지율 +1.', run: (s, ev) => { relBump(s, ev.k, -8, -5); s.approval += 1; return `${cname(ev.k)} 외교관을 기피 인물로 지정해 추방했습니다.`; } },
      { label: '조용히 기소', desc: '관계 유지, 혁신 -1.', run: s => { fx(s, { innovation: -1 }); return '외교 문제로 키우지 않고 사법 절차만 밟았습니다.'; } },
    ] },

  /* ---------- 경제 ---------- */
  bankRun: { w: 1, kind: 'economy', extreme: true, cond: s => s.stats.gdp < 2.2 || s.stats.housing < 50, icon: '🏦',
    make: s => ({ title: `${pick(['새마을금고', '지방 저축은행', '중형 증권사'])} 뱅크런`, desc: '부동산 PF 손실설이 SNS로 퍼지며 하루 만에 수조 원이 빠져나갔습니다. 번호표를 받으려는 줄이 지점마다 수백 미터입니다.' }),
    choices: [
      { label: '예금 전액 보장 선언', desc: '재정 -0.3, 채무 +1.5, 즉시 진정.', run: s => { fx(s, { fiscal: -0.3, debt: 1.5 }); s.approval += 1; return '"예금 한 푼도 잃지 않게 하겠다"는 담화로 인출 행렬이 멈췄습니다.'; } },
      { label: '우량 금융사 인수 주선', desc: '국고 소요, 성장 -0.05.', pc: 12, run: s => { fx(s, { gdp: -0.05 }); bump(s, 'biz', 2); return '대형 은행이 부실 금융사를 인수하도록 주선했습니다.'; } },
      { label: '시장 원칙대로', desc: '도박: 50%는 진정, 50%는 금융위기(성장 -0.6).', run: s => { if (coin(0.5)) { bump(s, 'con', 3); return '자체 유동성으로 버텨냈습니다. 도덕적 해이를 막았다는 평가입니다.'; } fx(s, { gdp: -0.6, unemp: 0.4 }); s.approval -= 5; return '연쇄 뱅크런이 번졌습니다. 금융위기입니다.'; } },
    ] },
  tariffWin: { w: 1, kind: 'good', cond: s => s.rel.us > 60, icon: '🤝',
    make: s => ({ title: '미국, 한국산 배터리 관세 면제', desc: '미국 의회가 한국산 배터리·전력기기를 동맹 공급망으로 지정했습니다. 대미 수출 기업 주가가 급등합니다.' }),
    choices: [
      { label: '미국 현지 공장 증설 지원', desc: '미국 +4, 성장 +0.1, 국내 일자리 -.', run: s => { relBump(s, 'us', 4, 2); fx(s, { gdp: 0.1, unemp: 0.1 }); return '현지 공장 증설로 시장을 굳혔습니다.'; } },
      { label: '국내 생산 기지 강화', desc: '성장 +0.06, 고용 개선, 국고 소요.', pc: 10, run: s => { fx(s, { gdp: 0.06, unemp: -0.15 }); bump(s, 'labor', 3); return '국내 라인을 늘려 수출 물량을 대기로 했습니다.'; } },
    ] },
  unicorn: { w: 1, kind: 'tech', cond: s => s.stats.innovation > 65, icon: '🤖',
    make: s => ({ title: '국내 AI 모델 세계 1위', desc: `${pick(['판교', '성수동', '대전 대덕'])}의 스타트업이 만든 한국어·다국어 AI 모델이 국제 평가 1위에 올랐습니다. 빅테크가 인수를 제안했습니다.` }),
    choices: [
      { label: '국가 AI 컴퓨팅 지원', desc: '국고 소요, 혁신 +3.', pc: 15, run: s => { fx(s, { innovation: 3 }); s.mods.innovation = (s.mods.innovation || 0) + 0.3; bump(s, 'youth', 3); return 'GPU 클러스터와 공공 데이터를 지원하기로 했습니다.'; } },
      { label: '해외 매각 허용', desc: '성장 +0.05, 혁신 -1.', run: s => { fx(s, { gdp: 0.05, innovation: -1 }); return '시장 판단에 맡겼고, 회사는 해외에 팔렸습니다.'; } },
      { label: '규제 샌드박스 확대', desc: '혁신 +2, 자유 +1.', run: s => { fx(s, { innovation: 2, freedom: 1 }); bump(s, 'biz', 3); return 'AI 서비스 규제를 대폭 풀었습니다.'; } },
    ] },
  satellite: { w: 1, kind: 'tech', cond: s => s.turn >= 4, icon: '🛰️',
    make: s => ({ title: '누리호 후속 발사체 발사 실패', desc: '차세대 발사체가 2단 분리 직후 폭발했습니다. 국가 우주 계획 전체가 흔들립니다.' }),
    choices: [
      { label: '예산 유지·재도전', desc: '혁신 +1, 국고 소요.', pc: 10, run: s => { fx(s, { innovation: 1 }); return '"실패는 데이터"라며 1년 뒤 재발사를 약속했습니다.'; } },
      { label: '민간 우주기업에 이관', desc: '혁신 +2, 재정 +0.05.', run: s => { fx(s, { innovation: 2, fiscal: 0.05 }); bump(s, 'biz', 3); return '발사체 사업을 민간 주도로 넘겼습니다.'; } },
      { label: '사업 재검토', desc: '재정 +0.1, 혁신 -2.', run: s => { fx(s, { fiscal: 0.1, innovation: -2 }); return '우주 예산을 대폭 줄였습니다.'; } },
    ] },

  /* ---------- 희소식 ---------- */
  worldCup: { w: 1, kind: 'good', cond: s => turnLabel(s.turn).q === 2 || turnLabel(s.turn).q === 3, icon: '⚽',
    make: s => ({ title: `${pick(['월드컵 4강 진출', '올림픽 종합 5위', 'WBC 우승', '세계선수권 금메달 싹쓸이'])}!`, desc: '전국이 열광했습니다. 거리 응원 인파가 광장을 가득 메웠습니다.' }),
    choices: [
      { label: '임시공휴일 선포', desc: '행복 +3, 지지율 +2, 성장 -0.03.', run: s => { fx(s, { happiness: 3, gdp: -0.03 }); s.approval += 2; return '임시공휴일을 선포했습니다.'; } },
      { label: '생활체육 투자', desc: '건강 +1, 국고 소요.', pc: 8, run: s => { fx(s, { health: 1, happiness: 1 }); return '동네 체육 시설 확충을 약속했습니다.'; } },
      { label: '선수단 청와대 초청만', desc: '지지율 +0.5.', run: s => { s.approval += 0.5; return '선수단을 초청해 격려했습니다.'; } },
    ] },
  hallyu: { w: 1, kind: 'good', cond: s => true, icon: '🎬',
    make: s => ({ title: `한국 ${pick(['영화', '드라마', '웹툰 원작 애니', '아이돌 그룹'])}, ${pick(['아카데미 작품상', '에미상 석권', '빌보드 1위 10주', '칸 황금종려상'])}`, desc: '전 세계가 한국 콘텐츠에 주목합니다. 관광 예약이 폭증합니다.' }),
    choices: [
      { label: '콘텐츠 펀드 조성', desc: '국고 소요, 성장 +0.05, 청년 +3.', pc: 10, run: s => { fx(s, { gdp: 0.05 }); bump(s, 'youth', 3); return '콘텐츠 정책 펀드를 만들었습니다.'; } },
      { label: '문화 외교에 활용', desc: '주요국 관계 +2.', run: s => { for (const k of ['us', 'jp', 'eu', 'cn']) relBump(s, k, 2, 1); return '정상 외교 무대에 한류를 앞세웠습니다.'; } },
    ] },
});

// 기존 사건 배너 종류 지정, 뻔한 사건은 덜 나오게
for (const k of ['oppProtest', 'factionFeud', 'scandal', 'hearing', 'popularity', 'rival', 'coopOffer', 'defection', 'rally', 'nomination', 'speaker']) if (DOM_EVENTS[k]) DOM_EVENTS[k].kind = DOM_EVENTS[k].kind || 'politics';
DOM_EVENTS.scandal.cond = s => s.dom.scandal > 30;
DOM_EVENTS.scandal.w = 1.5;
DOM_EVENTS.hearing.w = 1;
DOM_EVENTS.popularity.w = 1;

// 최근에 나온 사건은 12분기 동안 다시 나오지 않음, 한 번도 안 나온 사건은 조금 더 잘 나옴
const EVENT_COOLDOWN = 12;
function domEventWeight(s, key, e) {
  const seen = s.dom.seen?.[key];
  if (seen != null && s.turn - seen < (key === 'terrRevolt' ? 3 : key === 'govProposal' ? 0 : EVENT_COOLDOWN)) return 0;
  return e.w * (seen == null ? 1.3 : 1);
}
