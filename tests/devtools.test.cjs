const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(mode='devtools'){
 let listener;const sent=[];
 const api={runtime:{getManifest:()=>({manifest_version:3}),sendMessage:async m=>{sent.push(m);return {capturingTab:9,captureMode:mode,captureEpoch:123};}},devtools:{inspectedWindow:{tabId:9},network:{onRequestFinished:{addListener(fn){listener=fn;}}}}};
 const ctx=vm.createContext({chrome:api,URL,Date,Math,TextEncoder,TextDecoder,setTimeout,clearTimeout,console});
 for(const name of ['diagnostic-core.js','devtools-capture.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/shared',name),'utf8'),ctx);
 return {sent,fire:entry=>listener(entry)};
}
const entry=()=>({_resourceType:'fetch',startedDateTime:new Date().toISOString(),time:10,request:{url:'https://localhost/api?token=SECRET',method:'GET'},response:{status:200,content:{mimeType:'application/json'}},getContent(callback){callback('{"token":"SECRET","data":[1]}','');}});
test('adaptador DevTools preserva epoch, tipo, resposta e remove token',async()=>{
 const fx=fixture();await fx.fire(entry());const m=fx.sent.find(m=>m.type==='devtoolsRecord');assert(m);assert.equal(m.epoch,123);assert.equal(m.record.resposta.data[0],1);assert(!JSON.stringify(m).includes('SECRET'));
});
test('adaptador não duplica capturador nativo nem coleta documentos',async()=>{
 const native=fixture('native');await native.fire(entry());assert(!native.sent.some(m=>m.type==='devtoolsRecord'));
 const fx=fixture();await fx.fire({...entry(),_resourceType:'document'});assert(!fx.sent.some(m=>m.type==='devtoolsRecord'));
});
