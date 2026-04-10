# 命令设计文档模板

> 此文档由子工作流 2 产出，作为子工作流 3（编码 Subagent）的唯一输入。

## 命令概要

- **命令名**：`<cmdName>`
- **命令位置**：`src/commands/<cmdName>/`
- **操作类型**：追加子命令到 `<已有命令名>` / 新建命令目录
- **目标站点**：`<hostname>`
- **需要 config.ts**：是 / 否
- **需要子命令独立文件**：是 / 否

---

## 子命令设计

### 子命令：`<sub-command-name>`

**描述**：<一句话功能描述>

**对应接口**：`<Method> <URL>`

**实现策略**：✅ 完整实现 / 🔮 推断实现 / ⬇️ 降级实现

#### 参数列表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `--base` | string | 否 | `https://<hostname>` | 站点根 URL |
| `--limit` | number | 否 | 20 | 单页条数 |
| `--all` | boolean | 否 | false | 自动翻页至末尾 |
| `--json` | boolean | 否 | false | 输出 JSON |

> 注：若有 URL 解析路径，同时提供 `--url <完整URL>` 和 `--id <number>` 两个参数。

#### 写操作保护（仅 POST/PUT/DELETE 接口）

- **前置只读接口**：`GET <URL>`
- **状态校验字段**：`data.status`，期望值：`READY`；不满足时：打印状态后 `process.exit(1)`
- **Confirm 提示文案**：`⚠️ 即将执行「<操作描述>」，此操作不可撤销，确认继续？`

#### 分页设计（仅分页接口）

- **end 字段路径**：`data.end`（boolean）/ N/A
- **total 字段路径**：`data.total`（number）/ N/A
- **页大小参数**：`--limit`，默认 20
- **三重终止**：`end === true || list.length < pageSize || all.length >= (total ?? Infinity)`

---

*(根据子命令数量复制以上结构)*

---

## config.ts 设计（多段录制整合时）

```typescript
// src/commands/<cmdName>/config.ts

export const BASE_URLS = {
  main: "https://xxx.example.com/api",
  // 若有多个 base URL
} as const;

export function buildCommonHeaders(): Record<string, string> {
  return {
    locale: "zh_CN",  // 从录制中提取的公共 header
  };
}
```

---

## 文件结构

```
src/commands/<cmdName>/
├── index.ts              ← commander.js 子命令注册入口
├── config.ts             ← 公共配置（如需）
└── commands/
    ├── <sub1>.ts         ← 子命令1实现（如需）
    └── <sub2>.ts         ← 子命令2实现（如需）
```

---

## 复用检查清单

编码 Subagent 请在开始前检查以下复用点：

- [ ] `src/commands/<已有命令>/index.ts` — 是否可追加子命令？
- [ ] `@cpu-utils/headless` — `chromeFetch` 已安装？
- [ ] `../../core/init.js` / `../../core/finish.js` — 命令生命周期工具
- [ ] 已有命令中的工具函数（`sanitizeFilePart`、`dedupeByTargetId` 等）
