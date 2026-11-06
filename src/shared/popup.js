'use strict';
const api=globalThis.browser||globalThis.chrome;
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const inPanel=location.pathname.endsWith('/panel.html');
const isFloating=query.get('floating')==='1'||inPanel;
if(isFloating)document.body.classList.add('floating');
let state={records:[],snapshots:{},rules:[],capturingTab:null},selectedId=null,refreshing=false,rulesLoaded=false,rulesDirty=false,rulesVersion='',exportExtension='json';
const notice=(text,error=false)=>{$('notice').textContent=text;$('notice').classList.toggle('error',error);};
async function message(type,extra={}){const result=await api.runtime.sendMessage({type,...extra});if(result?.error)throw new Error(result.error);return result;}
function filtered(){const term=$('search').value.trim().toLowerCase();return state.records.filter(r=>!Insights.matchHost(r.url,state.rules,'hide')&&`${r.metodo} ${r.url} ${r.status||''} ${r.acao||''}`.toLowerCase().includes(term)&&(!$('method').value||r.metodo===$('method').value)&&(!$('onlyErrors').checked||r.status>=400||r.erro));}
function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function render(){
  const items=filtered();
  $('status').textContent=`${state.capturingTab===null?'Captura parada':'Capturando aba '+state.capturingTab} · ${state.records.length} chamadas · ${state.dropped||0} descartadas por limite`;
  $('stop').disabled=state.capturingTab===null;
  $('blockStatus').textContent=`${state.hidden||0} ocultas · ${state.blocked===null?'Contagem de bloqueios indisponível no Chrome':(state.blocked||0)+' bloqueadas'} · Regras afetam todas as abas`;
  if(!rulesLoaded||(!rulesDirty&&rulesVersion!==JSON.stringify(state.rules))){renderRules(state.rules);rulesLoaded=true;rulesVersion=JSON.stringify(state.rules);}
  $('actionState').textContent=state.action?`Marcador ativo: ${state.action.label} · até ${new Date(state.action.until).toLocaleTimeString()}`:'Nenhum marcador ativo.';
  $('snapshotState').textContent=['A','B'].map(slot=>`${slot}: ${state.snapshots?.[slot]?.records.length??0} chamadas${state.snapshots?.[slot]?.truncated?' (limitada por armazenamento)':''}`).join(' · ');
  if(!items.some(r=>r.id===selectedId))selectedId=items[0]?.id??null;
  $('requests').replaceChildren();
  const groups=$('groupRepeated').checked?Insights.group(items):items.map(r=>({records:[r],count:1}));
  for(const g of groups){const r=g.records.find(x=>x.id===selectedId)||g.records[0];const button=node('button',`${r.status||'…'} ${r.metodo} ${r.url}${g.count>1?` · ${g.count} chamadas · ${g.errors} erros · média ${g.averageMs??'?'} ms · intervalo médio ${g.intervalMs??'?'} ms`:''}`,'request '+CleanNetwork.methodClass(r.metodo)+(g.records.some(x=>x.id===selectedId)?' selected':'')+(r.status>=400||r.erro?' error':''));button.type='button';button.onclick=()=>{const index=g.records.findIndex(x=>x.id===selectedId);selectedId=g.records[(index+1)%g.records.length].id;render();};button.title='Clique para selecionar; em um grupo, clique novamente para alternar os registros.';$('requests').append(button);}
  if(!items.length)$('requests').append(node('p','Nenhuma chamada encontrada. Inicie a captura e repita a ação.','hint'));
  const r=items.find(x=>x.id===selectedId);
  $('details').textContent=r?JSON.stringify(r,null,2):'Nenhuma chamada selecionada.';
  $('parameters').textContent=r?JSON.stringify(Insights.parameters(r),null,2):'Sem filtros.';
  $('insights').replaceChildren();
  const hints=r?Insights.analyze(r):[];
  if(!hints.length)$('insights').append(node('p',r?'Nenhum indício conhecido detectado. Isso não confirma ausência de problema.':'Selecione uma chamada para analisar.','hint'));
  for(const hint of hints){const card=node('article','','insight');card.append(node('strong',hint.title),node('p','Evidência: '+hint.evidencia),node('p',hint.orientacao));$('insights').append(card);}
  $('timeline').replaceChildren();let previous='';
  for(const item of [...items].sort((a,b)=>a.horario.localeCompare(b.horario))){const group=item.acaoId||item.grupoTemporal||'sem-grupo';if(group!==previous){$('timeline').append(node('h3',item.acao||'Janela temporal (sem causa confirmada)'));previous=group;}const line=node('button',`${new Date(item.horario).toLocaleTimeString()} · ${item.metodo} · ${item.status||'…'} · ${item.duracaoMs??'?'} ms · ${Insights.endpoint(item)}`,'timeline-entry secondary');line.onclick=()=>{selectedId=item.id;render();};$('timeline').append(line);}
  if(state.captureError)notice(state.captureError,true);
}
async function update(type='state',extra={}){state=await message(type,extra);render();}
function renderRules(rules){$('hostRules').replaceChildren();for(const rule of rules)addRule(rule);}
function addRule(rule){const row=node('div','','host-row');const host=node('span',rule.host);host.dataset.host=rule.host;row.append(host);for(const [flag,label] of [['hide','Ocultar'],['block','Bloquear']]){const wrap=node('label','','check'),input=document.createElement('input');input.type='checkbox';input.dataset.flag=flag;input.checked=rule[flag];wrap.append(input,document.createTextNode(label));row.append(wrap);}const remove=node('button','Remover','secondary');remove.onclick=()=>row.remove();row.append(remove);$('hostRules').append(row);}
async function loadTabs(){const tabs=(await api.tabs.query({windowType:'normal'})).filter(t=>/^https?:/.test(t.url||''));const selected=$('sourceTab').value;$('sourceTab').replaceChildren();for(const tab of tabs){const option=node('option',tab.title||new URL(tab.url).host);option.value=String(tab.id);$('sourceTab').append(option);}const preferred=selected||query.get('tabId')||String(api.devtools?.inspectedWindow?.tabId||state.capturingTab||'');if(tabs.some(t=>String(t.id)===preferred))$('sourceTab').value=preferred;else{const [active]=await api.tabs.query({active:true,lastFocusedWindow:true});if(active&&tabs.some(t=>t.id===active.id))$('sourceTab').value=String(active.id);}$('start').disabled=!tabs.length;}
async function openFloating(){const tabId=Number($('sourceTab').value);if(!tabId)throw new Error('Escolha uma aba HTTP/HTTPS.');await message('floating',{tabId});if(!isFloating)window.close();}
function on(id,event,handler){$(id).addEventListener(event,e=>{Promise.resolve().then(()=>handler(e)).catch(error=>notice(error.message||'Não foi possível executar a ação.',true));});}
function unreview(){ $('reviewed').checked=false;$('copyExport').disabled=true;$('downloadExport').disabled=true; }
function prepare(){
  const scope=$('exportScope').value,format=$('exportFormat').value;
  const records=scope==='filtered'?filtered():['A','B'].includes(scope)?state.snapshots?.[scope]?.records||[]:state.records.filter(r=>r.id===selectedId);
  if(!records.length&&format!=='diff')throw new Error('Não há registros neste conteúdo.');
  const keys=$('sensitiveKeys').value.split(',');const reviewed=Insights.review(records,keys,$('personalData').checked);
  let output='';exportExtension=format==='diff'?'md':format==='curl'?'sh':format;
  if(format==='json')output=JSON.stringify({ferramenta:'Rede limpa + Diagnóstico 2.0.0',requisicoes:reviewed.records},null,2);
  if(format==='md')output=Insights.markdown(reviewed.records,$('reportTitle').value);
  if(format==='har')output=JSON.stringify(Insights.har(reviewed.records),null,2);
  if(format==='curl')output=reviewed.records.map(Insights.curl).join('\n\n');
  if(format==='diff'){
    if(!state.snapshots?.A||!state.snapshots?.B)throw new Error('Salve as capturas A e B antes de comparar.');
    const a=Insights.review(state.snapshots.A.records,keys,$('personalData').checked),b=Insights.review(state.snapshots.B.records,keys,$('personalData').checked);
    reviewed.removals.push(...a.removals,...b.removals);
    output='# Comparação A × B\n\nCorrespondência por método, origem, caminho e ordem de ocorrência. Até 500 diferenças; não confirma causalidade.\n\n'+JSON.stringify(Insights.compare(a.records,b.records),null,2);
  }
  $('exportPreview').value=output;unreview();
  $('reviewSummary').textContent=`${reviewed.removals.length} ocorrências adicionais protegidas nesta revisão. Credenciais removidas na coleta não são contadas aqui. Confira nomes, documentos e outros dados pessoais na prévia.`;
}
on('start','click',async()=>{const fromDevtools=inPanel&&api.runtime.getManifest().manifest_version===3;await update(fromDevtools?'startDevtools':'start',{tabId:fromDevtools?api.devtools.inspectedWindow.tabId:Number($('sourceTab').value)});notice('Captura iniciada. Faça a ação na página.');});
on('stop','click',()=>update('stop'));on('clear','click',()=>update('clear'));
on('theme','change',async e=>{const prefs=await message('setPreferences',{theme:e.target.value});applyExtensionTheme(prefs.theme);});
on('floatingMode','change',async e=>{await message('setPreferences',{uiMode:e.target.checked?'floating':'popup'});if(e.target.checked&&!isFloating)await openFloating();});on('float','click',openFloating);
on('addHost','click',()=>{const host=Insights.host($('hostInput').value);addRule({host,hide:true,block:false});rulesDirty=true;$('hostInput').value='';});
$('hostRules').addEventListener('change',()=>{rulesDirty=true;});$('hostRules').addEventListener('click',()=>{rulesDirty=true;});
on('saveHosts','click',async()=>{const rules=[...$('hostRules').children].map(row=>({host:row.querySelector('[data-host]').dataset.host,hide:row.querySelector('[data-flag="hide"]').checked,block:row.querySelector('[data-flag="block"]').checked}));await update('hostRules',{rules});rulesDirty=false;render();notice('Regras aplicadas em todas as abas.');});
on('markAction','click',()=>update('markAction',{label:$('actionLabel').value,seconds:Number($('actionSeconds').value)}));on('endAction','click',()=>update('endAction'));
for(const slot of ['A','B'])on('save'+slot,'click',async()=>{await update('snapshot',{slot,label:$('reportTitle').value});notice('Captura '+slot+' salva. Limpar a captura atual não apaga A/B.');});
on('compare','click',()=>{if(!state.snapshots?.A||!state.snapshots?.B)throw new Error('Salve as capturas A e B.');const changes=Insights.compare(state.snapshots.A.records,state.snapshots.B.records);$('comparison').hidden=false;$('comparison').textContent=changes.length?JSON.stringify(changes,null,2):'Nenhuma diferença nos campos comparados.';notice('Comparação por endpoint e ordem de ocorrência, limitada a 500 diferenças.');});
for(const id of ['search','method','groupRepeated','onlyErrors'])on(id,id==='search'?'input':'change',render);
on('sourceTab','focus',loadTabs);on('prepareExport','click',prepare);$('exportPreview').addEventListener('input',unreview);
for(const id of ['exportScope','exportFormat','reportTitle','sensitiveKeys','personalData'])on(id,'change',()=>{$('exportPreview').value='';unreview();});
on('reviewed','change',()=>{const disabled=!$('reviewed').checked||!$('exportPreview').value;$('copyExport').disabled=disabled;$('downloadExport').disabled=disabled;});
on('copyExport','click',async()=>{if(!$('reviewed').checked)throw new Error('Revise a prévia antes de copiar.');await navigator.clipboard.writeText($('exportPreview').value);notice('Prévia copiada.');});
on('downloadExport','click',()=>{if(!$('reviewed').checked)throw new Error('Revise a prévia antes de baixar.');const blob=new Blob([$('exportPreview').value],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='rede-limpa-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+exportExtension;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);});
on('eraseAll','click',async()=>{await update('eraseAll');$('exportPreview').value='';$('comparison').textContent='';unreview();notice('Capturas e comparações apagadas. Preferências e regras mantidas.');});
(async()=>{try{const prefs=await message('preferences');$('theme').value=prefs.theme;$('floatingMode').checked=prefs.uiMode==='floating';applyExtensionTheme(prefs.theme);await update();await loadTabs();if(!isFloating&&prefs.uiMode==='floating')await openFloating();}catch(e){notice(e.message,true);}})();
setInterval(async()=>{if(refreshing||document.hidden)return;refreshing=true;try{await update();}catch(e){notice(e.message,true);}finally{refreshing=false;}},1500);
