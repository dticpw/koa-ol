import {annotations,pathLabel} from './library.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
// This only exposes already loaded, attached originals; it never fetches another body.
export function afterNotes(game,ref,uci){
  const parent=game?.nodes[ref.nodeId],child=game?.nodes[ref.childId];
  if(!parent||!child||child.parent_id!==parent.id||!parent.child_ids.includes(child.id)||child.move?.uci!==uci)return [];
  return annotations(game,child).filter(a=>a.anchor_node_id===child.id&&a.source_after_ply===child.ply);
}
export function createNoteReader(host){
  let groups=[],selected=0,game=null,book='',expanded=new Set(),returnTo=null;
  const compact=matchMedia('(max-width:560px)');
  const api={onChange:null,visibleIds:()=>new Set((groups[selected]?.notes||[]).map(a=>a.id)),select(kind,node){const i=groups.findIndex(g=>g.kind===kind&&(!node||g.node.id===node));if(i>=0){selected=i;draw();}},focus(){host.scrollIntoView({block:'nearest'});host.querySelector('.reader-title')?.focus({preventScroll:true});},reveal(id,back){
    const i=groups.findIndex(g=>g.notes.some(a=>a.id===id));if(i<0)return;
    selected=i;expanded.add(id);returnTo=back;draw();
    const text=host.querySelector('[data-annotation="'+id+'"] .reader-text');text.tabIndex=-1;text.focus({preventScroll:true});host.scrollIntoView({block:'start'});
  },clear(text='正在匹配当前局面的原注…',state='loading'){groups=[];game=null;returnTo=null;api.onChange=null;host.dataset.state=state;delete host.dataset.game;delete host.dataset.node;delete host.dataset.context;host.setAttribute('aria-busy',String(state==='loading'));host.replaceChildren(el('h2','原注','reader-heading'),el('p',text,'reader-state'));},error(text,retry){api.clear(text,'error');const b=el('button','重试原注','quiet');b.addEventListener('click',retry);host.append(b);},show(data){
    game=data.game;book=data.book;expanded=new Set();returnTo=null;api.onChange=null;
    groups=[{kind:'current',node:data.node,notes:annotations(game,data.node)},...data.after.map(node=>({kind:'after',node,notes:annotations(game,node)}))];
    selected=data.preferred==='after'?Math.max(0,groups.findIndex(g=>g.kind==='after')):Math.max(0,groups.findIndex(g=>g.notes.length));
    host.dataset.game=game.id;host.setAttribute('aria-busy','false');draw();
  }};
  function draw(){
    const group=groups[selected];if(!group)return;
    host.dataset.state=groups.some(g=>g.notes.length)?'ready':'empty';host.dataset.context=group.kind;host.dataset.node=group.node.id;
    const top=el('div',undefined,'reader-top');top.append(el('h2','原注','reader-heading'));
    const title=el('h3',undefined,'reader-title');title.append(el('span','原注 · ','reader-kicker'),el('span',book+' · '+game.title));if(game.status==='partial')title.append(el('span',' · 部分可用','reader-status'));title.tabIndex=-1;
    const tabs=el('div',undefined,'reader-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','原注阅读位置');
    groups.forEach((g,i)=>{const b=el('button',(g.kind==='current'?'当前':'走后未落子')+' · '+pathLabel(g.node.id).replace(' · 第 ',' ').replace(' 手','手'),'quiet');b.dataset.context=g.kind;b.dataset.node=g.node.id;b.setAttribute('aria-pressed',String(i===selected));b.addEventListener('click',()=>{selected=i;draw();host.querySelectorAll('.reader-tabs button')[i].focus({preventScroll:true});});tabs.append(b);});
    const identity=el('p',(group.kind==='current'?'当前局面':'所选着法走后 · 尚未落子')+' · '+pathLabel(group.node.id),'reader-path sr-only');
    const any=groups.some(g=>g.notes.length);tabs.hidden=!any;
    host.replaceChildren(top,title,tabs,identity);
    if(!group.notes.length)host.append(el('p',!any?(pathLabel(groups[0].node.id)+(groups.length>1?' · 当前与所选走后均未附原注。':' · 当前局面未附原注。')):group.kind==='current'?'此来源的当前局面未附原注。':'此来源的所选着法走后未附原注。','reader-empty'));
    for(const a of group.notes){
      const block=el('div',undefined,'reader-original');block.dataset.annotation=a.id;
      const limit=compact.matches?36:140,full=expanded.has(a.id)||a.text.length<=limit;
      const text=el('p',full?a.text:a.text.slice(0,compact.matches?32:70)+'…','reader-text');block.append(text);
      if(a.text.length>limit){const toggle=el('button',full?'收起全文':'节选 · 展开全文（'+a.text.length+'字）','quiet reader-expand');toggle.setAttribute('aria-expanded',String(full));toggle.addEventListener('click',()=>{if(full)expanded.delete(a.id);else expanded.add(a.id);draw();host.querySelector('[data-annotation="'+a.id+'"] button').focus({preventScroll:true});});block.append(toggle);}
      host.append(block);
    }
    if(returnTo){const back=el('button','返回线路位置','quiet reader-return');back.addEventListener('click',()=>returnTo?.());host.append(back);}
    api.onChange?.();
  }
  compact.addEventListener('change',()=>{if(game)draw();});api.clear();return api;
}
