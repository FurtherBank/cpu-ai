#!/bin/bash
# agent-browser 环境检查与安装脚本
# 用法: bash scripts/setup.sh

set -e

echo "=== agent-browser 环境检查 ==="

# 检查 Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js 未安装，请先安装 Node.js >= 18"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 版本过低 ($(node -v))，需要 >= 18"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# 检查 agent-browser 是否已安装
if command -v agent-browser &> /dev/null; then
  echo "✅ agent-browser 已安装"
  agent-browser --version 2>/dev/null || true
else
  echo "⚠️  agent-browser 未安装，正在全局安装..."
  npm install -g agent-browser
  if command -v agent-browser &> /dev/null; then
    echo "✅ agent-browser 安装成功"
  else
    echo "❌ agent-browser 安装失败，请手动执行: npm install -g agent-browser"
    exit 1
  fi
fi

# 检查 Playwright 浏览器依赖
echo ""
echo "=== 检查浏览器依赖 ==="
npx playwright install-deps chromium 2>/dev/null && echo "✅ Chromium 依赖已就绪" || echo "⚠️  Chromium 依赖安装失败，部分功能可能受限"

echo ""
echo "=== 环境检查完成 ==="
