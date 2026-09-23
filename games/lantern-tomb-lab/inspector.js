'use strict';
(() => {
  const $=id=>document.getElementById(id), panel=$('trace-panel');
  let session=null, generation=0, detailGeneration=0, nextBefore=null, selected=null, entries=[], loaded=false;
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const pretty=value=>typeof value==='string'?value:JSON.stringify(value,null,2);
  const parsed=value=>{try{return JSON.parse(value);}catch{return value;}};
  async function request(query){
    const response=await fetch((document.body.dataset.api||'/api/fiction-lab')+'?'+query,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'暂时无法读取调用记录。');return data;
  }
  function section(parent,label,value){
    const d=node('details',undefined,'trace-section');d.append(node('summary',label));
    const pre=node('pre',pretty(value),'trace-code');pre.tabIndex=0;pre.setAttribute('aria-label',label);d.append(pre);parent.append(d);
  }
  function display(target,trace){
    target.replaceChildren(node('p',`你：${trace.action}`,'trace-action'),node('p',trace.status==='committed'?`第 ${trace.revision} 段 · 已保存进度`:`第 ${trace.revision} 段的尝试 · 未改变进度（${trace.errorCode||'未完成'}）`,'trace-outcome'));
    let attempt=0;
    const calls=trace.calls.flatMap(call=>call.formatRepair?[call,call.formatRepair]:[call]);
    calls.forEach((call,index)=>{
      if(call.phase==='ruling')attempt++;
      const label=(call.phase==='ruling'?'裁定':'复核与叙述')+(call.reason==='format_retry'?' · 格式重试':'');
      const status={received:'收到返回',failed:'调用失败',not_sent:'未发出请求'}[call.status]||call.status;
      const d=node('details',undefined,'trace-call');d.append(node('summary',`${index+1}. ${label}${attempt>1?' · 内部修正':''} · ${status}`));
      if(call.durationMs!==undefined)d.append(node('p',`耗时 ${(call.durationMs/1000).toFixed(1)} 秒${call.response?.usage?` · 输入 ${call.response.usage.input_tokens??'—'} / 输出 ${call.response.usage.output_tokens??'—'} tokens`:''}`,'trace-help'));
      if(call.response?.usage)section(d,'返回 · Token 用量（含缓存与推理统计）',call.response.usage);
      if(call.cost)section(d,'费用估算 · 非账单',call.cost);
      if(call.request){
        (call.request.input||call.request.messages||[]).forEach(message=>section(d,['developer','system'].includes(message.role)?'发送 · 固定规则（'+message.role+'）':'发送 · 世界与行动资料（'+message.role+'）',parsed(message.content)));
        const {input,messages,...settings}=call.request;section(d,'发送 · 模型参数与输出格式',settings);
        section(d,'发送 · 完整请求 JSON',call.request);
      }
      if(call.response){section(d,'返回 · 内容（JSON 排版）',parsed(call.response.output_text));section(d,'返回 · 原始文字',call.response.output_text);}
      if(call.response?.redacted)d.append(node('p','返回混入思考分隔标记，已拒绝提交并省略该次文字；用量仍保留。','trace-help'));
      if(call.errorCode)d.append(node('p',`错误：${call.errorCode}。没有伪造缺失的模型返回。`,'trace-help'));
      target.append(d);
    });
    if(trace.checks.length)section(target,'程序检查与内部修正原因',trace.checks);
    if(!trace.calls.length)target.append(node('p','这次尝试没有模型调用。','trace-help'));
  }
  async function select(){
    const id=$('trace-select').value, version=generation, detail=++detailGeneration;
    selected=null;$('trace-content').replaceChildren();$('trace-wide').disabled=$('trace-download').disabled=true;
    if(!id)return;
    $('trace-status').textContent='正在读取这次交流…';
    try{
      const data=await request('trace='+encodeURIComponent(id));
      if(version!==generation||detail!==detailGeneration)return;
      selected=data.trace;display($('trace-content'),selected);$('trace-wide').disabled=$('trace-download').disabled=false;$('trace-status').textContent='记录已载入。点击各项展开输入与返回。';
    }catch(error){if(version===generation&&detail===detailGeneration)$('trace-status').textContent=error.name==='TimeoutError'?'读取超时，请刷新记录。':error.message;}
  }
  async function refresh(more=false){
    if(!session||!panel.open)return;
    const before=more?nextBefore:null;if(more&&!before)return;
    const version=++generation;++detailGeneration;
    $('trace-status').textContent='正在读取记录…';$('trace-refresh').disabled=$('trace-more').disabled=true;
    try{
      const data=await request('trace=list'+(before?'&before='+before:''));
      if(version!==generation)return;
      const previous=$('trace-select').value;
      entries=more?[...entries,...data.entries]:data.entries;nextBefore=data.nextBefore;loaded=true;
      $('trace-select').replaceChildren(...entries.map(e=>{const o=node('option',`${e.status==='committed'?'第 '+e.revision+' 段':'第 '+e.revision+' 段 · 未提交'} · ${e.action}`);o.value=e.id;return o;}));
      $('trace-select').disabled=!entries.length;$('trace-more').hidden=!nextBefore;
      if(!entries.length){selected=null;$('trace-content').replaceChildren();$('trace-wide').disabled=$('trace-download').disabled=true;$('trace-status').textContent='本局暂无调用记录。开局不调用模型；从下一次行动起可查看。';}
      else{if(more&&entries.some(e=>String(e.id)===previous))$('trace-select').value=previous;await select();}
    }catch(error){if(version===generation)$('trace-status').textContent=error.message;}
    finally{if(version===generation)$('trace-refresh').disabled=$('trace-more').disabled=false;}
  }
  panel.addEventListener('toggle',()=>{if(panel.open&&!loaded)refresh();});
  $('trace-select').addEventListener('change',select);
  $('trace-refresh').addEventListener('click',()=>refresh());$('trace-more').addEventListener('click',()=>refresh(true));
  $('trace-wide').addEventListener('click',()=>{if(selected){display($('trace-dialog-content'),selected);$('trace-dialog').showModal();}});
  $('trace-download').addEventListener('click',()=>{
    if(!selected)return;const url=URL.createObjectURL(new Blob([JSON.stringify(selected,null,2)],{type:'application/json'}));
    const a=node('a');a.href=url;a.download=`host-turn-${selected.revision}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.addEventListener('fiction-view',event=>{
    if(session===event.detail.sessionId)return;session=event.detail.sessionId;generation++;detailGeneration++;entries=[];selected=null;loaded=false;nextBefore=null;
    $('trace-refresh').disabled=$('trace-more').disabled=false;panel.open=false;$('trace-dialog').close();$('trace-content').replaceChildren();$('trace-dialog-content').replaceChildren();$('trace-select').replaceChildren(node('option','暂无记录'));$('trace-select').disabled=true;$('trace-status').textContent='';$('trace-more').hidden=true;$('trace-wide').disabled=$('trace-download').disabled=true;
  });
  window.addEventListener('fiction-trace-refresh',()=>{loaded=false;if(panel.open)refresh();});
})();
