---
name: mamh
description: Orchestrate teams of specialized AI agents to build complex projects autonomously. Supports Agent Teams and Subagent execution modes. Triggers on "mamh", "multi-harness", "multi-agent project", "team build".
---

# MAMH - Multi-Agent Multi-Harness

MAMH orchestrates teams of specialized AI agents to build complex projects autonomously. It provisions purpose-built agents, assigns scoped tickets, enforces path boundaries, runs review gates, and iterates through milestones until the project is complete.

MAMH supports two execution modes, chosen during planning:

| Mode | Mechanism | When to Use |
|------|-----------|-------------|
| **Agent Teams** | TeamCreate + SendMessage | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var is available. Persistent teammates with shared task list. |
| **Subagents** | Task tool parallel dispatches | Fallback when Agent Teams is unavailable. Main session orchestrates via dependency-ordered batch execution. |

When triggered, MAMH runs a structured 6-phase lifecycle: Planning Interview, Agent Definition, Ticket Generation, Execution, Review Gates, and Milestone Iteration. In Agent Teams mode, the orchestrator agent operates in **delegate mode**. In Subagent mode, the **main session** acts as orchestrator.

---

## Prerequisites

Before starting, verify the following:

1. **Check Agent Teams availability.** Check whether the environment variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. Record the result — it determines the default execution mode. Both modes are fully supported; Agent Teams is NOT required.
2. **Plugin scripts exist.** The plugin root is available via `${CLAUDE_PLUGIN_ROOT}`. Verify that `${CLAUDE_PLUGIN_ROOT}/scripts/init-project.mjs` exists. If not, warn the user that the plugin installation may be incomplete.

---

## Subcommand Routing

**CRITICAL ROUTING RULE:** There is a SEPARATE generic `/plan` skill that is NOT part of MAMH. MAMH skills are prefixed with `mamh-` to avoid collisions. When routing, always use the `mamh-` prefixed names.

**Skill tool call syntax:** Always use `Skill(skill="mamh-plan")`, `Skill(skill="mamh-execute")`, etc. NEVER use bare `Skill(skill="plan")` — that invokes the wrong skill.

Parse the user's input to determine which subcommand to execute:

| Input Pattern | Skill Tool Call | Action |
|---------------|----------------|--------|
| `mamh <project description>` | `Skill(skill="mamh-plan")` | Start a new project. Run planning phases (0-2), then execution. |
| `mamh status` | `Skill(skill="mamh-status")` | Display the status dashboard. |
| `mamh review` | `Skill(skill="mamh-review")` | Manually trigger a review cycle on completed tickets. |
| `mamh next` | `Skill(skill="mamh-next")` | Advance to the next milestone. |
| `mamh resume` | `Skill(skill="mamh-resume")` | Resume an interrupted session. |
| `mamh handoff` | `Skill(skill="mamh-handoff")` | Update HANDOFF.md with current project state and progress. |
| `mamh stop` | `Skill(skill="mamh-stop")` | Gracefully shut down execution and save state. |

If the user provides a bare `mamh` with no arguments or description, display this help message listing the available commands.

When `mamh <project description>` is used, invoke `Skill(skill="mamh-plan")` with the project description. After planning completes (Phases 0-2), automatically invoke `Skill(skill="mamh-execute")` to begin Phase 3.

---

## Directory Structure Reference

After full initialization, the `.mamh/` directory looks like:

```
.mamh/
  HANDOFF.md                          # Session handoff — what's done, decisions, next steps
  prd.md                              # Product Requirements Document
  tech-spec.md                        # Technical Specification
  constraints.md                      # Hard constraints and preferences
  state/
    mamh-state.json                   # Current operational state
    session.json                      # Session configuration
  agents/
    registry.json                     # Agent roster with path boundaries
  tickets/
    milestones/
      M001-scaffolding/
        _milestone.json               # Milestone metadata
        T001-setup-project.md         # Ticket file
        T002-shared-interfaces.md
      M002-core-features/
        _milestone.json
        T003-user-model.md
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
  mamh-orchestrator.md                # Team lead agent (delegate mode)
  mamh-backend.md                     # Backend engineer agent
  mamh-frontend.md                    # Frontend engineer agent
  mamh-test.md                        # Test engineer agent
  ...                                 # Additional project-specific agents
```
