---
name: weavefox-openapi-e2e
description: Weavefoxinfra OpenAPI script-style E2E — the canonical workflow for writing and running closed-loop /v1/* tests under weavefoxinfra/openapi-e2e-test (real HTTP via chromeFetch). Aligns with weavefoxinfra AGENTS.md. One .ts entry per flow; config only in config.ts; logs under openapi-e2e-test/logs/<ISO-timestamp>-<script>.log. Use when implementing or running infra OpenAPI E2E, validating chair OpenAPI, or when AGENTS points to this skill.
---

# Weavefox OpenAPI 端到端交互测试

## 与 weavefoxinfra 的关系

- **本 Skill 是 weavefoxinfra 侧「OpenAPI 脚本式 E2E」的规约入口**：编写、评审、运行均在 **`weavefoxinfra/openapi-e2e-test/`** 下进行，与 **`chair-bin test`**（`test/` 下 Egg 单测）**相互独立**，不得混为一谈。
- **仓库人类文档**：**`weavefoxinfra/AGENTS.md`**「OpenAPI 脚本式 E2E」小节与本 Skill **交叉引用**；目录级细则 **`openapi-e2e-test/AGENTS.md`**，安装步骤 **`openapi-e2e-test/README.md`**。
- **工作区路径**：若从 weavefox 多仓根打开，目录为 **`weavefoxinfra/openapi-e2e-test/`**；下文凡写 `openapi-e2e-test/` 均指 **weavefoxinfra 仓库内**该路径（当前工作目录需已 `cd` 到该目录，或命令中显式 `cd openapi-e2e-test`）。

## 适用场景

- 在 **weavefoxinfra** 开发或改动开放平台 **`/v1/*`** 时，需要对 **完整链路** 做可重复验收：在 `openapi-e2e-test/` **新增或修改**脚本式用例（非 Jest/Mocha、非 `test/` 内嵌 mock）。
- 需要验证**完整链路是否可用**，并对**响应形态与业务约束**做**单测级别**校验（而非仅打印成功日志）。
- 本地调试时直连 **Chair**（OpenAPI 承载服务），并需**先确认服务就绪**（通常由仓库根 **`npm run dev`** 启动）。

## 流程说明规范（编写与参照）

以下约定适用于 `openapi-e2e-test/` 下所有脚本式用例，**编写新测试与查阅既有用例时均须遵守**。

| 要求 | 说明 |
| --- | --- |
| **单一来源** | 每条用例的**具体执行步骤、调用的接口路径、校验点、环境变量/前置条件、推荐运行命令**，以**该入口 `.ts` 文件顶部块注释**为唯一权威（Single Source of Truth）。 |
| **编写** | 新增或显著变更流程时，**先更新文件头注释，再改实现**；禁止代码与头注释长期不一致。 |
| **参照** | 评审、复用、向他人说明「某脚本怎么跑」时，**以目标脚本文件头为准**；本 Skill 与其他文档只写**共性**（目录、HTTP 封装、断言风格、日志等），**不**逐条维护各用例的长流程，以免与代码漂移。 |
| **AI** | 在 `openapi-e2e-test` 下改/写用例时，以文件头为规约；需要描述某条用例行为时，**概括或引用其文件头**，不依赖本 Skill 中的用例级摘要（本 Skill 不提供此类摘要）。 |

## E2E 配置设计（`config.ts` 与用例边界）

| 要求 | 说明 |
| --- | --- |
| **通用配置唯一出口** | 与「连哪套环境、用什么身份、全局超时/重试」相关的项，**只在** `openapi-e2e-test/config.ts` 维护一份（如 **`host`（仅 origin）**、`authToken`、`workId`、`timeout`、`maxRetries` 等）；**`/api/open/v1/...` 路径写在各测试脚本的调用处**。环境变量覆盖方式以 `config.ts` 为准。 |
| **禁止业务向可调配置** | 不在 `config.ts`、也不在环境变量中维护**业务语义**类开关或泛化入参（例如用 env 切换两种 prompt、两种 query 组合、是否走某分支）。 |
| **多场景 = 多入口文件** | 若要对**不同**业务入参或流程做验证，应新增**独立的入口 `.ts`**，在各文件内写死该用例的请求与步骤；不得以「一个脚本 + 多个 env」模拟多套业务用例。 |

更完整的目录级说明见 **`weavefoxinfra/openapi-e2e-test/AGENTS.md`**。

## 代码位置与约束

| 项          | 说明                                                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目录        | **weavefoxinfra** 仓库内 **`openapi-e2e-test/`**（与主应用源码并列；依赖安装见该目录 **`README.md`**）。                                                                                     |
| 单文件      | **一个文件对应一个闭环流程**；流程内通过 `config.ts` 引用环境与连接类配置；**不要求**用户在运行时交互输入 query、path 或 body（测试内可写死分页如 `page=1&pageSize=20`）。业务专属常量写在**该用例文件**内，见上节「E2E 配置设计」。 |
| HTTP 客户端 | 使用 `@cpu-utils/headless` 的 `chromeFetch`（经 `lib/openapi-fetch.ts` 统一封装）。                                                                                                     |
| 成功判定    | HTTP 200 且 `data.code === 200` 或 `data.code === 0`（与 `fetchOpenApiJson` 一致）。                                                                                                    |

## 公共模块（`openapi-e2e-test/lib/`）

| 文件                  | 职责                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `openapi-fetch.ts`    | `generateRequestId`、`fetchOpenApiJson`（path/query/body、Header、超时、业务 code、日志）           |
| `log.ts`              | `logRequest` / `logResponse` / `logError`                                                           |
| `check.ts`            | `createCheckSuite()` → `{ check, getFailedCount, exitIfFailed }`，失败时 `process.exit(1)`          |
| `console-file-log.ts` | 将本次进程 **stdout/stderr 完整输出** 镜像到 `logs/`（见下节「运行日志落盘」）；由 `config.ts` 侧载 |

列表类、单测风格脚本应优先使用上述模块；**全链路 POC**（`openapi-test.ts`）含重试、SSE、特殊日志时可自行 `chromeFetch`，但可复用 `generateRequestId`。

## 运行日志落盘（`openapi-e2e-test/logs`）

每次执行 `npx tsx <脚本>.ts`（或 `package.json` 中等价命令）时，控制台完整输出会落盘到：

`openapi-e2e-test/logs/<测试开始时间戳>-<入口脚本文件名（无扩展名）>.log`（文件名形如 `2026-04-13T08-30-00-123Z-list-tasks-test.log`）

日志会记录交互测试执行过程中的所有输出，包含：

- 接口调用完整的请求体/响应

## 编写流程（优化后的推荐顺序）

1. **文件头注释（必做，且符合「流程说明规范」）**：写清流程步骤（调哪些接口）、**校验点**（字段、排序、分页、跨接口一致性）、运行命令；**这是本条用例文档与参照的规范入口**。
2. **抽取复用**：新用例优先 `import { fetchOpenApiJson } from "./lib/openapi-fetch"` 与 `import { createCheckSuite } from "./lib/check"`；校验写在接收 `check: CheckFn` 的纯函数中，**不要**再复制整段 `chromeFetch`。
3. **断言标准（单测级别）**：
   - 使用 `createCheckSuite()` 的 `check(label, pass, detail?)`，主流程末尾调用 `exitIfFailed()`。
   - **失败必须导致非零退出**：不要仅打印 `❌` 仍以 0 退出。
   - **空列表**：区分「无数据跳过部分断言」与「应有数据却为空」——在注释里写清业务假设；若必须依赖数据，无数据时应 **fail** 或 **skip 并 exit 0 且明确标注**（二选一，不要混用）。
4. **跨接口一致性**：若流程是「列表 → 取第一项 → 详情/子资源」，必须校验 **路径参数与响应中的 id 一致**（参考 `list-deployments-test.ts` 中 siteId 交叉校验）。
5. **入口**：`async function main()` + `main().catch(...); process.exit(1)`；顶层禁止「吞掉错误」。

## 与现有示例

`openapi-e2e-test/` 目录下已有若干入口脚本可供风格参考；**细节一律见各文件头部注释**（见「流程说明规范」）。

## 如何运行测试

本地测试：

- `tsx ${测试文件ts}`

预发测试：

- **cenv 与 `eval`（必读）**：`cenv` 的实现只向 **stdout 写出** `export VAR=value` 等 shell 语句，**不会**自动改当前进程环境。若仅执行 `cenv infraapi` 或与后续命令用 `&&` 拼接却**未**经 `eval`，变量不会对子进程（如 `npx tsx`）生效。必须先 **在同一 shell 中** 执行  
  `eval "$(cenv infraapi)"`  
  再于 **weavefoxinfra 仓库根** 执行 `cd openapi-e2e-test && npx tsx ${测试文件ts}`（对变量值含空格或特殊字符时，`"$(...)"` 比 `$(...)` 更安全）。
- 取消预发环境变量：`eval "$(cenv unset infraapi)"`

## 禁止事项

- 不要在根目录 `weavefox` 误跑 `npm install`；**openapi-e2e** 依赖安装见 **`openapi-e2e-test/README.md`**（须在该目录使用 **npm**）；主应用与其它子项目仍按 **`weavefoxinfra/AGENTS.md`** 与既有约定。
- **勿**将脚本式 OpenAPI E2E 放进 `test/` 或期望 **`npm run test` / `chair-bin test`** 执行；E2E 仅在 `openapi-e2e-test/` 用 **`npx tsx`**（或 `package.json` 中脚本）运行。
