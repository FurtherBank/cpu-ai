# W1 · 项目诊断 执行指导

## 输入信息

**必须入参**：
- `项目路径`：目标项目的本地路径或 git URL（若未 clone，先 clone）
- `补充上下文`：用户提供的团队规模、外部工具、项目类型（可为空）

**上下文参考**：
- [references/ai-dev-principles.md](../references/ai-dev-principles.md)（七条能力维度）

---

## 目标要求

**任务**：产出 `docs/ai-enablement/project-profile.md`，涵盖足以支撑后续 W2/W3/W4 决策的全部信息

**完成标准**：主控能据此回答以下三个问题，且每个答案有可追溯证据：
1. 是否全新项目（无先例代码）？
2. 已有 AI 资产质量如何（保留/更新/废弃 各几条）？
3. 外部平台哪些可自动化（绿/黄/红 各几个）？

**不做什么**：不修改任何项目文件；不建设 AI 资产；不实现 Toolkit

---

## 工作依据

### 步骤一：仓库结构扫描（盲盒测试）

```bash
ls -la <项目路径>
# 重点观察：语言/框架标识文件（go.mod / package.json / pyproject.toml）
# CI 配置目录（.github/workflows / .gitlab-ci.yml / Jenkinsfile）
# 现有 AI 资产（AGENTS.md / .cursor/rules/）
# 目录层级（apps/ libs/ 表示 Monorepo；单个 src/ 表示单包）
```

**判断全新项目的信号**：除 README 和配置文件外，`src/` 或等价目录下无实质业务代码文件。

### 步骤二：AI 资产盘点

```bash
find . -name "AGENTS.md" 2>/dev/null
ls .cursor/rules/ 2>/dev/null || echo "no cursor rules"
cat CONTRIBUTING.md 2>/dev/null | head -50
```

对每个 AI 资产文件：
- 阅读全文
- 评估质量：命令是否可执行（实际运行 2-3 条验证）、规范是否与代码一致、是否有过时描述
- 检查冲突：cursor rules 与 linter 配置（ESLint/ruff/golangci-lint 等）是否有相互覆盖的规则
- 打决策标签：**保留** / **更新** / **废弃**

### 步骤三：外部平台依赖探查

对用户提供的（或通过 `.env.example`/`README` 识别的）每个外部工具，执行三层检查：

**网络层**：
```bash
# 示例（根据工具替换 endpoint）
curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://api.notion.com/v1/users/me" \
  -H "Authorization: Bearer invalid_token"
# 返回 401 = 可达；返回 000 或超时 = 内网隔离
```

**认证层**：确认有效 token/API key 的获取方式（用户已有 / 需申请 / 无法获取）

**功能层**：确认 API/CLI 是否提供任务所需操作能力（不做假设，查文档）

**颜色标签判定**：
- 绿（完全可达）：网络通 + 认证可行 + 功能满足 → AGENTS.md 直接写 CLI 命令
- 黄（降级可达）：网络通但功能有限，或需额外配置（VPN、权限申请等）→ 设计降级路径
- 红（不可达）：网络不通，或无 API/CLI，或用户明确不愿开放权限 → 列入人工操作

⚠️ **关键规则**：未探查的工具不得进入后续设计；红色工具不实现 Toolkit

### 步骤四：五个分歧条件判定

明确以下 5 条结论，写入 `project-profile.md`：

| 分歧 | 判断方式 | 结论选项 |
|---|---|---|
| 项目成熟度 | `src/`/`apps/` 下是否有实质业务代码 | 全新项目 / 已有成熟项目 |
| AI 资产质量 | 步骤二的决策标签统计 | 零 AI 资产 / 有资产需增量补全 |
| 外部依赖深度 | 可达性矩阵颜色分布 | 无/轻量 / 中度 / 重度 |
| 研发流程形态 | `package.json` 有无 `publish` 字段或 `.npmrc` | 部署型 / 发布型（SDK/npm 包） |
| 团队规模 | 用户提供或 git log 贡献者数量 | 个人 / 小团队（≤2人） / 团队（3人以上） |

---

## 产出格式

在目标项目中创建 `docs/ai-enablement/project-profile.md`：

```markdown
# 项目 AI 研发能力诊断报告

生成时间：{datetime}

## 技术栈速写
- 语言/运行时：
- 框架：
- 包管理器：
- 测试框架：
- CI 平台：
- 部署目标：

## AI 资产决策表

| 文件路径 | 当前状态 | 决策 | 理由 |
|---|---|---|---|
| AGENTS.md | ... | 保留/更新/废弃 | ... |

## 外部依赖可达性矩阵

| 工具名 | 标签 | 可达端点 / 不可达原因 | 降级路径（黄色工具） |
|---|---|---|---|
| Vercel CLI | 🟢 绿 | vercel.com | — |

## 分支条件结论

- 项目成熟度：全新项目 / 已有成熟项目
- AI 资产状态：零 AI 资产 / 有资产需增量补全（X 条保留，Y 条更新，Z 条废弃）
- 外部依赖深度：无/轻量 / 中度（X 个黄色工具）/ 重度（需专项 Toolkit）
- 研发流程形态：部署型 / 发布型
- 团队规模：个人 / 小团队 / 团队

## 骨架文件（全新项目）

若为全新项目，已创建的骨架文件路径：
- ...

## 已识别风险与信息盲区

- （列出执行中无法确认的前提，影响后续决策的需标注）
```
