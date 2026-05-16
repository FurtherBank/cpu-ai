# 参考：断言与探活

本页为 Skill **`weavefox-openapi-e2e`** 的补充片段；完整流程与禁止项见 **`SKILL.md`**，与 **`weavefoxinfra/AGENTS.md`**（OpenAPI 脚本式 E2E）一致。以下路径均相对于 **`weavefoxinfra/openapi-e2e-test/`** 目录。

## 失败汇总与退出码（项目内建）

优先使用 `lib/check.ts`（即 `openapi-e2e-test/lib/check.ts`）：

```typescript
import { createCheckSuite } from "./lib/check";

async function main() {
  const { check, exitIfFailed } = createCheckSuite();
  // ... validateXxx(data, check);
  exitIfFailed();
}
```

手写计数器仅在没有引入 `lib/check` 的临时脚本中使用。

## 探活（本地 Chair）

将 `BASE` 替换为 `config.host`（仅 origin：协议、域名与端口），例如 `http://local.dev.alipay.net:7001`。OpenAPI 路径前缀在各测试脚本的请求里写 `/api/open/v1/...`，不要拼进 `host`。

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "${BASE}/"
```

若返回非 2xx 或连接失败，在 `weavefoxinfra` 目录启动：

```bash
cd /path/to/weavefox/weavefoxinfra && tnpm run dev
```

启动后每隔 2～5 秒重试探活，总超时建议 120～180 秒。

## 统一 fetch 封装要点

- `method`、`headers` 与现有测试一致。
- `response.json()` 前确认 `content-type` 非 SSE 流。
- 业务错误：`response.status >= 400` 或 `data.code` 非 200/0 时抛错，由 `main` 的 `catch` 处理并 `process.exit(1)`。
