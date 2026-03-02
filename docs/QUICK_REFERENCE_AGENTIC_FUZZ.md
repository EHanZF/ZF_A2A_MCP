# 🚀 Agentic Fuzz & Test - Quick Reference

## One-Liner: What Is This?

A GitHub Actions bot that **automatically tests your branch, generates fuzz tests, validates workflows, and creates a PR** if everything passes.

---

## 📋 Cheat Sheet

### Local Testing (ALWAYS DO THIS FIRST)
```bash
# Test current branch
node scripts/test-fuzz-locally.js

# Test specific branch
node scripts/test-fuzz-locally.js --branch feature/xyz

# Verbose output + dry-run (no PR)
node scripts/test-fuzz-locally.js --verbose --no-commit
```

### Push to GitHub (Auto-Creates PR if Tests Pass)
```bash
git checkout -b feature/my-feature
git add .
git commit -m "my changes"
git push origin feature/my-feature
# → GitHub Actions runs automatically
# → Agent creates PR if all tests pass
```

### Manual GitHub Dispatch
- Go to **Actions** → **branch-fuzz-and-test** → **Run workflow**
- Enter branch name, click **Run workflow**
- PR created within 2-3 minutes

---

## 🎯 What Happens Automatically

| Step | What Agent Does | Duration |
|------|-----------------|----------|
| 1️⃣ **Diff** | Analyzes changed files | ~5s |
| 2️⃣ **Gen Tests** | Creates fuzz test stubs | ~10s |
| 3️⃣ **Run Tests** | Executes full test suite | ~60s |
| 4️⃣ **Validate Workflows** | Checks GitHub Actions YAML | ~10s |
| 5️⃣ **Create PR** | Pushes branch, creates PR (if all pass) | ~30s |

**Total time:** ~2 minutes

---

## ✅ Success Criteria

All must be true for PR to auto-create:

- ✓ All unit tests pass (`failed: 0`)
- ✓ No workflow validation issues
- ✓ Branch has been pushed
- ✓ `autoCommit: true` (default)

**If any fail:** PR is **not** created; check logs in GitHub Actions tab.

---

## 🔍 Check Status

### Local
```bash
node scripts/test-fuzz-locally.js --verbose
# Shows: ✅ All checks passed! (green)
# Or: ⚠️  Review the issues above before merging (yellow/red)
```

### GitHub Actions
1. Go to your branch
2. Click **Actions** tab
3. Find **branch-fuzz-and-test** run
4. Click job to see full output
5. Check **Artifacts** for reports

### PR Info
- **PR URL** printed in workflow output
- **GitHub comment** with test summary
- **Draft status** (ready after review)

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| Local script fails | Run `npm install` first; ensure Node 20+ |
| "Cannot find module" | Run `npm run build` |
| GitHub Actions times out | Check `.github/workflows/branch-fuzz-and-test.yml` timeout |
| PR not created | Check test output in Actions tab; may have failed tests |
| Workflow validation warnings | Review listed issues; update YAML if needed |

---

## 🎓 Comparison: Before vs After

### Before (Manual)
```
1. Create branch
2. Make changes
3. Run npm test locally
4. Push to GitHub
5. GitHub Actions (if any)
6. Create PR manually
7. Wait for review
```

### After (Agentic)
```
1. Create branch
2. Make changes
3. node scripts/test-fuzz-locally.js  ← Local validation
4. git push origin feature/xyz        ← GitHub Actions
5. ✨ Agent creates PR automatically!
6. Review PR (already has test report)
```

**Saved:** ~5-10 manual steps per branch

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `Agents/ci-agent/fuzzBranchDiffs.ts` | Agent skill (core logic) |
| `.github/workflows/branch-fuzz-and-test.yml` | GitHub Actions trigger |
| `scripts/test-fuzz-locally.js` | Local test script |
| `Agents/swarm/routingFabric.ts` | MCP router (added `branch.fuzz_and_test` task) |

---

## 🔗 Agent Task Signature

```typescript
// Invoke from another agent
const result = await fabric.route({
  source: "my-agent",
  task: "branch.fuzz_and_test",    // ← Agent task name
  payload: {
    branch: "feature/xyz",          // Current branch
    baseBranch: "main",             // Base to compare
    generateTests: true,            // Auto-gen fuzz tests
    autoCommit: false               // Skip PR creation
  }
});

// Returns:
{
  agent: "CI001",
  response: {
    branch: "feature/xyz",
    prStatus: "created" | "pending" | "failed",
    prUrl: "https://github.com/.../pull/42",
    testResults: { passed: 847, failed: 0, coverage: 92.5 },
    diffSummary: { filesChanged: 12, insertions: 845, ... },
    workflowValidation: { issues: 0, warnings: [] }
  }
}
```

---

## 🚀 Getting Help

1. **Local issue?** → Run with `--verbose`, check output
2. **GitHub issue?** → Check Actions tab logs
3. **Question?** → Read `docs/AGENTIC_FUZZ_WORKFLOW.md`
4. **Bug?** → File issue with logs from steps above

---

## 📊 Typical Output Example

```
🧪 Starting Local Fuzz Test Simulation

📊 Fuzz Test Results

Branch: feature/auth-refactor
Base: main

Diff Summary:
  Files Changed: 8
  Insertions: +342
  Deletions: -156

🧬 Fuzz Tests Generated:
  3 new test files created

✅ Test Results:
  Passed: 342 ✓
  Failed: 0 ✗
  Skipped: 5 ⏭️
  Coverage: 89.23%

🔍 Workflow Validation:
  Issues: 0

📝 PR Status: pending

✅ All checks passed! This branch is ready for merge.
```

---

## ⚡ Pro Tips

- **Always test locally first:** `node scripts/test-fuzz-locally.js`
- **Use `--verbose`** to see changed files
- **Use `--no-commit`** for dry-runs before pushing
- **Check PR comment** for detailed test summary
- **Keep feature branches small** (tests run faster)
- **Resolve workflow warnings** before merging (prevents regressions)

---

## 📞 Command Reference

```bash
# All commands that matter

# Local workflow
node scripts/test-fuzz-locally.js
node scripts/test-fuzz-locally.js --branch NAME
node scripts/test-fuzz-locally.js --verbose
node scripts/test-fuzz-locally.js --no-commit

# Git operations
git push origin feature/xyz          # Triggers GitHub Actions
gh pr merge <NUMBER> --squash        # Merge auto-created PR

# Cleanup
rm -rf tests/fuzz-generated/         # Clean up generated tests
git branch -D feature/xyz            # Delete local branch
```

---

**That's it!** Your workflow is now agentic. 🤖

