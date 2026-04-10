---
name: webtape-to-cli
description: |
  WHAT：读取 webtape 录制材料，基于用户提供的命令设计意图，先建立命令骨架，再并行为每个子流程派发独立 Subagent（分析录制 + 编码实现一体化），最终产出产品化的 cpu-cli-tool 命令。
  WHEN：当需要将某个网站的功能以录制材料为依据转化为 cpu-cli-tool CLI 命令时使用。用户需提供：目标命令名、子命令/业务流程列表、各子流程对应的录制会话、基本参数设计意图。
---

# webtape-to-cli：从录制材料生成产品化 CLI 命令

## 用户输入格式

启动本 Skill 前，用户应提供：

```
命令名：<cmdName>
目标站点：<hostname>
录制目录：webtape-workspace/recordings/<hostname>/

子流程列表：
- <sub-command-1>：<功能描述>，录制会话：<session-dir>
- <sub-command-2>：<功能描述>，录制会话：<session-dir>
- ...

命令设计意图（可选）：
- 参数倾向、输出格式、是否需要确认等
```

若某个子流程暂无对应录制，说明「待录制」即可，该子流程骨架 stub 保留但跳过并行实现阶段。

---

## ⚠️ 全局约束（始终有效，所有 Subagent 均适用）

- **上下文体积控制**：`_context.md` > 50KB 时，**禁止全量读取**，必须使用 grep 分段提取
- **禁止幻觉接口**：POST/PUT/DELETE 接口若无录制覆盖，**不得猜测接口签名**
- **禁止硬编码 ID**：命令代码中不得出现录制时的特定数字 ID 作为默认值
- **HTTP 请求只用 chromeFetch**：不引入 axios/fetch 等其他 HTTP 库

---

## 工作流程（主控 Agent 调度模式）

> **任务阶段规划**：使用 TodoWrite 按以下 4 个阶段创建待办项，阶段二中每个子流程单独一项。

```
1. 阶段一：命令骨架建立
2. 阶段二-<sub1>：子流程实现 — <sub1>（Subagent）
   阶段二-<sub2>：子流程实现 — <sub2>（Subagent）
   ...（N 个子流程并行）
3. 阶段三：校验 — 编译验证
4. 阶段四：测试 — 运行时验证（Subagent）
```

---

### 阶段一：命令骨架建立

**执行方式**：主控执行

**指导文件**：[workflow/swf1-skeleton.md](workflow/swf1-skeleton.md)

**输入**：用户提供的命令名、子流程列表、命令设计意图

**目标**：建立命令目录结构，每个子流程创建独立文件（内容为 stub/TODO），产出「子流程派发清单」

**产出**：
- `src/commands/<cmdName>/index.ts`（注册所有子命令，实现标注 `// TODO: 由子流程 Subagent 实现`）
- `src/commands/<cmdName>/commands/<sub>.ts` × N（每个子命令一个文件，stub 内容）
- `src/commands/<cmdName>/config.ts`（公共 base URL 占位，若多子命令共享站点）
- **子流程派发清单**（Markdown，含每个子流程的派发上下文）

**校验点**（主控自行执行）：
- [ ] 命令目录已存在：`ls cpu-cli-tool/src/commands/<cmdName>/`
- [ ] 每个子流程有独立 stub 文件
- [ ] `index.ts` 可通过 `tsc --noEmit`（stub 文件骨架合法）

执行时读取上述指导文件，按其中流程完成任务。

---

### 阶段二：子流程实现（并行 Subagent）

**执行方式**：为每个子流程各派发一个 Subagent，**可并行发出，无需等待彼此**

**Subagent 配置**：
- 类型：`generalPurpose`
- readonly：`false`

对每个子流程，使用以下模板派发（填入子流程专属信息）：

```markdown
你负责实现 `<cmdName>` 命令的 `<sub-command>` 子命令。
请先阅读 `.cursor/skills/webtape-to-cli/workflow/swf2-subflow-impl.md`，按其中流程完成：
①分析对应录制的核心接口 ②编写完整的子命令实现代码。

## 子流程信息

- **子命令名**：`<sub-command>`
- **功能描述**：<用户提供的功能描述>
- **录制会话路径**：`webtape-workspace/recordings/<hostname>/<session-dir>/`
- **实现文件路径**：`cpu-cli-tool/src/commands/<cmdName>/commands/<sub>.ts`
- **命令根入口**：`cpu-cli-tool/src/commands/<cmdName>/index.ts`
- **公共配置文件**：`cpu-cli-tool/src/commands/<cmdName>/config.ts`（若存在）

## 设计约束

<从用户输入中提取的该子命令相关设计意图，如参数倾向、是否写操作、输出格式等>

## 要求

完成后返回：
1. 已修改的文件路径
2. 实现的接口清单（URL / Method / 业务用途）
3. 参数列表（最终实现的 --option 清单）
4. 是否存在录制缺口（如有，说明缺口内容）
5. 若发现写操作但录制缺失，**不得猜测接口签名**，返回补录需求
```

*所有子流程 Subagent 并行派出后，主控等待全部返回，汇总返回结果。*

**汇总后主控判断**：
- 若有子流程返回「录制缺口（写操作缺失）」→ 向用户输出补录提示，对应子命令保留 stub
- 若子流程全部完成 → 进入阶段三

---

### 阶段三：校验 — 编译验证

**执行方式**：主控执行

```bash
cd /Users/lrt/Desktop/ai-workspace/cpu-cli-tool && npx tsc --noEmit
```

**校验清单**：
- [ ] 命令退出码为 0
- [ ] 无 `error TS` 输出

**失败处理**：定位错误所在文件，针对性地向该子流程重新派发修复 Subagent（带编译错误上下文），修复后重新执行本阶段。

---

### 阶段四：测试 — 运行时验证

**执行方式**：Subagent 委派（**必须**，主控不得自行执行测试）

**Subagent 配置**：
- 类型：`generalPurpose`
- readonly：`false`

**派发 Prompt**：

```markdown
你是本次 CLI 命令交付的最后一道质量关卡。你的测试结论直接决定这个命令能否正常使用。

## 测试范围

命令：`${命令名}`
子命令：${子命令列表及各自功能简述}
目标站点：${hostname}（Chrome 需已登录该站点）

## 测试用例（必须逐项验证，不允许跳过）

### 用例 1：只读子命令正常路径
- 执行：`${只读子命令示例，使用真实参数}`
- 预期：返回格式化数据，无运行时错误，无 401/403

### 用例 2：必填参数缺失报错
- 执行：不传必填参数执行命令
- 预期：清晰错误提示，退出码非 0

### 用例 3：写操作确认机制（若有写操作子命令）
- 执行：触发写操作子命令，在 confirm 提示时输入 n
- 预期：confirm 出现（default: false）；输入 n 后正常退出，不执行写操作

### 用例 4（边界）：你认为最容易出问题的场景
自行选择 1 个边界场景执行验证（优先选：分页、鉴权失败、参数解析）

## 执行要求

- 每个用例必须实际执行，给出完整命令 + 完整输出 + 通过/失败判定
- 声称「已通过」但无实际输出的测试项视为未执行
- 你是独立的测试工程师，职责是找出问题，而不是确认「没问题」
- 全部通过后，再额外测试你认为最薄弱的边界场景

## 测试报告格式

# 测试报告
## 测试环境
- 执行时间：${timestamp}
- 测试范围：命令 `${命令名}`

## 测试结果汇总
- 总用例数 / 通过 / 失败

## 详细结果
### ✅/❌ 用例 X：${描述}
- 执行操作：${完整命令}
- 预期 / 实际 / 证据（完整输出）

## 额外发现
${测试中发现的其他问题}
```

*测试未全部通过 → 将失败项定位到具体子命令文件，重新派发该子命令的修复 Subagent，修复后重新执行阶段三 + 阶段四。*

---

## 注意事项

1. **阶段一必须先完成骨架**，所有子命令 stub 就绪后才并行派发阶段二
2. **阶段二各子流程 Subagent 完全独立**，不得共享上下文，各自只读自己的录制文件
3. 写操作接口无录制时，Subagent 必须返回「补录需求」而不是猜测实现
4. **阶段三编译失败时，定向修复**：只重发有问题的子命令文件，不重发所有子命令
5. 参考文档：[排雷指南](.cursor/skills/webtape-to-cli/references/landmine-guide.md) | [编码规则](.cursor/skills/webtape-to-cli/references/coding-rules.md) | [噪音识别规则](.cursor/skills/webtape-to-cli/references/noise-filter-rules.md)
