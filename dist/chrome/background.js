/* Captura Chrome MV3 limitada à aba escolhida; sem replay de requisições. */
importScripts('network-core.js', 'diagnostic-core.js', 'extension-ui.js');
const MAX_BYTES = 131072;
const records = [];
const ui = new ExtensionUi(chrome);
const { clean, cleanUrl, safeText, decodeBody } = DiagnosticCore;
let capturingTab = null;
let hidden = 0;
let captureError = '';
let generation = 0;
let blockKaspersky = true;
async function applyBlocking() {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: blockKaspersky ? ['kaspersky_polling'] : [],
        disableRulesetIds: blockKaspersky ? [] : ['kaspersky_polling'],
    });
}
const ready = chrome.storage.local.get('blockKaspersky').then(async settings => {
    blockKaspersky = settings.blockKaspersky !== false;
    await applyBlocking();
}).catch(error => { captureError = safeText(error.message); });
function badge() {
    chrome.action.setBadgeText({ text: capturingTab === null ? '' : 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#087f8c' });
}
async function stop() {
    const tabId = capturingTab;
    capturingTab = null;
    generation++;
    badge();
    if (tabId !== null) {
        try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    }
}
async function start(tabId) {
    if (capturingTab === tabId) return;
    await stop();
    const tab = await chrome.tabs.get(tabId);
    if (!/^https?:/.test(tab.url || '')) throw new Error('Escolha uma aba HTTP/HTTPS.');
    try {
        await chrome.debugger.attach({ tabId }, '1.3');
        capturingTab = tabId;
        await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {
            maxTotalBufferSize: 8388608,
            maxResourceBufferSize: 1048576,
            maxPostDataSize: MAX_BYTES,
        });
        captureError = '';
        badge();
    } catch (error) {
        await stop();
        throw new Error(`Não foi possível iniciar. Feche o DevTools dessa aba e tente novamente. ${error.message || ''}`);
    }
}
async function onNetwork(source, method, params) {
    if (source.tabId !== capturingTab || source.sessionId) return;
    const token = generation;
    if (method === 'Network.requestWillBeSent') {
        if (!['XHR', 'Fetch'].includes(params.type)) return;
        if (CleanNetwork.isHidden(params.request.url)) { hidden++; return; }
        const record = {
            id: params.requestId,
            horario: new Date((params.wallTime || Date.now() / 1000) * 1000).toISOString(),
            metodo: params.request.method,
            ...cleanUrl(params.request.url),
            status: null,
            corpoEnviado: null,
            resposta: null,
            estado: 'Aguardando resposta',
            inicio: params.timestamp,
        };
        const old = records.findIndex(item => item.id === record.id);
        if (old >= 0) records.splice(old, 1);
        records.unshift(record);
        if (records.length > 100) records.pop();
        let body = params.request.postData;
        if (!body && params.request.hasPostData) {
            try {
                body = (await chrome.debugger.sendCommand(source, 'Network.getRequestPostData', { requestId: params.requestId })).postData;
            } catch (_) {}
        }
        if (body && token === generation && records.includes(record)) {
            record.corpoEnviado = decodeBody(body.slice(0, MAX_BYTES));
            if (body.length > MAX_BYTES) record.avisoEnvio = 'Corpo limitado a 128 KiB de texto.';
        }
        return;
    }
    const record = records.find(item => item.id === params.requestId);
    if (!record) return;
    if (method === 'Network.responseReceived') {
        record.status = params.response.status;
        record.contentType = params.response.mimeType || '';
    }
    if (method === 'Network.loadingFailed') {
        record.estado = 'Erro de rede';
        record.erro = safeText(params.errorText);
    }
    if (method === 'Network.loadingFinished') {
        record.estado = 'Concluída';
        record.duracaoMs = Math.round((params.timestamp - record.inicio) * 1000);
        if (!/json|text\/plain/i.test(record.contentType || '')) {
            record.resposta = '[Corpo omitido: apenas JSON e texto simples são capturados.]';
            return;
        }
        try {
            const result = await chrome.debugger.sendCommand(source, 'Network.getResponseBody', { requestId: params.requestId });
            if (token !== generation || !records.includes(record)) return;
            if (result.base64Encoded) { record.resposta = '[Corpo binário/base64 omitido.]'; return; }
            record.resposta = decodeBody(result.body.slice(0, MAX_BYTES));
            if (result.body.length > MAX_BYTES) record.avisoResposta = 'Resposta limitada a 128 KiB de texto.';
        } catch (_) { record.avisoResposta = 'Corpo indisponível ou descartado pelo navegador.'; }
    }
}
chrome.debugger.onEvent.addListener((source, method, params) => {
    onNetwork(source, method, params).catch(error => { captureError = safeText(error.message); });
});
chrome.debugger.onDetach.addListener(source => {
    if (source.tabId === capturingTab) {
        capturingTab = null;
        generation++;
        captureError = 'Captura encerrada pelo navegador. Clique em Iniciar para retomar.';
        badge();
    }
});
chrome.tabs.onRemoved.addListener(tabId => {
    if (tabId === capturingTab) { capturingTab = null; generation++; badge(); }
});
async function handle(message) {
    await ready;
    const uiResult = await ui.handle(message);
    if (uiResult !== undefined) return uiResult;
    if (message.type === 'start') await start(message.tabId);
    if (message.type === 'stop') await stop();
    if (message.type === 'clear') { records.length = 0; hidden = 0; generation++; }
    if (message.type === 'blocking') {
        const previous = blockKaspersky;
        blockKaspersky = message.enabled === true;
        try { await applyBlocking(); await chrome.storage.local.set({ blockKaspersky }); }
        catch (error) { blockKaspersky = previous; await applyBlocking(); throw error; }
    }
    return {
        capturingTab, blockKaspersky, blocked: null, hidden, captureError,
        records: records.map(({ inicio, ...record }) => record),
    };
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handle(message).then(sendResponse, error => sendResponse({ error: safeText(error.message) }));
    return true;
});
