---
name: mamh
description: Orchestrate teams of specialized AI agents to build complex projects autonomously. Triggers on "mamh", "multi-harness", "multi-agent project", "team build".
---

# MAMH - Multi-Agent Multi-Harness

MAMH orchestrates teams of specialized AI agents to build complex projects autonomously. It uses Claude Code's Agent Teams feature to provision purpose-built agents, assign scoped tickets, enforce path boundaries, run review gates, and iterate through milestones until the project is complete.

When triggered, MAMH runs a structured 6-phase lifecycle: Planning Interview, Agent Definition, Ticket Generation, Execution, Review Gates, and Milestone Iteration. The orchestrator agent operates in **delegate mode** (coordination only, no direct code changes) while specialized teammate agents do all implementation work.

---

## Prerequisites

Before starting, verify the following:

1. **Agent Teams is enabled.** The environment variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` must be set. If it is not, inform the user:
   > "MAMH requires Claude Code Agent Teams. Please enable it by setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in your environment, then try again."
2. **Plugin scripts exist.** The plugin root is available via `${CLAUDE_PLUGIN_ROOT}`. Verify that `${CLAUDE_PLUGIN_ROOT}/scripts/init-project.mjs` exists. If not, warn the user that the plugin installation may be incomplete.

---

## Subcommand Routing

Parse the user's input to determine which subcommand to execute:

| Input Pattern | Slash Command | Action |
|---------------|---------------|--------|
| `mamh <project description>` | `/mamh:plan` | Start a new project. Run planning phases (0-2), then execution. |
| `mamh status` | `/mamh:status` | Display the status dashboard. |
| `mamh review` | `/mamh:review` | Manually trigger a review cycle on completed tickets. |
| `mamh next` | `/mamh:next` | Advance to the next milestone. |
| `mamh resume` | `/mamh:resume` | Resume an interrupted session. |
| `mamh stop` | `/mamh:stop` | Gracefully shut down Agent Teams and save state. |

If the user provides a bare `mamh` with no arguments or description, display this help message listing the available commands.

When `mamh <project description>` is used, invoke `/mamh:plan` with the project description. After planning completes (Phases 0-2), automatically invoke `/mamh:execute` to begin Phase 3.

---

## Directory Structure Reference

After full initialization, the `.mamh/` directory looks like:

```
.mamh/
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
