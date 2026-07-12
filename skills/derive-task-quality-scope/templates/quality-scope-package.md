# 质量范围包模板

## 目录

```text
quality-scope-package/
├── task-contract.md
├── source-rights-map.md
├── task-reality-model.md
├── candidate-obligations.md
├── quality-obligations.md
├── closure-model.md
├── evidence-gates.md
├── quality-scope.md
├── validation-report.md
└── tests/
```

每个文件顶部写：

```yaml
status: draft | sealed | reopened
task_id: <stable-id>
generated_at: <ISO-8601>
evidence_cutoff: <ISO-8601 or unknown>
```

## task-contract.md

- 原始任务
- 整体 OK
- 受影响者与责任边界
- 环境与时间窗
- 不可接受损失与风险级别
- 假设、未知、非目标
- 决策权和允许裁决状态

## source-rights-map.md

- 来源表
- 权利角色表
- 来源冲突
- 缺失来源与替代取证
- 动态重查条件

## task-reality-model.md

- 任务形态
- 对象与利益相关者边界
- 成功机制与必要状态
- 状态、时间与生命周期
- 接口、资源与外部依赖
- 控制、责任与反馈
- 不可逆点、冲突和模型盲区

## candidate-obligations.md

- 五类生成源适用性
- 候选表：ID、来源坐标、对象、期望性质、缺失失败、进入理由
- 淘汰候选及理由
- 同义合并与多重来源

## quality-obligations.md

- 使用 `references/obligation-contract-schema.md` 的字段
- 每项显式列出 `OK / NOT_OK / INDETERMINATE` 判据；集合义务按实例独立三态
- 三态汇总
- 阻断未知

## closure-model.md

- 关系图
- 全局不变量与硬护栏
- 联合义务
- 权衡与决策权
- 完成层级
- 失效传播
- 局部全绿/整体失败反例

## evidence-gates.md

- 证据计划
- 测量有效性与独立性
- 关口矩阵
- 替代证据与外推边界
- 证据失效和重开

## quality-scope.md

按读者行动顺序组织：

- 当前裁决及证明域
- 可以做什么
- 不能做什么
- 必须先补什么
- 质量义务摘要与关键关系
- 证据与关口摘要
- 未消除 defeater、残余风险与风险接受权
- 适用边界、有效期和重开事件
- 详细产物链接

禁止复制过程流水账、搜索输出或行为日志正文。
