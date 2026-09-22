#!/usr/bin/env node
// Dependency-free stdio MCP server. Credentials remain in the user's auth.json.
import { readFile, writeFile, mkdir, stat, access } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const BASE_URL = 'https://koa-ol.com/ai/v1';
const MODEL = 'gpt-image-2';
const MAX_INPUT = 16 * 1024 * 1024;
const MAX_OUTPUT = 32 * 1024 * 1024;
const common = {
  prompt: { type: 'string', minLength: 1, maxLength: 32000, description: 'Describe the requested raster image or precise edit, including text and things to preserve.' },
  output_path: { type: 'string', description: 'Absolute path for a NEW .png file in the user-requested project/output folder. Existing files are never overwritten.' },
  size: { type: 'string', default: '1024x1024', description: 'auto or WIDTHxHEIGHT; multiples of 16, at most 3840 per side, ratio <=3, 655360 to 8294400 pixels.' },
  quality: { type: 'string', enum: ['auto', 'low', 'medium', 'high'], default: 'auto' },
};
export const TOOLS = [
  {
    name: 'generate_image',
    description: 'Generate a real raster image with GPT Image 2 through the Koa image service and save it to a new PNG file. Use for illustrations, photos, posters and game assets requested by the user. Uses the existing Koa key in auth.json; no extra API key or environment variable is needed. One image per call. Does not support transparent backgrounds.',
    inputSchema: { type: 'object', properties: common, required: ['prompt', 'output_path'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'edit_image',
    description: 'Edit a user-selected local PNG/JPEG/WebP image (at most 16 MiB) using GPT Image 2. Sends that image and the prompt to the Koa service and saves a new PNG, preserving the original file. Use for an explicit edit or reference-image request.',
    inputSchema: { type: 'object', properties: { ...common, image_path: { type: 'string', description: 'Absolute path to the source image the user wants to edit or use as reference.' } }, required: ['prompt', 'output_path', 'image_path'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
];

async function readKey() {
  const directory = process.env.CODEX_HOME || join(homedir(), '.codex');
  let data;
  try { data = JSON.parse(await readFile(join(directory, 'auth.json'), 'utf8')); }
  catch { throw new Error('Cannot read auth.json. Put the existing Koa auth.json in your Codex user configuration folder.'); }
  if (typeof data.OPENAI_API_KEY !== 'string' || !/^koa_[A-Za-z0-9_-]{40,}$/.test(data.OPENAI_API_KEY)) {
    throw new Error('auth.json does not contain a Koa client API key. This tool must not use your upstream or ChatGPT credentials.');
  }
  return data.OPENAI_API_KEY;
}

function imageType(data) {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function validateArgs(name, args) {
  const definition = TOOLS.find(t => t.name === name);
  if (!definition) throw new Error('Unknown image tool');
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments must be an object');
  if (Object.keys(args).some(k => !Object.hasOwn(definition.inputSchema.properties, k))) throw new Error('Unknown image argument');
  if (typeof args.prompt !== 'string' || !args.prompt.trim() || args.prompt.length > 32000) throw new Error('Provide a prompt of 1 to 32000 characters');
  if (typeof args.output_path !== 'string' || !isAbsolute(args.output_path) || extname(args.output_path).toLowerCase() !== '.png') throw new Error('output_path must be an absolute path ending in .png');
  if (name === 'edit_image' && (typeof args.image_path !== 'string' || !isAbsolute(args.image_path))) throw new Error('image_path must be absolute');
  const quality = args.quality ?? 'auto';
  if (!['auto', 'low', 'medium', 'high'].includes(quality)) throw new Error('Invalid quality');
  const size = args.size ?? '1024x1024';
  if (size !== 'auto') {
    if (typeof size !== 'string' || !/^\d+x\d+$/.test(size)) throw new Error('Invalid size');
    const [w, h] = size.split('x').map(Number);
    if (!(w > 0 && h > 0 && w % 16 === 0 && h % 16 === 0 && Math.max(w, h) <= 3840 && Math.max(w, h) / Math.min(w, h) <= 3 && w * h >= 655360 && w * h <= 8294400)) throw new Error('Invalid GPT Image 2 size');
  }
  return { model: MODEL, prompt: args.prompt, size, quality, n: 1, output_format: 'png' };
}

async function readResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Image service returned no body');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_OUTPUT) { await reader.cancel(); throw new Error('Image response exceeds 32 MiB'); }
    chunks.push(Buffer.from(value));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Image service did not return valid JSON'); }
}

export async function callImageTool(name, args, { fetchImpl = fetch, getKey = readKey, signal } = {}) {
  const payload = validateArgs(name, args);
  try { await access(args.output_path); throw new Error('Output already exists; choose a new filename'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  let body = JSON.stringify(payload);
  const headers = { 'User-Agent': 'koa-codex-images/1.0', 'Content-Type': 'application/json' };
  if (name === 'edit_image') {
    const info = await stat(args.image_path);
    if (!info.isFile() || info.size > MAX_INPUT || info.size === 0) throw new Error('Input image must be a file of 1 byte to 16 MiB');
    const data = await readFile(args.image_path);
    const mime = imageType(data);
    if (!mime) throw new Error('Input is not a PNG, JPEG or WebP image');
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) form.set(key, String(value));
    form.set('image', new Blob([data], { type: mime }), `input.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`);
    body = form;
    delete headers['Content-Type'];
  }
  headers.Authorization = `Bearer ${await getKey()}`;
  let response;
  try {
    response = await fetchImpl(`${BASE_URL}/images/${name === 'edit_image' ? 'edits' : 'generations'}`, {
      method: 'POST', headers, body, redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(240000)]) : AbortSignal.timeout(240000),
    });
  } catch { throw new Error('Image request failed or timed out. Check connectivity; no automatic retry was sent to avoid duplicate charges.'); }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Image service returned HTTP ${response.status}. Check image permission, upstream quota or network; no image was saved.`);
  }
  const data = await readResponse(response);
  const encoded = data.data?.[0]?.b64_json;
  if (typeof encoded !== 'string' || !encoded.length || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Image service returned no valid base64 image');
  const png = Buffer.from(encoded, 'base64');
  if (imageType(png) !== 'image/png' || png.length < 24 || png.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Image service did not return the requested PNG format');
  const actualSize = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
  await mkdir(dirname(args.output_path), { recursive: true });
  await writeFile(args.output_path, png, { flag: 'wx' });
  return { content: [
    { type: 'text', text: JSON.stringify({ model: MODEL, saved_path: args.output_path, bytes: png.length, requested_quality: payload.quality, requested_size: payload.size, actual_size: actualSize,
      ...(payload.size !== 'auto' && payload.size !== actualSize ? { warning: 'The upstream returned different dimensions than requested. The image was saved as returned, without resizing or cropping.' } : {}),
    }) },
    { type: 'image', data: encoded, mimeType: 'image/png' },
  ] };
}

export async function handleRpc(message, options = {}) {
  if (message.id === undefined) return null;
  const reply = { jsonrpc: '2.0', id: message.id };
  if (message.method === 'initialize') return { ...reply, result: {
    protocolVersion: ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'].includes(message.params?.protocolVersion) ? message.params.protocolVersion : '2025-06-18',
    capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'koa-images', version: '1.0.0' },
    instructions: 'Use generate_image or edit_image for user-requested raster images. The tool uses the existing Koa auth.json. Always choose an absolute new PNG path in the user workspace. Keep the chat model selected; GPT Image 2 is an image tool, not a chat model.',
  } };
  if (message.method === 'ping') return { ...reply, result: {} };
  if (message.method === 'tools/list') return { ...reply, result: { tools: TOOLS } };
  if (message.method === 'tools/call') {
    try { return { ...reply, result: await callImageTool(message.params?.name, message.params?.arguments, options) }; }
    catch (e) { return { ...reply, result: { isError: true, content: [{ type: 'text', text: e.message }] } }; }
  }
  return { ...reply, error: { code: -32601, message: 'Method not found' } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pending = new Map();
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  input.on('line', async line => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); }
    catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); return; }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;
    if (message.method === 'notifications/cancelled') { pending.get(message.params?.requestId)?.abort(); return; }
    const controller = new AbortController();
    if (message.id !== undefined) pending.set(message.id, controller);
    try {
      const result = await handleRpc(message, { signal: controller.signal });
      if (result) process.stdout.write(JSON.stringify(result) + '\n');
    } finally { pending.delete(message.id); }
  });
  input.on('close', () => { for (const controller of pending.values()) controller.abort(); });
}
