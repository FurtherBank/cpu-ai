# 阶段三：全量验证 执行指导

## 输入信息

**必须入参**：

- `progressData._stalledFiles`：已知无法处理的文件列表（验证时豁免）
- 所有已写入的测试文件（在 `test/` 目录下）

## 目标要求

**任务**：完成两重验证，确认任务真正达标。

**目标**（双重 DoD，必须全部满足）：

1. `coverage-summary.json` 中所有**非卡点文件** `lines.pct ≥ 90%`
2. `verify-tests.js`（标准模式，无 `--sandbox`）输出无 CRITICAL，exit 0

**不做什么**：不修改现有测试（若双重验证失败，回退到阶段二处理遗留文件）。

---

## Step 3.1 — 全量覆盖率运行（Shell Subagent）

**执行模式**：委派 Shell Subagent

**派发 Prompt**：

````markdown
请在 /Users/lrt/Desktop/weavefox/weavefoxinfra 目录下执行以下命令，返回完整输出。

## 命令

```bash
eval "$(fnm env --shell zsh)" && fnm use 20.20.0 && npm run test -- --coverage 2>&1
```
````

## 要求

1. 先确认 `node -v` 为 v20.20.0
2. 返回：
   - exit code
   - 测试结果摘要（X passing, X failing）
   - coverage-summary.json 的全文（执行 `cat coverage/coverage-summary.json` 获取）
3. 命令可能需要 2-3 分钟，请等待完成

你是本次交付的最后一道质量关卡。返回前请确认：

- exit code 是否为 0
- coverage-summary.json 是否存在且有内容
  如果发现任何异常，必须精确说明是哪一步出了问题。

````

---

## Step 3.2 — 分析覆盖率结果（主控执行）

从 Subagent 返回的 `coverage-summary.json` 内容中提取：

```javascript
const ROOT = '/Users/lrt/Desktop/weavefox/weavefoxinfra/';
const TARGET = 90;
const stalledFiles = progressData._stalledFiles || [];

const failedFiles = [];
for (const [absPath, data] of Object.entries(cov)) {
  if (absPath === 'total') continue;
  const relPath = absPath.replace(ROOT, '');
  if (stalledFiles.includes(relPath)) continue; // 豁免卡点文件
  if (data.lines.pct < TARGET) {
    failedFiles.push({ file: relPath, pct: data.lines.pct });
  }
}
````

**判断**：

- `failedFiles.length === 0` → 覆盖率门通过，进入 Step 3.3
- `failedFiles.length > 0` → 将这些文件重新加入 pendingFiles，**回退到阶段二处理**（最多回退 2 次）

---

## Step 3.3 — 质量扫描（Shell Subagent）

**执行模式**：委派 Shell Subagent

**派发 Prompt**：

````markdown
请在 /Users/lrt/Desktop/weavefox/weavefoxinfra 目录下执行以下命令，返回完整输出。

## 命令

```bash
NODE_PATH=./node_modules node /Users/lrt/Desktop/weavefox/.cursor/skills/weavefox-test-loop/scripts/verify-tests.js 2>&1
echo "EXIT_CODE:$?"
```
````

## 要求

1. **注意**：命令前缀 `NODE_PATH=./node_modules` 是必须的，否则 glob 模块找不到
2. **不要使用 `--sandbox` 标志**（该模式有已知假阳性）
3. 返回：
   - 完整输出
   - 退出码（从 `EXIT_CODE:X` 行提取）
   - 若有 CRITICAL，列出是哪些文件和什么反模式
4. HIGH 级别告警可能是假阳性，主控会判断；CRITICAL 才是真正的阻断

你是最后一道质量守门人。如果发现 CRITICAL，请确认是否真的是低质量测试（assert.ok(true)、typeof 检查等），还是假阳性（assert 中包含 undefined 作为预期值等合法测试）。

````

---

## Step 3.4 — 分析质量扫描结果（主控执行）

**CRITICAL 真假阳性判断规则**：

| 被标记代码模式 | 判断 | 处理 |
|------------|------|------|
| `assert.ok(true)` | 真反模式 | 回到阶段二修复 |
| `assert.strictEqual(typeof service.method, 'function')` | 真反模式 | 回到阶段二修复 |
| `assert.strictEqual(input.field, 'value')` | 真反模式（断言输入本身） | 回到阶段二修复 |
| `assert.strictEqual(result.field, undefined)` | **假阳性**（合法预期值断言） | 忽略 |
| `assert.strictEqual(validateFn(undefined), 'error')` | **假阳性**（undefined 作为输入参数） | 忽略 |
| `assert.strictEqual(capturedParams.status, undefined)` | **假阳性**（验证字段不应被注入） | 忽略 |

**结论**：
- 若 CRITICAL 全部为假阳性 → 质量门通过，进入 Step 3.5
- 若有真实 CRITICAL → 定位对应测试文件，回到阶段二修复（最多回退 1 次）

---

## Step 3.5 — 完成标记与任务报告（主控执行）

更新进度文件标记为完成：

```bash
node -e "
const fs = require('fs');
const file = '.coverage-progress.json';
let p = {};
try { p = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { p = {}; }
p.status = 'DONE';
p.completedAt = new Date().toISOString();
const tmp = file + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
fs.renameSync(tmp, file);
console.log('任务完成，进度文件已标记 DONE');
"
````

打印完成报告：

```
========================================
✅ weavefoxinfra 单测覆盖率补全完成
========================================
完成时间：[datetime]
总行覆盖率：[total lines.pct]%
已处理文件：[completedFiles.length] 个
跳过卡点：[_stalledFiles.length] 个

卡点文件（需人工处理）：
  - [file1]：见 __stall_report__.md
  - [file2]：...

覆盖率达标：✅
质量扫描：✅ 无 CRITICAL
========================================
```

若有卡点文件，额外打印：

```
⚠️  以下文件无法自动补测，建议人工介入：
[__stall_report__.md 的内容摘要]
```

---

## 完成判定

DoD 全部满足时，任务结束：

- [ ] `coverage-summary.json` 中所有非卡点文件 `lines.pct ≥ 90%`
- [ ] `coverage-summary.json` 中 `total.lines.pct ≥ 90%`（若有卡点文件可能未达到，需说明）
- [ ] `npm run test` 输出 `0 failing`
- [ ] `verify-tests.js`（标准模式）exit 0，无 CRITICAL
- [ ] 所有测试文件位于 `test/` 目录
- [ ] `.coverage-progress.json` 标记 `status: "DONE"`
