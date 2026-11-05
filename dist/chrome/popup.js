 'use strict';
const api = globalThis.browser || globalThis.chrome;
let state = {records:[],capturingTab:null}; let selectedId = null; let refreshing = false;
const query = new URLSearchParams(location.search);
const isFloating = query.get('floating') === '1';
if (isFloating) document.body.classList.add('floating');
const $ = id => document.getElementById(id);
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
async function message(type,extra={}){const result=await api.runtime.sendMessage({type,...extra});if(result&&result.error)throw new Error(result.error);return result;}
function filtered(){const term=$('search').value.trim().toLowerCase();return state.records.filter(record=>!CleanNetwork.isHidden(record.url)&&`${record.metodo} ${record.url} ${record.status||''}`.toLowerCase().includes(term)&&(!$('method').value||record.metodo===$('method').value));}
function diagnostic(record){return JSON.stringify({ferramenta:'Rede limpa + Diagnóstico 1.2.1',...record},null,2);}
function render(){
 $('status').textContent=(state.capturingTab===null?'Captura parada':'Capturando aba '+state.capturingTab)+' — '+state.records.length+' requisição(ões)';
 $('stop').disabled=state.capturingTab===null;
 $('blocking').checked=state.blockKaspersky!==false;
 const blocked=state.blocked===null?'contador de bloqueios indisponível neste navegador':`${state.blocked||0} bloqueadas`;
 $('blockStatus').textContent=`${state.blockKaspersky!==false?'Bloqueio ativo':'Bloqueio desligado'} · ${blocked} · ${state.hidden||0} ocultas na captura`;
 const items=filtered();if(!items.some(record=>record.id===selectedId))selectedId=items[0]?items[0].id:null;
 $('requests').replaceChildren();
 for(const record of items){const button=document.createElement('button');button.type='button';button.className='request '+CleanNetwork.methodClass(record.metodo)+(record.id===selectedId?' selected':'')+(record.status>=400||record.erro?' error':'');button.textContent=`${record.status||'…'} ${record.metodo} ${record.url}`;button.addEventListener('click',()=>{selectedId=record.id;render();});$('requests').appendChild(button);}
 const selected=items.find(item=>item.id===selectedId);$('details').textContent=selected?diagnostic(selected):'Nenhuma requisição encontrada. Inicie a captura e repita a ação na página.';
 $('copy').disabled=!selected;$('copyAll').disabled=!items.length;
 if(state.captureError)notice(state.captureError,true);
}
async function update(type='state',extra={}){state=await message(type,extra);render();}
async function copy(text){try{try{await navigator.clipboard.writeText(text);}catch(_){const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('Falha ao copiar');}notice('Diagnóstico copiado. Cole no chat.');}catch(_){notice('Selecione e copie o texto do diagnóstico abaixo.',true);}}
async function loadTabs(){
 const tabs=await api.tabs.query({windowType:'normal'});const selected=$('sourceTab').value;
 const choices=tabs.filter(tab=>/^https?:/.test(tab.url||''));$('sourceTab').replaceChildren();
 for(const tab of choices){const option=document.createElement('option');option.value=String(tab.id);option.textContent=tab.title||new URL(tab.url).host;$('sourceTab').appendChild(option);}
 const initial=selected||query.get('tabId')||String(state.capturingTab||'');
 if(choices.some(tab=>String(tab.id)===initial))$('sourceTab').value=initial;
 else{const [active]=await api.tabs.query({active:true,lastFocusedWindow:true});if(active&&choices.some(tab=>tab.id===active.id))$('sourceTab').value=String(active.id);}
 $('start').disabled=choices.length===0;
}
async function openFloating(){const tabId=Number($('sourceTab').value);if(!tabId)throw new Error('Abra e escolha uma aba da aplicação.');await message('floating',{tabId});if(!isFloating)window.close();}
function on(id,type,handler){$(id).addEventListener(type,event=>{Promise.resolve().then(()=>handler(event)).catch(error=>notice(error.message||'Não foi possível executar a ação.',true));});}
on('start','click',async()=>{notice('');await update('start',{tabId:Number($('sourceTab').value)});notice('Captura iniciada. Volte à página e faça a pesquisa.');});
on('stop','click',async()=>{await update('stop');notice('Captura parada.');});
on('clear','click',async()=>{selectedId=null;await update('clear');notice('Registros apagados.');});
on('blocking','change',async event=>{await update('blocking',{enabled:event.target.checked});notice('Preferência de bloqueio salva.');});
on('theme','change',async event=>{const prefs=await message('setPreferences',{theme:event.target.value});globalThis.applyExtensionTheme(prefs.theme);});
on('floatingMode','change',async event=>{await message('setPreferences',{uiMode:event.target.checked?'floating':'popup'});if(event.target.checked&&!isFloating)await openFloating();else notice('Modo de abertura salvo para o próximo acesso.');});
on('float','click',openFloating);
on('copy','click',()=>{const record=state.records.find(item=>item.id===selectedId);if(record)return copy(diagnostic(record));});
on('copyAll','click',()=>copy(JSON.stringify({ferramenta:'Rede limpa + Diagnóstico 1.2.1',requisicoes:filtered()},null,2)));
$('search').addEventListener('input',render);$('method').addEventListener('change',render);
on('sourceTab','focus',loadTabs);
(async()=>{try{const prefs=await message('preferences');$('theme').value=prefs.theme;$('floatingMode').checked=prefs.uiMode==='floating';globalThis.applyExtensionTheme(prefs.theme);await update();await loadTabs();if(isFloating){$('float').textContent='Focar esta janela';}else if(prefs.uiMode==='floating')await openFloating();}catch(error){notice(error.message,true);}})();
setInterval(async()=>{if(refreshing)return;refreshing=true;try{await update();}catch(error){notice(error.message,true);}finally{refreshing=false;}},1500);
