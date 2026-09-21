# 百页行：完整候选版评估与回退

主持规则、上下文选择、结算约束和叙事审查会相互影响。优化以一个完整候选版作为评估、提交和发布单位，不将单项评分较高的提示词片段机械拼接。Git 的提交记录便于追踪，但不代表每个提交都应发布。

## 当前基线

- 标签：`fiction-baseline-20260921-r9`
- 线上代码：`f89a49024bbdf4357addadc98c278b28fc507215`
- 已核对的部署：`0ac2938c-61a5-4b90-9eb2-e74d0023a407`
- 主持规则版本 9；正式冒险存档 version 1 / memoryVersion 1。
- 这是一份已游玩、已测试的对照版本，并非无缺陷版本；长测中已记录的卡顿与拒绝问题仍是后续优化目标。

本批工具不改变线上主持行为，不触碰线上数据库。两套本机试玩入口最初使用相同的主持逻辑，候选环境将在后续完整优化提交后切换。

## 隔离试玩

工作仓库 `/mnt/e/PG/koa-ai-fiction`；工具仅依赖 Python 标准库和支持 `node:sqlite` 的 Node 22+。命令中的 `PY`、`NODE` 是本机工具路径；Python 脚本本身不硬编码这些路径。

```bash
cd /mnt/e/PG/koa-ai-fiction
PY=/home/dticpw/conda/envs/py310/bin/python
NODE=/home/dticpw/.nvm/versions/node/v22.23.2/bin/node
RELEASE=/mnt/e/PG/agent-artifacts/fiction-release-20260921
```

从 Git 提交制作固定快照，必须使用尚不存在的输出目录；不能直接在快照中改代码。新候选使用新目录名。

```bash
"$PY" scripts/fiction_release.py snapshot --ref fiction-baseline-20260921-r9 --out "$RELEASE/baseline-source"
"$PY" scripts/fiction_release.py snapshot --ref HEAD --out "$RELEASE/candidate-source"
```

这两个快照在本次交付时已经创建，不要重复执行以上创建命令。源文件和 Git blob 指纹一起保存；启动及兼容检查都会核对文件未被改动。

无模型离线检查：能新开局、恢复与操作收藏；提交自由行动会明确提示模型不可用，不伪造主持回复。

```bash
"$PY" scripts/fiction_release.py start --source "$RELEASE/baseline-source" --data "$RELEASE/baseline-data" --port 18881 --label baseline-r9 --mode offline --node "$NODE"
"$PY" scripts/fiction_release.py start --source "$RELEASE/candidate-source" --data "$RELEASE/candidate-data" --port 18882 --label candidate --mode offline --node "$NODE"
```

真实主持模式：先按 credential-vault Skill 读取指定条目，密钥只进入子进程环境，不写入文件、参数或日志。也支持调用者已提供 `UPSTREAM_API_KEY` / `UPSTREAM_BASE_URL`，省略 `--vault-cli`。

```bash
AGENTFLOW_CREDENTIALS_FILE=/mnt/e/PG/keys/credentials.md "$PY" scripts/fiction_release.py start --source "$RELEASE/candidate-source" --data "$RELEASE/candidate-data" --port 18882 --label candidate --mode real --node "$NODE" --vault-cli /mnt/c/Users/DTICPW/agent-workflows/skills/credential-vault/scripts/credential_vault.py
```

将 source/data/port/label 分别换成 baseline-source、baseline-data、18881、baseline-r9 可启动基线。一个数据目录只能运行一个实例；已经运行时先 stop。

- 基线：<http://127.0.0.1:18881/games/fiction/>
- 候选：<http://127.0.0.1:18882/games/fiction/>
- 只监听本机回环地址，不能作为朋友的公网测试入口；未创建 Cloudflare 公开 staging。
- 使用实际游戏页面、路由与模型调用；数据库由本地 SQLite 适配，不等于完整模拟 Cloudflare D1 的网络、并发和运行时。
- 每边独立 SQLite、会话、收藏、限额账本；Cookie 按端口额外加前缀，因为浏览器原生 Cookie 不按端口隔离。
- 每个实例模型预算默认每日 5 美元，可用 `FICTION_PREVIEW_BUDGET_USD` 调整；仍会使用真实模型余额，与生产额度账本分开。
- 页面标题带本机测试标识；网页源码中的外部导航链接仍可能前往线上站点，试玩请停留在本机百页行栏目中。
- 页面及静态资源采用允许清单，源码和数据库不作为静态文件暴露。
- 数据与调试 trace 存于私有产物目录，含剧本隐藏信息；不要提交 Git 或公开。

状态、停机操作保留存档；改变实例源码版本前会用 SQLite backup API 备份现有本地库，涵盖 WAL 中的已提交内容。脚本通过 `/proc` 核对进程归属，因此 start/stop/status 生命周期管理限 Linux；快照、兼容检查等核心流程可跨平台使用。

```bash
"$PY" scripts/fiction_release.py status --data "$RELEASE/candidate-data"
"$PY" scripts/fiction_release.py stop --data "$RELEASE/candidate-data"
```

## 存档兼容门槛

使用服务器权威状态，而非网页导出的阅读记录。后者缺少隐藏世界状态，不能当成完整恢复存档。

```bash
"$NODE" scripts/fiction-compat.mjs --baseline "$RELEASE/baseline-source" --candidate "$RELEASE/candidate-source" --saves "$RELEASE/authoritative-samples.private.json" --out "$RELEASE/compat.json"
```

`--saves` 接收状态数组或 `{states:[]}`。也可用 `--db "$RELEASE/candidate-data/state.sqlite"` 只读抽取本机试玩的权威会话，两个输入可同时使用。

检查所有基线剧本的新开局、缺少历史记忆字段的旧状态、提交的实际中途/结局状态；验证地点、物品位置、里程碑、版本，以及读取与 JSON 持久化是否保留事实。新版会执行一次不改变现场的确认、保存，再让旧版读取并继续。源码指纹绑定具体提交。

边界：这只是样本兼容检查，不保证任意未来行动、全部分支或数据库迁移安全，也不覆盖早期经典/实验模式存档。发布前需补充候选版真实游玩产生的权威状态，覆盖衍生物品、待定行动、NPC 同行、长程记忆及结局，不能只依赖旧版输入。输出报告含文件指纹与案例结果，不复制完整私有存档。

若改存档结构：先备份实际生产数据库，准备向前迁移和可验证的反向迁移/兼容读取策略，再发布。本次没有制作生产 D1 备份；本机备份不能替代生产备份。不能用旧数据库覆盖线上库来“恢复代码”，否则会丢失发布后游客的冒险。

## 恢复完整版本

在需要发布回退的干净工作树中运行。先查看计划，不修改任何文件：

```bash
"$PY" scripts/fiction_release.py rollback
```

确认兼容报告对应**该工作树当前 HEAD**及目标基线，且包含进度大于零的状态后，执行：

```bash
"$PY" scripts/fiction_release.py rollback --apply --compat "$RELEASE/compat.json"
```

工具恢复 `config/fiction-release.json` 定义的百页行范围，连同规则、剧本、引擎和相关页面整体恢复；删除候选新增的范围内文件，同时保留其他游戏/主页改动。它生成新的回退提交，不重写历史，不执行 reset --hard，不自动推送或部署，也不改游客数据库。若已无差异则无需生成提交。

拒绝条件：工作树不干净、未跟踪文件碰撞、缺失/失败/版本不匹配的兼容报告、无中途状态覆盖。若核心持久化文件变化，工具保守拒绝自动回退，需另行审核数据库兼容与备份。仅确认 schema 和存档写入格式均未改变时，可附 `--persistence-review <本地审查JSON>`：必须绑定 baselineCommit、candidateCommit、files（变更的核心持久化文件，排序），且 schemaUnchanged / storedStateUnchanged 为 true，包含 reviewer 和 checks。它是显式人工审查凭证，不是工具自动证明；真实迁移不能通过此入口绕过，需另行备份和迁移方案。新增共享依赖或迁移文件超出 scope 时，必须先复核恢复范围；此工具不能自动识别所有依赖关系。

开发分支与发布分支即使文件相同也可能是不同提交。应在实际准备回退的发布分支制作候选快照和对应报告。发布工作树使用工具前，需先带入这批工具提交。恢复提交通过测试后，沿项目原有 main → Cloudflare Pages 流程推送，核实成功部署的 commit 与实际线上行为；本地提交成功不等于线上已回退。

## 完整候选验收

保持基线不变，让候选跑同一套案例，并做独立自由游玩。综合评价自由行动、连续动作、玩家意图、善意裁量、事实连续性、信息边界、卡关救济、结局体验、长程记忆、拒绝/重试率、延迟与费用。总体改善才发布；不能用一个分项上涨掩盖其他关键体验退化。模型具有随机性，重要案例需复跑，记录模型名、版本提交和完整 trace。

本批工具验证命令：

```bash
FICTION_PYTHON="$PY" "$NODE" --test tests/fiction-*.test.mjs
PYTHONDONTWRITEBYTECODE=1 "$PY" tests/fiction-release-tools.py
```

测试将临时实例、模拟 Git 仓库与报告放入相邻 `agent-artifacts/fiction-release-tests/`，可用 `FICTION_TEST_ARTIFACTS` 指定其他获准产物位置。真实回退演练只在这些模拟仓库执行。
