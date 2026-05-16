---
name: agent-browser
description: "AI 驱动的浏览器自动化技能，基于 Vercel agent-browser CLI。用于：网页自动化操作、前端页面验证测试、表单填写、页面截图、数据抓取、端到端交互流程验证。当用户需要操作浏览器、测试网页、验证页面功能、抓取页面数据时触发。"
---

# Agent Browser

基于 [Vercel agent-browser](https://github.com/vercel-labs/agent-browser) 的浏览器自动化技能。通过简化 DOM 表示减少 93% Token 消耗，专为 AI Agent 场景优化。

## 环境准备

首次使用前运行安装脚本：

```bash
bash scripts/setup.sh
```

需要：Node.js >= 18，Chromium 浏览器依赖。

若已安装 agent-browser，可跳过此步。快速验证：`agent-browser --version`

## 工作流

### 1. 确定任务类型

- **页面验证/测试** → 执行「页面验证流程」
- **数据抓取/信息提取** → 执行「数据抓取流程」
- **表单自动化** → 执行「表单操作流程」
- **截图/视觉检查** → 执行「截图流程」

### 2. 页面验证流程

```bash
# 打开目标页面
agent-browser open <url> --json

# 检查页面元素是否存在
agent-browser click "<selector>"

# 验证交互行为
agent-browser fill "<selector>" "<text>"
agent-browser press Enter
agent-browser wait 1000

# 截图确认结果
agent-browser screenshot
```

### 3. 数据抓取流程

```bash
# 打开页面并获取简化 DOM
agent-browser open <url> --json

# 根据 JSON 输出分析页面结构，提取所需信息
# --json 返回的简化 DOM 包含关键元素和文本内容
```

### 4. 表单操作流程

```bash
agent-browser open <url>
agent-browser fill "#field1" "value1"
agent-browser fill "#field2" "value2"
agent-browser select "#dropdown" "option"
agent-browser click "[type='submit']"
agent-browser wait 2000
agent-browser screenshot
```

### 5. 截图流程

```bash
agent-browser open <url>
agent-browser wait 1000
agent-browser screenshot
```

## 核心命令速查

| 类别 | 命令 | 说明 |
|------|------|------|
| 导航 | `open <url>` | 打开页面（别名：goto, navigate） |
| 导航 | `back` / `forward` | 前进/后退 |
| 导航 | `scroll` | 滚动页面 |
| 交互 | `click <selector>` | 点击元素 |
| 交互 | `fill <selector> <text>` | 清空并填写输入框 |
| 交互 | `type <text>` | 在焦点元素输入 |
| 交互 | `press <key>` | 模拟按键（Enter, Tab 等） |
| 交互 | `hover <selector>` | 悬停 |
| 交互 | `select <selector> <value>` | 选择下拉项 |
| 状态 | `screenshot` | 页面截图 |
| 状态 | `wait <ms>` | 等待毫秒数 |

全局选项：`--headed`（显示浏览器窗口）、`--json`（结构化 JSON 输出）

完整命令文档见 `references/commands.md`。

## 关键提示

- 所有命令前缀 `agent-browser`，如 `agent-browser open https://example.com`
- 选择器支持 CSS 选择器和 ARIA 标签：`#id`、`.class`、`[aria-label='X']`、`[data-testid='X']`
- 添加 `--json` 获取结构化输出，便于解析页面内容
- 使用 `--headed` 可在调试时看到实际浏览器操作
- 操作间加 `wait` 确保页面加载完成
- 多步操作时保持同一浏览器会话，无需重复 `open`