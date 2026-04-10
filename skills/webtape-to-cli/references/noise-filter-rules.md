# 噪音接口识别规则

## 三规则（按顺序应用）

### 规则①：域名过滤

以下域名模式的接口直接排除，无需检查内容：

| 域名模式 | 类型 |
|---|---|
| `collect.*.com` / `collect.*.cn` | 埋点统计 |
| `log.*.com` / `log.*.cn` | 日志上报 |
| `gw.alipayobjects.com` | Ant Design 静态资源 CDN |
| `renderoffice.alipay.com` | Office 渲染组件 |
| `*.oss-cn-*.aliyuncs.com` | 阿里云 OSS 对象存储 |
| `bailingual-assets.*` | 国际化静态资源 |
| `links.antfin-inc.com` / `links.alipay.com` | 客服 widget 组件 |
| `myws.alipay.com` | WebSocket 基础设施 |
| `*.cdn.com` | 通用 CDN |

**注意**：目标站点本身（如 `yuyan.antfin-inc.com`）可能有埋点接口，需结合路径判断：
- 路径含 `/api/collect/`、`/api/track/`、`/api/monitor/`、`/api/stat/` → 埋点，排除
- 路径含 `/api/announcement/`、`/api/guide/` → 通常是辅助信息，非核心，可选实现

---

### 规则②：类型过滤

检查 `requests/req_xxxx.json` 中的 `"type"` 字段：

| type 值 | 处置 |
|---|---|
| `"http"` | 正常处理 |
| `"websocket"` | 标记「已知限制：chromeFetch 不支持 WebSocket」；寻找等价 REST 轮询接口 |
| `"sse"` | 标记「已知限制：chromeFetch 不原生支持 SSE」；优先寻找轮询替代接口 |

**WebSocket/SSE 替代方案**：

大多数 WebSocket 连接用于实时推送状态更新，通常有等价的 REST 轮询接口（如 `/api/flow/{id}/status`）。寻找方法：
1. 找到 WS 连接前的 HTTP 接口（如 `POST /api/webSync/token`）
2. 在时间线的后续请求中找 `GET /api/xxx/{id}` 模式的轮询接口
3. 若找到等价轮询接口 → 用带超时的轮询替代（超时默认 120s）
4. 若未找到 → 在命令文档中标注「不支持实时状态推送，使用近似轮询」

---

### 规则③：频率过滤

在时间线中，同一 URL 模式出现 **3 次及以上** → 判定为轮询/心跳，排除或寻找等价接口。

常见的心跳模式：
- 固定间隔重复的 GET 请求
- 参数完全相同的重复请求
- 带 `heartbeat`/`ping`/`keepalive` 关键词的路径

---

## 补充：辅助接口的取舍

不是所有非埋点接口都需要实现，以下类型可选择性跳过：

| 接口类型 | 判断依据 | 建议 |
|---|---|---|
| 用户信息/权限初始化 | 路径含 `/getInitialState`、`/getCurrentUser`、`/userInfo` | 通常不需要，chromeFetch 的 Cookie 已提供用户上下文 |
| 租户/组织信息 | 路径含 `/tenantInfo`、`/orgInfo` | 若命令不涉及多租户，可跳过 |
| 公告/引导 | 路径含 `/announcement`、`/guide`、`/tour` | 跳过 |
| A/B 测试配置 | 路径含 `/experiment`、`/abtest`、`/feature-flag` | 跳过 |

**判断原则**：该接口的响应数据是否被后续核心接口用到？（查看依赖关系）不被使用的辅助接口一律可跳过。
