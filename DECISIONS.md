# Takt Quick Mode + Validation — Architectural Decision Records

**Version:** 0.3.0
**Date:** 2026-02-16

---

## ADR-001: Quick mode as separate path (not simplified structured mode)

**Context:**

When adding lightweight task support, we had two options:
1. Add a "lite" flag to existing structured mode that skips planning/agents
2. Create a completely separate quick mode path

**Decision:**

Create a separate quick mode path with its own state directory (`.takt/quick/`) and dedicated skills (`takt quick`, `takt validate`, `takt promote`).

**Rationale:**

- **Simplicity**: Structured mode is complex (10+ state files, agent roster, ticket dependencies). Adding conditional logic throughout would make every module harder to understand.
- **Safety**: No risk of accidentally breaking structured mode when iterating on quick mode features.
- **Clear mental model**: "Quick mode for tasks, structured mode for projects" is easier to explain than "structured mode with flags."
- **Independent evolution**: Each mode can evolve independently. Quick mode can add features (templates, search) without impacting structured mode.
- **Code clarity**: Separate skills means no branching logic in core orchestration.

**Consequences:**

- **Positive**:
  - Clean separation of concerns
  - Lower cognitive load when reading code
  - Easier to test each mode in isolation
  - Promotion bridge is explicit and auditable

- **Negative**:
  - Some code duplication (template rendering, artifact management)
  - Two parallel state directories (`.takt/quick/` and `.takt/tickets/`)
  - Users must learn two entry points (`takt quick` vs `takt "project"`)

**Alternatives Considered:**

1. **Unified mode with flags**: `takt "task" --quick --no-agents --no-review`
   - Rejected: Too many flags, conditional complexity in every skill
2. **Quick mode as subset of structured mode**: Create single-ticket milestones
   - Rejected: Still requires agent roster, milestone state, review gates

**Status:** Accepted

---

## ADR-002: Minimal YAML parser vs JSON config

**Context:**

Project-level configuration needs a file format. Options:
1. JSON (natively supported by Node.js)
2. YAML (more user-friendly, supports comments)
3. TOML (requires parser library)
4. JavaScript (requires `eval` or `require`)

**Decision:**

Use YAML for config file (`.takt/config.yaml`) with a custom minimal parser (`scripts/yaml-parse.mjs`).

**Rationale:**

- **User experience**: YAML is easier to hand-edit than JSON (no quotes for keys, trailing commas allowed, comments supported)
- **Zero dependencies**: Custom parser uses only Node.js built-ins (`fs`, `readline`)
- **Good enough**: Config needs are simple (2-level nesting max, basic types)
- **Precedent**: Most dev tools use YAML for config (`.github/workflows/`, `.eslintrc.yml`, `docker-compose.yml`)

**Parser Limitations:**

- 2-level nesting max (sufficient for our schema)
- No multi-line strings (not needed for commands)
- No anchors/references (not needed)
- No complex data types (just strings, numbers, booleans, arrays, objects)

**Example supported:**
```yaml
validate:
  preset: python
  timeout: 300000
  python:
    mypy_enabled: true
```

**Consequences:**

- **Positive**:
  - Config files are readable and editable
  - Comments can document non-obvious settings
  - No external dependencies (keeps plugin portable)

- **Negative**:
  - Parser is custom code that needs testing
  - Can't use advanced YAML features
  - Parser bugs could break config loading

**Alternatives Considered:**

1. **JSON**: `config.json`
   - Rejected: No comments, harder to edit by hand, trailing commas are errors
2. **YAML with library**: Use `js-yaml` npm package
   - Rejected: Adds external dependency, violates "zero deps" constraint
3. **JavaScript config**: `config.js` with `module.exports`
   - Rejected: Security risk (`eval`/`require`), harder to parse programmatically

**Status:** Accepted

---

## ADR-003: Timestamp-based quick IDs

**Context:**

Quick entries need unique identifiers that are:
- Human-readable
- Sortable by creation time
- Collision-resistant
- Usable as directory names

Options:
1. Sequential numbers: `Q001`, `Q002`
2. UUID: `a3f8b2c1-...`
3. Timestamp: `20260216-143022`
4. Timestamp + slug: `20260216-143022_add-retry-logic`

**Decision:**

Use `YYYYMMDD-HHMMSS_slug` format.

**Rationale:**

- **Collision resistance**: Second precision is sufficient for human use (unlikely two entries created in same second)
- **Sortability**: Alphabetical sort = chronological sort
- **Readability**: Timestamp is human-parsable, slug provides context
- **Directory names**: Valid on all filesystems (no special chars)
- **Length**: ~40 chars max (timestamp + underscore + 30-char slug)

**Examples:**
```
20260216-143022_add-retry-logic
20260216-150833_fix-timeout-bug
20260217-091500_research-graphql-api
```

**Slug generation:**
- Lowercase title
- Replace spaces/special chars with hyphens
- Remove consecutive hyphens
- Trim to 40 chars
- Example: `"Add Retry Logic to API"` → `"add-retry-logic-to-api"`

**Consequences:**

- **Positive**:
  - Easy to find recent entries by scanning directory
  - Context visible in directory listings
  - No need for separate ID counter state file

- **Negative**:
  - Long directory names (vs `Q001`)
  - Slug generation adds complexity
  - Clock skew could cause non-chronological IDs

**Alternatives Considered:**

1. **UUID**: `a3f8b2c1-4e7f-...`
   - Rejected: Not human-readable, not sortable
2. **Sequential**: `Q001`, `Q002`
   - Rejected: Requires state file to track counter, not self-descriptive
3. **Timestamp only**: `20260216-143022`
   - Rejected: No context in directory name

**Status:** Accepted

---

## ADR-004: Artifacts stored per-mode and per-ID

**Context:**

Validation logs, context data, and other artifacts need storage. Options:
1. Flat directory: `.takt/artifacts/<id>/`
2. Per-mode: `.takt/artifacts/quick/<id>/` and `.takt/artifacts/ticket/<id>/`
3. Alongside entry: `.takt/quick/<id>/artifacts/`
4. Global logs: `.takt/logs/validation/<id>/`

**Decision:**

Store artifacts in `.takt/artifacts/<mode>/<id>/` structure where mode is `quick` or `ticket`.

**Rationale:**

- **Clear ownership**: Mode prefix makes it obvious whether artifact is from quick or ticket
- **Promotion clarity**: When promoting, copy from `artifacts/quick/<id>/` to `artifacts/ticket/T###/` (different namespaces)
- **Cleanup**: Easy to implement retention policies (delete all `artifacts/quick/` if `retention: promoted-only`)
- **Consistency**: All artifacts (context, logs) in one place per entry

**Structure:**
```
.takt/artifacts/
  quick/
    20260216-143022_add-retry-logic/
      context.json
      logs/
        lint.log
        test.log
  ticket/
    T042/
      context.json
      logs/
        lint.log
        test.log
```

**Consequences:**

- **Positive**:
  - Clear separation between quick and ticket artifacts
  - Promotion is explicit copy operation (auditable)
  - Retention policies are straightforward

- **Negative**:
  - Deeper directory nesting (3 levels)
  - Mode prefix redundant if artifact path is known from context

**Alternatives Considered:**

1. **Flat**: `.takt/artifacts/<id>/`
   - Rejected: ID collision risk between quick and ticket (if same ID format)
2. **Alongside entry**: `.takt/quick/<id>/artifacts/`
   - Rejected: Harder to implement global retention policies
3. **Global logs**: `.takt/logs/validation/<id>/`
   - Rejected: Separates logs from context artifacts

**Status:** Accepted

---

## ADR-005: Validation is opt-in by default in quick mode

**Context:**

Quick mode should be fast and lightweight. Validation adds value but also time. Options:
1. Always run validation (no opt-out)
2. Never run validation (must explicitly request)
3. Run by default, allow skip with `--no-validate`
4. Ask user every time

**Decision:**

Run validation by default when user completes quick entry, but allow skip with `--no-validate`. Validation failures warn but don't block (unless `--strict`).

**Rationale:**

- **Provide value by default**: Most users want to know if their change breaks tests
- **No friction**: Validation is automatic, user doesn't have to remember to run it
- **Escape hatch**: `--no-validate` for truly quick experiments
- **Soft failures**: Warnings encourage good practices without blocking fast iteration
- **Progressive strictness**: `--strict` available for those who want hard enforcement

**Validation modes:**

| Config | Behavior |
|--------|----------|
| Default | Run validation, warn on failure, don't block |
| `--no-validate` | Skip validation entirely |
| `--strict` | Run validation, error on failure, exit non-zero |
| `config.yaml: auto_validate: false` | Skip by default (require explicit `takt validate`) |

**Consequences:**

- **Positive**:
  - Users get validation feedback without thinking about it
  - Still fast for those who want to skip
  - Encourages quality without enforcing it

- **Negative**:
  - May slow down truly quick tasks
  - Users might ignore warnings
  - Unexpected failures if environment missing tools

**Alternatives Considered:**

1. **Always validate**: No `--no-validate` flag
   - Rejected: Too restrictive for exploratory work
2. **Opt-in only**: Must explicitly run `takt validate`
   - Rejected: Most users would forget, defeats purpose
3. **Ask every time**: Prompt "Run validation? (y/n)"
   - Rejected: Adds friction, breaks automation

**Status:** Accepted

---

## ADR-006: Promote copies artifacts (doesn't move)

**Context:**

When promoting a quick entry to a ticket, should artifacts:
1. Move (quick artifacts deleted)
2. Copy (quick artifacts preserved)
3. Symlink (shared reference)

**Decision:**

Copy artifacts from `artifacts/quick/<id>/` to `artifacts/ticket/T###/`. Preserve originals.

**Rationale:**

- **Historical record**: Quick entry remains complete with all original artifacts
- **Independent lifecycle**: Ticket can run new validation, generate new artifacts, without affecting quick entry
- **Audit trail**: Can always trace ticket back to original quick entry and see what changed
- **Simplicity**: Copy is simpler than move + cleanup logic

**Cost:**
- Disk space duplication (typically small: context.json ~5KB, logs ~50KB each)
- For 100 quick entries with 3 logs each: ~5MB total

**Consequences:**

- **Positive**:
  - Quick entry is immutable historical record
  - Can compare ticket artifacts to original quick artifacts
  - No data loss if promotion is later reverted (theoretical)

- **Negative**:
  - Duplicate storage (small cost)
  - Cleanup requires deleting from both locations if retention policy triggers

**Alternatives Considered:**

1. **Move**: Delete quick artifacts after copy
   - Rejected: Loses historical record, can't trace ticket lineage
2. **Symlink**: `artifacts/ticket/T042/` → `../quick/20260216.../`
   - Rejected: Breaks if quick entry is deleted, complicates retention policy
3. **Reference only**: Ticket stores path, reads from quick artifacts
   - Rejected: Tightly couples ticket to quick entry, breaks encapsulation

**Status:** Accepted

---

## ADR-007: config.yaml is optional

**Context:**

Configuration is needed for validation presets, retention policies, etc. Options:
1. Require config.yaml (error if missing)
2. Optional config.yaml with hardcoded defaults
3. Generate config.yaml on first use
4. Support multiple config sources (env vars, CLI flags, file)

**Decision:**

Make config.yaml completely optional. All features work with sensible defaults. Create config.yaml on-demand if user needs customization.

**Rationale:**

- **Zero-config by default**: New users can run `takt quick` without setup
- **Progressive disclosure**: Users discover config.yaml when they need it (e.g., custom validation commands)
- **Fail gracefully**: If config.yaml exists but is malformed, fall back to defaults + warn
- **Documentation through defaults**: Default config shown in error messages/docs

**Defaults:**

```yaml
# Implicit defaults (no config.yaml needed)
quick:
  default_type: feat
  auto_validate: true
  strict_validation: false
validate:
  preset: auto
  timeout: 300000
  python:
    prefer_uv: true
    mypy_enabled: true
  node:
    package_manager: auto
artifacts:
  retention: all
  max_log_size: 1048576
```

**Config.yaml creation:**
- Not created automatically
- User creates manually or via `takt config init` (future enhancement)
- Docs provide full template with comments

**Consequences:**

- **Positive**:
  - Lower barrier to entry
  - Works out of the box for common cases (Python with pytest, Node with package.json scripts)
  - Encourages convention over configuration

- **Negative**:
  - Defaults must be maintained in code and docs
  - Users may not discover config options
  - Must handle missing config everywhere

**Alternatives Considered:**

1. **Required config**: Error if `.takt/config.yaml` missing
   - Rejected: Friction for new users
2. **Auto-generate**: Create config.yaml on first `takt quick`
   - Rejected: Pollutes repo with file user may not need
3. **Multiple sources**: Merge env vars, CLI flags, config file
   - Rejected: Complexity, harder to debug ("where did this setting come from?")

**Status:** Accepted

---

## ADR-008: Validation runs sequentially (not parallel)

**Context:**

When validating with multiple commands (lint, test, typecheck), should they:
1. Run in parallel (faster)
2. Run sequentially (simpler)

**Decision:**

Run validation commands sequentially in the order defined.

**Rationale:**

- **Resource contention**: Parallel tests + linter can saturate CPU, causing slower overall time
- **Log clarity**: Sequential output is easier to read and debug
- **Failure fast**: Can stop on first failure in strict mode (future enhancement)
- **Simplicity**: No need for Promise.all() orchestration, race condition handling
- **Predictable timing**: Users can estimate duration based on command order

**Typical validation time:**
- Lint: 0.5s
- Type check: 1-3s
- Tests: 5-30s
- Total: ~6-34s (acceptable for background validation)

**Future optimization:**
- If validation time becomes a pain point, add `parallel: true` config option
- Current implementation makes parallel addition easy (just wrap in Promise.all())

**Consequences:**

- **Positive**:
  - Simpler code (no concurrency bugs)
  - Logs are chronological and readable
  - Predictable resource usage

- **Negative**:
  - Slower than parallel (by ~2-5s in typical case)
  - Can't optimize independent commands

**Alternatives Considered:**

1. **Parallel by default**: Run all commands concurrently
   - Rejected: Resource contention, harder to debug
2. **Configurable**: `parallel: true/false` in config.yaml
   - Deferred: Start simple, add if needed

**Status:** Accepted

---

## ADR-009: Quick mode doesn't create tickets in structured mode format

**Context:**

Quick entries could be stored as minimal tickets (`.takt/tickets/quick/T001-*.md`) or in a separate format (`.takt/quick/<id>/quick.md`). This relates to ADR-001 but focuses on the file format.

**Decision:**

Use a distinct `quick.md` format that is simpler than ticket.md. No ticket ID, no milestone, no agent assignment.

**Rationale:**

- **Simplicity**: Quick entries don't need milestone, agent, dependencies, review sections
- **Clear intent**: File name `quick.md` signals "this is a quick entry, not a ticket"
- **Smaller files**: Fewer boilerplate sections means faster reading/writing
- **Promotion is explicit**: Converting quick.md to ticket.md is a clear transformation

**Format differences:**

| Field | quick.md | ticket.md |
|-------|----------|-----------|
| ID format | `20260216-143022_slug` | `T042` |
| Milestone | None | Required |
| Agent | None | Required |
| Dependencies | None | Optional |
| Review section | None | Required |
| Status values | `todo`, `in-progress`, `done`, `promoted` | `todo`, `in-progress`, `completed`, `blocked` |

**Consequences:**

- **Positive**:
  - Quick entries are lightweight and focused
  - Promotion adds structure progressively
  - No confusion about which mode an entry belongs to

- **Negative**:
  - Two templates to maintain (quick.md and ticket.md)
  - Some duplication in field names (Title, Type, Status)

**Alternatives Considered:**

1. **Use ticket format for quick entries**: Store as `T-quick-001.md`
   - Rejected: Adds unnecessary fields, confusing status
2. **Unified format**: Single template with optional fields
   - Rejected: More conditional logic, harder to read

**Status:** Accepted

---

## ADR-010: Review gate integration is optional

**Context:**

Review gate (`scripts/review-gate.mjs`) enforces ticket completion criteria. Should it:
1. Always require validation artifacts
2. Never check validation (leave to user)
3. Make it configurable via `config.yaml`

**Decision:**

Make validation requirement configurable via `review.require_validation` in config.yaml. Default: `false` (optional).

**Rationale:**

- **Backward compatibility**: Existing projects without validation shouldn't break
- **Flexibility**: Some teams want hard enforcement, others prefer soft recommendations
- **Progressive adoption**: Projects can enable requirement when ready
- **Clear failure message**: If enabled and missing, review gate provides actionable error

**Configuration:**

```yaml
review:
  require_validation: false  # Default: validation is nice-to-have
  require_test_artifacts: false  # Future: require test logs specifically
```

**Behavior:**

| Config | Missing Validation | Behavior |
|--------|-------------------|----------|
| `require_validation: false` | Any | Review gate allows (backward compatible) |
| `require_validation: true` | Quick entry | Review gate blocks + suggests `takt validate` |
| `require_validation: true` | Ticket | Review gate blocks + suggests `takt validate <ticket_id>` |

**Consequences:**

- **Positive**:
  - Teams can adopt validation gradually
  - No breaking changes to existing workflows
  - Clear opt-in model

- **Negative**:
  - One more config option to learn
  - Default doesn't enforce best practices

**Alternatives Considered:**

1. **Always required**: Block review if no validation
   - Rejected: Breaking change for existing users
2. **Never check**: Remove integration entirely
   - Rejected: Defeats purpose of evidence-based review
3. **Auto-detect**: Require validation only if config.yaml exists
   - Rejected: Implicit behavior is confusing

**Status:** Accepted

---

**Last Updated:** 2026-02-16
**Contributors:** Takt Team
