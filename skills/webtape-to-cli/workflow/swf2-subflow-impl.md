# 阶段二：子流程实现 — Subagent 执行指导

> 本文件由每个子流程的 Subagent 读取后独立执行。
> **每个 Subagent 只负责一个子命令**，只读对应的录制文件，只修改对应的 `.ts` 实现文件。

---

## 输入信息

**必须入参**（由主控在派发 Prompt 中填入）：
- `子命令名`
- `功能描述`
- `录制会话路径`：`webtape-workspace/recordings/<hostname>/<session>/`
- `实现文件路径`：`cpu-cli-tool/src/commands/<cmdName>/commands/<sub>.ts`
- `命令根入口`：`cpu-cli-tool/src/commands/<cmdName>/index.ts`
- `设计约束`（参数倾向、是否写操作、输出格式等）

---

## 执行流程

### 第一步：读懂录制（接口提炼）

遵循严格的**分层读取策略**（按层递进，能解决问题就不进下一层）：

**第 1 层（始终执行）**：
```bash
# 检查哪些文件存在及体积
ls -lh webtape-workspace/recordings/<hostname>/<session>/
```

- 存在 `analysis_report.md` → 全量读取（5~20KB，安全）
- 存在 `request.js` → 全量读取（2~5KB，安全）
- 从这两个文件提取接口清单初稿

**第 2 层（第 1 层信息不足时）**：
```bash
# _context.md ≤ 50KB → 全量读取
# _context.md > 50KB → 禁止全量读取，执行：
grep -n "^### " webtape-workspace/recordings/<hostname>/<session>/_context.md
grep -n "#### \[req_" webtape-workspace/recordings/<hostname>/<session>/_context.md
```

**第 3 层（需确认某接口请求/响应结构时）**：
- 定位并精确读取 `requests/req_xxxx.json` 和对应 `responses/res_xxxx.json`
- **不读 requests/ 或 responses/ 整个目录**

**噪音过滤三规则**（提炼时同步过滤）：
1. **域名过滤**：排除 `collect.*`/`log.*`/CDN/客服 widget 等域名
2. **类型过滤**：WebSocket/SSE 接口标记「已知限制」，寻找等价轮询接口
3. **频率过滤**：同 URL 出现 3+ 次 → 轮询/心跳，排除

提炼完成后，在实现文件顶部注释中写下接口摘要（作为代码文档）：

```typescript
/**
 * <sub-command>：<功能描述>
 *
 * 接口链路：
 * 1. GET /api/xxx — <业务用途>
 * 2. POST /api/yyy — <业务用途>（写操作，带 confirm）
 *
 * 数据依赖：接口1的 data.id → 接口2的路径参数
 */
```

---

### 第二步：信息完整性判断

对该子命令涉及的每个接口，判断录制覆盖情况：

| 情况 | 处置 |
|---|---|
| GET 接口有录制 | 完整实现 |
| GET 接口缺失，URL 规律明显 | 推断实现，代码注释：「推断自 REST 规律，非实录」 |
| POST/PUT/DELETE 接口缺失 | **不猜测**；返回「补录需求」给主控；保留 stub，不实现 |
| 分页终止字段不明确 | 使用三重终止保护，注释标注各字段来源 |

**若发现关键写操作缺口 → 立即停止实现此子命令**，返回给主控：
```
⚠️ 补录需求：<sub-command> 子命令

缺口：<接口描述>（Method: POST/PUT/DELETE）
- 需要录制的功能：<操作描述>
- 操作页面：<URL>
- 操作步骤：<步骤>
- 期望捕获接口形态：<URL 模式>（<Method>）
```

---

### 第三步：编码实现

**将接口调用实现写入指定文件**（`cpu-cli-tool/src/commands/<cmdName>/commands/<sub>.ts`）。

遵循以下编码规则（完整规则见 `.cursor/skills/webtape-to-cli/references/coding-rules.md`）：

**硬性规则**：
- TypeScript ESM 格式，本地 import 路径必须带 `.js` 后缀
- HTTP 请求只用 `chromeFetch`（`@cpu-utils/headless`）
- 命令代码中不得出现录制时的特定数字 ID 作为默认值
- 写操作必须有：前置只读状态查询 + `inquirer.confirm({ default: false })`
- 分页循环必须有三重终止：`end === true || list.length < pageSize || all.length >= (total ?? Infinity)`
- 401/403 统一提示：「请确认 Chrome 已登录 [hostname]，然后重试」

**实现结构模板**：

```typescript
// src/commands/<cmdName>/commands/<sub>.ts
/**
 * <sub-command>：<功能描述>
 * 接口链路：... （第一步写下的注释）
 */

import type { Command } from "commander";
import { chromeFetch } from "@cpu-utils/headless";
import { BASE_URL } from "../config.js";

// ── 接口调用函数 ────────────────────────────────────────────
async function fetch<Business>(params: {...}) {
  const url = `${BASE_URL}/api/...`;
  const res = await chromeFetch(url);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      console.error(`❌ 鉴权失败，请确认 Chrome 已登录 <hostname>，然后重试`);
      process.exit(1);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

// ── 命令注册 ────────────────────────────────────────────────
export function <sub>Command(program: Command): void {
  program
    .command("<sub-command-name>")
    .description("<功能描述>")
    .option("--base <url>", "站点根 URL", BASE_URL)
    // ... 其他参数
    .action(async (opts) => {
      // 业务逻辑实现
    });
}
```

---

### 第四步：自检

编码完成后，在该文件上运行局部类型检查（若环境支持）：

```bash
cd /Users/lrt/Desktop/ai-workspace/cpu-cli-tool && npx tsc --noEmit 2>&1 | grep "<sub>.ts"
```

若有错误，修复后重新检查，直到该文件无类型错误。

---

## 返回给主控的内容

```markdown
## <sub-command> 实现报告

### 状态
<完整实现 / 部分实现（含推断接口）/ 已返回补录需求>

### 已修改文件
- `cpu-cli-tool/src/commands/<cmdName>/commands/<sub>.ts`

### 实现的接口清单
| Method | URL | 业务用途 | 实现策略 |
|---|---|---|---|
| GET | /api/xxx | <描述> | 完整实现 |
| POST | /api/yyy | <描述> | 推断实现 |

### 参数列表（最终实现）
| 参数 | 类型 | 必填 | 默认值 |
|---|---|---|---|
| --limit | number | 否 | 20 |

### 录制缺口（若有）
<若有写操作缺口，在此列出补录需求；否则写「无」>
```
