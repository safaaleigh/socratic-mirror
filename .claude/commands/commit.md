---
thinking: true
---
# Run checks, fix issues, analyze changes, and commit with generated message

```bash
echo "Running code quality checks..."
bun run check:write
bun run typecheck

echo -e "\nStaging changes..."
git add -A

echo -e "\n=== Files Changed ==="
git diff --cached --name-status

echo -e "\n=== Change Summary ==="
git diff --cached --stat

echo -e "\n=== Diff Preview (first 200 lines) ==="
git diff --cached | head -200

echo -e "\n---"
echo "Analyzing the changes above to generate a conventional commit message..."
echo "Please create a git commit with an appropriate conventional commit type (feat/fix/docs/style/refactor/test/chore/perf) based on the changes shown."
```