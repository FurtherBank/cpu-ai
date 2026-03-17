---
name: spec-execute
description: 负责将技术设计方案（`design.md`）落地为具体代码实现。通过创建和维护 `tasks.md` 任务列表来驱动开发流程，追踪进度，并在所有任务通过验证后完成状态流转。适用于方案评审后的自动化编码、单元测试编写及功能验证阶段。当用户要求“开始执行任务”、“按设计稿写代码”或需要根据已有设计文档进行功能开发时使用。
---

# spec-execute

## 执行流程 (Workflow)

### 任务拆解 (Planning -> `tasks.md`)
**动作**: 读取当前处理 Spec 对应的 `design.md`，完整确认具体可执行任务列表。
- 
**产出**: 在 Spec 目录下创建 `tasks.md`。
**文件模板**:
```markdown
# 执行任务清单 (Tasks)

## 前置检查
- [ ] TASK-000: 核心模块单测补全 (当前覆盖率: xx%)

## 开发实施阶段
- [ ] TASK-001: 数据库 DDL 变更
    - 依赖: 无
    - 验证: `desc table` 确认字段存在
- [ ] TASK-002: DAO 层代码生成
    - 依赖: TASK-001

```

### 自动化执行循环 (Execution Loop)
**动作**:
1.  读取 `tasks.md`。
2.  **Select**: 找到第一个未勾选 (`- [ ]`) 且依赖项已完成的 Task。
3.  **Check**: 如果是代码任务，调用 `feature` skill 执行；如果是单测补全，优先执行。
4.  **Verify**: 任务完成后，要求运行相关测试。
5.  **Update**: 将 `tasks.md` 中的 `[ ]` 更新为 `[x]`，并追加简短的执行日志（Commit ID 或 结果说明）。
    - *示例*: `- [x] TASK-001 ... (已完成, Commit: a1b2c3d)`
6.  **Loop**: 重复步骤 1-5，直到所有代码任务完成。

### 风险阻断与调整 (Dynamic Adjustment)
**逻辑**:
- 如果在执行 `feature` 时发现 `design.md` 有重大缺陷：
    - 暂停执行。
    - 在 `tasks.md` 中新增一条 `[ ] CRITICAL: 修复设计缺陷`。
    - 提示用户介入或自动修改 `design.md`。

### 状态流转 (Completion)
**动作**: 当 `tasks.md` 中所有实施类任务均为 `[x]` 时：
1.  进行最后的整体测试/集成测试。
2.  **重命名文件夹**:
    - 将 `spec_folder` 命名开头代表状态的 emoji 从 `⏳` 改为 `✅`。
3.  输出总结报告。

---

# 目录结构示例 (Artifact Preview)

执行完上述两个 Skill 后，文件系统将呈现如下结构：

```text
./specs/
├── ✅ 20260212-官网组织改造/  (历史任务)
│   ├── proposal.md
│   ├── design.md
│   ├── tasks.md (全勾选)
│   └── ...
│
└── ⏳ 20260213-支付网关升级/  (当前任务)
    ├── proposal.md            # 问题：老旧支付 SDK 停止维护...
    ├── design.md              # 方案：适配策略模式接入新 SDK...
    ├── tasks.md               # 进度：- [x] Task1, - [ ] Task2...
    ├── references/
    │   ├── old_sdk_usage.md   # 盘点：全站共有 15 处调用点
    │   └── api_diff.json      # 对比：新老接口字段映射
    └── pocs/
        └── verify_sign.py     # 验证：新 SDK 的签名算法验证脚本
```
