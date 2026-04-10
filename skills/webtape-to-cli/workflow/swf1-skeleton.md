# 阶段一：命令骨架建立 — 执行指导

## 输入信息

**必须入参**：
- 命令名（`<cmdName>`）
- 子流程列表（名称 + 功能描述 + 对应录制会话路径）
- 命令设计意图（参数倾向、输出格式等，可选）

## 目标要求

**任务**：在 cpu-cli-tool 中建立命令目录结构，为每个子流程创建 stub 文件，并产出供阶段二并行派发的「子流程派发清单」。

**目标**：骨架创建完毕后，`index.ts` 可通过 `tsc --noEmit`（stub 文件合法），各子命令文件已就位。

**特性要求**：
- 每个子命令有独立文件（`commands/<sub>.ts`），便于 Subagent 并行修改，互不干扰
- `index.ts` 中每个子命令调用处标注 `// TODO: 由子流程 Subagent 实现`
- **不做**：不实现任何业务逻辑，stub 文件只包含函数签名和 TODO 注释

## 工作依据

### 步骤 1：确认命令目录状态

```bash
ls cpu-cli-tool/src/commands/
```

- 若目标命令目录**不存在** → 执行 `adc <cmdName>`（自动创建模板并注册到全局）
- 若目标命令目录**已存在** → 说明是向已有命令追加子命令，在 `index.ts` 中追加注册

---

### 步骤 2：规划目录结构

根据子流程数量，确定是否需要子命令独立文件：

```
src/commands/<cmdName>/
├── index.ts           ← 统一注册入口（commander.js）
├── config.ts          ← 公共 base URL（若所有子命令共享同一站点）
└── commands/
    ├── <sub1>.ts      ← 子命令1 stub（一个子流程一个文件）
    ├── <sub2>.ts      ← 子命令2 stub
    └── ...
```

**单子命令时**（仅 1 个子流程）：可直接在 `index.ts` 内实现，不需要 `commands/` 子目录。

---

### 步骤 3：创建 config.ts（若多子命令共享站点）

```typescript
// src/commands/<cmdName>/config.ts
export const BASE_URL = "https://<hostname>";

// 从录制中提取的公共 header（若有），否则删除此函数
export function buildCommonHeaders(): Record<string, string> {
  return {};
}
```

---

### 步骤 4：创建每个子命令的 stub 文件

每个 `commands/<sub>.ts` 的 stub 格式：

```typescript
// src/commands/<cmdName>/commands/<sub>.ts
// TODO: 由子流程 Subagent 实现
// 功能：<用户提供的功能描述>
// 对应录制：webtape-workspace/recordings/<hostname>/<session-dir>/

import type { Command } from "commander";
// import { chromeFetch } from "@cpu-utils/headless";
// import { BASE_URL } from "../config.js";

export function <sub>Command(program: Command): void {
  program
    .command("<sub-command-name>")
    .description("<功能描述>")
    // TODO: 补充参数定义
    .action(async (_opts) => {
      // TODO: 实现业务逻辑
      throw new Error("尚未实现：请运行子流程 Subagent 完成此命令");
    });
}
```

**要点**：stub 文件必须能通过 TypeScript 类型检查（所有 import 注释掉，函数签名合法）。

---

### 步骤 5：更新 index.ts 注册所有子命令

```typescript
// src/commands/<cmdName>/index.ts
#!/usr/bin/env node

import { Command } from "commander";
import { <sub1>Command } from "./commands/<sub1>.js";  // TODO: 由子流程 Subagent 实现
import { <sub2>Command } from "./commands/<sub2>.js";  // TODO: 由子流程 Subagent 实现

const program = new Command();
program
  .name("<cmdName>")
  .description("<站点功能描述>")
  .version("1.0.0");

<sub1>Command(program);
<sub2>Command(program);

program.parse();
```

---

### 步骤 6：编译校验骨架

```bash
cd /Users/lrt/Desktop/ai-workspace/cpu-cli-tool && npx tsc --noEmit
```

若骨架编译失败（通常是 stub 文件语法错误），修复后重新校验，不得带编译错误进入阶段二。

---

### 步骤 7：产出「子流程派发清单」

输出 Markdown 表格，供主控在阶段二依次填入派发 Prompt：

```markdown
## 子流程派发清单

| 子命令 | 功能描述 | 录制会话路径 | 实现文件 | 设计约束 |
|---|---|---|---|---|
| <sub1> | <功能描述> | recordings/<hostname>/<session1>/ | commands/<sub1>.ts | <从用户输入提取的约束> |
| <sub2> | <功能描述> | recordings/<hostname>/<session2>/ | commands/<sub2>.ts | <从用户输入提取的约束> |

**暂无录制的子命令**（跳过阶段二，保留 stub）：
- <sub3>：待录制
```

## 产出物清单

完成本阶段后，主控确认以下内容存在：

- [ ] `cpu-cli-tool/src/commands/<cmdName>/index.ts`（含所有子命令注册）
- [ ] `cpu-cli-tool/src/commands/<cmdName>/config.ts`（若多子命令）
- [ ] `cpu-cli-tool/src/commands/<cmdName>/commands/<subN>.ts` × N
- [ ] 骨架通过 `tsc --noEmit`
- [ ] 子流程派发清单已输出
