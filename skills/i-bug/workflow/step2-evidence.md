# 步骤二：证据采集 执行指导

## 输入信息

**必须入参**：
- `investigation.md`（步骤一产出，包含 `reproducible` 标志）
- 工单中的 stacktrace / 错误日志文本（若工单未附带，见下方「信息缺口处理」）

**上下文参考**：
- 代码库（通过 Read/Grep/Glob 按需访问）

## 信息缺口处理

**本步骤的所有分析依赖真实的日志或错误信息。** Agent 不具备直接访问生产日志系统的能力，若工单中未附带，需明确向用户请求。

遇到以下情况时，停止推进，输出请求：

### 情况 A：工单无 stacktrace / 错误日志

> 🔍 **需要你提供**：触发 Bug 时的完整错误日志或 stacktrace。
>
> 请从你的日志平台（控制台、日志工具、监控面板等）找到对应时间段的错误信息，粘贴到这里。
> 最有用的内容：完整的错误 message + 调用栈（不要只截图，要贴文本）。

### 情况 B：`reproducible: false`（偶现），需要更多日志证据

> 🔍 **需要你提供**：下次 Bug 触发时的上下文日志。
>
> 建议关注的信息：
> - 错误发生的时间点（精确到秒）
> - 同时段有无其他异常日志
> - 是否有 request ID / trace ID 可以串联请求链路
>
> 如果你的系统有日志查询工具，请执行后把输出粘贴过来。我来帮你分析。

## 目标要求

**任务**：定位「第一现场」；偶现 Bug 额外产出日志增强方案
**目标**：能指出精确位置（文件路径:行号，或慢 SQL，或错误码），并说明选择该位置的依据

## 工作依据

### 读 Stacktrace 的正确姿势

**从底部往上找第一个 `src/` 前缀（或项目代码目录）的帧**，这是业务侧最直接的事故现场。

```
// 典型 stacktrace，正确做法：
Error: Cannot read properties of undefined (reading 'id')
  at OrderService.createOrder (src/services/order.service.ts:87:32)   ← ✅ 这里是第一现场
  at OrderController.submitForm (src/controllers/order.controller.ts:43:28)  ← ✅ 调用方
  at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)  ← ❌ 框架帧，忽略
```

**错误 message 本身比行号更有价值**：
- `Cannot read properties of undefined (reading 'xxx')` → NPE，追 xxx 的数据来源
- `QueryFailedError` → DB 查询失败，看 SQL 语句
- `ENOENT: no such file or directory` → 文件路径配置问题
- `HMAC signature verification failed` → 密钥/配置问题

**TS 编译行号偏移的处理**：若 IDE 跳转位置与 stacktrace 行号不符，检查 `tsconfig.json` 中 `sourceMap: true`；或临时用 `ts-node` 直接运行复现，避免编译偏移。

### 当日志粒度不足时（偶现 Bug 的第一优先级）

不要在证据不足时就去猜代码问题。**先让系统开口说话**，再分析。

**日志增强是一个需要部署的代码改动**，Agent 会设计方案，但需要用户确认是否已部署并等待触发：

> 🔍 **需要你配合**：以下日志增强代码已设计好，请部署后告知我。
>
> 等高峰期触发后，把新增日志的输出粘贴到这里，我来从中找根因。

**日志增强设计模板**（写入 investigation.md，供用户部署）：

```typescript
// 在计算/业务函数入口处添加（最小侵入原则）
const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

logger.info({
  event: 'fn_start',
  traceId,
  reqId: ctx.reqId,       // 请求级 correlation ID
  userId: ctx.userId,
  input: sanitize(input), // 脱敏后的关键入参
  timestamp: Date.now(),
});

// 在 DB/缓存读取后记录中间状态（破局关键）
logger.debug({
  event: 'fn_intermediate',
  traceId,
  dbValue: result,              // 从 DB 读到的值
  cacheHit: result._fromCache,  // 是否命中缓存
  timestamp: Date.now(),
});

// 在函数出口
logger.info({
  event: 'fn_end',
  traceId,
  result: sanitize(result),
  durationMs: Date.now() - startTime,
});
```

**日志增强的三个原则**：
1. 最小侵入：只在入口/出口和关键中间值处打点，不在循环内打
2. 绑定 correlation ID：确保同一请求的所有日志可串联
3. 记录「可疑的中间状态」：共享变量读取值、缓存命中标记、DB 查询结果

### 对于性能类 Bug（无 stacktrace 的慢接口）

需要分层打点找出瓶颈所在。Agent 会设计打点方案，实际需要用户在本地或测试环境执行后把结果粘贴回来：

> 🔍 **需要你提供**：请在代码中加入以下时间戳桩，用大数据量（能触发慢查询的量级）执行一次后，把控制台输出粘贴到这里。
>
> ```typescript
> // 分层打点，找出哪一层是瓶颈
> const t0 = Date.now();
> const items = await repo.find({ ... });
> console.log(`[PERF] repo.find: ${Date.now() - t0}ms`);
>
> const t1 = Date.now();
> const enriched = await enrichItems(items);
> console.log(`[PERF] enrichItems: ${Date.now() - t1}ms`);
> ```

## 产出格式

在 `investigation.md` 的「已知线索」部分追加：

```markdown
## 证据采集结果

### 第一现场
- 文件: `{path/to/file.ts}`
- 行号: {87}
- 内容片段: `{相关代码一行}`
- 选择依据: {为什么这里是第一现场，而不是框架帧}

### 调用方（可选）
- `{controller.ts:43}` → 调用了上述 Service 方法

### 根因类型初猜
- {逻辑错误 / 配置环境 / 性能 / 兼容性 / 设计缺失}（待步骤三确认）

### 日志增强方案（若 reproducible: false）
- 在 {file:line} 处添加以下日志...
- 预期等待周期：{1-2 个业务高峰期，约 2-4 小时}
- 部署状态：{待部署 / 已部署}
```
