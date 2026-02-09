---
name: execute
description: Launch Agent Teams and execute the current milestone's tickets autonomously. Triggers on "mamh execute", "mamh run", or automatically after planning completes.
---

# MAMH Execute — Phase 3

This skill launches an Agent Team and executes the current milestone's tickets autonomously. The orchestrator operates in **delegate mode** (coordination only, no direct code changes) while specialized teammate agents do all implementation work.

---

## Prerequisites

Before starting, verify the following:

1. **Agent Teams is enabled.** The environment variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` must be set. If it is not, inform the user:
   > "MAMH requires Claude Code Agent Teams. Please enable it by setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in your environment, then try again."
2. **Planning is complete.** Verify `.mamh/state/mamh-state.json` exists and shows `phase >= 2` with `status: "tickets-generated"` (or `status: "executing"` for resume). If not, inform the user:
   > "No tickets found. Run `/mamh:plan` first to generate the project plan."
3. **Plugin scripts exist.** The plugin root is available via `${CLAUDE_PLUGIN_ROOT}`. Verify that `${CLAUDE_PLUGIN_ROOT}/scripts/scope-guard.mjs` and `${CLAUDE_PLUGIN_ROOT}/scripts/keep-working.mjs` exist.

---

## Phase 3: Execution (Autonomous)

**Goal:** Launch an Agent Team and execute the current milestone's tickets autonomously.

**CRITICAL:** This phase MUST use Claude Code's native **Agent Teams** feature — NOT the Task tool.

- Agent Teams (`TeamCreate` + `SendMessage`) spawns real teammate sessions that share a task list and can coordinate with each other.
- The `Task` tool spawns isolated one-shot subagents that cannot share state or coordinate. **Do NOT use it for execution.**

**Anti-patterns (NEVER do these):**
```
# WRONG — isolated subagents, no coordination, no shared task list
Task(subagent_type="oh-my-claudecode:executor", prompt="implement T001...")
Task(subagent_type="general-purpose", prompt="build the backend...")
```

**Correct pattern:**
```
# RIGHT — persistent teammates with shared task list
TeamCreate(team_name="mamh-<project>")
# Then spawn teammates with Task(team_name="mamh-<project>", name="mamh-backend", ...)
# Teammates communicate via SendMessage and share TaskList
```

### Step 3.0 - Git Worktree Setup

Each agent with write permission operates in its own git worktree, branched from `main`. This eliminates merge conflicts during parallel execution.

Run the worktree setup script for each writing agent:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.mjs"
```

This creates a worktree per agent:
```bash
git worktree add .worktrees/mamh-backend -b mamh/backend main
git worktree add .worktrees/mamh-frontend -b mamh/frontend main
# ... one per writing agent
```

**Important:**
- Each agent's working directory is `.worktrees/mamh-<agent-id>/` — NOT the project root
- The `.mamh/` directory is shared (symlinked or accessed at project root) so all agents can read state
- The reviewer agent has READ-ONLY access to all worktrees at `.worktrees/**`
- Record worktree paths in `.mamh/agents/registry.json` → `worktreePath` field
- When spawning teammates (Step 3.1), include the worktree path in their spawn prompt

### Step 3.1 - Create the Agent Team

Create an agent team by instructing Claude Code to spawn teammates. You are the team lead operating in **delegate mode** (coordination only — do not implement code yourself).

**How to create the team:** Tell Claude Code to create an agent team. For each agent in `.mamh/agents/registry.json`, spawn a teammate with a detailed spawn prompt that includes:

1. The agent's role and responsibilities (from `.claude/agents/mamh-<agent-id>.md`)
2. The agent's owned paths, readable paths, and forbidden paths
3. The POLICY.md rules (from `.mamh/POLICY.md`)
4. Their assigned tickets for the current milestone (full ticket content)
5. Instructions to read `.mamh/POLICY.md` at session start

**Example team creation prompt (adapt based on actual agents):**

```
Create an agent team for this project. I am the team lead in delegate mode — I will only coordinate, not write code.

Spawn these teammates:

1. **mamh-backend** (use Sonnet): Backend engineer. Owns src/api/**, src/db/**, tests/api/**.
   Your working directory is `.worktrees/mamh-backend/` — write ALL files there, not in the project root.
   Your tickets for M001:
   - T001: Setup FastAPI project structure [no deps]
   - T003: Define shared API types [no deps]
   - T004: Setup PostgreSQL schema [deps: T001]
   Read .mamh/POLICY.md for team rules. Read your full ticket files from .mamh/tickets/milestones/M001-*/

2. **mamh-frontend** (use Sonnet): Frontend engineer. Owns src/ui/**, public/**.
   Your working directory is `.worktrees/mamh-frontend/` — write ALL files there, not in the project root.
   Your tickets for M001:
   - T002: Setup React + TypeScript scaffold [no deps]
   - T005: Setup design tokens [deps: T002]
   Read .mamh/POLICY.md for team rules.

3. **mamh-reviewer** (use Opus): Code reviewer. Read-only access to all files plus .worktrees/**.
   No implementation tickets. Review completed work when requested.
   Read .mamh/POLICY.md for team rules.

Each teammate should:
- Read .mamh/POLICY.md before starting work
- Work only within their owned paths
- Mark tickets complete by checking all acceptance criteria boxes
- Message me (the lead) when blocked or when a ticket is done
- Self-claim their next ticket when one finishes
```

After creating the team, **switch to delegate mode** (press Shift+Tab) to restrict yourself to coordination-only tools.

### Step 3.2 - Ticket Distribution via Shared Task List

Use the Agent Teams shared task list (not file-based tracking) to manage work:

1. **Create tasks** in the shared task list for each ticket in the current milestone
2. **Set dependencies** between tasks matching ticket dependencies
3. Teammates **self-claim** available tasks as they finish their current work
4. The TeammateIdle hook (`${CLAUDE_PLUGIN_ROOT}/scripts/keep-working.mjs`) prevents teammates from going idle when they have unclaimed tickets

### Step 3.3 - Scope Enforcement

The scope guard hook (`${CLAUDE_PLUGIN_ROOT}/scripts/scope-guard.mjs`) automatically enforces path boundaries on all teammate file writes:

- Before any file write, the hook checks the agent's `ownedPaths` from `registry.json`
- Writes outside scope are **blocked** with a message identifying the violation
- Reads to `readablePaths` are allowed
- Access to `forbiddenPaths` is blocked entirely

### Step 3.4 - Agent-to-Agent Coordination

Teammates communicate using **Agent Teams native messaging** (not file-based coordination):

- Teammates **message each other directly** for interface contracts, shared types, and handoffs
- Teammates **message the lead** when blocked, when a ticket is done, or when they need a decision
- The lead **broadcasts** important decisions to all teammates (use sparingly)
- Key decisions are also logged to `.mamh/comms/decisions.md` for persistence

### Step 3.5 - Dynamic Agent Provisioning

If the orchestrator detects a gap (e.g., a ticket requires expertise not covered by existing agents), it can provision a new agent at runtime:

- **If `agentApprovalMode` is `auto`:** Create the agent immediately, log the decision.
- **If `agentApprovalMode` is `suggest`:** Propose the new agent to the user with rationale. Wait for approval.
- **If `agentApprovalMode` is `locked`:** Do NOT create new agents. Assign the ticket to the closest existing agent and log a warning.

New agents are created following the same process as Phase 1 (agent definition file + registry update).

### Step 3.6 - Progress Tracking

During execution, continuously update:

- **Ticket status** in ticket files: `pending` -> `in_progress` -> `completed` / `blocked` / `failed`
- **Agent stats** in `registry.json`: increment `ticketsCompleted`, update `ticketsAssigned`
- **State file** `.mamh/state/mamh-state.json`:
  ```json
  {
    "phase": 3,
    "status": "executing",
    "currentMilestone": "M001",
    "activeAgents": ["mamh-backend", "mamh-frontend"],
    "ticketsSummary": {
      "total": 12,
      "completed": 3,
      "inProgress": 2,
      "pending": 6,
      "blocked": 1,
      "failed": 0
    },
    "lastUpdated": "<ISO timestamp>"
  }
  ```

### Step 3.7 - Keep-Working Enforcement

The keep-working script (`${CLAUDE_PLUGIN_ROOT}/scripts/keep-working.mjs`) ensures agents do not stop prematurely. If an agent reports completion but has remaining assigned tickets, it is redirected to the next ticket.

---

## Error Handling

### Agent Failure

If an agent fails (crashes, times out, or produces invalid output):

1. Mark the ticket as `failed` with error details in review notes.
2. Log the failure to `.mamh/logs/errors/<ticket-id>-error.md`.
3. Attempt recovery:
   - If the failure is transient (timeout, rate limit): retry once.
   - If the failure is persistent: reassign to a different agent or escalate to a higher model tier.
   - If no recovery is possible: mark as `blocked` and notify the user.

### Scope Violation

If an agent writes outside its owned paths:

1. Block the write operation via the scope guard hook.
2. Log the violation to `.mamh/logs/scope-violations.md`.
3. Inform the agent of the violation and which agent owns the target path.
4. The agent should create a coordination request instead.

### Dependency Deadlock

If the orchestrator detects a circular dependency (tickets waiting on each other):

1. Log the deadlock to `.mamh/logs/errors/deadlock-<timestamp>.md`.
2. Present the deadlock to the user with the dependency chain.
3. Ask the user to break the cycle by removing or reordering a dependency.
