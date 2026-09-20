import {stories} from './stories.js';
import {createAdventureEngine} from './engine.js';
import {createAdventureResolver} from './host.js';
import {createFictionHandler} from '../fiction-service.js';
import {createArchiveHandler} from '../fiction-archives.js';
export const adventures=Object.fromEntries(Object.entries(stories).map(([id,story])=>{const engine=createAdventureEngine(story),cookieName='koa_adv_'+id.replaceAll('-','_'),cookiePath='/api/adventures/'+id,gameKind='adventure:'+id;return [id,{engine,handler:createFictionHandler(engine,{gameKind,cookieName,cookiePath,traceEnabled:true,resolveTurn:createAdventureResolver(story,engine)}),archives:createArchiveHandler({engine,gameKind,gameCookie:cookieName,collectionCookie:cookieName+'_collection',collectionPath:cookiePath})}];}));
export const notFound=()=>new Response(JSON.stringify({error:'没有找到这个剧本。'}),{status:404,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
