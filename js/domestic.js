/* =========================================================
 *  국내 정치: 정치 인물, 당 장악력·야당 협조도, 대통령의 정치 행동, 정치 사건 카드
 * ========================================================= */
const PARTY_COLOR = { L: '#2a6fdb', R: '#d6393f', N: '#9aa3b5', P: '#8a5cc7' };
const BLOC_NAME = { L: '진보 정당', R: '보수 정당', N: '군소·무소속', P: '대통령 신당' };
const oppBloc = s => s.ruling === 'L' ? 'R' : s.ruling === 'R' ? 'L' : (s.seats.L >= s.seats.R ? 'L' : 'R');
const rulingSeats = s => s.ruling === 'P' ? s.seats.P : s.seats[s.ruling];

function newFigures() {
  return { ruling: randName(), opp: randName(), oppStyle: Math.random() < 0.5 ? '강경' : '온건', speaker: randName(), aide: randName() };
}

/* ---------------- 표결 보정: 여당 이탈표·야당 협조 ---------------- */
function domVoteAdj(s, bloc, p) {
  const d = s.dom; if (!d) return p;
  if (bloc === s.ruling) return clamp(p * (0.82 + d.unity / 550), 0, 0.99);
  const coop = d.coop > 0 ? 0.12 : 0;
  if (bloc === oppBloc(s)) return clamp(p + (d.oppMood - 40) / 250 + coop, 0, 0.95);
  return clamp(p + (d.oppMood - 40) / 400 + coop / 2, 0, 0.95);
}

/* ---------------- 대통령의 정치 행동 ---------------- */
const POL_ACTIONS = [
  { id: 'speech', name: '대국민 담화', icon: '🎙️', pc: 15, cd: 2, desc: '국민에게 직접 호소합니다. 지지율 +2~4.',
    run: s => { const g = (2 + Math.random() * 2) * (s.approval < 35 ? 1.3 : 1); s.approval = clamp(s.approval + g, 0, 100); return `대국민 담화로 지지율이 ${g.toFixed(1)}%p 올랐습니다.`; } },
  { id: 'summit', name: '영수회담', icon: '🤝', pc: 20, cd: 4, desc: '야당 대표와 마주 앉습니다. 성공하면 야당 협조도↑, 2분기 동안 법안 처리 협조.',
    run: s => { const d = s.dom, ok = Math.random() < (d.figures.oppStyle === '온건' ? 0.85 : 0.55);
      if (ok) { d.oppMood = clamp(d.oppMood + 18, 0, 100); d.coop = 2; return `${d.figures.opp} 야당 대표와 영수회담에서 민생 법안 협력에 합의했습니다.`; }
      d.oppMood = clamp(d.oppMood - 3, 0, 100); s.approval = clamp(s.approval - 0.5, 0, 100); return `영수회담이 빈손으로 끝났습니다. ${d.figures.opp} 대표: "보여주기식 회담이었다."`; } },
  { id: 'party', name: '당정협의', icon: '🏛️', pc: 12, cd: 1, desc: '여당 지도부와 정책을 조율합니다. 당 장악력 +8.',
    run: s => { s.dom.unity = clamp(s.dom.unity + 8, 0, 100); return `${s.dom.figures.ruling} 여당 대표와 당정협의를 열어 당의 결속을 다졌습니다.`; } },
  { id: 'reshuffle', name: '개각', icon: '🔄', pc: 25, cd: 6, desc: '장관 3명을 교체합니다. 지지율 +3, 측근 리스크 해소. 청문회로 야당 협조도 소폭↓.',
    run: s => { s.approval = clamp(s.approval + 3, 0, 100); s.dom.scandal = Math.max(0, s.dom.scandal - 15); s.dom.oppMood = clamp(s.dom.oppMood - 3, 0, 100);
      const cats = Object.keys(s.cabinet || {}).sort(() => Math.random() - 0.5).slice(0, 3); cats.forEach(c => delete s.cabinet[c]);
      return '국정 쇄신을 위한 개각을 단행했습니다.'; } },
  { id: 'tour', name: '민생 현장 방문', icon: '🚶', pc: 10, cd: 1, desc: '전통시장·산업 현장을 찾습니다. 지지율 +0.8, 지방·농어민 지지↑.',
    run: s => { const place = ['광주 양동시장', '대구 서문시장', '부산 자갈치시장', '울산 조선소', '평택 반도체 공장', '전남 농촌 마을', '강원 산불 피해 지역', '서울 청년 창업센터'][Math.floor(Math.random() * 8)];
      s.approval = clamp(s.approval + 0.8, 0, 100); s.factions.local = clamp(s.factions.local + 4, 0, 100); s.factions.farm = clamp(s.factions.farm + 2, 0, 100); return `${place}을(를) 찾아 민심을 들었습니다.`; } },
  { id: 'campaign', name: '선거 지원', icon: '📣', pc: 20, cd: 1, desc: '다가오는 선거(2분기 이내)에 힘을 싣습니다. 여당 득표 +3%p.',
    can: s => nextElections(s).some(e => e.left <= 2) ? null : '2분기 안에 치러지는 선거가 없습니다.',
    run: s => { s.dom.campaign = (s.dom.campaign || 0) + 3; return '여당 후보 지원 유세에 나섰습니다. 야당은 "관권 선거"라며 반발합니다.'; } },
];
function polAction(s, id) {
  const a = POL_ACTIONS.find(x => x.id === id), d = s.dom;
  const why = a.can?.(s) || ((d.cd[id] || 0) > s.turn ? `${d.cd[id] - s.turn}분기 후에 다시 할 수 있습니다.` : null);
  if (why) return { ok: false, msg: why };
  if (s.pcap < a.pc) return { ok: false, msg: `국고 ${won(a.pc)}이 필요합니다.` };
  s.pcap -= a.pc; d.cd[id] = s.turn + a.cd;
  const msg = a.run(s);
  addLog(s, 'info', `${a.icon} ${msg}`);
  return { ok: true, msg };
}

/* ---------------- 선거 일정 ---------------- */
function nextElections(s) {
  const t = s.turn, nextOf = (first, every) => t <= first ? first : first + Math.ceil((t - first) / every) * every;
  const g = nextOf(GENERAL_ELECTION_TURN, 16), l = nextOf(LOCAL_ELECTION_TURN, 16), p = (s.termStart || 0) + TERM_TURNS;
  return [
    { name: `제${23 + (g - GENERAL_ELECTION_TURN) / 16}대 총선`, turn: g, left: g - t },
    { name: `제${9 + (l - LOCAL_ELECTION_TURN) / 16}회 지방선거`, turn: l, left: l - t },
    { name: `제${(s.presidentNo || 21) + 1}대 대선`, turn: p, left: p - t },
  ].sort((a, b) => a.left - b.left);
}

/* ---------------- 정치 사건 ---------------- */
// 각 사건: cond(s) 발생 조건, w 가중치, make(s) 표시 정보, choices[{label, desc, pc?, run(s, ev) → 결과 문장}]
const facBase = s => s.ruling === 'L' ? 'lib' : s.ruling === 'R' ? 'con' : 'youth';
const bump = (s, k, v) => { if (s.factions[k] != null) s.factions[k] = clamp(s.factions[k] + v, 0, 100); };
const DOM_EVENTS = {
  oppProtest: { w: 3, cond: s => s.dom.oppMood < 32, icon: '📢',
    make: s => ({ title: `${s.dom.figures.opp} 야당 대표, 장외투쟁 선언`, desc: `야당이 국회 일정을 전면 거부하고 거리로 나섰습니다. 계류 법안 처리가 멈출 위기입니다.` }),
    choices: [
      { label: '영수회담 제안', desc: '야당 협조도 +15, 1분기 협치. 당내 강경파 불만.', pc: 15, run: s => { s.dom.oppMood += 15; s.dom.coop = Math.max(s.dom.coop, 1); s.dom.unity -= 3; return '야당이 국회로 복귀했습니다.'; } },
      { label: '원칙 대응', desc: '지지층 결집, 야당 협조도 -6.', run: s => { bump(s, facBase(s), 3); s.dom.oppMood -= 6; s.approval -= 0.5; return '"국회를 버린 것은 야당"이라며 원칙론을 고수했습니다.'; } },
      { label: '국민께 직접 호소', desc: '지지율 +1.5.', pc: 10, run: s => { s.approval += 1.5; s.dom.oppMood -= 2; return '대국민 메시지로 여론전에 나섰습니다.'; } },
    ] },
  factionFeud: { w: 3, cond: s => s.dom.unity < 55, icon: '⚔️',
    make: s => ({ title: '여당 내 계파 갈등 격화', desc: `비주류 의원들이 "청와대 거수기 정당"이라며 지도부를 공개 비판했습니다. ${s.dom.figures.ruling} 대표 체제가 흔들립니다.` }),
    choices: [
      { label: '비주류 끌어안기', desc: '당 장악력 +12.', pc: 12, run: s => { s.dom.unity += 12; return '비주류 중진들과 만찬을 열어 갈등을 봉합했습니다.'; } },
      { label: '친정 체제 강화', desc: '당 장악력 +6. 일부 의원 반발로 탈당 가능.', run: s => { s.dom.unity += 6; s.approval -= 1; if (s.dom.unity < 45 && s.ruling !== 'P') { const n = 3 + Math.floor(Math.random() * 5); s.seats[s.ruling] -= n; s.seats.N += n; return `측근을 당 요직에 앉혔습니다. 반발한 의원 ${n}명이 탈당했습니다.`; } return '측근을 당 요직에 앉혀 당을 장악했습니다.'; } },
      { label: '당무에서 거리 두기', desc: '당 장악력 -6, 탈정치 이미지로 지지율 +1.', run: s => { s.dom.unity -= 6; s.approval += 1; return '"당의 일은 당이 알아서"라며 거리를 뒀습니다.'; } },
    ] },
  scandal: { w: 2, cond: s => s.dom.scandal > 25 || Math.random() < 0.05, icon: '🗞️',
    make: s => ({ title: `대통령 측근 ${s.dom.figures.aide} 비리 의혹 보도`, desc: '대통령실 핵심 인사가 기업 청탁을 받았다는 의혹이 언론에 보도됐습니다. 야당은 특검을 요구합니다.' }),
    choices: [
      { label: '특검 수용', desc: '지지율 -2, 사법 신뢰↑, 리스크 해소, 야당 협조도↑.', run: s => { s.approval -= 2; s.stats.justice += 2; s.dom.scandal = 0; s.dom.oppMood += 6; s.dom.figures.aide = randName(); return '특검을 수용했습니다. "성역 없는 수사"를 약속했습니다.'; } },
      { label: '측근 즉각 경질', desc: '지지율 +1, 리스크 감소, 당내 일부 반발.', pc: 10, run: s => { s.approval += 1; s.dom.scandal = Math.max(0, s.dom.scandal - 15); s.dom.unity -= 3; s.dom.figures.aide = randName(); return '의혹 당사자를 즉시 경질했습니다.'; } },
      { label: '정면 반박', desc: '도박: 사실무근이 밝혀지면 지지율↑, 아니면 크게↓.', run: s => { if (Math.random() < 0.5) { s.approval += 1.5; s.dom.scandal = 0; return '보도가 사실무근으로 드러났습니다. 정정 보도가 나왔습니다.'; } s.approval -= 6; s.dom.scandal += 10; return '추가 증거가 나오며 여론이 싸늘하게 돌아섰습니다.'; } },
    ] },
  hearing: { w: 2, cond: s => true, icon: '🎤',
    make: s => ({ title: '장관 후보자 인사청문회 파행', desc: '새 장관 후보자의 부동산 투기·자녀 특혜 의혹이 불거져 청문회가 파행됐습니다.' }),
    choices: [
      { label: '임명 강행', desc: '야당 협조도 -10, 지지율 -1.5.', run: s => { s.dom.oppMood -= 10; s.approval -= 1.5; return '청문보고서 채택 없이 임명을 강행했습니다.'; } },
      { label: '지명 철회', desc: '지지율 +1, 당내 장악력 -2.', run: s => { s.approval += 1; s.dom.unity -= 2; return '국민 눈높이에 맞지 않는다며 지명을 철회했습니다.'; } },
    ] },
  popularity: { w: 2, cond: s => s.approval >= 58, icon: '📈',
    make: s => ({ title: '국정 지지율 고공행진', desc: `지지율 ${s.approval.toFixed(0)}%. 여권에서는 "지금이 개혁의 골든타임"이라는 말이 나옵니다.` }),
    choices: [
      { label: '개혁 드라이브', desc: '예비비 확보: 국고 +₩3조, 야당 반발.', run: s => { s.pcap += 30; s.dom.oppMood -= 5; return '높은 지지를 바탕으로 개혁 과제를 밀어붙이기로 했습니다.'; } },
      { label: '협치 제안', desc: '야당 협조도 +12, 1분기 협치.', run: s => { s.dom.oppMood += 12; s.dom.coop = Math.max(s.dom.coop, 1); return '야당에 국정 협력을 제안했습니다.'; } },
      { label: '당 정비', desc: '당 장악력 +10, 다음 선거 득표 +2%p.', run: s => { s.dom.unity += 10; s.dom.campaign += 2; return '선거에 대비해 당 조직을 정비했습니다.'; } },
    ] },
  rival: { w: 2, cond: s => termInfo(s).year >= 4, icon: '👑',
    make: s => ({ title: `여당 대표 ${s.dom.figures.ruling}, 차기 대권 행보`, desc: '임기 말, 여당 대표가 대통령과 차별화하며 대선 주자로 나서고 있습니다.' }),
    choices: [
      { label: '견제', desc: '당 장악력 -8, 국고 +₩1.5조(당 몫 예산 회수).', run: s => { s.dom.unity -= 8; s.pcap += 15; return '국정 주도권을 놓지 않겠다는 신호를 보냈습니다.'; } },
      { label: '힘 실어주기', desc: '당 장악력 +10, 대선 득표 +3%p, 국고 -₩1조.', run: s => { s.dom.unity += 10; s.dom.campaign += 3; s.pcap -= 10; return '정권 재창출을 위해 차기 주자에게 힘을 실었습니다.'; } },
    ] },
  coopOffer: { w: 2, cond: s => s.dom.oppMood > 58, icon: '🕊️',
    make: s => ({ title: `${s.dom.figures.opp} 야당 대표, 민생 협치 제안`, desc: '야당이 민생 법안 일괄 처리를 위한 여야정 협의체를 제안했습니다.' }),
    choices: [
      { label: '수락', desc: '3분기 협치(법안 처리↑), 지지층 일부 실망.', run: s => { s.dom.coop = 3; s.dom.oppMood += 8; bump(s, facBase(s), -3); s.approval += 1; return '여야정 협의체가 출범했습니다.'; } },
      { label: '거절', desc: '야당 협조도 -10.', run: s => { s.dom.oppMood -= 10; return '"진정성이 없다"며 제안을 거절했습니다.'; } },
    ] },
  defection: { w: 4, cond: s => s.dom.unity < 32 && s.ruling !== 'P', icon: '🚪',
    make: s => ({ title: '여당 의원 집단 탈당 움직임', desc: '대통령의 당 운영에 반발한 의원들이 신당 창당을 거론하며 탈당을 예고했습니다.' }),
    choices: [
      { label: '설득', desc: '70% 확률로 막아냅니다.', pc: 20, run: s => { if (Math.random() < 0.7) { s.dom.unity += 8; return '중진들을 일일이 만나 탈당을 막았습니다.'; } const n = 6 + Math.floor(Math.random() * 8); s.seats[s.ruling] -= n; s.seats.N += n; return `설득에 실패했습니다. 의원 ${n}명이 탈당했습니다.`; } },
      { label: '보내준다', desc: '의석을 잃지만 당은 단단해집니다.', run: s => { const n = 8 + Math.floor(Math.random() * 10); s.seats[s.ruling] -= n; s.seats.N += n; s.dom.unity += 14; return `의원 ${n}명이 탈당해 신당을 차렸습니다. 남은 당은 오히려 결속했습니다.`; } },
    ] },
  rally: { w: 2, cond: s => s.approval < 32, icon: '🔥',
    make: s => ({ title: '광화문 대규모 정권 규탄 집회', desc: `지지율 ${s.approval.toFixed(0)}%. 주말마다 수십만 명이 광장에 모여 국정 쇄신을 요구하고 있습니다.` }),
    choices: [
      { label: '대국민 사과', desc: '지지율 +3, 당 장악력 -3.', run: s => { s.approval += 3; s.dom.unity -= 3; bump(s, facBase(s), -2); return '대통령이 직접 고개를 숙였습니다.'; } },
      { label: '정면 돌파', desc: '지지층 결집, 지지율 -1.', run: s => { s.approval -= 1; bump(s, facBase(s), 4); s.dom.oppMood -= 4; return '"흔들리지 않고 국정을 챙기겠다"며 정면 돌파를 택했습니다.'; } },
      { label: '국정 쇄신 개각', desc: '지지율 +3, 리스크 해소.', pc: 25, run: s => { s.approval += 3; s.dom.scandal = 0; s.cabinet = {}; return '총리를 포함한 전면 개각을 단행했습니다.'; } },
    ] },
  nomination: { w: 6, cond: s => nextElections(s).some(e => /총선/.test(e.name) && e.left === 2), icon: '📝',
    make: s => ({ title: '총선 공천 갈등', desc: '총선을 앞두고 여당 공천을 둘러싼 계파 싸움이 시작됐습니다.' }),
    choices: [
      { label: '전략 공천', desc: '당 장악력 -10, 총선 득표 +4%p.', run: s => { s.dom.unity -= 10; s.dom.campaign += 4; return '경쟁력 있는 인사를 전략 공천했습니다. 낙천자들이 반발합니다.'; } },
      { label: '상향식 경선', desc: '당 장악력 +8, 총선 득표 +1%p.', run: s => { s.dom.unity += 8; s.dom.campaign += 1; return '전 지역 경선 원칙을 지켰습니다.'; } },
    ] },
  speaker: { w: 3, cond: s => (s.bills || []).some(b => b.turns >= 3 && b.progress < 70), icon: '🔨',
    make: s => { const b = s.bills.find(x => x.turns >= 3 && x.progress < 70); return { title: `국회의장 ${s.dom.figures.speaker}의 중재안`, desc: `오래 표류 중인 '${policyById(b.pid, s)?.name}' 법안에 대해 국회의장이 여야 절충안을 내놨습니다.`, bill: b.id }; },
    choices: [
      { label: '수용', desc: '법안 심의 +35%, 야당 협조도 +5.', run: (s, ev) => { const b = s.bills.find(x => x.id === ev.bill); if (b) b.progress = Math.min(99, b.progress + 35); s.dom.oppMood += 5; return '중재안을 받아들여 법안이 물꼬를 텄습니다.'; } },
      { label: '거부', desc: '야당 협조도 -5.', run: s => { s.dom.oppMood -= 5; return '원안 처리를 고수했습니다.'; } },
    ] },
};

function domEventView(s, ev) { const d = DOM_EVENTS[ev.key]; return { ...d, ...ev, choices: d.choices }; }
function resolveDomEvent(s, id, i) {
  const ev = s.dom.pending.find(x => x.id === id); if (!ev) return null;
  const c = DOM_EVENTS[ev.key].choices[i];
  if (c.pc && s.pcap < c.pc) return { ok: false, msg: `국고 ${won(c.pc)}이 필요합니다.` };
  if (c.pc) s.pcap -= c.pc;
  const text = c.run(s, ev);
  const d = s.dom; d.unity = clamp(d.unity, 0, 100); d.oppMood = clamp(d.oppMood, 0, 100); s.approval = clamp(s.approval, 0, 100);
  d.pending = d.pending.filter(x => x !== ev);
  addLog(s, 'info', `${DOM_EVENTS[ev.key].icon} [${ev.title}] ${c.label}: ${text}`);
  return { ok: true, text, choice: c.label, title: ev.title, icon: DOM_EVENTS[ev.key].icon };
}

/* ---------------- 분기 처리 ---------------- */
function domesticTurn(s, report) {
  const d = s.dom, T = termInfo(s);
  d.unity = clamp(d.unity + ((55 + (s.approval - 40) * 0.7 - (T.year >= 5 ? 10 : 0)) - d.unity) * 0.15 + gauss() * 1.5, 0, 100);
  d.oppMood = clamp(d.oppMood + ((38 - (s.approval - 50) * 0.15 + (d.figures.oppStyle === '온건' ? 8 : -6) + (d.coop > 0 ? 6 : 0)) - d.oppMood) * 0.15 + gauss() * 1.5, 0, 100);
  if (d.coop > 0) d.coop--;
  d.scandal = clamp(d.scandal + Math.random() * 4 - (s.stats.justice - 41) * 0.05, 0, 60);
  // 정치 사건: 미처리 사건이 없을 때 분기마다 한 건 정도
  if (!d.pending.length && Math.random() < 0.6) {
    const pool = Object.entries(DOM_EVENTS).filter(([k, e]) => { try { return e.cond(s); } catch { return false; } });
    if (pool.length) {
      let r = Math.random() * pool.reduce((a, [, e]) => a + e.w, 0);
      const [key] = pool.find(([, e]) => (r -= e.w) <= 0) || pool[0];
      const view = DOM_EVENTS[key].make(s);
      d.pending.push({ id: uid(), key, turn: s.turn, ...view });
    }
  }
  report.domEvents = d.pending.map(x => x.id);
}

HOOKS.migrate.push(s => {
  if (!s.dom) s.dom = { unity: 70, oppMood: 40, coop: 0, scandal: 5, campaign: 0, cd: {}, pending: [], figures: newFigures() };
  if (!s.presidentNo) s.presidentNo = 21;
  if (s.termStart == null) s.termStart = 0;
  if (!s.partyTerms) s.partyTerms = 1;
});
HOOKS.postTurn.push(domesticTurn);
HOOKS.succession.push((s, r) => {
  const f = s.dom.figures;
  s.dom.figures = { ...newFigures(), speaker: f.speaker };
  s.dom.unity = 72; s.dom.oppMood = 42; s.dom.coop = 0; s.dom.scandal = 0; s.dom.pending = [];
});
