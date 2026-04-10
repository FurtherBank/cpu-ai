# W2 · AI 资产建设 执行指导

## 输入信息

**必须入参**：
- `project-profile.md`（W1 产出）——分支条件结论 + AI 资产决策表 + 可达性矩阵
- Toolkit CLI 命令列表（W3 产出，若 W3 先完成；否则 W4 之前补充）

**上下文参考**：
- [references/agents-md-template.md](../references/agents-md-template.md)（AGENTS.md 四区块模板）

---

## 目标要求

**任务**：写入 `AGENTS.md`（四区块完整）和 `.cursor/rules/` 规则文件集合

**完成标准**：
- 随机抽取 AGENTS.md 中 3 条工具链命令，在目标项目环境中实际运行，均返回预期结果
- 运行 linter，无因新增 cursor rules 引入的新报错

**不做什么**：不配置 CI；不实现 Toolkit；不为红色工具写任何集成逻辑

---

## 工作依据

### AGENTS.md 四区块建设规范

#### 区块 A：项目技术架构

必须包含：
- **目录结构说明**（至第 2 层，重要目录注释用途）
- **模块边界约定**（Monorepo 时尤其重要：哪些包可以互相依赖，哪些禁止）
- **风格锚点文件路径**：全新项目指向 W1/S3b 建立的骨架文件；已有项目指向典型先例文件（如 `src/components/button.tsx`、`internal/handler/user.go`）
- **版本约束**（如 Node >= 18、Go 1.22+）

#### 区块 B：工具链命令清单

格式：`<场景> → <完整可执行命令>`（无 placeholder）

必须覆盖的场景：
- 本地开发启动
- 单测运行（覆盖率模式）
- 构建
- Lint 检查（+ 自动修复命令）
- 部署/发布预览（非生产）
- 外部工具命令（绿/黄色工具，来自 W3 patch）

陷阱：不要写 `npm test`，要写 `npm test -- --coverage --testPathPattern=src/`（具体可运行）

#### 区块 C：AI 操作分级

**绿区（Agent 直接执行）**：读取文件、运行测试、本地构建、查询只读 API

**黄区（Agent 执行前输出计划，等待确认）**：修改配置文件、更新依赖版本、批量重构

**红区（禁止 Agent 自主执行，必须列举）**——必须包含项目实际存在的不可逆操作，如：
- 生产环境部署（`kubectl apply --context=prod` 或等价）
- 数据库 Migration 执行到生产（`goose production up` 或等价）
- 发布到 npm/其他注册表（`npm publish` 或等价）
- 删除云资源（`aws s3 rm`、`tccli delete*` 等）
- Force push 到主分支

> **重要**：红区的每一项必须在 W4 中对应至少一个物理闸门机制，在 AGENTS.md 中标注机制名称和配置位置

#### 区块 D：各研发环节 SOP

按项目类型选择对应模板：

**部署型项目 SOP 要素**：
- 需求收集：如何从 issue 提取可执行任务（含 issue 不清晰时的澄清 SOP）
- 技术方案：何时需要写方案文档（涉及 ≥N 个模块时），方案的必要内容
- 编码：分支命名规则、commit 格式、跨包改动安全检查步骤
- 自测：运行哪些命令、如何处理 flaky test（若有）
- PR 创建：PR 标题格式、body 必填内容、关联 issue 方式
- CI 通过：哪些 job 是强制通过、哪些是参考（flaky job 列表）
- [DEPLOY_GATE]：部署前的人工审批步骤描述

**发布型（SDK）项目 SOP 要素**（额外）：
- Breaking Change 判断：必须运行 `npm run build && npx api-extractor run --local`，解读输出规则
- Changeset 工作流：如何创建 changeset 文件，何时用 major/minor/patch
- 发版闸门：发版步骤及触发条件（人工执行 / 自动化条件）

---

### Cursor Rules 建设规范

**结构原则**：
- AGENTS.md 放高层 SOP 和原则，cursor rules 放文件类型相关的编码约束
- 不在 cursor rules 中重复 AGENTS.md 的内容

**必须配置 glob**（每个规则文件 frontmatter 中）：
- 越精确越好，避免 `**/*`（过宽）
- 示例：`globs: ["src/components/**/*.tsx"]`、`globs: ["migrations/**/*.sql"]`

**规则内容要求**：
- 每条规则是可执行约束，不是建议口号
- 包含正例和反例（至少包含一个"禁止 X，应该用 Y"的约束）

**团队项目额外要求**：
- 将 CONTRIBUTING.md 中的 CR 标准精确映射为可检查规则（如"禁止 `any` 类型"→ 可被 lint 检测的约束）
- 创建 `team-governance.mdc`，覆盖：分支命名格式、commit message 格式、PR 描述必填字段

**规则冲突处理**：
- 发现 cursor rules 与 linter 配置冲突时：以 linter 配置为准，修改 cursor rule，不修改 linter 配置
- 创建 `meta.mdc`（`alwaysApply: false`），写明优先级原则：
  ```
  工具链配置（linter/formatter）> cursor rules > AGENTS.md 描述
  遇到冲突时，以工具链配置为准，运行 `<lint 命令> --fix` 修复
  ```

**发布型项目额外规则**：
- `api-contract.mdc`：所有 @public API 必须通过入口文件导出，变更前必须运行 api-extractor 检测

---

## 完成自检

写完后逐项核对：

- [ ] 区块 A：目录结构至第 2 层，有风格锚点文件路径
- [ ] 区块 B：每条命令可直接复制执行，无 placeholder
- [ ] 区块 C：红区至少 1 条，每条将在 W4 补充物理闸门标注
- [ ] 区块 D：SOP 步骤中无"遵循规范"类空话，每步骤有对应命令或操作
- [ ] cursor rules：glob 语法有效，无与 linter 冲突规则
- [ ] 若有规则冲突：meta.mdc 已创建
