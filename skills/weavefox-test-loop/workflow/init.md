# 阶段一：初始化 执行指导

## 输入信息

**必须入参**：

- `PROJECT_DIR`：`/Users/lrt/Desktop/weavefox/weavefoxinfra`
- `NODE_VERSION`：`20.20.0`
- `TARGET_PCT`：`90`
- `PROGRESS_FILE`：`.coverage-progress.json`（相对于 PROJECT_DIR）

**上下文参考**：

- `coverage/coverage-summary.json`（若不存在先生成，见下方 Step 1.1）

## 目标要求

**任务**：输出 `pendingFiles[]` 和已就绪的 `progressData` 对象。

**目标**：

- `pendingFiles[]`：所有需要处理的文件，按 `lines.pct` 升序（最低优先），相对于 PROJECT_DIR
- `progressData`：合法 JSON，含 `processedFiles`, `completedFiles`, `_stalledFiles`, `_invalidPaths`, `_regressedHistory`

**不做什么**：本阶段不写测试代码，不运行测试。

## 工作依据

### Step 1.0 — Node 版本守门（必须第一步执行）

```bash
cd /Users/lrt/Desktop/weavefox/weavefoxinfra
eval "$(fnm env --shell zsh)" && fnm use 20.20.0
node -v
```

**判断**：输出必须精确匹配 `v20.20.0`。

**异常处理**：

- 输出非 `v20.20.0`：重试 `eval "$(fnm env --shell bash)" && fnm use 20.20.0 && node -v`
- fnm 命令不存在：写 `__stall_report__.md`，内容 `环境异常：fnm 未安装，需人工安装`，**停止全流程**
- 两次尝试均失败：写卡点文件，**停止全流程**

### Step 1.1 — 确保覆盖率基线存在

```bash
[ -f coverage/coverage-summary.json ] && echo "EXISTS" || echo "MISSING"
```

**若 MISSING**：执行以下命令生成基线（此步骤时间较长，约 60-120 秒）：

```bash
npm run test -- --coverage 2>&1
```

**判断**：执行完后再次检查文件是否存在，若仍不存在则写卡点文件并停止。

### Step 1.2 — 读取并校验进度文件

```javascript
// 伪代码，主控用 Shell + Read 工具执行
const fs = require("fs");
const PROGRESS_PATH = ".coverage-progress.json";
const EMPTY = {
  processedFiles: [],
  completedFiles: [],
  _stalledFiles: [],
  _invalidPaths: [],
  _regressedHistory: [],
};

let progress = EMPTY;
if (fs.existsSync(PROGRESS_PATH)) {
  try {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
    // 确保所有字段存在
    progress.processedFiles ??= [];
    progress.completedFiles ??= [];
    progress._stalledFiles ??= [];
    progress._invalidPaths ??= [];
    progress._regressedHistory ??= [];
  } catch (e) {
    console.warn("[WARN] 进度文件损坏，重建空进度");
    progress = EMPTY;
  }
}

// 校验 completedFiles 路径有效性
progress.completedFiles = progress.completedFiles.filter((relPath) => {
  if (!fs.existsSync(relPath)) {
    progress._invalidPaths.push({
      path: relPath,
      detectedAt: new Date().toISOString(),
    });
    return false;
  }
  return true;
});
```

**实际执行模式**：将上述逻辑写成一次性 node 脚本，用 Shell 工具执行，获取输出结果。

### Step 1.3 — 计算真实待处理文件列表

```javascript
const cov = JSON.parse(
  fs.readFileSync("coverage/coverage-summary.json", "utf8"),
);
const ROOT = "/Users/lrt/Desktop/weavefox/weavefoxinfra/";
const TARGET = 90;

const lowCoverageFiles = [];
const regressedFiles = [];

for (const [absPath, data] of Object.entries(cov)) {
  if (absPath === "total") continue;
  const relPath = absPath.replace(ROOT, "");
  const pct = data.lines.pct;

  if (pct < TARGET) {
    lowCoverageFiles.push({ file: relPath, pct });

    // 检测已完成模块的覆盖率回退
    if (progress.completedFiles.includes(relPath)) {
      regressedFiles.push({
        file: relPath,
        pct,
        detectedAt: new Date().toISOString(),
      });
      progress.completedFiles = progress.completedFiles.filter(
        (f) => f !== relPath,
      );
      progress._regressedHistory.push(...regressedFiles);
    }
  }
}

// 排序：pct 最低的优先处理
lowCoverageFiles.sort((a, b) => a.pct - b.pct);

// 过滤：跳过「已完成 且 当前 coverage 仍 ≥ 90%」的文件
const pendingFiles = lowCoverageFiles
  .filter(({ file }) => !progress.completedFiles.includes(file))
  .map(({ file }) => file);

console.log(
  JSON.stringify({ pendingFiles, regressions: regressedFiles.length }, null, 2),
);
```

**判断**：

- `pendingFiles.length === 0` → 直接跳至阶段三（全量验证），无需阶段二
- `regressedFiles.length > 0` → 打印警告（已完成模块有覆盖率回退），但不阻断

### Step 1.4 — 原子写入更新后的进度文件

```bash
# 将 progressData 对象（含路径校验和回退修正）写入
node -e "
const fs = require('fs');
const progress = JSON.parse(process.argv[1]);
const tmp = '.coverage-progress.json.tmp';
fs.writeFileSync(tmp, JSON.stringify(progress, null, 2));
fs.renameSync(tmp, '.coverage-progress.json');
console.log('进度文件已保存');
" '<progress_json_string>'
```

## 产出格式

完成本阶段后，主控 context 中持有：

```json
{
  "pendingFiles": [
    "app/module/.../TraceService.ts",
    "app/module/.../KnowledgeService.ts",
    "..."
  ],
  "progressData": {
    "processedFiles": [],
    "completedFiles": [],
    "_stalledFiles": [],
    "_invalidPaths": [],
    "_regressedHistory": []
  }
}
```

若 `pendingFiles` 为空，直接进入阶段三，打印「无需补测，直接验证全量覆盖率」。
