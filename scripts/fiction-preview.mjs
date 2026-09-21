// Local-only adapter for the real Pages handlers. Never deploy this HTTP server.
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile,stat,mkdir,realpath} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

export function sqliteAdapter(sql){
 return {prepare(query){let args=[];return {bind(...values){args=values;return this;},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};}};},async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const result=[];for(const st of statements)result.push(await st.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
export async function startPreview({source,data,port=18882,label='candidate',modelMode='real'}){
 if(!['real','offline'].includes(modelMode))throw Error('Unknown model mode');
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
 source=await realpath(source);data=resolve(data);
 if(data===source||data.startsWith(source+sep))throw Error('Runtime data must be outside the source checkout');
 await mkdir(data,{recursive:true});
 const sql=new DatabaseSync(resolve(data,'state.sqlite'));sql.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');
 const base=pathToFileURL(source+'/');
 const {adventures}=await import(new URL('functions/_lib/adventures/routes.js',base));
 const lab=(await import(new URL('functions/api/fiction-lab.js',base))).onRequest;
 const labArchives=(await import(new URL('functions/api/fiction-lab/archives.js',base))).onRequest;
 const classic=(await import(new URL('functions/api/fiction.js',base))).onRequest;
 const env={DB:sqliteAdapter(sql),UPSTREAM_API_KEY:modelMode==='real'?process.env.UPSTREAM_API_KEY:undefined,UPSTREAM_BASE_URL:process.env.UPSTREAM_BASE_URL,FICTION_DAILY_BUDGET_USD:process.env.FICTION_PREVIEW_BUDGET_USD||'5'};
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon'};
 let activePort=port;
 const server=http.createServer(async(req,res)=>{
  try{
   const host=req.headers.host;
   if(![`127.0.0.1:${activePort}`,`localhost:${activePort}`].includes(host)){res.writeHead(403);return res.end('Loopback host required');}
   const url=new URL(req.url,`http://${host}`),prefix=`fiction_preview_${activePort}_`;
   if(url.pathname==='/__preview/health'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({label,modelMode,modelReady:!!env.UPSTREAM_API_KEY,storage:'local-sqlite',productionDatabase:false}));
   }
   if(url.pathname.startsWith('/api/')){
    const match=url.pathname.match(/^\/api\/adventures\/([a-z0-9-]+)(\/archives)?$/);
    const handler=match?(match[2]?adventures[match[1]]?.archives:adventures[match[1]]?.handler):url.pathname==='/api/fiction-lab'?lab:url.pathname==='/api/fiction-lab/archives'?labArchives:url.pathname==='/api/fiction'?classic:null;
    if(!handler){res.writeHead(404);return res.end('Unknown preview API');}
    const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>65536){res.writeHead(413);return res.end('Request too large');}chunks.push(chunk);}
    const headers=new Headers();for(const [key,val]of Object.entries(req.headers))if(val!==undefined)headers.set(key,Array.isArray(val)?val.join(','):val);
    // Cookies are NOT isolated by port. Namespace both directions explicitly.
    headers.set('Cookie',(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(prefix)).map(x=>x.slice(prefix.length)).join('; '));
    headers.set('CF-Connecting-IP','127.0.0.1');
    const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    const response=await handler({request,env});
    for(const [key,value]of response.headers)if(key!=='set-cookie')res.setHeader(key,value);
    const cookies=response.headers.getSetCookie().map(x=>prefix+x.replace(/;\s*Secure\b/gi,''));
    if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.statusCode=response.status;return res.end(Buffer.from(await response.arrayBuffer()));
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
   let pathname=decodeURIComponent(url.pathname);
   if(pathname==='/'||pathname==='/games/')pathname='/games/fiction/';
   if(!['/games/fiction/','/games/lantern-tomb/','/games/lantern-tomb-lab/'].some(x=>pathname.startsWith(x))&&pathname!=='/favicon.svg'){res.writeHead(404);return res.end();}
   const file=resolve(source,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
   const resolved=await realpath(file);
   const allowed=resolved===resolve(source,'favicon.svg')||['games/fiction','games/lantern-tomb','games/lantern-tomb-lab'].some(p=>resolved.startsWith(resolve(source,p)+sep));
   if(!allowed||!mime[extname(file)]||!(await stat(file)).isFile()){res.writeHead(404);return res.end();}
   let content=await readFile(file);
   if(extname(file)==='.html')content=Buffer.from(content.toString().replace('<title>',`<title>【本机测试 · ${label.replace(/[<>&]/g,'')}】`));
   res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:content);
  }catch(e){res.statusCode=e.code==='ENOENT'?404:500;res.end('Preview request failed');}
 });
 try{await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});}catch(e){sql.close();throw e;}activePort=server.address().port;
 return {port:activePort,sql,close:()=>new Promise((ok,fail)=>server.close(e=>{if(e)return fail(e);sql.close();ok();}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const {values:v}=parseArgs({options:{source:{type:'string'},data:{type:'string'},port:{type:'string',default:'18882'},label:{type:'string',default:'candidate'},mode:{type:'string',default:'real'}}});
 if(!v.source||!v.data)throw Error('--source and --data required');
 const app=await startPreview({source:v.source,data:v.data,port:Number(v.port),label:v.label,modelMode:v.mode});
 console.log(JSON.stringify({url:`http://127.0.0.1:${app.port}/games/fiction/`,label:v.label,mode:v.mode}));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
