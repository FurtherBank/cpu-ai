#!/bin/bash
# agent-browser 环境诊断与引导脚本（可分发；不依赖某一用户主目录字面量）
# 用法：在含 SKILL.md 的本 Skill 包根目录下执行 bash scripts/setup.sh

set -euo pipefail

AB_BIN="$(command -v agent-browser || true)"

# 常见全局 npm 前缀下的可执行文件（仅作查找回退，不写进 Skill 正文命令）
if [ -z "$AB_BIN" ] && [ -n "${HOME:-}" ] && [ -x "${HOME}/.npm-global/bin/agent-browser" ]; then
  AB_BIN="${HOME}/.npm-global/bin/agent-browser"
fi

if [ -n "$AB_BIN" ]; then
  echo "已找到 agent-browser：$("$AB_BIN" --version) @ $AB_BIN"
  "$AB_BIN" doctor --offline --quick
  exit 0
fi

echo "未找到 agent-browser。请按当前官方安装说明安装后重新运行本脚本："
echo "https://github.com/vercel-labs/agent-browser"
echo "安装完成后确认 PATH 含其 bin 目录，再运行：agent-browser doctor --offline --quick"
exit 1
