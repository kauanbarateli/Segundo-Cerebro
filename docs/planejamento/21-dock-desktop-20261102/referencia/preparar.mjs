import { cp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const work = path.join(root, "work");
const output = path.resolve(root, process.argv[2] || "work/dock-reference-20261102");
const relative = path.relative(work, output);
if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
  throw new Error("Use um diretório novo dentro de work.");
}
let exists = false;
try { await access(output); exists = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
if (exists) throw new Error("Destino já existe; escolha outro diretório. Nenhum arquivo foi apagado.");
const source = path.join(root, "docs/planejamento/17-evolucao-prototipo/prototipo");
await access(path.join(source, "index.html"));
await mkdir(output, { recursive: true });
await cp(source, path.join(output, "site"), { recursive: true, errorOnExist: true, force: false });
for (const [from, to] of [
  ["floating-dock.tsx.txt", "floating-dock.tsx"],
  ["dock-preview.tsx.txt", "dock-preview.tsx"],
  ["dock-preview.css.txt", "site/dock-preview.css"],
  ["index.html.txt", "site/index.html"],
]) await writeFile(path.join(output, to), await readFile(path.join(here, from)));
await writeFile(path.join(output, "package.json"), JSON.stringify({
  name: "segundo-cerebro-dock-reference", private: true,
  scripts: { build: "esbuild dock-preview.tsx --bundle --minify --outfile=site/dock-preview.js", preview: "node server.cjs" },
  dependencies: { motion: "12.43.0", react: "19.2.8", "react-dom": "19.2.8" },
  devDependencies: { esbuild: "0.25.12" }
}, null, 2) + "\n");
await writeFile(path.join(output, "server.cjs"), `const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "site");
const types = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".jpg":"image/jpeg",".woff2":"font/woff2",".json":"application/json"};
http.createServer((req,res)=>{
  let name;
  try { name=decodeURIComponent(new URL(req.url,"http://localhost").pathname); } catch { res.writeHead(400).end(); return; }
  const file=path.resolve(root,"."+(name==="/" ? "/index.html" : name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end("Não encontrado");return;}
    res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});res.end(data);
  });
}).listen(3109,"127.0.0.1",()=>console.log("http://127.0.0.1:3109/#/inicio"));
`);
console.log(JSON.stringify({ prepared: true, output, next: ["npm install", "npm run build", "npm run preview"], productChanged: false }));
