> **声明**：该文档为本 skill 的设计规范，用于指导技能本身的迭代。技能正文（`SKILL.md`）及执行本 skill 时，禁止参照本文档内容。

---

# i-spec-design · Skill Design

> **路径根**：下文凡 `.iteration/` 路径均相对于 **Cursor 工作区根目录** `{workspaceRoot}`（studio 多仓顶层，与根级 `AGENTS.md`、`.cursor/` 同级），非各子项目 Git 根。

> 依据：[任务步骤四要素推导方法论](../s-workflow-sop/references/task-step-schema.md)

---

## 一、输入信息 (Input)

### 硬依赖（必须入参）

| #   | 信息                                             | 来源                      |
| --- | ------------------------------------------------ | ------------------------- |
| 1   | RFC 类工单的详细需求描述（包含背景、目标、约束） | 编排层注入 / 用户直接提供 |

### 软上下文（按需索引）

| #   | 信息                              | 获取方式                                                                               |
| --- | --------------------------------- | -------------------------------------------------------------------------------------- |
| A   | 仓库根路径 / `AGENTS.md`          | 主控读取，确认工作区涉及仓库范围，相关技术栈与约定                                     |
| B   | 当前版本的方案设计文档（若已有）  | 主控读取对应文档路径                                                                   |
| C   | 上游依赖模块代码                  | ripgrep / SemanticSearch 定向搜索                                                      |
| D   | 下游依赖模块代码                  | 同上                                                                                   |
| E   | 涉及数据表的 migration / DDL 文件 | 主控读取 DB migration 目录                                                             |
| F   | 代码风险信号清单                  | `reference/代码风险信号.md`                                                            |
| G   | Spec-Driven 迭代工作流全貌        | `reference/spec-driven.md`                                                             |
| H   | 技术系分设计模板                  | `../tech-design/SKILL.md`                                                              |
| I   | 工作区内其它 Git 仓库目录         | 主控枚举工作区根下一级子目录并结合 `.git` 判定，用于「工作区与仓库范围」专节枚举与排除 |
| J   | Scope 化设计方法论                | `reference/scope-design-methodology.md`                                                |

> **注意**：若发现无法通过代码自行获取的外部依赖信息（如第三方服务接口、跨团队系统约定），须暂停并生成「待确认信息清单」，一次性向用户问清，不能假设。

---

## 二、目标职责 (Goal)

**状态变更 (Delta)**：
将「一份模糊的 RFC 工单需求」推进到「一组可供 i-spec-feature 直接消费的 scope 化设计方案文档」。总览 `design.md` 描述全局目标、scope 地图与 scope 间关系；每个 `scopes/<scope-id>/design.md` 描述一个边界清晰的独立 scope 终态；制品根目录下 `references/`（与 `design.md`、`scopes/` 同级）提供**全设计共用**的上下文参照，条目中标注关联 scope，而非按 scope 分文件。

**完成判定 (Done Predicate)**：

当且仅当以下全部条件满足时判定完成：

- P1. 总览 `design.md` 文件已写入，包含工作区与仓库范围、需求目标、非目标、全局约束、scope 地图、scope 间关系、全局风险和后续规划输入
- P2. 每个独立 scope 均已写入 `scopes/<scope-id>/design.md`，并包含完整的技术系分结构：需求理解 / 整体设计（业务流程图、数据模型、API 设计）/ 详细设计 / 发布计划
- P3. 已在制品根目录 `references/` 下归档全设计共用的 references（可为一个或多个 `.md` 及子目录），每条 reference 精确到来源类型、路径或 URL、关键符号或段落、获得方式、支撑的设计判断，并标注关联的 scope id 或全局/多 scope 关系；**不**使用 `scopes/<scope-id>/references.md`
- P4. 总览与 scope 文档中对上下游依赖关系有明确描述（上游依赖我们什么，我们依赖下游什么），并按归属、依存、协议、时序、交换、影响、协同中的适用类型归档；外部约束不混写为 scope 间关系
- P5. 涉及数据库变更的 scope 已包含 DDL（精确到表名、字段名、类型、约束）
- P6. 涉及 API 的 scope 已包含 Method + URL + 入参类型 + 响应结构
- P7. 所有「难以直接判断最终结论，且无更多外部信息支持判断」的关键技术点，已通过 PoC 验证或明确写出不执行 PoC 的理由（参见 `workflow/poc.md`）
- P8. 外部依赖的「待确认信息清单」中所有问题均已获得用户确认
- P9. 文档中**不出现**「待定」「暂定」「需要再讨论」等开放性悬空描述（已授权粒度留白的除外）
- P10. `design.md` 含 **「工作区与仓库范围」** 专节：主目标仓库路径、协同仓库（无则显式「无」）、必要时排除说明；与 i-spec-feature / i-spec-execute 可消费的边界一致
- P11. 每个关键设计判断均能追溯到 reference、用户确认、PoC、代码事实或显式约束；未经确认的假设不得作为定稿结论

**不做什么（Negative Prompts）**：

- 本 skill 只产出「终态要求」的 scope 化设计文档，**不**产出变更清单（由 i-spec-feature 负责）
- **不**产出代码实现（由 i-spec-execute 负责）
- **不**假设未经确认的外部依赖可行性

---

## 三、工作依据 (Guidance)

### 流程规范依据

| 参考材料                    | 用途                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `reference/spec-driven.md`  | Spec-Driven 迭代工作流全貌，理解本 skill 在整体流程中的位置 |
| `reference/代码风险信号.md` | 扫描技术债务时的风险信号识别标准                            |
| `reference/scope-design-methodology.md` | Scope 划分、关系分类、上下文归位与全局验收的正式方法论 |
| `../tech-design/SKILL.md`   | 技术系分文档模板，是 design.md 的输出格式依据               |
| `workflow/poc.md`           | 难以直接判断且缺少外部信息支撑时的 PoC 验证流程             |

### 方法论依据

**正常路径直觉**：

- 首先建立稳定的 scope 架构，再确认每个 scope 需要参考的上下文维度（当前方案、上下游依赖、技术债），并确定每项上下文的获取方式；不要在不了解现状的情况下直接开始构思方案
- 构建 scope 架构前，先把原始需求拆成目标、非目标、事实、约束、假设、风险和待确认项；影响核心设计的待确认项必须清零后再定稿
- 持续输入的新信息必须先归位到具体 scope 或 scope 间关系；无法归位的信息要触发 scope 拆分、合并、重命名或用户确认，不能直接追加到正文
- 总览管理 scope 之间的关系；scope 文档递归展开 scope 内部细节。关系扫描顺序为：归属、依存、协议、时序、交换、影响、协同；约束是输入维度，不是 scope 间关系
- 上下游依赖分析时：上游代表「我们的方案强依赖的模块/服务」，下游代表「依赖我们的模块/服务」；两者方向不同，切勿混淆
- 方案构思阶段先提出技术选型或改造路径；对可行性有把握时直接推进，难以直接判断最终结论且无更多外部信息支持判断时，触发 PoC 实验而非假设
- 调用 `tech-design` skill 为每个 scope 产出详细系分文档，确保格式符合规范；不要脱离模板自由发挥

**异常路径与陷阱**：

- 发现外部依赖信息无法从代码获取（如第三方 API 规格）：**立即暂停**，生成「待确认信息清单」，不得继续设计——基于假设构建的方案会在 i-spec-feature/i-spec-execute 阶段产生返工
- 代码中存在 TODO / FIXME / 黑魔法逻辑：必须在整体设计中明确标注，评估是否需要在此次改造中一并清理，否则后续阶段会踩坑
- 技术选型难以直接判断（如某 SQL 语法在当前数据库版本不支持）：**不要凭经验猜测**；难以直接判断最终结论且无更多外部信息支持判断时，通过 PoC 验证后再写入设计
- 设计文档或 references 中出现「参考现有实现」「详见代码」等间接引用：这些描述无法传递给 i-spec-feature，必须展开为具体描述并精确到可追溯位置
- 发现新上下文推翻 scope 边界或关系：先修正 scope 架构和关系登记，再继续写局部设计；不要在旧结构下追加相互冲突的段落

---

## 四、执行模式 (Execution Mode)

**调用方式**：

在迭代**规划阶段**，由编排层在判断工单类型为 `rfc` 后触发主控执行，附带工单全文。典型调用指令示例：

```
以下是一份 RFC 类工单，请按照 .cursor/skills/i-spec-design/SKILL.md 进行 scope 化技术方案设计，
输出总览 design.md、各 scope 的 design.md，以及制品根目录下全设计共用的 `references/`（内含一个或多个参照文档或子目录）到 `{workspaceRoot}/.iteration/recordings-design/{workItemId}/` 目录。

工单内容：
[工单全文]
```

产出文件路径约定：

```text
{workspaceRoot}/.iteration/recordings-design/{workItemId}/design.md
{workspaceRoot}/.iteration/recordings-design/{workItemId}/scopes/<scope-id>/design.md
{workspaceRoot}/.iteration/recordings-design/{workItemId}/references/   # 全设计共用，可含 *.md 与子目录
```
