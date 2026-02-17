# Takt — Project Status

## Current Version: 0.3.0

**Date:** 2026-02-16

---

## What's Done

### Core Plugin
- [x] Plugin manifest (`.claude-plugin/plugin.json`)
- [x] Main skill entry point (`skills/takt/SKILL.md`) — help + routing
- [x] Split subcommand skills (`plan`, `execute`, `review`, `next`, `status`, `resume`, `stop`, `handoff`)
- [x] Orchestrator agent in delegate mode (`agents/takt-orchestrator.md`)
- [x] Package metadata (`package.json`)

### Agent Templates (7)
- [x] `backend.md` — Server-side code (sonnet)
- [x] `frontend.md` — Client-side code (sonnet)
- [x] `reviewer.md` — Code review, read-only (opus) + worktree access
- [x] `designer.md` — UI/UX design (sonnet)
- [x] `researcher.md` — External research (sonnet)
- [x] `content.md` — Content writing (haiku)
- [x] `devops.md` — Infrastructure (sonnet)

### Hook Scripts
- [x] `scope-guard.mjs` — PreToolUse hook: blocks out-of-scope writes + worktree enforcement
- [x] `review-gate.mjs` — Standalone script: enforces acceptance criteria (invoked by orchestrator)
- [x] `keep-working.mjs` — Standalone script: checks for remaining tickets (invoked by orchestrator)
- [x] `init-project.mjs` — Creates `.takt/` directory in user projects

### Quick Mode
- [x] `skills/quick/SKILL.md` — `/takt-quick` single-task mode
- [x] `skills/validate/SKILL.md` — `/takt-validate` validation checks
- [x] `skills/promote/SKILL.md` — `/takt-promote` quick-to-ticket promotion
- [x] `scripts/yaml-parse.mjs` — Minimal YAML parser (zero deps)
- [x] `scripts/context.mjs` — Context gathering (git, tree, language)
- [x] `scripts/context.sh` — Shell wrapper for context.mjs
- [x] `scripts/validate.mjs` — Validation runner with preset detection
- [x] `templates/quick.md` — Quick mode entry template
- [x] `templates/ticket.md` — Reusable ticket template

### Design Documents
- [x] `SPEC.md` — Quick Mode specification
- [x] `ARCHITECTURE.md` — Module architecture
- [x] `DECISIONS.md` — Architectural decision records
- [x] `RUNBOOK.md` — Operational guide
- [x] `DIAGRAMS.md` — Mermaid diagrams

### Git Worktree Isolation
- [x] `worktree-setup.mjs` — Creates per-agent worktrees from main
- [x] `worktree-merge.mjs` — Merges agent branches at milestone completion

### Shared Policy
- [x] `templates/POLICY.md` — Guardrails-focused rulebook (~130 lines, ~1,300 tokens)

### Documentation
- [x] `README.md` — Comprehensive user guide with installation, usage, examples
- [x] `CLAUDE.md` — Developer guide for LLMs working on this codebase
- [x] `docs/README.md` — Internal developer docs
- [x] `docs/TEMPLATES.md` — Template customization guide
- [x] `docs/CONFIGURATION.md` — Configuration reference
- [x] `docs/POLICY.md` — Policy system explanation

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| POLICY.md capped at ~200 lines | Minimize per-agent context consumption (~1,300 tokens vs ~4,500) |
| CLAUDE.md is plugin-dev only | Runtime agents use project-level CLAUDE.md, not plugin's |
| Orchestrator has no Write/Edit tools | Enforces delegation-only pattern |
| Zero external dependencies in scripts | Portability — no `npm install` needed |
| `${CLAUDE_PLUGIN_ROOT}` in hook paths | Plugin works from any install location |
| Reviewer has `.worktrees/**` read access | Enables code review of agent branches before merge |
| Dual execution mode (agent-teams / subagents) | Agent Teams requires experimental env var; subagent mode is a fully functional fallback using Task tool batch dispatch |
| Quick mode as separate path | Small tasks bypass agents/tickets entirely. Separate `.takt/quick/` avoids touching structured mode state. |
| config.yaml with YAML parser | User-friendly config. Custom zero-dep parser is sufficient for 2-level nesting. |
| Validation opt-in in quick mode | Fast by default; strict mode available when needed |

---

## What's Next

- [ ] End-to-end testing on a real project
- [ ] Validate Agent Teams integration (requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`)
- [ ] Test dynamic agent provisioning mid-execution
- [ ] Test scope-guard hook blocking in real agent context
- [ ] Test worktree setup/merge lifecycle
- [ ] Test resume from interrupted session
- [ ] Gather feedback and iterate on POLICY.md rules

---

## Changelog

### 2026-02-16 — v0.3.0
- **Quick Mode: lightweight single-task workflow**
  - `takt quick "<title>"` creates a tracked quick entry with auto-collected context
  - No agents, no planning, no milestones — just a quick.md file
  - Auto-gathered context: git status, recent commits, diff stat, directory tree, language detection
  - Optional validation (lint, typecheck, tests) via presets
  - Quick entries live in `.takt/quick/YYYYMMDD-HHMMSS_slug/quick.md`
- **Validation presets**
  - `takt validate` runs project checks with auto-detected presets (Python, Node, or both)
  - Python: compileall, ruff, pytest, mypy (prefers uv when available)
  - Node: lint, typecheck, test, format check (auto-detects package manager)
  - Results saved as artifacts in `.takt/artifacts/<mode>/<id>/logs/`
  - Custom commands via `validate.commands[]` in config.yaml
- **Promote workflow**
  - `takt promote <quick-id> --to ticket` converts a quick entry to a structured ticket
  - Carries over context, acceptance checks, notes, and validation artifacts
  - Generates next available ticket ID, places in current or ad-hoc milestone
  - Origin field traces ticket back to quick entry
- **Evidence-based review (opt-in)**
  - `review-gate.mjs` extended with optional validation artifact check
  - Gated by `review.require_validation: true` in `.takt/config.yaml`
  - No effect on existing projects unless explicitly enabled
- **Project configuration**
  - Optional `.takt/config.yaml` for quick mode, validation, and review settings
  - Custom YAML parser (`yaml-parse.mjs`) — zero external dependencies
  - All settings have sensible defaults; config file is entirely optional
- **New design documents**: SPEC.md, ARCHITECTURE.md, DECISIONS.md, RUNBOOK.md, DIAGRAMS.md
- New files (14):
  1. `scripts/yaml-parse.mjs` — Minimal YAML parser
  2. `scripts/context.mjs` — Context gathering
  3. `scripts/context.sh` — Shell wrapper
  4. `scripts/validate.mjs` — Validation runner
  5. `templates/quick.md` — Quick entry template
  6. `templates/ticket.md` — Ticket template
  7. `skills/quick/SKILL.md` — Quick mode skill
  8. `skills/validate/SKILL.md` — Validation skill
  9. `skills/promote/SKILL.md` — Promote skill
  10. `SPEC.md` — Specification
  11. `ARCHITECTURE.md` — Architecture
  12. `DECISIONS.md` — Decision records
  13. `RUNBOOK.md` — Operational guide
  14. `DIAGRAMS.md` — Mermaid diagrams
- Modified files (8):
  1. `scripts/init-project.mjs` — Added quick/, artifacts/ directories
  2. `scripts/review-gate.mjs` — Optional validation artifact check
  3. `skills/review/SKILL.md` — Evidence-based review section
  4. `skills/takt/SKILL.md` — 3 new routing entries + directory structure
  5. `CLAUDE.md` — Updated structure, decisions, docs references
  6. `STATUS.md` — This changelog
  7. `README.md` — Quick mode section, new commands
  8. `docs/CONFIGURATION.md` — config.yaml reference

### 2026-02-15 — v0.2.0
- **Rebranded: Takt → Takt**
  - Plugin renamed from "Multi-Agent Multi-Harness" to "Takt" — agent orchestration meets ticket-based workflows
  - Updated all user-facing files: README.md, CLAUDE.md, STATUS.md, package.json, plugin.json, marketplace.json
  - Repository URLs updated to `byseon/Takt` (public) and `seongjinpark-88/takt` (private)
  - Internal `.takt/` directory name preserved for backward compatibility
- **Mandatory reviewer agent**
  - `takt-reviewer` is now a permanent team member — always spawned, cannot be removed during roster review
  - Added to Phase 1 agent definition as mandatory alongside orchestrator
  - Execute skill ensures reviewer is always part of the team
  - Review skill assigns peer review to existing reviewer teammate (no new agent spawned)
  - Next skill protects reviewer and orchestrator from removal during roster evaluation
- Modified 9 files:
  1. `README.md` — Full rewrite with Takt branding, mandatory reviewer, multi-feature support
  2. `CLAUDE.md` — Renamed references, updated URLs, added mandatory reviewer decision
  3. `STATUS.md` — Renamed, v0.2.0 changelog
  4. `package.json` — name: takt, repo: byseon/Takt
  5. `.claude-plugin/plugin.json` — name: takt, URLs updated
  6. `.claude-plugin/marketplace.json` — name: takt, URLs updated
  7. `skills/plan/SKILL.md` — Mandatory reviewer + orchestrator in Phase 1
  8. `skills/execute/SKILL.md` — Reviewer as mandatory team member in Step 3.1
  9. `skills/review/SKILL.md` — Assign to existing takt-reviewer teammate
  10. `skills/next/SKILL.md` — Protected agents during roster review

### 2026-02-10 — v0.1.7
- **Multi-feature support: extend or new feature flow**
  - When `takt "description"` is called in a repo with an existing `.takt/` project, detects it and asks: extend current feature or start a new one
  - **Extend**: Adds milestones/tickets to existing project, continues numbering, reuses all state
  - **New feature**: Archives feature-level state (PRD, tickets, comms, reviews, logs) to `.takt/features-archive/<name>/`, keeps project-level state (agents, tech spec, constraints, POLICY, decisions.md), resets milestone/ticket numbering
  - User can optionally revise constraints, tech spec, or agent roster before planning the new feature
  - Q1 (constraints) and Q2 (execution mode) are skipped for both paths — only Q3 (involvement) is asked
  - session.json gains `featureCount` and `currentFeature` fields
  - HANDOFF.md gains "Feature History" section
- Modified 2 files:
  1. `skills/plan/SKILL.md` — New Step 0.0 (existing project detection), Path A (extend), Path B (new feature), session.json schema update, HANDOFF template update
  2. `README.md` — "Starting a New Feature" section, features-archive in directory structure

### 2026-02-10 — v0.1.6
- **Review & organization improvements**
  - **Artifact bundling on archive**: When a milestone completes, ticket outputs (comms/) and review results (reviews/) are moved into the archive directory alongside ticket files. Each archived milestone is now self-contained.
  - **Two-layer review model clarified**: review-gate.mjs hook = lightweight completion gate (checkbox + status + commit checks). /takt-review skill = full validation (build/test/peer/user). Both documented explicitly in execute and review skills.
  - **review-gate.mjs enhanced**: Now checks ticket status field ("completed"), verifies agent has commits on worktree branch, in addition to acceptance criteria checkboxes. Still fast — no build spawning.
  - **`{{CODE_STANDARDS}}` documented**: Architect agent (Task 2 in planning) now generates code standards as output item 8. Rendered into POLICY.md during Phase 1 via new Step 1.2.
  - **Constraint cross-check**: Planning Phase 1 now cross-references user constraints against POLICY Hard Prohibitions, noting overrides in a "Project Overrides" subsection.
  - **Fixed**: `.takt/state/session.json` → `.takt/session.json` in review/SKILL.md
- Modified 6 files:
  1. `skills/review/SKILL.md` — Fixed session.json path, added two-layer review model documentation
  2. `skills/plan/SKILL.md` — Added CODE_STANDARDS to architect output, new Step 1.2 (render POLICY.md with cross-check)
  3. `skills/next/SKILL.md` — Added artifact bundling step (comms + reviews → archive)
  4. `skills/execute/SKILL.md` — Clarified review step as "full validation" vs hook gate
  5. `scripts/review-gate.mjs` — Added status field check, worktree commit check, updated header docs
  6. `README.md` — Updated archive directory structure to show bundled artifacts

### 2026-02-10 — v0.1.5
- **UX overhaul: Progressive disclosure planning**
  - Reduced planning interview from 10 questions to 3:
    1. Constraints (tech stack, existing code)
    2. Execution mode (Agent Teams / Subagents)
    3. Involvement level (autonomous / milestone checkpoints / hands-on)
  - Involvement level smart-defaults reviewMode, milestoneAdvanceMode, milestoneGranularity
  - Plan auto-generated by parallel analyst + architect + planner agents
  - Single plan summary shown for approval (agents, milestones, tickets in one block)
  - User approves once, then Phases 1-2 auto-execute without further input
- **Inline progress output**
  - One-liner printed after each ticket approval: `[Takt] T001 approved (takt-backend) — title`
  - Batch summary after each batch: `[Takt] Batch 2/4 complete. 8/14 tickets done.`
  - Milestone completion announcement: `[Takt] Milestone M001 complete! 6/6 tickets approved.`
  - Blocker/failure alerts: `[Takt] T007 BLOCKED — dependency T005 failed.`
- **Simplified orchestrator cold start**
  - Reduced from 10 mandatory file reads to 2: HANDOFF.md + takt-state.json
  - All other docs read on-demand when needed for specific operations
  - HANDOFF.md is the primary context source; CLAUDE.md is system-loaded anyway
- Modified 7 files:
  1. `skills/plan/SKILL.md` — Complete rewrite: 3 questions, parallel plan generation, plan summary, single approval gate
  2. `skills/execute/SKILL.md` — New Step 3.6d (inline progress output), startup print, batch progress in subagent mode
  3. `agents/takt-orchestrator.md` — Cold start reduced to HANDOFF.md + state, lazy-load rest
  4. `skills/resume/SKILL.md` — Cold start simplified to HANDOFF.md + state
  5. `skills/takt/SKILL.md` — Updated description for progressive disclosure
  6. `README.md` — Rewrote example session, updated feature description
  7. `STATUS.md` — This changelog entry

### 2026-02-10 — v0.1.4
- Added `/takt-handoff` skill for manual HANDOFF.md updates
  - Reads all state files, registry, tickets, decisions, changelog
  - Generates comprehensive HANDOFF.md with structured template
  - Preserves Milestone History across rewrites
- Enhanced HANDOFF.md update cadence:
  - Now explicitly updated at 4 checkpoints: ticket approval, batch completion, milestone completion, significant events
  - Milestone completion triggers full HANDOFF.md rewrite with Milestone History entry
  - Goal: new session can reconstruct full context from HANDOFF.md alone
- Orchestrator now reads key docs at startup (MANDATORY):
  - HANDOFF.md, POLICY.md, session.json, prd.md, decisions.md, registry.json — all read before any action
- Resume skill now reads key docs (HANDOFF.md, POLICY.md, prd.md, decisions.md, registry.json) before state assessment
- Modified 8 files:
  1. `skills/handoff/SKILL.md` — NEW: `/takt-handoff` skill
  2. `agents/takt-orchestrator.md` — Expanded session start reads (6→10 items), enhanced Handoff section
  3. `skills/execute/SKILL.md` — Structured HANDOFF.md update checkpoints (Step 3.6c), subagent progress tracking
  4. `skills/next/SKILL.md` — Structured milestone HANDOFF.md template with History entry format
  5. `skills/resume/SKILL.md` — Expanded step 1 to read key docs (not just HANDOFF.md)
  6. `skills/takt/SKILL.md` — Added `/takt-handoff` to routing table
  7. `README.md` — Added `/takt-handoff` to commands table and plugin structure
  8. `CLAUDE.md` — Added handoff skill to repository structure and related docs

### 2026-02-10 — v0.1.3
- Added dual execution mode: **Agent Teams** + **Subagent fallback**
  - `executionMode` field added to `session.json` (auto-detected from env var, user-selectable during planning)
  - **Agent Teams mode**: Unchanged from v0.1.2 — TeamCreate + SendMessage, orchestrator agent, shared task list
  - **Subagent mode**: Main session orchestrates via Task tool parallel batch dispatch, file-based communication via `.takt/comms/<ticket-id>-output.md`, dependency-ordered topological sort
  - Agent Teams is no longer a hard requirement — all skills use conditional checks
- Modified 12 files:
  1. `scripts/init-project.mjs` — `executionMode` field with env var auto-detection
  2. `skills/plan/SKILL.md` — Conditional prereqs, Question 7 (execution mode choice), schema update, conditional Step 2.3
  3. `skills/execute/SKILL.md` — Mode routing, Section A (Agent Teams, unchanged), Section B (Subagents, new), unified error handling
  4. `templates/POLICY.md` — Mode-aware Communication Rules (Agent Teams / Subagents / Both subsections)
  5. `skills/resume/SKILL.md` — Conditional prereqs, mode-aware restore (re-launch team vs rebuild dependency graph)
  6. `skills/stop/SKILL.md` — Mode-aware shutdown (signal teammates vs stop dispatching)
  7. `skills/review/SKILL.md` — Mode-aware peer review (teammate agent vs reviewer Task)
  8. `skills/next/SKILL.md` — Mode-aware auto-advance (load into team vs rebuild graph)
  9. `skills/takt/SKILL.md` — Updated description and conditional prereqs
  10. `docs/CONFIGURATION.md` — `executionMode` field docs, env var requirement updated to conditional
  11. `CLAUDE.md` — Architectural decision, hook mode awareness notes
  12. `STATUS.md` — This changelog entry

### 2026-02-10 — v0.1.2
- Fixed 5 issues discovered during real-world usage:
  1. **Subagents vs Agent Teams**: Clarified Task tool (planning) vs Agent Teams (execution) in plan/SKILL.md, execute/SKILL.md, orchestrator
  2. **Tickets/milestones not marked done**: Added post-review state mutation instructions (ticket status, registry stats, state file, HANDOFF.md), explicit archival steps, milestone completion chain
  3. **`takt:plan` vs `plan` routing**: Added disambiguation to takt/SKILL.md and identity header to plan/SKILL.md
  4. **Per-project handoff**: Added `.takt/HANDOFF.md` (created by init-project.mjs, updated by execute/next/stop/resume), restructured docs/POLICY.md with lessons learned
  5. **Model tiering**: Added model selection table to POLICY.md template, model delegation guidance to orchestrator, model usage section to all 8 agent templates
- Changed planner delegation tier from opus to sonnet (structured decomposition, not deep reasoning)
- Added `ApprovedAt` field to ticket file template
- Updated CLAUDE.md structure to reference HANDOFF.md

### 2026-02-08 — v0.1.1
- Split monolithic `skills/takt/SKILL.md` (923 lines) into 8 focused skill files
  - `/takt-plan` (Phases 0-2), `/takt-execute` (Phase 3), `/takt-review` (Phase 4), `/takt-next` (Phase 5)
  - `/takt-status` (dashboard), `/takt-resume` (resume protocol), `/takt-stop` (stop protocol)
  - `/takt` (help + routing, ~83 lines)
- Each subcommand now has its own slash command with tab-completion
- Fixed orchestrator using Task tool instead of Agent Teams:
  - Removed `Task` from orchestrator allowed tools, added to `disallowedTools`
  - Added `TeamCreate` and `SendMessage` to orchestrator tools
  - Added explicit anti-pattern documentation in orchestrator agent and execute skill
- Updated CLAUDE.md, README.md, STATUS.md with new skill structure

### 2026-02-08 — v0.1.0 (Initial Release)
- Created complete Takt plugin with 28 files
- 7 agent templates covering backend, frontend, reviewer, designer, researcher, content, devops
- Scope enforcement via PreToolUse hook with zero-dependency glob matcher
- Review gates via orchestrator-invoked review-gate script
- Git worktree isolation for parallel agent work
- Shared POLICY.md focused on guardrails (15 NEVER rules, 10 ALWAYS rules)
- Comprehensive documentation (README, TEMPLATES, CONFIGURATION, POLICY docs)
