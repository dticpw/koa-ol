import { handleImage, imageOptions } from '../../../_lib/codex-images.js';
export const onRequestPost = context => handleImage(context, 'generations');
export const onRequestOptions = imageOptions;
