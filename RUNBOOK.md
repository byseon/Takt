# Takt Quick Mode + Validation — Operational Runbook

**Version:** 0.3.0
**Date:** 2026-02-16
**Audience:** Users and operators

---

## 1. Getting Started with Quick Mode

### 1.1 Prerequisites

**Required:**
- Takt plugin installed (v0.3.0+)
- Project initialized (`.takt/` directory exists)
- Git repository (optional but recommended)

**Check installation:**
```bash
# Inside Claude Code
takt --version

# Should show: Takt v0.3.0 or higher
```

**Initialize project (if needed):**
```bash
cd your-project
git init  # If not already a git repo
# First takt command will auto-create .takt/
```

---

### 1.2 First Quick Entry Walkthrough

**Step 1: Create quick entry**

```bash
# Basic usage
takt quick "Fix timeout in API client"

# With type flag
takt quick "Add user profile page" --type feat

# Skip validation
takt quick "Research GraphQL schema design" --type research --no-validate
```

**What happens:**
1. Generates unique ID: `20260216-143022_fix-timeout-in-api`
2. Creates directory: `.takt/quick/20260216-143022_fix-timeout-in-api/`
3. Gathers context (git status, file tree, detected languages)
4. Saves context to: `.takt/artifacts/quick/20260216-143022_fix-timeout-in-api/context.json`
5. Renders quick.md from template
6. Writes: `.takt/quick/20260216-143022_fix-timeout-in-api/quick.md`
7. Prints confirmation

**Expected output:**
```
[Takt] Quick entry created: 20260216-143022_fix-timeout-in-api

  File: .takt/quick/20260216-143022_fix-timeout-in-api/quick.md
  Type: fix

Next steps:
  1. Complete the work (edit quick.md to track progress)
  2. Run: takt validate
  3. (Optional) Run: takt promote
```

---

**Step 2: Edit quick.md to track work**

Open `.takt/quick/20260216-143022_fix-timeout-in-api/quick.md`:

```markdown
# Quick: Fix timeout in API client

**ID:** 20260216-143022_fix-timeout-in-api
**Type:** fix
**Status:** todo
**Created:** 2026-02-16 14:30:22
**Updated:** 2026-02-16 14:30:22

## Goal

[Describe what you're trying to achieve]

## Steps

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

## Acceptance Checks

- [ ] Check 1
- [ ] Check 2

## Notes

[Track decisions, blockers, learnings here]

## Context

Git Branch: main
Git Status: M src/api/client.py
Languages: python
Context Artifact: .takt/artifacts/quick/20260216-143022_fix-timeout-in-api/context.json
```

**Edit the template:**

```markdown
## Goal

Fix timeout error when API client makes requests to slow endpoints.
Current 5s timeout is too aggressive for large payloads.

## Steps

- [x] Reproduce timeout with integration test
- [x] Add configurable timeout parameter to Client class
- [x] Update all callsites to use new parameter
- [ ] Update tests
- [ ] Run validation

## Acceptance Checks

- [ ] Integration test passes with 30s timeout
- [ ] Unit tests pass
- [ ] No breaking changes to existing callsites

## Notes

- Default timeout increased from 5s to 15s
- Added `timeout_seconds` kwarg to Client.__init__()
- Found 12 callsites, updated all to use default
```

---

**Step 3: Run validation**

```bash
takt validate
```

**Expected output:**
```
[Takt] Validating: 20260216-143022_fix-timeout-in-api (preset: python)

Running validation commands:
  ✓ ruff check . (0.3s)
  ✓ mypy src (1.2s)
  ✓ pytest tests (4.8s)

Validation complete! All checks passed.

Logs saved to: .takt/artifacts/quick/20260216-143022_fix-timeout-in-api/logs/
```

**Check quick.md:**

Validation results are appended:

```markdown
## Validation Results

| Check | Status | Duration | Details |
|-------|--------|----------|---------|
| Lint (ruff) | ✓ Pass | 0.3s | 0 errors, 0 warnings |
| Type Check (mypy) | ✓ Pass | 1.2s | Success: no issues found |
| Tests (pytest) | ✓ Pass | 4.8s | 42 passed |

Validated at: 2026-02-16 14:35:10
Preset: python
Logs: `.takt/artifacts/quick/20260216-143022_fix-timeout-in-api/logs/`
```

---

### 1.3 Understanding Generated Files

**Directory structure after first quick entry:**

```
.takt/
  quick/
    20260216-143022_fix-timeout-in-api/
      quick.md                           # Primary work record
  artifacts/
    quick/
      20260216-143022_fix-timeout-in-api/
        context.json                     # Git status, file tree, languages
        logs/
          lint.log                       # ruff check output
          test.log                       # pytest output
          typecheck.log                  # mypy output
```

**context.json example:**

```json
{
  "id": "20260216-143022_fix-timeout-in-api",
  "created": "2026-02-16T14:30:22Z",
  "git": {
    "branch": "main",
    "status": "M src/api/client.py",
    "root": "/Users/seongjinpark/dev/myproject"
  },
  "tree": {
    "files": 142,
    "directories": 18,
    "total_size": 584923,
    "languages": ["python", "markdown"]
  },
  "environment": {
    "node_version": null,
    "python_version": "3.11.5",
    "platform": "darwin"
  }
}
```

---

## 2. Configuring Validation Presets

### 2.1 Auto-Detection Explained

**How it works:**

1. Check for `.takt/config.yaml` → if `validate.preset` is set, use it
2. Else, detect project type:
   - Look for `package.json` → **Node preset**
   - Look for `pyproject.toml`, `setup.py`, or `requirements.txt` → **Python preset**
   - No detection → Error with help message

**Example detection:**

```bash
# Python project
$ ls
pyproject.toml  src/  tests/

$ takt validate
# Auto-detected: Python preset

# Node project
$ ls
package.json  src/  tests/

$ takt validate
# Auto-detected: Node preset
```

---

### 2.2 Python Preset Details

**Default behavior:**

Runs up to 3 commands (skips if tool not found):

| Command | Tool | Skipped If |
|---------|------|------------|
| `ruff check .` | ruff | Not installed |
| `mypy src` | mypy | Not installed or disabled in config |
| `pytest tests` | pytest | No `tests/` directory or not installed |

**Override via config.yaml:**

Create `.takt/config.yaml`:

```yaml
validate:
  preset: python
  timeout: 300000  # 5 minutes
  python:
    prefer_uv: true          # Use uv if available
    mypy_enabled: true       # Run mypy (default: true)
    pytest_args: "-v --cov"  # Additional pytest arguments
```

**Example with custom pytest args:**

```bash
$ cat .takt/config.yaml
validate:
  preset: python
  python:
    pytest_args: "-v --cov=src --cov-report=term"

$ takt validate
# Runs: pytest tests -v --cov=src --cov-report=term
```

**Disable specific checks:**

```yaml
validate:
  preset: python
  python:
    mypy_enabled: false  # Skip type checking
```

---

### 2.3 Node Preset Details

**Default behavior:**

Runs commands based on package.json scripts:

| Command | Script | Skipped If |
|---------|--------|------------|
| `<pm> run lint` | "lint" in scripts | Script missing |
| `<pm> run test` | "test" in scripts | Script missing |
| `<pm> run build` | "build" in scripts | Script missing |

**Package manager auto-detection:**

1. `pnpm-lock.yaml` exists → use `pnpm`
2. `yarn.lock` exists → use `yarn`
3. `package-lock.json` exists → use `npm`
4. Default: `npm`

**Override via config.yaml:**

```yaml
validate:
  preset: node
  timeout: 600000  # 10 minutes for slow builds
  node:
    package_manager: pnpm   # Force pnpm (auto | npm | yarn | pnpm)
    lint_script: "lint:ci"  # Use different script name
    test_script: "test:ci"
```

**Example package.json:**

```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:ci": "eslint src/ --max-warnings=0",
    "test": "jest",
    "test:ci": "jest --ci --coverage",
    "build": "vite build"
  }
}
```

**With config.yaml:**

```yaml
validate:
  preset: node
  node:
    lint_script: "lint:ci"
    test_script: "test:ci"
```

**Result:**
- Runs: `npm run lint:ci`
- Runs: `npm run test:ci`
- Runs: `npm run build`

---

### 2.4 Custom Commands via config.yaml

**For non-Python, non-Node projects:**

```yaml
validate:
  preset: custom
  timeout: 600000
  commands:
    - name: "Lint"
      command: "make lint"
      required: true
    - name: "Tests"
      command: "make test"
      required: true
    - name: "Security Scan"
      command: "bandit -r src/"
      required: false
```

**Fields:**
- `name`: Human-readable check name (shown in output)
- `command`: Shell command to run
- `required`: If `true`, validation fails if command fails. If `false`, warns only.

**Example output:**

```
[Takt] Validating: 20260216-143022_custom-task (preset: custom)

Running validation commands:
  ✓ Lint (make lint) (1.2s)
  ✓ Tests (make test) (8.5s)
  ⚠ Security Scan (bandit -r src/) (0.8s) - Warning: 2 issues found

Validation complete with warnings.
```

**Log files:**
- `lint.log` (from "Lint" command)
- `tests.log` (from "Tests" command)
- `security-scan.log` (from "Security Scan" command)

---

### 2.5 Timeout Configuration

**Default timeout:** 5 minutes (300000ms)

**Override globally:**

```yaml
validate:
  timeout: 600000  # 10 minutes
```

**Timeout behavior:**
- Total timeout applies to all commands combined
- If timeout exceeded, current command is killed
- Remaining commands are skipped
- Validation marked as failed
- Timeout error logged to command's stderr log

**Example timeout error (in `test.log`):**

```
[... test output ...]
ERROR: Validation timeout exceeded (600000ms)
Command killed: pytest tests
```

---

## 3. Promoting Entries to Tickets

### 3.1 When to Promote

**Promote when:**

- ✅ Scope grew beyond initial estimate
- ✅ Need to assign to a specialized agent (backend, frontend, etc.)
- ✅ Need mandatory review gates
- ✅ Task has dependencies on other tickets
- ✅ Want to track in milestone planning

**Don't promote when:**

- ❌ Task completed successfully and is done
- ❌ Standalone work with no dependencies
- ❌ Quick experiment or research spike
- ❌ No need for formal tracking

---

### 3.2 Promote Command Walkthrough

**Basic promotion (auto-create milestone):**

```bash
takt promote
```

**Expected output:**
```
[Takt] Promoted quick entry to ticket

  From: .takt/quick/20260216-143022_fix-timeout-in-api/quick.md
  To:   .takt/tickets/milestones/M-quick-20260216-143500/T001-fix-timeout-in-api.md

  Milestone: M-quick-20260216-143500 (ad-hoc, created)
  Agent:     unassigned
  Artifacts: Copied (context.json + 3 logs)

Next: Assign to an agent or run takt execute
```

**Promote to existing milestone:**

```bash
# Assume M001-scaffolding already exists
takt promote --milestone M001-scaffolding
```

**Expected output:**
```
[Takt] Promoted quick entry to ticket

  From: .takt/quick/20260216-143022_fix-timeout-in-api/quick.md
  To:   .takt/tickets/milestones/M001-scaffolding/T042-fix-timeout-in-api.md

  Milestone: M001-scaffolding (existing)
  Agent:     unassigned
  Artifacts: Copied (context.json + 3 logs)

Next: Assign to an agent or run takt execute
```

**Promote and assign to agent:**

```bash
takt promote --milestone M002-api --agent takt-backend
```

**Expected output:**
```
[Takt] Promoted quick entry to ticket

  From: .takt/quick/20260216-143022_fix-timeout-in-api/quick.md
  To:   .takt/tickets/milestones/M002-api/T042-takt-backend-fix-timeout-in-api.md

  Milestone: M002-api (existing)
  Agent:     takt-backend (assigned)
  Artifacts: Copied (context.json + 3 logs)

Next: Run takt execute to start agent work
```

---

### 3.3 Post-Promotion Workflow

**After promotion:**

1. **Quick entry updated** (`.takt/quick/<id>/quick.md`):
   ```markdown
   **Status:** promoted
   **Promoted:** T042
   **PromotedAt:** 2026-02-16 14:45:30
   ```

2. **Ticket created** (`.takt/tickets/milestones/M002-api/T042-takt-backend-fix-timeout-in-api.md`):
   ```markdown
   # T042 — Fix timeout in API client

   **Milestone:** M002-api
   **Agent:** takt-backend
   **Type:** fix
   **Status:** todo
   **Origin:** quick:20260216-143022_fix-timeout-in-api
   **Created:** 2026-02-16 14:30:22
   **Promoted:** 2026-02-16 14:45:30

   ## Description

   Fix timeout error when API client makes requests to slow endpoints.
   Current 5s timeout is too aggressive for large payloads.

   ## Acceptance Criteria

   - [ ] Integration test passes with 30s timeout
   - [ ] Unit tests pass
   - [ ] No breaking changes to existing callsites

   ## Notes

   - Default timeout increased from 5s to 15s
   - Added `timeout_seconds` kwarg to Client.__init__()
   - Found 12 callsites, updated all to use default

   ## Context

   Original quick entry: `.takt/quick/20260216-143022_fix-timeout-in-api/quick.md`
   Validation logs: `.takt/artifacts/ticket/T042/logs/`
   ```

3. **Artifacts copied** (`.takt/artifacts/ticket/T042/`):
   ```
   .takt/artifacts/ticket/T042/
     context.json
     logs/
       lint.log
       test.log
       typecheck.log
   ```

4. **Original artifacts preserved** (`.takt/artifacts/quick/20260216-143022_fix-timeout-in-api/`):
   - Not deleted (historical record)

**Next steps:**

- If agent assigned: Run `takt execute` to start work
- If unassigned: Manually assign agent in ticket file, then `takt execute`
- Ticket now participates in normal structured mode workflow (review gates, milestones, etc.)

---

## 4. Setting Up Evidence-Based Review

### 4.1 Creating config.yaml

**Create `.takt/config.yaml` at repository root:**

```bash
cd your-project
touch .takt/config.yaml
```

**Edit config.yaml:**

```yaml
# Enable validation requirement in review gates
review:
  require_validation: true
  require_test_artifacts: false  # Future enhancement

# Validation settings (optional, defaults shown)
validate:
  preset: auto
  timeout: 300000

# Artifact retention (optional)
artifacts:
  retention: all
  max_log_size: 1048576
```

---

### 4.2 Enabling require_validation

**What it does:**

When `review.require_validation: true`, the review-gate hook (`scripts/review-gate.mjs`) checks for validation artifacts before allowing ticket completion.

**Workflow:**

1. Agent completes ticket
2. Agent marks acceptance criteria as checked
3. Agent sets status to "completed"
4. Agent tries to complete ticket (triggers review-gate hook)
5. Review-gate checks:
   - ✓ All acceptance criteria checked
   - ✓ Status is "completed"
   - ✓ Agent has commits on worktree branch
   - ✓ **Validation artifacts exist** (new check)
6. If validation artifacts missing → **BLOCK** with message

**Block message example:**

```
Review blocked: Validation required but no artifacts found.

Run validation:
  takt validate T042

Or disable requirement in .takt/config.yaml:
  review:
    require_validation: false
```

---

### 4.3 How it Interacts with review-gate

**Integration point:**

`scripts/review-gate.mjs` is invoked by the orchestrator when an agent tries to complete a ticket.

**Extended logic (pseudocode):**

```javascript
// Existing checks
if (!allCheckboxesChecked(ticket)) {
  return block("Complete all acceptance criteria");
}

if (ticket.status !== "completed") {
  return block("Set status to 'completed'");
}

if (!hasCommits(agent, worktree)) {
  return block("No commits found on agent branch");
}

// NEW: Validation check
const config = parseYaml('.takt/config.yaml');
if (config?.review?.require_validation) {
  const artifactDir = `.takt/artifacts/ticket/${ticketId}/logs/`;
  if (!fs.existsSync(artifactDir) || isEmpty(artifactDir)) {
    return block("Validation required but no artifacts found. Run: takt validate");
  }
}

// All checks passed
return allow();
```

**Artifact detection:**

- Looks for: `.takt/artifacts/ticket/T042/logs/`
- Requires at least one log file (lint.log, test.log, etc.)
- Doesn't validate log contents (just checks existence)

---

### 4.4 Testing Evidence-Based Review

**Setup:**

1. Enable validation requirement:
   ```yaml
   review:
     require_validation: true
   ```

2. Create a ticket (via promote or normal workflow)

3. Complete the work but **skip validation**

4. Try to mark ticket as completed

**Expected behavior:**

```
[Agent] Marking ticket T042 as completed...
[Hook] Review gate BLOCKED

Review blocked: Validation required but no artifacts found.

Run validation:
  takt validate T042

Or disable requirement in .takt/config.yaml:
  review:
    require_validation: false
```

**Fix:**

```bash
takt validate T042
```

**Output:**
```
[Takt] Validating: T042 (preset: python)

Running validation commands:
  ✓ ruff check . (0.3s)
  ✓ mypy src (1.2s)
  ✓ pytest tests (4.8s)

Validation complete! All checks passed.

Logs saved to: .takt/artifacts/ticket/T042/logs/
```

**Retry completion:**

Now review-gate finds artifacts and allows completion.

---

## 5. Troubleshooting

### 5.1 "Context gathering unavailable"

**Symptoms:**

```
[Takt] Warning: Context gathering failed
Creating quick entry without context data
```

**Causes:**

1. Node.js version too old (< 18.0.0)
2. Not in a git repository
3. Git not installed
4. Permissions issue in project directory

**Solutions:**

**Check Node.js version:**
```bash
node --version
# Should be >= 18.0.0
```

**Initialize git repo:**
```bash
git init
git add .
git commit -m "Initial commit"
```

**Check git installation:**
```bash
git --version
# Should show: git version 2.x.x
```

**Check permissions:**
```bash
ls -la .takt/
# Ensure you have write access
```

---

### 5.2 "No preset detected"

**Symptoms:**

```
[Takt] Error: No validation preset detected

Create .takt/config.yaml with custom commands:

  validate:
    preset: custom
    commands:
      - name: "Lint"
        command: "your-linter ."
      - name: "Tests"
        command: "your-test-runner"
```

**Causes:**

- Project is not Python or Node.js
- No `package.json`, `pyproject.toml`, or `setup.py` found

**Solutions:**

**Option 1: Create config.yaml with custom preset**

```yaml
validate:
  preset: custom
  commands:
    - name: "Lint"
      command: "rubocop ."  # Example: Ruby linter
      required: true
    - name: "Tests"
      command: "rspec"  # Example: Ruby tests
      required: true
```

**Option 2: Add missing project file**

For Python:
```bash
touch pyproject.toml  # or setup.py
```

For Node:
```bash
npm init -y  # Creates package.json
```

**Option 3: Force a preset**

```yaml
validate:
  preset: python  # or node
```

---

### 5.3 "Validation command not found"

**Symptoms:**

```
[Takt] Validating: 20260216-143022_task (preset: python)

Running validation commands:
  ⚠ Lint (ruff) - Skipped: ruff not found
  ⚠ Type Check (mypy) - Skipped: mypy not found
  ✓ Tests (pytest) (4.8s)

Validation complete with warnings.
```

**Causes:**

- Tool not installed (ruff, mypy, eslint, etc.)
- Tool not in PATH

**Solutions:**

**Install missing tools:**

Python:
```bash
pip install ruff mypy pytest
# or
uv pip install ruff mypy pytest
```

Node:
```bash
npm install --save-dev eslint jest
```

**Or disable specific checks:**

```yaml
validate:
  preset: python
  python:
    mypy_enabled: false  # Skip mypy if not needed
```

**Or skip validation entirely:**

```bash
takt quick "task" --no-validate
```

---

### 5.4 "Quick entry not found"

**Symptoms:**

```
[Takt] Error: Quick entry '20260216-143022_task' not found

Available entries:
  20260216-150833_other-task
  20260215-091200_old-task
```

**Causes:**

- Typo in quick ID
- Entry was deleted
- Using wrong working directory

**Solutions:**

**List available entries:**
```bash
ls .takt/quick/
```

**Use correct ID:**
```bash
takt validate 20260216-150833_other-task
```

**Or validate latest (no ID needed):**
```bash
takt validate
```

---

### 5.5 "Promote failed"

**Symptoms:**

```
[Takt] Error: Cannot promote - entry already promoted

Quick entry: 20260216-143022_task
Already promoted to: T042
Promoted at: 2026-02-16 14:45:30
```

**Causes:**

- Entry was already promoted
- Attempting to promote twice

**Solutions:**

**Check quick.md status:**
```bash
cat .takt/quick/20260216-143022_task/quick.md | grep Status
# Status: promoted
```

**Find promoted ticket:**
```bash
find .takt/tickets/ -name "*task.md"
# .takt/tickets/milestones/M001-scaffolding/T042-takt-backend-task.md
```

**If promotion was a mistake:**

Manually revert (advanced):
1. Edit quick.md: change `Status: promoted` to `Status: done`
2. Remove `Promoted` and `PromotedAt` fields
3. Re-run `takt promote`

---

### 5.6 "Milestone structure missing"

**Symptoms:**

```
[Takt] Error: Cannot create ticket - milestone structure missing

Run: takt plan
```

**Causes:**

- Trying to promote to a milestone that doesn't exist
- `.takt/tickets/milestones/` directory missing

**Solutions:**

**Option 1: Let promote create ad-hoc milestone**
```bash
takt promote  # No --milestone flag
# Creates: M-quick-YYYYMMDD-HHMMSS/
```

**Option 2: Run structured mode planning**
```bash
takt "Build feature X"
# Creates full milestone structure
```

**Option 3: Manually create milestone directory**
```bash
mkdir -p .takt/tickets/milestones/M001-custom/
takt promote --milestone M001-custom
```

---

## 6. Quick Reference

### 6.1 Common Commands

```bash
# Create quick entry
takt quick "title" [--type TYPE] [--no-validate]

# Validate latest entry
takt validate

# Validate specific entry
takt validate <QUICK_ID>

# Force preset
takt validate --preset python

# Strict mode (fail on errors)
takt validate --strict

# Promote latest entry
takt promote

# Promote to existing milestone
takt promote --milestone M001-scaffolding

# Promote and assign
takt promote --milestone M002-api --agent takt-backend

# List quick entries
ls .takt/quick/
```

### 6.2 Entry Types

| Type | Use Case |
|------|----------|
| `feat` | New feature or enhancement |
| `fix` | Bug fix |
| `docs` | Documentation update |
| `refactor` | Code refactoring |
| `research` | Research spike or exploration |

### 6.3 Directory Quick Reference

```
.takt/
  quick/
    <id>/quick.md               # Work record
  artifacts/
    quick/<id>/
      context.json              # Environment context
      logs/*.log                # Validation output
    ticket/<id>/
      context.json              # Copied from quick
      logs/*.log                # Copied from quick
  config.yaml                   # Optional configuration
```

### 6.4 Config.yaml Template

```yaml
# Quick Mode
quick:
  default_type: feat
  auto_validate: true
  strict_validation: false

# Validation
validate:
  preset: auto  # auto | python | node | custom
  timeout: 300000

  # Python preset
  python:
    prefer_uv: true
    mypy_enabled: true
    pytest_args: ""

  # Node preset
  node:
    package_manager: auto
    lint_script: "lint"
    test_script: "test"

  # Custom preset
  commands: []
    # - name: "Lint"
    #   command: "make lint"
    #   required: true

# Review Integration
review:
  require_validation: false
  require_test_artifacts: false

# Artifacts
artifacts:
  retention: all  # all | promoted-only | none
  max_log_size: 1048576
```

---

**Last Updated:** 2026-02-16
**Contributors:** Takt Team
