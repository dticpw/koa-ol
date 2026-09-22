import { handleImage, imageOptions } from '../../../_lib/codex-images.js';
export const onRequestPost = context => handleImage(context, 'edits');
export const onRequestOptions = imageOptions;
