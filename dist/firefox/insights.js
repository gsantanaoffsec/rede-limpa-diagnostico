/* Análises locais. Nenhum acesso à rede, execução de SQL ou replay. */
(() => {
  'use strict';
  const secret = /password|passwd|senha|authorization|cookie|secret|token|api[_-]?key|credential|session|csrf|xsrf/i;
  const stringify = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  function host(value) {
    const raw = String(value).trim().toLowerCase();
    if (!raw || /[\s\/*:@?#\\]/.test(raw)) throw new Error('Informe somente o host exato, sem protocolo, porta, caminho ou curinga.');
    const result = new URL('https://' + raw).hostname;
    if (result !== raw || !/^[a-z0-9.-]+$/.test(result) || result.startsWith('.') || result.endsWith('.') || result.includes('..')) throw new Error('Host inválido. Use o nome ASCII exato.');
    return result;
  }
  function matchHost(url, rules, flag) {
    try { return rules.some(rule => rule[flag] && rule.host === new URL(url).hostname.toLowerCase()); } catch { return false; }
  }
  function review(records, extraKeys = [], personal = true) {
    const removals = [];
    const extras = new Set(extraKeys.map(key => key.trim().toLowerCase()).filter(Boolean));
    function text(value, path) {
      const original = value;
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') return JSON.stringify(walk(parsed, path, 0));
      } catch { /* Texto simples. */ }
      value = DiagnosticCore.safeText(value);
      if (personal) value = value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REMOVIDO]')
        .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF REMOVIDO]');
      if (value !== original) removals.push({ campo: path, motivo: 'Credencial ou dado pessoal detectado no texto' });
      return value;
    }
    function url(value, path) {
      try {
        const parsed = new URL(value);
        if (parsed.username || parsed.password) removals.push({ campo: path, motivo: 'Credencial na URL' });
        parsed.username = ''; parsed.password = ''; parsed.hash = '';
        let decodedPath=parsed.pathname;
        try{decodedPath=decodeURIComponent(decodedPath);}catch{ /* Caminho com escapes inválidos. */ }
        const cleanedPath=text(decodedPath,path+'.caminho');
        if(cleanedPath!==decodedPath)parsed.pathname=cleanedPath;
        const params = [...parsed.searchParams]; parsed.search = '';
        for (const [key, val] of params) parsed.searchParams.append(key, hidden(key) ? redact(path + '.' + key) : text(val, path + '.' + key));
        return parsed.href;
      } catch { return text(value, path); }
    }
    function hidden(key) { return secret.test(key) || extras.has(key.toLowerCase()) || (personal && /^(cpf|cnpj|email|e-mail|telefone|phone|celular)$/i.test(key)); }
    function redact(path) { removals.push({ campo: path, motivo: 'Campo protegido' }); return '[REMOVIDO]'; }
    function walk(value, path, depth) {
      if (depth > 30) return '[LIMITE DE PROFUNDIDADE]';
      if (Array.isArray(value)) return value.map((item, i) => walk(item, path + '[' + i + ']', depth + 1));
      if (value && typeof value === 'object') {
        const result = Object.create(null);
        // Pares de filtros exigem proteger o valor pelo nome do campo.
        for (const [key, item] of Object.entries(value)) {
          if (/headers$/i.test(key)) { result[key] = '[CABEÇALHOS OMITIDOS]'; continue; }
          if (key === 'valor' && typeof value.campo === 'string' && hidden(value.campo)) result[key] = redact(path + '.' + value.campo);
          else if (hidden(key)) result[key] = redact(path + '.' + key);
          else if (key === 'url' && typeof item === 'string') result[key] = url(item, path + '.url');
          else result[key] = walk(item, path + '.' + key, depth + 1);
        }
        return result;
      }
      return typeof value === 'string' ? text(value, path) : value;
    }
    return { records: walk(records, 'requisicoes', 0), removals };
  }
  function endpoint(record) {
    try { const u = new URL(record.url); return record.metodo + ' ' + u.origin + u.pathname; } catch { return record.metodo + ' ' + record.url; }
  }
  function group(records) {
    const groups = new Map();
    for (const record of records) {
      const key = endpoint(record);
      if (!groups.has(key)) groups.set(key, { key, count: 0, records: [], errors: 0, averageMs: 0, intervalMs: null });
      const g = groups.get(key); g.records.push(record); g.count++; if (record.status >= 400 || record.erro) g.errors++;
    }
    return [...groups.values()].map(g => {
      const durations = g.records.map(r => r.duracaoMs).filter(Number.isFinite);
      g.averageMs = durations.length ? Math.round(durations.reduce((a,b) => a+b,0)/durations.length) : null;
      const times = g.records.map(r => Date.parse(r.horario)).filter(Number.isFinite).sort((a,b)=>a-b);
      if (times.length > 1) g.intervalMs = Math.round((times[times.length-1]-times[0])/(times.length-1));
      return g;
    });
  }
  function parameters(record) {
    try {
      return [...new URL(record.url).searchParams].map(([campo, valor]) => {
        const date = /data|date|^dt_|_dt$|entrada|inicio|fim/i.test(campo);
        const tipo = date && /^\d{8}$/.test(valor) ? 'Possível data compacta: confirme a ordem esperada pela API' : /^\d{4}-\d{2}-\d{2}$/.test(valor) ? 'Data no formato ISO' : /^\d+$/.test(valor) ? 'Texto composto por dígitos; o tipo efetivo depende da API' : 'Texto';
        return { campo, valor, interpretacao: tipo };
      });
    } catch { return []; }
  }
  function analyze(record) {
    const hints = []; const add = (code, title, evidence, advice) => hints.push({code, title, evidencia:evidence, orientacao:advice});
    if (record.status >= 400) add('http', 'Resposta HTTP com erro', 'Status ' + record.status, 'Confira o corpo da resposta e o log do servidor.');
    if (record.erro) add('network', 'Falha de rede', record.erro, 'Confira conexão, bloqueios, CORS e disponibilidade do servidor; a captura isolada não determina a causa.');
    if (record.resposta && Array.isArray(record.resposta.data) && !record.resposta.data.length) add('empty','Lista vazia','data contém zero registros','Compare filtros, vínculo do registro, paginação e permissões com uma consulta que funciona.');
    if (parameters(record).some(p => /Possível data compacta/.test(p.interpretacao))) add('date-compact','Possível incompatibilidade no formato da data','Parâmetro de data contém oito dígitos','Confira se o backend espera DDMMYYYY, YYYYMMDD ou YYYY-MM-DD antes de alterar o código.');
    const body = stringify(record.resposta) || '';
    if (/NaN-NaN-NaN|Incorrect DATE value/i.test(body)) add('date-invalid','Data inválida no processamento','Resposta menciona uma data inválida','Verifique o valor original e a conversão antes de gerar o filtro SQL.');
    if (/Unknown column/i.test(body)) add('sql-column','Coluna SQL não reconhecida','Resposta contém Unknown column','Confira o campo de busca e os aliases presentes no SELECT dessa requisição.');
    if (/ambiguous/i.test(body)) add('sql-ambiguous','Coluna SQL ambígua','Resposta contém ambiguous','Qualifique a coluna com o alias correto da tabela no filtro.');
    if (record.duracaoMs >= 2000) add('slow','Requisição lenta','Duração: ' + record.duracaoMs + ' ms','Compare outras capturas e o tempo no servidor; este limite é apenas um indicador.');
    if (record.avisoResposta || record.avisoEnvio) add('partial','Captura parcial', [record.avisoEnvio, record.avisoResposta].filter(Boolean).join(' • '),'O diagnóstico e as exportações podem não conter todos os dados originais.');
    return hints;
  }
  function compare(a, b) {
    const changes = [];
    function walk(left, right, path, depth) {
      if (changes.length >= 500 || depth > 12) return;
      if (JSON.stringify(left) === JSON.stringify(right)) return;
      if (left && right && typeof left === 'object' && typeof right === 'object') {
        for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) walk(left[key], right[key], path + '.' + key, depth+1);
      } else changes.push({ path, antigo:left === undefined ? '[AUSENTE]' : left, novo:right === undefined ? '[AUSENTE]' : right });
    }
    const normalize = records => {
      const result = Object.create(null); const count = new Map();
      for (const r of [...records].sort((a,b)=>String(a.horario).localeCompare(String(b.horario)))) {
        const key = endpoint(r); const index = (count.get(key)||0)+1; count.set(key,index);
        result[key + ' #' + index] = { filtros:parameters(r).map(({campo,valor})=>({campo,valor})), status:r.status, corpoEnviado:r.corpoEnviado, resposta:r.resposta, erro:r.erro, avisoResposta:r.avisoResposta };
      } return result;
    };
    walk(normalize(a),normalize(b),'captura',0); return changes;
  }
  const quote = value => "'" + String(value).replace(/'/g, "'\\''") + "'";
  function curl(raw) {
    const r = review([raw]).records[0];
    return '# Bash/zsh (Windows: Git Bash). Diagnóstico sanitizado; revise antes de executar.\n# Pode omitir credenciais e corpos indisponíveis/truncados.\ncurl --request ' + quote(r.metodo) + ' --url ' + quote(r.url) + (r.corpoEnviado != null ? ' --data-raw ' + quote(stringify(r.corpoEnviado)) : '');
  }
  function har(records) {
    return { log: { version:'1.2', creator:{name:'Rede limpa + Diagnóstico',version:'2.0.0'}, comment:'Sanitizado. Cabeçalhos não coletados; tamanhos e tempos detalhados indisponíveis. Corpos podem ser parciais.', entries:records.map(r => ({
      startedDateTime:r.horario, time:r.duracaoMs || 0,
      request:{method:r.metodo,url:r.url,httpVersion:'',cookies:[],headers:[],queryString:parameters(r).map(p=>({name:p.campo,value:p.valor})),headersSize:-1,bodySize:-1,...(r.corpoEnviado == null ? {} : {postData:{mimeType:'text/plain',text:stringify(r.corpoEnviado)}})},
      response:{status:r.status || 0,statusText:'',httpVersion:'',cookies:[],headers:[],content:{size:r.resposta==null?0:new TextEncoder().encode(stringify(r.resposta)).length,mimeType:r.contentType || '',...(r.resposta == null ? {} : {text:stringify(r.resposta)})},redirectURL:'',headersSize:-1,bodySize:-1,comment:r.avisoResposta || ''},
      cache:{},timings:{send:0,wait:r.duracaoMs || 0,receive:0},comment:[r.estado,r.erro,r.avisoEnvio,r.avisoResposta].filter(Boolean).join(' • ')
    })) } };
  }
  function markdown(records, title = 'Diagnóstico de requisições') {
    const fence = value => { const text = stringify(value) || ''; const ticks = '`'.repeat(Math.max(3,...[...text.matchAll(/`+/g)].map(m=>m[0].length+1))); return ticks + '\n' + text + '\n' + ticks; };
    return '# ' + title.replace(/[\r\n]/g,' ') + '\n\nGerado localmente • Rede limpa 2.0.0\n\nCaptura sanitizada e potencialmente parcial. Hipóteses não confirmam a causa.\n\n' + records.map(r => '## ' + r.metodo + ' — ' + (r.status || 'sem status') + '\n\n' + fence({url:r.url,horario:r.horario,duracaoMs:r.duracaoMs,acao:r.acao}) + '\n\n### Filtros\n' + fence(parameters(r)) + '\n\n### Corpo enviado\n' + fence(r.corpoEnviado) + '\n\n### Resposta\n' + fence(r.resposta) + '\n\n### Evidências e orientações\n' + fence(analyze(r)) + '\n\nLimitações: ' + [r.avisoEnvio,r.avisoResposta].filter(Boolean).join(' • ')).join('\n\n');
  }
  globalThis.Insights = { host, matchHost, review, group, parameters, analyze, compare, curl, har, markdown, endpoint };
})();
