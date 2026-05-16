> **声明**：该文档为本 skill 的设计规范，用于指导技能本身的迭代。技能正文（`SKILL.md`）及执行本 skill 时，禁止参照本文档内容。

---

# i-todo · Skill Design

> **路径根**：下文凡 `.iteration/` 路径均相对于 **Cursor 工作区根目录** `{workspaceRoot}`（studio 多仓顶层，与根级 `AGENTS.md`、`.cursor/` 同级），非各子项目 Git 根。

> 依据：[任务步骤四要素推导方法论](../s-workflow-sop/references/task-step-schema.md)

---

## 一、输入信息 (Input)

### 硬依赖（必须入参）

| #   | 信息                                  | 来源         |
| --- | ------------------------------------- | ------------ |
| 1   | 需求描述原文                          | 用户直接提供 |
| 2   | 需求类型（`bug` / `feature` / `rfc`） | 用户显式声明 |

---

## 二、目标职责 (Goal)

**状态变更 (Delta)**：
将「一条带显式类型声明的直接需求描述」推进到「本地 todo 项已格式化落盘，并立即触发对应出口技能」。

直接需求是独立于 dima 工单的本地输入轨道，无需经过 `i-dima-resolve` 研判阶段，由 `i-todo` 在写入时直接确认类型并路由到对应出口技能。

**路由规则**：

| 类型      | 出口技能         | 后续路径                                                    |
| --------- | ---------------- | ----------------------------------------------------------- |
| `bug`     | `i-bug`          | 定位 → 修复                                                 |
| `feature` | `i-spec-feature` | 变更规划 → `i-spec-execute` → `i-verify`                    |
| `rfc`     | `i-spec-design`  | 设计方案 → `i-spec-feature` → `i-spec-execute` → `i-verify` |

> 直接需求与 dima 需求共享「设计方案 → 变更规划 → 研发编码 → 测试验收」的完整后置流程，差异仅在前置入轨方式：dima 经研判后入轨，直接需求由 `i-todo` 在创建时即完成类型确认与路由。

**完成判定 (Done Predicate)**：

当且仅当以下全部条件满足时判定完成：

- P1. `{workspaceRoot}/.iteration/todo/` 下已写入 `{emoji}{id}.json`，文件名前缀 emoji 与初始状态（待处理 📋）一致
- P2. JSON 内容包含需求描述原文、类型声明、创建时间
- P3. 已按类型路由，出口技能已触发

**不做什么（Negative Prompts）**：

- 不与 `i-dima-resolve` 研判路径混用
- 不对需求类型进行自动推断（类型必须由调用方显式声明）
- 不执行需求本身的开发或修复工作（由出口技能负责）

---

## 三、工作依据 (Guidance)

**物理形态约定**：

- 目录：`{workspaceRoot}/.iteration/todo/`
- 文件名：`{emoji}{id}.json`
- 状态 emoji 语义（与 dima 工单对齐）：待处理 📋 / 执行中 🔄 / 已完成 ✅ / 已取消 🚫
- 状态变更时文件名前缀随之更换

---

## 四、执行模式 (Execution Mode)

**判定结论：主控执行**（格式化落盘 + 路由触发，无需 subagent）

**判定依据**：

- 任务为简单的格式化落盘与路由分发，无需探索代码库
- 需求类型由调用方显式声明，主控直接匹配路由规则

**调用方式**：

由用户或编排层直接触发，附带需求描述和类型声明：

```
创建直接需求 todo，类型：{bug|feature|rfc}
需求描述：{原文}
请按照 .cursor/skills/i-todo/SKILL.md 执行
```

产出文件路径约定：`{workspaceRoot}/.iteration/todo/{emoji}{id}.json`
