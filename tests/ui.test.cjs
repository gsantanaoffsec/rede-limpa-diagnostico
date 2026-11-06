const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const read=file=>fs.readFileSync(path.join(__dirname,'../src/shared',file),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function setup(panel=false){
 const dom=new JSDOM(read('popup.html'),{url:'https://extension.local/'+(panel?'panel.html':'popup.html'),runScripts:'outside-only'}),w=dom.window;
 const records=[{id:'1',metodo:'GET',url:'https://localhost/api?dt_entrada=20102026',horario:new Date().toISOString(),status:200,resposta:{data:[],email:'joel@example.com'},grupoTemporal:'1'},{id:'2',metodo:'GET',url:'https://localhost/api?dt_entrada=2026-10-20',horario:new Date().toISOString(),status:500,resposta:'<img src=x onerror=alert(1)> Unknown column',grupoTemporal:'1'}];
 const state={records,capturingTab:9,snapshots:{},rules:[{host:'example.com',hide:true,block:false}]};const calls=[],copies=[];
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.applyExtensionTheme=()=>{};w.setInterval=()=>0;
 w.navigator.clipboard={writeText:async text=>copies.push(text)};
 w.chrome={runtime:{getManifest:()=>({manifest_version:3}),sendMessage:async m=>{calls.push(m);if(m.type==='preferences')return {theme:'light',uiMode:'popup'};if(m.type==='snapshot'){state.snapshots[m.slot]={records:structuredClone(records)};}return structuredClone(state);}},tabs:{query:async()=>[{id:9,title:'API local',url:'https://localhost'}]},...(panel?{devtools:{inspectedWindow:{tabId:9}}}:{})};
 for(const file of ['network-core.js','diagnostic-core.js','insights.js','popup.js'])w.eval(read(file));await tick();
 return {w,calls,copies,state,close:()=>w.close(),el:id=>w.document.getElementById(id),click:async id=>{w.document.getElementById(id).click();await tick();}};
}
test('painel renderiza resposta como texto e filtro de erros preserva seleção',async()=>{
 const f=await setup();try{assert.equal(f.el('requests').children.length,2);f.el('requests').children[1].click();assert(!f.el('details').querySelector('img'));assert.match(f.el('details').textContent,/<img/);f.el('onlyErrors').click();await tick();assert.equal(f.el('requests').children.length,1);assert.match(f.el('details').textContent,/500/);}finally{f.close();}
});
test('exportação exige revisão, remove email e invalida revisão após edição',async()=>{
 const f=await setup();try{await f.click('prepareExport');assert(!f.el('exportPreview').value.includes('joel@example.com'));assert(f.el('copyExport').disabled);await f.click('copyExport');assert.equal(f.copies.length,0);await f.click('reviewed');await f.click('copyExport');assert.equal(f.copies.length,1);f.el('exportPreview').value+='editado';f.el('exportPreview').dispatchEvent(new f.w.Event('input'));assert(f.el('copyExport').disabled);}finally{f.close();}
});
test('agrupamento mantém acesso a chamadas individuais; snapshots geram comparação',async()=>{
 const f=await setup();try{await f.click('groupRepeated');assert.equal(f.el('requests').children.length,1);f.el('requests').children[0].click();assert.match(f.el('details').textContent,/500/);await f.click('saveA');await f.click('saveB');await f.click('compare');assert.equal(f.el('comparison').hidden,false);assert.match(f.el('comparison').textContent,/Nenhuma diferença/);}finally{f.close();}
});
test('DevTools usa modo específico, mesmo painel e aba inspecionada',async()=>{
 const f=await setup(true);try{await f.click('start');assert(f.calls.some(m=>m.type==='startDevtools'&&m.tabId===9));assert(f.w.document.body.classList.contains('floating'));}finally{f.close();}
});
