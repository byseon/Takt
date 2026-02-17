---
name: takt
description: Orchestrate teams of specialized AI agents to build complex projects autonomously. Supports Agent Teams and Subagent execution modes. Triggers on "takt", "takt", "multi-agent project", "team build".
---

# Takt — Agent Orchestration + Ticket-Based Workflows

Takt orchestrates teams of specialized AI agents to build complex projects autonomously. Say `takt "Build X"` — answer 3 quick questions — approve the generated plan — and agents take it from there. Progress is tracked via inline one-liners and a continuously updated HANDOFF.md.

Takt supports two execution modes, chosen during planning:

| Mode | Mechanism | When to Use |
|------|-----------|-------------|
| **Agent Teams** | TeamCreate + SendMessage | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var is available. Persistent teammates with shared task list. |
| **Subagents** | Task tool parallel dispatches | Fallback when Agent Teams is unavailable. Main session orchestrates via dependency-ordered batch execution. |

When triggered, Takt uses progressive disclosure: 3 quick questions → auto-generate the full plan → show summary for approval → execute. In Agent Teams mode, the orchestrator agent operates in **delegate mode**. In Subagent mode, the **main session** acts as orchestrator.

---

## Prerequisites

Before starting, verify the following:

1. **Check Agent Teams availability.** Check whether the environment variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. Record the result — it determines the default execution mode. Both modes are fully supported; Agent Teams is NOT required.
2. **Plugin scripts exist.** The plugin root is available via `${CLAUDE_PLUGIN_ROOT}`. Verify that `${CLAUDE_PLUGIN_ROOT}/scripts/init-project.mjs` exists. If not, warn the user that the plugin installation may be incomplete.

---

## Subcommand Routing

**CRITICAL ROUTING RULE:** There is a SEPARATE generic `/plan` skill that is NOT part of Takt. Takt skills are prefixed with `takt-` to avoid collisions. When routing, always use the `takt-` prefixed names.

**Skill tool call syntax:** Always use `Skill(skill="takt-plan")`, `Skill(skill="takt-execute")`, etc. NEVER use bare `Skill(skill="plan")` — that invokes the wrong skill.

Parse the user's input to determine which subcommand to execute:

| Input Pattern | Skill Tool Call | Action |
|---------------|----------------|--------|
| `takt <project description>` | `Skill(skill="takt-plan")` | Start a new project. Run planning phases (0-2), then execution. |
| `takt status` | `Skill(skill="takt-status")` | Display the status dashboard. |
| `takt review` | `Skill(skill="takt-review")` | Manually trigger a review cycle on completed tickets. |
| `takt next` | `Skill(skill="takt-next")` | Advance to the next milestone. |
| `takt resume` | `Skill(skill="takt-resume")` | Resume an interrupted session. |
| `takt handoff` | `Skill(skill="takt-handoff")` | Update HANDOFF.md with current project state and progress. |
| `takt stop` | `Skill(skill="takt-stop")` | Gracefully shut down execution and save state. |
| `takt quick "<title>" [flags]`    | `Skill(skill="takt-quick")`    | Create a quick work entry (no agents/planning). |
| `takt validate [flags]`           | `Skill(skill="takt-validate")` | Run validation checks and save artifacts. |
| `takt promote <quick-id> [flags]` | `Skill(skill="takt-promote")`  | Promote a quick entry to a structured ticket. |

If the user provides a bare `takt` (or `takt`) with no arguments or description, display this help message listing the available commands.

When `takt <project description>` is used, invoke `Skill(skill="takt-plan")` with the project description. After planning completes (Phases 0-2), automatically invoke `Skill(skill="takt-execute")` to begin Phase 3.

---

## Directory Structure Reference

After full initialization, the `.takt/` directory looks like:

```
.takt/
  HANDOFF.md                          # Session handoff — what's done, decisions, next steps
  prd.md                              # Product Requirements Document
  tech-spec.md                        # Technical Specification
  constraints.md                      # Hard constraints and preferences
  state/
    takt-state.json                   # Current operational state
    session.json                      # Session configuration
  agents/
    registry.json                     # Agent roster with path boundaries
  tickets/
    milestones/
      M001-scaffolding/
        _milestone.json               # Milestone metadata
        T001-backend-setup-project.md  # Ticket file (T{ID}-{agent}-{title})
        T002-backend-shared-interfaces.md
      M002-core-features/
        _milestone.json
        T003-backend-user-model.md
    archive/                          # Completed milestone tickets
      M001-scaffolding/
  reviews/
    T001-review.json                  # Review results per ticket
  logs/
    coordination/                     # Agent-to-agent messages
    errors/                           # Error and failure logs
    scope-violations.md               # Scope enforcement log
    M001-summary.md                   # Milestone completion summaries
    project-report.md                 # Final project report

.claude/agents/
  takt-orchestrator.md                # Team lead agent (delegate mode) [permanent]
  takt-reviewer.md                    # Code reviewer (read-only, opus) [permanent]
  takt-backend.md                     # Backend engineer agent
  takt-frontend.md                    # Frontend engineer agent
  takt-test.md                        # Test engineer agent
  ...                                 # Additional project-specific agents

.takt/
  quick/                            # Quick mode entries
    YYYYMMDD-HHMMSS_slug/
      quick.md                      # Quick entry document
  artifacts/                        # Validation/context artifacts
    quick/<id>/
      logs/                         # Validation command outputs
      context/                      # Context gathering outputs
    ticket/<id>/
      logs/
      tests/
      screenshots/
      notes/
  config.yaml                       # Optional project configuration
```
