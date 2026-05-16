# Step 4 - PR 合并执行指导

## 输入信息

**必须入参**：
- `🔀 仓库迭代合并指引`：从 AGENTS.md 提取的完整章节内容（硬依赖）
- 当前 git 分支名
- `gh` CLI 可用（用于查询 PR 状态）

## 目标要求

**任务**：推送分支、创建/推进 PR、通过 CI、处理评审评论、合并至主干

**目标**：PR 状态=merged，CI 全绿，无未解决评论

**特性要求**：
- 幂等：若 PR 已合并且无新提交，直接标记完成；若 PR 已开放，跳过创建继续推进
- CI 失败必须修复，不允许强制合并（除非仓库指引明确允许且人工确认）
- 设计层面评论（非代码问题）必须阻断等待人工决策

## 工作依据

**执行流程**：

**1. 幂等检查**

```bash
gh pr list --head $(git branch --show-current) --state all --json number,state,url
```

- `state=MERGED` 且无新提交 → 标记完成，退出
- `state=MERGED` 且有新提交（重跑场景）→ 见重跑分支处理
- `state=OPEN` → 跳到步骤 4（CI + 评审检查）
- 无结果 → 执行步骤 2

**2. 推送分支**

按 🔀 指引执行推送命令（通常为 `gmr` 或 `git push origin HEAD`）。若指引有特定参数（如 `-u`、`--force-with-lease`），按指引执行。

**3. 创建 PR**

PR 描述必须包含：
- 本次变更摘要（对应变更计划表的改动）
- 测试覆盖说明（自测 ✅、单测 ✅）
- 关联的工单/需求编号（若有）

**4. 等待并处理 CI**

```bash
# 轮询 CI 状态（每 60 秒检查一次，最多 30 次）
gh pr checks $(git branch --show-current)
```

CI 失败时：
- 读取失败的 check 日志：`gh run view <run-id> --log-failed`
- 识别错误类型：lint / type-check / test / build
- Agent 直接修复（仅限代码问题），修复后 push 并等待 CI 重跑
- 若 CI 失败原因超出代码范围（环境问题、外部依赖）：阻断，升级人工

**5. 处理代码评审评论**

```bash
gh pr view <pr-number> --json reviews,comments
```

对每条未解决评论：
- **明确的代码改进建议**：直接修改代码，回复说明改动，push
- **设计层面的质疑**（如「这个接口设计有问题」）：**阻断，输出评论内容，等待人工决策**
- **拼写/格式/命名**：直接修改，回复「已修复」

**6. 触发合并**

所有 CI 通过 + 无未解决评论后：
```bash
gh pr merge <pr-number> --<squash|merge|rebase>
```
合并方式按 🔀 指引规定。

**重跑场景 - 修复分支处理**：

PR 已合并后，修复代码**禁止** force push 主干，应：
1. 从最新主干创建修复分支：
   ```bash
   git checkout main && git pull origin main
   git checkout -b fix/pre-release-$(date +%Y%m%d)
   ```
2. 将修复 commits cherry-pick 到修复分支
3. 为修复分支创建新 PR，描述中注明关联的预发问题记录文件路径
4. 走完整流程

**方法论**：
- PR 描述质量影响 review 速度；先写清楚再推，不要等评审者追问
- CI 第一次失败后，先读全部失败 job 日志再动手，避免改了 lint 结果 type-check 又挂
- 人工 review 等待期：若超过约定时间（如仓库指引规定），可以 `@` 评审者或升级告知主控

## 产出

完成后向主控报告：
- PR 编号和 URL
- 合并方式
- CI 最终状态（全绿）
- 若有过修复：修复 commit 列表
