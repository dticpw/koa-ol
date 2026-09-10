'use strict';
// IndexedDB preserves a non-extractable CryptoKey via structured cloning.
// This is device convenience, not a server-enforced authentication session.
const deviceMemory=(()=>{
 let connection;
 function open(){
  if(!connection)connection=new Promise((resolve,reject)=>{
   const request=indexedDB.open('muq-device-v1',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('keys');
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
   request.onerror=()=>{connection=null;reject(request.error);};
   request.onblocked=()=>{connection=null;reject(new Error('设备存储被其他页面占用'));};
  });
  return connection;
 }
 async function run(mode,action){const db=await open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('keys',mode);const request=action(tx.objectStore('keys'));
  tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('设备存储被中止'));
 });}
 async function clear(){return run('readwrite',s=>s.delete('keeper'));}
 return {
  save:record=>run('readwrite',s=>s.put(record,'keeper')),
  clear,
  async load(){const record=await run('readonly',s=>s.get('keeper'));if(!record)return null;
   if(!Number.isFinite(record.expires)||record.expires<=Date.now()||record.expires>Date.now()+30*24*60*60*1000||!(record.key instanceof CryptoKey)||record.key.extractable||record.key.algorithm.name!=='PBKDF2'){await clear();return null;}return record;
  }
 };
})();
