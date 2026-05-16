# 步骤六：实施修复与测试补全 执行指导

## 输入信息

**必须入参**：
- `investigation.md`（含选定方案 + 影响范围清单 + 发布顺序）
- 代码库

## 目标要求

**任务**：按选定方案修改所有受影响入口；补充测试；验证全量测试通过
**目标**：修复代码 + 新增测试用例 + 全量测试 exit code 0

**特性要求**：
- 必须按影响范围清单修复所有入口，不允许只改 controller 遗漏 jobs
- 新增测试必须在修复前失败、修复后通过（有效性验证）
- 最小化改动原则：不顺手改无关代码

## 工作依据

### 修复实施顺序

```
1. 若有 DB migration → 先写 migration 文件（含 down() 回滚）
2. 修改 Service/核心层代码
3. 修改所有其他受影响入口（jobs/webhooks/其他 service）
4. 本地触发原来 100% 复现的触发条件 → 确认 Bug 不再出现
5. 补充测试用例
6. 运行全量测试套件
```

**不能颠倒的顺序**：DB migration 先于代码。若代码先部署，新代码访问不存在的字段会引发新的生产故障。

### 本地复现验证（修完后必做）

在补测试之前，先手动验证：

```bash
# 必现 Bug：手动构造触发条件
curl -X POST http://localhost:3000/api/your-endpoint \
  -H "Authorization: Bearer <token>" \
  -d '{"触发 Bug 的参数": "value"}'

# 预期：修复前返回 500/错误，修复后返回正确结果或业务错误（400 而非 500）
```

### 测试补全原则

**新增测试必须在修复前失败**：先 git stash 保存修复，跑测试看是否失败；再 git stash pop 恢复，跑测试应该通过。这是验证测试有效性的唯一方式。

**测试覆盖根因路径，而不是 happy path**：

```typescript
// ❌ 只加 happy path（无效）：
it('should create order with discount', async () => {
  mockDiscount.mockResolvedValue({ rate: 0.1 });
  // ...
});

// ✅ 加覆盖 Bug 路径的测试（有效）：
it('should throw BadRequestException when no active discount', async () => {
  mockDiscount.mockResolvedValue(null);  // ← 触发 Bug 的条件
  
  await expect(service.createOrder(dto, userId))
    .rejects.toThrow(BadRequestException);
});
```

**并发/竞态的测试模板**：

```typescript
it('concurrent requests should not produce race condition', async () => {
  const results = await Promise.all(
    Array(10).fill(null).map(() => service.calculate(sameInput))
  );
  const uniqueResults = new Set(results.map(r => JSON.stringify(r)));
  expect(uniqueResults.size).toBe(1); // 所有结果应一致
});
```

**幂等性的测试模板**：

```typescript
it('should be idempotent: duplicate calls create only one record', async () => {
  const key = 'test-idempotency-key';
  
  await Promise.all([
    service.createOrder(dto, { idempotencyKey: key }),
    service.createOrder(dto, { idempotencyKey: key }),
    service.createOrder(dto, { idempotencyKey: key }),
  ]);
  
  const count = await db.count({ where: { idempotencyKey: key } });
  expect(count).toBe(1);
});
```

### 全量测试执行

```bash
# 根据项目类型选择命令（从 AGENTS.md 获取）
npm test
# 或
jest --coverage
# 或
pnpm test

# 验证：exit code 0，无 FAIL 行
```

**mock 不匹配时的正确处理**：若因新增字段导致 `toHaveBeenCalledWith` 精确匹配失败，正确做法是更新测试 expected 对象或改为 `expect.objectContaining()`，**不要**为了让测试通过而回退修复代码。

### DB Migration 注意事项

```typescript
// migration 必须有 down() 回滚方法
export class AddIdempotencyKey1234567890 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(64) DEFAULT NULL`
    );
    // 大表用 CONCURRENTLY（PG）
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_idempotency 
       ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL`
    );
  }
  
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_idempotency`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN idempotency_key`);
  }
}
```

**先在测试环境验证 migration 执行时间**，再决定生产执行窗口（大表可能需要维护窗口或在线变更工具）。

## 产出格式

在 `investigation.md` 中追加：

```markdown
## 修复实施记录

### 改动文件列表
- `src/services/order.service.ts`: 加 null 守卫，抛 BadRequestException
- `src/services/cart.service.ts`: 同样的 null 守卫（影响范围清单的第二个入口）
- `src/migrations/xxx.ts`: 加 idempotency_key 字段（如有）
- `src/services/order.service.spec.ts`: 新增 2 个 null 分支测试用例

### 本地验证结果
- 触发条件（无 active discount 的商品）：修复前 500，修复后 400 BadRequest ✅

### 测试结果
- 新增测试：2 个，均在修复前失败、修复后通过 ✅
- 全量测试：npm test → 所有通过，exit code 0 ✅
```
