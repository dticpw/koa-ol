import { handleResponse, onRequestOptions } from '../responses.js';

export { onRequestOptions };

export async function onRequestPost(context) {
  return handleResponse(context, 'responses/compact');
}
