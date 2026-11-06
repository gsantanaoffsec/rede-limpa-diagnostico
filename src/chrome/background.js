importScripts('network-core.js','diagnostic-core.js','insights.js','capture-session.js','extension-ui.js');
const session = new CaptureSession(chrome), ui = new ExtensionUi(chrome);
const records = session.records;
const {cleanUrl,safeText,decodeBody} = DiagnosticCore;
let generation=0;
function bounded(text) { return new TextDecoder().decode(new TextEncoder().encode(text).slice(0,131072)); }
function save() { return session.persist().catch(e=>{session.captureError='Falha ao salvar captura: '+safeText(e.message);}); }
function badge() { chrome.action.setBadgeText({text:session.capturingTab===null?'':'ON'});chrome.action.setBadgeBackgroundColor({color:'#087f8c'}); }
async function applyRules() {
  await chrome.declarativeNetRequest.updateEnabledRulesets({enableRulesetIds:[],disableRulesetIds:['kaspersky_polling']});
  const previous=await chrome.declarativeNetRequest.getDynamicRules();
  const rules=session.rules.filter(r=>r.block).map((r,i)=>({id:1000+i,priority:1,action:{type:'block'},condition:{
    regexFilter:'^https?://' + r.host.replace(/\./g,'\\.') + (r.host===CleanNetwork.hiddenHost ? '/' : '(?::[0-9]+)?/'),
    isUrlFilterCaseSensitive:false,resourceTypes:['xmlhttprequest'],...(r.host===CleanNetwork.hiddenHost?{requestMethods:['get']}:{}),
  }}));
  await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:previous.filter(r=>r.id>=1000&&r.id<1030).map(r=>r.id),addRules:rules});
}
const ready=session.ready.then(async()=>{
  await applyRules();
  if(session.capturingTab!==null && session.captureMode!=='devtools') {
    const targets=await chrome.debugger.getTargets();
    if(!targets.some(t=>t.tabId===session.capturingTab&&t.attached)) {session.capturingTab=null;session.captureError='Captura recuperada do armazenamento. Inicie novamente para continuar.';}
  }
  badge();
}).catch(e=>{session.captureError=safeText(e.message);session.capturingTab=null;});
async function stop(){const tabId=session.capturingTab;session.capturingTab=null;generation++;badge();if(tabId!==null)try{await chrome.debugger.detach({tabId});}catch{}await save();}
async function start(tabId){
  if(!Number.isInteger(tabId))throw new Error('Escolha uma aba válida.');
  if(session.capturingTab===tabId&&session.captureMode==='native')return;
  await stop(); const tab=await chrome.tabs.get(tabId);
  if(!/^https?:/.test(tab.url||''))throw new Error('Escolha uma aba HTTP/HTTPS.');
  try{await chrome.debugger.attach({tabId},'1.3');session.capturingTab=tabId;session.captureMode='native';await chrome.debugger.sendCommand({tabId},'Network.enable',{maxTotalBufferSize:8388608,maxResourceBufferSize:1048576,maxPostDataSize:131072});session.captureError='';badge();await save();}
  catch(e){await stop();throw new Error('Não foi possível iniciar. Se o DevTools estiver usando a aba, feche-o e inicie pelo popup. '+e.message);}
}
async function onNetwork(source,method,p){
  await ready;
  if(source.tabId!==session.capturingTab||source.sessionId||session.captureMode!=='native')return;
  const token=generation;
  if(method==='Network.requestWillBeSent'){
    if(!['XHR','Fetch'].includes(p.type))return;
    if(Insights.matchHost(p.request.url,session.rules,'hide')){session.hidden++;await save();return;}
    const r={id:p.requestId,horario:new Date((p.wallTime||Date.now()/1000)*1000).toISOString(),metodo:p.request.method,...cleanUrl(p.request.url),status:null,corpoEnviado:null,resposta:null,estado:'Aguardando resposta',inicio:p.timestamp};
    session.decorate(r); const old=records.findIndex(item=>item.id===r.id);if(old>=0)records.splice(old,1);records.unshift(r);await save();
    let body=p.request.postData;
    if(!body&&p.request.hasPostData)try{body=(await chrome.debugger.sendCommand(source,'Network.getRequestPostData',{requestId:p.requestId})).postData;}catch{r.avisoEnvio='Corpo enviado indisponível.';}
    if(body&&token===generation&&records.includes(r)){r.corpoEnviado=decodeBody(bounded(body));if(new TextEncoder().encode(body).length>131072)r.avisoEnvio='Corpo enviado truncado em 128 KiB.';await save();}
    return;
  }
  const r=records.find(item=>item.id===p.requestId);if(!r)return;
  if(method==='Network.responseReceived'){r.status=p.response.status;r.contentType=p.response.mimeType||'';}
  if(method==='Network.loadingFailed'){r.estado='Erro de rede';r.erro=safeText(p.errorText);}
  if(method==='Network.loadingFinished'){
    r.estado='Concluída';r.duracaoMs=Math.max(0,Math.round((p.timestamp-r.inicio)*1000));
    if(!/json|text\/plain/i.test(r.contentType||''))r.avisoResposta='Corpo omitido: somente JSON e texto simples são capturados.';
    else try{
      const result=await chrome.debugger.sendCommand(source,'Network.getResponseBody',{requestId:p.requestId});
      if(token!==generation||!records.includes(r))return;
      if(result.base64Encoded)r.avisoResposta='Corpo binário/base64 omitido.';
      else{r.resposta=decodeBody(bounded(result.body));if(new TextEncoder().encode(result.body).length>131072)r.avisoResposta='Resposta truncada em 128 KiB.';}
    }catch{r.avisoResposta='Corpo indisponível ou descartado pelo navegador.';}
  }
  await save();
}
chrome.debugger.onEvent.addListener((...args)=>onNetwork(...args).catch(e=>{session.captureError=safeText(e.message);}));
chrome.debugger.onDetach.addListener(source=>{if(source.tabId===session.capturingTab){session.capturingTab=null;generation++;session.captureError='Captura encerrada pelo navegador. Inicie para retomar.';badge();return save();}});
chrome.tabs.onRemoved.addListener(tabId=>{if(tabId===session.capturingTab){session.capturingTab=null;generation++;badge();return save();}});
async function handle(m){
  await ready;const result=await ui.handle(m);if(result!==undefined)return result;
  if(m.type==='startDevtools'){
    if(!Number.isInteger(m.tabId))throw new Error('Aba inválida.');
    const tab=await chrome.tabs.get(m.tabId);if(!/^https?:/.test(tab.url||''))throw new Error('Escolha uma aba HTTP/HTTPS.');
    await stop();session.epoch++;session.captureMode='devtools';session.capturingTab=m.tabId;session.captureError='';badge();await save();return session.state();
  }
  if(m.type==='devtoolsRecord'){
    if(session.captureMode!=='devtools'||m.tabId!==session.capturingTab||m.epoch!==session.epoch)return session.state();
    if(!m.record||!/^https?:/.test(m.record.url||'')||JSON.stringify(m.record).length>400000)throw new Error('Registro DevTools inválido.');
    if(Insights.matchHost(m.record.url,session.rules,'hide'))session.hidden++;
    else{const r=Insights.review(m.record,[],false).records;session.decorate(r);records.unshift(r);}
    await save();return session.state();
  }
  if(m.type==='hostRules'){
    const previous=session.rules.map(r=>({...r}));
    try{await session.handle(m);await applyRules();}catch(e){session.rules=previous;await chrome.storage.local.set({hostRules:previous});throw e;}
  }else if(m.type==='blocking'){
    const rules=session.rules.map(r=>({...r}));const rule=rules.find(r=>r.host===CleanNetwork.hiddenHost);if(rule)rule.block=!!m.enabled;
    await handle({type:'hostRules',rules});await chrome.storage.local.set({blockKaspersky:!!m.enabled});
  }else if(m.type==='start')await start(m.tabId);
  else if(m.type==='stop')await stop();
  else if(m.type==='clear'){session.epoch++;records.length=0;session.hidden=0;generation++;await save();}
  else{const shared=await session.handle(m);if(shared!==undefined)return shared;}
  return {...session.state(),blocked:null,blockKaspersky:session.rules.some(r=>r.host===CleanNetwork.hiddenHost&&r.block)};
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{handle(m).then(reply,e=>reply({error:safeText(e.message)}));return true;});
