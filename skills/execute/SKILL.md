---
name: takt-execute
description: Execute the current milestone's tickets autonomously using Agent Teams or Subagent mode. Triggers on "takt execute", "takt run", or automatically after planning completes.
---

# Takt Execute — Phase 3

This skill executes the current milestone's tickets autonomously. Takt supports two execution modes, chosen during planning (Phase 0) and stored in `session.json` as `executionMode`:

| Mode | Mechanism | Orchestrator | Communication |
|------|-----------|-------------|---------------|
| `agent-teams` | TeamCreate + SendMessage | `takt-orchestrator.md` agent in delegate mode | Agent Teams native messaging |
| `subagents` | Task tool parallel dispatches | **Main session** acts as orchestrator | File-based via `.takt/comms/<ticket-id>-output.md` |

---

## Prerequisites

Before starting, verify the following:

1. **Read execution mode.** Load `.takt/session.json` and read the `executionMode` field. If the field is missing, default to `"agent-teams"` if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set, otherwise `"subagents"`.
2. **Agent Teams env var (agent-teams mode only).** If `executionMode` is `"agent-teams"`, verify `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If it is not, inform the user:
   > "Agent Teams mode requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Set the env var and retry, or switch to subagent mode by updating `executionMode` in `.takt/session.json`."
3. **Planning is complete.** Verify `.takt/state/takt-state.json` exists and shows `phase >= 2` with `status: "tickets-generated"` (or `status: "executing"` for resume). If not, inform the user:
   > "No tickets found. Run `/takt-plan` first to generate the project plan."
4. **Plugin scripts exist.** The plugin root is available via `${CLAUDE_PLUGIN_ROOT}`. Verify that `${CLAUDE_PLUGIN_ROOT}/scripts/scope-guard.mjs` and `${CLAUDE_PLUGIN_ROOT}/scripts/keep-working.mjs` exist.

---

## Mode Routing

Read `executionMode` from `.takt/session.json`:

- If `"agent-teams"` → proceed to **Section A: Agent Teams Execution**
- If `"subagents"` → proceed to **Section B: Subagent Execution**

**Before starting either mode**, print:
```
[Takt] Executing M001 — <milestone name> (<N> tickets, <mode> mode)
```

---

## Section A: Agent Teams Execution

**CRITICAL: This section MUST use Agent Teams (TeamCreate + SendMessage), NOT the Task tool.** If you are tempted to use the Task tool here, STOP.

- Agent Teams (`TeamCreate` + `SendMessage`) spawns real teammate sessions that share a task list and can coordinate with each other.
- The `Task` tool spawns isolated one-shot subagents that cannot share state or coordinate. **Do NOT use it for execution in this mode.**

**Anti-patterns (NEVER do these in agent-teams mode):**
```
# WRONG — isolated subagents, no coordination, no shared task list
Task(subagent_type="oh-my-claudecode:executor", prompt="implement T001...")
Task(subagent_type="general-purpose", prompt="build the backend...")
```

**Correct pattern:**
```
# RIGHT — persistent teammates with shared task list
TeamCreate(team_name="takt-<project>")
# Then spawn teammates with Task(team_name="takt-<project>", name="takt-backend", ...)
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
git worktree add .worktrees/takt-backend -b takt/backend main
git worktree add .worktrees/takt-frontend -b takt/frontend main
# ... one per writing agent
```

**Important:**
- Each agent's working directory is `.worktrees/takt-<agent-id>/` — NOT the project root
- The `.takt/` directory is shared (symlinked or accessed at project root) so all agents can read state
- The reviewer agent has READ-ONLY access to all worktrees at `.worktrees/**`
- Record worktree paths in `.takt/agents/registry.json` → `worktreePath` field
- When spawning teammates (Step 3.1), include the worktree path in their spawn prompt

### Step 3.1 - Create the Agent Team

Create an agent team by instructing Claude Code to spawn teammates. You are the team lead operating in **delegate mode** (coordination only — do not implement code yourself).

**How to create the team:** Tell Claude Code to create an agent team. Spawn teammates using their registry `modelTier`. For simple mechanical subtasks, prefer haiku to save cost. The **takt-reviewer** agent is a mandatory team member — always spawn it regardless of project type. For each agent in `.takt/agents/registry.json`, spawn a teammate with a detailed spawn prompt that includes:

1. The agent's role and responsibilities (from `.claude/agents/takt-<agent-id>.md`)
2. The agent's owned paths, readable paths, and forbidden paths
3. The POLICY.md rules (from `.takt/POLICY.md`)
4. Their assigned tickets for the current milestone (full ticket content)
5. Instructions to read `.takt/POLICY.md` at session start

**Example team creation prompt (adapt based on actual agents):**

```
Create an agent team for this project. I am the team lead in delegate mode — I will only coordinate, not write code.

Spawn these teammates:

1. **takt-backend** (use Sonnet): Backend engineer. Owns src/api/**, src/db/**, tests/api/**.
   Your working directory is `.worktrees/takt-backend/` — write ALL files there, not in the project root.
   Your tickets for M001:
   - T001: Setup FastAPI project structure [no deps]
   - T003: Define shared API types [no deps]
   - T004: Setup PostgreSQL schema [deps: T001]
   Read .takt/POLICY.md for team rules. Read your full ticket files from .takt/tickets/milestones/M001-*/

2. **takt-frontend** (use Sonnet): Frontend engineer. Owns src/ui/**, public/**.
   Your working directory is `.worktrees/takt-frontend/` — write ALL files there, not in the project root.
   Your tickets for M001:
   - T002: Setup React + TypeScript scaffold [no deps]
   - T005: Setup design tokens [deps: T002]
   Read .takt/POLICY.md for team rules.

3. **takt-reviewer** (use Opus): Code reviewer. Read-only access to all files plus .worktrees/**.
   No implementation tickets. Review completed work when requested.
   Read .takt/POLICY.md for team rules.

Each teammate should:
- Read .takt/POLICY.md before starting work
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
- Key decisions are also logged to `.takt/comms/decisions.md` for persistence

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
- **State file** `.takt/state/takt-state.json`:
  ```json
  {
    "phase": 3,
    "status": "executing",
    "currentMilestone": "M001",
    "activeAgents": ["takt-backend", "takt-frontend"],
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

### Step 3.6b - State Persistence Checklist

When a ticket status changes, perform ALL of these updates:

1. Update the ticket markdown file's `**Status:**` field
2. If approved, add `**ApprovedAt:** <ISO timestamp>`
3. Update `takt-state.json` `ticketsSummary` counts
4. Update `registry.json` agent stats (`ticketsCompleted`, `ticketsAssigned`)
5. Update `.takt/HANDOFF.md` (see below)

### Step 3.6c - HANDOFF.md Updates

Update `.takt/HANDOFF.md` at these checkpoints:

1. **After each ticket approval:** Add a line to "What Has Been Done" noting what was delivered. Update "In Progress" and "Next Steps".
2. **After each batch completes (subagent mode):** Update "In Progress" with remaining batches and ticket counts.
3. **At milestone completion:** Perform a FULL handoff rewrite — update all sections and append a Milestone History entry (see `/takt-handoff` for template).
4. **On any significant event** (blocker, new agent provisioned, scope change): Update the relevant section.

The goal is that a new session reading only HANDOFF.md can understand the full project state without reading every ticket file.

### Step 3.6d - Inline Progress Output

**Print a one-liner to the user** at each of these events. This keeps the user informed without requiring them to check files:

1. **After each ticket approval:**
   ```
   [Takt] T001 approved (takt-backend) — Setup project structure
   ```

2. **After each batch completes (subagent mode):**
   ```
   [Takt] Batch 2/4 complete. 8/14 tickets done.
   ```

3. **At milestone completion:**
   ```
   [Takt] Milestone M001 complete! 6/6 tickets approved. Merging branches.
   ```

4. **When starting the next milestone:**
   ```
   [Takt] Starting M002 — Core Features (8 tickets)
   ```

5. **On blocker or failure:**
   ```
   [Takt] T007 BLOCKED — dependency T005 failed. Escalating.
   ```

These messages are output as regular text to the user (not written to files). They supplement, not replace, the HANDOFF.md updates.

### Step 3.7 - Keep-Working Enforcement

The keep-working script (`${CLAUDE_PLUGIN_ROOT}/scripts/keep-working.mjs`) ensures agents do not stop prematurely. If an agent reports completion but has remaining assigned tickets, it is redirected to the next ticket.

---

## Section B: Subagent Execution

In subagent mode, the **main session** acts as orchestrator. There is no separate `takt-orchestrator.md` agent — you (the main session) coordinate everything directly. Tickets are dispatched via the Task tool in dependency-ordered parallel batches. Communication is file-based.

**CRITICAL: In subagent mode, do NOT use TeamCreate or SendMessage.** Use the Task tool to dispatch work.

**Correct pattern (subagent mode):**
```
# Dispatch parallel batch of tickets
Task(subagent_type="general-purpose", prompt="Implement ticket T001: ...", model="sonnet")
Task(subagent_type="general-purpose", prompt="Implement ticket T002: ...", model="sonnet")
# Wait for results, review, then dispatch next batch
```

### Step 3.0-S - Git Worktree Setup

Same as Agent Teams mode. Each agent with write permission operates in its own git worktree.

Run the worktree setup script:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.mjs"
```

**Important:** Same worktree rules apply as Section A Step 3.0. Each subagent's Task prompt must specify the worktree path as working directory.

### Step 3.1-S - Build Dependency Graph and Compute Batches

Read all tickets for the current milestone from `.takt/tickets/milestones/<current-milestone>/`. For each ticket, extract:
- Ticket ID, title, description, acceptance criteria
- Assigned agent (from ticket metadata)
- Dependencies (from ticket metadata)

**Topological sort:** Order tickets by dependencies to produce a valid execution order. Then group into **parallel batches**:

1. **Batch 1:** All tickets with zero unresolved dependencies (no deps, or all deps already completed)
2. **Batch 2:** All tickets whose dependencies are satisfied after Batch 1 completes
3. **Batch N:** Continue until all tickets are batched

If a circular dependency is detected, stop and report it to the user (see Error Handling).

**Example batch computation:**
```
Tickets: T001 (no deps), T002 (no deps), T003 (deps: T001), T004 (deps: T001, T002), T005 (deps: T003)

Batch 1: [T001, T002]     — no deps, execute in parallel
Batch 2: [T003, T004]     — deps satisfied after Batch 1
Batch 3: [T005]           — deps satisfied after Batch 2
```

### Step 3.2-S - Execute Batches

For each batch, in order:

#### 3.2-S.1 — Dispatch Parallel Tasks

For each ticket in the batch, dispatch a Task tool call **in parallel** (multiple Task calls in a single message). Each Task prompt must include:

1. **Ticket content:** Full ticket ID, title, description, acceptance criteria
2. **Agent context:** The agent's role, owned paths, readable paths, forbidden paths (from `registry.json`)
3. **Working directory:** The agent's worktree path (`.worktrees/takt-<agent-id>/`)
4. **POLICY rules:** Include the key rules from `.takt/POLICY.md` (scope rules, hard prohibitions, code standards, definition of done)
5. **Prior ticket outputs:** If this ticket depends on other tickets, include the output summaries from `.takt/comms/<dep-ticket-id>-output.md`
6. **Output instruction:** "When done, write a summary of what you implemented, files changed, and any interface contracts to `.takt/comms/<ticket-id>-output.md`"

**Task dispatch parameters:**
- `subagent_type`: `"general-purpose"`
- `model`: Use the agent's `modelTier` from `registry.json` (e.g., `"sonnet"`, `"haiku"`, `"opus"`)
- `prompt`: Comprehensive ticket prompt as described above

**Example dispatch:**
```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  prompt="You are takt-backend, a backend engineer.

Working directory: .worktrees/takt-backend/
Owned paths: src/api/**, src/db/**, tests/api/**
Read-only paths: src/shared/**, .takt/**

## Ticket T001: Setup FastAPI project structure
Status: pending → in_progress
Priority: critical
Dependencies: none

## Description
<full ticket description>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>

## POLICY Rules
<key rules from POLICY.md>

## Instructions
1. Work ONLY within your owned paths inside .worktrees/takt-backend/
2. Write all files to .worktrees/takt-backend/, NOT the project root
3. Satisfy ALL acceptance criteria
4. Write tests for new functionality
5. Commit your work to the takt/backend branch
6. When done, write your output summary to .takt/comms/T001-output.md with:
   - Files created/modified
   - Interface contracts (APIs, types, schemas)
   - Any blockers or notes for dependent tickets
"
)
```

#### 3.2-S.2 — Collect Results

After all Tasks in the batch complete:

1. Read each `.takt/comms/<ticket-id>-output.md` for results
2. If a Task failed (no output file, or output indicates failure), mark the ticket per error handling rules

#### 3.2-S.3 — Review (Full Validation)

Run the **full review process** per the configured `reviewMode` (see `/takt-review` for details). This is different from the `review-gate.mjs` hook, which only checks acceptance criteria checkboxes. The full review includes:

- **Auto:** Run build + test + diagnostics + scope checks in each agent's worktree
- **Peer:** Dispatch a reviewer Task (same as a ticket Task but with reviewer role and read-only access)
- **User:** Present changes to user for approval

If any check fails, mark the ticket as `rejected` with failure details and return it to `in_progress` for re-dispatch in a follow-up batch.

#### 3.2-S.4 — Update State & Print Progress

After review completes for each ticket:

1. Update ticket markdown file `**Status:**` field (`completed` → `approved` or `rejected`)
2. If approved, add `**ApprovedAt:** <ISO timestamp>`
3. Update `takt-state.json` `ticketsSummary` counts
4. Update `registry.json` agent stats (`ticketsCompleted`, `ticketsAssigned`)
5. Update `.takt/HANDOFF.md` with progress
6. **Print inline progress** for each approved ticket:
   ```
   [Takt] T001 approved (takt-backend) — <ticket title>
   ```
7. **After all tickets in batch are processed**, print batch summary:
   ```
   [Takt] Batch <N>/<total> complete. <done>/<total> tickets done.
   ```

#### 3.2-S.5 — Next Batch

If all tickets in the batch are approved, proceed to the next batch. If any tickets were rejected, return them to pending for re-dispatch in a follow-up batch.

Repeat until all batches are complete.

### Step 3.3-S - Scope Enforcement

The scope-guard hook (`${CLAUDE_PLUGIN_ROOT}/scripts/scope-guard.mjs`) fires in both modes. In subagent mode, each Task subagent triggers the hook when writing files. The hook reads the agent name from the environment and enforces path boundaries from `registry.json`.

### Step 3.4-S - File-Based Communication

In subagent mode, there is no Agent Teams messaging. Instead:

- **Ticket outputs:** Each subagent writes `.takt/comms/<ticket-id>-output.md` when done
- **Decisions:** The main session (orchestrator) writes to `.takt/comms/decisions.md`
- **Changelog:** The main session writes to `.takt/comms/changelog.md`
- **Inter-ticket context:** When dispatching a ticket with dependencies, include the content of dependent ticket output files in the Task prompt

### Step 3.5-S - Dynamic Agent Provisioning

Same logic as Agent Teams mode. If a gap is detected:

- **If `agentApprovalMode` is `auto`:** Create agent definition file + registry entry, then dispatch via Task.
- **If `agentApprovalMode` is `suggest`:** Propose to user, wait for approval, then create and dispatch.
- **If `agentApprovalMode` is `locked`:** Assign to closest existing agent.

### Step 3.6-S - Progress Tracking

The main session updates all state files directly (no delegation needed):

- Update ticket statuses in ticket files
- Update `takt-state.json` after each batch completes
- Update `registry.json` agent stats
- Update `.takt/HANDOFF.md` after each batch (see Step 3.6c for checkpoint rules)
- At milestone completion, perform a full HANDOFF.md rewrite with Milestone History entry

### Step 3.7-S - Keep-Working

Not applicable in subagent mode. The TeammateIdle hook only fires in Agent Teams mode. In subagent mode, the main session controls the dispatch loop and there is no idle state.

---

## Error Handling (Both Modes)

### Agent/Subagent Failure

If an agent fails (crashes, times out, or produces invalid output):

1. Mark the ticket as `failed` with error details in review notes.
2. Log the failure to `.takt/logs/errors/<ticket-id>-error.md`.
3. Attempt recovery:
   - If the failure is transient (timeout, rate limit): **retry once** with the same agent.
   - If the retry fails: **escalate model tier** (haiku → sonnet → opus) and retry once.
   - If no recovery is possible: mark as `blocked` and notify the user.

### Scope Violation

If an agent writes outside its owned paths:

1. Block the write operation via the scope guard hook.
2. Log the violation to `.takt/logs/scope-violations.md`.
3. Inform the agent of the violation and which agent owns the target path.
4. The agent should create a coordination request instead.

### Dependency Deadlock

If a circular dependency is detected during batch computation (subagent mode) or runtime (agent-teams mode):

1. Log the deadlock to `.takt/logs/errors/deadlock-<timestamp>.md`.
2. Present the deadlock to the user with the dependency chain.
3. Ask the user to break the cycle by removing or reordering a dependency.
