# 体系认知地图产物契约

## 术语速览

- **真源（canonical）**：某项判断唯一允许人工维护的位置；其他文件只引用稳定 ID 或生成带版本快照。后文只称“真源”。
- **稳定 ID**：同一认知对象跨版本保持不变的标识。对象语义实质改变时新建 ID，旧 ID 不复用，并用 `supersedes` 指向旧项。
- **承重主张**：删除或改变后，会改变节点、边、边界、路线合法性或叙事结论的主张。
- **叙事权限**：某主张在当前认识状态、条件和任务下，能否被写作者用于推动认知变化；它不是第二次真值裁定。
- **位置状态**：节点身份/边界或边的端点/语义是否已稳定到可供路线引用。
- **叙事门**：节点能否安全进入写作。说白了，主张可用不代表节点可写；位置、条件、推理桥和停止边界也必须闭合。
- **前置闭合批次**：批内每个节点的理解前置，已经在此前满足或排在本批更早位置，且节点和承重边都已放行。
- **横切约束**：同一约束会限制多个节点的判断；只保留一个认知节点真源，再用条件约束边连接受影响节点。

## 包版本与 ID

四个真源头部都必须有 `package_id`、`map_version`、`artifact_status: draft | sealed`，且三项一致。阶段内所说“封口”只表示通过该阶段闸门，四个真源仍为 draft；只有阶段七的可交接/受限可交接分支设置 sealed，阻断候选保持 draft。阶段七把同一已测语义版本从 draft 改成 sealed，是唯一不提升 `map_version` 的生命周期变化；节点、主张、边、路线等语义变化必须提升版本并重测。sealed 后不得原地修改。`map_version` 只标识语义版本，不编码生命周期。映射必须一致：`artifact_status=sealed` 当且仅当 `versionKind=released`，`artifact_status=draft` 当且仅当 `versionKind=candidate`；预建图空制品固定 candidate。建议 ID 前缀：能力 `A-`、材料 `S-`、主张 `C-`、节点 `N-`、边 `E-`、路线 `R-`、批次 `B-`。

## 单一真源

| 真源 | 负责 | 不负责 |
| --- | --- | --- |
| `cognition-contract.md` | 读者、任务、入口、终态能力、范围、约束、决定权 | 节点、章节或材料结论 |
| `claim-ledger.md` | 材料和承重主张的来源、认识状态、条件、叙事权限 | 节点结构或路线 |
| `system-map.md` | 节点、关系词典、边、循环 | 特定读者的顺序 |
| `routes.md` | 主路线、替代入口、补前置、回访、停止 | 领域关系真值 |

叙事交接快照、覆盖矩阵、基座视图、关系图和回开索引均为派生产物。

## 终态能力字段

- `ability_id`
- `observable_task`
- `pass_evidence`
- `applicable_condition`
- 条件出现时：`forbidden_boundary`、`decision_owner`

## 主张字段

材料记录必填：`source_id`、标题与来源锚点、版本/发布日期、来源主体、声明适用范围、访问状态；动态页面再写 `observed_at`。来源锚点定位整份材料，主张的 `source_refs` 还必须定位页码、章节、段落或时间戳，例如 `S-01#第4节`。

- `claim_id`
- `claim`
- `type`
- `condition`
- `epistemic_state`
- `narrative_permission`
- `source_refs`
- 条件出现时：`conflicts_with`、`supersedes`、`decision_owner`、`recheck_trigger`

认识状态固定为：

- `来源陈述`：只能确认某来源这样说，不表示现实成立。
- `已交叉支持`：声明范围内有相互独立且相关的支持，且无未处理承重冲突。
- `竞争中`：同一问题与条件下存在会导向不同判断的候选主张，尚未封口。
- `未知`：材料不足以形成可依赖判断。
- `价值/授权决定`：不是经验真值；只在具名决定者、范围和有效期内成立。

叙事权限只使用：`允许`、`带条件允许`、`阻断`。事实认识状态由材料核验、调查研究或内容裁定形成，价值/授权项由有决定权者赋值；主控据此计算叙事权限。`来源陈述`即使允许也只能归因表达；`带条件允许`必须连同条件传播，条件丢失自动按阻断处理；阻断主张不得支撑节点认知变化。

## 节点字段

必填：

- `id`
- `change`：读者从什么判断状态变到什么判断状态。
- `from_state`：当前可调用理解及其缺口。
- `to_state`：新增、撤销、限缩或暂缓的可观察能力。
- `ability_refs`：对应终态能力 ID、角色 `realizes | supports` 及删除后的能力损失；只有 `realizes` 表示本节点的 `to_state` 足以触发该能力的通过证据。
- `inputs`：主张 ID 及其角色，如定义、证据、反例、约束、价值前提。
- `bridge_obligation`：下游必须让读者重建的推理或区分关系。
- `scope_boundary`
- `position_state`：`confirmed` 或 `provisional`。
- `narrative_gate`：`ready` 或 `blocked`；阻断时引用缺口。

按需：`entry_variants`、`branch_conditions`、`reopen_trigger`、`structural_role`、`aliases`、`decision_owner`。

`position_state=confirmed` 表示节点身份、范围和状态转换已经稳定；`provisional` 不得进入 usable 路线。`scope_boundary` 同时承担节点级停止边界：写清认知变化何时不再成立、不得继续外推或必须停下。`narrative_gate=ready` 当且仅当位置已确认、必需输入不阻断、条件已进入范围边界、推理桥与范围边界闭合；否则为 blocked 并引用第一个阻断项。

## 边字段

必填：

- `id`
- `source` / `target`
- `type`
- `read_as`：完整句说明源到目标的具体语义。
- `condition`
- `failure_consequence`
- `support_refs`
- `position_state`

按需：`time_scale`、`alternative_group`、`revisit_signal`、`decision_owner`。

初始关系词典：

| 类型 | 固定方向 `source → target` | 与近邻类型的边界 |
| --- | --- | --- |
| 范围包含 | 较大对象/模型 → 其中的子范围 | 只说明位置，不自动构成阅读前置 |
| 理解前置 | 必须先取得其 `to_state` 的节点 → 后继认知变化 | 仅“先看更容易”不算前置 |
| 条件约束 | 提供有效性、权限、风险或责任限制的节点 → 被限制节点 | 不表示组成关系 |
| 竞争替代 | 候选判断 → 同问题下被排斥、取代或条件化的判断 | 用 `alternative_group` 写互斥/并存/条件择一 |
| 反馈修正 | 后取得的观测或模型 → 需要被回开修正的认识 | 不是阅读顺序，必须写时间尺度与回访信号 |
| 范围变体 | 通用对象 → 具名条件下的专门化/覆盖版本 | 变体只保存差异，不复制共同主张 |

每条边仍须用 `read_as` 写本边完整语义及失效后果。新增类型必须定义方向、与近邻类型的边界及失效后果。

真实或待核验循环记录成员节点/边、核验状态、最小可用模型、禁止外推范围和回访信号。

## 路线字段

- `route_id`
- `status`：`usable` 或 `blocked`
- `entry_condition`
- `entry_satisfied_node_ids`：已通过诊断、可视为完成的节点 ID 集合。
- `ability_targets`
- `batches`
- `stop_condition`
- blocked 时：`blocked_at`、`missing_condition`、`reopen_stage`
- 按需：`skip_condition`、`mandatory_catchup`

`ability_targets` 只能引用认知契约已有能力 ID，路线不得改写能力定义、通过证据或终态强度。每个批次包含：`batch_id`、`node_sequence`、`entry_requires`、`batch_gain`、`exit_condition`；顺序不由理解前置唯一决定时加 `why_now`，螺旋轮次再加 `revisit_trigger`。批次含 provisional/blocked 节点或未确认承重边时，路线 blocked。

## 包状态

- `可交接`：全部目标路线通过测试。
- `受限可交接`：至少一条安全路线通过，其他路线或目标受阻，且二者隔离测试通过。
- `阻断`：没有通过测试的安全路线，或安全/受阻部分无法证明隔离；候选版本不得称为已通过。

节点/边 `provisional` 不得进入 `usable` 路线。路线 usable 当且仅当节点 ready、承重边 confirmed、批次前置闭合、权限终点明确。阻断包固定 `versionKind=candidate`、`readyRoutes=[]`、`handoffPaths=[]`。

## 叙事交接映射

| cognitive-narrative-writing 所需 | 地图来源 |
| --- | --- |
| 读者、任务、必要前提 | 认知契约 + 路线入口 |
| 起点模型与缺口 | 节点 `from_state` |
| 可观察终点 | 节点 `to_state` + 终态能力 |
| 为什么此刻转向 | 入边 `read_as`；非唯一顺序再用路线 `why_now` |
| 材料及角色 | 节点 `inputs` + 主张账 |
| 推理桥 | 节点 `bridge_obligation` |
| 判断强度与边界 | `to_state` + `scope_boundary` + 认识状态 |
| 分支与替代 | 条件约束/竞争替代边 + `branch_conditions` |
| 暂停与禁行 | `narrative_gate` + 路线停止条件 |
| 回跳与螺旋 | 路线批次、反馈边、`revisit_signal` |

## 不建立第二真源

不要人工维护独立覆盖矩阵、基座清单、关系图、入边/出边数组、唯一父节点、固定章节顺序、中心度/难度分数、全文主张副本或独立未知表。它们要么可从稳定 ID 派生，要么属于写作阶段。
