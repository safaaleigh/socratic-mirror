---
name: code-check
command: check
description: Run format, lint, and type checks and fix issues
---

```bash
#!/bin/bash

# Claude Code hook for running format, lint, and type checks
# This will trigger the agent to fix any issues found
# Usage: /check

echo "🔍 Running code quality checks and fixing issues..."
echo ""

# First, try to auto-fix Biome issues
echo "📝 Auto-fixing Biome format & lint issues..."
bun run check:write
BIOME_FIX_EXIT=$?

if [ $BIOME_FIX_EXIT -eq 0 ]; then
    echo "✅ Biome issues fixed automatically"
else
    echo "⚠️ Some Biome issues couldn't be auto-fixed"
fi

echo ""

# Now run TypeScript type checking
echo "🔧 Checking TypeScript types..."
bun run typecheck 2>&1 | tee /tmp/typecheck-output.txt
TSC_EXIT=${PIPESTATUS[0]}

echo ""

# Generate prompt for the agent if there are issues
if [ $TSC_EXIT -ne 0 ]; then
    echo "❌ TypeScript errors found. Please fix the following type errors:"
    echo ""
    cat /tmp/typecheck-output.txt
    echo ""
    echo "AGENT_TASK: Fix all TypeScript type errors shown above. Run 'bun run typecheck' after fixing to verify all issues are resolved."
else
    echo "✅ All TypeScript checks passed!"
fi

# Final summary
if [ $BIOME_FIX_EXIT -eq 0 ] && [ $TSC_EXIT -eq 0 ]; then
    echo ""
    echo "✨ All code quality checks passed!"
    exit 0
else
    echo ""
    echo "🔧 Please fix the issues mentioned above."
    exit 1
fi
```