# Takt Quick Mode + Validation — Architecture

**Version:** 0.3.0
**Date:** 2026-02-16
**Status:** Draft

---

## 1. High-Level Modules

```
┌─────────────────────────────────────────────────────────────┐
│ Skills Layer (User Interface)                               │
├─────────────────────────────────────────────────────────────┤
│ skills/quick/SKILL.md       ← takt quick CLI entry point    │
│ skills/validate/SKILL.md    ← takt validate CLI entry point │
│ skills/promote/SKILL.md     ← takt promote CLI entry point  │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Scripts Layer (Business Logic)                              │
├─────────────────────────────────────────────────────────────┤
│ scripts/context.mjs         ← Gather git/tree/lang context  │
│ scripts/validate.mjs        ← Run validation commands       │
│ scripts/yaml-parse.mjs      ← Parse config.yaml (minimal)   │
│ scripts/review-gate.mjs     ← (Extended) Check validation   │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Templates Layer (Content Generation)                        │
├─────────────────────────────────────────────────────────────┤
│ templates/quick.md          ← Quick entry markdown template │
│ templates/ticket.md         ← (Existing) Ticket template    │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ State Layer (Persistent Storage)                            │
├─────────────────────────────────────────────────────────────┤
│ .takt/quick/<id>/quick.md   ← Work record per entry         │
│ .takt/artifacts/quick/<id>/ ← Context + logs                │
│ .takt/artifacts/ticket/<id>/← Promoted artifacts            │
│ .takt/config.yaml           ← Project-level configuration   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model

### 2.1 Quick Entry Schema

**File:** `.takt/quick/<id>/quick.md`

```markdown
# Quick: <title>

**ID:** <id>
**Type:** <type>
**Status:** <status>
**Created:** <timestamp>
**Updated:** <timestamp>
**Promoted:** <ticket-id>  (if promoted)
**PromotedAt:** <timestamp>  (if promoted)

## Goal

[User-provided description]

## Steps

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

## Acceptance Checks

- [ ] Check 1
- [ ] Check 2

## Notes

[User notes during work]

## Validation Results

[Appended by takt validate]

## Context

Git Branch: <branch>
Git Status: <status>
Languages: <detected-languages>
Context Artifact: .takt/artifacts/quick/<id>/context.json
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ID` | String | Yes | `YYYYMMDD-HHMMSS_slug` |
| `Type` | Enum | Yes | `feat` / `fix` / `docs` / `refactor` / `research` |
| `Status` | Enum | Yes | `todo` / `in-progress` / `done` / `promoted` |
| `Created` | ISO 8601 | Yes | Creation timestamp |
| `Updated` | ISO 8601 | Yes | Last update timestamp |
| `Promoted` | String | No | Ticket ID if promoted (e.g., `T042`) |
| `PromotedAt` | ISO 8601 | No | Promotion timestamp |

---

### 2.2 Artifact Directory Schema

**Quick entry artifacts:**
```
.takt/artifacts/quick/<id>/
  context.json          # Git status, file tree, detected languages
  logs/
    lint.log            # Linter output (stdout + stderr)
    test.log            # Test runner output
    typecheck.log       # Type checker output
    custom-<name>.log   # Custom validation command output
```

**context.json schema:**
```json
{
  "id": "20260216-143022_add-retry-logic",
  "created": "2026-02-16T14:30:22Z",
  "git": {
    "branch": "main",
    "status": "M src/api/client.py\n?? tests/test_retry.py",
    "root": "/Users/seongjinpark/dev/myproject"
  },
  "tree": {
    "files": 142,
    "directories": 18,
    "total_size": 584923,
    "languages": ["python", "markdown"]
  },
  "environment": {
    "node_version": "18.20.1",
    "python_version": "3.11.5",
    "platform": "darwin"
  }
}
```

**Ticket artifacts (after promotion):**
```
.takt/artifacts/ticket/T042/
  context.json          # Copied from quick entry
  logs/                 # Copied from quick entry
    lint.log
    test.log
    typecheck.log
```

---

### 2.3 Config Schema (`.takt/config.yaml`)

**Full schema with defaults:**

```yaml
# Quick Mode Configuration
quick:
  default_type: feat                  # Default entry type
  auto_validate: true                 # Run validation on completion
  strict_validation: false            # Exit with error on validation failure

# Validation Configuration
validate:
  preset: auto                        # auto | python | node | custom
  timeout: 300000                     # Milliseconds (5 minutes)

  # Python-specific settings
  python:
    prefer_uv: true                   # Use uv if available, else pip
    mypy_enabled: true                # Run mypy type checking
    pytest_args: ""                   # Additional pytest arguments

  # Node-specific settings
  node:
    package_manager: auto             # auto | npm | yarn | pnpm
    lint_script: "lint"               # package.json script name
    test_script: "test"               # package.json script name

  # Custom commands (used when preset: custom)
  commands: []
    # - name: "Lint"
    #   command: "make lint"
    #   required: true
    # - name: "Tests"
    #   command: "make test"
    #   required: false

# Review Integration
review:
  require_validation: false           # Block review-gate if validation missing
  require_test_artifacts: false       # Block review-gate if test logs missing

# Artifact Management
artifacts:
  retention: all                      # all | promoted-only | none
  max_log_size: 1048576              # 1MB default (bytes)
```

**Validation rules:**
- All fields optional (defaults apply)
- Timeout min: 1000ms, max: 600000ms (10 minutes)
- `max_log_size` min: 10KB, max: 10MB
- `preset` must be one of: `auto`, `python`, `node`, `custom`
- If `preset: custom`, `commands` array must not be empty

---

## 3. Integration Points

### 3.1 Quick Mode → Structured Mode (Promote)

**Data flow:**

```
Quick Entry                     Ticket File
─────────────                   ────────────
Title          ───────────────► Title
Type           ───────────────► Type
Steps          ───────────────► Acceptance Criteria
Checks         ───────────────► Acceptance Criteria
Notes          ───────────────► Notes
ID             ───────────────► Origin: quick:<id>

Artifacts                       Artifacts
─────────                       ─────────
.takt/artifacts/quick/<id>/  ──► .takt/artifacts/ticket/T###/
  context.json                     context.json (copy)
  logs/                            logs/ (copy)
```

**Promotion triggers:**
1. Manual: `takt promote <id>`
2. No automatic promotion (user decides)

**Post-promotion state:**
- Quick entry: `Status: promoted`, `Promoted: T###`
- Ticket: `Origin: quick:<id>` in metadata
- Artifacts: Copied (originals preserved)
- Quick entry remains readable for historical reference

---

### 3.2 Validation → Review Gate Integration

**Hook extension:** `scripts/review-gate.mjs`

**New behavior (when `review.require_validation: true`):**

```javascript
// Existing checks (unchanged)
1. Acceptance criteria checkboxes (all checked)
2. Ticket status field ("completed")
3. Agent has commits on worktree branch

// New check (conditional)
4. If config.yaml has review.require_validation: true
   → Check for validation artifacts
   → Block if missing, suggest: takt validate
```

**Artifact check logic:**

```javascript
const artifactDir = `.takt/artifacts/ticket/${ticketId}/logs/`;
const hasValidation = fs.existsSync(artifactDir) &&
                      fs.readdirSync(artifactDir).length > 0;

if (requireValidation && !hasValidation) {
  return {
    block: true,
    message: "Validation required but no artifacts found. Run: takt validate"
  };
}
```

**Integration modes:**

| `require_validation` | Behavior |
|---------------------|----------|
| `false` (default) | Validation optional, no blocking |
| `true` | Block review-gate if no validation artifacts |

---

## 4. Hooks / Gates

### 4.1 scope-guard.mjs (Unchanged)

**Event:** PreToolUse (Write, Edit, NotebookEdit)

**Behavior:**
- Blocks writes outside agent's allowed paths
- Enforces worktree isolation
- No changes needed for quick mode (user works directly, no agent boundaries)

---

### 4.2 review-gate.mjs (Extended)

**Event:** Invoked programmatically by orchestrator

**Existing checks:**
1. Acceptance criteria checkboxes
2. Ticket status field
3. Agent worktree commits

**New check (optional):**
4. Validation artifacts (if `review.require_validation: true`)

**Implementation:**

```javascript
// Read config
const config = parseYaml('.takt/config.yaml');
const requireValidation = config?.review?.require_validation || false;

if (requireValidation) {
  const artifactDir = `.takt/artifacts/ticket/${ticketId}/logs/`;

  if (!fs.existsSync(artifactDir) || fs.readdirSync(artifactDir).length === 0) {
    return {
      block: true,
      message: [
        "Review blocked: Validation required but no artifacts found.",
        "",
        "Run validation:",
        `  takt validate ${ticketId}`,
        "",
        "Or disable requirement in .takt/config.yaml:",
        "  review:",
        "    require_validation: false"
      ].join('\n')
    };
  }
}
```

**Exit codes:**
- `0`: Allow (all checks pass)
- `2`: Block (validation missing or other gate failure)
- `1`: Error (script failure)

---

## 5. State File Interactions

### Component Read/Write Matrix

| Component | Reads | Writes |
|-----------|-------|--------|
| **skills/quick/SKILL.md** | config.yaml (optional) | quick.md, context.json |
| **skills/validate/SKILL.md** | quick.md, config.yaml | Logs (*.log), quick.md (append) |
| **skills/promote/SKILL.md** | quick.md, takt-state.json, registry.json | ticket.md, quick.md (update status), artifacts (copy) |
| **scripts/context.mjs** | Git status, file tree | context.json |
| **scripts/validate.mjs** | config.yaml | Logs (*.log) |
| **scripts/yaml-parse.mjs** | config.yaml | None |
| **scripts/review-gate.mjs** | ticket.md, config.yaml, artifacts/ | None |

### File Dependencies

```
config.yaml
  ├─ skills/quick/SKILL.md (default_type, auto_validate)
  ├─ skills/validate/SKILL.md (preset, timeout, commands)
  ├─ scripts/validate.mjs (preset, timeout, commands)
  └─ scripts/review-gate.mjs (require_validation)

quick.md
  ├─ skills/validate/SKILL.md (read for context, append results)
  └─ skills/promote/SKILL.md (extract all fields)

context.json
  ├─ scripts/context.mjs (writes)
  └─ skills/promote/SKILL.md (copies to ticket artifacts)

takt-state.json
  └─ skills/promote/SKILL.md (ticket ID counter)

registry.json
  └─ skills/promote/SKILL.md (agent assignment validation)
```

---

## 6. Module Details

### 6.1 scripts/context.mjs

**Purpose:** Gather project context for quick entries

**Inputs:**
- `process.cwd()` (current working directory)
- Git repository state
- File system tree

**Outputs:**
- `context.json` written to artifacts directory

**Logic:**
1. Detect git root: `git rev-parse --show-toplevel`
2. Get current branch: `git branch --show-current`
3. Get git status: `git status --short`
4. Count files/directories (exclude `.git/`, `node_modules/`, `.takt/`)
5. Detect languages from file extensions
6. Get environment: Node.js version, Python version, platform
7. Write JSON to artifact path

**Error handling:**
- If not in git repo: continue with `git: null`
- If git commands fail: log warning, continue
- If file tree scan fails: estimate from `ls -R`

---

### 6.2 scripts/validate.mjs

**Purpose:** Run validation commands based on preset

**Inputs:**
- CLI args: `<quick_id>`, `--preset`, `--strict`
- `config.yaml` (optional)
- Project files (`package.json`, `pyproject.toml`, etc.)

**Outputs:**
- Log files: `.takt/artifacts/quick/<id>/logs/*.log`
- Validation summary (returned to skill)

**Logic:**
1. Resolve quick ID (explicit or latest)
2. Read config.yaml if exists
3. Detect preset if `auto`:
   - Check for `package.json` → node
   - Check for `pyproject.toml` or `setup.py` → python
   - No detection → error with help message
4. Build command list based on preset
5. For each command:
   - Spawn child process with timeout
   - Capture stdout and stderr
   - Record exit code and duration
   - Write to log file (truncate if > max_log_size)
6. Generate summary table
7. Return results to caller

**Timeout handling:**
- Use `child_process.spawn` with `timeout` option
- If timeout exceeded: kill process, mark as failed
- Log timeout error to stderr log

**Skip logic:**
- Python: Skip mypy if not installed or disabled
- Node: Skip if package.json script missing
- Custom: Fail if all commands skip and at least one is required

---

### 6.3 scripts/yaml-parse.mjs

**Purpose:** Minimal YAML parser for config.yaml

**Limitations:**
- 2-level nesting max
- No advanced YAML features (anchors, references, multi-line)
- Simple key-value and nested objects only

**Example supported:**

```yaml
quick:
  default_type: feat
  auto_validate: true
validate:
  preset: python
  timeout: 300000
  commands:
    - name: Lint
      command: make lint
```

**Implementation:**
- Line-by-line parsing
- Indentation detection (2 or 4 spaces)
- Array items (lines starting with `-`)
- Boolean coercion: `true`, `false`
- Number coercion: matches `/^\d+$/`
- String default: everything else

**Not supported:**
- Multi-line strings
- Comments (stripped)
- Quoted strings with special chars
- 3+ level nesting

**Rationale:** Zero dependencies, good enough for config needs

---

### 6.4 templates/quick.md

**Purpose:** Quick entry markdown template

**Placeholders:**

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{{ID}}` | Generated | `20260216-143022_add-retry-logic` |
| `{{TITLE}}` | CLI arg | `Add retry logic to API client` |
| `{{TYPE}}` | CLI arg or default | `feat` |
| `{{STATUS}}` | Static | `todo` |
| `{{CREATED}}` | Timestamp | `2026-02-16 14:30:22` |
| `{{UPDATED}}` | Timestamp | `2026-02-16 14:30:22` |
| `{{GIT_BRANCH}}` | context.json | `main` |
| `{{GIT_STATUS}}` | context.json | `M src/api/client.py` |
| `{{LANGUAGES}}` | context.json | `python, markdown` |
| `{{CONTEXT_PATH}}` | Generated | `.takt/artifacts/quick/20260216-143022_add-retry-logic/context.json` |

**Template:**
```markdown
# Quick: {{TITLE}}

**ID:** {{ID}}
**Type:** {{TYPE}}
**Status:** {{STATUS}}
**Created:** {{CREATED}}
**Updated:** {{UPDATED}}

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

Git Branch: {{GIT_BRANCH}}
Git Status: {{GIT_STATUS}}
Languages: {{LANGUAGES}}
Context Artifact: {{CONTEXT_PATH}}
```

---

## 7. Validation Preset Implementation

### 7.1 Python Preset

**Detection:**
```javascript
const isPython = fs.existsSync('pyproject.toml') ||
                 fs.existsSync('setup.py') ||
                 fs.existsSync('requirements.txt');
```

**Command builder:**
```javascript
function buildPythonCommands(config) {
  const commands = [];

  // Lint
  if (commandExists('ruff')) {
    commands.push({
      name: 'Lint',
      command: 'ruff check .',
      logFile: 'lint.log'
    });
  }

  // Type check
  if (config.python.mypy_enabled && commandExists('mypy')) {
    commands.push({
      name: 'Type Check',
      command: 'mypy src',
      logFile: 'typecheck.log'
    });
  }

  // Tests
  if (fs.existsSync('tests/') && commandExists('pytest')) {
    const args = config.python.pytest_args || '';
    commands.push({
      name: 'Tests',
      command: `pytest tests ${args}`.trim(),
      logFile: 'test.log'
    });
  }

  return commands;
}
```

---

### 7.2 Node Preset

**Package manager detection:**
```javascript
function detectPackageManager() {
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (fs.existsSync('yarn.lock')) return 'yarn';
  if (fs.existsSync('package-lock.json')) return 'npm';
  return 'npm'; // default
}
```

**Command builder:**
```javascript
function buildNodeCommands(config) {
  const pm = config.node.package_manager === 'auto'
    ? detectPackageManager()
    : config.node.package_manager;

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const commands = [];

  // Lint
  if (pkg.scripts?.[config.node.lint_script]) {
    commands.push({
      name: 'Lint',
      command: `${pm} run ${config.node.lint_script}`,
      logFile: 'lint.log'
    });
  }

  // Tests
  if (pkg.scripts?.[config.node.test_script]) {
    commands.push({
      name: 'Tests',
      command: `${pm} run ${config.node.test_script}`,
      logFile: 'test.log'
    });
  }

  // Build
  if (pkg.scripts?.build) {
    commands.push({
      name: 'Build',
      command: `${pm} run build`,
      logFile: 'build.log'
    });
  }

  return commands;
}
```

---

## 8. Error Handling

### 8.1 Quick Entry Creation

| Error | Handling |
|-------|----------|
| `.takt/` doesn't exist | Create it (run init-project.mjs) |
| ID collision (unlikely) | Increment timestamp by 1 second, retry |
| Context gathering fails | Warn, create entry with partial context |
| Template rendering fails | Fatal error, don't create entry |

---

### 8.2 Validation

| Error | Handling |
|-------|----------|
| Quick entry not found | Fatal error: "Quick entry <id> not found" |
| No preset detected | Fatal error with help message |
| All commands skipped | Fatal error: "No validation commands available" |
| Command timeout | Mark as failed, log timeout in stderr |
| Command not found | Skip with warning (unless required) |
| Log too large | Truncate with message |

---

### 8.3 Promotion

| Error | Handling |
|-------|----------|
| Quick entry not found | Fatal error |
| Quick entry already promoted | Fatal error: "Already promoted to T###" |
| Milestone doesn't exist | Create ad-hoc milestone |
| Agent doesn't exist | Warn, leave unassigned |
| Ticket ID conflict | Re-scan and increment |
| Artifact copy fails | Warn, continue (not critical) |

---

## 9. Performance Considerations

### 9.1 Context Gathering

**Optimization:**
- Skip deep recursion in large directories (> 10,000 files)
- Use `git ls-files` instead of `fs.readdir` when in git repo
- Cache language detection results

**Timeout:** 5 seconds max

---

### 9.2 Validation

**Parallelization:**
- Run all commands sequentially (not parallel)
- Rationale: Avoid resource contention, logs are easier to read

**Timeout:**
- Default: 5 minutes total
- Per-command: Use config.yaml timeout / command count
- Allow override via `--timeout` flag

---

### 9.3 YAML Parsing

**Performance:**
- Simple line-by-line parsing: O(n) where n = line count
- No regex complexity
- Typical config.yaml: < 50 lines, < 1ms parse time

---

## 10. Security Considerations

### 10.1 Command Injection

**Risk:** Custom commands in config.yaml could contain shell injection

**Mitigation:**
- No shell expansion in command strings
- Use `child_process.spawn` with array args, not `exec`
- Example: `spawn('pytest', ['tests', userArgs])`, NOT `exec('pytest tests ' + userArgs)`

---

### 10.2 Path Traversal

**Risk:** Malicious quick ID could escape `.takt/` directory

**Mitigation:**
- Validate quick ID format: `/^\d{8}-\d{6}_[a-z0-9\-]{1,40}$/`
- Reject if doesn't match
- Use `path.join()` and check `startsWith('.takt/')` before any file ops

---

### 10.3 Log Size Limits

**Risk:** Validation output could fill disk

**Mitigation:**
- Enforce `max_log_size` (default 1MB)
- Truncate at limit with clear message
- Configurable but capped at 10MB

---

## 11. Testing Strategy

### 11.1 Unit Tests (scripts/)

**Modules to test:**
- `yaml-parse.mjs`: Valid YAML, invalid YAML, edge cases
- `context.mjs`: Git repo, non-git directory, permission errors
- `validate.mjs`: Each preset, custom commands, timeouts

**Test framework:** Node.js built-in `node:test` (zero deps)

---

### 11.2 Integration Tests (skills/)

**Scenarios:**
1. Create quick entry → validate → promote → verify ticket
2. Python project → auto-detect → validate
3. Node project → auto-detect → validate
4. Custom config → validate with custom commands
5. Promotion to existing milestone
6. Promotion to ad-hoc milestone
7. Review gate with validation requirement

**Test setup:** Isolated `.takt/` directory per test

---

### 11.3 End-to-End Tests

**Full workflows:**
1. Quick fix in Python project (ruff + mypy + pytest)
2. Quick feature in Node project (lint + test)
3. Research spike (no validation)
4. Promote to structured mode ticket
5. Review gate blocks without validation

**Validation:** Check generated files, artifacts, status updates

---

**Last Updated:** 2026-02-16
**Contributors:** Takt Team
