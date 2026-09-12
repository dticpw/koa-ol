'use strict';
// A view of admitted descriptors, never a browser of the host filesystem.
function safeArchiveName(name){return typeof name==='string'&&name.length>0&&!/[\\:\x00-\x1f]/.test(name)&&name.split('/').every(p=>p&&p!=='.'&&p!=='..');}
function fileFormat(name){const base=name.split('/').pop(),at=base.lastIndexOf('.');return at>0&&at<base.length-1?base.slice(at+1).toUpperCase():'无后缀';}
function fileIdentity(f,title){
 const box=create('div','file-identity'),name=f.name.replace(/^artifacts\//,'');
 const heading=create('div','file-heading');heading.append(create('strong','',title||name),create('span','file-format',fileFormat(name)));box.append(heading);
 if(title&&title!==name&&title!==name.split('/').pop())box.append(create('code','file-real-name',name));
 else if(title&&name.includes('/'))box.append(create('code','file-real-name',name));
 return box;
}
function fileRow(e,f,title,{outcome=false}={}){
 const row=create('div','file-row file-compact'+(outcome?' file-outcome':'')),a=create('a','file-main');a.href=href(e.id,f.name);a.append(create('strong','',title||f.name.replace(/^artifacts\//,'')));
 const format=create('span','file-format',fileFormat(f.name)),size=create('span','file-size',sizeLabel(f.bytes)),b=create('button','file-save','下载');
 b.onclick=()=>busy(b,fileDownload(e,f));b.setAttribute('aria-label','下载 '+(title||f.name));row.append(a,format,size,b);
 if(f.missing_dependencies)row.append(create('span','file-notice',`有 ${f.missing_dependencies} 项依赖未随文件提供`));
 return row;
}
async function downloadDirectory(e,files,prefix){
 const epoch=state.epoch,out=[];
 for(const f of files){if(!safeArchiveName(f.name))throw new Error('归档路径无效');out.push({name:f.name.slice(prefix.length),data:await asset(f)});}
 const omitted=(e.omitted_files||[]).filter(f=>f.name.startsWith(prefix)).map(f=>({name:f.name.slice(prefix.length),reason:f.reason,bytes:f.bytes}));
 const manifest={files:files.map(f=>({name:f.name.slice(prefix.length),bytes:f.bytes,sha256:f.sha256,missing_dependencies:f.missing_dependencies||0})),omitted_files:omitted,note:'仅含当前视角可下载的归档文件；未上传文件、外部链接及未归档依赖不在包中。'};
 let manifestName='MUQ-DOWNLOAD-MANIFEST.json';while(out.some(f=>f.name.toLowerCase()===manifestName.toLowerCase()))manifestName='_'+manifestName;
 out.push({name:manifestName,data:new TextEncoder().encode(JSON.stringify(manifest,null,2))});
 if(epoch!==state.epoch)return;
 download((prefix.replace(/\/$/,'').split('/').pop()||e.id)+'.zip',makeZip(out),'application/zip');
}
function mountFileBrowser(e,host,{internal=false}={}){
 const allowed=(e.files||[]).filter(f=>safeArchiveName(f.name)&&(internal||f.name.startsWith('artifacts/')));
 const root=internal?'':'artifacts/';let prefix=root,mode='outcomes';
 const panel=create('div','file-browser'),controls=create('div','file-controls'),body=create('div','file-browser-body');host.append(panel);panel.append(controls,body);
 const results=create('button','','成果视图'),tree=create('button','','目录视图');controls.append(results,tree);
 results.onclick=()=>{mode='outcomes';draw();};tree.onclick=()=>{mode='directory';draw();};
 function navigate(path){prefix=path;draw();body.querySelector('button,a')?.focus();}
 function draw(){
  results.setAttribute('aria-pressed',String(mode==='outcomes'));tree.setAttribute('aria-pressed',String(mode==='directory'));body.replaceChildren();
  if(mode==='outcomes'){
   const resources=(e.resources||[]).filter(r=>r.kind==='file'||r.kind==='link'&&r.group==='files');
   const ordered=[...resources.filter(r=>r.kind==='file').map(r=>({r,f:allowed.find(f=>f.name===r.file)})).filter(x=>x.f),...allowed.filter(f=>!resources.some(r=>r.file===f.name)).map(f=>({f,r:{}}))];
   const groups=new Map();for(const x of ordered){const label=x.r.collection||'';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(x);}
   for(const [label,items] of groups){if(label)body.append(create('h3','file-group-title',label));for(const {r,f} of items)body.append(fileRow(e,f,r.title,{outcome:true}));}
   for(const r of resources.filter(r=>r.kind==='link'))body.append(link(r.title,r.url));
   if(!ordered.length&&!resources.some(r=>r.kind==='link'))body.append(create('p','reader-meta','此条目暂无可下载附件。'));
   const omitted=(e.omitted_files||[]).filter(f=>internal||f.name.startsWith('artifacts/'));
   for(const f of omitted)body.append(create('p','reader-meta',f.name+' · 未上传 · '+f.reason));
   return;
  }
  const nav=create('nav','file-breadcrumb');nav.setAttribute('aria-label','文件目录');const home=create('button','','全部文件');home.onclick=()=>navigate(root);nav.append(home);
  let path=root;for(const part of prefix.slice(root.length).split('/').filter(Boolean)){path+=part+'/';const dest=path,b=create('button','',part);b.onclick=()=>navigate(dest);nav.append(create('span','','/'),b);}body.append(nav);
  const actions=create('div','reader-actions');if(prefix!==root){const up=create('button','','返回上级');up.onclick=()=>navigate(prefix.slice(0,-1).replace(/[^/]+$/,''));actions.append(up);}
  const descendants=allowed.filter(f=>f.name.startsWith(prefix));const zip=create('button','','下载当前目录 ZIP');zip.disabled=!descendants.length;zip.onclick=()=>busy(zip,()=>downloadDirectory(e,descendants,prefix));actions.append(zip);body.append(actions,create('p','reader-meta','仅展示已归档且当前可下载的文件；项目数为直接子项数。'));
  const folders=new Map(),direct=[];
  for(const f of descendants){const tail=f.name.slice(prefix.length),parts=tail.split('/');if(parts.length===1)direct.push(f);else{if(!folders.has(parts[0]))folders.set(parts[0],new Set());folders.get(parts[0]).add(parts[1]);}}
  for(const [name,children] of [...folders].sort((a,b)=>a[0].localeCompare(b[0]))){const b=create('button','file-folder');b.append(create('strong','',name+'/'),create('span','',children.size+' 项'));b.onclick=()=>navigate(prefix+name+'/');body.append(b);}
  for(const f of direct.sort((a,b)=>a.name.localeCompare(b.name)))body.append(fileRow(e,f,f.name.slice(prefix.length)));
  const missing=(e.omitted_files||[]).filter(f=>f.name.startsWith(prefix)).length;if(missing)body.append(create('p','reader-meta',`另有 ${missing} 个本地归档文件未上传，不包含在下载包中。`));
 }
 draw();
}
