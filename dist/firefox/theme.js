(() => {
  const api = globalThis.browser || globalThis.chrome;
  const media = matchMedia('(prefers-color-scheme: dark)');
  let preference = 'light';
  function apply(value) { preference=value || 'light';document.documentElement.dataset.theme=preference==='system' ? (media.matches?'dark':'light') : preference; }
  globalThis.applyExtensionTheme = apply;
  api.storage.local.get('theme').then(settings=>apply(settings.theme)).catch(()=>apply('light'));
  api.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.theme)apply(changes.theme.newValue);});
  media.addEventListener('change',()=>{if(preference==='system')apply(preference);});
})();
