"""대권 엠블럼(앱 아이콘) SVG 생성: 월계관 + 무궁화 + 태극 + 별"""
import math, sys

def emblem(frame=True, rounded=True, scale=1.0):
    cx, cy = 256, 262
    o = []
    o.append('<defs>'
      '<radialGradient id="eb-bg" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#1f3358"/><stop offset=".55" stop-color="#0d1628"/><stop offset="1" stop-color="#05080f"/></radialGradient>'
      '<linearGradient id="eb-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".35" stop-color="#f0cf7a"/><stop offset=".7" stop-color="#c8963a"/><stop offset="1" stop-color="#8a5f1c"/></linearGradient>'
      '<linearGradient id="eb-gold2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".5" stop-color="#d7a64a"/><stop offset="1" stop-color="#7d5418"/></linearGradient>'
      '<radialGradient id="eb-petal" cx="50%" cy="85%" r="90%"><stop offset="0" stop-color="#3d0410"/><stop offset=".5" stop-color="#a8102c"/><stop offset="1" stop-color="#e2475c"/></radialGradient>'
      '<radialGradient id="eb-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>'
      '</defs>')
    if frame:
        o.append(f'<rect width="512" height="512" rx="{112 if rounded else 0}" fill="url(#eb-bg)"/>')
        # 방사형 빛줄기
        for i in range(24):
            a = i * 15
            o.append(f'<path d="M256 262 L{256+300*math.cos(math.radians(a-2.2)):.1f} {262+300*math.sin(math.radians(a-2.2)):.1f} L{256+300*math.cos(math.radians(a+2.2)):.1f} {262+300*math.sin(math.radians(a+2.2)):.1f}Z" fill="#ffd27a" opacity="{0.05 if i%2 else 0.085}"/>')
    g = [f'<g transform="translate(256 262) scale({scale}) translate(-256 -262)">']
    g.append('<circle cx="256" cy="262" r="150" fill="url(#eb-glow)"/>')
    # 바깥 고리
    g.append('<circle cx="256" cy="262" r="196" fill="none" stroke="url(#eb-gold)" stroke-width="7"/>')
    g.append('<circle cx="256" cy="262" r="183" fill="none" stroke="#d7a64a" stroke-opacity=".45" stroke-width="2"/>')
    # 월계관: 아래(약 100°)에서 위(약 -40°)까지 양쪽
    R = 158
    for side in (-1, 1):
        for i in range(11):
            t = i / 10
            ang = math.radians(100 - t * 135) if side == 1 else math.radians(80 + t * 135)
            x, y = cx + R * math.cos(ang), cy + R * math.sin(ang)
            tang = math.degrees(ang) + (90 if side == 1 else -90)
            sz = 1 - t * 0.38
            for off in (-1, 1):
                rot = tang + off * 38 * side
                g.append(f'<path d="M0 0 C9 -9 10 -27 0 -40 C-10 -27 -9 -9 0 0Z" fill="url(#eb-gold2)" stroke="#5a3a0e" stroke-width="1.3" transform="translate({x:.1f} {y:.1f}) rotate({rot:.1f}) scale({sz:.2f})"/>')
        # 줄기
    g.append(f'<path d="M{cx+R*math.cos(math.radians(100)):.1f} {cy+R*math.sin(math.radians(100)):.1f} A{R} {R} 0 0 0 {cx+R*math.cos(math.radians(-35)):.1f} {cy+R*math.sin(math.radians(-35)):.1f}" fill="none" stroke="#8a5f1c" stroke-width="3"/>')
    g.append(f'<path d="M{cx+R*math.cos(math.radians(80)):.1f} {cy+R*math.sin(math.radians(80)):.1f} A{R} {R} 0 0 1 {cx+R*math.cos(math.radians(215)):.1f} {cy+R*math.sin(math.radians(215)):.1f}" fill="none" stroke="#8a5f1c" stroke-width="3"/>')
    # 무궁화 꽃잎 5장
    for i in range(5):
        g.append(f'<path d="M0 -8 C-46 -30 -58 -92 -26 -118 C-12 -128 12 -128 26 -118 C58 -92 46 -30 0 -8Z" fill="url(#eb-petal)" stroke="url(#eb-gold)" stroke-width="5" transform="translate(256 262) rotate({i*72})"/>')
        g.append(f'<path d="M0 -20 L0 -100" stroke="#ffd98a" stroke-opacity=".35" stroke-width="2" transform="translate(256 262) rotate({i*72})"/>')
    # 태극
    r = 44
    g.append(f'<circle cx="256" cy="262" r="{r+7}" fill="url(#eb-gold)"/>')
    g.append(f'<g transform="translate(256 262) rotate(-33.7)">'
             f'<path d="M{-r} 0 A{r} {r} 0 0 1 {r} 0 A{r/2} {r/2} 0 0 1 0 0 A{r/2} {r/2} 0 0 0 {-r} 0Z" fill="#cd2e3a"/>'
             f'<path d="M{-r} 0 A{r} {r} 0 0 0 {r} 0 A{r/2} {r/2} 0 0 1 0 0 A{r/2} {r/2} 0 0 0 {-r} 0Z" fill="#0047a0"/></g>')
    # 별
    pts = []
    for i in range(10):
        rr = 30 if i % 2 == 0 else 12.5
        a = math.radians(-90 + i * 36)
        pts.append(f'{256+rr*math.cos(a):.1f},{78+rr*math.sin(a):.1f}')
    g.append(f'<polygon points="{" ".join(pts)}" fill="url(#eb-gold)" stroke="#6b4512" stroke-width="2"/>')
    g.append('</g>')
    return ''.join(o + g)

def svg(**kw):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{emblem(**kw)}</svg>'

if __name__ == '__main__':
    open('icons/emblem.svg', 'w').write(svg())
    open('icons/emblem-maskable.svg', 'w').write(svg(rounded=False, scale=0.8))
    open('icons/emblem-mark.svg', 'w').write(svg(frame=False))
    print('ok')
