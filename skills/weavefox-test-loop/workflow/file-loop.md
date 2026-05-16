# 阶段二：单文件补测循环 执行指导

## 输入信息

**必须入参**：

- `pendingFiles[]`：来自阶段一，按 pct 升序
- `progressData`：来自阶段一（含 completedFiles, \_stalledFiles 等）

**上下文参考**：

- [references/test-patterns.md](../references/test-patterns.md)：各文件类型的测试模板与 mock 模式

## 目标要求

**任务**：对 `pendingFiles` 中的每个文件，按固定 SOP 完成测试补全。

**目标**：`pendingFiles` 全部处理完（每个文件要么 `lines.pct ≥ 90%` 要么在 `_stalledFiles` 中）。

**不做什么**：本阶段不做全量覆盖率验证（那是阶段三的工作）。

---

## 每个文件的标准处理流程（SOP）

对 `pendingFiles` 中**每个文件**，按以下 5 个 Step 顺序执行：

### Step 2.1 — 分析源文件

**动作**：

1. 用 Read 工具读取目标源文件全文（路径：`PROJECT_DIR/<file>`）
2. 识别以下结构：
   - 文件类型：`/service/` → Service、`/controller/` → Controller、`/utils/` 或 `helper` → Utils、`/adapter/` → Adapter
   - 所有公开方法/函数
   - 关键分支点：`if/else`, `switch`, `try/catch`, `throw`, 三元表达式
   - 外部依赖（被 `@Inject` 注入的属性，或 `ctx.curl`、`ctx.bone` 等框架对象）
3. 定位未覆盖的代码区域：
   - 运行以下命令，从 `coverage-summary.json` 读取该文件的当前 lines.pct
   - 若有 `coverage/lcov-report/` 目录，通过读取对应 HTML 文件精确获取未覆盖行号（优先使用）

```bash
# 获取该文件当前 lines.pct
node -e "
const cov = JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json','utf8'));
const root = '/Users/lrt/Desktop/weavefox/weavefoxinfra/';
const key = root + '<relPath>';
const d = cov[key];
if (!d) { console.log('NOT_FOUND'); process.exit(0); }
console.log(JSON.stringify({ lines: d.lines, functions: d.functions, branches: d.branches }));
"
```

4. 在同目录中查找已有测试文件（参考其 import 路径、mock 模式、describe 结构）：

```bash
ls test/module/<module-path>/
```

**判断**：若同模块已有测试文件，读取该文件内容作为 mock 模式参考（强制执行，防止 mock 写法错误）。

---

### Step 2.2 — 编写/扩充测试文件

**动作**：

**目标测试文件路径规则**：

```
源文件路径：app/module/weavefox_openapi/service/AuthService.ts
测试文件路径：test/module/weavefox_openapi/service/AuthService.<suffix>.test.ts
```

⚠️ **测试文件必须放在 `test/` 目录，绝对不能放在 `app/` 目录**（放错会导致 `describe is not defined`）

**文件类型对应的测试模板**（详见 [references/test-patterns.md](../references/test-patterns.md)）：

| 文件类型     | Mock 策略                                                          | 实例化方式                       |
| ------------ | ------------------------------------------------------------------ | -------------------------------- |
| Service      | `mm(ServiceClass.prototype, 'dep', ...)` 或 `app.mockService(...)` | `app.getEggObject(ServiceClass)` |
| Controller   | `app.mockService(...)` + `app.httpRequest()`                       | HTTP 请求                        |
| Utils/Helper | 直接 import 纯函数                                                 | 无需框架                         |
| Adapter      | `mm(AdapterClass.prototype, 'ctx', mockCtx)`                       | `app.getEggObject(AdapterClass)` |

**必须覆盖的场景**：

- Happy path（正常输入 → 预期输出）
- 错误路径（每个 `if/throw/catch` 分支至少一个用例）
- 边界值（0、null、undefined、空字符串、空数组）

**测试代码规范**：

```typescript
import assert from "assert";
import sinon from "sinon";
import { mm } from "@alipay/chair-bin/unittest";
import { app } from "@alipay/chair-bin/unittest";
import { TargetService } from "@/module/.../TargetService";

describe("test/module/.../TargetService.test.ts", () => {
  let service: TargetService;

  beforeEach(async () => {
    service = await app.getEggObject(TargetService);
  });

  afterEach(() => {
    mm.restore();
    sinon.restore();
  });

  it("line XX: should handle <scenario>", async () => {
    // Arrange
    mm(DependencyClass.prototype, "method", async () => ({ id: 1 }));
    // Act
    const result = await service.methodName({ param: "value" });
    // Assert
    assert.strictEqual(result.id, 1);
  });
});
```

**禁止的模式**：

```typescript
// ❌ Jest 语法（项目不支持）
jest.fn();
expect(fn).toHaveBeenCalled();

// ❌ 无意义断言
assert.ok(true);
assert.strictEqual(typeof service.method, "function");
assert.strictEqual(input.field, "value"); // 断言输入本身

// ❌ 测试文件放错目录
// app/module/weavefox_openapi/service/AuthService.test.ts  ← 错误！
```

---

### Step 2.3 — 运行单文件测试（Shell Subagent）

**执行模式**：委派 Shell Subagent（弱耦合，仅需运行命令并返回输出）

**派发 Prompt**：

````markdown
请在 /Users/lrt/Desktop/weavefox/weavefoxinfra 目录下执行以下命令，返回完整输出（包括 stdout 和 stderr）。

## 命令

```bash
eval "$(fnm env --shell zsh)" && fnm use 20.20.0 && npm run test -- <test-file-path> 2>&1
```
````

## 要求

1. 必须先执行 `eval "$(fnm env --shell zsh)" && fnm use 20.20.0`，确认 `node -v` 为 v20.20.0
2. 返回：
   - exit code（0 = 通过，非 0 = 失败）
   - 最后 80 行的输出（含错误信息）
   - 通过/失败的测试数量（从 mocha 输出提取 "X passing" 和 "X failing"）
3. 将完整输出通过 `2>&1` 重定向，不要过滤任何内容

````

**主控在 Subagent 返回后**：
- exit code = 0 → 进入 Step 2.4
- exit code ≠ 0 → 进入错误修复流程（见 Step 2.3-E）

#### Step 2.3-E — 错误修复流程（最多 3 次）

**错误分类与修复动作**：

| 错误特征（grep 关键词）| 根因 | 修复动作 |
|----------------------|------|---------|
| `error TS` / `TypeScript` | import 路径错误 / 类型不匹配 | 用 Glob 精确定位源文件路径；对照源码方法签名修正类型 |
| `describe is not defined` | 测试文件放在 `app/` 目录 | 将测试文件移至 `test/` 对应路径 |
| `Cannot read properties of undefined` | mock 未生效（IoC readonly 属性） | 按优先级依次尝试：① `mm(Class.prototype, 'prop', ...)` ② `sinon.stub(obj, 'prop').value(mock)` ③ `Object.defineProperty(service, 'prop', { value: mock, configurable: true })` ④ 改为 mock 更上层 Service 方法 |
| `AssertionError` | 预期值与实际值不符 | 在测试中加 `console.log(JSON.stringify(result))` 打印实际值，对照源码逻辑修正预期 |
| `MODULE_NOT_FOUND` | 依赖未安装 | 执行 `tnpm install`，再重试 |

**防修复回旋机制**：
1. 每次修复后，将错误摘要写入 `/tmp/test_err_N.txt`（N 为次数）
2. 修复完运行测试后，对比上一次错误摘要：若出现**新的错误行**，立即用 StrReplace 回滚本次修改，换思路
3. 同一错误连续出现 **≥ 3 次** → 写卡点文件并跳过（见 Step 2.3-S）

**每次修复只改一处**：不同时修改 import + mock + 断言，这样才能精确归因。

#### Step 2.3-S — 标记卡点并跳过

```markdown
// 写入 __stall_report__.md（追加模式）

## [日期时间] 文件：<relPath>

**测试文件**：<test-file-path>
**运行命令**：npm run test -- <test-file-path>
**连续失败次数**：3

### 错误特征（三次相同）
<粘贴最后一次的错误输出，提取关键行>

### 已尝试修复
| 次数 | 修改内容 | 结果 |
|------|---------|------|
| 1 | ... | 同样错误 |
| 2 | ... | 同样错误 |
| 3 | ... | 同样错误 |

### 疑似根本原因
<推断：IoC 注入方式 / 架构约束 / 依赖链过深等>

### 建议的侧翼路径
1. 读源码确认 @Inject 注入方式
2. 参考 <同目录已通过测试文件> 的 mock 模式
3. 若仍无法 mock，改为测试该方法的上层调用方
````

同时将 `<relPath>` 加入 `progressData._stalledFiles`，原子写入进度文件，继续处理下一个文件。

---

### Step 2.4 — 验证覆盖率提升

**动作**：单文件测试通过后，运行全量覆盖率命令（此步骤较耗时但必须执行以获取准确数字）：

```bash
eval "$(fnm env --shell zsh)" && fnm use 20.20.0
npm run test -- --coverage 2>&1 | tail -20
```

然后读取 `coverage/coverage-summary.json`，检查该文件的 `lines.pct`：

```bash
node -e "
const cov = JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json','utf8'));
const root = '/Users/lrt/Desktop/weavefox/weavefoxinfra/';
const key = root + process.argv[1];
const d = cov[key];
if (!d) { console.log('NOT_IN_REPORT'); process.exit(1); }
const ok = d.lines.pct >= 90;
console.log(ok ? 'PASS' : 'FAIL', d.lines.pct + '%');
" '<relPath>'
```

**判断**：

- `PASS`（lines.pct ≥ 90）→ 进入 Step 2.5
- `FAIL`（lines.pct < 90）→ 回到 Step 2.2 补充更多未覆盖分支的用例（最多再补 2 轮）

> **优化**：若 pendingFiles 中还有多个文件，可以在写完几个文件的测试后批量跑一次全量覆盖率，而不是每个文件都跑一次。判断时机：当已经连续写了 3 个文件的测试但没有运行全量时，必须跑一次。

---

### Step 2.5 — 原子写进度

**动作**：将处理结果更新到 `progressData` 并原子写入文件。

```bash
node -e "
const fs = require('fs');
const file = '.coverage-progress.json';
let p = { processedFiles: [], completedFiles: [], _stalledFiles: [], _invalidPaths: [], _regressedHistory: [] };
try { if (fs.existsSync(file)) p = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) {}

const relPath = process.argv[1];
const isCompleted = process.argv[2] === 'true';

if (!p.processedFiles.includes(relPath)) p.processedFiles.push(relPath);
if (isCompleted && !p.completedFiles.includes(relPath)) p.completedFiles.push(relPath);
p.lastRun = new Date().toISOString();

const tmp = file + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
fs.renameSync(tmp, file);
console.log('进度已保存：', relPath, isCompleted ? '✓ 完成' : '⟳ 待续');
" '<relPath>' '<true|false>'
```

**完成判定**：`pendingFiles` 中所有文件均已处理（completed 或 stalled），进入阶段三。

---

## 处理循环流程图

```
取 pendingFiles[0] → Step 2.1（分析源文件）
                          ↓
                   Step 2.2（写测试）
                          ↓
                   Step 2.3（运行测试）
                          ↓
                   exit 0? ──否──→ 分类修复 → 重试（≤3次）
                          |                         ↓失败3次
                         是                  写卡点 + 跳过
                          ↓
                   Step 2.4（验证覆盖率）
                          ↓
                   lines.pct ≥ 90? ──否──→ 补更多测试（≤2轮）
                          |
                         是
                          ↓
                   Step 2.5（写进度）
                          ↓
                   pendingFiles 还有文件? ──是──→ 取下一个
                          |
                         否
                          ↓
                   进入阶段三
```
