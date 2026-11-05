/* =========================================================
 *  Claude AI 연동 (선택 사항)
 *  - API 키를 넣으면 Claude가 직접 정책 효과 분석, 위기 해결 판단, 분기 논평을 수행
 *  - 키가 없거나 오류가 나면 규칙 기반 AI 참모(engine.js)로 자동 대체
 *  - API 키는 이 브라우저의 localStorage에만 저장되며 Anthropic API로만 전송됨
 *  - claude.ai 아티팩트로 열면 API 키 없이 보는 사람의 Claude 계정(sample 기능)으로 동작
 * ========================================================= */

const ClaudeAI = (() => {
  // 로컬 번들(js/vendor) 우선, 실패 시 CDN
  const SDK_LOCAL = new URL('vendor/anthropic-sdk.mjs', (document.currentScript && document.currentScript.src) || location.href).href;
  const SDK_CDN = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.135.0/+esm';
  const CFG_KEY = 'newkorea_claude_cfg';
  let client = null, clientKey = null, sdkPromise = null;

  const MODELS = [
    { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (기본·고품질)' },
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (빠름)' },
    { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (가장 빠르고 저렴)' },
  ];

  function cfg() {
    try { return { model: 'claude-opus-5-5', effort: 'low', ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') }; }
    catch { return { model: 'claude-opus-5-5', effort: 'low' }; }
  }
  function setCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch {} client = null; }
  // claude.ai 아티팩트 환경: 보는 사람의 Claude 계정으로 호출 (API 키 불필요)
  let sampleFn = null, sampleDenied = false;
  const onReady = [];
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('sample').then(fn => { sampleFn = fn || null; onReady.forEach(f => { try { f(); } catch {} }); }).catch(() => {});
  }
  function hostMode() { return !!sampleFn && !sampleDenied; }
  function whenReady(f) { onReady.push(f); }
  function enabled() { const c = cfg(); return hostMode() ? c.useHost !== false : !!c.apiKey; }

  async function callHost({ system, user, schema }) {
    let prompt = system + '\n\n' + user;
    if (schema) prompt += '\n\n아래 JSON Schema를 정확히 따르는 JSON 값 하나만 답하세요. 다른 텍스트는 쓰지 마세요.\n' + JSON.stringify(schema);
    else prompt += '\n\n답변 본문만 쓰세요.';
    try {
      return schema ? await sampleFn.json(prompt, { cache: false }) : (await sampleFn(prompt, { cache: false })).text;
    } catch (e) {
      const code = e && e.code;
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) sampleDenied = true;
      const msg = { not_granted: 'Claude 사용이 허용되지 않았습니다', rate_limited: '요청이 많아 잠시 후 다시 시도하세요', refused: 'Claude가 요청을 거절했습니다', invalid_json: '응답 형식 오류', session_expired: '다시 로그인이 필요합니다' }[code];
      throw new Error(msg || (e && e.message) || 'Claude 호출 실패');
    }
  }

  async function getClient() {
    const c = cfg();
    if (!c.apiKey) throw new Error('API 키가 없습니다.');
    if (client && clientKey === c.apiKey) return client;
    if (!sdkPromise) sdkPromise = import(SDK_LOCAL).catch(() => import(SDK_CDN));
    sdkPromise.catch(() => { sdkPromise = null; });
    const mod = await sdkPromise;
    const Anthropic = mod.default || mod.Anthropic;
    // 브라우저에서 직접 호출: 개인용 게임이므로 사용자의 키를 사용자 브라우저에서만 사용
    client = new Anthropic({ apiKey: c.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
    clientKey = c.apiKey;
    return client;
  }

  const BASE_SYSTEM = `당신은 대한민국 대통령의 최고 국정자문 AI입니다. 정책 시뮬레이션 게임 "새로운 대한민국"에서 현실 한국의 제도·경제·정치 상황에 근거해 냉정하고 균형 잡힌 판단을 내립니다.
- 모든 답변은 한국어로 작성합니다.
- 실제 한국의 사례와 연구, 해외 사례를 근거로 들되 간결하게 씁니다.
- 수치 효과는 게임 밸런스를 위해 현실적인 범위로 추정합니다(과장 금지).
`;
  let worldview = 'con';
  const SYS = () => BASE_SYSTEM + (worldview === 'con'
    ? '\n- 국정 철학: 자유시장경제, 작은 정부와 재정 건전성, 강한 안보와 한미동맹, 법치와 질서, 공동체의 전통 가치를 중시하는 보수적 관점에서 판단하고 조언합니다. 다만 어떤 선택이든 이득과 손해·위험은 정직하게 모두 제시합니다.'
    : '\n- 특정 정당이나 이념에 치우치지 않고 이득과 손해를 모두 제시합니다.');

  function stateSummary(s) {
    const t = turnLabel(s.turn);
    const st = Object.entries(s.stats).map(([k, v]) => `${STATS[k].name}=${Number(v).toFixed(STATS[k].dec)}${STATS[k].unit}`).join(', ');
    const rel = Object.keys(RELATIONS).map(k => `${RELATIONS[k].name}=${s.rel[k].toFixed(0)}`).join(', ');
    const fac = Object.entries(s.factions).map(([k, v]) => `${FACTIONS[k].name}=${v.toFixed(0)}`).join(', ');
    const changed = [...POLICIES, ...s.customPolicies].filter(p => !optionOf(p, s.policies[p.id])?.cur).map(p => `${p.name}→${currentOption(p, s).label}`);
    const rulingSeats = s.ruling === 'P' ? s.seats.P : s.seats[s.ruling];
    const T = termInfo(s);
    return `[${t.year}년 ${t.q}분기, 제${T.ord}대 대통령 임기 ${T.year}년차] 지지율 ${s.approval.toFixed(1)}%, 국고 ${won(s.pcap)}, 여당 의석 ${rulingSeats}/300
지표: ${st}
외교관계(0~100): ${rel}
세력별 지지(0~100): ${fac}
현행 대비 바뀐 제도: ${changed.length ? changed.join('; ') : '없음(모두 현행)'}
국정 연합: ${(s.coalition || []).map(k => FACTIONS[k].name).join(', ') || '없음'}${s.war ? `\n전쟁 중: ${typeof cname === 'function' ? cname(s.war.k) : s.war.k} (전황 ${s.war.score.toFixed(0)})` : ''}${s.annexed && s.annexed.nk ? '\n한반도 통일 달성' : ''}${s.annexed && Object.keys(s.annexed).filter(k => k !== 'nk').length ? `\n합병한 나라: ${Object.keys(s.annexed).filter(k => k !== 'nk').map(k => typeof cname === 'function' ? cname(k) : k).join(', ')}` : ''}${s.bills && s.bills.length ? `\n국회 계류 법안 ${s.bills.length}건` : ''}`;
  }

  const numObj = (keys) => ({ type: 'object', properties: Object.fromEntries(keys.map(k => [k, { type: 'number' }])), required: keys, additionalProperties: false });

  async function call({ system, user, schema, maxTokens = 4000 }) {
    if (hostMode() && cfg().useHost !== false) return await callHost({ system, user, schema });
    const c = cfg();
    const cl = await getClient();
    const params = {
      model: c.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: c.effort || 'low', ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
    };
    let resp;
    if (c.model === 'claude-haiku-5-5') {
      resp = await cl.messages.create(params);
    } else {
      // 안전 분류기에 의한 거절 시 서버 측 대체 모델로 자동 재시도
      resp = await cl.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    }
    if (resp.stop_reason === 'refusal') throw new Error('Claude가 요청을 거절했습니다.');
    if (resp.stop_reason === 'max_tokens') throw new Error('응답이 너무 길어 잘렸습니다.');
    const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return schema ? JSON.parse(text) : text;
  }

  const clampObj = (o, lim) => { const r = {}; for (const k in o) { const v = Number(o[k]); if (!isFinite(v) || Math.abs(v) < 1e-9) continue; r[k] = clamp(v, -lim(k), lim(k)); } return r; };
  const STAT_LIM = { gdp: 1, unemp: 1, infl: 1.5, debt: 10, fiscal: 7, tfr: 0.2, gini: 0.03 };
  const statLim = k => STAT_LIM[k] ?? 15;

  /* ---- 1) 자유 입력 정책 분석 ---- */
  async function analyzePolicy(text, s) {
    const statKeys = Object.keys(STATS).filter(k => k !== 'happiness');
    const schema = {
      type: 'object', additionalProperties: false,
      required: ['name', 'cat', 'summary', 'lt', 'lean', 'pc', 'lag', 'e', 'rel', 'f', 'risks'],
      properties: {
        name: { type: 'string', description: '정책 이름(25자 이내)' },
        cat: { type: 'string', enum: CATEGORIES.map(c => c.id) },
        summary: { type: 'string', description: '정책 내용과 예상 이득·손해 요약(3~5문장)' },
        lt: { type: 'string', enum: ['decree', 'law', 'const'] },
        lean: { type: 'string', enum: ['L', 'R', 'N'] },
        pc: { type: 'integer' }, lag: { type: 'integer' },
        e: numObj(statKeys), rel: numObj(Object.keys(RELATIONS)), f: numObj(Object.keys(FACTIONS)),
        risks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tpl', 'title', 'desc', 'prob', 'sev'],
          properties: { tpl: { type: 'string', enum: Object.keys(RISK_TEMPLATES) }, title: { type: 'string' }, desc: { type: 'string' }, prob: { type: 'number' }, sev: { type: 'integer' } } } },
      },
    };
    const examples = POLICIES.slice(0, 40).filter((p, i) => i % 6 === 1).map(p => { const o = p.options.find(x => !x.cur); return `- ${p.name}/${o.label}: lt=${o.lt}, pc=${o.pc}, lag=${o.lag}, e=${JSON.stringify(o.e)}, f=${JSON.stringify(o.f)}`; }).join('\n');
    const user = `대통령이 다음 정책을 새로 입안했습니다: "${text}"

현재 국가 상황:
${stateSummary(s)}

이 정책을 게임 데이터로 변환하세요.
- e: 각 지표의 장기 균형값 변화(현행 대비). 단위: gdp/unemp/infl/fiscal/debt는 %p, tfr은 명, gini는 0~1 지니계수 변화, 나머지는 0~100 지수 포인트. 관련 없는 지표는 0.
- rel: 외교관계 변화(-25~25), f: 세력 지지도 즉시 변화(-25~25).
- lt: 대통령령으로 가능하면 decree, 법률 개정이면 law, 헌법 개정 필요하면 const. lean: 진보 L/보수 R/중립 N.
- pc: 시행 비용(10~80, 단위 1000억 원), lag: 효과가 완전히 나타나기까지 분기 수(1~16).
- risks: 현실적으로 예상되는 부작용 0~3개(prob 0~1, sev 1~3).
참고용 기존 정책 데이터 예시:
${examples}`;
    const a = await call({ system: SYS(), user, schema });
    a.e = clampObj(a.e, statLim); a.rel = clampObj(a.rel, () => 25); a.f = clampObj(a.f, () => 25);
    a.pc = clamp(Math.round(a.pc), 5, 90); a.lag = clamp(Math.round(a.lag), 1, 16);
    a.r = (a.risks || []).slice(0, 3).map(r => [r.tpl, r.title, r.desc, clamp(r.prob, 0, 1), clamp(Math.round(r.sev), 1, 3)]);
    delete a.risks;
    return a;
  }

  /* ---- 1-b) 특정 제도에 대한 주관식 선택지 분석 ---- */
  async function analyzeOption(p, text, s) {
    const statKeys = Object.keys(STATS).filter(k => k !== 'happiness');
    const schema = {
      type: 'object', additionalProperties: false,
      required: ['label', 'desc', 'pro', 'con', 'lt', 'lean', 'pc', 'lag', 'e', 'rel', 'f', 'risks'],
      properties: {
        label: { type: 'string', description: '선택지 이름(25자 이내)' },
        desc: { type: 'string', description: '이 안의 구체적 내용(1~2문장)' },
        pro: { type: 'string', description: '찬성 논리(1~2문장)' },
        con: { type: 'string', description: '반대 논리(1~2문장)' },
        lt: { type: 'string', enum: ['decree', 'law', 'const'] },
        lean: { type: 'string', enum: ['L', 'R', 'N'] },
        pc: { type: 'integer' }, lag: { type: 'integer' },
        e: numObj(statKeys), rel: numObj(Object.keys(RELATIONS)), f: numObj(Object.keys(FACTIONS)),
        risks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tpl', 'title', 'desc', 'prob', 'sev'],
          properties: { tpl: { type: 'string', enum: Object.keys(RISK_TEMPLATES) }, title: { type: 'string' }, desc: { type: 'string' }, prob: { type: 'number' }, sev: { type: 'integer' } } } },
      },
    };
    const anchors = p.options.filter(o => !o.user).map(o => o.cur ? `- (현행) ${o.label}: 기준점, 모든 효과 0` : `- ${o.label}: ${o.desc || ''} | lt=${o.lt}, lean=${o.lean}, pc=${o.pc}, lag=${o.lag}, e=${JSON.stringify(o.e || {})}, rel=${JSON.stringify(o.rel || {})}, f=${JSON.stringify(o.f || {})}`).join('\n');
    const user = `제도 "${p.name}"에 대해 대통령이 직접 새로운 안을 입력했습니다: "${text}"
현행 제도 설명: ${p.desc}

이 제도의 기존 선택지와 게임 수치(현행 대비 변화량):
${anchors}

현재 국가 상황:
${stateSummary(s)}

입력한 안을 이 제도의 새 선택지로 만드세요. 효과 수치는 위 기존 선택지들과 같은 척도로, 입력한 안의 강도에 비례하게 정하세요(예: 기존 두 선택지 사이의 수치라면 효과도 그 사이).
- e 단위: gdp/unemp/infl/fiscal/debt는 %p, tfr은 명, gini는 0~1 지니계수 변화, 나머지는 0~100 지수 포인트. 관련 없으면 0.
- rel: 외교관계 변화(-25~25), f: 세력 지지도 즉시 변화(-25~25). lt: decree/law/const, lean: L/R/N, pc 10~80, lag 1~16.
- risks: 현실적 부작용 0~2개(prob 0~1, sev 1~3).
- 입력이 이 제도와 무관하거나 실현 불가능하면 label에 그 취지를 담고 효과를 작게 잡으세요.`;
    const a = await call({ system: SYS(), user, schema });
    a.e = clampObj(a.e, statLim); a.rel = clampObj(a.rel, () => 25); a.f = clampObj(a.f, () => 25);
    a.pc = clamp(Math.round(a.pc), 5, 90); a.lag = clamp(Math.round(a.lag), 1, 16);
    a.r = (a.risks || []).slice(0, 2).map(r => [r.tpl, r.title, r.desc, clamp(r.prob, 0, 1), clamp(Math.round(r.sev), 1, 3)]);
    delete a.risks;
    return a;
  }

  /* ---- 2) 위기 해결 판단 ---- */
  async function resolveCrisis(c, s, ruleEvals) {
    const statKeys = Object.keys(STATS).filter(k => k !== 'happiness');
    const schema = {
      type: 'object', additionalProperties: false, required: ['choice', 'reasoning', 'custom'],
      properties: {
        choice: { type: 'integer', description: '선택한 해법 번호(0부터). 독자적인 새 해법을 제안하면 -1' },
        reasoning: { type: 'string', description: '판단 근거(3~5문장): 왜 이 해법인지, 무엇을 얻고 무엇을 잃는지' },
        custom: { type: 'object', additionalProperties: false, required: ['label', 'desc', 'e', 'f', 'ok', 'pc'],
          properties: { label: { type: 'string' }, desc: { type: 'string' }, e: numObj(statKeys), f: numObj(Object.keys(FACTIONS)), ok: { type: 'number' }, pc: { type: 'integer' } } },
      },
    };
    const p = c.pid && policyById(c.pid, s);
    const opts = c.options.map((o, i) => {
      const ev = ruleEvals.find(x => x.i === i);
      return `${i}. ${o.label} — ${o.desc} | 효과(심각도 반영 전) e=${JSON.stringify(o.e || {})}, 외교=${JSON.stringify(o.rel || {})}, 세력=${JSON.stringify(o.f || {})}, 비용 ${won(o.pc || 0)}, 기본 성공률 ${(o.ok * 100).toFixed(0)}%${o.rollback ? `, 원인 정책 ${(o.rollback * 100).toFixed(0)}% 후퇴` : ''} | 규칙 AI 점수 ${ev ? ev.score.toFixed(1) : '-'}`;
    }).join('\n');
    const user = `${c.good ? '기회' : '위기'} 발생: [${c.kind}] ${c.title}
상황: ${c.desc}
심각도: ${c.sev}/3${p ? `\n원인 정책: ${p.name} — ${currentOption(p, s).label}` : '\n원인: 외부 돌발 사건'}${c.facTarget ? `\n주요 이해관계자: ${FACTIONS[c.facTarget].name}` : ''}${c.relTarget ? `\n관련 국가: ${RELATIONS[c.relTarget].name}` : ''}

현재 국가 상황:
${stateSummary(s)}

선택 가능한 해법(_target은 주요 이해관계자/관련 국가, _all은 전 세력):
${opts}

대통령을 대신해 가장 바람직한 해법을 판단하세요. 기존 해법이 모두 부적절하면 choice=-1로 하고 custom에 현실적인 새 해법을 설계하세요(e는 기존 해법과 비슷한 규모, ok는 0.3~0.9, pc는 5~30). choice가 0 이상이면 custom은 형식만 채우세요(0 값).`;
    const r = await call({ system: SYS(), user, schema, maxTokens: 3000 });
    let choice = Number.isInteger(r.choice) ? r.choice : 0;
    if (choice === -1 && r.custom && r.custom.label) {
      c.options.push({ label: '🤖 ' + r.custom.label, desc: r.custom.desc, e: clampObj(r.custom.e, k => statLim(k) / 3), f: clampObj(r.custom.f, () => 10), ok: clamp(r.custom.ok, 0.3, 0.9), pc: clamp(Math.round(r.custom.pc), 5, 30), claude: true });
      choice = c.options.length - 1;
    }
    if (choice < 0 || choice >= c.options.length) choice = ruleEvals[0].i;
    return { choice, reasoning: r.reasoning };
  }

  /* ---- 3) 분기 논평 ---- */
  async function briefing(s, report) {
    const diffs = Object.entries(report.diff).filter(([k, v]) => Math.abs(v) > (STATS[k].dec >= 2 ? 0.005 : 0.15)).map(([k, v]) => `${STATS[k].name} ${fmtStat(k, v, true)}`).join(', ');
    const crises = s.resolved.filter(r => r.turn === report.turn).map(r => `${r.title}: ${r.sol} → ${r.success ? '성공' : '실패'}`).join('; ');
    const user = `지난 분기 국정 결과를 대통령에게 보고하세요.
이번 분기 시행 정책: ${report.enacted.length ? report.enacted.join('; ') : '없음'}
진행 중 정책 효과: ${report.applied.map(a => a.src).join('; ') || '없음'}
지표 변화: ${diffs || '큰 변화 없음'}
지지율 변화: ${report.approvalDiff > 0 ? '+' : ''}${report.approvalDiff.toFixed(1)}%p
위기 대응: ${crises || '없음'}
${report.elections.join(' ')}

현재 상황:
${stateSummary(s)}

형식: ① 총평(2문장) ② 이득과 손해(각 2~3개 불릿) ③ 다음 분기 권고(2~3개 구체적 정책 제안). 300자~500자. 마크다운 없이 줄바꿈과 •만 사용.`;
    return await call({ system: SYS(), user, maxTokens: 3000 });
  }

  /* ---- 4) 정책 자문 ---- */
  async function advise(s, p, o, pv) {
    const cur = currentOption(p, s);
    const user = `대통령이 다음 제도 변경을 검토 중입니다.
분야: ${p.name} (현재 제도: ${p.desc})
변경: "${cur.label}" → "${o.label}" (${o.desc || ''})
게임 내 추정 효과: ${JSON.stringify(pv.diff.e)} / 외교 ${JSON.stringify(pv.diff.rel)} / 세력 반응 ${JSON.stringify(pv.diff.f)}
예상 부작용: ${pv.risks.map(r => r.title + '(' + Math.round(r.prob * 100) + '%)').join(', ') || '없음'}
국회 통과 가능성: ${Math.round(pv.vote.prob * 100)}%

현재 국가 상황:
${stateSummary(s)}

실제 한국과 해외 사례를 근거로 ① 핵심 이득 ② 핵심 손해·위험 ③ 성공 조건/보완책 ④ 추진 여부 권고(추진/보완 후 추진/보류)를 400자 내외로 제시하세요. 마크다운 없이 줄바꿈과 •만 사용.`;
    return await call({ system: SYS(), user, maxTokens: 3000 });
  }

  /* ---- 4-2) 지표 조언 ---- */
  async function metricAdvice(s, name, value, factors, recs) {
    const user = `대통령이 "${name}"(현재 ${value})을(를) 개선하는 방법을 묻습니다.
게임이 계산한 현재 요인: ${factors}
내장 참모의 추천 후보: ${recs}

현재 국가 상황:
${stateSummary(s)}

① 지금 ${name}이(가) 이런 이유(2문장) ② 이번 분기에 할 일 3가지(구체적으로, 비용과 부작용 포함) ③ 피해야 할 것 1~2가지. 350자 내외. 마크다운 없이 줄바꿈과 •만 사용.`;
    return await call({ system: SYS(), user, maxTokens: 2500 });
  }

  /* ---- 5) 외국 지도자 역할극 ---- */
  async function leaderTalk(s, k, L, history, msg) {
    const schema = { type: 'object', additionalProperties: false, required: ['reply', 'mood', 'relDelta', 'proposal'],
      properties: { reply: { type: 'string', description: '지도자의 답변(한국어, 2~5문장)' }, mood: { type: 'string', enum: ['우호적', '중립', '경계', '불쾌함', '분노'] },
        relDelta: { type: 'integer', description: '이 대화로 인한 대한 관계 변화 -8~8' }, proposal: { type: 'string', enum: ['none', 'fta', 'alliance', 'aid', 'ceasefire'] } } };
    const conf = (s.world?.conflicts || []).filter(c => c.a === k || c.b === k).map(c => `${CONFLICT_TYPES[c.type].name}(${cname(c.a)}↔${cname(c.b)})`).join(', ') || '없음';
    const d = dip(s, k);
    const user = `당신은 정치 시뮬레이션 게임 속 가상의 외국 지도자를 연기합니다. 실존 인물이 아닙니다.
나라: ${cname(k)} (${cinfo(k).sub || ''}) / 직함: ${L.title} / 이름: ${L.name} / 체제: ${IDEOLOGIES[L.gov].name}
성향: ${L.traits.map(t => `${TRAITS[t].name}(${TRAITS[t].desc})`).join(', ')}
진영: ${CAMPS[campOf(s, k)].name} / 한국과의 관계(0~100): ${relOf(s, k).toFixed(0)} / 조약: ${[d.alliance && '동맹', d.fta && 'FTA', d.sanction && '한국이 제재 중'].filter(Boolean).join(', ') || '없음'}
진행 중인 분쟁: ${conf} / 세계 긴장도: ${s.world?.tension?.toFixed(0)}

한국 상황:
${stateSummary(s)}

최근 대화:
${history.slice(0, -1).map(m => `${m.role === 'me' ? '한국 대통령' : L.name}: ${m.text}`).join('\n') || '(없음)'}

한국 대통령의 말: "${msg}"

이 지도자의 성향과 자국 이익에 맞게, 외교적 어조로 답하세요. 성향과 맞지 않는 제안은 거절하고, 무례하거나 위협적인 말에는 불쾌감을 드러내세요.
relDelta는 대화의 설득력·예의·이해관계 일치에 따라 -8~8 정수. proposal은 이 지도자가 실제로 응할 의향이 있는 협력(없으면 none).`;
    const r = await call({ system: SYS(), user, schema, maxTokens: 2000 });
    r.relDelta = clamp(Math.round(r.relDelta || 0), -8, 8);
    return r;
  }

  async function test() {
    const r = await call({ system: '한 단어로 답하세요.', user: '연결 확인: "정상"이라고 답하세요.', maxTokens: 500 });
    return r;
  }

  return { setWorldview: v => { worldview = v; }, MODELS, cfg, setCfg, enabled, hostMode, whenReady, analyzePolicy, analyzeOption, leaderTalk, resolveCrisis, briefing, advise, metricAdvice, test };
})();
