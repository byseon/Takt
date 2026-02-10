# MAMH — Multi-Agent Multi-Harness

**Orchestrate teams of specialized AI agents to build complex projects autonomously.**

MAMH is a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that coordinates multiple agents to build projects together. Instead of one LLM doing everything in a single context window, MAMH generates a team of specialists that work in parallel — each with scoped file access, defined responsibilities, and restricted tools.

### Why MAMH?

**1. Multi-agent execution that actually coordinates.** MAMH supports both [Agent Teams](https://docs.anthropic.com/en/docs/claude-code) (persistent teammates with shared task lists) and a subagent fallback (Task-tool batch dispatch). Either way, agents work in parallel with scope enforcement — the backend agent literally cannot write to frontend files.

**2. Human-readable tracking via markdown and tickets.** Every piece of project state is a readable file — not hidden in LLM context. Tickets are markdown files with acceptance criteria. Decisions are logged to `decisions.md`. Progress is captured in `HANDOFF.md`. You can open any file in `.mamh/` and understand exactly what happened, what's in progress, and what's next. This makes it possible to stop, resume across sessions, hand off to a colleague, or audit what the agents did.

```
You say: mamh "Build an AI communication platform"

  3 quick questions → auto-generated plan → approve → agents take it from there
```

### Execution Modes

| Mode | How It Works | Best For |
|------|-------------|----------|
| **Agent Teams** | Persistent teammates, shared task list, native messaging | Users with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
| **Subagents** | Task-tool parallel batch dispatch, file-based communication | Everyone — no experimental features needed |

---

## Table of Contents

- [Key Features](#key-features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Example Session](#example-session)
- [How It Works](#how-it-works)
- [What Gets Generated](#what-gets-generated)
- [Agent Templates](#agent-templates)
- [Configuration](#configuration)
- [Hooks](#hooks)
- [Git Worktree Isolation](#git-worktree-isolation)
- [POLICY.md](#policymd--shared-rulebook)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Progressive Planning** | 3 questions → auto-generated plan → one-click approve → execute. No lengthy interview. |
| **Dynamic Agents** | Creates specialized agents based on project needs. A CLI tool gets different agents than a full-stack web app. |
| **Scope Enforcement** | Hooks block agents from writing outside their domain. Backend cannot touch frontend files. |
| **Review Gates** | Tickets must pass build, test, and optional peer/user review before approval. |
| **Milestone Delivery** | Work organized into ordered milestones with dependency tracking. Infrastructure ships before features. |
| **Git Worktree Isolation** | Each agent works on its own branch. No merge conflicts during parallel work. |
| **Inline Progress** | One-liner updates after each ticket and milestone so you always know what's happening. |
| **Resume/Stop** | Save state at any point, shut down cleanly, resume later exactly where you left off. |
| **Zero Dependencies** | All scripts use Node.js built-ins only. No `npm install` needed. |

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **Claude Code** | Latest version |
| **Node.js** | >= 18.0.0 (for hook scripts) |
| **Git** | Required for worktree isolation |
| **Agent Teams** *(optional)* | Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` for persistent teammate mode. Without it, Subagent mode works out of the box. |

---

## Installation

### Option A: Marketplace (Permanent)

```bash
# Inside Claude Code:
/plugin marketplace add usespeakeasy/mamh-plugin
/plugin install mamh@mamh-marketplace
```

### Option B: Local (Session Only)

```bash
git clone https://github.com/usespeakeasy/mamh-plugin.git
claude --plugin-dir /path/to/multi-agent-multi-harness
```

No `npm install`. No build step. No dependencies.

---

## Quick Start

```
mamh "Build a React dashboard with charts and user authentication"
```

That's it. MAMH:

1. Asks 3 quick questions (constraints, execution mode, involvement level)
2. Auto-generates the full plan (agents, milestones, tickets)
3. Shows a summary for your approval
4. Executes tickets in parallel with scope enforcement
5. Reviews completed work (build/test checks + optional peer review)
6. Delivers milestone by milestone until the project is complete

Check progress anytime with `mamh status`. Update the handoff doc with `mamh handoff`. Stop cleanly with `mamh stop`.

---

## Commands

| Command | Slash Command | Description |
|---------|---------------|-------------|
| `mamh <description>` | `/mamh-plan` | Start a new project (plan + execute) |
| `mamh status` | `/mamh-status` | Show dashboard: agents, tickets, progress |
| `mamh review` | `/mamh-review` | Trigger review on completed tickets |
| `mamh next` | `/mamh-next` | Advance to the next milestone |
| `mamh handoff` | `/mamh-handoff` | Update HANDOFF.md with current state |
| `mamh resume` | `/mamh-resume` | Resume an interrupted session |
| `mamh stop` | `/mamh-stop` | Gracefully shut down and save state |
| `mamh execute` | `/mamh-execute` | Launch execution for current milestone |

Bare `mamh` with no arguments shows help.

---

## Example Session

```
mamh "Build a todo app with React frontend and FastAPI backend"
```

### Planning (3 questions + approval)

```
Q1: Any hard constraints?
> Must use PostgreSQL. TypeScript for frontend.

Q2: How should agents run?
    [Agent Teams (Recommended) | Subagents]
> Agent Teams

Q3: How involved do you want to be?
    [Autonomous | Milestone checkpoints (Recommended) | Hands-on]
> Milestone checkpoints

Generating plan...

================================================================
  MAMH Plan Summary
================================================================
  Project:     Todo App
  Execution:   Agent Teams
  Involvement: Milestone checkpoints

  Agents (4):
    mamh-backend    | sonnet | src/api/**, src/db/**
    mamh-frontend   | sonnet | src/ui/**, public/**
    mamh-designer   | sonnet | src/ui/components/**, src/ui/styles/**
    mamh-reviewer   | opus   | (read-only: all)

  Milestones (4, 17 tickets):
    M001: Scaffolding     (5 tickets)  T001-T005
    M002: Authentication  (3 tickets)  T006-T008
    M003: Core CRUD       (5 tickets)  T009-T013
    M004: Polish          (4 tickets)  T014-T017
================================================================

> Approve

[MAMH] Planning complete. 4 agents, 17 tickets, 4 milestones.
[MAMH] Starting M001: Scaffolding.
```

### Execution (inline progress)

```
[MAMH] Executing M001 — Scaffolding (5 tickets, agent-teams mode)
[MAMH] T001 approved (mamh-backend)  — Setup FastAPI project structure
[MAMH] T002 approved (mamh-frontend) — Setup React + TypeScript scaffold
[MAMH] T003 approved (mamh-backend)  — Define shared API types
[MAMH] T004 approved (mamh-backend)  — Setup PostgreSQL schema
[MAMH] T005 approved (mamh-designer) — Setup design tokens
[MAMH] Milestone M001 complete! 5/5 approved. Merging branches.

Options: [Continue] [Re-plan] [Modify] [Stop]
> Continue

[MAMH] Starting M002 — Authentication (3 tickets)
[MAMH] T006 approved (mamh-backend)  — Auth endpoints
[MAMH] T007 approved (mamh-frontend) — Login/signup UI
[MAMH] T008 approved (mamh-backend)  — JWT middleware
[MAMH] Milestone M002 complete! 3/3 approved. Merging branches.
...
```

---

## How It Works

```
User: "mamh Build an AI scoring platform"
         |
  Phase 0: Planning (progressive disclosure)
    - 3 quick questions (constraints, execution mode, involvement)
    - Analyst + architect + planner agents auto-generate full plan
    - User approves (or modifies) the plan summary
         |
  Phase 1-2: File Generation (automatic, no user input)
    - Agent definition files from templates
    - Registry with scoped paths
    - Milestone directories with ticket files
         |
  Phase 3: Parallel Execution
    - Mode A (Agent Teams): persistent teammates, shared task list
    - Mode B (Subagents): Task-tool batch dispatch, main session orchestrates
    - Both: scope enforcement, git worktree isolation, inline progress
         |
  Phase 4: Review Gates
    - Auto: build + test + diagnostics + scope check
    - Peer: reviewer agent examines code quality
    - User: human approval for critical changes
         |
  Phase 5: Milestone Iteration
    - Archive completed milestone, merge branches
    - Evaluate roster for next milestone
    - Advance mode: auto / re-plan / user-decides
    - Repeat Phases 3-5 until done
         |
  Complete → final report in .mamh/logs/project-report.md
```

---

## What Gets Generated

### Project State (`.mamh/`)

```
.mamh/
  HANDOFF.md                 # Primary context file — what's done, decisions, next steps
  POLICY.md                  # Shared rules all agents follow
  prd.md                     # Product Requirements Document
  tech-spec.md               # Technical Specification
  constraints.md             # Hard constraints and preferences
  session.json               # Project configuration (execution mode, review mode, etc.)
  state/
    mamh-state.json          # Current phase, milestone, ticket counts
  agents/
    registry.json            # Agent roster with scoped path boundaries
  tickets/
    milestones/
      M001-scaffolding/      # Milestone directories
        _milestone.json      # Milestone metadata
        T001-setup-api.md    # Individual ticket files
        T002-setup-ui.md
      M002-auth/
        ...
    archive/                 # Completed milestones moved here
  comms/
    decisions.md             # Architectural decisions log
    changelog.md             # Change log
  reviews/                   # Review results per ticket
  logs/                      # Milestone summaries, errors, scope violations
```

### Agent Definitions (`.claude/agents/`)

```
.claude/agents/
  mamh-orchestrator.md       # Team lead (delegate mode, no code tools)
  mamh-backend.md            # Backend engineer
  mamh-frontend.md           # Frontend engineer
  mamh-reviewer.md           # Code reviewer (read-only)
  ...                        # Additional agents per project
```

---

## Agent Templates

MAMH ships with 8 templates. The architect selects and customizes them per project.

| Template | Model | Description |
|----------|-------|-------------|
| **backend** | sonnet | APIs, database, server logic. Cannot touch frontend files. |
| **frontend** | sonnet | UI, state, routing, styling. Cannot touch server files. |
| **reviewer** | opus | Code review, quality gates. Read-only — cannot write any files. |
| **pm** | sonnet | Requirements, status reports. Docs only — no source code. |
| **designer** | sonnet | Design tokens, components, responsive layouts. |
| **researcher** | sonnet | API docs research, library evaluation. Read-only + web access. |
| **content** | haiku | User-facing copy, documentation, help text. |
| **devops** | sonnet | CI/CD, Docker, deployment configs. Cannot modify app source. |

### Orchestrator

- **Agent Teams mode:** The `mamh-orchestrator` agent runs in delegate mode (opus, no Write/Edit tools). Coordinates all other agents.
- **Subagent mode:** No separate orchestrator. The main session orchestrates via Task tool dispatches.

---

## Configuration

Set during planning (Question 3 maps to smart defaults). Stored in `.mamh/session.json`.

### Involvement Level (Question 3)

| Choice | reviewMode | milestoneAdvanceMode | milestoneGranularity |
|--------|-----------|---------------------|---------------------|
| **Autonomous** | auto | auto-advance | coarse |
| **Milestone checkpoints** | auto | user-decides | medium |
| **Hands-on** | user | user-decides | fine |

### Execution Mode

| Mode | Mechanism | Requires |
|------|-----------|----------|
| `agent-teams` | TeamCreate + SendMessage, orchestrator agent | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
| `subagents` | Task tool parallel batch dispatch, main session orchestrates | Nothing extra |

Default: auto-detected from env var. Overridable during planning.

### Other Settings

| Setting | Values | Default |
|---------|--------|---------|
| `agentApprovalMode` | `auto` / `suggest` / `locked` | `suggest` |
| `milestoneAdvanceMode` | `auto-advance` / `re-plan` / `user-decides` | `user-decides` |
| `reviewMode` | `auto` / `peer` / `user` | `auto` |
| `milestoneGranularity` | `fine` / `medium` / `coarse` | `medium` |

---

## Hooks

Three hooks enforce team discipline. Configured in `hooks/hooks.json`.

| Hook | Event | Mode | What It Does |
|------|-------|------|-------------|
| **scope-guard.mjs** | PreToolUse (Write/Edit) | Both | Blocks writes outside agent's owned paths |
| **review-gate.mjs** | TaskCompleted | Agent Teams only | Enforces acceptance criteria + review mode |
| **keep-working.mjs** | TeammateIdle | Agent Teams only | Redirects idle agents to their next ticket |

In Subagent mode, the main session handles review and dispatch directly — `review-gate` and `keep-working` are not needed.

---

## Git Worktree Isolation

Each writing agent gets its own git branch via worktrees. No merge conflicts during parallel work.

```
Phase 3 start:  git worktree add .worktrees/mamh-backend -b mamh/backend main
                 git worktree add .worktrees/mamh-frontend -b mamh/frontend main

During work:     mamh-backend writes to .worktrees/mamh-backend/src/api/...
                 mamh-frontend writes to .worktrees/mamh-frontend/src/ui/...

Milestone end:   git merge mamh/backend --no-ff
                 git merge mamh/frontend --no-ff
                 git worktree remove .worktrees/mamh-backend
```

Conflicts are rare (scope enforcement prevents shared file access). When they occur, the orchestrator delegates resolution to the file's owner.

---

## POLICY.md -- Shared Rulebook

Every project gets `.mamh/POLICY.md` — a rulebook all agents read at session start. Generated from `templates/POLICY.md` with project-specific values.

**Covers:** agent identity, communication protocol, file ownership, code standards, ticket workflow, review requirements, safety rules, error handling, and coordination patterns.

**Customizable:** Edit `templates/POLICY.md` for all future projects, or `.mamh/POLICY.md` for one project. Changes take effect immediately (agents re-read it each session).

---

## Troubleshooting

### Plugin Not Loading

```bash
# Verify plugin manifest is valid
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf-8')); console.log('OK')"

# If using --plugin-dir, check the path:
claude --plugin-dir /path/to/multi-agent-multi-harness
```

### Agent Teams Not Working

```bash
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # Should output: 1

# If not set:
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Or switch to Subagent mode: edit `.mamh/session.json` and set `"executionMode": "subagents"`.

### Scope Violations

Check the agent's paths in `.mamh/agents/registry.json`. Patterns use glob syntax (`**` matches any path segments). Common cause: pattern doesn't include the target subdirectory.

### Resuming After Interruption

```bash
mamh resume
```

Reads HANDOFF.md for context, resets in-progress tickets to pending, and restores execution in the configured mode.

---

## Contributing

1. Read `CLAUDE.md` (developer guide) and `STATUS.md` (project status)
2. All scripts: ESM (`.mjs`), zero external dependencies, Node.js built-ins only
3. Use `${CLAUDE_PLUGIN_ROOT}` for portable paths, `{{PLACEHOLDER}}` in templates
4. Test in a separate project: `mkdir /tmp/test && cd /tmp/test && git init && claude --plugin-dir /path/to/mamh`
5. Submit a PR with clear description

---

## License

MIT License. See [LICENSE](LICENSE).

---

**MAMH v0.1.5** — Built for Claude Code. Zero dependencies. 3 questions to autonomous execution.
