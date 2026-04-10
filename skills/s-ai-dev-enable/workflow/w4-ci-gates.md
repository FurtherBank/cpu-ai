# W4 · CI 与闸门配置 执行指导

## 输入信息

**必须入参**：
- `AGENTS.md` 路径（W2 产出），重点读取红区列表
- 现有 CI 配置路径（来自 W1 project-profile.md）
- 分支条件：发布型 vs 部署型、Monorepo vs 单包、数据库项目 vs 无数据库

**可选**：
- Toolkit 脚本路径（W3 产出，若有）

**上下文参考**：
- [references/gate-mechanisms.md](../references/gate-mechanisms.md)（物理闸门实现模式参考）

---

## 目标要求

**任务**：产出/修改 CI pipeline 配置，并为 AGENTS.md 红区每项标注对应物理闸门机制

**完成标准**：
- CI 配置 YAML 语法有效
- AGENTS.md 红区中每项均有物理闸门标注（机制名称 + 配置位置）

**不做什么**：不执行 CI pipeline；不修改 AGENTS.md 的其他章节

---

## 工作依据

### CI 质量门禁设计（所有场景必须）

**最小 CI 配置要求**（按技术栈替换具体命令）：

```yaml
# GitHub Actions 示例
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup（按技术栈）
        # Node: actions/setup-node / Go: actions/setup-go / Python: actions/setup-python
      - name: Install deps
        run: <安装命令>
      - name: Lint
        run: <lint 命令>          # 必须，任何 lint 报错 = CI 失败
      - name: Test
        run: <test 命令>          # 必须，含覆盖率检查（可选阈值门禁）
      - name: Build
        run: <build 命令>         # 必须（编译型语言/构建步骤）
```

**Monorepo 额外步骤**：
```yaml
      - name: Module boundary check
        run: npx nx affected --target=lint --base=origin/main  # 或等价命令
```

**发布型 SDK 额外步骤**（关键）：
```yaml
      - name: Build types
        run: npm run build
      - name: API compatibility check
        run: |
          npx api-extractor run --local 2>&1 | tee api-check.txt
          if grep -q "^Error:" api-check.txt; then
            echo "❌ API breaking change detected (not marked as major)."
            cat api-check.txt
            exit 1
          fi
      - name: Changeset required
        if: github.event_name == 'pull_request'
        run: |
          if [ -z "$(ls .changeset/*.md 2>/dev/null | grep -v README)" ]; then
            echo "❌ No changeset found. Run 'npx changeset' to create one."
            exit 1
          fi
```

**数据库项目额外步骤**：
```yaml
      - name: Migration format check
        run: |
          for f in migrations/*.sql; do
            if ! grep -q "-- +goose Down\|-- migrate:down\|def down" "$f" 2>/dev/null; then
              echo "❌ Migration $f missing down/rollback statement"
              exit 1
            fi
          done
```

**Flaky test 处理**：
```yaml
      - name: E2E tests (known flaky)
        run: <e2e 命令>
        continue-on-error: true   # 标注为 flaky，不阻断 CI
        # 注：此 job 的失败需在 AGENTS.md 中用 SOP 区分处理
```

---

### 物理闸门设计（不可逆操作保护）

> **核心原则**：文字约束（AGENTS.md 写"禁止"）不等于物理闸门。必须实现至少一种物理机制使不可逆操作无法被 AI 自动触发。

**选择机制（按场景）**：

**生产部署闸门**（GitHub Actions）：
```yaml
  deploy-production:
    needs: deploy-staging
    environment: production   # 在 GitHub Settings → Environments 设置 required reviewers
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: <部署命令>
```
配置位置：GitHub 仓库 Settings → Environments → production → Required reviewers

**生产部署闸门**（GitLab CI）：
```yaml
deploy-production:
  stage: deploy
  when: manual              # 物理闸门：必须人工在 UI 点击触发
  environment: production
  script:
    - <部署命令>
```

**npm publish 闸门**：
```yaml
# release.yml — 独立 workflow，仅允许手动触发
on:
  workflow_dispatch:
    inputs:
      confirm:
        description: "确认发版（输入 yes）"
        required: true
        default: "no"
jobs:
  release:
    if: github.event.inputs.confirm == 'yes'
    # ...
```

**DB Migration 生产执行闸门**（PR 评论审批）：
```yaml
      - name: Check migration approval
        run: |
          APPROVED=$(gh pr view ${{ github.event.pull_request.number }} \
            --json comments -q '.comments[].body' | grep -c "/migration-approved")
          if [ "$APPROVED" -eq "0" ]; then
            echo "❌ DBA must comment /migration-approved before merging."
            exit 1
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Token 验证闸门**（适用于自定义脚本）：
- 实现无状态 HMAC token（见场景 C 推演中的 gate/token.go 设计）
- AI 在执行前必须从 oncall 工程师处获取 token，token 有时效（如 30 分钟）

---

### AGENTS.md 红区标注格式

在 W2 建设的 AGENTS.md 红区中，为每项补充物理闸门信息：

```markdown
**红区**（禁止 Agent 自主执行）：

| 操作 | 物理闸门机制 | 如何触发合法执行 |
|---|---|---|
| 生产环境部署 | GitHub Environment "production" 设置了 required reviewers | 由人工在 GitHub Actions 页面点击 Approve |
| 数据库 Migration 到生产 | CI 检查 /migration-approved 评论 | DBA 审核后在 PR 评论 /migration-approved |
| npm publish | release.yml 仅 workflow_dispatch 触发 + confirm==yes | 维护者在 GitHub Actions 手动运行并输入 yes |
```

---

## 完成自检

- [ ] CI 配置 YAML 语法有效（用 `python3 -c "import yaml; yaml.safe_load(open('ci.yml'))"` 或等价）
- [ ] CI 包含 lint / test / build 三个核心步骤
- [ ] AGENTS.md 红区每项均有物理闸门机制标注和触发方式描述
- [ ] Monorepo：CI 包含模块边界检查步骤
- [ ] 发布型 SDK：CI 包含 API 兼容性检查 + changeset 检查
- [ ] 数据库项目：CI 包含 migration 回滚语句检查
