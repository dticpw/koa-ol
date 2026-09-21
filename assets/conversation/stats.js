const STORAGE_KEY = 'koa_stats_pwd';

        // ===== DOM =====
        const gate        = document.getElementById('gate');
        const main        = document.getElementById('main');
        const pwdInput    = document.getElementById('pwd');
        const enterBtn    = document.getElementById('enter-btn');
        const gateError   = document.getElementById('gate-error');
        const refreshBtn  = document.getElementById('refresh-btn');
        const logoutBtn   = document.getElementById('logout-btn');
        const updatedAt   = document.getElementById('updated-at');

        // ===== 工具 =====
        function fmtTime(ts) {
            if (!ts) return '-';
            return new Date(ts).toLocaleString('zh-CN', { hour12: false });
        }
        function fmtNum(n) {
            if (n == null) return '-';
            return Number(n).toLocaleString();
        }
        function escape(s) {
            return String(s || '').replace(/[<>&"']/g, c => ({
                '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
            }[c]));
        }

        function formatLocation(row) {
            const parts = [...new Set([row.country, row.region, row.city]
                .filter(value => typeof value === 'string' && value.trim() && value !== 'XX')
                .map(value => value.trim()))];
            if (!row.city) parts.push('城市未记录');
            return escape(parts.join(' · '));
        }

        // ===== 密码门 =====
        enterBtn.onclick = () => {
            if (enterBtn.disabled) return;
            const pwd = pwdInput.value.trim();
            if (!pwd) return;
            enterBtn.disabled = true;
            gateError.textContent = '验证中...';
            fetchStats(pwd).then(data => {
                // 成功 → 保存密码 + 进入主页
                localStorage.setItem(STORAGE_KEY, pwd);
                gate.style.display = 'none';
                main.style.display = 'block';
                renderAll(data);
            }).catch(err => {
                gateError.textContent = '❌ ' + err.message;
                enterBtn.disabled = false;
            });
        };
        pwdInput.addEventListener('keypress', e => { if (e.key === 'Enter') enterBtn.click(); });

        logoutBtn.onclick = () => {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        };

        refreshBtn.onclick = async () => {
            const pwd = localStorage.getItem(STORAGE_KEY);
            refreshBtn.disabled = true;
            document.getElementById('refresh-error').textContent = '';
            try {
                const data = await fetchStats(pwd);
                renderAll(data);
            } catch (e) {
                document.getElementById('refresh-error').textContent = '刷新失败：' + e.message;
            }
            refreshBtn.disabled = false;
        };

        // ===== 拉数据 =====
        async function fetchStats(pwd) {
            const res = await fetch(`/api/stats?key=${encodeURIComponent(pwd)}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }
            return data;
        }

        // ===== 渲染 =====
        let currentData = null;
        let chartMetric = 'requests';
        function renderAll(data) {
            currentData = data;
            renderOverall(data.overall);
            renderIpTable(data.per_ip);
            renderCountryTable(data.by_country);
            renderDailyTable(data.daily);
            const filter = document.getElementById('recent-model-filter');
            const selected = filter.value;
            filter.replaceChildren(new Option('全部模型', ''));
            [...new Set((data.recent || []).map(r => r.model).filter(Boolean))].forEach(model => filter.add(new Option(model, model)));
            if ([...filter.options].some(o => o.value === selected)) filter.value = selected;
            renderRecentTable((data.recent || []).filter(r => !filter.value || r.model === filter.value));
            renderTrend(data.daily || []);
            renderModels(data.per_model);
            updatedAt.textContent = `更新于 ${fmtTime(data.generated_at)}`;
        }

        function renderOverall(o) {
            const cards = document.getElementById('overall-cards');
            const successRate = o.total_requests
                ? Math.round((o.successful / o.total_requests) * 100)
                : 0;
            const items = [
                { label: '总调用次数', value: fmtNum(o.total_requests) },
                { label: '独立访客 (IP)', value: fmtNum(o.unique_ips) },
                { label: '成功率', value: o.total_requests ? `${successRate}%` : '—', sub: `${fmtNum(o.successful)}/${fmtNum(o.total_requests)}` },
                { label: '平均耗时', value: o.total_requests ? `${((o.avg_elapsed_ms || 0) / 1000).toFixed(2)} s` : '—' },
                { label: '输入 tokens', value: fmtNum(o.total_input_tokens) },
                { label: '输出 tokens', value: fmtNum(o.total_output_tokens) },
            ];
            cards.innerHTML = items.map(i => `
                <div class="card">
                    <div class="card-label">${i.label}</div>
                    <div class="card-value">${i.value}</div>
                    ${i.sub ? `<div class="card-sub">${i.sub}</div>` : ''}
                </div>
            `).join('');
        }

        function renderIpTable(rows) {
            const tbody = document.querySelector('#ip-table tbody');
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-table">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = rows.map(r => `
                <tr>
                    <td class="ip">${escape(r.ip)}</td>
                    <td>${formatLocation(r)}</td>
                    <td class="num">${fmtNum(r.requests)}</td>
                    <td class="num">${fmtNum(r.total_input)}</td>
                    <td class="num">${fmtNum(r.total_output)}</td>
                    <td class="num">${r.errors > 0 ? `<span class="stage-network">${fmtNum(r.errors)}</span>` : '0'}</td>
                    <td>${fmtTime(r.first_seen)}</td>
                    <td>${fmtTime(r.last_seen)}</td>
                </tr>
            `).join('');
        }

        function renderCountryTable(rows) {
            const tbody = document.querySelector('#country-table tbody');
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="empty-table">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = rows.map(r => `
                <tr>
                    <td>${escape(r.country)}</td>
                    <td class="num">${fmtNum(r.requests)}</td>
                    <td class="num">${fmtNum(r.unique_ips)}</td>
                </tr>
            `).join('');
        }

        function renderDailyTable(rows) {
            const tbody = document.querySelector('#daily-table tbody');
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-table">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = rows.map(r => `
                <tr>
                    <td>${escape(r.day)}</td>
                    <td class="num">${fmtNum(r.requests)}</td>
                    <td class="num">${fmtNum(r.unique_ips)}</td>
                    <td class="num">${fmtNum(r.input_tokens)}</td>
                    <td class="num">${fmtNum(r.output_tokens)}</td>
                </tr>
            `).join('');
        }

        function renderRecentTable(rows) {
            const tbody = document.querySelector('#recent-table tbody');
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="empty-table">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = rows.map(r => `
                <tr>
                    <td>${fmtTime(r.ts)}</td>
                    <td class="ip">${escape(r.ip)}</td>
                    <td>${formatLocation(r)}</td>
                    <td>${escape(r.model)}</td>
                    <td class="num">${fmtNum(r.input_tokens)}</td>
                    <td class="num">${fmtNum(r.output_tokens)}</td>
                    <td class="num">${fmtNum(r.elapsed_ms)}</td>
                    <td class="num">${fmtNum(r.history_len)}</td>
                    <td><span class="stage-badge ${r.stage === 'success' ? 'stage-success' : 'stage-error'}">${r.stage === 'success' ? '成功' : escape(r.stage || '未知')}</span>${r.error ? `<details class="log-error"><summary>错误详情</summary><p>${escape(r.error)}</p></details>` : ''}</td>
                </tr>
            `).join('');
        }


        function renderTrend(rows) {
            const chart = document.getElementById('trend-chart');
            chart.replaceChildren();
            const indexed = new Map(rows.map(r => [r.day, r]));
            const now = new Date(currentData?.generated_at || Date.now());
            const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
            const days = Array.from({length:30}, (_,i) => {
                const day = new Date(end - (29-i)*86400000).toISOString().slice(0,10);
                const row = indexed.get(day) || {};
                return {day, value: chartMetric === 'requests' ? Number(row.requests || 0) : Number(row.input_tokens || 0)+Number(row.output_tokens || 0)};
            });
            const max = Math.max(1, ...days.map(d=>d.value));
            const total = days.reduce((sum,d)=>sum+d.value,0);
            const label = document.createElement('div'); label.className = 'trend-total';
            label.innerHTML = `<strong>${fmtNum(total)}</strong><span>${chartMetric === 'requests' ? '次调用' : 'tokens'} / 30 天</span>`;
            chart.append(label);
            const bars = document.createElement('div'); bars.className = 'chart-bars';
            for (const {day,value} of days) {
                const bar = document.createElement('button'); bar.className='chart-bar';
                bar.style.setProperty('--bar-height', `${Math.max(value ? 2 : 0, value/max*100)}%`);
                bar.setAttribute('aria-label', `${day}：${fmtNum(value)} ${chartMetric==='requests'?'次请求':'tokens'}`);
                bar.dataset.tip = `${day.slice(5)} · ${fmtNum(value)}`;
                bar.innerHTML = '<span></span>'; bars.append(bar);
            }
            chart.append(bars);
            document.getElementById('trend-start').textContent=days[0].day.slice(5);
            document.getElementById('trend-end').textContent=days[29].day.slice(5);
        }
        function renderModels(rows) {
            const target=document.getElementById('model-usage'); target.replaceChildren();
            if (!Array.isArray(rows)) { target.textContent='模型汇总将在统计接口更新后显示。'; return; }
            if (!rows.length) { target.textContent='还没有模型调用记录。'; return; }
            const total=rows.reduce((sum,r)=>sum+Number(r.input_tokens||0)+Number(r.output_tokens||0),0);
            for (const r of rows) {
                const tokens=Number(r.input_tokens||0)+Number(r.output_tokens||0);
                const item=document.createElement('div');item.className='model-usage-row';
                item.innerHTML=`<div class="model-usage-heading"><strong>${escape(r.model || '未记录模型')}</strong><span>${fmtNum(r.requests)} 次</span></div><div class="usage-track"><span style="width:${total?tokens/total*100:0}%"></span></div><div class="model-usage-meta"><span>输入 ${fmtNum(r.input_tokens)} / 输出 ${fmtNum(r.output_tokens)}</span><span>${total?(tokens/total*100).toFixed(1):'0'}%</span></div>`;
                target.append(item);
            }
        }
        document.querySelectorAll('[data-metric]').forEach(button => button.onclick=()=>{
            chartMetric=button.dataset.metric;
            document.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
            if(currentData)renderTrend(currentData.daily||[]);
        });
        document.getElementById('recent-model-filter').onchange=e=>{
            if(currentData)renderRecentTable((currentData.recent||[]).filter(r=>!e.target.value||r.model===e.target.value));
        };

        // ===== 自动登录（如果 localStorage 里已经有密码） =====
        (async () => {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;
            try {
                const data = await fetchStats(saved);
                gate.style.display = 'none';
                main.style.display = 'block';
                renderAll(data);
            } catch {
                // 密码失效了，等用户重新输入
                localStorage.removeItem(STORAGE_KEY);
            }
        })();
