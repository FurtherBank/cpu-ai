#!/usr/bin/env python3
"""Local, append-only-in-usage records; no scheduling or semantic verification."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime
import errno
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile


SCHEMA = "agent-team-state/v1"
KINDS = ("decision", "task", "handoff", "finding", "response", "observation", "closure")
BOUNDARY = {
    "claim": "metadata_applicability_only",
    "environment": "caller_declared_exact_string; not automatically inspected",
    "does_not_prove": [
        "semantic_correctness", "verification_coverage", "actor_identity_or_independence",
        "live_process_status", "message_delivery_or_read_status", "authorization",
    ],
}


class RecordError(Exception):
    def __init__(self, code, message, details=None, exit_code=2):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.exit_code = exit_code


class JsonParser(argparse.ArgumentParser):
    def error(self, message):
        raise RecordError("invalid_arguments", message, {"usage": self.format_usage().strip()})


def timestamp():
    return datetime.now().astimezone().isoformat(timespec="microseconds")


def absolute(value):
    # Keep the named source path: replacing a symlink must affect later checks.
    return Path(os.path.abspath(os.path.expanduser(value)))


def nonempty(value):
    if not value.strip():
        raise argparse.ArgumentTypeError("value must contain non-whitespace text")
    return value


def snapshot(value, include_text=False):
    path = absolute(str(value))
    try:
        # Nonblocking open also prevents an accidental FIFO from hanging the CLI.
        fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
        with os.fdopen(fd, "rb") as source:
            before = os.fstat(source.fileno())
            if not stat.S_ISREG(before.st_mode):
                raise RecordError("not_regular_file", "Expected a regular file.", {"path": str(path)})
            content = source.read()
            after = os.fstat(source.fileno())
        current = path.stat()
    except RecordError:
        raise
    except OSError as exc:
        raise RecordError("file_unavailable", "Could not read a referenced file.",
                          {"path": str(path), "reason": str(exc)}) from exc
    signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
    if signature(before) != signature(after) or signature(after) != signature(current):
        raise RecordError("file_changed_during_read", "File changed while its fingerprint was being read.",
                          {"path": str(path)})
    result = {"path": str(path), "sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content)}
    if include_text:
        try:
            result["text"] = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise RecordError("goal_not_utf8", "The goal file must be UTF-8 text.", {"path": str(path)}) from exc
        if not result["text"].strip():
            raise RecordError("empty_goal", "The goal file must contain non-whitespace text.", {"path": str(path)})
    return result


@contextmanager
def locked(run, create=False):
    if create:
        run.mkdir(parents=True, exist_ok=True)
    if not run.is_dir():
        raise RecordError("run_not_found", "RUN must be an existing run directory.", {"run": str(run)})
    lock_path = run / ".state.lock"
    flags = os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(lock_path, flags, 0o600)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise RecordError("invalid_lock", "Lock path is not a regular file.", {"path": str(lock_path)})
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            if exc.errno in (errno.EACCES, errno.EAGAIN):
                raise RecordError("run_busy", "Another command holds this run's lock; retry after it finishes.",
                                  {"run": str(run), "lock": str(lock_path)}) from exc
            raise
        yield
    finally:
        # The lock file stays in place. The kernel releases the lock on close/crash.
        os.close(fd)


def atomic_json(path, data):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=".run.json-", suffix=".tmp", delete=False) as target:
            temporary = Path(target.name)
            json.dump(data, target, ensure_ascii=False, indent=2)
            target.write("\n")
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, path)
        temporary = None
    finally:
        # Only remove the temporary file created by this call, never a lock/record.
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def load(run):
    path = run / "run.json"
    try:
        with path.open(encoding="utf-8") as source:
            data = json.load(source)
    except FileNotFoundError as exc:
        raise RecordError("run_not_initialized", "No run.json exists; initialize RUN first.", {"run": str(run)}) from exc
    except (ValueError, UnicodeError) as exc:
        raise RecordError("invalid_state", "run.json is not valid UTF-8 JSON.", {"path": str(path)}) from exc
    required = {"goal": dict, "events": list, "receipts": list, "created_at": str, "updated_at": str}
    if not isinstance(data, dict) or data.get("schema") != SCHEMA or any(
        not isinstance(data.get(key), kind) for key, kind in required.items()
    ):
        raise RecordError("invalid_state", "run.json does not match the supported state schema.", {"path": str(path)})
    if not isinstance(data["goal"].get("path"), str) or not all(isinstance(item, dict) for item in data["events"] + data["receipts"]):
        raise RecordError("invalid_state", "run.json has invalid goal, event, or receipt records.", {"path": str(path)})
    ids = [item.get("id") for item in data["receipts"]]
    if not all(isinstance(item, str) for item in ids) or len(set(ids)) != len(ids):
        raise RecordError("invalid_state", "Receipt IDs must be strings and unique.", {"path": str(path)})
    return data


def markdown_cell(value):
    return str(value).replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def new_behavior_log(run, workspace, goal, started_at):
    started = datetime.fromisoformat(started_at)
    slug = re.sub(r"[^\w.-]+", "-", run.name, flags=re.UNICODE).strip(".-") or "run"
    folder = workspace / ".skill-logs" / "agent-team" / started.strftime("%Y-%m-%d")
    folder.mkdir(parents=True, exist_ok=True)
    base = started.strftime("%H%M") + "-" + slug
    suffix = 1
    while True:
        name = base + ("" if suffix == 1 else "-" + str(suffix))
        path = folder / (name + ".md")
        execution_id = "BL-" + started.strftime("%Y%m%dT%H%M%S%z") + "-agent-team-" + name[5:]
        goal_line = markdown_cell(goal["text"].strip().splitlines()[0])
        body = f"""# 行为日志：agent-team / {execution_id}

| 字段 | 内容 |
| --- | --- |
| 规范版本 | `behavior-log/v1` |
| 执行 ID | `{execution_id}` |
| Skill | `agent-team` |
| 状态 | `执行中` |
| 开始时间 | `{started_at}` |
| 最后更新时间 | `{started_at}` |
| 完成时间 | `—` |
| 工作区 | {markdown_cell(workspace)} |
| 执行目标 | {goal_line} |

## 顶层执行摘要

已初始化记录。任务进展、验证和关闭状态须由负责人据实增量维护。

## 执行边界

- 触发与授权：以目标文件及其有效约束为准，记录工具不确认授权。
- 本次目标：{goal_line}
- 记录范围：目标全文与初始指纹保存在 run.json；本日志由主控维护，工具不证明角色或进程存活。

## 依据与关键输入

| ID | 依据或输入 | 在本次执行中的作用 | 引用 |
| --- | --- | --- | --- |
| goal | 目标源文件 | 保存初始目标全文及字节指纹 | {markdown_cell(goal['path'])} |

## 关键行为

| ID | 行为 | 依据 | 结果 | 影响 | 追溯 |
| --- | --- | --- | --- | --- | --- |
| init | 初始化本地记录 | 明确目标文件 | 已创建运行记录 | 新建 run.json 与本日志 | {markdown_cell(run / 'run.json')} |

## 子 Skill 调用

| 顺序 | Skill | 调用目的 | 结果与贡献 | 子日志 |
| --- | --- | --- | --- | --- |

## 影响清单

| 类型 | 对象 | 变化 | 来源行为 | 验证 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 文件 | 运行记录与本日志 | 初始化 | init | 未进行任务验收 | 已记录 |

## 结果与验证

- 完成结果：仅记录初始化完成，任务是否达成尚未确认。
- 验证方式：尚未记录。
- 验证结论：未验证。

## 偏离、异常与未决事项

- 流程偏离：工具尚未观察任务执行。
- 失败、重试或降级：工具尚未观察任务执行。
- 未决事项与风险：本日志的增量更新与封口由主控负责；note/receipt 只写 run.json。

## 资源索引

| 资源 | 作用 | 位置 |
| --- | --- | --- |
| 运行记录 | 初始目标、带时点事件和验收元数据 | {markdown_cell(run / 'run.json')} |
| 目标原文 | 目标源文件，后续回执重新读取此路径 | {markdown_cell(goal['path'])} |

## 更正记录

- 尚无更正记录。
"""
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=folder,
                                             prefix=".behavior-log-", suffix=".tmp", delete=False) as target:
                temporary = Path(target.name)
                target.write(body)
                target.flush()
                os.fsync(target.fileno())
            # Hard-link publication is atomic and cannot replace another run's log.
            os.link(temporary, path)
            return {"path": str(path), "execution_id": execution_id, "schema": "behavior-log/v1"}
        except FileExistsError:
            suffix += 1
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)


def initialize(args, run):
    if (run / "run.json").exists() or (run / "run.json").is_symlink():
        raise RecordError("already_initialized", "RUN already has run.json; initialization never overwrites it.", {"run": str(run)})
    workspace = absolute(args.workspace)
    if not workspace.is_dir():
        raise RecordError("workspace_not_found", "--workspace must name an existing directory.", {"path": str(workspace)})
    goal = snapshot(args.goal_file, include_text=True)
    now = timestamp()
    data = {
        "schema": SCHEMA, "run_directory": str(run), "workspace": str(workspace),
        "mode": args.mode, "created_at": now, "updated_at": now,
        "goal": {**goal, "captured_at": now}, "events": [], "receipts": [],
    }
    data["behavior_log"] = new_behavior_log(run, workspace, goal, now)
    atomic_json(run / "run.json", data)
    return {"ok": True, "command": "init", "run": str(run), "state_file": str(run / "run.json"),
            "goal": data["goal"], "behavior_log": data["behavior_log"], "boundary": BOUNDARY}, 0


def note(args, run, data):
    refs = [snapshot(value) for value in args.ref]
    now = timestamp()
    event = {"id": "event-" + str(len(data["events"]) + 1).zfill(6), "recorded_at": now,
             "actor": args.actor, "kind": args.kind, "text": args.text, "refs": refs}
    data["events"].append(event)
    data["updated_at"] = now
    atomic_json(run / "run.json", data)
    return {"ok": True, "command": "note", "run": str(run), "event": event, "boundary": BOUNDARY}, 0


def receipt(args, run, data):
    if any(item["id"] == args.id for item in data["receipts"]):
        raise RecordError("duplicate_receipt_id", "Receipt ID already exists; publish a new ID instead of overwriting any result.",
                          {"id": args.id, "run": str(run)})
    goal = snapshot(data["goal"]["path"], include_text=True)
    criteria = snapshot(args.criteria)
    artifacts = [snapshot(value) for value in args.artifact]
    report = snapshot(args.report)
    now = timestamp()
    record = {"id": args.id, "recorded_at": now, "actor": args.actor, "verdict": args.verdict,
              "goal": goal, "criteria": criteria, "artifacts": artifacts, "report": report,
              "environment": args.environment}
    data["receipts"].append(record)
    data["updated_at"] = now
    atomic_json(run / "run.json", data)
    return {"ok": True, "command": "receipt", "run": str(run), "receipt": record, "boundary": BOUNDARY}, 0


def compare_file(record, label):
    if not isinstance(record, dict) or not isinstance(record.get("path"), str) or not isinstance(record.get("sha256"), str):
        raise RecordError("invalid_state", "Receipt contains an invalid file fingerprint.", {"file": label})
    result = {"file": label, "path": record["path"], "recorded_sha256": record["sha256"]}
    try:
        current = snapshot(record["path"])
        result.update({"current_sha256": current["sha256"], "matches": current["sha256"] == record["sha256"]})
    except RecordError as exc:
        result.update({"current_sha256": None, "matches": False,
                       "error": {"code": exc.code, "message": str(exc), "details": exc.details}})
    return result


def check(args, run, data):
    matches = [item for item in data["receipts"] if item["id"] == args.id]
    if not matches:
        raise RecordError("receipt_not_found", "No receipt has this ID.", {"id": args.id}, exit_code=1)
    record = matches[0]
    if not isinstance(record.get("artifacts"), list) or not record["artifacts"]:
        raise RecordError("invalid_state", "Receipt must include at least one artifact.", {"id": args.id})
    files = [compare_file(record.get("goal"), "goal"), compare_file(record.get("criteria"), "criteria")]
    files.extend(compare_file(item, "artifact[" + str(i) + "]") for i, item in enumerate(record["artifacts"]))
    files.append(compare_file(record.get("report"), "report"))
    environment_matches = record.get("environment") == args.environment
    verdict_passed = record.get("verdict") == "passed"
    goal_source_matches = record["goal"]["path"] == data["goal"]["path"]
    usable = verdict_passed and environment_matches and goal_source_matches and all(item["matches"] for item in files)
    failures = []
    if not verdict_passed:
        failures.append({"code": "verdict_not_passed", "recorded_verdict": record.get("verdict")})
    if not environment_matches:
        failures.append({"code": "environment_declaration_mismatch"})
    if not goal_source_matches:
        failures.append({"code": "goal_source_path_mismatch"})
    failures.extend({"code": "file_mismatch_or_unavailable", "file": item["file"], "path": item["path"]}
                    for item in files if not item["matches"])
    return {"ok": usable, "command": "check", "run": str(run), "id": args.id,
            "checked_at": timestamp(), "receipt_recorded_at": record.get("recorded_at"),
            "usable_as_recorded": usable, "recorded_verdict": record.get("verdict"),
            "environment": {"recorded": record.get("environment"), "supplied": args.environment,
                            "matches": environment_matches},
            "goal_source_matches": goal_source_matches, "files": files, "failures": failures,
            "boundary": BOUNDARY}, 0 if usable else 1


def status(run, data):
    observations = [event for event in data["events"] if event.get("kind") == "observation"]
    return {"ok": True, "command": "status", "run": str(run), "snapshot_at": timestamp(),
            "latest_recorded_at": data["updated_at"],
            "latest_observation_at": observations[-1].get("recorded_at") if observations else None,
            "observation_time_basis": "note.recorded_at; declaration time, not an independently measured observation time",
            "latest_observation": observations[-1] if observations else None,
            "live_status": "not_observed_by_this_tool", "state": data, "boundary": BOUNDARY}, 0


def parser():
    root = JsonParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init", help="Initialize a new run without overwriting records.")
    init.add_argument("run", metavar="RUN")
    init.add_argument("--goal-file", required=True)
    init.add_argument("--workspace", required=True)
    init.add_argument("--mode", choices=("finite", "service"), default="finite")
    event = commands.add_parser("note", help="Append a timestamped declaration and file fingerprints.")
    event.add_argument("run", metavar="RUN")
    event.add_argument("--actor", type=nonempty, required=True)
    event.add_argument("--kind", choices=KINDS, required=True)
    event.add_argument("--text", type=nonempty, required=True)
    event.add_argument("--ref", action="append", default=[], metavar="FILE")
    proof = commands.add_parser("receipt", help="Append a verdict declaration bound to current file bytes.")
    proof.add_argument("run", metavar="RUN")
    proof.add_argument("--id", type=nonempty, required=True)
    proof.add_argument("--actor", type=nonempty, required=True)
    proof.add_argument("--verdict", choices=("passed", "failed", "unverified"), required=True)
    proof.add_argument("--criteria", required=True, metavar="FILE")
    proof.add_argument("--artifact", action="append", required=True, metavar="FILE")
    proof.add_argument("--report", required=True, metavar="FILE")
    proof.add_argument("--environment", type=nonempty, required=True)
    inspect = commands.add_parser("check", help="Check metadata applicability, not semantic validity.")
    inspect.add_argument("run", metavar="RUN")
    inspect.add_argument("--id", type=nonempty, required=True)
    inspect.add_argument("--environment", type=nonempty, required=True)
    show = commands.add_parser("status", help="Read records and observation times, without inspecting processes.")
    show.add_argument("run", metavar="RUN")
    return root


def main():
    try:
        args = parser().parse_args()
        run = absolute(args.run).resolve()
        with locked(run, create=args.command == "init"):
            if args.command == "init":
                result, code = initialize(args, run)
            else:
                data = load(run)
                if args.command == "note":
                    result, code = note(args, run, data)
                elif args.command == "receipt":
                    result, code = receipt(args, run, data)
                elif args.command == "check":
                    result, code = check(args, run, data)
                else:
                    result, code = status(run, data)
    except RecordError as exc:
        result = {"ok": False, "error": {"code": exc.code, "message": str(exc), "details": exc.details}}
        code = exc.exit_code
    except (OSError, RuntimeError) as exc:
        result = {"ok": False, "error": {"code": "filesystem_error", "message": str(exc),
                  "details": {"hint": "A failed write may have left a complete record or a new log; inspect status before retrying. Locks and other records are never auto-deleted."}}}
        code = 2
    except KeyboardInterrupt:
        result = {"ok": False, "error": {"code": "interrupted", "message": "Command interrupted; inspect records before retrying."}}
        code = 130
    except Exception as exc:
        result = {"ok": False, "error": {"code": "internal_error", "message": type(exc).__name__ + ": " + str(exc)}}
        code = 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
