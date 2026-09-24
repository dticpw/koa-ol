// GENERATED DEPLOYMENT COPY: edit E:/PG/personal-relay/integrations/koa-ol/relay-export.js.
// Reads the legacy browser archive only after the user explicitly requests export.
(() => {
  const dialog=document.getElementById('history-dialog');if(!dialog||!window.ChatArchive)return;
  const notice=document.getElementById('archive-notice'),bar=document.createElement('div');bar.className='history-heading';
  const all=document.createElement('button'),current=document.createElement('button'),link=document.createElement('a');
  all.type=current.type='button';all.textContent='导出全部历史';current.textContent='导出当前对话';
  link.href='https://koa-relay-preview.1792587801.workers.dev/#chat';link.target='_blank';link.rel='noopener';link.textContent='新 Chat：登录后导入 ↗';
  bar.append(all,current,link);dialog.querySelector('.history-privacy').after(bar);
  async function exportHistory(onlyCurrent){
    if(sending||attachmentLoading){notice.textContent='请先等待当前生成或附件读取结束。';return;}
    all.disabled=current.disabled=true;
    try{
      await archiveReady;await archiveQueue;
      const live=history.length?structuredClone({id:conversationId,updated:Date.now(),history,model:modelSelect.value,search:searchToggle.getAttribute('aria-pressed')==='true',draft:input.value,draftAttachments:pendingAttachments,retry:lastRetry?{index:lastRetry.index,provider:lastRetry.provider,search:lastRetry.search}:null}):null;
      const records=onlyCurrent?[]:await ChatArchive.list();
      if(live){const i=records.findIndex(r=>r.id===live.id);if(i>=0)records[i]=live;else records.push(live);}
      const chosen=onlyCurrent?(live?[live]:[]):records;
      if(!chosen.length)throw Error('没有可导出的历史记录。');
      const data={format:'koa-chat-export',version:1,exported_at:new Date().toISOString(),conversations:chosen};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');
      a.href=url;a.download='koa-chat-history-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      notice.textContent='导出文件含完整对话和附件，请妥善保管。新 Chat 暂能导入纯文字对话；本机原记录没有删除。';
    }catch(e){notice.textContent=e.message||'导出失败，原记录保留。';}finally{all.disabled=current.disabled=false;}
  }
  all.onclick=()=>exportHistory(false);current.onclick=()=>exportHistory(true);
})();
