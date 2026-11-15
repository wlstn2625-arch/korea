/* =========================================================
 *  초간단 로그인·회원가입 (아이디 + 비밀번호)
 *  - 계정과 세이브는 이 기기(브라우저)에 저장. 비밀번호는 솔트+SHA-256 해시로만 보관
 *  - claude.ai에서 열면 내 Claude 계정의 비공개 저장소에 세이브를 백업 →
 *    다른 기기에서도 같은 아이디·비밀번호로 로그인하면 이어서 플레이
 *  - 로그인 안 하면 '게스트'(이 기기에만 저장)
 * ========================================================= */
const ACC_KEY = 'newkorea_accounts', CUR_KEY = 'newkorea_user';
let curUser = null;
const accRead = () => { try { return JSON.parse(localStorage.getItem(ACC_KEY) || '{}'); } catch { return {}; } };
const accWrite = a => { try { localStorage.setItem(ACC_KEY, JSON.stringify(a)); } catch { } };
async function pwHash(salt, pw) {
  const txt = `${salt}:${pw}:newkorea`;
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch { let h = 2166136261; for (const ch of txt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16); }
}
const validId = id => /^[A-Za-z0-9\uAC00-\uD7A3_]{2,16}$/.test(id);

/* ---------------- 클라우드 백업 (claude.ai에서만) ---------------- */
let cloudP = null;
function cloud() {
  if (!cloudP) cloudP = (async () => {
    if (!window.claude?.use) return null;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user) return null;
    const uid = await user.id(); if (!uid) return null;
    return { db, uid, ref: id => db.collection('data/users/' + uid).doc('nk_' + id.replace(/[^A-Za-z0-9_]/g, c => '~' + c.charCodeAt(0).toString(36))) };
  })().catch(() => null);
  return cloudP;
}
async function packSave(s) {
  const json = JSON.stringify(s);
  if (typeof CompressionStream === 'undefined') return { enc: 'json', data: json };
  const buf = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return { enc: 'gz64', data: btoa(bin) };
}
async function unpackSave(o) {
  if (o.enc === 'json') return JSON.parse(o.data);
  const bin = atob(o.data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
let cloudBusy = false, cloudLast = 0, cloudState = '';
async function cloudPush(force) {
  if (!curUser || !S || cloudBusy || (!force && Date.now() - cloudLast < 20000)) return;
  const c = await cloud(); if (!c) return;
  cloudBusy = true;
  try {
    const acc = accRead()[curUser]; const pk = await packSave(S);
    await c.ref(curUser).set({ salt: acc.salt, hash: acc.hash, enc: pk.enc, save: pk.data, turn: S.turn, name: S.name, updated: Date.now() });
    cloudLast = Date.now(); cloudState = '☁️ 클라우드 저장됨';
  } catch (e) { cloudState = e?.code === 'invalid_argument' ? '☁️ 세이브가 너무 커서 클라우드에 못 올림' : '☁️ 클라우드 저장 실패(이 기기엔 저장됨)'; }
  finally { cloudBusy = false; const el = $('acc-cloud'); if (el) el.textContent = cloudState; }
}
// 저장할 때마다(최대 20초에 한 번) 클라우드에도 올림
(function () { const f = saveGame; saveGame = function (s) { const r = f(s); if (curUser && s === S) cloudPush(false); return r; }; })();

/* ---------------- 로그인·회원가입 ---------------- */
function useAccount(id) {
  curUser = id || null; setSaveUser(curUser);
  try { id ? localStorage.setItem(CUR_KEY, id) : localStorage.removeItem(CUR_KEY); } catch { }
}
async function signUp(id, pw) {
  id = (id || '').trim();
  if (!validId(id)) return { ok: false, msg: '아이디는 2~16자 (한글·영문·숫자·_)로 정해주세요.' };
  if ((pw || '').length < 4) return { ok: false, msg: '비밀번호는 4자 이상이면 됩니다.' };
  const a = accRead(); if (a[id]) return { ok: false, msg: '이미 있는 아이디입니다. 로그인해 주세요.' };
  const c = await cloud(); if (c) { try { if ((await c.ref(id).get()).exists) return { ok: false, msg: '클라우드에 이미 있는 아이디입니다. 로그인해 주세요.' }; } catch { } }
  const salt = Math.random().toString(36).slice(2, 10);
  a[id] = { salt, hash: await pwHash(salt, pw), t: Date.now() }; accWrite(a);
  // 게스트로 하던 게임이 있으면 새 계정으로 옮겨 줌
  const guest = (() => { try { return localStorage.getItem(SAVE_BASE); } catch { return null; } })();
  useAccount(id);
  const moved = guest && !loadGame();
  if (moved) { try { localStorage.setItem(SAVE_KEY, guest); localStorage.removeItem(SAVE_BASE); } catch { } }
  return { ok: true, msg: `🎉 ${id}님, 가입했습니다!${moved ? ' 게스트로 하던 게임도 옮겨 왔어요.' : ''}` };
}
async function logIn(id, pw) {
  id = (id || '').trim(); if (!id || !pw) return { ok: false, msg: '아이디와 비밀번호를 넣어주세요.' };
  const a = accRead();
  if (a[id]) {
    if (await pwHash(a[id].salt, pw) !== a[id].hash) return { ok: false, msg: '비밀번호가 맞지 않습니다.' };
    useAccount(id);
    // 클라우드에 더 최근 세이브가 있으면 받아옴
    const c = await cloud(); if (c) { try { const d = (await c.ref(id).get()).data(); const local = loadGame(); if (d?.save && (!local || d.turn > local.turn)) { saveGameRaw(await unpackSave({ enc: d.enc, data: d.save })); return { ok: true, msg: `👋 ${id}님, 클라우드에서 더 최근 진행(${d.turn}분기)을 불러왔습니다.` }; } } catch { } }
    return { ok: true, msg: `👋 ${id}님, 어서 오세요!` };
  }
  // 이 기기엔 없음 → 클라우드에서 찾기
  const c = await cloud();
  if (c) {
    try {
      const snap = await c.ref(id).get();
      if (snap.exists) {
        const d = snap.data();
        if (await pwHash(d.salt, pw) !== d.hash) return { ok: false, msg: '비밀번호가 맞지 않습니다.' };
        a[id] = { salt: d.salt, hash: d.hash, t: Date.now() }; accWrite(a); useAccount(id);
        if (d.save) saveGameRaw(await unpackSave({ enc: d.enc, data: d.save }));
        return { ok: true, msg: `☁️ ${id}님, 다른 기기의 진행(${d.name || ''} 대통령, ${d.turn}분기)을 불러왔습니다.` };
      }
    } catch { }
  }
  return { ok: false, msg: '없는 아이디입니다. 회원가입을 눌러 주세요.' };
}
function saveGameRaw(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { } }
function logOut() { if (S) saveGame(S); useAccount(null); S = null; $('game')?.classList.add('hidden'); $('start')?.classList.remove('hidden'); closeModal(); renderStart(); toast('로그아웃했습니다. (게스트 모드)'); }

/* ---------------- 화면 ---------------- */
function renderAccountBox() {
  let box = $('acc-box');
  if (!box) { box = document.createElement('div'); box.id = 'acc-box'; box.className = 'acc-box'; const card = document.querySelector('#start .start-actions'); card?.parentNode.insertBefore(box, card); }
  if (curUser) {
    box.innerHTML = `<div class="acc-in"><span>👤 <b>${esc(curUser)}</b>님으로 로그인</span><span id="acc-cloud" class="muted small">${cloudState}</span><button class="btn sm ghost" id="acc-out">로그아웃</button></div>`;
    $('acc-out').onclick = () => logOut();
    cloud().then(c => { const el = $('acc-cloud'); if (el && !cloudState) el.textContent = c ? '☁️ claude.ai 클라우드 백업 켜짐' : '📱 이 기기에 저장'; });
  } else {
    box.innerHTML = `<div class="acc-form"><input id="acc-id" placeholder="아이디" maxlength="16" autocomplete="username"><input id="acc-pw" type="password" placeholder="비밀번호 (4자 이상)" autocomplete="current-password">
      <button class="btn sm primary" id="acc-login">로그인</button><button class="btn sm" id="acc-join">회원가입</button></div>
      <div class="muted small" id="acc-msg">로그인하면 계정별로 저장되고, claude.ai에서는 다른 기기에서도 이어서 할 수 있어요. 안 해도 게스트로 바로 플레이할 수 있습니다.</div>`;
    const go = async fn => { const id = $('acc-id').value, pw = $('acc-pw').value; $('acc-msg').textContent = '확인 중…'; const r = await fn(id, pw); if (!r.ok) { $('acc-msg').innerHTML = `<span class="bad-t">${esc(r.msg)}</span>`; return; } toast(esc(r.msg), 4000); renderStart(); };
    $('acc-login').onclick = () => go(logIn); $('acc-join').onclick = () => go(signUp);
    $('acc-pw').onkeydown = e => { if (e.key === 'Enter') go(logIn); };
  }
}
(function () { const f = renderStart; renderStart = function () { f(); renderAccountBox(); }; })();
// 설정 화면에 계정 줄
(function () {
  const btn = $('btn-settings'); if (!btn) return; const f = btn.onclick;
  btn.onclick = () => { f(); const m = document.querySelector('#modal-body h2'); if (!m) return; m.insertAdjacentHTML('afterend', `<p class="muted small">👤 ${curUser ? `<b>${esc(curUser)}</b>님 로그인 중 · ${esc(cloudState || '')} <button class="btn sm ghost" id="cfg-logout">로그아웃</button> <button class="btn sm ghost" id="cfg-cloud">☁️ 지금 백업</button>` : '게스트 (이 기기에만 저장) — 시작 화면에서 로그인할 수 있어요.'}</p>`); const lo = $('cfg-logout'); if (lo) lo.onclick = () => logOut(); const cb = $('cfg-cloud'); if (cb) cb.onclick = async () => { const c = await cloud(); if (!c) return toast('클라우드 백업은 claude.ai에서 열었을 때만 됩니다.'); await cloudPush(true); toast(esc(cloudState)); }; };
})();
// 시작할 때 마지막 로그인 계정으로
(function () { let id = null; try { id = localStorage.getItem(CUR_KEY); } catch { } if (id && accRead()[id]) useAccount(id); renderStart(); })();
