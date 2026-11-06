import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const browser of ['firefox', 'chrome']) {
  const output = path.join(root, 'dist', browser);
  if (path.dirname(output) !== path.join(root, 'dist')) throw new Error('Destino de build inválido');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(path.join(root, 'src/shared'), output, { recursive: true });
  await cp(path.join(root, 'src', browser), output, { recursive: true });
  await cp(path.join(root, 'src/shared/popup.html'), path.join(output, 'panel.html'));
  const privacy = await readFile(path.join(root, 'PRIVACIDADE.md'), 'utf8');
  const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  await writeFile(path.join(output,'privacy.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacidade — Rede limpa</title><link rel="stylesheet" href="popup.css"></head><body class="floating"><main class="app-shell"><h1>Privacidade</h1><pre>'+escape(privacy)+'</pre></main></body></html>');
  console.log(`Gerado: dist/${browser}`);
}
