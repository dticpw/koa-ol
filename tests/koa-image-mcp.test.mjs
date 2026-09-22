import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { callImageTool, handleRpc } from '../docs/codex-client/koa-images/server.mjs';

const root=process.env.KOA_IMAGE_TEST_ROOT;
if(!root)throw new Error('Set KOA_IMAGE_TEST_ROOT to the task artifact directory');
await mkdir(root,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64');
const getKey=async()=> 'test-key';
async function fixture(t){const dir=await mkdtemp(join(root,'mcp-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}

test('real stdio process initializes and lists tools without startup noise', {timeout:5000}, async t=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('../docs/codex-client/koa-images/server.mjs',import.meta.url))],{stdio:['pipe','pipe','pipe']});
  t.after(()=>child.kill());
  const lines=createInterface({input:child.stdout});const iterator=lines[Symbol.asyncIterator]();
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}})+'\n');
  const first=JSON.parse((await iterator.next()).value);assert.equal(first.result.serverInfo.name,'koa-images');
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})+'\n');
  const second=JSON.parse((await iterator.next()).value);assert.equal(second.id,2);assert.equal(second.result.tools.length,2);
  child.stdin.end();lines.close();
});

test('MCP initialization, discovery and unknown methods use standard JSON-RPC',async()=>{
  const r=await handleRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}});
  assert.equal(r.result.protocolVersion,'2025-06-18');assert.ok(r.result.capabilities.tools);
  const list=await handleRpc({id:2,method:'tools/list'});assert.deepEqual(list.result.tools.map(t=>t.name),['generate_image','edit_image']);
  assert.equal(await handleRpc({method:'notifications/initialized'}),null);
  assert.equal((await handleRpc({id:3,method:'missing'})).error.code,-32601);
});

test('generation saves an image and returns both a path and image to Codex',async t=>{
  const dir=await fixture(t);const output=join(dir,'cup.png');
  const result=await callImageTool('generate_image',{prompt:'a cup',output_path:output,quality:'low'},{getKey,fetchImpl:async(url,opts)=>{
    assert.equal(url,'https://koa-ol.com/ai/v1/images/generations');
    assert.equal(opts.headers.Authorization,'Bearer test-key');
    assert.equal(JSON.parse(opts.body).model,'gpt-image-2');
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});
  assert.deepEqual(await readFile(output),png);assert.equal(result.content[1].mimeType,'image/png');
  assert.equal(JSON.parse(result.content[0].text).saved_path,output);
  assert.equal(JSON.parse(result.content[0].text).actual_size,'1x1');
  assert.equal(JSON.parse(result.content[0].text).requested_size,'1024x1024');
  assert.match(JSON.parse(result.content[0].text).warning,/different dimensions/);
});

test('existing output, invalid paths and invalid source data are rejected before any request',async t=>{
  const dir=await fixture(t);const existing=join(dir,'exists.png');await writeFile(existing,png);
  const options={getKey,fetchImpl:async()=>{assert.fail('should not send request');}};
  await assert.rejects(callImageTool('generate_image',{prompt:'x',output_path:existing},options),/already exists/);
  await assert.rejects(callImageTool('generate_image',{prompt:'x',output_path:'relative.png'},options),/absolute/);
  await assert.rejects(callImageTool('generate_image',{prompt:'x',output_path:join(dir,'x.txt')},options),/\.png/);
  const text=join(dir,'input.png');await writeFile(text,'private text, not an image');
  await assert.rejects(callImageTool('edit_image',{prompt:'x',image_path:text,output_path:join(dir,'out.png')},options),/not a PNG/);
  assert.deepEqual(await readFile(existing),png);
});

test('edit sends only the user selected image and saves a new result',async t=>{
  const dir=await fixture(t);const source=join(dir,'source.png');await writeFile(source,png);
  await callImageTool('edit_image',{prompt:'red cup',image_path:source,output_path:join(dir,'edited.png')},{getKey,fetchImpl:async(url,opts)=>{
    assert.ok(url.endsWith('/images/edits'));assert.ok(opts.body instanceof FormData);
    assert.equal(opts.body.get('prompt'),'red cup');assert.equal(opts.headers['Content-Type'],undefined);
    assert.deepEqual(Buffer.from(await opts.body.get('image').arrayBuffer()),png);
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});
  assert.deepEqual(await readFile(source),png);
});

test('service failure does not disclose raw response text or create an image',async t=>{
  const dir=await fixture(t);const output=join(dir,'out.png');
  const r=await handleRpc({id:1,method:'tools/call',params:{name:'generate_image',arguments:{prompt:'cup',output_path:output}}},{getKey,fetchImpl:async()=>new Response('sensitive upstream diagnostics',{status:403})});
  assert.equal(r.result.isError,true);assert.match(r.result.content[0].text,/HTTP 403/);
  assert.equal(JSON.stringify(r).includes('sensitive'),false);
  await assert.rejects(readFile(output),{code:'ENOENT'});
});
