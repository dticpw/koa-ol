import * as legacy from './host-v1.js';
import * as cooperative from './host-v2.js';
import {ApiError} from '../fiction-service.js';
// Sessions pin their host. Missing revision is the original released format;
// deployment cannot silently change a running party's rules or memory model.
export function createAdventure(members,revision='cooperative-v2'){
 if(revision==='cooperative-v2')return cooperative.createAdventure(members);
 if(revision==='cooperative-v1')return {...legacy.createAdventure(members),hostRevision:revision};
 throw new ApiError(503,'主持版本尚未配置。','host_version_unavailable');
}
export function resolveMultiplayer(args){
 const revision=args.state.hostRevision||'cooperative-v1';
 if(revision==='cooperative-v1')return legacy.resolveMultiplayer(args);
 if(revision==='cooperative-v2')return cooperative.resolveMultiplayer(args);
 throw new ApiError(503,'此冒险的主持版本暂不可用，进度已保留。','host_version_unavailable');
}
