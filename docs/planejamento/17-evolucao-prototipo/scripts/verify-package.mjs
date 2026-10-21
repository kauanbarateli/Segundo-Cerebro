import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const errors=[];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const origin=JSON.parse(fs.readFileSync(path.join(root,'prototipo-origem.json'),'utf8'));
for(const f of origin.files){const p=path.join(root,'prototipo',f.path);if(!fs.existsSync(p)||hash(p)!==f.sha256)errors.push('Snapshot: '+f.path);}
const manifestPath=path.join(root,'manifest.json');
if(fs.existsSync(manifestPath)) for(const f of JSON.parse(fs.readFileSync(manifestPath,'utf8')).files){const p=path.join(root,f.path);if(!fs.existsSync(p)||hash(p)!==f.sha256)errors.push('Manifest: '+f.path);}
let links=0,scripts=0;
const local=(from,raw)=>{
  if(!raw||/^(https?:|data:|mailto:|#|javascript:)/i.test(raw))return;
  const clean=decodeURIComponent(raw.split('#')[0].split('?')[0].replace(/^<|>$/g,''));
  if(!clean)return;links++;if(!fs.existsSync(path.resolve(path.dirname(from),clean)))errors.push('Missing link '+path.relative(root,from)+': '+raw);
};
for(const p of walk(root)){
  const rel=path.relative(root,p).replaceAll('\\','/');
  if(/\.(?:js|mjs)$/.test(p)) {const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});scripts++;if(r.status!==0)errors.push('Syntax '+rel+': '+r.stderr);}
  if(p.endsWith('.html'))for(const m of fs.readFileSync(p,'utf8').matchAll(/(?:src|href)="([^"]+)"/g))local(p,m[1]);
  if(p.endsWith('.css'))for(const m of fs.readFileSync(p,'utf8').matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))local(p,m[1]);
  if(p.endsWith('.md')&&!rel.startsWith('prototipo/'))for(const m of fs.readFileSync(p,'utf8').matchAll(/\]\(([^)]+)\)/g))local(p,m[1]);
}
const report={snapshotFiles:origin.files.length,scriptsChecked:scripts,localLinksChecked:links,errors};
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=1;
