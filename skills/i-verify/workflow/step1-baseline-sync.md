# Step 1 - 基线同步执行指导

## 输入信息

**必须入参**：
- `🔀 仓库迭代合并指引`：从 AGENTS.md 提取的完整章节内容
- 当前 git 分支名（`git branch --show-current`）

## 目标要求

**任务**：确定迭代分支，同步基线，解决冲突

**目标**：工作分支处于干净的最新基线状态，diff 仅含本次迭代变更

**特性要求**：
- 不可跳过——每次重跑时必须执行（原因：修复提交需要被 rebase 到最新基线）
- 冲突处理有边界：机械性冲突（package-lock.json、生成文件）可自动解决；语义性冲突（业务逻辑）**必须升级人工**，不得自行决断

## 工作依据

**执行流程**：

1. 读取 🔀 指引，确认以下信息：
   - 基线分支名（如 `main`、`master`、`develop`）
   - 迭代分支命名规范
   - 同步方式（rebase / merge）

2. `git fetch origin` — 拉取远端最新状态

3. 检查当前分支是否符合指引的迭代分支命名规范；不符合时，按指引重命名或提示人工

4. 执行同步（以 rebase 为例）：
   ```bash
   git rebase origin/<基线分支>
   ```

5. 若出现冲突：
   - 运行 `git status` 查看冲突文件列表
   - 对每个冲突文件判断类型：
     - `package-lock.json`、`yarn.lock`、`.lock` 文件 → 接受 ours/theirs 并重新生成
     - 生成文件（如 `schema.graphql`、`*.pb.go`）→ 按生成规则重新生成
     - 业务逻辑代码 → **停止，输出冲突文件和冲突段，升级人工处理**
   - 冲突解决后：`git add <files> && git rebase --continue`

6. 最终验证：
   ```bash
   git status                           # 应显示 nothing to commit
   git log --oneline origin/<基线>..HEAD  # 应只显示本次迭代的 commits
   ```

**方法论**：
- 拉取之前先 `git stash`（若有未提交改动），完成后 `git stash pop`
- 遇到 `rebase` 中途失败：先 `git rebase --abort` 恢复干净状态，再分析原因
- 如果指引要求 merge 而非 rebase：`git merge origin/<基线分支>`，冲突处理相同

## 产出

执行完成后，向主控报告：
- 基线分支名
- 同步后 HEAD commit hash
- 本次迭代 commit 数量（`git log` 输出行数）
- 若有冲突：已自动解决 N 处，升级人工 M 处
