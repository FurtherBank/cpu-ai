---
name: behavior-log-audit
description: |
  WHAT：为工作流型 Skill 注入 BL-001 行为日志执行协议（初始化、增量更新、封口、子 Skill 返回契约）；供 s-workflow-sop 阶段七落盘时调用，或对已有 Skill 做 retrofit。
  WHEN：s-workflow-sop 编写/落盘 Workflow Skill 时；已有工作流 Skill 需接入可审计协议时；需校验某次行为日志是否符合 behavior-log/v1 时。
---

# behavior-log-audit

把 [BL-001 行为日志存放规范](references/behavior-log-v1-contract.md) 从「存放契约」落实为 **Skill 运行时薄执行协议**。本 Skill 是 s-workflow-sop 的**可审计插件**：工厂产出 Skill 时默认调用，不在每个业务 Skill 内复制 BL03 全文。

## 插件定位

| 角色 | 说明 |
| --- | --- |
| 共享协议 | `references/behavior-log-v1-contract.md` + `templates/behavior-log-skeleton.md` |
| 工厂消费方 | `s-workflow-sop` 阶段四～七引用本 Skill |
| 改造入口 | `workflow/retrofit-existing-skill.md` 用于已有 Skill |
| 落盘入口 | `workflow/inject-new-skill.md` 用于新 Skill |

## 工作模式

### 模式 A：注入新 Skill（s-workflow-sop 阶段七）

**Input**：目标 Skill 目录路径、阶段四节点质量标准草案、各阶段 Audit Hook 清单。

**Goal**：在 `SKILL.md` 写入「行为日志执行协议」节；在 `references/audit-quality-standards.md` 写入可比对质量标准；各阶段模板含 Audit Hook。

**Execution**：阅读 [workflow/inject-new-skill.md](workflow/inject-new-skill.md) 并按步骤执行。

### 模式 B：Retrofit 已有 Skill

**Input**：已有 Skill 目录（如 `skills/chatgpt-subject-purify/`）、本 Skill 的阶段列表与材料性触发点。

**Goal**：追加协议节、阶段 Audit Hook、子 Skill 返回格式；不破坏既有业务规则。

**Execution**：阅读 [workflow/retrofit-existing-skill.md](workflow/retrofit-existing-skill.md) 并按步骤执行。

### 模式 C：校验行为日志

**Input**：`.skill-logs/` 下某次执行的 Markdown 日志路径。

**Goal**：对照 behavior-log/v1 做结构/封口/子链自检，输出缺口清单。

**Execution**：阅读 [workflow/validate-log.md](workflow/validate-log.md) 并按步骤执行。

## 行为日志执行协议（写入目标 Skill 的固定片段）

目标 Skill 的 `SKILL.md` 须包含独立小节，内容以 [templates/skill-audit-protocol-snippet.md](templates/skill-audit-protocol-snippet.md) 为蓝本，并替换 `${...}` 占位符：

- `${skill-name}`：canonical skill name
- `${task-title-source}`：任务标题来源说明
- `${init-trigger}`：初始化时机（首次材料性行为前）
- `${increment-triggers}`：本 Skill 个性化增量触发点列表
- `${seal-condition}`：封口条件
- `${subagent-return-format}`：Subagent 返回格式

## Audit Hook 约定

工作流型 Skill 每个阶段须标注 **Audit Hook**（横切字段，非第五要素）：

| 执行模式 | Audit Hook |
| --- | --- |
| 主控执行 | 本阶段完成后须更新日志章节：`关键行为`、`影响清单`（若有材料性变更）、`结果与验证`（若完成验证） |
| Subagent 委派（显式 Skill） | 子 Skill 独立日志；返回 `{交付物, behaviorLogPath, 材料性影响摘要}` |
| Subagent 委派（纯 Task，无 Skill 身份） | 父日志「关键行为」一行摘要；不强制子文件 |

## 路径与身份（摘要）

```text
{workspaceRoot}/.skill-logs/<skill-slug>/yyyy-mm-dd/hhmm-<execution-suffix>.md
execution-id: BL-<started-at>-<skill-slug>-<execution-suffix>
```

`execution-suffix` = 任务标题 slug（非随机串）。详见 [references/behavior-log-v1-contract.md](references/behavior-log-v1-contract.md)。

## 与阶段制品的边界

- `.skill-logs/`：过程审计（怎么执行的）
- `.iteration/recordings-*`、`cpu-matrix/public/subjects/` 等：交付物（交付了什么）
- 日志通过「资源索引」链接制品路径，不复制制品正文

## 固定工作区

行为日志写入 **工作区根** `{workspaceRoot}/.skill-logs/`，与 Skill 定义目录（`.cursor/skills/`）分离。
