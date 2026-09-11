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
                    segments.push({ type: 'text', content: text.slice(lastIndex, m.index) });
                }
                segments.push({
                    type: 'code',
                    lang: (m[1] || '').toLowerCase(),
                    content: m[2].replace(/\n$/, ''),
                });
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < text.length) {
                segments.push({ type: 'text', content: text.slice(lastIndex) });
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

        function renderTextWithCodeBlocks(text, container) {
            const segments = parseCodeBlocks(text);
            for (const seg of segments) {
                if (seg.type === 'text') {
                    if (seg.content.length === 0) continue;
                    const p = document.createElement('div');
                    p.className = 'text-segment';
                    p.textContent = seg.content;
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
        titleEl.onclick = () => {
            if (sending || attachmentLoading) return;
            if (!history.length || confirm('清空当前对话？')) {
                history = [];
                pendingAttachments = [];
                input.value = '';
                input.style.height = '';
                statusEl.textContent = '';
                renderAttachments();
                input.focus();
                debugPanel.style.display = 'none';
                render();
            }
        };

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
                renderMessageContent(m.content, div);
                messagesEl.appendChild(div);
            }
            document.querySelector('.message-viewport').scrollTop = document.querySelector('.message-viewport').scrollHeight;
        }

        // ================= 发送 =================
        async function send() {
            if (sending || attachmentLoading) return;
            const selectedProvider = modelSelect.value;
            const selectedLabel = modelLabels[selectedProvider];
            const text = input.value.trim();
            if (!text && pendingAttachments.length === 0) return;

            const sentAttachments = [...pendingAttachments];
            const userContent = buildUserContent(text, pendingAttachments);
            if (selectedProvider !== 'gpt' && [...history, { content: userContent }].some(m =>
                Array.isArray(m.content) && m.content.some(block => block.type !== 'text'))) {
                statusEl.textContent = '当前对话含图片或 PDF，请切换到 GPT，或点击“新对话”后开始纯文本对话。';
                statusEl.className = 'status error';
                return;
            }
            sending = true;
            modelSelect.disabled = true;
            history.push({ role: 'user', content: userContent });

            input.value = '';
            input.style.height = '';
            pendingAttachments = [];
            renderAttachments();
            debugPanel.style.display = 'none';
            render();
            sendBtn.disabled = true;
            attachBtn.disabled = true;
            const thinking = document.createElement('div');
            thinking.id = 'thinking'; thinking.className = 'thinking-row';
            thinking.innerHTML = '<span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
            thinking.append(document.createTextNode(`${selectedLabel} 正在回复`));
            messagesEl.append(thinking);
            document.querySelector('.message-viewport').scrollTop = document.querySelector('.message-viewport').scrollHeight;
            statusEl.textContent = `${selectedLabel} 思考中...`;
            statusEl.className = 'status';

            let res, rawText;
            try {
                res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: history, model: selectedProvider }),
                });
                rawText = await res.text();
            } catch (e) {
                statusEl.textContent = '❌ 请求未发出：' + e.message;
                statusEl.className = 'status error';
                debugContent.textContent = String(e);
                debugPanel.style.display = 'block';
                history.pop();
                input.value = input.value ? text + '\n\n' + input.value : text;
                pendingAttachments = [...sentAttachments, ...pendingAttachments];
                renderAttachments();
                document.getElementById('thinking')?.remove();
                render();
                sendBtn.disabled = false;
                sending = false;
                modelSelect.disabled = false;
                attachBtn.disabled = false;
                return;
            }

            let data = null;
            try { data = JSON.parse(rawText); } catch { /* 不是 JSON */ }

            if (!res.ok || typeof data?.reply !== 'string') {
                statusEl.textContent = !res.ok ? `❌ HTTP ${res.status} ${res.statusText}` : '❌ 服务返回了无法读取的回复';
                statusEl.className = 'status error';
                debugContent.textContent = data
                    ? JSON.stringify(data, null, 2)
                    : rawText.slice(0, 2000) + (rawText.length > 2000 ? '\n...(截断)' : '');
                debugPanel.style.display = 'block';
                history.pop();
                input.value = input.value ? text + '\n\n' + input.value : text;
                pendingAttachments = [...sentAttachments, ...pendingAttachments];
                renderAttachments();
                document.getElementById('thinking')?.remove();
                render();
                sendBtn.disabled = false;
                sending = false;
                modelSelect.disabled = false;
                attachBtn.disabled = false;
                input.focus();
                return;
            }

            history.push({ role: 'assistant', content: data.reply || '(空回复)', modelLabel: selectedLabel });
            render();
            statusEl.textContent = data._debug
                ? `${data._debug.model || selectedLabel} · ${(data._debug.elapsed_ms / 1000).toFixed(1)} 秒`
                : '回复完成';
            sendBtn.disabled = false;
            sending = false;
            modelSelect.disabled = false;
            attachBtn.disabled = false;
            input.focus();
        }

        sendBtn.onclick = send;
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
            document.getElementById('attachment-hint').textContent = modelSelect.value === 'gpt' ? '文字 / 图片 / PDF' : '文字 / 文本文件';
            fileInput.accept = modelSelect.value === 'gpt' ? 'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown,.md,.txt,.csv,.json,.js,.py,.html,.css' : 'text/plain,text/markdown,.md,.txt,.csv,.json,.js,.py,.html,.css';
        };
        modelSelect.addEventListener('change', updateModelHint);
        updateModelHint();
