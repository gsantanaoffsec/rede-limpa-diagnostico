const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(target,name)=>fs.readFileSync(path.join(root,'src',target,name),'utf8');
function event(){const listeners=[];return {addListener(fn){listeners.push(fn);},fire(...args){return Promise.all(listeners.map(fn=>fn(...args)));}};}
function storage(){const data={};return {data,get:async key=>typeof key==='string'?{[key]:data[key]}:Object.fromEntries(key.map(k=>[k,data[k]])),set:async values=>Object.assign(data,values)};}
function fixture(target){
 const local=storage(),session=storage(),commands=[],windows=[],filters={};
 const api={storage:{local,session},runtime:{onMessage:event(),getURL:name=>'moz-extension://test/'+name},tabs:{onRemoved:event(),get:async id=>({id,url:'https://localhost/app'}),update:async()=>({})},windows:{create:async props=>{windows.push(props);return {id:1};},get:async id=>({id,tabs:[{id:22,url:'moz-extension://test/popup.html'}]}),update:async()=>({})},action:{setBadgeText(){},setBadgeBackgroundColor(){}},browserAction:{setBadgeText(){},setBadgeBackgroundColor(){}},declarativeNetRequest:{updateEnabledRulesets:async args=>commands.push(['rules',args])},debugger:{attach:async()=>commands.push(['attach']),detach:async()=>commands.push(['detach']),sendCommand:async(source,method,params)=>{commands.push([method,params]);if(method==='Network.getResponseBody')return {body:'{"total":2,"token":"SECRET"}',base64Encoded:false};return {};},onEvent:event(),onDetach:event()},webRequest:{onBeforeRequest:event(),onHeadersReceived:event(),onCompleted:event(),onErrorOccurred:event(),filterResponseData(id){return filters[id]={write(data){this.original=data;},close(){this.closed=true;}};}}};
 const ctx=vm.createContext({browser:api,chrome:api,URL,TextDecoder,Uint8Array,Promise,Date,console});
 ctx.importScripts=(...files)=>{for(const name of files)vm.runInContext(read('shared',name),ctx);};
 if(target==='firefox')ctx.importScripts('network-core.js','diagnostic-core.js','extension-ui.js');
 vm.runInContext(read(target,'background.js'),ctx);
 const message=value=>target==='chrome'?new Promise(resolve=>api.runtime.onMessage.fire(value,{},resolve)):api.runtime.onMessage.fire(value).then(a=>a[0]);
 return {api,message,local,commands,windows,filters};
}
for(const browser of ['firefox','chrome']){
 test(browser+': tema e modo de janela persistem; janela não duplica',async()=>{
  const fx=fixture(browser);await fx.message({type:'setPreferences',theme:'dark',uiMode:'floating'});
  assert.equal((await fx.message({type:'preferences'})).theme,'dark');assert.equal(fx.local.data.uiMode,'floating');
  await fx.message({type:'floating',tabId:9});await fx.message({type:'floating',tabId:9});assert.equal(fx.windows.length,1);assert.match(fx.windows[0].url,/tabId=9/);
 });
 test(browser+': captura inicia/paralisa e bloqueio persiste',async()=>{
  const fx=fixture(browser);await fx.message({type:'start',tabId:9});assert.equal((await fx.message({type:'state'})).capturingTab,9);
  await fx.message({type:'stop'});assert.equal((await fx.message({type:'state'})).capturingTab,null);
  await fx.message({type:'blocking',enabled:false});assert.equal(fx.local.data.blockKaspersky,false);
 });
}
test('Firefox: bloqueio exato sem poluir lista; resposta passa intacta',async()=>{
 const fx=fixture('firefox');await fx.message({type:'start',tabId:9});
 const call=url=>fx.api.webRequest.onBeforeRequest.fire({requestId:'1',tabId:9,url,method:'GET',timeStamp:1000}).then(a=>a[0]);
 assert.equal((await call('http://ff.kes.v2.scr.kaspersky-labs.com/a')).cancel,true);
 assert.equal((await fx.message({type:'state'})).records.length,0);
 await call('https://localhost/api?token=SECRET&nome=Joel');
 await fx.api.webRequest.onHeadersReceived.fire({requestId:'1',statusCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}]});
 const data=new TextEncoder().encode('{"data":[],"token":"SECRET"}').buffer;fx.filters['1'].ondata({data});fx.filters['1'].onstop();
 const state=await fx.message({type:'state'});assert(!JSON.stringify(state).includes('SECRET'));assert.equal(fx.filters['1'].original,data);assert(fx.filters['1'].closed);
});
test('Chrome: resposta e filtros capturados sem vazamento de token',async()=>{
 const fx=fixture('chrome');await fx.message({type:'start',tabId:9});
 await fx.api.debugger.onEvent.fire({tabId:9},'Network.requestWillBeSent',{requestId:'1',type:'Fetch',timestamp:1,request:{url:'https://localhost/api?nome=Joel&token=SECRET',method:'POST',postData:'{"senha":"SECRET"}'}});
 await fx.api.debugger.onEvent.fire({tabId:9},'Network.responseReceived',{requestId:'1',response:{status:200,mimeType:'application/json'}});
 await fx.api.debugger.onEvent.fire({tabId:9},'Network.loadingFinished',{requestId:'1',timestamp:1.2});await new Promise(r=>setTimeout(r,0));
 const state=await fx.message({type:'state'});assert.equal(state.records[0].resposta.total,2);assert.equal(state.records[0].duracaoMs,200);assert(!JSON.stringify(state).includes('SECRET'));
});
test('geometria: largura mínima explícita sem dependência circular de 100vw',()=>{
 const css=read('shared','popup.css');assert(!css.includes('max-width:100vw'));
 assert(css.includes('html{width:680px;min-width:680px;max-width:680px;'));
 assert(css.includes('html:has(body.floating){width:100%;min-width:340px;max-width:none}'));
});
test('pacotes têm recursos necessários e nenhuma documentação TXT',()=>{
 for(const target of ['chrome','firefox']){const m=JSON.parse(read(target,'manifest.json'));assert.equal(m.version,'1.2.1');for(const name of [...(m.background.scripts||[m.background.service_worker]),m.devtools_page,(m.action||m.browser_action).default_popup,...Object.values(m.icons)])assert(fs.existsSync(path.join(root,'src',target,name))||fs.existsSync(path.join(root,'src/shared',name)),name);}
});
