---
name: s-workflow-create
description: 创建基于结构化工作流的 Cursor Skill。将复杂任务编排为有序的步骤列表，每步包含输入、目标、工作依据和执行策略（主控/subagent），并内置测试校验环节。当用户需要创建新的 workflow 类型 skill、编排多步骤 AI 工作流、或将已有流程固化为可复用 skill 时使用。
---

# Workflow Skill 创建器

将用户描述的工作流程，设计并生成为一个结构化的 Cursor Skill。产出的 skill 遵循**任务步骤列表 + 测试校验**的编排模式，确保 AI 执行时信息渐进消费、上下文可控、交付可验证。

## 工作流程

### Phase 1: 需求收集

通过 AskQuestion 或对话，收集以下信息：

1. **Skill 基本信息**：名称、一句话描述、存放位置（个人/项目）
2. **工作流总体目标**：这个 workflow 最终要交付什么？
3. **步骤拆解**：用户心中的流程有哪些关键步骤？每步大致做什么？
4. **上下文依赖**：哪些步骤强依赖执行过程上下文（不能走 subagent）？
5. **测试校验需求**：交付物需要通过哪些测试或校验？
6. **已有参考**：是否有现成的流程文档、代码规范、方法论等可作为工作依据？

### Phase 2: 工作流架构设计

基于收集的需求，完成整体工作流的架构设计：

1. **子工作流划分与契约定义**：
   - 参照 [references/workflow-arch-methodology.md](references/workflow-arch-methodology.md)，识别任务的自然断点，将复杂流程拆解为多个上下文隔离的子工作流。

2. **强制植入测试/校验检查点（核心防御机制）**：
   - 为把坑和问题左移，减少风险导致的返工成本，必须在关键交付节点后插入检查环节。
   - **校验环节（Validation）**：针对静态检查、格式规范、逻辑自洽等，可由**主控 Agent 自行校验**。
   - **测试环节（Testing）**：针对功能验证、编译运行、端到端测试等，**必须通过 Subagent 执行**（利用沙盒隔离脏数据，并打破主控的“证实偏差”幻觉）。

3. **环节四要素递归设计**：
   - 针对每个子工作流内部的具体环节，严格按照 [references/task-step-schema.md](references/task-step-schema.md) 的方法论，推导其**四要素结构**（Input, Goal, Basis, Execution）。
   - 明确当测试/校验失败时的回滚与重试路由策略。

4. **主控角色与 Todo 映射设计**：
   - 明确主控 Agent 仅负责状态维护与派发，不亲自执行高污染操作。
   - 设计强制的 Todo 映射规则，确保执行时不跳步。

### Phase 3: 测试校验设计

参照 [references/pua-testing.md](references/pua-testing.md) 设计测试校验环节：

**校验（可自行执行）**：

- 静态检查：类比编码中的 lint、类型检查、格式校验、Code Review
- 规范符合性：产出物是否符合预定义的模板/格式要求
- 逻辑自洽：前后步骤的输入输出是否衔接

**测试（必须通过 subagent 执行）**：

- 功能验证：产出物是否满足目标要求中的特性要求
- 回归验证：修改是否影响已有功能
- 端到端验证：整体流程是否跑通

测试 subagent 的 prompt 中须融入 PUA 激励策略，避免敷衍执行。

### Phase 4: 生成 Skill 文件

按照 [templates/workflow-skill-template.md](templates/workflow-skill-template.md) 生成最终的 skill 目录结构。

生成后执行自检清单：

- [ ] SKILL.md 主文件 < 500 行
- [ ] 每个步骤四要素完整（输入、目标、依据、执行策略）
- [ ] 强上下文依赖步骤标记为主控执行，且采用索引式加载
- [ ] 测试环节通过 subagent 执行，且包含 PUA 激励
- [ ] 所有引用文件存在且路径正确
- [ ] description 包含 WHAT 和 WHEN
- [ ] 术语一致，无歧义指代
