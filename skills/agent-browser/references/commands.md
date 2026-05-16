# agent-browser CLI 命令参考

## 全局选项

- `--headed`：显示浏览器窗口（默认无头模式）
- `--json`：以 JSON 格式返回结构化输出

## 导航命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `open <url>` | 打开指定网页（别名：`goto`, `navigate`） | `agent-browser open https://example.com` |
| `back` | 后退到上一页 | `agent-browser back` |
| `forward` | 前进到下一页 | `agent-browser forward` |
| `scroll` | 滚动页面 | `agent-browser scroll down` |

## 交互命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `click <selector>` | 点击指定元素 | `agent-browser click "[data-testid='submit']"` |
| `fill <selector> <text>` | 清空并填写输入框 | `agent-browser fill "#username" "admin"` |
| `type <text>` | 在当前焦点元素输入文本 | `agent-browser type "hello world"` |
| `press <key>` | 模拟按键 | `agent-browser press Enter` |
| `hover <selector>` | 悬停在指定元素上 | `agent-browser hover ".menu-item"` |
| `select <selector> <value>` | 选择下拉选项 | `agent-browser select "#country" "China"` |

## 状态命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `screenshot` | 截取当前页面截图 | `agent-browser screenshot` |
| `wait <ms>` | 等待指定毫秒数 | `agent-browser wait 2000` |

## 选择器说明

支持多种选择器格式：
- CSS 选择器：`#id`, `.class`, `[data-testid='value']`
- ARIA 标签：`[aria-label='Search']`
- 文本内容：通常通过 CSS 选择器定位

## JSON 输出

添加 `--json` 参数可获取结构化响应，便于程序化处理：

```bash
agent-browser open https://example.com --json
```

返回包含页面简化 DOM、URL、标题等信息的 JSON 数据。
