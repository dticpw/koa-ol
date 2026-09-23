import {story as v1} from '../story-v1.js';
import {story as v2} from '../story.js';
import {story as v3} from './prisoner-13-v3.js';
import {ApiError} from '../../fiction-service.js';
export function storyFor(state){
 const revision=state?.hostRevision||'cooperative-v1';
 const story={'cooperative-v1':v1,'cooperative-v2':v2,'cooperative-v3':v3,'cooperative-v4':v3}[revision];
 if(!story||(state?.storyId&&state.storyId!==story.id)||(['cooperative-v3','cooperative-v4'].includes(revision)&&state.storyRevision!==v3.revision))throw new ApiError(503,'此存档的剧本版本暂不可用，进度保留。','story_version_unavailable');
 return story;
}
export const defaultStory=v3;
