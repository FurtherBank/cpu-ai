# i-verify 工具链规格要求

## 概述

`i-verify` 技能在执行过程中依赖以下工具链。本文档定义各工具的**规格要求**，供工具链建设参考。实现细节由各仓库或平台侧按规格自行提供，i-verify 技能本身不内置具体实现。

---

## 核心工具清单

### git

**用途**：基线同步、diff 范围计算、commit 操作、分支管理

**必须支持的命令**：
- `git fetch origin`
- `git rebase origin/<branch>`
- `git diff <base>...<HEAD> --name-only`
- `git log --oneline <base>...HEAD`
- `git status`
- `git branch --show-current`
- `git stash` / `git stash pop`

**实现状态**：✅ 标准 git，无需额外实现

---

### gh（GitHub CLI）

**用途**：PR 管理、CI 状态查询、代码评审评论读取

**必须支持的命令**：
- `gh pr list --head <branch> --state all --json number,state,url`
- `gh pr view <number> --json state,reviews,comments,statusCheckRollup`
- `gh pr checks <branch>`
- `gh run view <run-id> --log-failed`
- `gh pr merge <number> --squash|--merge|--rebase`

**实现状态**：✅ 官方 GitHub CLI，需配置 `GH_TOKEN` 认证

**替代方案**（非 GitHub 仓库）：

> 若仓库使用 GitLab / Gitee / 内部平台，需提供同等能力的 CLI 工具，能查询 MR 状态和 CI 结果。实现方式由仓库侧决定，需在 AGENTS.md 中说明。

---

### gmr（Git Merge Request 工具）

**用途**：推送分支并创建 PR/MR，是仓库迭代合并指引中约定的标准命令

**规格要求**：
- 接受 `gmr` 命令无参数调用（自动推送当前分支并创建 PR）
- 支持 `-m <message>` 或通过交互设置 PR 标题和描述
- 执行后返回 PR URL
- 若 PR 已存在，自动推送不重复创建

**实现状态**：⬜ 需要仓库/平台侧实现或配置

> 若仓库使用其他命令（如 `git push --create-merge-request`），需在 🔀 仓库迭代合并指引中明确说明替代命令。i-verify 按 🔀 指引中的命令执行，不硬编码 `gmr`。

---

### i-bug skill

**用途**：阶段二自测修复循环、阶段七预发验证问题修复

**规格要求**：
- 接受标准5字段输入：症状描述 / 期望行为 / 受影响测试项 / 相关文件 / 已尝试方案
- 产出：修复 commit hash + 修复内容摘要
- 修复 commit message 格式：`fix: [i-verify] <描述>`

**实现状态**：⬜ 由 `.cursor/skills/i-bug/` 技能提供，当前为占位技能，需完整实现

---

### 部署工具（仓库专属）

**用途**：阶段六预发部署、阶段八生产发布

**规格要求**：
- 可通过命令行触发预发/生产部署（命令由 🏗️/🚀 指引提供）
- 部署命令有明确的退出码（0=成功，非0=失败）
- 提供健康检查接口或其他可被 AI 自动验证的成功判定方式
- 提供回滚命令（退出码语义相同）

**实现状态**：⬜ 由各仓库自行提供，命令在 AGENTS.md 中声明

---

### 单测框架（仓库专属）

**用途**：阶段三单元测试运行与验证

**规格要求**：
- 提供可通过命令行运行的测试命令（`npm run test:unit` 等）
- 命令有明确退出码（0=全部通过，非0=有失败）
- 覆盖率报告可通过命令生成（如 `--coverage` 参数）
- 测试输出包含通过/失败/跳过统计

**实现状态**：⬜ 由各仓库自行配置，命令在 📐 指引中声明

---

### 状态文件读写

**用途**：verify-state.json 的读写（幂等状态管理）

**规格要求**：
- JSON 格式读写（标准文件 I/O）
- 路径：`{workspaceRoot}/.iteration/verify-state.json`（`{workspaceRoot}` 为 **Cursor 工作区根目录**，studio 多仓顶层，**非**子项目 Git 仓库根）

**实现状态**：✅ 通过 AI Agent 的文件读写工具实现，无需额外工具

---

## 工具链成熟度矩阵

| 工具 | 必须 | 可选 | 实现状态 | 备注 |
|------|:----:|:----:|---------|------|
| git | ✅ | - | ✅ 就绪 | 标准 git |
| gh CLI | ✅ | - | ✅ 就绪（GitHub）| 非 GitHub 需替代方案 |
| gmr | ✅ | - | ⬜ 待实现 | 或按指引用其他命令替代 |
| i-bug skill | ✅ | - | ⬜ 待完整实现 | 当前为占位 |
| 部署工具 | ✅ | - | ⬜ 仓库自备 | 每个仓库自行实现 |
| 单测框架 | ✅ | - | ⬜ 仓库自备 | 每个仓库自行配置 |
| Feature Flag 工具 | - | ✅ | ⬜ 按需实现 | 仅有灰度需求时 |
| DB 迁移工具 | - | ✅ | ⬜ 按需实现 | 仅有 DB 变更时 |
| 监控/告警系统 | - | ✅ | ⬜ 按需集成 | 阶段八观察期使用 |

---

## 工具链就绪检查

在仓库正式接入 `i-verify` 前，建议逐项验证：

```bash
# 1. git 基本命令
git --version && echo "✅ git 就绪"

# 2. gh CLI 认证
gh auth status && echo "✅ gh CLI 就绪"

# 3. gmr 可用性
which gmr && gmr --version && echo "✅ gmr 就绪"

# 4. 单测命令
# （按仓库 📐 指引执行单测命令，确认退出码为 0）

# 5. 部署命令（预发）
# （按仓库 🏗️ 指引执行 dry-run 或确认命令存在）
```
