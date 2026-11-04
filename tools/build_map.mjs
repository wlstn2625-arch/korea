/* Natural Earth(퍼블릭 도메인) 데이터로 세계지도(js/mapdata.js)를 만듭니다.
 * 사용: node tools/build_map.mjs <ne_50m_admin_0_countries.geojson> <ne_10m_admin_1_states_provinces.geojson>
 * 데이터: https://github.com/nvkelso/natural-earth-vector (geojson/)
 *  - 태평양 중심(경도 150°E) Natural Earth 도법
 *  - 국가: 경계·한글 이름·국기·인구·GDP·대륙
 *  - 남북한·일본·대만: 1단계 행정구역(시·도/현) — 전선 표시용
 */
import fs from 'node:fs';
import path from 'node:path';
import { geoNaturalEarth1, geoPath, geoCentroid, geoArea } from 'd3-geo';

const [admin0Path, admin1Path] = process.argv.slice(2);
if (!admin0Path || !admin1Path) { console.error('usage: node build_map.mjs admin0.geojson admin1.geojson'); process.exit(1); }
const admin0 = JSON.parse(fs.readFileSync(admin0Path, 'utf8'));
const admin1 = JSON.parse(fs.readFileSync(admin1Path, 'utf8'));

const W = 2000;
const proj = geoNaturalEarth1().rotate([-150, 0]).fitWidth(W, { type: 'Sphere' });
const H = Math.ceil(geoPath(proj).bounds({ type: 'Sphere' })[1][1]);
const pathGen = geoPath(proj).digits(1);
const pathFine = geoPath(proj).digits(2);
const spherePath = geoPath(proj).digits(1)({ type: 'Sphere' });

// 게임 내부 키: 핵심 7개국은 기존 키, 나머지는 ISO3 소문자
const CORE = { USA: 'us', CHN: 'cn', JPN: 'jp', RUS: 'ru', TWN: 'tw', PRK: 'nk', KOR: 'kr' };
const keyOf = a3 => CORE[a3] || a3.toLowerCase();

// 경위도에서 Douglas-Peucker 단순화 (닫힌 고리는 반으로 나눠 처리)
function dp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len; if (d > max) { max = d; idx = i; } }
    if (max > eps) { keep[idx] = 1; st.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
function simplify(geom, eps, minArea) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  const out = [];
  for (const poly of polys) {
    const rings = [];
    let dropped = false;
    poly.forEach((ring, ri) => {
      if (dropped) return;
      const m = ring.length >> 1;
      const r = [...dp(ring.slice(0, m + 1), eps).slice(0, -1), ...dp(ring.slice(m), eps)];
      if (r.length < 4 || ringArea(r) < minArea) { if (ri === 0) dropped = true; return; }
      if (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) r.push(r[0]);
      rings.push(r);
    });
    if (rings.length) out.push(rings);
  }
  return out.length ? { type: 'MultiPolygon', coordinates: out } : null;
}
const xy = ll => proj(ll).map(v => +v.toFixed(1));

// 종속령(그린란드 등)은 주권국 키로 묶음
const byAdmin = Object.fromEntries(admin0.features.map(f => [f.properties.ADMIN, f.properties.ADM0_A3]));
const SOVEREIGN_TYPES = new Set(['Sovereign country', 'Country']);
const flag = iso2 => /^[A-Z]{2}$/.test(iso2) ? String.fromCodePoint(...[...iso2].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🏳️';

const land = [], countries = {};
for (const f of admin0.features) {
  const p = f.properties, a3 = p.ADM0_A3;
  if (a3 === 'ATA') { const g = simplify(f.geometry, 0.3, 0.5); if (g) land.push({ k: 'x', d: pathGen(g) }); continue; }
  const sovA3 = SOVEREIGN_TYPES.has(p.TYPE) || a3 === 'TWN' ? a3 : byAdmin[p.SOVEREIGNT];
  const interactive = !!sovA3 && !['SOL', 'CYN', 'KAS'].includes(a3);
  const k = interactive ? keyOf(sovA3) : 'x';
  const g = simplify(f.geometry, a3 === 'KOR' || a3 === 'PRK' ? 0.01 : 0.06, 0.004);
  if (!g) continue;
  const item = { k, d: pathGen(g) };
  if (!(interactive && sovA3 === a3)) item.dep = 1;
  land.push(item);
  if (interactive && sovA3 === a3) {
    const ll = geoCentroid(f);
    countries[k] = {
      n: (p.NAME_KO || p.NAME).replace('조선민주주의인민공화국', '북한').replace('중화민국', '대만').replace('중화인민공화국', '중국'),
      f: flag(p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2),
      pop: p.POP_EST, gdp: p.GDP_MD, reg: p.CONTINENT, sub: p.SUBREGION,
      ll: ll.map(v => +v.toFixed(2)), c: xy(ll), a: +(geoArea(f) * 1e4).toFixed(2),
    };
  }
}
// 라벨 위치 보정(무게중심이 어색한 나라)
const LABEL_LL = { us: [-99, 39], cn: [104, 34], ru: [96, 61], can: [-104, 58], nk: [127.3, 40.3], kr: [128, 36.3], jp: [138.5, 37.5], tw: [121, 23.8], nor: [9, 61.5], fra: [2.5, 46.6], idn: [114, -1], chl: [-71, -32], nzl: [172.5, -42] };
for (const k in LABEL_LL) if (countries[k]) countries[k].c = xy(LABEL_LL[k]);

// 시·도 / 현
const PROV = { KOR: 'kr', PRK: 'nk', JPN: 'jp', TWN: 'tw' };
const prov = { kr: [], nk: [], jp: [], tw: [] };
for (const f of admin1.features) {
  const k = PROV[f.properties.adm0_a3]; if (!k) continue;
  const g = simplify(f.geometry, k === 'jp' ? 0.02 : 0.008, 0.0004); if (!g) continue;
  prov[k].push({ id: f.properties.iso_3166_2 || f.properties.adm1_code, n: f.properties.name_ko || f.properties.name, d: pathFine(g), c: xy(geoCentroid(f)) });
}

const CITIES = { 서울: [126.98, 37.57], 평양: [125.75, 39.03], 베이징: [116.4, 39.9], 도쿄: [139.69, 35.69], 타이베이: [121.56, 25.04], 블라디보스토크: [131.89, 43.12], 모스크바: [37.62, 55.75], 워싱턴: [-77.04, 38.9], 브뤼셀: [4.35, 50.85] };
const cities = Object.fromEntries(Object.entries(CITIES).map(([n, ll]) => [n, xy(ll)]));
// 처음 보여줄 범위(동아시아): [왼쪽 위, 오른쪽 아래]
const eastAsia = [xy([102, 50]), xy([150, 20])];

const out = `/* 자동 생성: tools/build_map.mjs (Natural Earth, public domain) — 직접 수정하지 마세요 */\nconst MAP_DATA = ${JSON.stringify({ w: W, h: H, sphere: spherePath, land, prov, countries, cities, eastAsia })};\n`;
const dest = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js/mapdata.js');
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0) + 'KB', 'land', land.length, 'countries', Object.keys(countries).length, 'prov', Object.fromEntries(Object.entries(prov).map(([k, v]) => [k, v.length])), 'H', H);
