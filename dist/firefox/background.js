'use strict';
const session=new CaptureSession(browser),ui=new ExtensionUi(browser);
const records=session.records;
const {clean,cleanUrl,safeText,decodeBody}=DiagnosticCore;
function save(){return session.persist().catch(e=>{session.captureError='Falha ao salvar: '+safeText(e.message);});}
function badge(){browser.browserAction.setBadgeText({text:session.capturingTab===null?'':'ON'});browser.browserAction.setBadgeBackgroundColor({color:'#087f8c'});}
const ready=session.ready.then(async()=>{if(session.capturingTab!==null)try{await browser.tabs.get(session.capturingTab);}catch{session.capturingTab=null;}badge();});
function getRecord(id){return records.find(r=>r.id===id);}
async function beforeRequest(d){
  await ready;
  const hide=Insights.matchHost(d.url,session.rules,'hide'),block=Insights.matchHost(d.url,session.rules,'block');
  const u=new URL(d.url),cancels=block&&(u.hostname!==CleanNetwork.hiddenHost||(d.method==='GET'&&u.port===''));
  if(hide&&d.tabId===session.capturingTab&&session.capturingTab!==null)session.hidden++;
  if(cancels){session.blocked++;if(!hide&&d.tabId===session.capturingTab&&session.capturingTab!==null){const r={id:d.requestId,horario:new Date(d.timeStamp).toISOString(),metodo:d.method,...cleanUrl(d.url),status:null,estado:'Bloqueada por regra da extensão',erro:'Bloqueio de host configurado pelo usuário',resposta:null,corpoEnviado:null};session.decorate(r);records.unshift(r);}await save();return {cancel:true};}
  if(hide){await save();return {};}
  if(d.tabId!==session.capturingTab||session.capturingTab===null)return;
  const r={id:d.requestId,horario:new Date(d.timeStamp).toISOString(),metodo:d.method,...cleanUrl(d.url),status:null,corpoEnviado:null,resposta:null,estado:'Aguardando resposta',inicio:d.timeStamp};session.decorate(r);
  if(d.requestBody){
    const body=d.requestBody;
    if(body.formData){const text=JSON.stringify(clean(body.formData));r.corpoEnviado=decodeBody(new TextDecoder().decode(new TextEncoder().encode(text).slice(0,131072)));if(new TextEncoder().encode(text).length>131072)r.avisoEnvio='Corpo enviado truncado em 128 KiB.';}
    else if(body.raw){const decoder=new TextDecoder();let text='',length=0;for(const part of body.raw){if(!part.bytes)continue;const bytes=new Uint8Array(part.bytes);text+=decoder.decode(bytes.subarray(0,Math.max(0,131072-length)),{stream:true});length+=bytes.byteLength;}text+=decoder.decode();r.corpoEnviado=decodeBody(text);if(length>131072)r.avisoEnvio='Corpo enviado truncado em 128 KiB.';}
    if(body.error)r.avisoEnvio=safeText(body.error);
  }
  records.unshift(r);
  try{
    const filter=browser.webRequest.filterResponseData(d.requestId);const chunks=[];let length=0;
    filter.ondata=e=>{filter.write(e.data);const available=Math.max(0,131072-length);if(available)chunks.push(new Uint8Array(e.data).slice(0,available));length+=e.data.byteLength;};
    filter.onstop=()=>{try{if(records.includes(r)){
      if(/json|text\/plain/i.test(r.contentType||'')){const decoder=new TextDecoder();let text='';for(const chunk of chunks)text+=decoder.decode(chunk,{stream:true});text+=decoder.decode();r.resposta=decodeBody(text);if(length>131072)r.avisoResposta='Resposta truncada em 128 KiB.';}
      else r.avisoResposta='Corpo omitido: somente JSON e texto simples são capturados.';
    }}finally{filter.close();save();}};
    filter.onerror=()=>{if(records.includes(r)){r.avisoResposta='Não foi possível ler o corpo da resposta.';save();}};
  }catch{r.avisoResposta='Corpo indisponível; filtros e status continuam disponíveis.';}
  await save();
}
const filter={urls:['http://*/*','https://*/*'],types:['xmlhttprequest']};
browser.webRequest.onBeforeRequest.addListener(beforeRequest,filter,['blocking','requestBody']);
browser.webRequest.onHeadersReceived.addListener(d=>{const r=getRecord(d.requestId);if(!r)return;r.status=d.statusCode;r.contentType=(d.responseHeaders||[]).find(h=>h.name.toLowerCase()==='content-type')?.value||'';return save();},filter,['responseHeaders']);
browser.webRequest.onCompleted.addListener(d=>{const r=getRecord(d.requestId);if(r){r.status=d.statusCode;r.estado='Concluída';r.duracaoMs=Math.max(0,Math.round(d.timeStamp-r.inicio));return save();}},filter);
browser.webRequest.onErrorOccurred.addListener(d=>{const r=getRecord(d.requestId);if(r){r.estado='Erro de rede';r.erro=safeText(d.error);return save();}},filter);
browser.tabs.onRemoved.addListener(id=>{if(id===session.capturingTab){session.capturingTab=null;badge();return save();}});
browser.runtime.onMessage.addListener(async m=>{
  await ready;const result=await ui.handle(m);if(result!==undefined)return result;
  if(m.type==='start'){if(!Number.isInteger(m.tabId))throw new Error('Aba inválida.');const tab=await browser.tabs.get(m.tabId);if(!/^https?:/.test(tab.url||''))throw new Error('Escolha uma aba HTTP/HTTPS.');session.capturingTab=m.tabId;session.captureError='';badge();}
  else if(m.type==='stop'){session.capturingTab=null;badge();}
  else if(m.type==='clear'){records.length=0;session.hidden=0;session.blocked=0;}
  else if(m.type==='blocking'){const rules=session.rules.map(r=>({...r}));const rule=rules.find(r=>r.host===CleanNetwork.hiddenHost);if(rule)rule.block=!!m.enabled;await session.handle({type:'hostRules',rules});await browser.storage.local.set({blockKaspersky:!!m.enabled});}
  else{const shared=await session.handle(m);if(shared!==undefined)return shared;}
  if(m.type!=='state')await save();
  return {...session.state(),blockKaspersky:session.rules.some(r=>r.host===CleanNetwork.hiddenHost&&r.block)};
});
