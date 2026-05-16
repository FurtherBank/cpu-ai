# weavefoxinfra 测试模式参考手册

## 一、测试框架规范

**框架**：Mocha + power-assert + sinon  
**禁止使用**：任何 Jest 语法（`jest.fn()`, `expect(...).toBe()`, `expect(...).toHaveBeenCalled()` 等）

### Jest → Mocha/sinon 对应表

| Jest 语法 | 对应 Mocha/sinon 语法 |
|-----------|----------------------|
| `jest.fn()` | `sinon.stub()` |
| `jest.fn().mockResolvedValue(x)` | `sinon.stub().resolves(x)` |
| `jest.fn().mockRejectedValue(err)` | `sinon.stub().rejects(err)` |
| `expect(fn).toHaveBeenCalled()` | `assert.ok(stub.called)` |
| `expect(fn).toHaveBeenCalledWith(x)` | `assert.ok(stub.calledWith(x))` |
| `jest.clearAllMocks()` | `sinon.restore()` |

### 标准测试文件结构

```typescript
import assert from 'assert';
import sinon from 'sinon';
import { mm } from '@alipay/chair-bin/unittest';
import { app } from '@alipay/chair-bin/unittest';
// 注意：import 路径使用 @ 别名（如 @/module/...）

describe('test/module/{path}/ServiceName.test.ts', () => {
  let service: ServiceName;

  beforeEach(async () => {
    service = await app.getEggObject(ServiceName);
  });

  afterEach(() => {
    mm.restore();
    sinon.restore();
  });

  it('line XX: should <action> when <condition>', async () => {
    // Arrange
    mm(DependencyClass.prototype, 'method', async () => mockResult);

    // Act
    const result = await service.methodName(params);

    // Assert
    assert.strictEqual(result.field, 'expected');
  });
});
```

---

## 二、文件类型 → 测试策略

### Service 层（`app/module/*/service/*.ts`）

**Mock 策略**：
```typescript
// 方式1: mm（Chair 框架 mock，优先使用）
mm(DependencyService.prototype, 'methodName', async () => ({ id: 1 }));

// 方式2: app.mockService
app.mockService('dependencyService', 'methodName', async () => ({ id: 1 }));

// 方式3: 当 mm 无法 patch IoC readonly 属性时
sinon.stub(service, 'propName' as any).value(mockObj);
// 或
Object.defineProperty(service, 'propName', { value: mockObj, configurable: true });

// 方式4: Mock OneAPI
app.mockService('oneapi', 'serviceName', {
  ApiName: { methodName: async () => ({ success: true, data: {} }) },
});
```

**完整模板**：
```typescript
import assert from 'assert';
import { mm } from '@alipay/chair-bin/unittest';
import { app } from '@alipay/chair-bin/unittest';
import { AuthService } from '@/module/weavefox_openapi/service/AuthService';

describe('test/module/weavefox_openapi/service/AuthService.test.ts', () => {
  let service: AuthService;

  beforeEach(async () => {
    service = await app.getEggObject(AuthService);
  });

  afterEach(() => { mm.restore(); });

  describe('authenticate', () => {
    it('line 45: should return user when apiKey is valid', async () => {
      mm(OpenapiApiKeyDAO.prototype, 'findByKey', async () => ({
        id: 1, userId: 100, workId: 'w1'
      }));
      const result = await service.authenticate({ apiKey: 'valid-key' }, {} as any);
      assert.strictEqual(result.userId, 100);
    });

    it('line 45: should throw 401 when apiKey is empty', async () => {
      await assert.rejects(
        () => service.authenticate({ apiKey: '' }, {} as any),
        (e: any) => e.statusCode === 401
      );
    });

    it('line 62: should handle DB error in catch block', async () => {
      mm(OpenapiApiKeyDAO.prototype, 'findByKey', async () => {
        throw new Error('DB connection failed');
      });
      await assert.rejects(
        () => service.authenticate({ apiKey: 'any' }, {} as any),
        /DB connection failed/
      );
    });
  });
});
```

---

### Controller 层（`app/module/*/controller/*.ts`）

**Mock 策略**：`app.mockService` + `app.httpRequest()`

**路由路径确认**：必须先读 `app/router.ts` 或模块路由文件确认实际路径，避免 404。

**HTTP 状态码规范**：
- 每个状态码对应一个独立的 it 块（不接受多状态码 `[200, 404, 500]`）
- 302/401：不加 `mockUser`（测试未登录）
- 403：加 `mockUser` 但 mock 权限不足
- 200：加 `mockUser` + `app.mockService` 返回数据

```typescript
describe('test/module/weavefox_openapi/controller/CodeGenerationController.http.test.ts', () => {
  afterEach(() => { mm.restore(); });

  it('GET /v1/code-generation/list: 未登录 → 302/401', async () => {
    const res = await app.httpRequest().get('/v1/code-generation/list');
    assert.ok(res.status === 302 || res.status === 401);
  });

  it('GET /v1/code-generation/list: 登录后返回列表', async () => {
    app.mockService('codeGenerationService', 'listTasks', async () => ({
      data: [], total: 0
    }));
    const res = await app.httpRequest().get('/v1/code-generation/list')
      .set('Authorization', 'Bearer test-token');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data.data));
  });

  it('POST /v1/code-generation: 缺少必填参数 → 400', async () => {
    const res = await app.httpRequest().post('/v1/code-generation').send({});
    assert.strictEqual(res.status, 400);
  });
});
```

---

### Utils/Helper（`app/module/*/utils/*.ts` 或 `*helper*.ts`）

**特点**：纯函数，直接 import，无需框架

```typescript
import assert from 'assert';
import { parseTagsFromString, validateTags } from '@/module/weavefox_openapi/utils/tags';

describe('test/module/weavefox_openapi/utils/tags.test.ts', () => {
  describe('validateTags', () => {
    it('should return error when input is undefined', () => {
      assert.strictEqual(validateTags(undefined as any), 'tags 必须是数组');
    });
    it('should return error when tag exceeds max length', () => {
      assert.ok(validateTags(['a'.repeat(101)]).includes('超出'));
    });
    it('should return null when valid tags', () => {
      assert.strictEqual(validateTags(['react', 'typescript']), null);
    });
    it('should handle empty array', () => {
      assert.strictEqual(validateTags([]), null);
    });
  });
});
```

---

### Adapter 层（`app/module/*/adapter/*.ts`）

**特点**：内部使用 `ctx.curl` 发 HTTP 请求，需 mock ctx

```typescript
import sinon from 'sinon';
import { mm } from '@alipay/chair-bin/unittest';
import { app } from '@alipay/chair-bin/unittest';
import { FecodexVibeAdapter } from '@/module/weavefox_openapi/adapter/FecodexVibeAdapter';

describe('FecodexVibeAdapter', () => {
  let adapter: FecodexVibeAdapter;

  beforeEach(async () => {
    adapter = await app.getEggObject(FecodexVibeAdapter);
  });

  afterEach(() => { mm.restore(); sinon.restore(); });

  it('createChat: 返回上游 chatId', async () => {
    mm(adapter as any, 'ctx', {
      curl: async () => ({
        status: 200,
        data: JSON.stringify({ code: 200, data: { id: 123 } }),
      }),
    });
    const result = await adapter.createChat({ workId: 'w1', prompt: 'test' } as any);
    assert.strictEqual(result.id, 123);
  });

  it('createChat: 上游返回 500 → 抛错', async () => {
    mm(adapter as any, 'ctx', {
      curl: async () => ({ status: 500, data: '{}' }),
    });
    await assert.rejects(
      () => adapter.createChat({ workId: 'w1', prompt: 'test' } as any),
      /500/
    );
  });
});
```

---

## 三、数据库操作 mock（Bone ORM）

```typescript
// Mock ORM 查询方法
mm(ModelName, 'findAll', async () => [
  { id: 1, field: 'value1' },
  { id: 2, field: 'value2' },
]);

mm(ModelName, 'findOne', async () => ({ id: 1, status: 'active' }));
mm(ModelName, 'findOne', async () => null);  // 测试记录不存在的分支

mm(ModelName, 'count', async () => 5);

// 测试创建
mm(ModelName.prototype, 'save', async function() { this.id = 999; });
```

---

## 四、断言最佳实践

```typescript
// ✅ 正确：验证具体值
assert.strictEqual(result.status, 'success');
assert.deepStrictEqual(result.items, ['item1', 'item2']);
assert.ok(result.id > 0);
await assert.rejects(
  () => service.method(invalidInput),
  { name: 'ValidationError', message: /invalid/ }
);

// ✅ 正确：验证字段不存在（这不是反模式）
assert.strictEqual(result.slug, undefined);
assert.strictEqual(params.status, undefined);

// ❌ 错误：无意义断言
assert.ok(true);
assert.strictEqual(typeof result, 'object');
assert.ok(result !== undefined);
assert.strictEqual(input.field, 'value');  // 断言输入本身！
```

---

## 五、测试命名规范

```typescript
// ✅ 好的命名：包含行号 + 场景描述
it('line 45: should throw 401 when apiKey is empty', ...);
it('line 62 catch-block: should handle DB connection error', ...);
it('line 78 else-branch: should apply default limit when options is undefined', ...);

// ❌ 差的命名
it('test case 1', ...);
it('should work', ...);
```

---

## 六、常见问题排查

**问题**：`describe is not defined`  
**原因**：测试文件放在 `app/` 目录  
**解决**：移到 `test/` 目录对应路径

**问题**：`jest is not defined`  
**原因**：测试代码使用了 Jest 语法  
**解决**：替换为 sinon 等效语法（见本文第一节表格）

**问题**：`mm()` 后 mock 不生效  
**原因**：Chair IoC 容器注入的属性是 readonly/sealed  
**解决**：按优先级：`sinon.stub(...).value(...)` → `Object.defineProperty` → mock 更上层 Service

**问题**：全量测试某个 test 通过单独跑，全量跑就失败  
**原因**：mm/sinon 在 afterEach 中未 restore，导致 mock 污染  
**解决**：检查每个测试文件是否有 `afterEach(() => { mm.restore(); sinon.restore(); })`
