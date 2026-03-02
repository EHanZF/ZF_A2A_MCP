# Agentic Branch Fuzz & Test - Implementation Summary

## 🎯 What Was Created

A fully agentic GitHub Actions job that:
- **Fuzzes local branch diffs** against main
- **Generates unit tests** for modified code paths
- **Validates all test suites** with coverage reporting
- **Checks workflow YAML** for security & best practices
- **Creates PRs automatically** if all checks pass
- **Simulates entirely in CI** without human intervention

---

## 📦 New Components

### 1. **Agent Skill: `fuzzBranchDiffs.ts`**
   - **File:** `Agents/ci-agent/fuzzBranchDiffs.ts`
   - **Exports:** 
     - `fuzzBranchDiffs(input)` — Main skill entry point
     - `createPullRequest(...)` — Helper for PR creation
   - **Responsibilities:**
     - Extract git diffs between branches
     - Generate fuzz test stubs for changed files
     - Run full test suite with coverage
     - Validate GitHub Actions workflows
     - Create PRs with detailed reports

### 2. **Routing Task: `branch.fuzz_and_test`**
   - **File:** `Agents/swarm/routingFabric.ts` (lines ~149-160)
   - **Agent:** `CI001` (CI Pipeline Agent)
   - **Invocation:**
     ```typescript
     const result = await fabric.route({
       task: "branch.fuzz_and_test",
       payload: {
         branch: "feature/xyz",
         baseBranch: "main",
         autoCommit: true
       }
     });
     ```

### 3. **GitHub Actions Workflow: `branch-fuzz-and-test.yml`**
   - **File:** `.github/workflows/branch-fuzz-and-test.yml`
   - **Triggers:**
     - Push to `feature/**`, `fix/**`, `refactor/**` branches
     - Manual dispatch via GitHub UI
   - **Jobs:**
     1. `orchestrate-fuzz` — Invokes the agent skill
     2. `verify-pr` — Validates PR post-creation (conditional)

### 4. **Local Test Script: `test-fuzz-locally.js`**
   - **File:** `scripts/test-fuzz-locally.js`
   - **Usage:**
     ```bash
     node scripts/test-fuzz-locally.js
     node scripts/test-fuzz-locally.js --branch feature/xyz --verbose
     node scripts/test-fuzz-locally.js --no-commit  # Dry-run
     ```
   - **Benefits:** Test locally before pushing; validate installation

### 5. **Documentation: `AGENTIC_FUZZ_WORKFLOW.md`**
   - **File:** `docs/AGENTIC_FUZZ_WORKFLOW.md`
   - **Covers:**
     - Quick start guide
     - Workflow stages & outputs
     - Skill implementation details
     - Fuzz test generation
     - Workflow validation rules
     - PR creation & commit behavior
     - Troubleshooting & advanced usage

---

## 🔄 How It Works (End-to-End)

### Local Development Flow

```
Developer creates feature branch
    ↓
npm run dev (local changes)
    ↓
node scripts/test-fuzz-locally.js  ← Test without GitHub
    ↓
git push origin feature/xyz
```

### GitHub Actions Flow

```
.github/workflows/branch-fuzz-and-test.yml triggered
    ↓
Job: orchestrate-fuzz
    ├─ Checkout code (full history)
    ├─ Setup Node + Python
    ├─ Node.js invokes RoutingFabric
    ├─ RoutingFabric routes to CI001 agent
    ├─ Agent executes fuzzBranchDiffs()
    │   ├─ Extract diff stats
    │   ├─ Generate fuzz tests
    │   ├─ Run npm test with coverage
    │   ├─ Validate workflows
    │   └─ Create PR (if autoCommit=true & all pass)
    ├─ Job outputs: status, pr_url, coverage
    └─ Comment posted on PR with results
    ↓
Job: verify-pr (if created)
    ├─ Validate PR status
    └─ Confirm mergeable state
```

---

## 🛠️ Integration Points

### Routing Fabric
Added two routing cases:
1. `branch.fuzz_and_test` → Invokes `fuzzBranchDiffs()`
2. `branch.create_pr` → Helper for PR creation

### CI Agent Registry
Already exists (`CI001`); now handles `branch.fuzz_and_test` task.

### Vector Bus & MCP
- Workflow receives `VECTOR_BUS_URL` & `MCP_URL` from secrets
- Can be used by agent for semantic analysis of diffs (future enhancement)

---

## 📊 What the Agent Does

### Diff Analysis
```
Input: branch "feature/api-refactor" vs base "main"
Output:
  - Files changed: 12
  - Insertions: 845
  - Deletions: 233
  - Changed files: [src/api.ts, tests/api.test.ts, ...]
```

### Fuzz Test Generation
```
For each modified .ts/.js file:
  ✓ Creates tests/fuzz-generated/{name}.fuzz.test.ts
  ✓ Includes:
    - Random input fuzzing
    - Boundary condition tests
    - State mutation invariants
  ✓ Count generated: 12 test files
```

### Test Execution
```
npm run test -- --run --coverage
Result:
  ✓ Passed: 847
  ✗ Failed: 3
  ⏭️  Skipped: 12
  📊 Coverage: 87.2%
```

### Workflow Validation
```
Scans .github/workflows/{*.yml,*.yaml}
Checks for:
  ✓ pull_request_target (injection risk)
  ✓ Unmasked secrets
  ✓ Sudo usage (privilege escalation)
  ✓ Deprecated APIs (::set-output)
  ✓ EOL Node versions
Result:
  Issues: 2
  Warnings: ["⚠️  Found sudo in workflows...", ...]
```

### PR Creation
```
When: All tests pass AND workflows valid AND autoCommit=true
Output:
  - Branch pushed to origin
  - PR created with:
    - Title: [Agentic] Fuzz-tested branch: ...
    - Body: Full test report, coverage %, warnings
    - Status: draft (not auto-merged)
  - PR URL returned: https://github.com/...
```

---

## 🚀 Usage Examples

### Example 1: Test a Feature Branch Locally

```bash
$ git checkout -b feature/new-auth
$ npm install
$ npm run build

# Run fuzz tests locally
$ node scripts/test-fuzz-locally.js --verbose

# Output:
# 🧪 Starting Local Fuzz Test Simulation
# 
# 📊 Fuzz Test Results
# Branch: feature/new-auth
# Base: main
# 
# Diff Summary:
#   Files Changed: 4
#   Insertions: +128
#   Deletions: -45
# 
# 🧬 Fuzz Tests Generated:
#   2 new test files created
# 
# ✅ Test Results:
#   Passed: 145 ✓
#   Failed: 0 ✗
#   Skipped: 3 ⏭️
#   Coverage: 92.50%
# 
# 🔍 Workflow Validation:
#   Issues: 0
# 
# 📝 PR Status: pending
# 
# ✅ All checks passed! This branch is ready for merge.
```

### Example 2: Push to GitHub and Auto-Create PR

```bash
$ git push origin feature/new-auth

# GitHub Actions triggers branch-fuzz-and-test.yml
# → Orchestrate Fuzz job runs
# → Agent creates PR automatically
# → Verify PR job confirms creation

# Job output (visible in Actions tab):
# 🤖 Agentic Fuzz Test PR Created
# PR URL: https://github.com/EHanZF/ZF_A2A_MCP/pull/42
# Coverage: 92.50%
#
# Comment posted on PR:
# ## 🧪 Agentic Fuzz Test Report
# **Status:** ✅ PR Created
# **Test Coverage:** 92.50%
# **PR URL:** https://github.com/...
```

### Example 3: Dispatch Workflow Manually

In GitHub Actions UI:
1. Click "Actions" tab
2. Select "branch-fuzz-and-test"
3. Click "Run workflow"
4. Enter:
   - Branch: `feature/xyz`
   - Auto-commit: `true`
5. Click "Run workflow"

---

## ✨ Key Features

| Feature | Benefit |
|---------|---------|
| **Local simulation** | Test before pushing; fail fast |
| **Agentic routing** | Reusable across other workflows |
| **Auto-test generation** | Catch edge cases automatically |
| **Coverage reporting** | Track code quality over time |
| **Workflow validation** | Prevent security regressions |
| **Auto PR creation** | Eliminate manual PR steps |
| **Detailed reporting** | Know status at a glance |
| **Conditional jobs** | Save CI cycles |

---

## 📝 How to Enable

1. **No additional setup required** — All files already in place
2. **Create a feature branch:**
   ```bash
   git checkout -b feature/test-agentic
   echo "test" > test.txt
   git add .
   git commit -m "test agentic workflow"
   git push origin feature/test-agentic
   ```
3. **GitHub Actions triggers automatically**
4. **Check Actions tab** for job status
5. **View PR** created by the agent

---

## 🔗 File Manifest

```
Agents/ci-agent/fuzzBranchDiffs.ts          [NEW] Agent skill
Agents/swarm/routingFabric.ts               [MODIFIED] +2 routing cases
.github/workflows/branch-fuzz-and-test.yml  [NEW] GitHub Actions workflow
scripts/test-fuzz-locally.js                [NEW] Local test simulation
docs/AGENTIC_FUZZ_WORKFLOW.md               [NEW] Complete documentation
```

---

## 🎓 Understanding the Architecture

### Traditional Workflow
```
GitHub Actions YAML
     ↓
Shell scripts (bash)
     ↓
Manual error handling
     ↓
PR created manually by dev
```

### Agentic Workflow
```
GitHub Actions YAML (thin)
     ↓
RoutingFabric (MCP router)
     ↓
CI001 Agent (agentic logic)
     ↓
fuzzBranchDiffs (reusable skill)
     ↓
Autonomous PR creation
```

**Benefits:**
- Agent logic is language-agnostic (can be called from other systems)
- Testable independently (unit tests for skills)
- Composable (chain multiple agents)
- Observable (routing traces all calls)

---

## 🚨 Important Notes

1. **GitHub CLI required:** Workflow uses `gh pr create`
   - Auto-installed in `ubuntu-latest` runners
   - Requires `GITHUB_TOKEN` (auto-provided)

2. **Git history needed:** Workflow fetches full history for diffs
   - Set `fetch-depth: 0` in checkout action ✓ (already done)

3. **Test framework:** Currently runs `npm run test -- --run`
   - Adjust for your test runner (vitest, jest, etc.)

4. **Branch patterns:** Workflow triggers on `feature/**`, `fix/**`, `refactor/**`
   - Modify in YAML if needed

5. **PR is draft:** Created in draft state to prevent accidental merge
   - Manually convert to ready-for-review after inspection

---

## 🔮 Future Enhancements

- [ ] Semantic diff analysis using Vector Bus
- [ ] AI-generated test assertions (not just stubs)
- [ ] Custom scoring function for "readiness" (e.g., coverage threshold)
- [ ] Integration with code review agents
- [ ] Automatic merge if all checks + review agents approve
- [ ] Telemetry: track fuzz results over time
- [ ] Custom fuzz strategies per project

---

## 📚 See Also

- [Routing Fabric](../Agents/swarm/routingFabric.ts)
- [Agent Registry](../Agents/swarm/registry.ts)
- [CI Agent Skills](../Agents/ci-agent/)
- [GitHub Actions Best Practices](../docs/AGENTIC_FUZZ_WORKFLOW.md)

