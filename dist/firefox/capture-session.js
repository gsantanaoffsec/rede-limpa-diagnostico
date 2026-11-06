/* Estado único do popup, janela e DevTools. Persistência local limitada. */
class CaptureSession {
  constructor(api) {
    this.api = api; this.records = []; this.snapshots = {}; this.capturingTab = null; this.captureMode = 'native';
    this.rules = [{host:'ff.kes.v2.scr.kaspersky-labs.com',hide:true,block:true}];
    this.hidden = 0; this.blocked = 0; this.dropped = 0; this.action = null; this.captureError = '';
    this.queue = Promise.resolve(); this.lastBurst = 0; this.burst = ''; this.epoch=Date.now();this.actions=[];
    this.ready = this.restore();
  }
  async restore() {
    const stored = await this.api.storage.local.get('captureV2');
    const data = stored.captureV2;
    if (data && Date.now() - data.savedAt < 86400000) {
      this.records.push(...(data.records || []).slice(0,300));
      for (const record of this.records) if (record.estado === 'Aguardando resposta') {
        record.estado = 'Captura interrompida'; record.avisoResposta = 'Worker reiniciado antes de concluir a captura; corpo pode estar indisponível.';
      }
      this.snapshots = data.snapshots || {};
      this.hidden = data.hidden || 0; this.blocked = data.blocked || 0; this.dropped = data.dropped || 0;
    }
    // IDs de abas não são reutilizados automaticamente entre reinicializações do navegador.
    const control = await this.api.storage.session.get('captureControl');
    if (control.captureControl) { this.capturingTab=control.captureControl.tabId;this.captureMode=control.captureControl.mode || 'native';this.epoch=control.captureControl.epoch || this.epoch; }
    const settings = await this.api.storage.local.get('hostRules');
    if (Array.isArray(settings.hostRules)) this.rules = settings.hostRules;
    else { const legacy = await this.api.storage.local.get('blockKaspersky'); if (legacy.blockKaspersky === false) this.rules[0].block = false; }
    // Expiração também é aplicada quando a extensão volta a ser utilizada.
    if (data && Date.now() - data.savedAt >= 86400000) await this.api.storage.local.set({captureV2:null});
    if(this.trim())await this.persist();
  }
  decorate(record) {
    const now = Date.parse(record.horario)||Date.now();
    if (Math.abs(now - this.lastBurst) > 3000 || !this.burst) this.burst = 'janela-' + now;
    this.lastBurst = now; record.grupoTemporal = this.burst;
    const action=[...this.actions].reverse().find(a=>a.tabId===this.capturingTab&&now>=a.startedAt&&now<a.until);
    if (action) { record.acao = action.label; record.acaoId = action.id; }
    record.aba = this.capturingTab;
  }
  trim() {
    const count=()=>this.records.length+Object.values(this.snapshots).reduce((n,s)=>n+s.records.length+1,0);
    const before=count();
    const cutoff = Date.now() - 86400000;
    for (let i=this.records.length-1;i>=0;i--) if (Date.parse(this.records[i].horario) < cutoff) this.records.splice(i,1);
    for (const [slot,snapshot] of Object.entries(this.snapshots)) {
      if (Date.parse(snapshot.createdAt) < cutoff) delete this.snapshots[slot];
      else snapshot.records=snapshot.records.filter(r=>Date.parse(r.horario)>=cutoff);
    }
    while (this.records.length > 300) { this.records.pop(); this.dropped++; }
    return before!==count();
  }
  persist() {
    this.trim();
    const data = Insights.review({savedAt:Date.now(),records:this.records,snapshots:this.snapshots,capturingTab:this.capturingTab,hidden:this.hidden,blocked:this.blocked,dropped:this.dropped},[],false).records;
    const size = () => new TextEncoder().encode(JSON.stringify(data)).length;
    while (size() > 6 * 1024 * 1024) {
      const collections=[...Object.keys(data.snapshots).map(slot=>({slot,items:data.snapshots[slot].records,live:this.snapshots[slot].records})),{items:data.records,live:this.records}];
      let oldest=null;
      for(const collection of collections)collection.items.forEach((r,index)=>{const time=Date.parse(r.horario)||0;if(!oldest||time<oldest.time)oldest={...collection,index,time};});
      if(!oldest)break;
      oldest.items.splice(oldest.index,1);oldest.live.splice(oldest.index,1);
      if(oldest.slot){data.snapshots[oldest.slot].truncated=true;this.snapshots[oldest.slot].truncated=true;}
      else{this.dropped++;data.dropped=this.dropped;}
    }
    const control={tabId:this.capturingTab,mode:this.captureMode,epoch:this.epoch};
    this.queue = this.queue.catch(() => {}).then(async () => {await this.api.storage.session.set({captureControl:control});await this.api.storage.local.set({captureV2:data});});
    return this.queue;
  }
  state() {
    if(this.trim())this.persist().catch(e=>{this.captureError='Falha ao expirar dados: '+e.message;});
    return Insights.review({records:this.records,capturingTab:this.capturingTab,captureMode:this.captureMode,captureEpoch:this.epoch,snapshots:this.snapshots,rules:this.rules,hidden:this.hidden,blocked:this.blocked,dropped:this.dropped,action:this.action && Date.now()<this.action.until ? this.action : null,captureError:this.captureError},[],false).records;
  }
  async handle(message) {
    await this.ready;
    if (message.type === 'snapshot') {
      if (!['A','B'].includes(message.slot)) throw new Error('Escolha o slot A ou B.');
      this.snapshots[message.slot] = {label:String(message.label || 'Captura ' + message.slot).slice(0,100),createdAt:new Date().toISOString(),records:Insights.review(this.records,[],false).records};
    } else if (message.type === 'markAction') {
      const now=Date.now(); const seconds=Math.min(120,Math.max(5,Number(message.seconds)||15));
      if(this.action)this.action.until=Math.min(now,this.action.until);
      this.action={id:String(now),label:DiagnosticCore.safeText(String(message.label||'Ação').slice(0,100)),startedAt:now,tabId:this.capturingTab,until:now+seconds*1000};
      this.actions.push(this.action);if(this.actions.length>20)this.actions.shift();
    } else if (message.type === 'endAction') {if(this.action)this.action.until=Math.min(Date.now(),this.action.until);this.action=null;}
    else if (message.type === 'eraseAll') { this.epoch++;this.records.length=0;this.snapshots={};this.action=null;this.actions=[];this.dropped=0;this.hidden=0;this.blocked=0; }
    else if (message.type === 'hostRules') {
      if (!Array.isArray(message.rules)||message.rules.length>30) throw new Error('São permitidos até 30 hosts.');
      const rules=message.rules.map(r=>({host:Insights.host(r.host),hide:r.hide===true,block:r.block===true}));
      if(new Set(rules.map(r=>r.host)).size!==rules.length)throw new Error('Há hosts repetidos.');
      this.rules=rules;
      await this.api.storage.local.set({hostRules:rules});
    } else return undefined;
    await this.persist(); return this.state();
  }
}
globalThis.CaptureSession=CaptureSession;
