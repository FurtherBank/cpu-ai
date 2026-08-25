---
name: map-domain-understanding
description: >-
  WHAT：把一个新领域、复杂系统或庞杂材料库重建为可验证、可遍历、可维护的体系认知地图：界定目标读者的终态能力，整理承重主张，识别认知节点、认知基座与 scope 关系，生成顺读、任务、角色、异常或螺旋路线，并输出可直接交给 cognitive-narrative-writing 的节点/批次契约。WHEN：需要从零理解一个领域、设计教科书或系统化指引、重构按组织或材料堆积的旧文档、判断哪些内容构成认知基座、设计多个读者入口，或在正式写作前先把整个体系地图画清楚时使用；不用于单篇润色、单一事实查询或推导一项任务的执行工作流。
---

# 构建体系认知地图

不是先列“核心知识”和章节，再把材料填进去；而是先确认读者最终要能做出什么判断，再从这些能力反推认知节点，用有语义的关系连接成体系，最后为特定读者选择合法且高收益的遍历路线。

这里的**体系认知地图**，是领域认知节点、承重主张、类型化关系和读者路线的版本化整体。说白了：它既回答“这个领域由什么构成、彼此怎样影响”，也回答“这类读者应从哪里进入、为什么此刻看下一项、何时必须停下或回访”。

认知基座不是开局凭经验列出的“最基础内容”。只有当删除某节点会让多项终态能力，或至少两个互不从属的下游理解前置分支失去合法结构支撑，并且这种作用在主要变体下仍稳定时，才把它标为基座。阶段四的判定只引用能力、节点和边，不预借阶段五尚未生成的路线。

## 本 Skill 每次产出什么

在用户指定目录下生成地图包；未指定时使用：

```text
{workspaceRoot}/.skill-artifacts/map-domain-understanding/yyyy-mm-dd/<domain-slug>/
```

四个文件是唯一真源：

- `cognition-contract.md`：读者、使用任务、先备知识、范围、约束、决定权和终态能力矩阵。
- `claim-ledger.md`：材料来源、承重主张、认识状态、适用条件和叙事权限。
- `system-map.md`：认知节点、关系词典、边和循环记录。
- `routes.md`：推荐主路线、必要替代入口、补前置、回访和停止条件。

`handoffs/*.md` 是从四个真源生成的带版本交接快照，不是第五个真源。覆盖矩阵、基座清单、关系图和回开索引也由真源派生，不重复人工维护。

完整字段与单一真源规则见 [references/artifact-contracts.md](references/artifact-contracts.md)，产物骨架见 [templates/cognition-map-package.md](templates/cognition-map-package.md)。

核心术语、关系类型、版本与状态规则也集中在产物契约；第一次执行前先读其中的“术语速览”。

## 全局不变式

- 节点必须承载一次可观察的认知变化，不能只是主题、章节、角色、团队、活动或交付物名称。
- 关系必须有语义、方向、成立条件和失效后果；禁止用“相关”掩盖未知。
- 体系结构与遍历路线分开。路线是特定读者的消费视图，不反过来改写领域关系。
- “体系位置已确认”与“节点内容已证实”分开。位置可以先确定，未放行内容不得交给写作 Skill 补猜。
- 完整性按终态能力覆盖、理解前置闭包、路线连续和停止条件判断，不按收录主题数量判断。
- 新材料先进入主张账，再沿稳定 ID 局部回开节点、边、路线和交接批次；不默认全文重写。
- `derive-cognitive-workflow` 推导任务执行者的认知状态转换，本 Skill 推导领域内容和读者学习路线；二者不得互相替代。相邻 Skill 边界见 [references/adjacent-skill-boundaries.md](references/adjacent-skill-boundaries.md)。

## 行为日志执行协议

- **依赖预检**：首次材料性行为前检查 [behavior-log/v1 契约](../behavior-log-audit/references/behavior-log-v1-contract.md) 和 [日志骨架](../behavior-log-audit/templates/behavior-log-skeleton.md) 是否可读。可读时使用原契约；不可读时使用 [本地兼容协议](references/behavior-log-runtime-fallback.md)，并记录 `auditDependencyMode=local-fallback`。原契约和本地协议都不可用时，不开始建图，走“预建图阻断”返回，不进入七阶段
- **路径**：`{workspaceRoot}/.skill-logs/map-domain-understanding/yyyy-mm-dd/hhmm-<任务标题slug>.md`；同名时追加 `-2`、`-3`，不得覆盖
- **初始化**：首次确认认知契约之前创建日志，写入元数据、执行边界和状态 `执行中`。任务标题取用户给出的领域或体系名称；没有明确名称时取原始需求的最短可辨识短语
- **增量更新触发点**：认知契约封口；材料边界或认识状态改变；节点、承重边、基座或循环确认；路线生成或阻断；独立测试结果与回开；地图版本封口；相邻 Skill 派发与回收
- **子 Skill / Subagent 契约**：显式 Skill 子调用返回 `{交付物, behaviorLogPath, 材料性影响摘要}`，父日志登记子日志；纯 Task 只在父日志「关键行为」记录输入边界、结果和影响
- **封口**：四个真源通过静态闸门和独立测试，交接快照与版本一致，日志完整性校验通过后，更新终态、完成时间、结果与验证、影响清单和资源索引；未通过项不得用说明性文字封口
- **与交付物边界**：地图包写入 `.skill-artifacts/` 或用户指定目录；行为日志只记录过程审计并链接产物，不复制地图正文

运行时审计标准见 [references/audit-quality-standards.md](references/audit-quality-standards.md)。

## 工作流程

第一步使用可用的计划工具创建以下七个阶段，每阶段一项，名称和顺序必须一致。没有计划工具时按同一顺序执行，并在行为日志记录降级。

### 阶段一：冻结认知契约

**我为什么做这一步**：现有材料最容易反过来定义“什么值得理解”。我先把读者、使用任务和终态能力固定下来，材料只能服务这个契约。

**Input**：用户原始需求、领域对象、目标读者、使用任务、范围、风险和决定权。

**Goal**：形成可观察、可分流的 `cognition-contract.md`；不列章节或认知基座。

**Execution Mode**：主控执行。实际执行时完整阅读 [workflow/freeze-cognition-contract.md](workflow/freeze-cognition-contract.md)。

**Audit Hook**：更新日志「依据与关键输入」「关键行为」「偏离、异常与未决事项」。

### 阶段二：建立材料—主张账

**我为什么做这一步**：材料的来源身份、材料写出的主张和现实真值是三件事。先分开，后续地图才不会把“官方”“最新”或“多数材料”误当作正确。

**Input**：已通过的认知契约、授权范围内的材料入口和本轮版本边界。

**Goal**：形成轻量、可追溯、带认识状态和叙事权限的 `claim-ledger.md`。

**Execution Mode**：主控统账；大材料可分来源委派抽取，研究和内容裁定使用显式相邻 Skill。实际执行时完整阅读 [workflow/build-claim-ledger.md](workflow/build-claim-ledger.md)。

**Audit Hook**：更新日志「关键行为」「子 Skill 调用」「影响清单」「偏离、异常与未决事项」。

### 阶段三：反推认知节点

**我为什么做这一步**：目录只能告诉我内容放在哪里，不能证明读者为何必须经历这次理解更新。我从终态、入口和失败三面独立生成节点。

**Input**：认知契约、允许用于建图的主张切片和未决缺口索引。

**Goal**：在 `system-map.md` 中形成节点账；每个节点都从具体入口状态抵达可观察 `to_state`，并以 `realizes | supports` 说明它对终态能力的具体贡献。

**Execution Mode**：主控执行。实际执行时完整阅读 [workflow/derive-cognition-nodes.md](workflow/derive-cognition-nodes.md)。

**Audit Hook**：更新日志「关键行为」「影响清单」「结果与验证」。

### 阶段四：封口体系关系

**我为什么做这一步**：节点先独立成立，关系才有稳定端点。此时再判断范围、前置、约束、竞争、反馈和变体，避免用顺口的教学顺序伪造领域结构。

**Input**：通过节点闸门的节点账、节点引用主张、主要变体和不可牺牲约束。

**Goal**：完成 `system-map.md` 的关系词典、边表、认知基座和真实/待核验循环记录。

**Execution Mode**：主控维护全图；高承重单边或循环可隔离攻击。实际执行时完整阅读 [workflow/close-system-relations.md](workflow/close-system-relations.md)。

**Audit Hook**：更新日志「关键行为」「子 Skill 调用」「影响清单」「结果与验证」。

### 阶段五：生成读者遍历路线

**我为什么做这一步**：体系图说明真实结构，路线说明特定读者现在怎样消费它。先过理解前置和风险门，再追求尽早获得可使用能力，不用一个权重分数把不可补偿条件平均掉。

**Input**：认知契约、已封口节点和边、读者已验证先备知识、目标能力子集及节点叙事门。

**Goal**：形成 `routes.md`，包含主路线、必要替代入口、补前置、回访和停止条件；静态闸门通过后，按可交接路线生成同版本 `.draft-handoffs/*.md` 供阶段六测试。

**Execution Mode**：主控执行。实际执行时完整阅读 [workflow/generate-reader-routes.md](workflow/generate-reader-routes.md)。

**Audit Hook**：更新日志「关键行为」「影响清单」「结果与验证」「偏离、异常与未决事项」。

### 阶段六：独立测试体系认知地图

**我为什么做这一步**：字段齐全不代表读者走得通。让不带设计答案的新执行者实际顺读、跳读、迁移和回开，失败必须指向最早责任阶段。

**Input**：用户原始需求原文、四个候选真源、由这些真源生成的同版本 draft 叙事交接快照、主控按固定协议实例化的测试用例清单及回开协议；禁止传主控设计过程、自评或地图正确性的引导结论。用例必须提供可操作的预期结果和通过判据，它们不属于被禁止的作者自评。

**Goal**：形成带执行证据、失败定位和回开阶段的独立测试报告；测试者不修改地图。

**Execution Mode**：必须使用 fresh-context Subagent。实际执行时完整阅读 [workflow/test-cognition-map.md](workflow/test-cognition-map.md)，派发模板见 [templates/independent-test-prompt.md](templates/independent-test-prompt.md)。

**Audit Hook**：父日志登记测试派发、结论、失败证据、回开和重测；纯 Task 不强制独立日志。

### 阶段七：封口地图并交接叙事

**我为什么做这一步**：只有通过测试的版本才可成为下游真源。我把地图封口、生成交接快照，并明确是否继续调用写作 Skill。

**Input**：二选一。可交接/受限可交接分支输入通过测试的四个真源、同版本 draft 叙事交接快照、测试报告、允许交接的节点和路线、正文生成授权；阻断封口分支输入候选文件与版本、失败报告、最早责任阶段、无法在当前授权内修复的证据及精确外部缺口。

**Goal**：可交接分支把已烟测的 draft 叙事交接快照原样提升为正式快照；受限可交接只提升通过隔离测试的安全路线快照并保留受阻边界。若用户授权继续写作，按节点或前置闭合批次调用 `cognitive-narrative-writing`。阻断封口分支只封口问题化候选包和本次执行，不保留 handoff，也不调用写作 Skill。

**Execution Mode**：主控封口与组包；写作是可选的显式相邻 Skill 调用。实际执行时完整阅读 [workflow/seal-and-handoff.md](workflow/seal-and-handoff.md)，交接模板见 [templates/narrative-handoff.md](templates/narrative-handoff.md)。

**Audit Hook**：更新日志「关键行为」「子 Skill 调用」「影响清单」「结果与验证」「资源索引」，随后按协议封口。

## 失败怎样回开

独立测试或新材料发现问题时，回到最早产生缺口的阶段：

- 读者、终态、范围或决定权错误：阶段一。
- 来源、主张、认识状态或叙事权限错误：阶段二。
- 节点粒度、入口、认知增量或叙事门错误：阶段三。
- 边类型、基座、横切约束、变体或循环错误：阶段四。
- 顺序、效用批次、替代入口、补前置或回访错误：阶段五。

回开阶段及其受影响下游版本作废；未被稳定 ID 依赖传播命中的部分保留。修复后重新通过静态闸门和相关独立测试，不在成文结果上打补丁绕过地图。

普通测试失败不是交付终态：能在当前授权内修复时必须回开。至少一条安全路线通过且与受阻部分的隔离测试通过时，进入“受限可交接”；只有没有安全路线，或安全/受阻部分无法证明隔离时，才进入阻断封口。

详细闸门与回开规则见 [references/quality-gates-and-reopen.md](references/quality-gates-and-reopen.md)。

## 返回契约

独立调用结束时返回：

- `packagePath`：地图包绝对路径。
- `mapVersion`：本次返回的地图版本；对应真源头部的 `map_version`。
- `versionKind`：`released` 或 `candidate`；与真源状态严格对应：`artifact_status=sealed` 当且仅当 `versionKind=released`，`artifact_status=draft` 当且仅当 `versionKind=candidate`。阻断和预建图空制品只能返回 `candidate`。
- `status`：`可交接`、`受限可交接` 或 `阻断`。
- `readyRoutes`：可用路线 ID；没有则说明第一个阻断点。
- `handoffPaths`：生成的交接快照路径。
- `behaviorLogPath`：workspace-relative 行为日志路径。
- `材料性影响摘要`：说明只读材料、写入制品、外部影响和测试终态。
- `nextAction`：交给 `cognitive-narrative-writing` 的批次，或需要研究、内容裁定、授权决定的精确缺口。

状态必须互斥：全部目标路线通过为“可交接”；至少一条安全路线通过且与受阻部分隔离为“受限可交接”；没有安全路线，或安全/受阻部分无法证明隔离为“阻断”。阻断时固定返回 `readyRoutes=[]`、`handoffPaths=[]`，不得把候选版本称为已通过地图。

预建图阻断是唯一允许空制品返回的情况：`packagePath=null`、`mapVersion=null`、`versionKind=candidate`、`readyRoutes=[]`、`handoffPaths=[]`、`behaviorLogPath=null`，并在 `nextAction` 写清缺失依赖与恢复动作。

## 适用边界

适用于解释、教学、分析、方法和决策支持型领域的系统化理解，不保证真实读者必然学会，也不替代领域事实研究、专业审查、组织授权和成文后的认知叙事审查。纯索引、即时告警、单篇改写和以审美体验为主的文本不必展开完整地图。
