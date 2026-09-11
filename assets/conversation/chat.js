// ================= 常量 =================
        const LIMITS = {
            image:    5 * 1024 * 1024,   // 5 MB
            pdf:     10 * 1024 * 1024,   // 10 MB
            text:     1 * 1024 * 1024,   // 1 MB
        };

        // 语言 → 文件扩展名映射（用于下载命名）
        const LANG_EXT = {
            python: 'py', py: 'py',
            javascript: 'js', js: 'js',
            typescript: 'ts', ts: 'ts',
            tsx: 'tsx', jsx: 'jsx',
            html: 'html', css: 'css', scss: 'scss',
            json: 'json',
            yaml: 'yml', yml: 'yml', toml: 'toml',
            bash: 'sh', shell: 'sh', sh: 'sh', zsh: 'sh',
            markdown: 'md', md: 'md',
            sql: 'sql', xml: 'xml',
            go: 'go', golang: 'go',
            rust: 'rs', rs: 'rs',
            java: 'java', kotlin: 'kt',
            cpp: 'cpp', 'c++': 'cpp', c: 'c', h: 'h',
            ruby: 'rb', rb: 'rb',
            php: 'php',
            swift: 'swift',
            csharp: 'cs', 'c#': 'cs', cs: 'cs',
            dockerfile: 'Dockerfile',
            vue: 'vue', svelte: 'svelte',
            r: 'r',
        };

        // ================= 状态 =================
        // history 里存储的 content 可能是 string（纯文本）或 array（多模态）
        // 渲染和发送时都兼容两种格式
        let history = [];
        // 待发送的附件列表。每项形如:
        //   { kind: 'image', name, size, mediaType, base64, previewUrl }
        //   { kind: 'pdf',   name, size, mediaType, base64 }
        //   { kind: 'text',  name, size, text }
        let pendingAttachments = [];

        // ================= DOM =================
        const messagesEl   = document.getElementById('messages');
        const emptyState   = document.getElementById('empty-state');
        const input        = document.getElementById('input');
        const sendBtn      = document.getElementById('send-btn');
        const statusEl     = document.getElementById('status');
        const debugPanel   = document.getElementById('debug-panel');
        const debugContent = document.getElementById('debug-content');
        const titleEl      = document.getElementById('new-chat');
        const attachBtn    = document.getElementById('attach-btn');
        const fileInput    = document.getElementById('file-input');
        const attachmentsEl = document.getElementById('attachments');
        const modelSelect  = document.getElementById('model-select');

        const modelLabels = { gpt: 'GPT · gpt-5.6-sol', deepseek: 'DeepSeek', qwen: '千问' };
        let sending = false;
        let attachmentLoading = false;

        // ================= 工具函数 =================
        function humanSize(n) {
            if (n < 1024) return n + ' B';
            if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
            return (n / 1024 / 1024).toFixed(2) + ' MB';
        }

        // 把 DataURL 变成纯 base64（去掉 "data:image/png;base64," 前缀）
        function stripDataUrlPrefix(dataUrl) {
            const comma = dataUrl.indexOf(',');
            return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        }

        function readFileAsDataURL(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload  = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
        }

        function readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload  = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsText(file);
            });
        }

        // ============= 代码块解析 + 下载 =============
        // 把含 ```lang\n...\n``` 的文本切成 [{type:'text'|'code', ...}]
        function parseCodeBlocks(text) {
            const segments = [];
            const regex = /```([\w+#.-]*)\n?([\s\S]*?)```/g;
            let lastIndex = 0;
            let m;
            while ((m = regex.exec(text)) !== null) {
                if (m.index > lastIndex) {
                    segments.push({ type: 'text', content: text.slice(lastIndex, m.index), start: lastIndex });
                }
                segments.push({
                    type: 'code',
                    lang: (m[1] || '').toLowerCase(),
                    content: m[2].replace(/\n$/, ''),
                });
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < text.length) {
                segments.push({ type: 'text', content: text.slice(lastIndex), start: lastIndex });
            }
            return segments;
        }

        function downloadText(content, filename) {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function suggestFilename(lang, content) {
            // 尝试从代码注释里嗅探文件名，比如 "# file: app.py" 或 "// File: App.tsx"
            const firstLine = (content.split('\n')[0] || '').trim();
            const hint = firstLine.match(/(?:file|filename|@file)[:：\s]+([\w./-]+\.[\w]+)/i);
            if (hint) return hint[1];

            const ext = LANG_EXT[lang] || (lang ? lang : 'txt');
            const ts = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
            return `snippet-${ts}.${ext}`;
        }

        function renderCodeBlock(seg, container) {
            const box = document.createElement('div');
            box.className = 'code-block';

            const header = document.createElement('div');
            header.className = 'code-header';

            const lang = document.createElement('span');
            lang.className = 'code-lang';
            lang.textContent = seg.lang || 'text';
            header.appendChild(lang);

            const actions = document.createElement('div');
            actions.className = 'code-actions';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-btn';
            copyBtn.textContent = '复制';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(seg.content).then(() => {
                    copyBtn.textContent = '已复制';
                    setTimeout(() => { copyBtn.textContent = '复制'; }, 1500);
                }).catch(() => {
                    copyBtn.textContent = '复制失败';
                });
            };
            actions.appendChild(copyBtn);

            const dlBtn = document.createElement('button');
            dlBtn.className = 'code-btn';
            dlBtn.textContent = '下载';
            dlBtn.onclick = () => {
                const filename = suggestFilename(seg.lang, seg.content);
                downloadText(seg.content, filename);
            };
            actions.appendChild(dlBtn);

            header.appendChild(actions);
            box.appendChild(header);

            const body = document.createElement('pre');
            body.className = 'code-body';
            body.textContent = seg.content;
            box.appendChild(body);

            container.appendChild(box);
        }

        function renderTextWithCodeBlocks(text, container, citations = []) {
            const segments = parseCodeBlocks(text);
            for (const seg of segments) {
                if (seg.type === 'text') {
                    if (seg.content.length === 0) continue;
                    const p = document.createElement('div');
                    p.className = 'text-segment';
                    let cursor = 0;
                    for (const citation of citations) {
                        const start = citation.start - seg.start;
                        const end = citation.end - seg.start;
                        if (!Number.isInteger(start) || !Number.isInteger(end) || start < cursor || end < start || end > seg.content.length) continue;
                        let url;
                        try { url = new URL(citation.url); } catch { continue; }
                        if (!['https:', 'http:'].includes(url.protocol)) continue;
                        p.append(document.createTextNode(seg.content.slice(cursor, start)));
                        const link = document.createElement('a');
                        link.className = 'source-citation';
                        link.href = url.href;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.textContent = citation.title || url.hostname;
                        link.title = url.href;
                        p.append(link);
                        cursor = end;
                    }
                    p.append(document.createTextNode(seg.content.slice(cursor)));
                    container.appendChild(p);
                } else if (seg.type === 'code') {
                    renderCodeBlock(seg, container);
                }
            }
        }

        function classifyFile(file) {
            const mt = file.type;
            if (mt.startsWith('image/')) {
                if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mt)) {
                    throw new Error(`不支持的图片格式: ${mt}。支持 JPEG/PNG/GIF/WebP。`);
                }
                if (file.size > LIMITS.image) throw new Error(`图片超过 ${humanSize(LIMITS.image)} 限制`);
                return 'image';
            }
            if (mt === 'application/pdf') {
                if (file.size > LIMITS.pdf) throw new Error(`PDF 超过 ${humanSize(LIMITS.pdf)} 限制`);
                return 'pdf';
            }
            // 其它按文本处理（纯文本/markdown/代码/csv/json）
            if (file.size > LIMITS.text) throw new Error(`文本文件超过 ${humanSize(LIMITS.text)} 限制`);
            return 'text';
        }

        // ================= 附件处理 =================
        attachBtn.onclick = () => fileInput.click();

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || sending || attachmentLoading) return;
            fileInput.value = ''; // 允许再次选同一个文件
            attachmentLoading = true;
            sendBtn.disabled = true;
            attachBtn.disabled = true;

            try {
                const kind = classifyFile(file);
                if (kind !== 'text' && modelSelect.value !== 'gpt') {
                    throw new Error('当前模型支持文字和文本文件，图片或 PDF 请先切换到 GPT。');
                }
                statusEl.textContent = `读取中: ${file.name}...`;
                statusEl.className = 'status';

                if (kind === 'image') {
                    const dataUrl = await readFileAsDataURL(file);
                    pendingAttachments.push({
                        kind: 'image',
                        name: file.name,
                        size: file.size,
                        mediaType: file.type,
                        base64: stripDataUrlPrefix(dataUrl),
                        previewUrl: dataUrl,
                    });
                } else if (kind === 'pdf') {
                    const dataUrl = await readFileAsDataURL(file);
                    pendingAttachments.push({
                        kind: 'pdf',
                        name: file.name,
                        size: file.size,
                        mediaType: file.type,
                        base64: stripDataUrlPrefix(dataUrl),
                    });
                } else {
                    const text = await readFileAsText(file);
                    pendingAttachments.push({
                        kind: 'text',
                        name: file.name,
                        size: file.size,
                        text: text,
                    });
                }

                statusEl.textContent = '';
                renderAttachments();
            } catch (err) {
                statusEl.textContent = '❌ ' + err.message;
                statusEl.className = 'status error';
            } finally {
                attachmentLoading = false;
                sendBtn.disabled = sending;
                attachBtn.disabled = sending;
            }
        });

        function renderAttachments() {
            attachmentsEl.innerHTML = '';
            if (pendingAttachments.length === 0) {
                attachmentsEl.classList.remove('active');
                return;
            }
            attachmentsEl.classList.add('active');

            pendingAttachments.forEach((att, idx) => {
                const chip = document.createElement('div');
                chip.className = 'attachment-chip';

                if (att.kind === 'image') {
                    const thumb = document.createElement('img');
                    thumb.className = 'thumb';
                    thumb.src = att.previewUrl;
                    chip.appendChild(thumb);
                } else {
                    const icon = document.createElement('span');
                    icon.textContent = att.kind === 'pdf' ? '📄' : '📝';
                    chip.appendChild(icon);
                }

                const info = document.createElement('span');
                info.textContent = `${att.name} · ${humanSize(att.size)}`;
                chip.appendChild(info);

                const remove = document.createElement('button');
                remove.className = 'remove-btn';
                remove.textContent = '×';
                remove.title = '移除';
                remove.onclick = () => {
                    pendingAttachments.splice(idx, 1);
                    renderAttachments();
                };
                chip.appendChild(remove);

                attachmentsEl.appendChild(chip);
            });
        }

        // ================= 构造 messages content =================
        function buildUserContent(userText, attachments) {
            // 如果没附件 & 文本有内容 → 用字符串形式，保持简洁
            if (attachments.length === 0) {
                return userText;
            }

            // 有附件 → 构造 content block 数组
            const blocks = [];
            for (const att of attachments) {
                if (att.kind === 'image') {
                    blocks.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: att.mediaType,
                            data: att.base64,
                        },
                    });
                } else if (att.kind === 'pdf') {
                    blocks.push({
                        type: 'document',
                        source: {
                            type: 'base64',
                            media_type: 'application/pdf',
                            data: att.base64,
                        },
                    });
                } else if (att.kind === 'text') {
                    // 纯文本作为 text block 拼到 prompt 里
                    blocks.push({
                        type: 'text',
                        text: `[以下是用户上传的文件 "${att.name}" 的内容]\n\n${att.text}\n\n[文件内容结束]`,
                    });
                }
            }
            // 用户自己的提问文本放最后
            if (userText) {
                blocks.push({ type: 'text', text: userText });
            }
            return blocks;
        }

        // ================= 渲染历史 =================
        let conversationId = crypto.randomUUID();
        let archiveQueue = Promise.resolve();
        let archiveReady = Promise.resolve();
        let activeRequest = null;
        let lastRetry = null;
        const retryBtn = document.getElementById('retry-btn');
        const historyBtn = document.getElementById('history-btn');
        const historyDialog = document.getElementById('history-dialog');
        const archiveNotice = document.getElementById('archive-notice');
        function archiveError() {
            archiveNotice.textContent = '历史记录未能保存，当前对话仍可继续。请检查浏览器存储空间或隐私设置。';
            historyBtn.textContent = '历史 · 未保存';
        }
        function saveConversation() {
            if (!history.length) return archiveQueue;
            const value = structuredClone({ id: conversationId, updated: Date.now(), history,
                model: modelSelect.value, search: searchToggle.getAttribute('aria-pressed') === 'true',
                draft: input.value, draftAttachments: pendingAttachments,
                retry: lastRetry ? { index: lastRetry.index, provider: lastRetry.provider, search: lastRetry.search } : null });
            archiveQueue = archiveQueue.then(() => ChatArchive.save(value)).catch(archiveError);
            return archiveQueue;
        }
        titleEl.onclick = async () => {
            await archiveReady;
            if (sending || attachmentLoading) return;
            await saveConversation();
            conversationId = crypto.randomUUID();
            history = [];
            pendingAttachments = [];
            lastRetry = null;
            retryBtn.hidden = true;
            input.value = '';
            input.style.height = '';
            statusEl.textContent = '';
            renderAttachments();
            debugPanel.style.display = 'none';
            render();
            input.focus();
        };
        document.getElementById('history-close').onclick = () => historyDialog.close();
        historyBtn.onclick = async () => {
            await archiveReady;
            if (sending || attachmentLoading) return;
            await saveConversation();
            historyDialog.showModal();
            await renderArchive();
        };
        async function renderArchive() {
            const list = document.getElementById('history-list');
            list.textContent = '';
            try {
                const records = (await ChatArchive.list()).sort((a,b) => b.updated-a.updated);
                if (!records.length) list.textContent = '还没有保存的对话。';
                for (const record of records) {
                    const row = document.createElement('div'); row.className = 'history-row';
                    const open = document.createElement('button'); open.className = 'history-open';
                    const first = record.history.find(m => m.role === 'user')?.content;
                    const title = typeof first === 'string' ? first : first?.filter(b => b.type === 'text').map(b => b.text).join(' ') || '附件对话';
                    const name = document.createElement('strong'); name.textContent = title.slice(0,70);
                    const date = document.createElement('span'); date.textContent = new Date(record.updated).toLocaleString() + (record.id === conversationId ? ' · 当前对话' : '');
                    open.append(name,date);
                    open.onclick = () => { conversationId = record.id; history = record.history;
                        modelSelect.value = record.model || 'gpt'; searchToggle.setAttribute('aria-pressed',String(record.search !== false)); updateModelHint();
                        pendingAttachments = record.draftAttachments || []; input.value = record.draft || '';
                        lastRetry = record.retry ? {...record.retry,content:history[record.retry.index]?.content} : null; retryBtn.hidden = !lastRetry;
                        statusEl.textContent = '已恢复本机对话'; renderAttachments(); render(); historyDialog.close(); input.focus(); };
                    const remove = document.createElement('button'); remove.className = 'history-delete'; remove.textContent = '删除';
                    remove.setAttribute('aria-label', '删除对话：'+title.slice(0,70));
                    remove.onclick = async () => { if (!confirm('删除这条本机对话及附件？')) return;
                        try { await ChatArchive.remove(record.id); if (record.id === conversationId) { history=[];conversationId=crypto.randomUUID();lastRetry=null;retryBtn.hidden=true;render(); } await renderArchive(); } catch { archiveError(); } };
                    row.append(open,remove);list.append(row);
                }
            } catch { archiveError(); }
        }

        function renderMessageContent(content, container) {
            // content 可能是 string 或 array of blocks
            if (typeof content === 'string') {
                renderTextWithCodeBlocks(content, container);
                return;
            }
            // array 形式
            for (const block of content) {
                if (block.type === 'text') {
                    renderTextWithCodeBlocks(block.text, container);
                } else if (block.type === 'image') {
                    const img = document.createElement('img');
                    img.className = 'attached';
                    img.src = `data:${block.source.media_type};base64,${block.source.data}`;
                    container.appendChild(img);
                } else if (block.type === 'document') {
                    const chip = document.createElement('div');
                    chip.className = 'file-chip';
                    chip.textContent = '📄 PDF 附件';
                    container.appendChild(chip);
                }
            }
        }

        const searchToggle = document.getElementById('web-search-toggle');
        searchToggle.addEventListener('click', () => {
            if (sending) return;
            searchToggle.setAttribute('aria-pressed', String(searchToggle.getAttribute('aria-pressed') !== 'true'));
        });

        function render() {
            messagesEl.innerHTML = '';
            if (history.length === 0) {
                messagesEl.appendChild(emptyState);
                return;
            }
            for (const m of history) {
                const div = document.createElement('div');
                div.className = 'msg ' + m.role;
                const role = document.createElement('div');
                role.className = 'role';
                role.textContent = m.role === 'user' ? '你' : (m.modelLabel || 'AI');
                div.appendChild(role);
                if (m.role === 'assistant') renderTextWithCodeBlocks(m.content, div, m.citations);
                else renderMessageContent(m.content, div);
                if (m.elapsed_ms !== undefined) {
                    const timing = document.createElement('div'); timing.className = 'reply-timing';
                    timing.textContent = `${m.incomplete ? '未完成 · ' : ''}用时 ${(m.elapsed_ms / 1000).toFixed(1)} 秒${m.first_token_ms !== undefined ? ' · 首字 ' + (m.first_token_ms / 1000).toFixed(1) + ' 秒' : ''}`;
                    div.append(timing);
                }
                if (m.searchRequested) {
                    const note = document.createElement('div');
                    note.className = 'search-note';
                    note.textContent = m.searchCalls > 0 ? '已联网检索' : '本次未调用搜索';
                    div.append(note);
                }
                messagesEl.appendChild(div);
            }
            document.querySelector('.message-viewport').scrollTop = document.querySelector('.message-viewport').scrollHeight;
        }

        // ================= 发送 =================
        async function send(retry = false) {
            await archiveReady;
            if (sending || attachmentLoading) return;
            const selectedProvider = retry && lastRetry ? lastRetry.provider : modelSelect.value;
            const selectedLabel = modelLabels[selectedProvider];
            const searchRequested = retry && lastRetry ? lastRetry.search : selectedProvider === 'gpt' && searchToggle.getAttribute('aria-pressed') === 'true';
            const text = input.value.trim();
            if (!retry && !text && pendingAttachments.length === 0) return;
            const userContent = retry && lastRetry ? lastRetry.content : buildUserContent(text, pendingAttachments);
            const base = retry && lastRetry ? history.slice(0,lastRetry.index) : history;
            if (selectedProvider !== 'gpt' && [...base, { content: userContent }].some(m =>
                Array.isArray(m.content) && m.content.some(block => block.type !== 'text'))) {
                statusEl.textContent = '当前对话含图片或 PDF，请切换到 GPT，或新建纯文本对话。';
                statusEl.className = 'status error'; return;
            }
            history = base;
            const index = history.length;
            history.push({role:'user',content:userContent});
            lastRetry = { index, content:userContent, provider:selectedProvider, search:searchRequested };
            if (!retry) { input.value='';input.style.height='';pendingAttachments=[];renderAttachments(); }
            sending = true;
            activeRequest = new AbortController();
            const request = activeRequest;
            modelSelect.disabled = true; attachBtn.disabled = true; searchToggle.disabled = true; historyBtn.disabled = true;
            retryBtn.hidden = true;
            sendBtn.disabled = false; sendBtn.classList.add('is-stopping');
            sendBtn.setAttribute('aria-label','停止回复');sendBtn.title='停止回复';
            debugPanel.style.display='none'; statusEl.className='status';
            render();
            const viewport=document.querySelector('.message-viewport');
            const thinking=document.createElement('div');thinking.className='thinking-row';thinking.id='thinking';
            const phase=document.createElement('span');phase.setAttribute('role','status');
            const clock=document.createElement('span');clock.className='waiting-clock';
            thinking.append(phase,clock);messagesEl.append(thinking);viewport.scrollTop=viewport.scrollHeight;
            let label='正在连接', firstToken, reply='', done=false, finalData, streamError;
            const started=performance.now();
            const tick=()=>{phase.textContent=label;clock.textContent=`已等待 ${((performance.now()-started)/1000).toFixed(1)} 秒`;};
            tick();const timer=setInterval(tick,100);
            let bubble, textNode;
            function delta(text) {
                if (!text) return;
                const follow=viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<100;
                if (firstToken === undefined) firstToken=performance.now()-started;
                label='正在生成回答';tick();
                if (!bubble) { bubble=document.createElement('div');bubble.className='msg assistant streaming';
                    const role=document.createElement('div');role.className='role';role.textContent=selectedLabel;
                    const content=document.createElement('div');content.className='text-segment';textNode=document.createTextNode('');content.append(textNode);
                    bubble.append(role,content);messagesEl.insertBefore(bubble,thinking); }
                reply+=text;textNode.appendData(text);
                if(follow) viewport.scrollTop=viewport.scrollHeight;
            }
            try {
                const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:request.signal,
                    body:JSON.stringify({messages:history.filter(m=>!m.incomplete).map(({role,content})=>({role,content})),model:selectedProvider,web_search:searchRequested,stream:true})});
                if(!res.ok) throw new Error(`HTTP ${res.status}，请重试`);
                if((res.headers.get('content-type')||'').includes('text/event-stream')) {
                    const reader=res.body.getReader();const decoder=new TextDecoder();let buffer='';
                    try {
                        while(!done) {
                            const chunk=await reader.read();buffer+=decoder.decode(chunk.value,{stream:!chunk.done});
                            let boundary;
                            while((boundary=/\r?\n\r?\n/.exec(buffer))) {
                                const frame=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length);
                                const lines=frame.split(/\r?\n/);const type=lines.find(x=>x.startsWith('event:'))?.slice(6).trim();
                                const raw=lines.filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');
                                if(!raw) continue;const data=JSON.parse(raw);
                                if(type==='status') {label=data.label;tick();}
                                if(type==='delta') delta(data.text);
                                if(type==='error') throw new Error(data.error||'回复中断');
                                if(type==='done') {finalData=data;done=true;break;}
                            }
                            if(chunk.done) break;
                        }
                    } finally { await reader.cancel().catch(()=>{}); }
                    if(!done) throw new Error('连接中断，回复未完成');
                } else { finalData=await res.json();if(typeof finalData.reply!=='string') throw new Error('回复格式错误');delta(finalData.reply);done=true; }
                if(request.signal.aborted) throw new DOMException('Stopped','AbortError');
                history.push({role:'assistant',content:finalData.reply,modelLabel:selectedLabel,citations:finalData.citations||[],
                    searchRequested:finalData.web_search?.requested,searchCalls:finalData.web_search?.calls||0,
                    elapsed_ms:performance.now()-started,first_token_ms:firstToken});
                statusEl.textContent=`回复完成 · ${((performance.now()-started)/1000).toFixed(1)} 秒`;
                lastRetry=null;
            } catch(error) {
                streamError=error;
                if(reply) history.push({role:'assistant',content:reply,modelLabel:selectedLabel,incomplete:true,
                    elapsed_ms:performance.now()-started,first_token_ms:firstToken});
                statusEl.textContent=request.signal.aborted ? `已停止 · ${((performance.now()-started)/1000).toFixed(1)} 秒` : error.message;
                statusEl.className=request.signal.aborted?'status':'status error';
            } finally {
                clearInterval(timer);activeRequest=null;sendBtn.disabled=true;
                const follow=viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<100;const oldTop=viewport.scrollTop;
                render();if(!follow) viewport.scrollTop=oldTop;
                await saveConversation();
                sending=false;
                modelSelect.disabled=false;attachBtn.disabled=false;historyBtn.disabled=false;updateModelHint();
                sendBtn.classList.remove('is-stopping');sendBtn.setAttribute('aria-label','发送消息');sendBtn.title='发送消息';sendBtn.disabled=false;
                retryBtn.hidden=!streamError;
                input.focus();
            }
        }
        retryBtn.onclick=()=>send(true);
        window.addEventListener('beforeunload',event=>{if(sending){event.preventDefault();event.returnValue='';}});

        sendBtn.onclick = () => { if (sending) activeRequest?.abort(); else send(); };
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
            }
        });
        document.querySelectorAll('[data-prompt]').forEach(button => {
            button.addEventListener('click', () => { input.value = button.dataset.prompt; input.focus(); input.dispatchEvent(new Event('input')); });
        });
        input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; });
        const updateModelHint = () => {
            searchToggle.disabled = modelSelect.value !== 'gpt';
            searchToggle.title = modelSelect.value === 'gpt' ? '允许 GPT 按需联网搜索' : '联网搜索暂仅支持 GPT';
            document.getElementById('attachment-hint').textContent = modelSelect.value === 'gpt' ? '文字 / 图片 / PDF' : '文字 / 文本文件';
            fileInput.accept = modelSelect.value === 'gpt' ? 'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown,.md,.txt,.csv,.json,.js,.py,.html,.css' : 'text/plain,text/markdown,.md,.txt,.csv,.json,.js,.py,.html,.css';
        };
        modelSelect.addEventListener('change', updateModelHint);
        updateModelHint();

        archiveReady = (async () => {
            try {
                const records = (await ChatArchive.list()).sort((a,b)=>b.updated-a.updated);
                if (records.length) {
                    const record=records[0];conversationId=record.id;history=record.history;
                    modelSelect.value=record.model||'gpt';searchToggle.setAttribute('aria-pressed',String(record.search!==false));
                    pendingAttachments=record.draftAttachments||[];input.value=record.draft||'';
                    lastRetry=record.retry?{...record.retry,content:history[record.retry.index]?.content}:null;retryBtn.hidden=!lastRetry;
                    updateModelHint();renderAttachments();render();
                }
            } catch { archiveError(); }
        })();
