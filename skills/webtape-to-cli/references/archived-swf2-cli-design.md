# 子工作流 2：CLI 命令设计 — 执行指导

## 输入信息

**必须入参**：
- 子工作流 1 产出的「接口规格文档」（核心接口清单 + 依赖关系 + 盲区决策表）

**软上下文参考**：
- cpu-cli-tool 已有命令目录列表（`ls cpu-cli-tool/src/commands/`）

## 目标要求

**任务**：基于接口规格文档，设计产品化的 CLI 命令结构。

**目标**：输出「命令设计文档」，能让编码 Subagent 仅凭此文档完成实现，无需再看接口规格文档。

**特性要求**：
- 命令名及所有子命令名已确定，无 TODO/待定字样
- 每个子命令的参数列表完整，类型和必填性明确
- 参数默认值中不出现任何录制时的特定数字 ID
- 写操作子命令有前置只读查询 + confirm 设计
- 含分页接口的子命令声明了三重终止条件字段来源
- **不做**：不写任何 TypeScript 代码，只输出设计文档

## 工作依据

### 环节 2.1：命令结构设计

**决策逻辑**：

| 场景 | 决策 |
|---|---|
| 目标站点已有命令（如 `yuque`） | 追加子命令到已有目录，复用 `init`/`finish`/`chromeFetch` |
| 全新站点 | 新建命令目录（用 `adc <cmdName>` 创建，记录到设计文档） |
| 2+ 段录制，多个接口共享 base URL | 设计 `config.ts` 提取公共配置 |
| 多个独立功能 | 设计命令族（子命令模式），各子命令独立文件 |

**命令名规范**：
- 全小写，短连接符分隔（如 `export-book`、`gray-confirm`）
- 子命令优先语义化动词（`list`/`get`/`create`/`deploy`/`confirm`）

---

### 环节 2.2：参数泛化设计

**对每个录制中的硬编码值，逐一分析转化方式**：

| 值的类型 | 转化策略 |
|---|---|
| 数字 ID（如 book_id=12345） | 转为必填 `--id <number>` 参数，无默认值 |
| URL（如站点 base URL） | 转为可选 `--base <url>` 参数，默认录制时的站点域名 |
| 分页参数（offset/limit） | 转为可选参数，默认合理值（如 `--limit 20`） |
| 过滤参数（如 action=Edit） | 转为可选参数，默认录制时的值 |
| 用户名/staffId | 转为可选参数，默认值可从环境变量读取 |

**URL 解析场景**（用户输入 URL 而非 ID 时）：
```
同时提供两条路径：
1. --url <完整URL>：自动解析 namespace → GET /api/repos/{namespace} → 提取 data.id
2. --id <number>：直传 ID，跳过解析（降级路径，当 --url 解析失败时使用）

namespace 含 / 时：直接字符串拼接到路径，不使用 encodeURIComponent
```

---

### 环节 2.3：写操作保护设计

对每个 POST/PUT/DELETE 接口，设计如下保护流程：

```
① 前置只读查询：调用对应的 GET 接口查询当前状态
② 状态校验：若状态不满足操作条件，打印原因后 process.exit(1)，不进入 confirm
③ 确认提示：inquirer.confirm({ message: '⚠️ 即将执行 <操作描述>，此操作不可撤销，确认继续？', default: false })
④ 用户取消（选 n）：打印「已取消」后 process.exit(0)
⑤ 用户确认：执行写操作
```

**特别注意**：若前置只读接口也无录制 → 该写操作子命令整体标注「待补录」，不实现。

---

### 环节 2.4：分页设计

对含分页的接口，声明以下字段来源：

```
终止条件字段来源：
- end 字段：响应 data.end（boolean）—— 若字段名不同，填写实际字段名；若不存在则标 N/A
- total 字段：响应 data.total（number）—— 若不存在则标 N/A
- pageSize：命令参数 --page-size 或 --limit 的值

三重终止：end === true || list.length < pageSize || fetchedSoFar >= (total ?? Infinity)
```

## 产出格式

```markdown
# 命令设计文档

## 命令概要
- 命令名：<cmdName>
- 追加到已有命令 or 新建：<追加到 yuque | 新建>
- 需创建 config.ts：<是/否>
- 需多子命令独立文件：<是/否>

## 子命令设计

### 子命令：<sub-command-name>
- **描述**：<一句话描述>
- **对应接口**：<Method> <URL>
- **实现策略**：<完整实现 / 推断实现 / 降级实现>

#### 参数列表
| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| --limit | number | 否 | 20 | 单页条数 |
| --all | boolean | 否 | false | 自动翻页到末尾 |
| --json | boolean | 否 | false | 输出 JSON 而非表格 |

#### 写操作保护（如有）
- 前置只读接口：<URL>
- 状态校验逻辑：<校验什么字段，不满足时如何退出>
- Confirm 提示文案：<⚠️ 即将执行 xxx>

#### 分页设计（如有）
- end 字段路径：<data.end | N/A>
- total 字段路径：<data.total | N/A>
- 页大小参数：<--limit 默认值>

---

## config.ts 设计（多段录制整合时）

```typescript
export const BASE_URLS = {
  main: "https://xxx.example.com/api",
  secondary: "https://yyy.example.com/api",
} as const;

export function buildCommonHeaders(): Record<string, string> {
  return { /* 公共 header，如 locale */ };
}
```

## 文件结构

```
src/commands/<cmdName>/
├── index.ts          ← 子命令注册入口
├── config.ts         ← 公共配置（多段录制时）
└── commands/
    ├── <sub1>.ts     ← 子命令实现（多子命令时）
    └── <sub2>.ts
```
```
