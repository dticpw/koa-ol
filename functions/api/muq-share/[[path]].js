/* No persistent binding or library password. Server gates entry-scoped snapshots. */
const enc=new TextEncoder();
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const fail=(status)=>new Response('分享不存在、已过期或已撤销。',{status,headers});
export async function onRequest({request,env}){
 const url=new URL(request.url);const parts=url.pathname.slice('/api/muq-share/'.length).split('/');const id=parts.shift();
 if(!/^[a-f0-9]{32}$/.test(id||''))return fail(404);
 if(!['GET','POST'].includes(request.method))return fail(405);
 const source=await env.ASSETS.fetch(new URL('/library/shared-assets/'+id+'/manifest.json',url));if(!source.ok)return fail(404);
 let m;try{m=await source.json();}catch{return fail(404);}
 if(m.revoked||!Number.isFinite(Date.parse(m.expires))||Date.parse(m.expires)<=Date.now())return fail(410);
 let token;
 if(request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin||Number(request.headers.get('Content-Length')||0)>1024)return fail(403);
  const body=await request.text();if(body.length>1024)return fail(413);
  try{token=JSON.parse(body).token;}catch{return fail(400);}
 }else{token=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('muq_share_'+id+'='))?.split('=')[1];}
 if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))return fail(403);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(token))),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==m.token_hash)return fail(403);
 if(request.method==='POST')return new Response(JSON.stringify({files:Object.keys(m.files),expires:m.expires}),{headers:{...headers,'Content-Type':'application/json','Set-Cookie':'muq_share_'+id+'='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/api/muq-share/'+id+'/; Max-Age='+Math.max(0,Math.floor((Date.parse(m.expires)-Date.now())/1000))}});
 let name;try{name=decodeURIComponent(parts.join('/'));}catch{return fail(400);}
 if(name==='_info')return new Response(JSON.stringify({files:Object.keys(m.files),expires:m.expires}),{headers:{...headers,'Content-Type':'application/json'}});
 const file=m.files[name||'index.html'];if(!file||! /^[a-f0-9]{64}\.bin$/.test(file.path))return fail(404);
 const response=await env.ASSETS.fetch(new URL('/library/shared-assets/'+id+'/'+file.path,url));if(!response.ok)return fail(404);
 try{
  const raw=new Uint8Array(await response.arrayBuffer());const keyBytes=Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('raw',keyBytes,'AES-GCM',false,['decrypt']);
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12),additionalData:enc.encode('muQ-share-v1')},key,raw.slice(12));
  return new Response(clear,{headers:{...headers,'Content-Type':file.type,'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"}});
 }catch{return fail(403);}
}
