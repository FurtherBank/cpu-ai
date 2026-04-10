# 排雷指南：常见陷阱与应对手册

## 类型一：信息缺失

### 陷阱 1.1：录制缺少关键步骤

**识别信号**：
- 核心业务链路中，某个写操作（POST/PUT）的接口在录制中完全没有
- 接口依赖关系中，某个「获取 ID」类前置 GET 接口也没有录制

**预防措施**（步骤 1 摸底时）：
- 摸底时即评估录制会话数与目标功能步骤数是否匹配
- 步骤 4 盲区评估时，逐一检查每个核心链路步骤

**处理路径**：
- GET 接口缺失但有 REST 规律 → 推断实现，代码注释标注
- POST/PUT/DELETE 缺失 → **绝对禁止猜测**；生成补录提示，暂停流程
- 补录提示必须包含：功能描述 + 操作页面 URL + 操作步骤 + 期望捕获接口模式

---

### 陷阱 1.2：analysis_report.md 缺失

**识别信号**：会话目录中没有 `analysis_report.md` 文件

**处理路径**：切换到分段读取 `_context.md` 模式：
1. `grep -n "^### " _context.md` → 时间线节点列表
2. `grep -n "#### \[req_" _context.md` → 接口 URL 概览
3. 按需读单个 `requests/req_xxxx.json` + `responses/res_xxxx.json`

---

## 类型二：工具能力边界

### 陷阱 2.1：WebSocket/SSE 接口

**识别信号**：`requests/req_xxx.json` 中 `"type": "websocket"` 或 `"type": "sse"`

**处理路径**：
1. 寻找等价 REST 轮询接口（通常为 `GET /api/flow/{id}` 或 `GET /api/task/{id}/status`）
2. 实现带超时的轮询（默认超时 120s，5s 间隔）
3. 若无等价接口，在命令 `--help` 说明中注明「不支持实时推送」

**绝不要做**：用 `chromeFetch` 尝试发 WebSocket 请求（会直接报错）

---

## 类型三：外部依赖不可控

### 陷阱 3.1：鉴权失败

**识别信号**：运行时返回 HTTP 401 或 403

**处置方式**：
- 这是前置条件问题，**不是代码 Bug**
- 统一错误提示：「请确认 Chrome 已登录 [hostname]，然后重试」
- 无需修改代码，让用户处理后重新执行命令

### 陷阱 3.2：多段录制接口版本差异

**识别信号**：不同会话的 `request.js` 中同一功能的 URL 路径不同

**处置方式**：
- 以**最新录制时间戳**的会话为准
- 旧版本的接口路径在代码注释中保留：`// 旧版路径（0320 录制）: /api/v1/xxx`

### 陷阱 3.3：请求头遗漏导致 403

**识别信号**：接口返回 403，但 Cookie 已登录（chromeFetch 鉴权正常的其他接口可访问）

**处置方式**：
1. 精确读取录制中该接口的 `requests/req_xxxx.json`
2. 对比录制 headers 与当前实现，找出缺失的非标准 header
3. 常见的「隐藏 header」：`x-xxx-auth-preflight`、`x-resource-id`、`x-biz-token`
4. 在 `chromeFetch` 调用中补充缺失 header

---

## 类型四：逻辑死锁

### 陷阱 4.1：分页死循环

**识别信号**：命令卡住不退出，或 CPU 持续占用

**预防方式**（三重终止保护）：
```typescript
if (end || list.length < pageSize || all.length >= (total ?? Infinity)) break;
```

**如果 end 和 total 都不存在**：`list.length < pageSize` 作为最终兜底。  
注意：如果 API 恒定返回 `pageSize` 条（即使是最后一页），这个兜底会失效 → 此时必须用 `total` 字段，或为命令添加 `--max-pages` 安全上限参数。

### 陷阱 4.2：文件名冲突（批量导出）

**预防方式**：文件名追加唯一 ID
```typescript
const filename = `${sanitizeFilePart(title)}_${doc.id}.md`;
```

### 陷阱 4.3：URL namespace 被错误编码

**识别信号**：API 返回 404，URL 中出现 `%2F`

**根因**：`encodeURIComponent('my-group/my-book')` 会把 `/` 编码为 `%2F`

**修复**：namespace 直接字符串拼接，不经过 `encodeURIComponent`：
```typescript
const url = `${base}/api/repos/${namespace}`;  // namespace = "my-group/my-book"
```

---

## 类型五：编码质量问题

### 陷阱 5.1：硬编码 ID 泄漏

**识别信号**：代码中出现 8 位以上的数字字面量作为参数默认值或函数入参

**预防**：编码完成后，搜索代码中所有数字字面量（`/\b\d{6,}\b/`），确认无录制 ID 残留

**修复**：改为必填参数，无默认值

### 陷阱 5.2：ESM import 路径缺少 .js 后缀

**识别信号**：`tsc --noEmit` 通过，但运行时报 `Cannot find module './utils'`

**修复**：所有本地 import 路径改为 `.js` 后缀

```typescript
// ❌
import { foo } from "./utils";
// ✅  
import { foo } from "./utils.js";
```
