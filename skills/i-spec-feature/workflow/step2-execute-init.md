# 阶段二：执行前场准备 执行指导

将 PLANNING 阶段产出的 `change-plan.md` 转换为可执行的 `tasks.md`，并在续跑情况下校验状态一致性，避免重复提交、重复 migration 等不可逆副作用。

> **前置假设**：PLANNING 已收敛所有探索与粒度，本阶段及之后**不再做代码探索**，直接以 `change-plan.md` 为唯一蓝图。

---

## 第一步：加载规范与上下文

读取目标仓库 `AGENTS.md`，提取并记录：

- 构建命令（`go build ./...` / `npm run build` / `tsc --noEmit` 等，仅用于编译自洽性兜底）
- **Commit message 规范**（格式模板、scope 取值范围）
- Migration 工具与目录约定（若 plan 含 DDL 类 Cx）
- 依赖安装方式

从迭代上下文读取 `iterationId` 与本次 `reqId`，组装 commit 头部模板：第一行**必须**为 `reqId: <iterationId>-<reqId>`（线性回退场景由用户显式提供）。

---

## 第二步：判断执行模式

在 plan 目录下检查 `tasks.md` 是否已存在并含 `[x]` 项：

- **不存在 / 全部未勾**：进入「**首次执行**」（跳到第三步构建 tasks.md）。
- **存在且有勾选项**：进入「**续跑模式**」（跳到第四步校验）。

---

## 第三步：构建 tasks.md（首次执行）

完整读取 `change-plan.md`，将每个 Cx 条目映射为 `tasks.md` 中的一个任务项。任务项包含：

- **归属仓库目录**（取自 change-plan.md「工作区仓库范围（基础声明）」表）
- **交付物文件路径**（具体到文件；DDL 类 Cx **显式标注**「创建 migration 文件，不执行迁移」）
- **依赖前置 Cx**（来自分批计划的顺序）

**模板**：

```markdown
# 执行任务清单 (Tasks)

来源：change-plan.md（{plan 路径}）

## Batch 1（C1~C4）

- [ ] C1: {动作} {对象}
  - 仓库: {repoDir，相对 workspaceRoot 的路径}
  - 交付物: {文件路径或 migration 文件路径}
  - 说明: {若为 DDL 则标注"创建文件，不执行迁移"}
  - 依赖: 无
- [ ] C2: ...
  - 依赖: C1

## Batch 2（C5~C9）

...
```

**自检（首次执行）**：

- [ ] 每个 Cx 在 `tasks.md` 中有对应项，无遗漏
- [ ] 每项含**归属仓库目录**与**文件路径**，无「待确认」「参考现有实现」「粒度留白」等模糊词
- [ ] 任务项中**不出现**编写测试代码、运行单测/集成测试的要求

**完成判定**：tasks.md 已就绪 → 进入阶段三。

---

## 第四步：续跑状态校验（续跑模式）

读取 `tasks.md`，记录所有打勾项的 `(repoDir, commitId)` 列表与第一个未勾选项（续跑起点）。

对每条已勾选项执行状态一致性验证：

```bash
git -C <repoDir> branch --show-current        # 确认当前分支与预期一致
git -C <repoDir> show <commitId> --name-only  # 确认 commit 真实存在
```

**处理结果**：

- **全部一致**：续跑起点已确定，进入阶段三（跳过第三步 tasks.md 构建）。
- **分支不对**：`git -C <repoDir> checkout <expected-branch>` 后重新验证。
- **commit 不存在（分支已对）**：**立即停止**，输出不一致详情，等待人工介入；**绝不**自行重跑已勾选任务（会产生重复提交、重复 migration 文件等不可逆副作用）。

> **关键约束**：`tasks.md` 的勾选是**意图记录**，`git log` 是**事实**——两者都需要确认，缺一不可。发现不一致时绝不能以「重跑已勾选任务」来自愈。

**完成判定**：所有打勾项的 commit hash 均已通过 `git show` 验证；分支已确认正确 → 进入阶段三。
