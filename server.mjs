import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const dist=path.join(root,'dist');
const certRoot=path.join(os.homedir(),'.office-addin-dev-certs');
const cert=process.env.KOKORO_CERT || path.join(certRoot,'localhost.crt');
const key=process.env.KOKORO_KEY || path.join(certRoot,'localhost.key');
if(!fs.existsSync(path.join(dist,'index.html'))) throw new Error('dist/index.html is missing. Run npm run build.');
if(!fs.existsSync(cert)||!fs.existsSync(key)) throw new Error('Trusted localhost certificate missing. Run npm run certs or .\\setup.ps1.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=https.createServer({cert:fs.readFileSync(cert),key:fs.readFileSync(key)},(req,res)=>{
  const url=new URL(req.url,'https://localhost');
  let rel=decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file=path.resolve(dist,rel);
  if(!file.startsWith(path.resolve(dist)+path.sep)&&file!==path.resolve(dist,'index.html')){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,s)=>{const target=!err&&s.isFile()?file:path.join(dist,'index.html');fs.readFile(target,(e,data)=>{if(e){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});});
});
server.listen(3000,'localhost',()=>console.log('Open Local.TTS PowerPoint add-in: https://localhost:3000'));
