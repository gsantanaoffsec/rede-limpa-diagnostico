import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const browser of ['firefox', 'chrome']) {
  const output = path.join(root, 'dist', browser);
  await mkdir(output, { recursive: true });
  await cp(path.join(root, 'src/shared'), output, { recursive: true });
  await cp(path.join(root, 'src', browser), output, { recursive: true });
  console.log(`Gerado: dist/${browser}`);
}
