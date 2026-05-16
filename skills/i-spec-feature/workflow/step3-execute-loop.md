# 阶段三：编码与提交循环 执行指导

按 `tasks.md` 严格执行 编码 → 编译自洽 → pre-commit 校验 → Commit → 更新 tasks.md，循环至所有任务完成。

> **核心约束**：本阶段**不做任何代码探索**，仅以 `change-plan.md` 与 `tasks.md` 为蓝图执行编码。如发现 plan 留白或落点错误，按本文末尾 [设计缺陷识别与 CRITICAL] 流程阻断。

---

## 单轮执行循环

### Select

从 `tasks.md` 取第一个未勾选（`[ ]`）且所有依赖均已勾选（`[x]`）的任务，若不存在则进入阶段四。

### Code

在指定 `repoDir` 下，按 `change-plan.md` 中对应 Cx 的精确描述编写实现代码：

- **严格只写实现部分**（业务逻辑 / DAO / API / 配置 / migration 文件等）
- **不写**任何测试代码（单测 / 集成 / E2E 等一概不写）
- 编码过程中保持「**风险信号雷达**」常开：参考 [`.cursor/skills/feature/references/代码风险信号.md`](../../feature/references/代码风险信号.md) 的六大核心信号（隐性认知过多 / 职责边界错位 / 修改扩散效应 / 架构范式不一致 / 防御性缺失 / 过度设计与僵尸化），凡接触到的项目既有代码若呈现风险信号，**当场记录到本 Cx 的风险笔记**（不修复、不扩散范围）

### Build Sanity

编译自洽性兜底，**不跑任何测试**：

```bash
cd <repoDir> && {AGENTS.md 中声明的构建命令}
```

- 编译失败 → 修复实现代码至编译通过
- 不调用任何 `*test*` / `spec` 命令；运行时行为校验整体留给 `i-verify` 阶段处理

### Pre-commit 校验（必须）

```bash
git -C <repoDir> diff --cached --name-only
```

对照本 task 的交付物文件列表，确认 staged 范围正确。多余文件：`git -C <repoDir> restore --staged <file>`。**确保未暂存任何 `*_test.*` / `**tests**/**` 类测试文件**（本步骤不应产生此类文件，若误生成需先删除再提交）。

### Commit

```bash
git -C <repoDir> add {本 Cx 范围内的文件}
git -C <repoDir> commit -m "$(cat <<'EOF'
reqId: <iterationId>-<reqId>

{AGENTS.md 中规范的 commit body，例：feat(scope): 功能描述 [CxID]}
EOF
)"
```

### Update

在 `tasks.md` 中将对应项标记为 `[x]`，追加 `(Repo: {repoDir}, Commit: {hash})`。若本 Cx 编码过程中识别到风险信号，立即在该任务项下追加：

```
⚠️ 风险信号:
  - [类型] - [文件:行号]: {一句话摘要，详细描述留给最终报告}
```

（此处只做轻量索引，最终报告在阶段四统一展开）

### Loop

返回 Select 步骤。

---

## 设计缺陷识别与 CRITICAL

### 触发时机（满足任一）

- 编写代码或读取 `change-plan.md` 时，发现引用的表 / 字段 / 接口 / 文件在代码库中**实际不存在**
- `change-plan.md` 中仍存在未收敛的「**粒度留白（已授权）**」条目（视为 PLANNING 阶段不完整，不在当前阶段自行决策）

### 处理步骤

1. **不修改任何代码**（保持零代码改动状态）
2. 主动排查信息盲区：
   - 该字段/接口是否存在于其他位置（`rg "{name}" --type {lang}`）
   - design.md 中对该概念的原始描述（确认正确落点）
   - 后续哪些 Cx 也依赖同一错误假设（错误链分析）
3. 在 `tasks.md` 追加 CRITICAL 条目（模板见下）
4. 停止执行循环，输出介入请求并 yield

### CRITICAL 模板

```markdown
## ⚠️ CRITICAL — 设计缺陷，需人工介入

**CRITICAL-ID**: CRITICAL-{N}
**触发任务**: {CxID}（发现于编码阶段）
**状态**: 🔴 BLOCKED

**具体矛盾**（精确到文件路径/字段名/表名）:

- change-plan.md {CxID} 声明：{具体描述}
- 代码库实际状态：{具体冲突}
- 推断来源：{依据，如 design.md §X.Y}

**影响范围（错误链）**:

| 条目     | 受影响原因                       |
| -------- | -------------------------------- |
| {CxID}   | {描述}                           |
| {CxID+1} | {若依赖上一条产出则也受影响}     |

**需要人工决策的选项**:

- 方案 A：{描述} → 如选此方案，请修改 change-plan.md 的 {CxID} 后通知继续
- 方案 B：{描述}

**已完成部分**: C1~C{N-1} 均已正常提交，不受影响，无需回退
```
