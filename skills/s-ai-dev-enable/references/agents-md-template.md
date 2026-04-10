# AGENTS.md 四区块模板

以下是 `AGENTS.md` 的标准模板，用于 W2 建设时参照。  
所有 `{...}` 占位符必须替换为具体内容，**不得保留 placeholder**。

---

```markdown
<!-- 
  AGENTS.md — AI Agent 项目研发指南
  last-updated: {YYYY-MM-DD}
  reviewer: {人工审核者}
-->

# {项目名称} — AI 研发指南

---

## 区块 A：项目技术架构

### 技术栈
- 语言/运行时：{如 TypeScript 5.x / Node.js 20+ / Go 1.22+ / Python 3.12+}
- 框架：{如 Next.js 14 App Router / NestJS 10 / Django REST Framework}
- 包管理器：{如 pnpm（禁止使用 npm/yarn）/ Go modules / pip + pip-tools}
- 测试框架：{如 Vitest / Jest / Go testing / pytest}

### 目录结构
{列出至第 2 层，重要目录注释用途}
```
src/
├── app/           → Next.js App Router 路由页面
├── components/    → 可复用 UI 组件
│   └── ui/        → 无业务逻辑的纯展示组件
├── lib/           → 工具函数和第三方封装
├── hooks/         → 自定义 React hooks
└── types/         → 全局 TypeScript 类型定义
```

### 风格锚点文件
参照以下文件的写法作为编码风格基准：
- 组件示例：{如 `src/components/ui/button.tsx`}
- API 处理示例：{如 `src/app/api/users/route.ts`}
- 测试示例：{如 `src/__tests__/components/button.test.tsx`}

### 模块边界约定（Monorepo 项目必填，单包可省略）
- {如 `libs/shared-*` 禁止导入 `libs/feature-*`}
- {如 `apps/*` 只导入 `feature-*`，不直接导入 `data-access-*`}
- 违反边界的代码会被 `{nx lint / eslint module-boundary}` 自动检测

---

## 区块 B：工具链命令清单

| 场景 | 命令 |
|---|---|
| 安装依赖 | `{pnpm install / go mod download / pip install -r requirements/dev.txt}` |
| 本地开发启动 | `{pnpm dev / go run cmd/server/main.go / python manage.py runserver}` |
| 运行测试 | `{pnpm test / go test ./... -race / pytest tests/ -v}` |
| 运行测试（含覆盖率）| `{pnpm test -- --coverage / go test ./... -coverprofile=coverage.out / pytest --cov=apps}` |
| 构建 | `{pnpm build / go build ./... / python -m build}` |
| Lint 检查 | `{pnpm lint / golangci-lint run / ruff check . && mypy apps/}` |
| Lint 自动修复 | `{pnpm lint --fix / golangci-lint run --fix / ruff check . --fix && black .}` |
| 格式化 | `{pnpm format / gofmt -w . / black .}` |
| 环境预检（若有 Toolkit）| `python scripts/validate_env.py` |

<!-- 来自 W3 Toolkit 的额外命令（若有）在此追加 -->

---

## 区块 C：AI 操作分级

### 绿区（Agent 可直接执行）
- 读取任意项目文件
- 运行测试、lint、格式化、构建命令
- 创建/修改 `src/`（或等价业务代码目录）下的文件
- 创建/修改测试文件
- 查询只读 API（git log、kubectl get、cloud-ops status 等）
- 创建 GitHub/GitLab PR、添加 PR 评论

### 黄区（执行前输出计划，等待确认）
- 修改 `package.json`/`go.mod`/`requirements.txt` 中的依赖版本
- 修改 `.eslintrc`/`ruff.toml`/`.golangci.yml` 等工具链配置
- 批量重命名或重构跨多文件的模块

### 红区（禁止 Agent 自主执行，必须人工介入）

| 操作 | 物理闸门机制 | 合法执行方式 |
|---|---|---|
| {如：生产环境部署} | {如：GitHub Environment "production" 设置 required reviewers} | {如：人工在 GitHub Actions 页面点击 Approve} |
| {如：数据库 Migration 到生产} | {如：CI 检查 /migration-approved 评论} | {如：DBA 审核后在 PR 评论 /migration-approved} |
| {如：npm publish} | {如：release.yml 仅 workflow_dispatch 触发} | {如：维护者手动运行 release workflow} |

> ⚠️ **关键提醒**：上述限制不依赖于 Agent 的"自我约束"，而是通过物理闸门机制（CI 配置 + environment protection）强制执行。即使 Agent 认为某项操作"必要"，也无法绕过这些机制。

---

## 区块 D：各研发环节 SOP

### 需求收集与分析

1. 阅读 GitHub/GitLab issue 全文，提取：核心功能诉求、验收标准（checklist）、技术约束
2. 若 issue 描述模糊（无验收标准或需求描述矛盾），在 issue 下评论要求澄清后暂停
3. 判断涉及哪些模块/文件（运行 `{如 npx nx affected --target=build}` 预判影响面）
4. 若涉及 {≥N 个模块 / 数据库变更 / 公共 API 变更}，必须先输出技术方案（见下一步）

### 技术方案（触发条件满足时）

1. 复制 `docs/templates/design-doc.md` 模板
2. 填写：涉及文件/模块列表、影响面分析、变更点说明、回滚方案
3. 作为 issue 评论或独立 PR 提交 review，等待确认后再开始编码

### 编码

1. 从主分支创建 feature 分支：`git checkout -b {feat|fix}/{issue-number}-{slug}`
2. 按技术方案实现，每个逻辑单元一个 commit，commit 格式：`{type}: {description}`
3. 编码完成后必须运行：`{完整的 lint + test + build 命令链}`
4. {Monorepo 项目：} 运行 `{nx affected --target=test --base=origin/main}` 确认所有受影响包测试通过
5. {数据库项目：} 新增的 migration 文件必须先在 dev DB 完整运行 up + down 验证

### 自测

- 运行测试命令：`{具体命令}`
- {发布型 SDK：} 运行 API 兼容性检查：`npm run build && npx api-extractor run --local`，解读输出
- {UI 项目：} 启动 dev server 验证关键渲染路径

### PR 创建

1. `git push -u origin HEAD`
2. `gh pr create --title "{type}: {description}" --body "Closes #{issue-number}\n\n## 改动\n- ...\n\n## 验证\n- ..."`
3. PR 标题格式：`{feat|fix|chore|refactor}: {description}`
4. {发布型 SDK：} PR 必须包含 `.changeset/*.md` 文件

### CI 结果处理

- lint / type-check / unit-test / build 失败 → 代码问题，必须修复
- {若有 flaky job（已知列表见下）：} 优先重试 job，若日志显示与本次改动相关再修复
- 已知 flaky job 列表：{如 e2e-web、integration-api（原因：xxx）}

### 部署/发布

{部署型项目：}
- Staging：CI 通过后自动触发（或运行 `{staging 部署命令}`）
- Production：需要人工通过物理闸门（见区块 C 红区 → 生产环境部署）

{发布型 SDK：}
- 版本发布：由维护者手动触发 release workflow
- 发布前确认：changeset 文件正确、CI 全绿、API 兼容性检查通过
```

---

## 常见缺陷检查清单

在写完 AGENTS.md 后，逐项核对：

- [ ] 区块 B 中所有命令可直接复制执行（无 `<placeholder>`）
- [ ] 区块 C 红区至少有 1 条，且每条都有物理闸门标注
- [ ] 区块 D 的 SOP 步骤中无"遵循规范"类空话
- [ ] 技术架构中有风格锚点文件路径（不是"参照现有代码风格"这种泛话）
- [ ] Monorepo：有模块边界约定
- [ ] 发布型 SDK：有 breaking change 判断协议和 changeset 工作流
- [ ] 数据库项目：有 migration 安全规则（dev 验证 + down 语句）
