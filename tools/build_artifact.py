"""index.html + css + js 를 하나의 claude.ai 아티팩트용 HTML로 합칩니다.
사용: python3 tools/build_artifact.py  →  dist/newkorea.html
(아티팩트에서는 API 키 대신 보는 사람의 Claude 계정으로 AI가 동작합니다)"""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css/style.css').read_text(encoding='utf-8')
body = re.search(r'<body>(.*?)<script', html, re.S).group(1)
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
js = []
for src in scripts:
    code = (root / src).read_text(encoding='utf-8')
    assert '</script' not in code.lower(), src
    js.append(f'<script>\n/* {src} */\n{code}\n</script>')
out = f'''<title>새로운 대한민국</title>
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
