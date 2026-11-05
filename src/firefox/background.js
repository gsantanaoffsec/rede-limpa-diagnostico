/* Dados ficam somente na memória desta extensão. Nenhum envio externo. */
'use strict';
const MAX_RECORDS = 100;
const MAX_BYTES = 131072;
const {clean, cleanUrl, safeText, decodeBody} = DiagnosticCore;
const ui = new ExtensionUi(browser);
const records = [];
let capturingTab = null;
let blockKaspersky = true;
let blocked = 0;
let hidden = 0;
let configVersion = 0;
const configReady = browser.storage.local.get('blockKaspersky').then(settings => {
  if (configVersion === 0) blockKaspersky = settings.blockKaspersky !== false;
}).catch(() => {});
function kasperskyDecision(details) {
  if (!CleanNetwork.isHidden(details.url)) return false;
  let url;
  try { url = new URL(details.url); } catch (_) { return false; }
  if (details.tabId === capturingTab && capturingTab !== null) hidden++;
  // Mesma abrangência da regra original: GET + XHR/fetch, HTTP(S), porta padrão.
  if (blockKaspersky && details.method === 'GET' && /^https?:$/.test(url.protocol) && url.port === '') {
    blocked++;
    return {cancel:true};
  }
  return {}; // Host oculto nos painéis, inclusive quando o bloqueio está desligado.
}
function getRecord(id) { return records.find(record => record.id === id); }
function badge() {
  browser.browserAction.setBadgeText({text:capturingTab === null ? '' : 'ON'});
  browser.browserAction.setBadgeBackgroundColor({color:'#087f8c'});
}
function beforeRequest(details) {
  const decision = kasperskyDecision(details);
  if (decision !== false) return decision;
  if (details.tabId !== capturingTab || capturingTab === null) return;
  const record = {
    id:details.requestId, horario:new Date(details.timeStamp).toISOString(),
    metodo:details.method, ...cleanUrl(details.url), status:null,
    corpoEnviado:null, resposta:null, estado:'Aguardando resposta', inicio:details.timeStamp
  };
  if (details.requestBody) {
    const body = details.requestBody;
    if (body.formData) record.corpoEnviado = clean(body.formData);
    else if (body.raw) {
      const decoder = new TextDecoder(); let text = ''; let count = 0;
      for (const part of body.raw) {
        if (!part.bytes) continue;
        const bytes = new Uint8Array(part.bytes);
        const available = Math.max(0, MAX_BYTES - count);
        text += decoder.decode(bytes.subarray(0, available), {stream:true});
        count += bytes.byteLength;
      }
      text += decoder.decode();
      record.corpoEnviado = decodeBody(text);
      if (count > MAX_BYTES) record.avisoEnvio = 'Corpo limitado a 128 KiB.';
    }
  }
  records.unshift(record);
  if (records.length > MAX_RECORDS) records.pop();
  // O filtro sempre devolve os bytes originais à página, sem alteração.
  try {
    const filter = browser.webRequest.filterResponseData(details.requestId);
    const chunks = []; let length = 0;
    filter.ondata = event => {
      filter.write(event.data);
      const remaining = MAX_BYTES - length;
      if (remaining > 0) {
        const bytes = new Uint8Array(event.data);
        chunks.push(bytes.slice(0, remaining));
      }
      length += event.data.byteLength;
    };
    filter.onstop = () => {
      try {
        const current = getRecord(details.requestId);
        if (current) {
          if (/json|text\/plain|problem\+json/i.test(current.contentType || '')) {
            const decoder = new TextDecoder(); let text = '';
            for (const chunk of chunks) text += decoder.decode(chunk, {stream:true});
            text += decoder.decode();
            current.resposta = decodeBody(text);
            if (length > MAX_BYTES) current.avisoResposta = 'Resposta limitada a 128 KiB.';
          } else current.resposta = '[Corpo omitido: apenas JSON e texto simples são capturados.]';
        }
      } finally { filter.close(); }
    };
    filter.onerror = () => {
      const current = getRecord(details.requestId);
      if (current) current.avisoResposta = 'Não foi possível ler o corpo da resposta.';
    };
  } catch (_) { record.avisoResposta = 'Corpo indisponível; URL, filtros e status continuam disponíveis.'; }
}
browser.webRequest.onBeforeRequest.addListener(details => configReady.then(() => beforeRequest(details)), {urls:['<all_urls>'],types:['xmlhttprequest']}, ['blocking','requestBody']);
browser.webRequest.onHeadersReceived.addListener(details => {
  const record = getRecord(details.requestId);
  if (!record) return;
  record.status = details.statusCode;
  const header = (details.responseHeaders || []).find(item => item.name.toLowerCase() === 'content-type');
  record.contentType = header ? header.value : '';
}, {urls:['<all_urls>'],types:['xmlhttprequest']}, ['responseHeaders']);
browser.webRequest.onCompleted.addListener(details => {
  const record = getRecord(details.requestId);
  if (record) { record.status = details.statusCode; record.estado = 'Concluída'; record.duracaoMs = Math.round(details.timeStamp - record.inicio); }
}, {urls:['<all_urls>'],types:['xmlhttprequest']});
browser.webRequest.onErrorOccurred.addListener(details => {
  const record = getRecord(details.requestId);
  if (record) { record.estado = 'Erro de rede'; record.erro = safeText(details.error); }
}, {urls:['<all_urls>'],types:['xmlhttprequest']});
browser.tabs.onRemoved.addListener(tabId => { if (capturingTab === tabId) { capturingTab = null; badge(); } });
browser.runtime.onMessage.addListener(async message => {
  await configReady;
  const uiResult = await ui.handle(message);
  if (uiResult !== undefined) return uiResult;
  if (message.type === 'start') { capturingTab = message.tabId; badge(); }
  if (message.type === 'stop') { capturingTab = null; badge(); }
  if (message.type === 'clear') { records.length = 0; hidden = 0; blocked = 0; }
  if (message.type === 'blocking') { configVersion++; blockKaspersky = message.enabled === true; await browser.storage.local.set({blockKaspersky}); }
  if (message.type === 'state' || ['start','stop','clear','blocking'].includes(message.type)) {
    return Promise.resolve({capturingTab, blockKaspersky, blocked, hidden, records:records.map(({inicio, ...item}) => item)});
  }
  return undefined;
});
