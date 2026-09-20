export const API = ['localhost','127.0.0.1'].includes(location.hostname) ? 'http://127.0.0.1:4183' : 'https://muq.koa-ol.com/ace21-api';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function nickname(value) {
  try { if(value !== undefined) localStorage.setItem('koa-games-nickname', value.trim()); return localStorage.getItem('koa-games-nickname') || JSON.parse(localStorage.getItem('koaOlGamesLobby') || '{}').playerName || ''; } catch { return value || ''; }
}
export function token() {
  let value; try {value = sessionStorage.getItem('koa-table-token');} catch {}
  if (!value) { value = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); sessionStorage.setItem('koa-table-token',value); }
  return value;
}
export async function request(path, body) {
  const response = await fetch(API+path, {method:body?'POST':'GET',headers:{Authorization:'Bearer '+token(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000),cache:'no-store'});
  const data=await response.json(); if(!response.ok) throw Object.assign(new Error(data.error || '暂时无法连接'),{status:response.status}); return data;
}
export async function act(game,table,action) {
 const requestId=crypto.randomUUID();
 const submit=revision=>request(`/tables/${game}/${table.id}/action`,{revision,requestId,action});
 try{return await submit(table.revision);}catch(e){
  if(e.status!==409||e.message!=='桌面刚刚更新，请重试。')throw e;
  const latest=await request(`/tables/${game}/${table.id}`);return submit(latest.revision);
 }
}
