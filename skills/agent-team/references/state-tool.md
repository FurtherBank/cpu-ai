# 本地团队记录工具

[team_state.py](../scripts/team_state.py) 用于保存目标全文、带时点的声明与文件指纹，以及验收回执的元数据。它只依赖 Python 3.9 及以上版本的标准库，适用于 macOS 和 Linux，无需安装包或联网。其它 Agent 可调用 CLI，未来 MCP 包装也可读取同一 JSON 输出。

`RUN` 是运行目录路径，可以使用绝对路径，也可以相对于调用时的工作目录。所有输入文件路径同样相对于调用时的工作目录，保存时转为绝对路径；文件符号链接保留其命名路径，读取时跟随链接。运行目录本身解析为实际路径。

## 精确命令

在 Skill 目录执行以下命令；其它目录可将 `scripts/team_state.py` 换成其绝对路径。

```text
python3 scripts/team_state.py init RUN --goal-file PATH --workspace PATH [--mode finite|service]
python3 scripts/team_state.py note RUN --actor TEXT --kind decision|task|handoff|finding|response|observation|closure --text TEXT [--ref FILE ...]
python3 scripts/team_state.py receipt RUN --id TEXT --actor TEXT --verdict passed|failed|unverified --criteria FILE --artifact FILE [--artifact FILE ...] --report FILE --environment TEXT
python3 scripts/team_state.py check RUN --id TEXT --environment TEXT
python3 scripts/team_state.py status RUN
```

`--ref` 和 `--artifact` 均通过重复旗标增加文件，例如 `--ref task.md --ref plan.md`。`receipt` 至少需要一个 `--artifact`。目标文件必须是非空 UTF-8 文本；其它引用必须是可读取的普通文件，可为二进制文件。`--actor`、`--id`、`--text` 和环境声明不得为空白。

| 命令 | 行为 |
| --- | --- |
| `init` | 创建 `RUN/run.json`，保存目标源路径、完整原文、原始字节 SHA256 和开始时点。默认模式为 `finite`。`service` 仅记录持续服务意图，不启动监听或调度。已有 `run.json` 时拒绝初始化，不覆盖旧记录。工作区必须已存在。 |
| `note` | 追加调用时点、声明者、事件种类、正文，以及每个引用文件的绝对路径、字节数和 SHA256。`observation` 表示声明者提供了一次观察，正文应说明观察范围与真实证据。 |
| `receipt` | 以新 ID 追加声明者、结论、当时目标全文及 SHA256、判据/全部产物/报告的绝对路径与 SHA256、环境声明。重新读取初始化时指定的目标源路径，因此后续合法修订可形成新回执。所有旧结论保留；任何重复 ID 都拒绝覆盖。 |
| `check` | 重新读取该回执的目标、判据、全部产物和报告，逐一比较 SHA256，并逐字比较环境声明。只有原结论为 `passed`、全部文件与环境一致、目标源路径一致时，输出 `usable_as_recorded: true`。不更改原结论或记录。 |
| `status` | 输出完整持久记录、最后记录时点和最近一条 `observation` 的时点/正文；没有观察时返回 `null`。不重新检查回执，也不探测进程、Agent、消息或服务。 |

`receipt` 的报告正文须由实际承担验证职责的人或 Agent 写清检查范围、实际动作、结果、未知、环境和身份/独立性的依据。工具不会解析这些正文，也不会认证 `--actor`。新的复核结论使用新 ID，原失败及处置仍可追查。

所有工具时点都是本次调用的本机时间。`status.latest_observation_at` 取最近一条观察声明的 `recorded_at`，表示声明入库时间，不能替代外部动作的实际发生时间；后者应在正文与证据中说明。

## 可复制的完整例子

以下例子从 Skill 目录运行，在系统临时目录创建独立演示文件。报告中的通过只是演示声明。

```bash
DEMO_ROOT=$(mktemp -d)
export DEMO_ROOT
python3 - <<'PY'
import os
from pathlib import Path
root = Path(os.environ['DEMO_ROOT'])
(root / 'goal.md').write_text('目标：产物包含 hello。\n', encoding='utf-8')
(root / 'criteria.md').write_text('检查产物正文包含 hello。\n', encoding='utf-8')
(root / 'artifact.txt').write_text('hello\n', encoding='utf-8')
(root / 'report.md').write_text(
    '演示报告：actor=demo-verifier；范围=artifact.txt；动作=读取正文；'
    '结果=包含 hello；未知=未检查其它行为；身份和独立性未由本工具认证。\n',
    encoding='utf-8')
PY
python3 scripts/team_state.py init "$DEMO_ROOT/run" --goal-file "$DEMO_ROOT/goal.md" --workspace "$DEMO_ROOT"
python3 scripts/team_state.py note "$DEMO_ROOT/run" --actor commander --kind handoff --text '已发布演示产物，等待验证。' --ref "$DEMO_ROOT/artifact.txt"
python3 scripts/team_state.py receipt "$DEMO_ROOT/run" --id demo-1 --actor demo-verifier --verdict passed --criteria "$DEMO_ROOT/criteria.md" --artifact "$DEMO_ROOT/artifact.txt" --report "$DEMO_ROOT/report.md" --environment 'demo-v1'
python3 scripts/team_state.py check "$DEMO_ROOT/run" --id demo-1 --environment 'demo-v1'
python3 scripts/team_state.py status "$DEMO_ROOT/run"
```

将 `artifact.txt` 改成其它内容后再执行同一 `check`，返回码为 `1`，JSON 的 `files` 指出不匹配文件。恢复为原始 `hello` 加换行后，同一回执可再次匹配；匹配依据是字节内容，不是修改时间。更换判据、报告、目标内容或环境声明也会导致不匹配。

## 输出与错误处理

除 `--help` 的帮助文本外，每次调用向标准输出写一个 JSON 对象；调用者应同时检查退出码。

| 退出码 | 含义 |
| --- | --- |
| `0` | 命令成功；对 `check`，仅表示该回执的元数据仍适用。`receipt --verdict failed` 成功保存时也返回 `0`。 |
| `1` | `check` 的原结论失败/未验证、文件缺失或内容不匹配、环境声明不匹配，或指定回执不存在。 |
| `2` | 参数错误、初始化冲突、重复回执 ID、并发锁占用、文件不可读、状态损坏或其它操作错误。 |
| `130` | 调用被中断。 |

操作错误输出 `ok: false` 和 `error.code/message/details`。`check` 的元数据不适用时输出 `ok: false`、`usable_as_recorded: false`、逐文件比较及 `failures`。缺文件不会被当作通过；恢复原文件后可重新执行 `check`。返回非零不代表此前的其它回执被删除。

## 保存、并发与行为日志

运行目录包含 `run.json` 和持久锁文件 `.state.lock`。所有命令通过 `fcntl.flock` 获取该运行目录的排他锁；占用时返回 `run_busy`，调用者在持有者结束后重试。工具不等待无限锁、不自动删除锁，也不依据锁文件存在推断某个进程仍在运行。进程退出或崩溃后内核释放锁，文件保留。不要手工替换正在使用的锁文件。并发保证要求所有写入者共同使用本工具，存储介质须支持 POSIX 文件锁和原子发布；网络文件系统的行为未验证。

`run.json` 先完整写入同目录临时文件并同步，再原子替换。行为日志同样在完整写入后以不覆盖已有文件的方式原子发布。单个文件的发布是原子的，日志与 `run.json` 之间没有跨文件事务；磁盘故障或中断可能留下尚未被状态引用的日志，应检查实际记录后重试。工具只清理自己本次创建的临时文件，不删除未知锁或其它记录。

`init` 创建 behavior-log/v1 固定章节骨架，存放在：

```text
WORKSPACE/.skill-logs/agent-team/YYYY-MM-DD/HHMM-运行目录名.md
```

目录名转换为适合文件名的文字，同名日志追加 `-2`、`-3` 等后缀。路径与执行 ID 保存在 `run.json` 的 `behavior_log` 字段。日志只在初始化时写入；后续 `note/receipt` 追加的是 `run.json`。军团长按照 [行为日志模板](../templates/behavior-log.md) 增量维护 Markdown 日志并封口，工具不会重写已由负责人补充的审计内容。

## 可以据此判断什么

`usable_as_recorded: true` 的意思是“原先声明通过的回执，其目标、判据、产物、报告字节和环境声明仍匹配”。它不证明语义正确、测试覆盖足够、环境真实未变、声明者身份或验证独立性，也不产生授权。运行记录可被有文件写权限的人修改；本工具不是防篡改存证、权限隔离或质量裁判。

事件种类、`mode: service`、最近观察时点，以及人工写入的“已送达/已读取/已完成”等正文，都是带时点的声明。它们不证明当前活跃、实际投递或持续监听。接手任务仍须使用宿主提供的真实句柄与当前输入核实状态；环境也须由验证者实际检查后给出有区分度的声明。CLI 可以被包装为 MCP 接口，但包装本身不会补齐这些保证。
