# MAMH — Project Status

## Current Version: 0.1.1

**Date:** 2026-02-08

---

## What's Done

### Core Plugin
- [x] Plugin manifest (`.claude-plugin/plugin.json`)
- [x] Main skill entry point (`skills/mamh/SKILL.md`) — help + routing
- [x] Split subcommand skills (`plan`, `execute`, `review`, `next`, `status`, `resume`, `stop`)
- [x] Orchestrator agent in delegate mode (`agents/mamh-orchestrator.md`)
- [x] Package metadata (`package.json`)

### Agent Templates (8)
- [x] `backend.md` — Server-side code (sonnet)
- [x] `frontend.md` — Client-side code (sonnet)
- [x] `reviewer.md` — Code review, read-only (opus) + worktree access
- [x] `pm.md` — Project management (sonnet)
- [x] `designer.md` — UI/UX design (sonnet)
- [x] `researcher.md` — External research (sonnet)
- [x] `content.md` — Content writing (haiku)
- [x] `devops.md` — Infrastructure (sonnet)

### Hook Scripts
- [x] `scope-guard.mjs` — PreToolUse: blocks out-of-scope writes + worktree enforcement
- [x] `review-gate.mjs` — TaskCompleted: enforces acceptance criteria
- [x] `keep-working.mjs` — TeammateIdle: directs agents to next ticket
- [x] `init-project.mjs` — Creates `.mamh/` directory in user projects

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

### 2026-02-08 — v0.1.1
- Split monolithic `skills/mamh/SKILL.md` (923 lines) into 8 focused skill files
  - `/mamh:plan` (Phases 0-2), `/mamh:execute` (Phase 3), `/mamh:review` (Phase 4), `/mamh:next` (Phase 5)
  - `/mamh:status` (dashboard), `/mamh:resume` (resume protocol), `/mamh:stop` (stop protocol)
  - `/mamh:mamh` (help + routing, ~83 lines)
- Each subcommand now has its own slash command with tab-completion
- Fixed orchestrator using Task tool instead of Agent Teams:
  - Removed `Task` from orchestrator allowed tools, added to `disallowedTools`
  - Added `TeamCreate` and `SendMessage` to orchestrator tools
  - Added explicit anti-pattern documentation in orchestrator agent and execute skill
- Updated CLAUDE.md, README.md, STATUS.md with new skill structure

### 2026-02-08 — v0.1.0 (Initial Release)
- Created complete MAMH plugin with 28 files
- 8 agent templates covering backend, frontend, reviewer, PM, designer, researcher, content, devops
- Scope enforcement via PreToolUse hook with zero-dependency glob matcher
- Review gates via TaskCompleted hook
- Git worktree isolation for parallel agent work
- Shared POLICY.md focused on guardrails (15 NEVER rules, 10 ALWAYS rules)
- Comprehensive documentation (README, TEMPLATES, CONFIGURATION, POLICY docs)
