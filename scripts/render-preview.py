"""Renderiza UI com dados fictícios em Chrome headless; não testa a API da extensão."""
from pathlib import Path
import argparse
import json
import shutil
import subprocess
import tempfile

parser=argparse.ArgumentParser()
parser.add_argument('--chrome',required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
preview=root/'test-results'/'preview'
preview.mkdir(parents=True,exist_ok=True)
assets=root/'docs'/'assets'
assets.mkdir(parents=True,exist_ok=True)
for file in (root/'src'/'shared').iterdir():
    if file.is_file():shutil.copy2(file,preview/file.name)
html=(preview/'popup.html').read_text(encoding='utf-8').replace('<script src="theme.js">','<script src="mock-api.js"></script><script src="theme.js">').replace('REDE LIMPA · 2.0','REDE LIMPA · 2.0 · DEMONSTRAÇÃO')
(preview/'popup.html').write_text(html,encoding='utf-8')
(preview/'mock-api.js').write_text('''
const demo=[
{id:'1',metodo:'GET',url:'https://app.exemplo.com/contas?dt_entrada=20102026',horario:new Date().toISOString(),status:200,resposta:{data:[],total:0},duracaoMs:214,acao:'Pesquisar contas',acaoId:'demo',grupoTemporal:'demo'},
{id:'2',metodo:'GET',url:'https://app.exemplo.com/contas?dt_entrada=2026-10-20',horario:new Date().toISOString(),status:200,resposta:{data:[{codigo:42,nome:'Pessoa fictícia'}],total:1},duracaoMs:183,acao:'Pesquisar contas',acaoId:'demo',grupoTemporal:'demo'}
];
const demoState={records:demo,capturingTab:null,snapshots:{A:{records:[demo[0]]},B:{records:[demo[1]]}},rules:[{host:'ff.kes.v2.scr.kaspersky-labs.com',hide:true,block:true}],hidden:12,blocked:null};
globalThis.chrome={storage:{local:{get:async()=>({theme:new URLSearchParams(location.search).get('theme')||'light'})},onChanged:{addListener(){}}},runtime:{getManifest:()=>({manifest_version:3}),sendMessage:async m=>m.type==='preferences'?{theme:new URLSearchParams(location.search).get('theme')||'light',uiMode:'popup'}:structuredClone(demoState)},tabs:{query:async()=>[{id:9,title:'Aplicação de demonstração',url:'https://app.exemplo.com'}]}};
''',encoding='utf-8')
(preview/'geometry.html').write_text('''<!doctype html><html><body><iframe style="width:18px;height:580px" src="popup.html"></iframe><pre id="geometry">aguardando</pre><script>setTimeout(()=>{const w=document.querySelector('iframe').contentWindow;document.getElementById('geometry').textContent=JSON.stringify({body:w.document.body.getBoundingClientRect().width,html:w.document.documentElement.getBoundingClientRect().width,requests:w.document.getElementById('requests').children.length});},1000)</script></body></html>''',encoding='utf-8')
with tempfile.TemporaryDirectory(prefix='rede-limpa-chrome-') as profile:
    common=[args.chrome,'--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--user-data-dir='+profile,'--allow-file-access-from-files','--virtual-time-budget=2000']
    for theme in ('light','dark'):
        result=subprocess.run(common+['--window-size=1280,800','--hide-scrollbars','--screenshot='+str(assets/f'demo-{theme}.png'),(preview/'popup.html').as_uri()+'?floating=1&theme='+theme],capture_output=True,timeout=40)
        if result.returncode:raise SystemExit(result.stderr.decode(errors='replace'))
    result=subprocess.run(common+['--dump-dom',(preview/'geometry.html').as_uri()],capture_output=True,timeout=40)
    text=result.stdout.decode(encoding='utf-8',errors='replace')
    (preview/'geometry-result.html').write_text(text,encoding='utf-8')
    import re
    match=re.search(r'<pre id="geometry">(.*?)</pre>',text)
    if not match:raise SystemExit('Não foi possível medir o popup')
    geometry=json.loads(match[1])
    assert geometry['body']==680 and geometry['html']==680 and geometry['requests']==2,geometry
    print(json.dumps(geometry))
print('Screenshots de demonstração geradas em docs/assets. Não equivalem a instalação real.')
