# s-auto-dev 生命周期

## Start

1. 确认当前目录是 Cursor 工作区根目录。
2. 读取根 `AGENTS.md`，再读取目标子仓 `AGENTS.md`。
3. 执行：

```bash
iteration-ctl start <iterationId>
```

初始化后 `currentStage` 为 `IDLE`，`currentRoundId` 为 `1`，`nextReqIdSeq` 为 `1`。

## Intake

对每个新需求：

```bash
iteration-ctl allocate-req-id --source dima
```

调用方拿到 reqId 后写入：

- `.iteration/dima/[<reqId>]<emoji> <needName>.json`
- `.iteration/todo/[<reqId>]<emoji> <needName>.json`

JSON 内至少包含 `reqId`、`iterationId`、`source`、`skillName`、`needName`、`workItemId`。

## Tick Loop

进入某阶段后，循环执行：

```bash
iteration-ctl tick --once
iteration-ctl status
```

`tick` 只派发当前阶段的候选需求，不自动推进 `currentStage`。阶段推进必须由人工或外部 orchestrator 调用：

```bash
iteration-ctl advance
```

## Rollback

非测试阶段回退：

```bash
iteration-ctl rollback --to EXECUTION --reason "code review rejected"
```

测试阶段回到编码方向时，必须先创建修复需求并取得本轮第一条修复 reqId：

```bash
firstFixReqId=$(iteration-ctl allocate-req-id --source dima)
iteration-ctl rollback --to EXECUTION --reason "unit test failed" --start-req-id "$firstFixReqId"
```

回滚不清理历史产物。新旧轮次通过 `roundHistory.startReqId` 与 `[R<roundId>]` 前缀区分。

## Query

查询某需求在某阶段的关联产物：

```bash
iteration-ctl query 042 EXECUTION -a
iteration-ctl query 042 UNIT_TEST --round 2
iteration-ctl query 042 PRE_RELEASE --all
```

默认只查当前轮；测试阶段产物按 `[R<roundId>]` 查询。

## Archive

生产发布完成后：

```bash
iteration-ctl archive
```

该命令将 `.iteration/` 移动到 `.archive-iterations/<iterationId>/`，并重建空 `.iteration/`。

## Blocked Handling

出现以下情况时停止自动循环并报告：

- `status` 中出现 `blockedReason`
- `tick` 全部派发失败
- 缺少仓库指引、登录态或发布权限
- 连续多轮 rollback
- 子 agent 输出 `[stage-failed]`

恢复时先处理 blocked 原因，再从 `iteration-ctl status` 展示的当前阶段继续。

