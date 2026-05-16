# 步骤五：修复方案选型 执行指导

## 输入信息

**必须入参**：
- `investigation.md`（含精确根因陈述 + 影响范围清单）
- 项目约束（从 AGENTS.md + 工单 comments 中提取）

## 目标要求

**任务**：列出候选方案，对照约束筛选，选定修复方案并记录决策依据
**目标**：选定方案修的是根因而非症状，约束无冲突，业务语义明确

**特性要求（Negative Prompts）**：
- 不允许只给出 1 个方案
- 不允许修症状（报错行）而忽视数据来源（根因）
- 不允许在业务语义不确定时静默猜测（必须显式标注或问 PM）

## 工作依据

### 方案选型原则

**最小侵入原则**：在能解决根因的前提下，选改动范围最小的方案。大量重构当下不是时机，如果发现需要重构，开一个 refactor ticket，当前只做最小修复。

**修根因而非症状的检验方法**：问自己"重现触发条件后，这个方案能让问题不再出现吗？"。如果答案是"是的，因为我修改了数据来源/设计决策"，则修的是根因。如果答案是"这次会被捕获，但下次类似情况还会出现"，则只是症状修复。

**业务语义不确定时的默认原则**：
- **显式拒绝（抛 4xx）> 静默降级**：4xx 会暴露边界条件，让人知道系统行为；静默用默认值可能掩盖数据错误
- 例外：若业务明确要求"无结果时用默认值"，则静默降级是正确选择——但这个决策必须明确记录

### 常见根因类型的修复模式

**逻辑错误（空值未处理）**：
```typescript
// 方案 A：加 null 守卫 + 业务错误（推荐）
if (!discount) throw new BadRequestException('当前商品品类暂无促销，无法下单');

// 方案 B：静默降级（需 PM 确认才能选）
const rate = discount?.rate ?? 0;
```

**并发/竞态**：
```typescript
// 方案 A：Promise dedup（消除飞行中的重复计算）
const inflight = new Map<string, Promise<T>>();

// 方案 B：DB 事务行锁（select for update）
await db.transaction(async trx => {
  const row = await trx.query('SELECT ... FOR UPDATE', [id]); // 行锁
  await trx.query('UPDATE ...', [newVal, id]);
});
```

**设计缺失（非幂等）**：
```typescript
// 推荐：幂等 key + DB 唯一约束 + ER_DUP_ENTRY 捕获
try {
  await db.query('INSERT INTO ... (idempotency_key) VALUES (?)', [key]);
} catch (e) {
  if (e.code === 'ER_DUP_ENTRY') return fetchExisting(key);
  throw e;
}
```

**配置/环境错误**：
- 先并行提审批（配置修改）+ 写代码侧 fallback（`process.env.X ?? config.y`）
- 代码侧 fallback 是临时方案，配置到位后需开 ticket 清理

**性能（N+1 / 索引缺失）**：
```typescript
// N+1 修复：QueryBuilder JOIN 替代循环内懒加载
const items = await itemRepo.createQueryBuilder('item')
  .leftJoinAndSelect('item.category', 'category')
  .where(...).skip(offset).take(limit).getMany();

// 索引添加（大表用 CONCURRENTLY）
await queryRunner.query(
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_item_status_created_at 
   ON item (status, created_at DESC)`
);
```

### 发布顺序约束

若修复涉及以下操作，**必须列出发布顺序**：

```
DB 变更（加字段/加索引/加约束）→ 代码部署
     ↑ migration 必须先行，代码后部署
```

大表 DDL 注意事项：
- PostgreSQL：使用 `CREATE INDEX CONCURRENTLY`，不锁表
- MySQL：使用 `pt-online-schema-change` 或 `ALTER TABLE ... ALGORITHM=INPLACE, LOCK=NONE`
- **先在测试环境验证执行时间**，再确定生产维护窗口

## 产出格式

在 `investigation.md` 中追加：

```markdown
## 修复方案选型

### 候选方案

| 方案 | 描述 | 优点 | 缺点 | 约束冲突 |
|------|------|------|------|----------|
| A | 加 null 守卫 + 抛 400 | 语义明确，快速修复 | 只修了调用点，需覆盖所有入口 | 无 |
| B | 修改 getActiveDiscount 的调用契约（改为返回 NonNullable）| 更彻底 | 影响面大，需改多处调用方 | 本次时间约束 |

### 选定方案

**选定：方案 A**

**决策依据**：
1. 修的是根因（数据来源处的空值未守卫）
2. 与 PM 确认：无促销时应拒绝下单，不静默降级
3. 影响范围可控，可一次性覆盖所有调用点

**风险点**：
- 需要同时修改 cart.service.ts（影响范围清单中的第二个入口），如遗漏会产生下一个必现 500

**发布顺序**（如有 DB 变更）：
1. 执行 migration: {描述}
2. 部署代码

**业务语义确认**：
- 无促销时行为：**显式拒绝（400 BadRequest）**，已与 PM 确认 / 根据业务逻辑判断
```
