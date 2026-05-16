> **声明**：该文档为本 skill 的**设计规范**，用于指导技能本身的迭代。技能正文（`SKILL.md`）及执行本 skill 时，禁止参照本文档内容。

---

# i-spec-feature · Skill Design

> **路径根**：下文凡 `.iteration/` 路径均相对于 **Cursor 工作区根目录** `{workspaceRoot}`（studio 多仓顶层，与根级 `AGENTS.md`、`.cursor/` 同级），非各子项目 Git 根。

> 依据：[任务步骤四要素推导方法论](../s-workflow-sop/references/task-step-schema.md)

---

## 一、输入信息 (Input)

### 硬依赖（必须入参）

| #   | 信息                                                                 | 来源                                                                                      | 备注                                             |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | 规范文档（`design.md`，i-spec-design 产出）/ feature 需求工单        | 上一阶段制品；feature 直达路径来自 `i-todo` / `i-dima-resolve`                            | **rfc 路径必须；feature 直达路径以工单原文替代** |
| 2   | 改造目标描述（一句话）                                               | 从 design.md 中提取 / feature 需求原文 / 编排层注入                                       | 必须                                             |
| 3   | 目标仓库路径（主承载仓，相对工作区根）                               | 编排层注入                                                                                | 必须                                             |
| 4   | 工作区仓库范围基础声明                                               | RFC：`design.md`「工作区与仓库范围」专节；feature：与条目 3 一致的主仓声明 + 是否允许跨仓 | 必须                                             |
| 5   | 迭代上下文（`iterationId`、`reqId`、`workItemId`、`currentRoundId`） | 调度器注入                                                                                | EXECUTION 阶段必须，PLANNING 阶段必须            |

> **feature 直达路径说明**：通过 `i-todo` 直接创建的 feature 类需求，不经过 `i-spec-design`，因此无 `design.md`。此场景下需求描述原文即作为「规范文档」的代替输入；`change-plan.md` 产出格式不变。

### 软上下文（按需索引）

| #   | 信息                                    | 获取方式                                                                                                                                                         |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | 仓库 `AGENTS.md`                        | 主控读取，确认搜索边界、构建命令、commit 规范、migration 工具与目录约定                                                                                          |
| B   | DB migration / DDL 文件目录             | 主控定向搜索数据库相关目录                                                                                                                                       |
| C   | 接口/路由定义文件                       | ripgrep / SemanticSearch                                                                                                                                         |
| D   | 服务间依赖配置（go.mod / package.json） | 主控读取对应文件                                                                                                                                                 |
| E   | 「粒度」概念参考                        | `references/粒度定义.md`                                                                                                                                         |
| F   | 代码风险信号参考                        | `.cursor/skills/feature/references/代码风险信号.md`                                                                                                              |
| G   | 各阶段指导文件                          | `workflow/step1-plan.md`、`workflow/step2-execute-init.md`、`workflow/step3-execute-loop.md`、`workflow/step4-execute-report.md`（按需读取，到达对应阶段时再读） |

---

## 二、目标职责 (Goal)

**状态变更 (Delta)**：
将「一份描述理想终态的规范文档（design.md）/ feature 需求 + 当前系统现状」推进到「一份结构化、可追溯、置信度标注的 `change-plan.md`，并按 plan 完成全部代码变更落地为有序 git 提交」。

**完成判定 (Done Predicate)**：

**PLANNING 阶段（产出 change-plan.md）**：

- P1. `change-plan.md` 已写入 `{workspaceRoot}/.iteration/recordings-plan/[<reqId>] <needName>/change-plan.md`
- P2. 文件含：改造目标（规范原文直接引用）/ 工作区仓库范围（基础声明）/ 现状背景 / 五层变更清单（DB / API / 服务 / 配置 / 数据迁移；即使某层为空也显式说明）/ 覆盖度矩阵 / 分批执行计划
- P3. 每条变更条目有：全局唯一 ID（Cx）/ 四态类型（新增/修改/保留+扩展/冲突重写）/ 规范条款 ID 引用 / 置信度标注 / **每条至少 1 主流程 + 1 异常/边界 自测用例**
- P4. 规范中所有 MUST 类条款均有变更条目覆盖（双向追溯已通过）；反向无孤立 Cx
- P5. 无任何变更条目描述含「待确认」「参考现有实现」「相关逻辑」等模糊词（除显式标注「粒度留白（已授权）」的条目外）
- P6. 影响要改什么的技术决策（包括 prompt 骨架、触发条件、集成方式等「实现设计类」条款）已在本 skill 内完全确定，**未转移给 EXECUTION**
- P7. 分批计划中每批有明确的批次结束状态描述；含预发/发布的批次均有前置、灰度方案、回滚方案

**EXECUTION 阶段（按 plan 落地代码）**：

- E1. `tasks.md` 中所有 Cx 条目均勾选完成，每条附「归属仓库目录 + commit hash」
- E2. 每条 commit message 第一行为 `reqId: <iterationId>-<reqId>`
- E3. 收尾报告 `{workspaceRoot}/.iteration/recordings-execute/[<reqId>] <summary>.md` 已写入，**仅含两节**：①提交清单；②代码风险信号
- E4. 编码过程**未**产生任何 `*_test.*` / `**tests**/**` 类测试文件
- E5. 未发生 CRITICAL 阻断（若有则状态为「已 yield 等待人工介入」）

**不做什么（Negative Prompts）**：

- 本 skill **不重新讨论规范**——规范是 i-spec-design 的已定产物，不在本 skill 内修改
- **不做需求切片**——超大需求由 `i-todo` / `i-dima-resolve` 在入轨时拆为多个 reqId，本 skill 单次只处理一个独立子需求
- **不决定具体实现细节**（索引大小、TTL 值、变量命名风格等，除「粒度留白（已授权）」显式声明的开放点外）——只决定「要建什么、改什么」的存在性与职责边界
- **EXECUTION 阶段不写测试、不跑测试**——行为校验留给 `i-verify`

---

## 三、工作依据 (Guidance)

### 流程规范依据

| 阶段                                   | 指导文件                           |
| -------------------------------------- | ---------------------------------- |
| 阶段一：规范对齐与规划生成（PLANNING） | `workflow/step1-plan.md`           |
| 阶段二：执行前场准备（EXECUTION）      | `workflow/step2-execute-init.md`   |
| 阶段三：编码与提交循环（EXECUTION）    | `workflow/step3-execute-loop.md`   |
| 阶段四：收尾报告（EXECUTION）          | `workflow/step4-execute-report.md` |

### 方法论依据

**为什么从 11 阶段精简为 4 阶段（设计沿革）**：

- 历史版本将规划阶段拆为「条款解析 → 系统探索 → 概念映射 → 差距分析 → 充分性验证 → DAG → 产物」7 步，并设有「切片并行」「专项设计 subagent」两个条件分阶段。
- 拆分粒度过细带来的代价：① 阶段间依赖中间产物在上下文流转中易丢失细节；② 切片/合并/去重等编排成本高，反而牺牲了大模型在长上下文中做全局推理的优势；③ 每个微步骤都要生成中间表格，token 消耗与心智负担叠加。
- 重构原则：**充分性约束保留为产出 Checklist**（覆盖度矩阵、四类遗漏源、粒度收敛），**思考过程一次完成**；切片职责**前置到** `i-todo` / `i-dima-resolve` 的需求划分逻辑，超大需求在入轨时即拆为多个 reqId，每个 reqId 独立 design + plan + execute。
- 设计冲突识别（CRITICAL）保留：在 EXECUTION 编码阶段一旦发现 plan 留白或落点错误，立即阻断并 yield，不让设计错误被低质量代码掩盖。

**正常路径直觉**：

- PLANNING 必须**完全收敛**：所有落点、字段名、设计决策在 PLANNING 阶段确定，EXECUTION 不再做设计探索。
- 系统探索围绕条款索引**定向**进行（数据 / 接口 / 鉴权 / 实现范式四维度），不做全库扫描；以 migration 为数据真值，以路由注册根为接口真值。
- 技术决策的边界判断口诀：「如果选方案 A vs B 会导致 change-plan 中表名/字段名/接口名不同 → 必须本阶段决定」；只影响实现细节的留给 EXECUTION。
- EXECUTION 编码时保持「**风险信号雷达**」常开，发现风险只**记录**、不修复、不扩散，最终在收尾报告统一展开。

**异常路径与陷阱**：

- 发现 MUST 类条款无覆盖：**立刻回到第四步 / Plan 自检** 补条目，不能仅在覆盖度矩阵里标「缺失」。
- 变更清单描述不够精确（如「token 要支持多类型」）：必须展开到「在 token 表新增 `token_type` VARCHAR(20) 字段」级别。
- 置信度低的条目：必须附**可执行的验证命令**（如 `rg "tenant_id" --type ts app/...`），不能写「需要再确认」。
- EXECUTION 续跑：`tasks.md` 的勾选是意图记录，`git log` 是事实——两者都需要确认；发现不一致**绝不**自行重跑已勾选任务（会产生重复提交、重复 migration 文件等不可逆副作用）。
- EXECUTION 发现 plan 留白或落点错误：**不修改任何代码**，按 CRITICAL 模板写入 tasks.md 后 yield 等待人工介入。

---

## 四、执行模式 (Execution Mode)

**判定结论：全程主控主导执行，无 subagent 派发**

**判定依据**：

- 上半场（PLANNING）：各「读 → 想 → 写 → 自检」步骤之间存在强上下文依赖链，主控在单轮长上下文中一次性产出最终 `change-plan.md` 即可，无需切分为多个 subagent。超大需求由上游 `i-todo` / `i-dima-resolve` 拆为多个 reqId，每 reqId 独立 i-spec-feature 调用——切片职责**不在**本 skill 内承担。
- 下半场（EXECUTION）：编码 → 编译自洽 → commit → tasks.md 更新 是严格的串行循环，必须由主控感知每个 commit 的状态才能驱动下一项任务，不适合委派 subagent。

**调用方式**：

**rfc 路径**（由编排层在 i-spec-design 产出 `design.md` 后触发）：

```
请按照 .cursor/skills/i-spec-feature/SKILL.md 执行规范差距分析与代码落地。

规范文档路径：{workspaceRoot}/.iteration/recordings-design/[<reqId>] <needName>/design.md
目标仓库路径：{repo_path}
改造目标：{一句话改造目标}
当前阶段：PLANNING / EXECUTION（由调度器注入）
```

**feature 直达路径**（由 `i-todo` 或 `i-dima-resolve` 在 feature 类型路由后触发）：

```
请按照 .cursor/skills/i-spec-feature/SKILL.md 执行变更规划与代码落地。

需求描述：{用户提供的 feature 需求原文，作为规范文档使用}
目标仓库路径：{repo_path}
改造目标：{从需求描述中提取的一句话目标}
当前阶段：PLANNING / EXECUTION（由调度器注入）
注：本次无 design.md，需求描述本身即为规范输入。
```

产出文件路径约定：

- PLANNING 制品：`{workspaceRoot}/.iteration/recordings-plan/[<reqId>] <needName>/change-plan.md`
- EXECUTION 中间状态：`{workspaceRoot}/.iteration/recordings-plan/[<reqId>] <needName>/tasks.md`
- EXECUTION 制品：`{workspaceRoot}/.iteration/recordings-execute/[<reqId>] <summary>.md`
