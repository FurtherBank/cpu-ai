# 体系认知地图包骨架

## cognition-contract.md

```markdown
# 认知契约：${domain}

- package_id:
- map_version:
- artifact_status: draft | sealed

## 体系对象与范围
## 读者、入口状态与使用任务
## 终态能力矩阵
| 能力 ID | 可观察任务 | 通过证据 | 适用条件 | 禁行边界/决定者 |
## 不可牺牲约束
## 承重未知与条件分支
```

## claim-ledger.md

```markdown
# 材料—主张账：${domain}

- package_id:
- map_version:
- artifact_status: draft | sealed

## 材料表
| 材料 ID | 标题与来源锚点 | 版本/日期 | 来源主体 | 声明适用范围 | 访问状态 |

## 承重主张表
| 主张 ID | 主张 | 类型 | 条件 | 认识状态 | 叙事权限 | source_refs |

## 冲突、替代与决定缺口
```

## system-map.md

```markdown
# 体系地图：${domain}

- package_id:
- map_version:
- artifact_status: draft | sealed

## 地图版本与范围
## 关系类型词典
## 节点账
### ${node_id} ${node_name}
- change:
- from_state:
- to_state:
- ability_refs: # ability_id + realizes|supports + 删除损失
- inputs:
- bridge_obligation:
- scope_boundary:
- position_state:
- narrative_gate:

## 边表
| 边 ID | source | target | type | read_as | condition | failure_consequence | support_refs | position_state |

## 真实与待核验循环
```

## routes.md

```markdown
# 读者遍历路线：${domain}

- package_id:
- map_version:
- artifact_status: draft | sealed

## ${route_id} ${route_name}
- status:
- entry_condition:
- entry_satisfied_node_ids:
- ability_targets:
- batches:
  - batch_id:
    node_sequence:
    entry_requires:
    batch_gain:
    exit_condition:
    why_now:
    revisit_trigger:
- mandatory_catchup:
- stop_condition:
- blocked_at:
- missing_condition:
- reopen_stage:
```

## 最小贯通示例（不是第二真源）

能力 `A-01`：给定一次报表导出请求，能判断“按钮可见”是否等于“有权导出”。材料 `S-01` 是数据导出规范 v3；承重主张 `C-01` 为“导出权限受角色和数据范围共同限制”，认识状态为价值/授权决定，叙事权限为允许，定位 `S-01#第4节`。

节点 `N-01 区分功能可见与行动授权` 把“看得到按钮就有权执行”更新为“结合角色与数据范围判断权限”；节点 `N-02 判断具体导出请求能否执行` 消费该区分。理解前置边 `E-01: N-01 → N-02` 的 `read_as` 是“只有先区分功能可见与行动授权，才能判断具体请求是否可执行”；缺失它会把按钮可见误当授权证据。

路线 `R-01` 的 `B-01` 依次包含 `[N-01, N-02]`，批次增量是“能解释一个越权导出反例”，退出条件是对给定角色与数据范围作出正确判断。叙事交接快照只引用包版本、`R-01` 和 `B-01` 并展开真源，不重新赋值。
