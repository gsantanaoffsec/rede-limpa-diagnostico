(() => {
const sensitive = /password|passwd|senha|authorization|cookie|secret|token|api[_-]?key|credential|session|csrf|xsrf/i;
function safeText(value) {
  return String(value)
    .replace(/\bBearer\s+[^\s"<>]+/gi, 'Bearer [REMOVIDO]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT REMOVIDO]')
    .replace(/((?:password|passwd|senha|authorization|cookie|secret|[\w-]*token|api[_-]?key|session)[\w-]*["']?\s*[:=]\s*["']?)[^\s,"'&<>}]+/gi, '$1[REMOVIDO]');
}
function clean(value, depth = 0) {
  if (depth > 30) return '[LIMITE DE PROFUNDIDADE]';
  if (Array.isArray(value)) return value.map(item => clean(item, depth + 1));
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      Object.defineProperty(result, key, {value:sensitive.test(key) ? '[REMOVIDO]' : clean(item, depth + 1), enumerable:true});
    }
    return result;
  }
  return typeof value === 'string' ? safeText(value) : value;
}
function cleanUrl(raw) {
  const url = new URL(raw);
  url.username = ''; url.password = ''; url.hash = '';
  const params = [];
  for (const [name, value] of url.searchParams) {
    params.push({campo:name, valor:sensitive.test(name) ? '[REMOVIDO]' : safeText(value)});
  }
  url.search = '';
  for (const param of params) url.searchParams.append(param.campo, param.valor);
  return {url:safeText(url.href), filtros:params};
}
function decodeBody(text) {
  try { return clean(JSON.parse(text)); } catch (_) { return safeText(text); }
}

globalThis.DiagnosticCore = {clean, cleanUrl, safeText, decodeBody};

})();
