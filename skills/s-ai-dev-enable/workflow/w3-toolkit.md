# W3 · 外部工具 Toolkit 实现 执行指导

## 输入信息

**必须入参**：
- 可达性矩阵（来自 `project-profile.md`）：工具名、颜色标签、可达端点、建议实现方式
- 目标项目技术栈（决定 Toolkit 语言：Go 项目用 Go 或 Shell，Python 项目用 Python，JS 项目用 Node.js/Shell）
- Toolkit 存放目录约定（通常为 `scripts/` 或 `tools/`）

---

## 目标要求

**任务**：为所有黄色/绿色工具实现 wrapper，实现 `validate_env.py`（或等价脚本），返回 CLI 命令列表供主控 patch 到 AGENTS.md

**完成标准**：
- 在环境变量**未配置**时：validate_env 脚本明确列出缺失项并以非零退出
- 在环境变量**已配置**时：至少一个 wrapper 成功调用外部 API 并返回预期格式输出

**不做什么**：不实现红色工具；不修改 AGENTS.md；不配置 CI

---

## 工作依据

### 安全底线（不可违反）

1. **认证 token 只从环境变量读取**——在代码中硬编码 AK/SK 是硬阻断，立即停止并报告
2. **不可逆操作 wrapper 必须前置确认**——打印操作摘要 + 要求输入 `yes` 后才执行
3. **validate_env 脚本必须实现**——这是 Toolkit 调用前的前置守卫，无论 toolkit 多简单都要实现

### 实现规范

**validate_env 脚本（Python 示例，可适配其他语言）**：

```python
#!/usr/bin/env python3
"""Pre-flight environment check. Run before any Toolkit workflow."""
import os, sys

# 按工具分组，key 为工具名，value 为 [env_var, 用途说明, 获取方式]
REQUIRED = {
    "tool-a": [
        ("TOOL_A_TOKEN", "API 认证 Token", "在 tool-a 控制台 → Settings → API Keys 生成"),
    ],
    "tool-b": [
        ("TOOL_B_URL", "API 地址", "通常为 https://api.tool-b.com，内网版需向运维获取"),
        ("TOOL_B_KEY", "API Key", "通过 tool-b 管理员账号生成"),
    ],
}

def validate(group=None):
    groups = {group: REQUIRED[group]} if group and group in REQUIRED else REQUIRED
    missing = []
    for tool, vars in groups.items():
        for var, desc, hint in vars:
            if not os.environ.get(var):
                missing.append(f"  [{tool}] {var}: {desc}\n    获取方式: {hint}")
    if missing:
        print(f"[FAIL] 缺少以下环境变量：\n" + "\n".join(missing))
        print("\n请在 .env 文件或 shell profile 中配置后重试。")
        sys.exit(1)
    print(f"[OK] 所有必要环境变量已配置。")

if __name__ == "__main__":
    validate(sys.argv[1] if len(sys.argv) > 1 else None)
```

**wrapper 脚本规范**：

```python
# 每个 wrapper 的输出格式必须简洁统一，不暴露原始 API 的嵌套 JSON
# 推荐：plain text 表格 或 简单 JSON（一层结构）

# 不可逆操作前置确认模式：
def confirm_action(summary: str) -> bool:
    print(f"\n⚠️  即将执行以下操作：\n{summary}")
    answer = input("确认执行？(输入 yes 继续，其他任意键取消): ")
    return answer.strip().lower() == "yes"

# 陷阱：tccli/vercel 等工具的输出格式可能因版本升级变化
# → wrapper 内部做版本检查，捕获解析异常并给出明确错误信息而非崩溃
```

**版本检查示例**：
```bash
# wrapper 启动时检查工具版本
TCCLI_VERSION=$(tccli --version 2>&1 | head -1)
if [[ ! "$TCCLI_VERSION" =~ ^3\. ]]; then
    echo "ERROR: tccli version 3.x required, found: $TCCLI_VERSION"
    exit 1
fi
```

### 常见云工具封装参考

| 工具 | 可封装操作 | 不推荐封装 |
|---|---|---|
| Vercel CLI | `vercel ls`（查部署列表）、`vercel logs`（查日志）、`vercel --prod`（触发部署，需确认） | `vercel env`（凭证管理） |
| tccli（腾讯云） | `tke status`（查 Pod）、`monitor alerts`（查告警）、`cos ls`（查文件） | 直接修改 CAM 权限 |
| GitLab API | pipeline trigger、job log query、MR create | 删除 branch、修改 protect 规则 |
| PagerDuty API | incidents list、add note | 删除告警策略 |
| GitHub CLI（gh） | issue view、pr create、pr checks | force push、delete repo |

---

## 产出格式

向主控返回：

```markdown
## Toolkit 产出

### 文件列表
- scripts/validate_env.py（或等价路径）
- scripts/tool-a-wrapper.sh（绿色工具）
- scripts/tool-b-client.py（黄色工具）

### validate_env.py 路径
scripts/validate_env.py

### AGENTS.md 区块 B 补充命令
- 环境预检 → `python scripts/validate_env.py`
- 查询 Tool A 状态 → `bash scripts/tool-a-wrapper.sh status`
- 触发 Tool B 任务（需确认）→ `python scripts/tool-b-client.py run <params>`

### 未实现的工具（红色，原因）
- Tool C：内网隔离，curl 超时，无法实现 wrapper
```
