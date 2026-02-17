# Takt Quick Mode + Validation — Product Specification

**Version:** 0.3.0
**Date:** 2026-02-16
**Status:** Draft

---

## 1. Problem Statement

Takt's structured mode (agents, tickets, milestones) is designed for complex multi-component projects. It excels at orchestrating teams of specialists across parallel work streams with dependency management and code review gates.

But it's **overkill for small tasks**:

- Fixing a single bug that touches 2 files
- Adding a small utility function
- Researching a library API
- Updating documentation
- Quick experiments or spikes

Users who want Takt's legibility and tracking without the orchestration overhead currently have no option. They either:
1. Use Takt structured mode and pay the full planning cost
2. Skip Takt entirely and lose all tracking

**What's needed**: A lightweight mode that provides:
- Fast entry (one command, no planning)
- Readable work records (what, why, outcome)
- Optional validation (build, test, lint)
- Promotion path to structured mode when scope grows

---

## 2. Users

| User Type | Use Case | Pain Point |
|-----------|----------|------------|
| **Solo developer** | Quick bug fixes between features | Don't want to plan agents/milestones for 5-minute tasks |
| **Researcher** | Exploring unfamiliar codebase | Need to track findings and decisions without formal tickets |
| **Team member** | Small improvements while waiting | Want lightweight tracking that can escalate if needed |
| **Documentation writer** | Content updates | Need validation but not full orchestration |

---

## 3. Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| Replace structured mode | Both modes serve different purposes |
| Support non-Claude-Code environments | Takt is a Claude Code plugin |
| Provide general-purpose task management | Focus on code-adjacent tasks only |
| Support multi-agent quick tasks | Use structured mode if you need specialists |
| Automatic mode switching | User decides when to promote |

---

## 4. Modes Definition

### Comparison Table

| Aspect | Quick Mode | Structured Mode |
|--------|-----------|-----------------|
| **Entry point** | `takt quick "Fix auth timeout"` | `takt "Build todo app"` |
| **Planning** | None | 3-question interview + auto-planning |
| **Agents** | None (user works directly) | Dynamic roster from templates |
| **Tracking** | Single `quick.md` file per entry | Tickets, milestones, state files |
| **Review** | Optional validation | Mandatory review gates |
| **Scope** | Single task | Full project |
| **State files** | No session.json changes | session.json, takt-state.json, registry.json |
| **Validation** | `takt validate` (opt-in) | Build + test + peer review (mandatory) |
| **Promotion** | Can promote to ticket via `takt promote` | N/A |
| **Duration** | Minutes to hours | Days to weeks |
| **Directory** | `.takt/quick/<id>/quick.md` | `.takt/tickets/milestones/M###-*/` |
| **Artifacts** | `.takt/artifacts/quick/<id>/` | `.takt/artifacts/ticket/<id>/` |

### When to Use Which Mode

**Use Quick Mode when:**
- Task fits in one session
- No need for specialists (backend/frontend/etc)
- Scope is clear and bounded
- No dependencies on other tasks

**Use Structured Mode when:**
- Multi-component project
- Need specialized agents
- Work spans multiple sessions
- Complex dependency graph
- Mandatory review required

---

## 5. CLI Commands & UX

### 5.1 `takt quick` — Create Quick Entry

**Syntax:**
```bash
takt quick "title" [--type TYPE] [--no-validate]
```

**Parameters:**
- `title` (required): Short description of the task
- `--type TYPE` (optional): `feat` / `fix` / `docs` / `refactor` / `research` (default: `feat`)
- `--no-validate` (optional): Skip automatic validation after completion

**Example:**
```bash
# Default (feat, with validation)
takt quick "Add retry logic to API client"

# Bug fix, skip validation
takt quick "Fix off-by-one error in pagination" --type fix --no-validate

# Documentation update
takt quick "Update installation guide" --type docs
```

**Behavior:**
1. Generate unique quick ID: `YYYYMMDD-HHMMSS_slug` (e.g., `20260216-143022_add-retry-logic`)
2. Create directory: `.takt/quick/<id>/`
3. Gather context via `scripts/context.mjs` (git status, file tree, detected languages)
4. Save context artifact: `.takt/artifacts/quick/<id>/context.json`
5. Render quick.md from template with pre-filled metadata
6. Write `.takt/quick/<id>/quick.md`
7. Print confirmation with file path and next steps

**Output:**
```
[Takt] Quick entry created: 20260216-143022_add-retry-logic

  File: .takt/quick/20260216-143022_add-retry-logic/quick.md
  Type: feat

Next steps:
  1. Complete the work (edit quick.md to track progress)
  2. Run: takt validate
  3. (Optional) Run: takt promote
```

---

### 5.2 `takt validate` — Run Validation

**Syntax:**
```bash
takt validate [QUICK_ID] [--preset PRESET] [--strict]
```

**Parameters:**
- `QUICK_ID` (optional): ID of quick entry to validate (default: latest)
- `--preset PRESET` (optional): `auto` / `python` / `node` / `custom` (default: `auto`)
- `--strict` (optional): Exit with error if any validation fails

**Example:**
```bash
# Auto-detect preset, validate latest entry
takt validate

# Validate specific entry
takt validate 20260216-143022_add-retry-logic

# Force Python preset
takt validate --preset python

# Strict mode (fail on warnings)
takt validate --strict
```

**Behavior:**
1. Resolve quick ID (explicit or latest)
2. Read `.takt/config.yaml` (if exists) for validation settings
3. Detect preset (unless explicit):
   - `python`: if `pyproject.toml` or `setup.py` exists
   - `node`: if `package.json` exists
   - `custom`: if `config.yaml` has custom commands
4. Run preset commands (see §6 Validation Presets)
5. Capture stdout, stderr, exit code for each command
6. Save logs to `.takt/artifacts/quick/<id>/logs/{lint,test,typecheck}.log`
7. Generate validation summary (markdown table)
8. Append summary to `quick.md`
9. Print results

**Output:**
```
[Takt] Validating: 20260216-143022_add-retry-logic (preset: python)

Running validation commands:
  ✓ ruff check . (0.3s)
  ✓ mypy src (1.2s)
  ✓ pytest tests (4.8s)

Validation complete! All checks passed.

Logs saved to: .takt/artifacts/quick/20260216-143022_add-retry-logic/logs/
```

**Validation summary format (appended to quick.md):**
```markdown
## Validation Results

| Check | Status | Duration | Details |
|-------|--------|----------|---------|
| Lint (ruff) | ✓ Pass | 0.3s | 0 errors, 0 warnings |
| Type Check (mypy) | ✓ Pass | 1.2s | Success: no issues found |
| Tests (pytest) | ✓ Pass | 4.8s | 42 passed |

Validated at: 2026-02-16 14:35:10
Preset: python
Logs: `.takt/artifacts/quick/20260216-143022_add-retry-logic/logs/`
```

---

### 5.3 `takt promote` — Promote to Ticket

**Syntax:**
```bash
takt promote [QUICK_ID] [--milestone MILESTONE_ID] [--agent AGENT_NAME]
```

**Parameters:**
- `QUICK_ID` (optional): ID of quick entry to promote (default: latest)
- `--milestone MILESTONE_ID` (optional): Target milestone (default: create ad-hoc milestone)
- `--agent AGENT_NAME` (optional): Assign to agent (default: unassigned)

**Example:**
```bash
# Promote latest, auto-create milestone
takt promote

# Promote specific entry to existing milestone
takt promote 20260216-143022_add-retry-logic --milestone M001-scaffolding

# Promote and assign to backend agent
takt promote --milestone M002-api --agent takt-backend
```

**Behavior:**
1. Resolve quick ID (explicit or latest)
2. Read `.takt/quick/<id>/quick.md`
3. Extract: title, type, steps, checks, notes
4. Determine milestone:
   - Explicit `--milestone` → use that
   - No explicit → check if active milestone exists
   - No active milestone → create ad-hoc: `M-quick-YYYYMMDD-HHMMSS/`
5. Generate ticket ID: scan all `T###` files, increment max
6. Render ticket template from quick entry data
7. Add `Origin: quick:<id>` metadata to ticket
8. Write ticket file: `.takt/tickets/milestones/<milestone>/T###-<agent>-<title>.md`
9. Copy artifacts: `.takt/artifacts/quick/<id>/` → `.takt/artifacts/ticket/T###/`
10. Update quick.md: `Status: promoted`, `Promoted: T###`, `PromotedAt: <timestamp>`
11. Print confirmation

**Output:**
```
[Takt] Promoted quick entry to ticket

  From: .takt/quick/20260216-143022_add-retry-logic/quick.md
  To:   .takt/tickets/milestones/M001-scaffolding/T042-takt-backend-add-retry-logic.md

  Milestone: M001-scaffolding
  Agent:     takt-backend (assigned)
  Artifacts: Copied (context.json + validation logs)

Next: Assign to an agent or run takt execute
```

**Promoted ticket format:**
```markdown
# T042 — Add retry logic to API client

**Milestone:** M001-scaffolding
**Agent:** takt-backend
**Type:** feat
**Status:** todo
**Origin:** quick:20260216-143022_add-retry-logic
**Created:** 2026-02-16 14:30:22
**Promoted:** 2026-02-16 14:40:15

## Description

[Copied from quick.md]

## Acceptance Criteria

[Copied from quick.md steps/checks]

## Notes

[Copied from quick.md notes]

## Context

Original quick entry: `.takt/quick/20260216-143022_add-retry-logic/quick.md`
Validation logs: `.takt/artifacts/ticket/T042/logs/`
```

---

## 6. Artifacts / Legibility Conventions

### 6.1 Directory Structure

```
.takt/
  quick/
    20260216-143022_add-retry-logic/
      quick.md                    # Primary work record
    20260216-150833_fix-timeout/
      quick.md
  artifacts/
    quick/
      20260216-143022_add-retry-logic/
        context.json              # Git status, file tree, languages
        logs/
          lint.log                # Linter output
          test.log                # Test runner output
          typecheck.log           # Type checker output
    ticket/
      T042/
        context.json              # Copied from quick entry
        logs/                     # Copied from quick entry
```

### 6.2 Naming Conventions

**Quick ID format:** `YYYYMMDD-HHMMSS_slug`
- Timestamp: Second precision (collision-proof for human use)
- Slug: Lowercase, hyphenated, max 40 chars
- Example: `20260216-143022_add-retry-logic`

**Artifact paths:**
- Context: `.takt/artifacts/<mode>/<id>/context.json`
- Logs: `.takt/artifacts/<mode>/<id>/logs/<check>.log`
- Mode: `quick` or `ticket`

### 6.3 Retention Policy

**Configurable via `.takt/config.yaml`:**

```yaml
artifacts:
  retention: all  # all | promoted-only | none
  max_log_size: 1048576  # 1MB default
```

| Retention | Behavior |
|-----------|----------|
| `all` (default) | Keep all artifacts indefinitely |
| `promoted-only` | Delete quick artifacts after promotion |
| `none` | Don't create artifacts (context only) |

**Log size limit:**
- Logs exceeding `max_log_size` are truncated with warning
- Truncation message appended: `[... output truncated to 1MB ...]`

---

## 7. Promote Workflow

### Step-by-Step Data Flow

```
┌─────────────────────────────────────┐
│ Quick Entry (Source)                │
│ .takt/quick/<id>/quick.md           │
│                                     │
│ - Title                             │
│ - Type                              │
│ - Steps                             │
│ - Checks                            │
│ - Notes                             │
│ - Validation results                │
└─────────────────────────────────────┘
            │
            ├─ Extract metadata
            │
            ▼
┌─────────────────────────────────────┐
│ Milestone Resolution                │
│                                     │
│ - Explicit: use --milestone arg     │
│ - Active: use current milestone     │
│ - None: create M-quick-timestamp/   │
└─────────────────────────────────────┘
            │
            ├─ Scan existing tickets
            │
            ▼
┌─────────────────────────────────────┐
│ Ticket ID Generation                │
│                                     │
│ - Find max T### in all milestones  │
│ - Increment by 1                    │
│ - Format: T042                      │
└─────────────────────────────────────┘
            │
            ├─ Render ticket.md template
            │
            ▼
┌─────────────────────────────────────┐
│ Ticket File (Destination)           │
│ .takt/tickets/milestones/           │
│   M001-scaffolding/                 │
│     T042-takt-backend-title.md      │
│                                     │
│ Metadata: Origin: quick:<id>        │
└─────────────────────────────────────┘
            │
            ├─ Copy artifacts
            │
            ▼
┌─────────────────────────────────────┐
│ Artifact Migration                  │
│                                     │
│ Source: .takt/artifacts/quick/<id>/ │
│ Dest:   .takt/artifacts/ticket/T### │
│                                     │
│ - context.json (copy)               │
│ - logs/*.log (copy)                 │
│                                     │
│ Original artifacts preserved        │
└─────────────────────────────────────┘
            │
            ├─ Update quick.md status
            │
            ▼
┌─────────────────────────────────────┐
│ Quick Entry (Updated)               │
│                                     │
│ Status: promoted                    │
│ Promoted: T042                      │
│ PromotedAt: 2026-02-16 14:40:15     │
└─────────────────────────────────────┘
```

### Promotion Decision Logic

**When to promote:**
- Scope grew beyond initial estimate
- Need to assign to a specialized agent
- Need mandatory review gates
- Task has dependencies on other tickets
- Want to track in milestone planning

**When NOT to promote:**
- Task completed successfully
- No need for formal tracking
- Standalone work with no dependencies

---

## 8. Validation Presets

### 8.1 Python Preset

**Auto-detection:** Looks for `pyproject.toml`, `setup.py`, or `requirements.txt`

**Default commands:**

```yaml
validate:
  preset: python
  python:
    prefer_uv: true          # Use uv if available, else pip
    mypy_enabled: true       # Run mypy for type checking
    pytest_args: ""          # Additional pytest arguments
  timeout: 300000            # 5 minutes
```

**Command sequence:**

| Check | Command | Skip If |
|-------|---------|---------|
| Lint | `ruff check .` | ruff not installed |
| Type Check | `mypy src` | mypy not installed or `mypy_enabled: false` |
| Tests | `pytest tests ${pytest_args}` | No `tests/` directory |

**Skip logic:**
- If `ruff` not found: print warning, skip lint
- If `mypy` not found or disabled: skip type check
- If `tests/` doesn't exist: skip tests
- At least one check must run (error if all skipped)

---

### 8.2 Node Preset

**Auto-detection:** Looks for `package.json`

**Default commands:**

```yaml
validate:
  preset: node
  node:
    package_manager: auto    # auto | npm | yarn | pnpm
    lint_script: "lint"      # package.json script name
    test_script: "test"      # package.json script name
  timeout: 300000            # 5 minutes
```

**Command sequence:**

| Check | Command | Skip If |
|-------|---------|---------|
| Lint | `<pm> run lint` | No "lint" script in package.json |
| Tests | `<pm> run test` | No "test" script in package.json |
| Build | `<pm> run build` | No "build" script in package.json |

**Package manager detection (`auto`):**
1. Check for `pnpm-lock.yaml` → use `pnpm`
2. Check for `yarn.lock` → use `yarn`
3. Check for `package-lock.json` → use `npm`
4. Default: `npm`

**Skip logic:**
- If script missing from package.json: skip that check
- At least one check must run (error if all skipped)

---

### 8.3 Custom Preset

**Configuration via `.takt/config.yaml`:**

```yaml
validate:
  preset: custom
  commands:
    - name: "Lint"
      command: "make lint"
      required: true
    - name: "Tests"
      command: "make test"
      required: false
    - name: "Security Scan"
      command: "bandit -r src/"
      required: false
  timeout: 600000  # 10 minutes
```

**Behavior:**
- Commands run in order
- If `required: true` and command fails → validation fails
- If `required: false` and command fails → warning only
- All commands captured in separate log files

---

### 8.4 Auto Preset (Default)

**Detection order:**
1. Check for `.takt/config.yaml` with `validate.preset` → use that
2. Check for `package.json` → Node preset
3. Check for `pyproject.toml` or `setup.py` → Python preset
4. No detection → error with helpful message

**Fallback message:**
```
[Takt] No validation preset detected.

Create .takt/config.yaml with custom commands:

  validate:
    preset: custom
    commands:
      - name: "Lint"
        command: "your-linter ."
      - name: "Tests"
        command: "your-test-runner"
```

---

## 9. Success Criteria

Quick Mode is successful when:

1. Users can create a tracked work record in < 10 seconds
2. Validation runs without configuration for 90% of Python/Node projects
3. Promotion to ticket is lossless (no data dropped)
4. Quick entries are readable 6 months later without context
5. Users choose quick mode for small tasks instead of skipping Takt

---

## 10. Future Enhancements (Out of Scope)

- **Quick templates**: Predefined quick entry templates (bug-fix, spike, docs)
- **Batch validation**: `takt validate --all` for all quick entries
- **Quick entry search**: `takt quick list --type fix --since 2026-02-01`
- **Auto-promote threshold**: Promote if quick entry exceeds N lines or N hours
- **Visual dashboard**: `takt quick dashboard` for quick entry overview

---

**Last Updated:** 2026-02-16
**Contributors:** Takt Team
