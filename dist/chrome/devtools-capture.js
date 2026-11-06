/* Adaptador Chrome DevTools: mesma sessão, sem disputa pela API debugger. */
(() => {
  const api=globalThis.chrome;
  if(!api?.devtools?.network||api.runtime.getManifest().manifest_version!==3)return;
  api.devtools.network.onRequestFinished.addListener(async entry=>{
    try{
      const tabId=api.devtools.inspectedWindow.tabId;
      const state=await api.runtime.sendMessage({type:'state'});
      if(state.capturingTab!==tabId||state.captureMode!=='devtools')return;
      // O painel também recebe outras categorias; só coleta fetch/XHR quando identificadas.
      const kind=String(entry._resourceType||'').toLowerCase();
      if(kind&&!['fetch','xhr','xmlhttprequest'].includes(kind))return;
      if(!kind)return;
      const r={id:'devtools-'+Date.now()+'-'+Math.random().toString(36).slice(2),horario:entry.startedDateTime,metodo:entry.request.method,...DiagnosticCore.cleanUrl(entry.request.url),status:entry.response.status||null,contentType:entry.response.content.mimeType||'',duracaoMs:Math.max(0,Math.round(entry.time||0)),estado:entry.response.status?'Concluída':'Erro de rede',corpoEnviado:null,resposta:null};
      const limit=text=>new TextDecoder().decode(new TextEncoder().encode(text).slice(0,131072));
      if(entry.request.postData?.text){const body=entry.request.postData.text;r.corpoEnviado=DiagnosticCore.decodeBody(limit(body));if(new TextEncoder().encode(body).length>131072)r.avisoEnvio='Corpo enviado truncado em 128 KiB.';}
      if(/json|text\/plain/i.test(r.contentType)){
        const result=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(null),3000);entry.getContent((text,encoding)=>{clearTimeout(timer);resolve({text,encoding});});});
        if(!result||result.text==null)r.avisoResposta='Corpo indisponível no DevTools.';
        else if(result.encoding==='base64')r.avisoResposta='Corpo binário/base64 omitido.';
        else{r.resposta=DiagnosticCore.decodeBody(limit(result.text));if(new TextEncoder().encode(result.text).length>131072)r.avisoResposta='Resposta truncada em 128 KiB.';}
      }else r.avisoResposta='Corpo omitido: somente JSON e texto simples são capturados.';
      await api.runtime.sendMessage({type:'devtoolsRecord',tabId,epoch:state.captureEpoch,record:r});
    }catch(e){console.warn('Rede limpa: captura DevTools indisponível',e.message);}
  });
})();
