/* Preferências e janela compartilhadas entre Chrome e Firefox. */
class ExtensionUi {
  constructor(api) { this.api = api; }
  async handle(message) {
    const api = this.api;
    if (message.type === 'preferences') {
      const prefs = await api.storage.local.get(['theme', 'uiMode']);
      return {theme:prefs.theme || 'light', uiMode:prefs.uiMode || 'popup'};
    }
    if (message.type === 'setPreferences') {
      const prefs = {};
      if (['light','dark','system'].includes(message.theme)) prefs.theme = message.theme;
      if (['popup','floating'].includes(message.uiMode)) prefs.uiMode = message.uiMode;
      await api.storage.local.set(prefs);
      return this.handle({type:'preferences'});
    }
    if (message.type === 'floating') {
      const tab = await api.tabs.get(message.tabId);
      if (!/^https?:/.test(tab.url || '')) throw new Error('Escolha uma aba HTTP/HTTPS para capturar.');
      const stored = await api.storage.session.get('floatingWindowId');
      if (stored.floatingWindowId) {
        try {
          const existing = await api.windows.get(stored.floatingWindowId, {populate:true});
          const panel = existing.tabs && existing.tabs.find(item => item.url && item.url.startsWith(api.runtime.getURL('popup.html')));
          if (panel) {
            await api.tabs.update(panel.id, {url:api.runtime.getURL(`popup.html?floating=1&tabId=${tab.id}`)});
            await api.windows.update(existing.id, {focused:true});
            return {opened:true};
          }
        } catch (_) { /* Janela anterior já foi fechada. */ }
      }
      const window = await api.windows.create({type:'popup', url:api.runtime.getURL(`popup.html?floating=1&tabId=${tab.id}`), width:800, height:880, focused:true});
      await api.storage.session.set({floatingWindowId:window.id});
      return {opened:true};
    }
    return undefined;
  }
}
globalThis.ExtensionUi = ExtensionUi;
