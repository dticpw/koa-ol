// Length-only profiles of attached, nonempty annotations; see revision16 evidence.
export const noteProfileRelease="ad7cff72236ec6f609d474645ef3725d33f7e6e89736a627c913b64b5369d6b9";
export const noteProfiles={"yl-book-131":{"annotated":54,"shortOnly":11,"withLong":8},"zichudonglai":{"annotated":35,"shortOnly":34,"withLong":0},"juzhongmi":{"annotated":33,"shortOnly":10,"withLong":0},"meihua":{"annotated":31,"shortOnly":11,"withLong":0},"yl-book-69":{"annotated":0,"shortOnly":0,"withLong":0},"yl-book-68":{"annotated":100,"shortOnly":56,"withLong":0},"yl-book-67":{"annotated":0,"shortOnly":0,"withLong":0},"yl-book-66":{"annotated":114,"shortOnly":0,"withLong":79},"yl-book-65":{"annotated":199,"shortOnly":0,"withLong":189},"yl-book-64":{"annotated":0,"shortOnly":0,"withLong":0},"yl-book-63":{"annotated":73,"shortOnly":0,"withLong":68},"yl-book-62":{"annotated":5,"shortOnly":0,"withLong":4},"yl-book-61":{"annotated":46,"shortOnly":0,"withLong":46},"yl-book-60":{"annotated":23,"shortOnly":2,"withLong":11},"yl-book-59":{"annotated":49,"shortOnly":13,"withLong":11},"yl-book-58":{"annotated":79,"shortOnly":0,"withLong":78},"yl-book-57":{"annotated":164,"shortOnly":21,"withLong":61}};
const $=id=>document.getElementById(id);
// Describes only the currently available records; checked sources live in revision16.content_followup.
export const bookDescriptions={
  'yl-book-131':'中炮急进中兵对屏风马的专题变化，含吃弃马、退窝心马与缓进八路马等走法。',
  zichudonglai:'信手炮、列手炮、入手炮等七类炮局，每类五局。',
  juzhongmi:'得先20局与让先13局，以顺炮、列手炮为主，兼有中炮对屏风马等变化。',
  meihua:'顺炮直横车、屏风马对当头炮，以及列手炮、转角马与过宫炮等六类全局谱。',
  'yl-book-68':'布局陷阱谱与实战举例并列，涉及顺炮、中炮对屏风马、仙人指路和过宫炮。',
  'yl-book-66':'按五章布局归类的实战谱：中炮对屏风马、顺列炮、中炮其他变化、进兵局与飞相等。',
  'yl-book-65':'以布局攻防分章：顺炮、中炮与屏风马、列手炮、反宫马、单提马及飞相局。',
  'yl-book-63':'全局实战谱，含中炮对屏风马、飞相、反宫马与过宫炮等对局。',
  'yl-book-62':'按比赛经历编排的前5局，含少年赛、邀请赛及亚洲城市赛的实战对局。',
  'yl-book-61':'实战评注集，含五七炮、五九炮对屏风马，以及飞相、仙人指路等布局。',
  'yl-book-60':'中炮与屏风马的攻防专题，围绕高炮、五八炮、盘河马和五六炮过河车展开。',
  'yl-book-59':'收录全局部分与名手实战对局，含中炮盘头马、顺炮横直车等布局谱。',
  'yl-book-58':'以弃子取势、解杀和残局决胜等为题的实战谱；当前只纳入标准开局记录。',
  'yl-book-57':'兼有布局研究、中局专题和评注对局，包含中炮对屏风马、进兵局与顺炮等。',
};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
// The picker edits a draft; only Apply or Restore all changes the research context.
export function createScopePicker({getScope,apply,ResearchScope,allScope,emptyScope}){
  let draft,lib,limit=40;
  const description=g=>`${g.summary.annotation_statuses?.attached||0} 条已定位原注记录${g.status==='partial'?' · 部分可用':''}`;
  function updateSummary(){
    const scope=new ResearchScope(lib.catalogue,lib.manifest.books,draft);
    $('scope-draft-summary').textContent=scope.label;
    $('scope-apply').disabled=draft.mode==='game'&&!draft.gameId;
  }
  function render(){
    const query=$('scope-search').value.trim().toLocaleLowerCase(),games=Object.values(lib.catalogue.games),books=lib.manifest.books,mode=draft.mode;
    const matches=g=>`${g.title} ${lib.bookNames(g)}`.toLocaleLowerCase().includes(query);
    $('scope-books').hidden=mode==='game';$('scope-games').hidden=mode!=='game';$('scope-more').hidden=true;
    if(mode!=='game'){
      const list=books.filter(b=>!query||b.title.toLocaleLowerCase().includes(query)||games.some(g=>g.book_ids.includes(b.id)&&matches(g)));
      $('scope-books').replaceChildren(...list.map(b=>{
        const available=games.filter(g=>g.book_ids.includes(b.id)),row=el('label',undefined,'scope-book'),input=el('input'),body=el('span');input.type='checkbox';input.value=b.id;input.disabled=!available.length;input.checked=mode==='all'&&!!available.length||!!draft.bookIds?.includes(b.id);
        const profile=getScope().catalogue.library_id===noteProfileRelease?noteProfiles[b.id]:null;
        const annotated=profile?.annotated??available.filter(g=>g.summary.annotation_statuses?.attached>0).length;
        body.append(el('strong',b.title));
        body.append(el('span',available.length?(profile&&bookDescriptions[b.id]||'本页收录的标准开局棋谱，可按局名搜索。'):`仅目录 · ${b.directory_entries} 项均未纳入本页可用棋局。`,'scope-book-description'));
        if(available.length)body.append(el('span',`${available.length} 局可用 · ${annotated} 局有原注`,'scope-book-meta'));
        if(available.length&&profile)body.append(el('span',`${profile.shortOnly} 局仅短注（≤20字） · ${profile.withLong} 局含长注（≥80字）`,'scope-book-meta'));
        input.addEventListener('change',()=>{const ids=new Set(draft.mode==='all'?books.filter(b=>b.game_ids.length).map(b=>b.id):draft.bookIds||[]);input.checked?ids.add(b.id):ids.delete(b.id);draft={version:1,mode:'books',bookIds:[...ids]};updateSummary();});row.append(input,body);return row;
      }));
      $('scope-search-status').textContent=list.length?`${list.length} 部目录 · 勾选后点击应用`:'没有符合书名或局名的目录。';
    }else{
      const list=games.filter(matches);
      $('scope-games').replaceChildren(...list.slice(0,limit).map(g=>{
        const row=el('label',undefined,'scope-book'),radio=el('input'),body=el('span');radio.type='radio';radio.name='scope-game';radio.value=g.id;radio.checked=draft.gameId===g.id;
        body.append(el('strong',g.title),el('span',`${lib.bookNames(g)} · ${description(g)}`,'scope-book-meta'));
        radio.addEventListener('change',()=>{draft={version:1,mode:'game',gameId:g.id};updateSummary();});row.append(radio,body);return row;
      }));
      $('scope-more').hidden=list.length<=limit;$('scope-search-status').textContent=list.length?`${list.length} 局可选 · 显示 ${Math.min(limit,list.length)} 局`:'没有符合书名或局名的可用棋局。';
    }
    updateSummary();
  }
  $('scope-edit').addEventListener('click',()=>{
    const scope=getScope();if(!scope)return;lib={catalogue:scope.catalogue,manifest:{books:scope.books},bookNames:g=>g.book_ids.map(id=>scope.books.find(b=>b.id===id)?.title||id).join(' / ')};
    draft=structuredClone(scope.value);limit=40;$('scope-search').value='';document.querySelector(`input[name=scope-kind][value=${draft.mode==='game'?'game':'books'}]`).checked=true;render();$('scope-dialog').showModal();
  });
  for(const input of document.querySelectorAll('input[name=scope-kind]'))input.addEventListener('change',()=>{draft=input.value==='game'?{version:1,mode:'game',gameId:null}:emptyScope();limit=40;render();});
  $('scope-search').addEventListener('input',()=>{limit=40;render();});$('scope-more').addEventListener('click',()=>{limit+=40;render();});
  $('scope-clear').addEventListener('click',()=>{draft=emptyScope();document.querySelector('input[name=scope-kind][value=books]').checked=true;render();});
  $('scope-all-draft').addEventListener('click',()=>{draft=allScope();document.querySelector('input[name=scope-kind][value=books]').checked=true;render();});
  $('scope-cancel').addEventListener('click',()=>$('scope-dialog').close());
  $('scope-dialog').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();$('scope-dialog').close();}});
  $('scope-dialog').addEventListener('close',()=>$('scope-edit').focus({preventScroll:true}));
  $('scope-apply').addEventListener('click',()=>{apply(draft);$('scope-dialog').close();});
  $('scope-restore').addEventListener('click',()=>apply(allScope()));
}
