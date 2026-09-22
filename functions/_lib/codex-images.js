import { authorizeClient } from './codex-access.js';

const JSON_LIMIT = 128 * 1024;
const EDIT_LIMIT = 52 * 1024 * 1024;
const IMAGE_LIMIT = 16 * 1024 * 1024;
const fields = ['model', 'prompt', 'n', 'size', 'quality', 'output_format', 'background'];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Cache-Control': 'no-store',
};

export function imageOptions() {
  return new Response(null, { status: 204, headers: cors });
}

function error(message, status = 400) {
  return Response.json({ error: { message, type: 'proxy_error' } }, { status, headers: cors });
}

// Bound incoming buffers even when Transfer-Encoding is chunked or length is false.
async function readLimited(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new RangeError(); }
    chunks.push(value);
  }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

function validSize(size) {
  if (size === 'auto') return true;
  if (typeof size !== 'string' || !/^\d+x\d+$/.test(size)) return false;
  const [w, h] = size.split('x').map(Number);
  return w > 0 && h > 0 && w % 16 === 0 && h % 16 === 0 &&
    Math.max(w, h) <= 3840 && Math.max(w, h) / Math.min(w, h) <= 3 &&
    w * h >= 655360 && w * h <= 8294400;
}

export async function handleImage(context, operation) {
  const { request, env } = context;
  const access = await authorizeClient(request, env);
  if (access.error) return error(access.error, access.status);
  if (!access.imageModels.length) return error('Image generation is not enabled for this API key', 403);
  if (!env.UPSTREAM_API_KEY) return error('UPSTREAM_API_KEY is not configured', 500);
  const edit = operation === 'edits';
  if (!edit && operation !== 'generations') return error('Unknown image operation', 404);
  const contentType = request.headers.get('Content-Type') || '';
  if (edit ? !contentType.startsWith('multipart/form-data') : !contentType.includes('application/json')) {
    return error(edit ? 'Edits require multipart/form-data' : 'Generations require application/json', 415);
  }
  let body, form;
  try {
    const raw = await readLimited(request, edit ? EDIT_LIMIT : JSON_LIMIT);
    if (edit) {
      form = await new Response(raw, { headers: { 'Content-Type': contentType } }).formData();
      body = {};
      for (const name of fields) {
        const values = form.getAll(name);
        if (values.length > 1 || values.some(v => typeof v !== 'string')) return error(`Invalid ${name}`);
        if (values.length) body[name] = values[0];
      }
      if (body.n !== undefined) body.n = Number(body.n);
      const images = [...form.getAll('image'), ...form.getAll('image[]')];
      const masks = form.getAll('mask');
      if (images.length < 1 || images.length > 3 || masks.length > 1) return error('Provide 1 to 3 images and at most one mask');
      for (const file of [...images, ...masks]) {
        if (typeof file === 'string' || !file.size || file.size > IMAGE_LIMIT ||
            !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
          return error('Images must be PNG/JPEG/WebP files of at most 16 MiB');
        }
      }
      for (const name of form.keys()) {
        if (![...fields, 'image', 'image[]', 'mask'].includes(name)) return error(`Unsupported image field: ${name}`);
      }
    } else {
      body = JSON.parse(new TextDecoder().decode(raw));
    }
  } catch (e) {
    return error(e instanceof RangeError ? 'Image request is too large' : 'Invalid image request body', e instanceof RangeError ? 413 : 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return error('Body must be an object');
  if (Object.keys(body).some(k => !fields.includes(k))) return error('Unsupported image request field');
  body.model ??= 'gpt-image-2';
  if (!access.imageModels.includes(body.model)) return error('Image model is not available for this API key', 403);
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 32000) return error('Provide a prompt of 1 to 32000 characters');
  if (body.n !== undefined && body.n !== 1) return error('This endpoint generates one image per request (n=1)');
  if (body.quality !== undefined && !['auto', 'low', 'medium', 'high'].includes(body.quality)) return error('Invalid image quality');
  if (body.size !== undefined && !validSize(body.size)) return error('Invalid GPT Image 2 size');
  if (body.output_format !== undefined && !['png', 'jpeg', 'webp'].includes(body.output_format)) return error('Invalid image output format');
  if (body.background !== undefined && !['auto', 'opaque'].includes(body.background)) return error('GPT Image 2 does not support a transparent background');
  if (edit) form.set('model', body.model);
  const started = Date.now();
  const headers = new Headers({ Authorization: `Bearer ${env.UPSTREAM_API_KEY}` });
  if (!edit) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(`${String(env.UPSTREAM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')}/images/${operation}`, {
      method: 'POST', headers, body: edit ? form : JSON.stringify(body), redirect: 'error',
    });
  } catch {
    logStatus(context, body.model, operation, started, 'network');
    return error('Upstream image request failed', 502);
  }
  logStatus(context, body.model, operation, started, response.status);
  const returnedHeaders = new Headers(cors);
  for (const name of ['content-type', 'x-request-id', 'retry-after']) {
    if (response.headers.has(name)) returnedHeaders.set(name, response.headers.get(name));
  }
  return new Response(response.body, { status: response.status, headers: returnedHeaders });
}

// Log metadata only: never buffer or log base64 images, prompts or bearer keys.
function logStatus(context, model, operation, started, status) {
  if (!context.env.DB) return;
  const { request, env } = context;
  const task = (async () => {
    try {
      await env.DB.prepare(`INSERT INTO chat_logs
        (ts, ip, country, city, region, user_agent, model, input_tokens, output_tokens, elapsed_ms, history_len, stage, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        Date.now(), request.headers.get('CF-Connecting-IP') || 'unknown', request.headers.get('CF-IPCountry') || 'XX',
        request.cf?.city?.slice(0, 200) || null, request.cf?.region?.slice(0, 200) || null,
        (request.headers.get('User-Agent') || '').slice(0, 500), model, 0, 0, Date.now() - started, 0,
        `image_${operation}`, typeof status === 'number' && status >= 200 && status < 300 ? null : `Upstream status: ${status}`,
      ).run();
    } catch { console.error('Image proxy usage log failed'); }
  })();
  if (typeof context.waitUntil === 'function') context.waitUntil(task);
}
