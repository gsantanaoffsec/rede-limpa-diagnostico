const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = vm.createContext({ URL, TextEncoder, Date, console });
for (const file of ['diagnostic-core.js', 'insights.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/shared', file), 'utf8'), ctx);
}
const core = ctx.Insights;
const record = (overrides = {}) => ({ id: '1', horario: '2026-11-06T12:00:00.000Z', metodo: 'GET', url: 'https://localhost/api?data=20102026', status: 200, filtros: [{ campo: 'data', valor: '20102026' }], resposta: { data: [], total: 0 }, ...overrides });
test('diagnóstico identifica data compacta, vazio e erro SQL sem afirmar causa', () => {
  const hints = core.analyze(record());
  assert(hints.some(h => h.code === 'date-compact'));
  assert(hints.some(h => h.code === 'empty'));
  assert(core.analyze(record({ status: 500, resposta: "Unknown column 'x' in 'where clause'" })).some(h => h.code === 'sql-column'));
});
test('comparação preserva parâmetros repetidos e identifica filtros e status diferentes', () => {
  const result = core.compare([record()], [record({ url: 'https://localhost/api?data=2026-10-20&tag=a&tag=b', status: 500 })]);
  assert(result.some(diff => diff.path.includes('filtros')));
  assert(result.some(diff => diff.path.includes('status')));
});
test('agrupamento ignora valores da query mas distingue método e caminho', () => {
  const groups = core.group([record(), record({ id: '2', url: 'https://localhost/api?data=outro' }), record({ id: '3', metodo: 'POST' })]);
  assert.equal(groups.length, 2); assert.equal(groups[0].count, 2);
});
test('revisão remove credenciais em JSON embutido, email, CPF, cookies e JWT', () => {
  const source = record({ url: 'https://localhost/api?codigos=' + encodeURIComponent('{"token":"SEGREDO"}') + '&email=joel@example.com', resposta: { cpf: '123.456.789-00', email: 'joel@example.com', senha: 'SEGREDO', nome: 'Joel' } });
  const review = core.review([source], ['nome']);
  const text = JSON.stringify(review.records);
  assert(!text.includes('SEGREDO')); assert(!text.includes('joel@example.com')); assert(!text.includes('123.456.789-00')); assert(!text.includes('Joel')); assert(review.removals.length > 0);
});
test('senha com espaços em JSON truncado ou texto simples não deixa sufixo exposto',()=>{
  for(const value of ['{"senha":"minha senha secreta','senha=minha senha secreta&outro=ok','{"password":"minha \\" senha secreta"}','authorization: Basic secreta']){
    const cleaned=ctx.DiagnosticCore.decodeBody(value);assert(!JSON.stringify(cleaned).includes('secreta'));
  }
});
test('sanitização de texto longo sem campos sensíveis não bloqueia a captura',()=>{
 const input='x'.repeat(32768);const start=performance.now();assert.equal(ctx.DiagnosticCore.safeText(input),input);assert(performance.now()-start<500,'Sanitização demorou mais de 500 ms para 32 KiB');
});
test('revisão também protege email e CPF no caminho da URL',()=>{
 const result=core.review([record({url:'https://localhost/pessoa/joel%40example.com/123.456.789-00'})]);const text=JSON.stringify(result.records);assert(!text.includes('joel'));assert(!text.includes('123.456.789-00'));
});
test('cURL neutraliza aspas e não inclui cabeçalhos de autenticação', () => {
  const result = core.curl(record({ metodo: 'POST', corpoEnviado: { value: "a'b\n$(whoami)" }, requestHeaders: [{ name: 'Authorization', value: 'SEGREDO' }] }));
  assert(!result.includes('SEGREDO')); assert(result.includes("'\\''")); assert(result.includes('--data-raw'));
});
test('HAR e Markdown incluem limitações, status nulo e corpo truncado', () => {
  const records = [record({ status: null, avisoResposta: 'Resposta truncada', resposta: null })];
  const har = core.har(records); assert.equal(har.log.version, '1.2'); assert.equal(har.log.entries[0].response.status, 0);assert(har.log.entries[0].response.content.size>=0);
  assert.match(core.markdown(records, 'Pesquisar conta'), /Resposta truncada/);
});
test('regras só aceitam host exato; sem URL, curingas ou domínio semelhante', () => {
  assert.equal(core.host('ExAmPle.COM'), 'example.com');
  assert.throws(() => core.host('https://example.com/a')); assert.throws(() => core.host('*.example.com'));
  assert.equal(core.matchHost('https://example.com/a', [{ host: 'example.com', hide: true }], 'hide'), true);
  assert.equal(core.matchHost('https://example.com.attacker.net/a', [{ host: 'example.com', hide: true }], 'hide'), false);
});
