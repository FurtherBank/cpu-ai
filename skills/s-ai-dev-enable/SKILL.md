---
name: s-ai-dev-enable
description: |
  WHAT：对一个研发项目进行 AI 全链路研发赋能——诊断并建设研发资产（AGENTS.md、Cursor Rules、CI 配置、外部工具 Toolkit），使 AI Agent 能自主完成从需求到运维的完整研发循环。
  WHEN：当需要让一个项目可以被 AI 自主迭代时使用；包含对项目 AI 研发能力的建设、验收和交付。支持全新项目、成熟项目增量赋能、重度云平台依赖、发布型 SDK 等多种场景。
---

# s-ai-dev-enable：AI 全链路研发赋能

本 Skill 将一个研发项目的研发资产（代码、AI 提示词、cursor rules、CI 配置、平台资产等）建设到"AI 可无缝托管研发"的状态。

## 工作流概念说明

> 读本 Skill 前请区分工作流，避免混淆：
>
> - **L1**：本 Skill（s-ai-dev-enable）对项目执行赋能的工作流 ← **你正在执行的是这层**
> - **L2**：本 Skill 为目标项目定制的 AI 研发流程（本 Skill 的交付物）

## 核心原则（赋能建设的判断基准）

在开始赋能前，先建立"AI 可研发项目"的判定标准——以下七条能力缺失任何一条，AI 都无法可靠地自主研发：

| 能力维度 | 必备性质 | 验收标准 |
|---|---|---|
| **可读性**：AI 能理解项目 | AGENTS.md 存在且有效（含架构、目录约定、工具链命令） | 随机抽取 3 条命令实际可执行 |
| **可执行性**：AI 能运行项目 | 工具链命令完整，本地/CI 环境均可运行 | `test/lint/build` 三类命令均有且可运行 |
| **可约束性**：AI 编码有边界 | Cursor Rules 精确、无与 linter 的循环冲突 | 运行 linter 无新增报错 |
| **可感知性**：AI 能感知 API 契约（SDK 项目） | 机器可读的 API 基线文件存在 | api-extractor 或等价工具可对比差异 |
| **可操作性**：AI 能操作外部平台 | 每个外部依赖有明确的"可自动/需 toolkit/需人工"分类 | 平台资产清单存在且决策结论明确 |
| **可阻断性**：不可逆操作有物理闸门 | 物理闸门（非文字约束）存在且可验证 | 每个红区操作的闸门能成功阻断模拟触发 |
| **可验证性**：赋能效果可端到端验证 | 完整 AI 研发循环可运行 | 正向路径 + 错误路径均验证通过 |

---

## 工作流程（主控 Agent 调度模式）

> **任务阶段规划**：使用 TodoWrite 按以下五个子工作流创建待办项，名称和顺序与本文档一致。

### 全局前置：收集目标项目上下文

主控在启动任何子工作流前，向用户确认以下信息（若用户已提供则直接使用）：

```
1. 目标项目路径（本地路径或 git URL）
2. 团队规模（个人 / 小团队 2 人 / 团队 3 人以上）
3. 外部工具（已知的外部平台，如 Vercel/腾讯云/Notion/飞书/GitLab 等；不确定则跳过）
4. 项目是否为发布型（npm 包/SDK）还是部署型（服务）
```

---

### W1 · 项目诊断

**执行方式**：主控执行

**指导文件**：[workflow/w1-diagnosis.md](workflow/w1-diagnosis.md)

**输入**：
- 必须入参：目标项目路径 + 全局前置收集的信息
- 上下文参考：[references/ai-dev-principles.md](references/ai-dev-principles.md)（七条能力维度）

**目标**：产出 `docs/ai-enablement/project-profile.md`，涵盖技术栈速写、AI 资产决策表、外部依赖可达性矩阵、五个分歧条件的确定结论

**产出**：`docs/ai-enablement/project-profile.md`（在目标项目中）

执行时读取指导文件，按其中流程完成任务。

---

**W1 完成后主控自检（校验）**：

- [ ] `project-profile.md` 存在且非空
- [ ] 包含"技术栈"章节（含语言版本、框架、包管理器）
- [ ] 包含"AI 资产决策表"（每条资产有决策标签：保留/更新/废弃）
- [ ] 包含"外部依赖可达性矩阵"（每个工具有颜色标签：绿/黄/红）
- [ ] 包含"分支条件结论"（项目类型、团队规模、外部依赖深度、研发流程形态结论）
- [ ] 若为全新项目，骨架文件路径已列出且文件存在

校验通过后进入 W2/W3（可并行）。

---

### W2 · AI 资产建设

**执行方式**：主控执行

**指导文件**：[workflow/w2-assets.md](workflow/w2-assets.md)

**输入**：
- 必须入参：`project-profile.md`（W1 产出）
- 若 W3 先于 W2 完成：Toolkit CLI 命令列表（W3 patch）
- 上下文参考：[references/agents-md-template.md](references/agents-md-template.md)（AGENTS.md 四区块模板）

**目标**：写入 `AGENTS.md`（四区块完整）和 `.cursor/rules/` 规则文件集合

**产出**：`AGENTS.md`（已写入目标项目根目录）、`.cursor/rules/` 文件集合

执行时读取指导文件，按其中流程完成任务。

---

**W2 完成后主控自检（校验）**：

- [ ] AGENTS.md 包含四个核心区块（技术架构 / 工具链命令 / 操作分级 / 各环节 SOP）
- [ ] 操作分级"红区"至少有 1 条不可逆操作
- [ ] 工具链命令无未替换的 `<placeholder>`
- [ ] 运行 linter：无因新增 cursor rules 引入的新报错（执行 `eslint`/`golangci-lint`/`ruff` 等）
- [ ] 若有规则冲突，`meta.mdc` 已创建且包含优先级声明

校验通过后进入 W4。

---

### W3 · 外部工具 Toolkit 实现（条件步骤）

**执行条件**：W1 确认存在**中度或重度外部依赖**（可达性矩阵中有黄色或绿色但需封装的工具）；纯轻量 CLI 依赖跳过。

**执行方式**：Subagent 委派

**subagent 配置**：
- 类型：`generalPurpose`
- readonly：`false`

**派发 Prompt**：
```markdown
请完成以下任务，严格遵循 `workflow/w3-toolkit.md` 中的要求。完成后返回：(1) 已创建的 Toolkit 文件路径列表；(2) validate_env.py 路径；(3) 供写入 AGENTS.md 区块 B 的 CLI 命令列表（格式：<场景> → <完整命令>）。

## 输入

目标项目路径：${项目路径}
外部依赖可达性矩阵（来自 project-profile.md）：
${可达性矩阵内容}
技术栈：${技术栈信息}
Toolkit 存放目录：${工具约定目录，如 scripts/ 或 tools/cloud-ops/}

## 目标

为所有黄色/绿色工具实现 wrapper 脚本，实现 validate_env.py，不实现红色工具。

## 特性要求

- 认证 token 只从环境变量读取，严禁硬编码
- 不可逆操作 wrapper 必须前置打印操作摘要并要求输入确认
- validate_env.py 必须：缺失变量时打印缺失项列表 + 非零退出；全量配置时 exit 0
- 每个 wrapper 的输出格式须简洁统一，不直接暴露原始 API 的嵌套 JSON
```

*主控收到 Subagent 返回后，将 CLI 命令列表 patch 到 AGENTS.md 区块 B，然后进入 W4。*

---

**W3 完成后测试（Subagent 执行，主控派发）**：

```markdown
请按以下测试用例对 Toolkit 进行验证，每个用例必须实际执行并附带证据。

## 测试用例

用例 1：validate_env.py 缺失变量
- 操作：清空所有 Toolkit 相关环境变量，运行 `python validate_env.py`（或等价路径）
- 预期：打印缺失变量列表，exit code != 0
- 证据：完整命令输出

用例 2：validate_env.py 全量配置
- 操作：配置所有必要环境变量，运行 `python validate_env.py`
- 预期：打印 OK 信息，exit code 0
- 证据：完整命令输出

用例 3：至少一个 wrapper 只读操作
- 操作：运行一个 list/status/query 类命令（无副作用）
- 预期：返回有效输出，无认证错误
- 证据：命令和输出

## 执行要求

你是本次工具链交付的最后一道质量关卡。你的测试结论直接决定 Toolkit 是否可以被 AI Agent 使用。

请注意：
- 每个测试用例必须实际执行，不允许基于代码阅读"推断"结果
- 发现问题时，必须精确定位到代码位置和复现步骤
- 声称"已通过"但没有证据的测试项视为未执行

记住：一个没有前置检查的 Toolkit 被 AI 调用时会产生神秘报错，导致 Agent 进入死循环。你是防线。
```

*测试未通过则返回 W3 修复后重测，直到通过。*

---

### W4 · CI 与闸门配置

**执行方式**：主控执行

**指导文件**：[workflow/w4-ci-gates.md](workflow/w4-ci-gates.md)

**输入**：
- 必须入参：`AGENTS.md` 文件路径（W2 产出，尤其红区列表）
- 可选：Toolkit 脚本路径（W3 产出，若有）
- 可选：现有 CI 配置路径（来自 W1 project-profile.md）
- 上下文参考：[references/gate-mechanisms.md](references/gate-mechanisms.md)（物理闸门实现模式）

**目标**：产出/修改 CI pipeline 配置，为 AGENTS.md 红区每项标注对应物理闸门机制

**产出**：CI 配置文件（`.github/workflows/ci.yml` 或 `.gitlab-ci.yml` 等）、AGENTS.md 红区已补充闸门机制标注

执行时读取指导文件，按其中流程完成任务。

---

**W4 完成后主控自检（校验）**：

- [ ] CI 配置文件 YAML 语法有效
- [ ] CI 包含 lint step
- [ ] CI 包含单测 step
- [ ] CI 包含构建验证 step
- [ ] AGENTS.md 红区中每项均有对应物理闸门标注
- [ ] 发布型项目：CI 包含 API 契约检查 step（api-extractor 或等价）
- [ ] 数据库项目：CI 包含 migration 格式检查 step 或 cursor rules 中有等价约束

校验通过后进入 W5。

---

### W5 · 端到端验证

**执行方式**：Subagent 委派（必须，不可由主控自行执行）

**subagent 配置**：
- 类型：`generalPurpose`
- readonly：`false`

**派发 Prompt**：
```markdown
请按以下测试用例对 AI 研发赋能完整性进行验证，每个用例必须实际执行并附带证据。

## 输入

目标项目路径：${项目路径}
AGENTS.md 路径：${AGENTS.md路径}
CI 配置路径：${CI配置路径}
物理闸门列表：${来自 W4 的闸门机制及触发方式}
验证用简单需求：${主控提供，如"新增一个 GET /healthz 端点，返回 200 OK"}

## 测试用例

用例 1（正向路径）：完整研发循环
- 操作：仅读取 AGENTS.md，理解上述简单需求，完成编码→测试→lint→提交 PR（或 diff）
- 预期：全程无需询问额外信息；代码通过 linter 和单测
- 证据：diff 内容 + lint/test 输出

用例 2（错误路径）：CI 门禁拦截
- 操作：提交一段故意违反 linter 规则的代码，触发 CI（或本地运行 lint）
- 预期：CI lint step 失败，错误信息明确指向违规位置
- 证据：CI 日志摘要（错误行号和规则名）

用例 3（错误路径）：物理闸门阻断
- 操作：模拟 Agent 尝试执行 AGENTS.md 红区的第一个不可逆操作
- 预期：被物理机制阻断
- 证据：阻断表现（如 CI 等待审批 / 脚本打印确认提示 / environment protection 拦截）

## 执行要求

你是独立的测试工程师，不是开发者的助手。你的职责是找出没有生效的保护机制，而不是确认"没问题"。

请注意：
- 每个测试用例必须实际执行，不允许基于代码阅读"推断"结果
- 发现任何物理闸门不生效，必须报告为失败，不得以"AGENTS.md 有文字约束"替代
- 如果所有用例都通过，请额外检查 AGENTS.md 红区中还有哪个操作的物理闸门最薄弱并验证它
- 你的测试报告会被人工审查，敷衍的报告会被打回重做

记住：AGENTS.md 的文字约束在上下文足够大时会被 AI 遗忘。物理闸门是唯一可靠的防线。漏掉一个无效闸门 = 潜在的生产事故。你就是防线。

## 报告格式

请按照 references/pua-testing.md 的标准格式输出测试报告（测试环境 + 结果汇总 + 详细结果 + 额外发现）。
```

*测试未通过则定位问题，修正对应 W2/W4 产出后重新派发 W5，直至全部通过。*

---

## 注意事项

1. **严格遵守子工作流顺序**：W2 依赖 W1，W3 与 W2 可并行，W4 依赖 W2（W3 patch 可在 W4 后补），W5 必须在 W2/W3/W4 全部完成后执行
2. **用户协同决策点**：遇到外部工具的 Toolkit 实现方案不明确时（是复用已有实现还是自研），主动暂停向用户确认，不自行推断
3. **L2 工作流定制**：W2 建设的 AGENTS.md 区块 D（各环节 SOP）就是目标项目的 AI 研发流程（L2）；不要把 L2 与 L1 混淆，L1 是"赋能过程"，L2 是"赋能交付物"
4. **赋能是起点不是终点**：AGENTS.md 和 cursor rules 需要随项目演进持续更新；W5 验证通过意味着"当前状态可 AI 研发"，不是"永远可 AI 研发"
