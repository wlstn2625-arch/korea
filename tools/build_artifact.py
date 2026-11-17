"""index.html + css + js 를 하나의 HTML로 합칩니다.
사용: python3 tools/build_artifact.py
  → dist/newkorea.html          claude.ai 아티팩트용 (API 키 대신 보는 사람의 Claude 계정으로 AI 동작)
  → dist/daegwon-offline.html  오프라인용 단일 파일 (저장해 두고 브라우저로 열면 인터넷 없이 실행)
  → sw.js                       웹 서버·앱 설치(PWA)용 서비스 워커 (파일 목록·버전 자동 갱신)"""
import pathlib, re, hashlib, json
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css/style.css').read_text(encoding='utf-8')
body = re.search(r'<body>(.*?)<script', html, re.S).group(1)
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
js = ['<script>/* boot */ window.__BODY0 = document.body.innerHTML;</script>']
for src in scripts:
    code = (root / src).read_text(encoding='utf-8')
    assert '</script' not in code.lower(), src
    js.append(f'<script>\n/* {src} */\n{code}\n</script>')
out = f'''<title>대권 — 대한민국 대통령 시뮬레이션</title>
<meta name="description" content="대한민국 대통령이 되어 모든 제도를 바꿔가며 새로운 대한민국을 만드는 정책 시뮬레이션 게임">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
{css}
</style>
{body.strip()}
{chr(10).join(js)}
'''
dist = root / 'dist'; dist.mkdir(exist_ok=True)
(dist / 'newkorea.html').write_text(out, encoding='utf-8')
print('wrote', dist / 'newkorea.html', len(out.encode()), 'bytes')

# 오프라인 단일 파일: 완전한 HTML 문서 (글꼴은 인터넷이 있으면 받고, 없으면 기기 기본 한글 글꼴)
offline = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0e1622">
{out.split('<style>')[0]}<style>
{css}
</style>
</head>
<body>
{body.strip()}
{chr(10).join(js)}
</body>
</html>
'''
(dist / 'daegwon-offline.html').write_text(offline, encoding='utf-8')
print('wrote', dist / 'daegwon-offline.html', len(offline.encode()), 'bytes')

# 서비스 워커: 캐시할 파일 목록과 내용 해시로 버전을 만들어 업데이트 시 새로 받게 함
assets = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'js/vendor/anthropic-sdk.mjs',
          'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-512.png'] + scripts
h = hashlib.sha1()
for a in assets[1:]:
    h.update((root / a).read_bytes())
sw = (root / 'sw.js').read_text(encoding='utf-8')
sw = re.sub(r"const CACHE = '[^']*';", f"const CACHE = 'newkorea-{h.hexdigest()[:10]}';", sw)
sw = re.sub(r"const ASSETS = \[.*?\];", 'const ASSETS = ' + json.dumps(assets, ensure_ascii=False) + ';', sw, flags=re.S)
(root / 'sw.js').write_text(sw, encoding='utf-8')
print('updated sw.js', h.hexdigest()[:10], len(assets), 'files')
