import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
async function walk(dir){const output=[];for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())output.push(...await walk(file));else output.push(file);}return output;}
const files=[...await walk(path.join(root,'src')),...await walk(path.join(root,'scripts'))];
for(const file of files){if(/\.(?:js|mjs)$/.test(file)){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr);}if(file.endsWith('.json'))JSON.parse(await readFile(file,'utf8'));}
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
for(const target of ['firefox','chrome']){
 const manifest=JSON.parse(await readFile(path.join(root,'src',target,'manifest.json'),'utf8'));
 if(manifest.version!==pkg.version)throw new Error('Versões divergentes');
}
const html=await readFile(path.join(root,'src/shared/popup.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw new Error('IDs HTML duplicados');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 const file=match[1];if(/^https?:/.test(file))throw new Error('Recurso remoto inesperado');
 if(file==='privacy.html')continue;
 await readFile(path.join(root,'src/shared',file));
}
console.log('Sintaxe JS, manifests, versões e recursos da interface: OK');
