
# PoC（概念验证实验）

## 1. 技能描述

本流程用于在 `i-spec-design` 正式定稿前，对高风险、不确定、缺少外部信息支撑的技术点进行低成本实验验证。PoC 的目标不是实现生产代码，而是把「难以直接判断」的问题转化为可观测证据，并将结论回写到设计文档与 `references/`。

触发原则：当某个关键设计判断难以直接判断最终结论，且没有更多外部信息可支撑判断时，可以直接尝试 PoC。若该判断影响 scope 边界、数据模型、API 契约、关键技术选型、迁移策略、发布/回滚策略或第三方兼容性，应执行 PoC 或在设计中明确写出不执行 PoC 的理由。

PoC 支持两种模式：

- `independent`：独立实验，不需要修改目标项目代码。
- `dependent`：依赖目标项目上下文，需要在目标仓库单独 PoC 分支中修改代码并推送为直接交付产物。该分支只用于设计验证，不合并到迭代分支、主分支或生产代码。

## 2. 输入参数

- `design_root`: 当前设计制品根目录，例如 `{workspaceRoot}/.iteration/recordings-design/[042] 订单状态机改造/`。
- `poc_name`: 实验名称，英文短横线命名 (例如 `verify-sql-parsing`)。
- `mode`: 实验模式。
    - `independent`: 独立实验（不需要项目上下文）。
    - `dependent`: 依赖实验（需要在项目代码库中修改）。
- `goal`: 实验要回答的核心问题。
- `scope_id`: 该 PoC 支撑的 scope；若支撑多个 scope，列出全部 scope id。
- `design_decision`: 该 PoC 将支撑或否定的设计判断。
- `codebase_path`: 仅 `dependent` 模式需要，目标仓库根路径。

## 3. 执行流程 (Workflow)

### 3.1 实验环境准备 (Setup)

**分支逻辑 A: 独立实验 (Mode: independent)**

- **适用场景**：验证纯算法、新库基本用法、正则匹配、协议格式转换等不依赖项目运行态的技术点。
- **动作**：
  1. 在设计制品根目录下创建实验目录：`{design_root}/pocs/{poc_name}/`。
  2. 初始化实验环境（如创建 venv、package.json 等，视具体语言而定）。
  3. 将实验代码、输入样本、运行脚本都放在该目录内，避免污染目标仓库。

**分支逻辑 B: 依赖实验 (Mode: dependent)**

- **适用场景**：验证老代码兼容性、集成测试、框架扩展点、已有模块改造可行性、真实运行环境限制。
- **动作**：
  1. 进入 `codebase_path`，先阅读目标仓库 `AGENTS.md` 及其引用的操作约定；后续命令、分支、提交、推送、清理均按目标仓库实际要求执行。
  2. 记录原始 Git 状态：当前分支、当前 commit、remote、工作区是否干净。若存在未提交改动，按 `AGENTS.md` 与当前任务边界处理；不得覆盖或回滚用户已有改动。
  3. 基于当前允许的基准分支或当前工作分支创建独立 PoC 分支，建议命名：`poc/{date}-{poc_name}`。不要假设基准分支一定是 `master` 或 `main`。
  4. 在 PoC 分支上进行实验修改。该分支是设计验证交付物，不会合并到迭代分支、主分支或生产代码。

### 3.2 实验执行 (Execution)

**动作**：编写并运行验证代码。

- **编写**：
  - `independent`：在 `{design_root}/pocs/{poc_name}/` 下创建代码文件、样本和脚本。
  - `dependent`：在 PoC 分支上修改项目源码、添加临时脚本或临时测试用例。
- **运行**：执行验证命令，并捕获命令、环境版本、输入样本、标准输出、错误日志、返回值和关键截图/链接（如适用）。
- **提交与推送**：
  - `independent`：实验代码自然保存在设计制品目录。
  - `dependent`：实验结束后，按目标仓库 `AGENTS.md` 要求提交并推送 PoC 分支。commit message 应清楚标识 `POC: {poc_name}`，并在报告中记录分支名、commit hash、remote URL。若仓库对 commit message 有额外要求，以仓库要求为准。

### 3.3 结果记录与清理 (Reporting & Cleanup)

**动作**：根据模板生成 PoC 报告，并恢复本地工作状态。

**报告生成路径**:

- `independent`: `{design_root}/pocs/{poc_name}/POC.md`
- `dependent`: `{design_root}/pocs/{poc_name}/POC.md`（实验代码在远端 PoC 分支中，设计制品目录只保留报告、摘要和必要摘录）

**清理动作（仅 dependent）**：

- 按目标仓库 `AGENTS.md` 与当前分支策略恢复本地工作状态。
- 回到实验前记录的原始分支或工作状态；不要默认切回 `master`。
- 本地 PoC 分支是否保留由仓库约定和当前交付需要决定；若删除，必须确认远端分支和报告已可追溯。
- 清理只针对本次 PoC 产生的临时本地状态，不得删除用户已有改动、其它任务分支或未归属文件。

### 3.4 结果回写

PoC 完成后必须回写设计制品：

1. 在制品根目录 `references/` 中登记 PoC 条目，写清报告路径、分支/commit（如有）、支撑或否定的设计判断、关联 scope id。
2. 在对应 scope 的 `design.md` 中引用 PoC 结论，并说明该结论如何影响设计。
3. 若 PoC 结论为阻塞或需降级处理，必须更新总览 `design.md` 的全局风险、scope 风险或后续规划输入。

## 4. PoC 报告应包含什么

PoC 报告是设计判断的证据，不是单纯日志归档。它必须让后续规划或评审者不用重跑实验，也能理解：验证了什么、如何验证、看到什么、结论如何影响设计。

报告必须包含以下内容：

- **元信息**：PoC 名称、日期、执行者、模式、关联 scope id、关联设计判断、报告路径。
- **触发原因**：为什么需要 PoC；如果不验证，哪个设计判断会悬空或有哪些风险。
- **待验证假设**：用可判定语句描述，例如“库 A 在当前 Node 版本下能解析格式 B 并保持字段 C 不丢失”。
- **实验环境**：仓库路径、分支、commit、运行环境版本、关键依赖版本、配置或外部服务前提。
- **实验设计**：输入样本、操作步骤、命令、预期观测、通过/失败判据。
- **执行记录**：关键命令、输出、错误日志、返回值、截图或链接（如适用），并区分客观观测与执行者判断。
- **分支与代码产物**：`dependent` 模式须记录远端 PoC 分支、commit hash、核心改动摘要；`independent` 模式须记录实验目录和核心文件。
- **结论**：状态只能是 `通行` / `阻塞` / `需降级处理`；必须说明结论依据。
- **设计影响**：明确写出该 PoC 对全局方案、scope 设计、约束、风险、实施顺序或后续规划输入的影响。
- **残留风险**：哪些场景未覆盖、哪些外部条件仍未验证、是否需要用户确认或后续测试补充。
- **回写记录**：列出已更新或应更新的 `references/` 条目与 scope 文档位置。

## 5. 报告标准模板 (Report Template)

无论是哪种模式，生成的 Markdown 文件必须包含以下内容：

```markdown
# PoC 实验报告: {poc_name}

> **日期**: YYYY-MM-DD
> **模式**: {mode}
> **关联 scope**: {scope_id}
> **关联设计判断**: {design_decision}
> **相关资源**: {Branch Name + Commit Hash 或 Folder Path}

## 1. 实验目的 (Why)

- **触发原因**:
- **待验证假设**:
- **风险点**:
- **通过/失败判据**:

## 2. 实验环境 (Environment)

- **仓库 / 目录**:
- **分支 / Commit**:
- **运行环境版本**:
- **关键依赖版本**:
- **配置或外部服务前提**:

## 3. 实验设计与执行过程 (Process)

### 步骤 1 - <步骤标题>

- **操作**:
- **命令**:
```text
<command>
```
- **输入样本**:
- **预期观测**:
- **实际输出 / 日志**:
```text
<stdout / stderr / return code>
```
- **本步判断**:

## 4. 代码产物 (Artifacts)

- **模式**: {mode}
- **远端 PoC 分支 / Commit**: {仅 dependent}
- **实验目录 / 核心文件**: {仅 independent}
- **核心改动摘要**:

## 5. 最终结论 (Conclusion)

- **状态**: 通行 / 阻塞 / 需降级处理
- **结论依据**:
- **设计影响**:
- **残留风险**:
- **后续建议**:

## 6. 回写记录 (Write-back)

- **references 条目**:
- **scope 设计引用位置**:
- **总览 design.md 更新位置**:
```

## 6. 输出产物清单

1. **PoC 报告文件**：`{design_root}/pocs/{poc_name}/POC.md`。
2. **代码产物**：
   - `independent`：设计制品目录中的实验代码、样本和脚本。
   - `dependent`：远端 PoC 分支和 commit。
3. **references 回写**：`references/` 中有可追溯 PoC 条目。
4. **设计回写**：对应 scope `design.md` 已引用 PoC 结论。
5. **结论元数据**：返回简单 JSON 供上层 Skill 判断，例如：

```json
{
  "status": "pass | blocked | fallback_required",
  "risk_level": "low | medium | high",
  "report_path": "{design_root}/pocs/{poc_name}/POC.md",
  "scope_ids": ["<scope-id>"],
  "branch": "poc/{date}-{poc_name}",
  "commit": "<commit-hash>"
}
```
