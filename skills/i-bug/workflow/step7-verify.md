# 步骤七：上线验证与归档 执行指导

## 输入信息

**必须入参**：
- 测试验证 subagent 返回的通过报告
- `workItemId`（来自工单上下文）
- `investigation.md`（全程积累的信息）

## 目标要求

**任务**：上线验证关键路径；写根因记录；关闭 dima 工单
**目标**：生产功能恢复 + 根因有文档记录 + 工单状态已更新

## 工作依据

### 上线验证原则

**不只验证 happy path**：上线后，主动触发原来 100% 复现的触发条件，确认这次正常了。仅看"功能可用了"不够，要验证的是"Bug 不再出现"。

**观察监控而非结论**：上线后观察 5-15 分钟的错误率面板。若发现仍有一定比例失败，先看**失败的详细原因**，再判断是残留 Bug 还是合理的业务拒绝。

**「合理失败」的识别**：若失败日志显示的是业务规则拒绝（如退款订单的重复回调），这不是 Bug，是正常的防御性行为。不要因为有失败就误判为修复不完整。

### 根因记录写法

好的根因记录让 6 个月后的工程师（包括自己）能在 1 分钟内理解"为什么出了这个问题"。

**三要素格式**：

```
[触发条件] + [内部原因] + [修复方式] + [防复发建议]
```

**示例（好）**：
> `getActiveDiscount()` 返回类型为 `Discount | null`，但所有调用方均未处理 null 分支，当商品品类无 active 促销时直接 NPE 返回 500。修复：在所有调用点加 null 守卫并抛 400 BadRequest。防复发：建议将 `getActiveDiscount()` 改为返回 `Discount`（非 nullable），由方法内部抛出语义化错误，调用方无需重复处理 null；同时加 TS 严格 null 检查。

**示例（差）**：
> order.service.ts 第 80 行加了一个 null check。

### dima 工单状态写入格式

写入 `.iteration/dima/✅{workItemId}.json`：

```json
{
  "workItemId": "{workItemId}",
  "status": "done",
  "resolvedAt": "{ISO timestamp}",
  "rootCauseType": "{bug-identify.md 中的根因类型}",
  "rootCauseSummary": "{触发条件 + 内部原因，1-2句话}",
  "fixSummary": "{修复方式，1句话}",
  "preventionNote": "{防复发建议，1句话}",
  "relatedFiles": ["{改动的主要文件路径列表}"]
}
```

**`workItemId` 字段不得省略**，这是 dima 流程的追踪锚点。

### 非 dima 工单时

若本次 bug 不来自 dima 工单（直接 @i-bug 触发），步骤七只需：
1. 上线验证（如有部署权限）
2. 在 PR description 或 commit message 中写根因摘要
3. 跳过 dima 工单写入步骤

## 产出格式

完成 `investigation.md` 最后一节：

```markdown
## 上线验证与归档

### 上线验证
- 触发条件重放：{结果} ✅
- 监控观测（5min）：错误率 {x%} → {y%} ✅

### 根因记录
{三要素格式的根因记录，1-3 段话}

### dima 关联
- workItemId: {xxx}
- 状态文件已写入: `.iteration/dima/✅{workItemId}.json`
```

完成后可以归档或删除 `investigation.md`，其核心内容已持久化到 dima 状态文件中。
