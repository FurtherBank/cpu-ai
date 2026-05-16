---
name: "weavefox-infra-test-loop"
description: |
  WHAT：在 weavefoxinfra 项目中自主完成单元测试覆盖率补全，无人值守地跑 → 分析 → 写测试 → 验证，
  直到所有模块行覆盖率 ≥ 90% 且质量扫描无 CRITICAL。
  WHEN：当需要对 weavefoxinfra 补全单测覆盖率时启用，一次调用即可完整自驱完成。
license: "MIT"
metadata:
  author: "WeaveFox Team"
  version: "2.0.0"
  category: "development"
  tags:
    - typescript
    - testcase
    - coverage
    - self-driving
---

# WeaveFox Infra 单测覆盖率自驱补全

在 `weavefoxinfra` 项目中，完整自驱地执行「跑覆盖率 → 找缺口 → 补测试 → 验证」闭环，
直到所有源文件行覆盖率 ≥ 90%，且 `verify-tests.js`（标准模式）无 CRITICAL。

## 硬编码常量（本 Skill 唯一适用于此项目）

```
PROJECT_DIR   = /Users/lrt/Desktop/weavefox/weavefoxinfra
NODE_VERSION  = 20.20.0
COVERAGE_CMD  = npm run test -- --coverage
TEST_CMD      = npm run test --
COVERAGE_JSON = coverage/coverage-summary.json
PROGRESS_FILE = .coverage-progress.json
STALL_FILE    = __stall_report__.md
VERIFY_CMD    = NODE_PATH=./node_modules node /Users/lrt/Desktop/weavefox/.cursor/skills/weavefox-test-loop/scripts/verify-tests.js
TARGET_PCT    = 90
```

## 工作流程（主控 Agent 调度模式）

> **第一步**：使用 TodoWrite 创建以下 3 个待办项，然后立即开始执行阶段一。

```
1. 阶段一：初始化（环境守门 + 状态感知）
2. 阶段二：单文件补测循环（直到 pendingFiles 为空）
3. 阶段三：全量验证（覆盖率数字门 + 质量门）
```

---

### 阶段一：初始化

**执行模式**：主控执行（强上下文依赖，后续所有步骤使用其输出）

**指导文件**：[workflow/init.md](workflow/init.md)

**输入**：

- 硬编码常量（见上方）
- `coverage/coverage-summary.json`（若不存在，先执行一次 `COVERAGE_CMD` 生成）

**目标**：输出两份数据：

1. `pendingFiles[]`：按 `lines.pct` 升序排列的待处理文件路径列表（相对于 PROJECT_DIR）
2. `progressData`：已加载并校验过的进度对象（初始或续跑均可）

**产出**：在主控 context 中持有 `pendingFiles[]` 和 `progressData`，进入阶段二。

执行时读取上述指导文件，按其中流程完成任务。

---

### 阶段二：单文件补测循环

**执行模式**：主控 + Shell Subagent 协作（循环 N 次，直到 `pendingFiles` 为空）

**指导文件**：[workflow/file-loop.md](workflow/file-loop.md)

**输入**：

- `pendingFiles[]`（来自阶段一）
- `progressData`（来自阶段一，每轮更新）
- 上下文参考：[references/test-patterns.md](references/test-patterns.md)

**目标**：对 `pendingFiles` 中的每个文件，完成：

- 读源码分析未覆盖分支
- 编写/扩充测试（主控执行）
- 运行测试并处理失败（Shell Subagent 运行，主控分析结果）
- 原子更新进度文件（主控执行）

**产出**：`pendingFiles` 为空，所有已处理文件的 `lines.pct ≥ 90%` 或记录在 `_stalledFiles`。

执行时读取上述指导文件，按其中的单文件处理流程循环执行。

---

### 阶段三：全量验证

**执行模式**：Shell Subagent（运行命令）+ 主控（分析结果）

**指导文件**：[workflow/verify.md](workflow/verify.md)

**输入**：

- 所有已写入的测试文件
- `progressData._stalledFiles`（已知卡点列表，验证时豁免）

**目标**：确认双重通过：

1. `coverage-summary.json` 中所有非卡点文件 `lines.pct ≥ 90%`
2. `verify-tests.js`（标准模式，无 `--sandbox`）输出无 CRITICAL

**产出**：任务完成报告（打印到 console），进度文件标记 `status: "DONE"`。

执行时读取上述指导文件，按其中验证流程完成。

---

## 注意事项

1. **严格遵守阶段顺序**，禁止跳过阶段一（Node 版本未切换时所有测试结果无效）
2. **覆盖率报告是唯一权威**，不信进度文件里的旧 `lines.pct` 值
3. **测试文件必须放在 `test/` 目录**，放在 `app/` 目录会导致 `describe is not defined` 错误
4. **禁用 Jest 语法**，框架是 Mocha + power-assert + sinon
5. **`verify-tests.js` 必须加 `NODE_PATH=./node_modules`** 前缀，否则 `glob` 模块找不到
6. **`--sandbox` 模式存在已知假阳性**，质量门仅使用标准模式（无 `--sandbox`）
