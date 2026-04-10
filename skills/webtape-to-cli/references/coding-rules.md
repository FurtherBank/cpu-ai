# cpu-cli-tool 命令编码规则

## 代码组织范式：子命令自包含

webtape 命令采用**「子命令自包含」范式**（介于 yuque 扁平型和 dima 分层型之间）：

```
src/commands/<cmdName>/
├── index.ts              ← 只负责注册所有子命令（不含任何业务逻辑）
├── config.ts             ← 公共 base URL + header 工厂函数
└── commands/
    ├── <sub1>.ts         ← 自包含：API fetch 函数 + commander 注册
    └── <sub2>.ts         ← 自包含：API fetch 函数 + commander 注册
```

**每个 `commands/<sub>.ts` 固定三段结构**：

```typescript
// ── 段1：接口文档注释（录制提炼的链路说明）────────────────────
/**
 * <sub-command>：<功能描述>
 *
 * 接口链路：
 * 1. GET /api/xxx — <业务用途>（入口，接受用户输入）
 * 2. POST /api/yyy/{id} — <业务用途>（写操作，依赖步骤1的 data.id）
 */

// ── 段2：API 调用函数（纯函数，每个接口一个）────────────────────
import type { Command } from "commander";
import { chromeFetch } from "@cpu-utils/headless";
import { BASE_URL } from "../config.js";

async function fetchXxx(base: string, params: { ... }) {
  // ...
}

// ── 段3：Commander 注册（export，供 index.ts 导入）──────────────
export function <sub>Command(program: Command): void {
  program
    .command("<sub-command-name>")
    .description("<功能描述>")
    .option(...)
    .action(async (opts) => {
      // 业务流程编排：直接调用段2的 fetch 函数
    });
}
```

**index.ts 只做注册**，不包含任何业务逻辑：

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { <sub1>Command } from "./commands/<sub1>.js";
import { <sub2>Command } from "./commands/<sub2>.js";

const program = new Command();
program.name("<cmdName>").description("<描述>").version("1.0.0");

<sub1>Command(program);
<sub2>Command(program);

program.parse();
```

**选择此范式的原因**：
- 鉴权由 `chromeFetch` Cookie 透明处理，无需鉴权逻辑层
- 每个子命令的 API 调用专属，不需要跨命令复用的 Service Class
- 自包含结构使 Subagent 并行实现时互不干扰（只写自己的文件）

---

## 强制规则（违反则拒绝合并）

### TypeScript ESM 格式
- 所有 import 路径必须带 `.js` 后缀（即使源文件是 `.ts`）
- 示例：`import { chromeFetch } from "@cpu-utils/headless"` ✅
- 示例：`import { foo } from "./utils"` ❌ → `import { foo } from "./utils.js"` ✅

### HTTP 请求只用 chromeFetch
- 唯一允许的 HTTP 库：`chromeFetch`（`@cpu-utils/headless`）
- 禁止引入 `axios`/`node-fetch`/`undici`/原生 `fetch` 等其他 HTTP 库
- `chromeFetch` 会自动携带 Chrome 浏览器的 Cookie，鉴权透明

### 禁止硬编码录制 ID
- 命令代码中不得出现录制时的特定数字 ID（如 `book_id: 12345678`）作为默认值
- 若需要 ID，必须通过 CLI 参数传入（`--id <number>`, 必填）
- 可接受的默认值：通用配置（如 base URL）、无语义的默认分页参数（如 `limit: 20`）

### 写操作必须有双重保护
```typescript
// ① 前置只读查询，验证当前状态
const status = await fetchCurrentStatus(id);
if (status !== "READY") {
  console.error(`❌ 当前状态为 ${status}，不满足操作条件`);
  process.exit(1);
}

// ② 不可逆写操作前 confirm（default: false，必须主动确认）
const { confirmed } = await inquirer.prompt([{
  type: "confirm",
  name: "confirmed",
  message: `⚠️ 即将执行 <操作描述>，此操作不可撤销，确认继续？`,
  default: false,
}]);
if (!confirmed) {
  console.log("已取消");
  process.exit(0);
}
```

### 分页循环三重终止

```typescript
const all: unknown[] = [];
let offset = 0;

for (;;) {
  const body = await fetchPage(offset, pageSize);
  const list = body?.data?.list ?? [];
  const end = body?.data?.end === true;
  const total = body?.data?.total as number | undefined;

  all.push(...list);

  // 三重终止：任一满足即退出
  if (end || list.length < pageSize || all.length >= (total ?? Infinity)) break;
  offset += pageSize;
}
```

### 401/403 统一错误提示
```typescript
if (!response.ok) {
  if (response.status === 401 || response.status === 403) {
    console.error(`❌ 鉴权失败 (HTTP ${response.status})，请确认 Chrome 已登录 ${hostname}，然后重试`);
    process.exit(1);
  }
  throw new Error(`HTTP ${response.status} ${response.statusText}`);
}
```

### URL namespace 路径不使用 encodeURIComponent
```typescript
// 当 namespace 含 "/" 时（如 "my-group/my-book"）
// ❌ 错误：
const url = `${base}/api/repos/${encodeURIComponent(namespace)}`;
// → 产生 .../repos/my-group%2Fmy-book，API 不识别

// ✅ 正确：
const url = `${base}/api/repos/${namespace}`;
// → 产生 .../repos/my-group/my-book
```

---

## 推荐规范

### 命令目录结构
```
src/commands/<cmdName>/
├── index.ts          ← 命令注册入口（commander.js）
├── config.ts         ← 公共 base URL 和 header（多段录制整合时）
└── commands/
    ├── <sub1>.ts     ← 各子命令独立文件（多子命令时）
    └── <sub2>.ts
```

### 复用优先
优先从以下位置复用，而非重新实现：
- `../../core/init.js` / `../../core/finish.js` — 命令生命周期
- `@cpu-utils/headless` — chromeFetch
- 同命令目录下其他子命令的工具函数
- 已有命令（如 `yuque/util.ts`）中的工具函数（`sanitizeFilePart`/`dedupeByTargetId` 等）

### 推断实现的标注
```typescript
// ⚠️ 推断实现：此接口签名基于 REST 规律推断，非实录覆盖
// 若运行时出现 404/400，请补录该接口后重新实现
async function getBookById(base: string, namespace: string) {
  const res = await chromeFetch(`${base}/api/repos/${namespace}`);
  // ...
}
```

### 批量导出文件命名
```typescript
// 文件名 = sanitizeFilePart(title) + "_" + docId + ".md"
// 以唯一 ID 消除同名文档冲突
const filename = `${sanitizeFilePart(title)}_${doc.id}.md`;
```

### 容错处理（批量操作时）
```typescript
for (const doc of docs) {
  try {
    await processDoc(doc);
  } catch (err) {
    console.warn(`⚠️  [${doc.slug}] 失败: ${(err as Error).message}，跳过继续`);
    failedList.push(doc.slug);
  }
}
console.log(`\n🏁 完成：${docs.length - failedList.length}/${docs.length} 成功`);
if (failedList.length > 0) {
  console.warn(`失败列表: ${failedList.join(', ')}`);
}
```
