# 物理闸门实现模式参考

本文件描述各类不可逆操作的物理闸门实现方式，供 W4 选型参照。

**核心区别**：
- **文字约束**：AGENTS.md 写"禁止 Agent 执行 X"——在上下文膨胀时 AI 会遗忘
- **物理闸门**：CI/工具层面的技术机制——无论 AI 是否"记得"，都无法绕过

---

## 模式一：CI Environment Protection

**适用**：GitHub Actions 的生产部署

**实现**：
```yaml
# .github/workflows/deploy.yml
jobs:
  deploy-production:
    environment: production   # 关键
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: <部署命令>
```

在 GitHub 仓库 Settings → Environments → production 中：
- 勾选"Required reviewers"，添加负责人账号
- 可设置等待时间（如 5 分钟内必须审批）

**效果**：pipeline 在 deploy-production job 前自动暂停，发送邮件/通知给 reviewer，人工点击 Approve 后才继续。

---

## 模式二：GitLab `when: manual`

**适用**：GitLab CI 的生产部署或高风险操作

**实现**：
```yaml
# .gitlab-ci.yml
deploy-production:
  stage: deploy
  environment: production
  when: manual           # 关键：必须人工在 GitLab UI 点击 Play 按钮
  allow_failure: false
  script:
    - <部署命令>
```

**效果**：pipeline 不会自动执行此 job，需要有权限的成员在 GitLab 的 pipeline 页面手动触发。

---

## 模式三：workflow_dispatch 手动触发

**适用**：npm publish、GitHub Release 等发版操作

**实现**：
```yaml
# .github/workflows/release.yml
on:
  workflow_dispatch:          # 只允许手动触发，不设置 push/pr 触发
    inputs:
      confirm:
        description: "确认发版（输入 yes）"
        required: true
        default: "no"

jobs:
  release:
    if: github.event.inputs.confirm == 'yes'  # 双重确认
    runs-on: ubuntu-latest
    steps:
      - name: Publish
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**效果**：
1. AI 无法通过 push/PR 触发此 workflow
2. 即使人工手动触发，也需要输入 `yes` 确认
3. 关联的 `NPM_TOKEN` 只在此 protected environment 可用

---

## 模式四：PR 评论审批（数据库 Migration 常用）

**适用**：DBA 审批数据库 migration 方案

**实现**（GitHub Actions + gh CLI）：
```yaml
      - name: Check migration approval
        if: contains(steps.check-migration.outputs.has_migration, 'true')
        run: |
          APPROVED=$(gh pr view ${{ github.event.pull_request.number }} \
            --json comments -q '.comments[].body' \
            | grep -c "/migration-approved" || echo "0")
          if [ "$APPROVED" -eq "0" ]; then
            echo "❌ Migration detected. DBA must comment '/migration-approved' before CI can proceed."
            exit 1
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

流程：
1. CI 检测到 PR 包含 `migrations/` 目录的文件变更
2. CI 在 migration-check step 失败，并打印"需要 DBA 评论 /migration-approved"
3. DBA 审核 SQL 内容，确认后在 PR 评论 `/migration-approved`
4. 开发者 re-run CI，migration-check step 通过

**注意**：这种模式可以被"伪造评论"绕过。若安全级别要求更高，需用有签名验证的 bot。

---

## 模式五：HMAC Token 验证（自定义脚本）

**适用**：云平台部署脚本、kubectl apply 等本地执行的高危操作

**实现**：
```bash
# 生成 token（由 oncall 工程师在本地执行）
cloud-ops gate generate --operation "deploy backend-service prod" --ttl 30m
# 输出: TOKEN=eyJvcGVyYXRpb24i...

# 执行时验证 token（脚本内部）
# TOKEN 过期或 operation 不匹配 → 直接报错退出
cloud-ops deploy --env prod --token $TOKEN
```

Python 实现参考：
```python
import hmac, hashlib, base64, time, os

GATE_SECRET = os.environ["GATE_SECRET"]

def generate_token(operation: str, ttl_minutes: int = 30) -> str:
    expiry = int(time.time()) + ttl_minutes * 60
    payload = f"{operation}:{expiry}"
    sig = hmac.new(GATE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{sig}".encode()).decode()

def validate_token(token: str, operation: str) -> bool:
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        op, expiry_str, sig = decoded.rsplit(":", 2)
        if op != operation:
            raise ValueError(f"operation mismatch: expected {operation}, got {op}")
        if int(expiry_str) < int(time.time()):
            raise ValueError("token expired")
        expected_sig = hmac.new(GATE_SECRET.encode(), f"{op}:{expiry_str}".encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("invalid signature")
        return True
    except Exception as e:
        raise RuntimeError(f"GATE_REQUIRED: {e}") from e
```

**效果**：AI 调用部署脚本时，若没有有效 token（或 token 过期），脚本直接报错退出，无法继续执行。

---

## 各场景推荐闸门模式

| 不可逆操作 | 推荐模式 | 备注 |
|---|---|---|
| GitHub Actions 生产部署 | 模式一（Environment Protection） | 原生支持，零额外代码 |
| GitLab CI 生产部署 | 模式二（when: manual） | 原生支持 |
| npm publish | 模式三（workflow_dispatch） | 配合 protected secrets |
| 数据库 migration | 模式四（PR 评论审批） | 轻量，适合小团队 |
| 云平台危险操作（本地脚本） | 模式五（HMAC Token） | 需实现 gate 服务 |
| 多重保护（关键生产系统） | 模式一 + 模式五 | 串联两道闸门 |
