#!/bin/bash
set -e

MAX_ITERATIONS=${1:-10}
SCRIPT_DIR="$(cd "$(dirname \
  "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 检测运行模式 - 使用 IN_WEAVEFOX_SANDBOX 环境变量
SANDBOX_MODE=${IN_WEAVEFOX_SANDBOX:-false}

if [ "$SANDBOX_MODE" = "true" ] || [ "$SANDBOX_MODE" = "1" ]; then
  echo "🚀 Starting Ralph - Test Coverage Loop [SANDBOX MODE]"
  echo "⚡ Running in sandbox mode - tests will not be executed"
  echo "   Using static code analysis for quality verification"
  SANDBOX_MODE="true"
else
  echo "🚀 Starting Ralph - Test Coverage Loop [FULL MODE]"
  SANDBOX_MODE="false"
fi

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "═══ Iteration $i ═══"
  echo "═══════════════════════════════════════════════════"

  # 沙箱模式: 运行静态分析
  if [ "$SANDBOX_MODE" = "true" ]; then
    echo ""
    echo "📋 Step 1: Static Test Quality Analysis"
    echo "───────────────────────────────────────────────────"
    node "$SCRIPT_DIR/verify-tests.js" --sandbox || true

    echo ""
    echo "📋 Step 2: Coverage Analysis Report"
    echo "───────────────────────────────────────────────────"
    node "$SCRIPT_DIR/verify-tests.js" --report || true

    echo ""
    echo "📋 Step 3: Check prd.json for completion"
    echo "───────────────────────────────────────────────────"
  fi

  # 运行主流程 (通过 prompt.md)
  if [ -f "$SCRIPT_DIR/prompt.md" ]; then
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" \
      | amp --dangerously-allow-all 2>&1 \
      | tee /dev/stderr) || true

    # Check for completion signal
    if echo "$OUTPUT" | \
      grep -q "<promise>COMPLETE</promise>"
    then
      echo ""
      echo "✅ All stories complete with coverage target met!"
      exit 0
    fi
  fi

  # Parse coverage from prd.json and display
  if [ -f "$SCRIPT_DIR/prd.json" ]; then
    CURRENT=$(node -e "try{const p=require('$SCRIPT_DIR/prd.json');const s=p.userStories&&p.userStories[0];console.log(s&&s.currentCoverage?s.currentCoverage:'N/A')}catch(e){}" 2>/dev/null || echo "N/A")
    TARGET=$(node -e "try{const p=require('$SCRIPT_DIR/prd.json');console.log(p.coverageTarget||'N/A')}catch(e){}" 2>/dev/null || echo "N/A")
    PASSES=$(node -e "try{const p=require('$SCRIPT_DIR/prd.json');const s=p.userStories&&p.userStories[0];console.log(s&&s.passes?'✅ PASS':'❌ FAIL')}catch(e){console.log('❌ UNKNOWN')}" 2>/dev/null || echo "❌ UNKNOWN")

    echo ""
    echo "📊 Status Report:"
    if [ "$SANDBOX_MODE" = "true" ]; then
      echo "   Coverage: $CURRENT (estimated) / Target: $TARGET"
    else
      echo "   Coverage: $CURRENT / Target: $TARGET"
    fi
    echo "   Status: $PASSES"

    # 沙箱模式下显示未覆盖行
    if [ "$SANDBOX_MODE" = "true" ]; then
      UNCOVERED=$(node -e "try{const p=require('$SCRIPT_DIR/prd.json');const s=p.userStories&&p.userStories[0];const u=s&&s.uncoveredLines;console.log(u&&u.length?u.join(', '):'None')}catch(e){}" 2>/dev/null || echo "N/A")
      if [ "$UNCOVERED" != "None" ] && [ "$UNCOVERED" != "N/A" ]; then
        echo "   Uncovered Lines: $UNCOVERED"
      fi
    fi
  fi

  sleep 2
done

echo ""
echo "═══════════════════════════════════════════════════"
echo "⚠️ Max iterations reached"
echo "Check coverage reports and prd.json for current status"
if [ "$SANDBOX_MODE" = "true" ]; then
  echo ""
  echo "💡 Sandbox Mode Tips:"
  echo "   - Run: node $SCRIPT_DIR/verify-tests.js --analyze <source-file>"
  echo "   - Check: $SCRIPT_DIR/prd.json for uncovered lines"
  echo "   - Update: Test files to cover identified branches"
fi
exit 1
