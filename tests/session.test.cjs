const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup(data = {}) {
  const store={ get: async key => ({ [key]: data[key] }), set: async value => Object.assign(data, value) };
  const api = { storage: { local:store,session:store } };
  const ctx = vm.createContext({ URL, TextEncoder, Date, console });
  for (const file of ['diagnostic-core.js','insights.js','capture-session.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/shared',file),'utf8'),ctx);
  return { session: new ctx.CaptureSession(api), data };
}
const entry = n => ({ id:String(n), horario:new Date().toISOString(), metodo:'GET',url:'https://localhost/api?token=SECRET',resposta:{data:[],token:'SECRET'} });
test('captura sobrevive à recriação do worker, com credenciais removidas e aba restaurada', async () => {
  const a=setup(); await a.session.ready; a.session.capturingTab=9; a.session.records.push(entry(1)); await a.session.persist();
  const b=setup(a.data); await b.session.ready; assert.equal(b.session.records.length,1); assert.equal(b.session.capturingTab,9); assert(!JSON.stringify(a.data).includes('SECRET'));
});
test('dados vencidos são descartados inclusive snapshots', async () => {
  const a=setup({captureV2:{savedAt:1,records:[entry(1)],snapshots:{A:[entry(2)]}}}); await a.session.ready;
  assert.equal(a.session.records.length,0); assert.equal(Object.keys(a.session.snapshots).length,0);
});
test('snapshots A/B independem da limpeza corrente; apagar tudo remove ambos', async () => {
  const {session}=setup(); await session.ready; session.records.push(entry(1)); await session.handle({type:'snapshot',slot:'A'});
  session.records.length=0; assert.equal(session.snapshots.A.records.length,1);
  await session.handle({type:'eraseAll'}); assert.equal(Object.keys(session.snapshots).length,0); assert.equal(session.records.length,0);
});
test('limites e regras são validados antes de persistir', async () => {
  const {session}=setup(); await session.ready; for(let n=0;n<400;n++)session.records.push(entry(n)); await session.persist(); assert.equal(session.records.length,300);
  await assert.rejects(session.handle({type:'hostRules',rules:[{host:'*.com',hide:true}]}));
});
test('marcador associa somente chamadas dentro da janela temporal e permite encerrar', async () => {
  const {session}=setup(); await session.ready; await session.handle({type:'markAction',label:'Localizar',seconds:15});
  const first=entry(1); session.decorate(first); assert.equal(first.acao,'Localizar');
  await session.handle({type:'endAction'}); const next=entry(2);session.decorate(next);assert(!next.acao);
});
test('limite total em bytes inclui snapshots e sinaliza redução quando necessário',async()=>{
 const {session,data}=setup();await session.ready;
 for(let n=0;n<16;n++)session.records.push({...entry(n),resposta:'á'.repeat(131072)});
 await session.handle({type:'snapshot',slot:'A'});await session.handle({type:'snapshot',slot:'B'});
 assert(Buffer.byteLength(JSON.stringify(data.captureV2))<=6*1024*1024);
 assert(session.records.length<16||session.snapshots.A.truncated||session.snapshots.B.truncated);
});
test('reiniciar navegador preserva dados, mas não retoma um ID de aba antigo',async()=>{
 const a=setup();await a.session.ready;a.session.capturingTab=9;a.session.records.push(entry(1));await a.session.persist();
 const data=structuredClone(a.data);delete data.captureControl;const b=setup(data);await b.session.ready;assert.equal(b.session.capturingTab,null);assert.equal(b.session.records.length,1);
});
test('snapshots cheios não impedem capturar registros novos',async()=>{
 const {session}=setup();await session.ready;
 const old=new Date(Date.now()-60000).toISOString();
 for(const slot of ['A','B'])session.snapshots[slot]={createdAt:new Date().toISOString(),records:Array.from({length:20},(_,n)=>({...entry(n),horario:old,resposta:'á'.repeat(131072)}))};
 session.records.unshift({...entry('nova'),resposta:'novo'});await session.persist();assert.equal(session.records[0].id,'nova');assert(session.snapshots.A.truncated||session.snapshots.B.truncated);
});
test('marcador usa início da chamada, inclusive resposta DevTools entregue após encerrar',async()=>{
 const {session}=setup();await session.ready;
 await session.handle({type:'markAction',label:'Pesquisar',seconds:15});const when=Date.now();
 const before={...entry('antes'),horario:new Date(when-1000).toISOString()};session.decorate(before);assert(!before.acao);
 await new Promise(resolve=>setTimeout(resolve,10));await session.handle({type:'endAction'});
 const late={...entry('tardia'),horario:new Date(when+1).toISOString()};session.decorate(late);assert.equal(late.acao,'Pesquisar');
});
