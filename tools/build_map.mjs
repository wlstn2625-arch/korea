/* Natural Earth(퍼블릭 도메인) 데이터로 게임 지도(js/mapdata.js)를 만듭니다.
 * 사용: node tools/build_map.mjs <ne_50m_admin_0_countries.geojson> <ne_10m_admin_1_states_provinces.geojson>
 * 데이터: https://github.com/nvkelso/natural-earth-vector (geojson/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { geoMercator } from 'd3-geo';

const [admin0Path, admin1Path] = process.argv.slice(2);
if (!admin0Path || !admin1Path) { console.error('usage: node build_map.mjs admin0.geojson admin1.geojson'); process.exit(1); }
const admin0 = JSON.parse(fs.readFileSync(admin0Path, 'utf8'));
const admin1 = JSON.parse(fs.readFileSync(admin1Path, 'utf8'));

// 보이는 범위: 경도 108~146, 위도 21.5~50 (한반도 중심)
const BOX = [[103, 21.6], [151, 48.5]];
const W = 1000;
const proj0 = geoMercator().fitWidth(W, { type: 'MultiPoint', coordinates: [BOX[0], [BOX[1][0], BOX[0][1]], BOX[1], [BOX[0][0], BOX[1][1]]] });
const H = Math.round(proj0(BOX[0])[1] - proj0(BOX[1])[1]);
const proj = geoMercator().fitExtent([[0, 0], [W, H]], { type: 'MultiPoint', coordinates: [BOX[0], [BOX[1][0], BOX[0][1]], BOX[1], [BOX[0][0], BOX[1][1]]] });

const GAME_KEY = { CHN: 'cn', RUS: 'ru', JPN: 'jp', TWN: 'tw', PRK: 'nk', KOR: 'kr', MNG: 'mn' };

// Douglas-Peucker
function dp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len; if (d > max) { max = d; idx = i; } }
    if (max > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
const centroid = r => { let x = 0, y = 0, a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; x += (r[j][0] + r[i][0]) * f; y += (r[j][1] + r[i][1]) * f; a += f; } a *= 3; return a ? [x / a, y / a] : r[0]; };
const outside = r => r.every(p => p[0] < -50) || r.every(p => p[0] > W + 50) || r.every(p => p[1] < -50) || r.every(p => p[1] > H + 50);

function toPath(geom, eps, minArea) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  let d = '', best = null, bestA = 0, total = 0;
  for (const poly of polys) {
    poly.forEach((ring, ri) => {
      let pts = ring.map(c => proj(c)).filter(Boolean);
      if (outside(pts)) return;
      { const m = pts.length >> 1; pts = [...dp(pts.slice(0, m + 1), eps).slice(0, -1), ...dp(pts.slice(m), eps)]; } // 닫힌 고리는 반으로 나눠 단순화
      const a = area(pts);
      if (pts.length < 3 || a < minArea) return;
      // 화면 밖 좌표는 잘라서 파일 크기와 렌더링 부담을 줄임
      pts = pts.map(([x, y]) => [Math.max(-60, Math.min(W + 60, x)), Math.max(-60, Math.min(H + 60, y))]);
      d += 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
      if (ri === 0) { total += a; if (a > bestA) { bestA = a; best = pts; } }
    });
  }
  return d ? { d, c: best ? centroid(best).map(v => +v.toFixed(1)) : null, area: Math.round(total) } : null;
}

// 나라(배경 + 게임 국가)
const land = [];
for (const f of admin0.features) {
  const a3 = f.properties.ADM0_A3;
  const r = toPath(f.geometry, 1.4, 6);
  if (!r) continue;
  land.push({ k: GAME_KEY[a3] || 'x', name: f.properties.NAME_KO || f.properties.NAME, d: r.d, c: r.c });
}

// 시·도 / 현 단위 (전선·점령 표시용)
const PROV_COUNTRIES = { KOR: 'kr', PRK: 'nk', JPN: 'jp', TWN: 'tw' };
const prov = { kr: [], nk: [], jp: [], tw: [] };
for (const f of admin1.features) {
  const k = PROV_COUNTRIES[f.properties.adm0_a3]; if (!k) continue;
  const eps = k === 'jp' ? 0.9 : 0.5;
  const r = toPath(f.geometry, eps, 0.4);
  if (!r) continue;
  prov[k].push({ id: f.properties.iso_3166_2 || f.properties.adm1_code, n: f.properties.name_ko || f.properties.name, d: r.d, c: r.c, a: r.area });
}

const LABELS_LL = { cn: [115.5, 33.5], ru: [133, 47.2], jp: [139.5, 38.8], tw: [121.0, 22.6], nk: [127.3, 40.5], kr: [128.4, 35.6], mn: [111, 44.8] };
const labels = Object.fromEntries(Object.entries(LABELS_LL).map(([k, ll]) => [k, proj(ll).map(v => +v.toFixed(1))]));
const cities = { 서울: [126.98, 37.57], 평양: [125.75, 39.03], 베이징: [116.4, 39.9], 도쿄: [139.69, 35.69], 타이베이: [121.56, 25.04], 블라디보스토크: [131.89, 43.12], 상하이: [121.47, 31.23], 울란바토르: [106.9, 47.9] };
const cityXY = Object.fromEntries(Object.entries(cities).map(([n, ll]) => [n, proj(ll).map(v => +v.toFixed(1))]));

const out = `/* 자동 생성: tools/build_map.mjs (Natural Earth, public domain) — 직접 수정하지 마세요 */\nconst MAP_DATA = ${JSON.stringify({ w: W, h: H, land, prov, cities: cityXY, labels })};\n`;
const dest = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js/mapdata.js');
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0) + 'KB', 'land', land.length, 'prov', Object.fromEntries(Object.entries(prov).map(([k, v]) => [k, v.length])));
