# MAMH - Multi-Agent Multi-Harness

**Skill name:** `mamh`
**Triggers:** `mamh`, `multi-harness`, `multi-agent project`, `team build`

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

| Input Pattern | Action |
|---------------|--------|
| `mamh <project description>` | Start a new project. Run the full 6-phase flow starting at Phase 0. |
| `mamh status` | Display the status dashboard. See [Status Dashboard](#status-dashboard). |
| `mamh review` | Manually trigger a review cycle on all completed but unreviewed tickets. See [Phase 4](#phase-4-review-gates). |
| `mamh next` | Advance to the next milestone. See [Phase 5](#phase-5-milestone-iteration). |
| `mamh resume` | Resume an interrupted session. See [Resume Protocol](#resume-protocol). |
| `mamh stop` | Gracefully shut down Agent Teams and save state. See [Stop Protocol](#stop-protocol). |

If the user provides a bare `mamh` with no arguments or description, display a brief help message listing these subcommands.

---

## Phase 0: Planning Interview

**Goal:** Transform a vague project idea into a concrete PRD, tech spec, and constraints document.

### Step 0.1 - Parse the Project Description

Read the user's project description from the trigger input. Extract:
- Domain (web app, CLI tool, API, library, mobile, etc.)
- Scale hints (small script, medium project, large system)
- Any explicit technology mentions
- Any explicit constraints (deadline, budget, platform)

### Step 0.2 - Requirements Expansion

Delegate to the `analyst` agent (Opus tier) with this prompt:

```
Analyze the following project description and expand it into a structured requirements document.

Project description: "<user's description>"

Output the following sections:
1. **Core Requirements** - Must-have features (functional requirements)
2. **Non-Functional Requirements** - Performance, security, accessibility, scalability
3. **Implied Requirements** - Things the user likely expects but did not state
4. **Ambiguities** - Questions that need user clarification
5. **Suggested Scope Boundaries** - What is explicitly OUT of scope for v1
6. **Suggested Agent Roles** - What specialist agents this project needs (e.g., backend-engineer, frontend-engineer, test-engineer, devops-engineer, db-architect)
```

### Step 0.3 - Planning Interview

Using the analyst's output, conduct a planning interview with the user. Use `AskUserQuestion` for each question to provide clickable UI options.

Ask these questions in order (skip any that the analyst's output already answers definitively):

1. **Agent Roles**: "Based on your project, I recommend these agent roles: [list from analyst]. Would you like to add, remove, or modify any?"
   - Provide the analyst's suggested roles as default options
   - Allow the user to customize

2. **Hard Constraints**: "Are there any hard constraints I should know about?"
   - Examples: "Must use PostgreSQL", "No external APIs", "Must run on Node 18", "Budget limit of X tokens"
   - Option: "No hard constraints"

3. **Technology Preferences**: "Do you have technology preferences for these areas?"
   - Language/runtime
   - Framework
   - Database
   - Deployment target
   - Option: "Use your best judgment"

4. **Milestone Granularity**: "How granular should milestones be?"
   - **Fine** - Many small milestones (1-3 tickets each), frequent checkpoints
   - **Medium** - Balanced milestones (4-8 tickets each)
   - **Coarse** - Few large milestones (9+ tickets each), less interruption
   - Default: Medium

5. **Review Mode**: "How should completed work be reviewed?"
   - **Auto** - Build + test + diagnostics pass = approved automatically
   - **Peer** - Another agent reviews before approval
   - **User** - You review and approve each ticket manually
   - Default: Use the value from plugin config (`config.reviewMode`)

6. **Milestone Advance Mode**: "When a milestone completes, what should happen?"
   - **Auto-advance** - Immediately start the next milestone
   - **Re-plan** - Re-evaluate remaining milestones before continuing
   - **User-decides** - Pause and ask you
   - Default: Use the value from plugin config (`config.milestoneAdvanceMode`)

### Step 0.4 - Tech Spec Generation

Delegate to the `architect` agent (Opus tier) with this prompt:

```
Create a technical specification for the following project.

**Project Description:** "<user's description>"
**Requirements:** <analyst output from Step 0.2>
**User Preferences:** <answers from Step 0.3>

Output the following:
1. **Architecture Overview** - High-level system design, component diagram (text-based)
2. **Technology Stack** - Exact versions and rationale
3. **Directory Structure** - Proposed project layout
4. **Data Models** - Core entities and relationships
5. **API Design** - Endpoints, contracts, or interface definitions (if applicable)
6. **Agent Scope Map** - For each proposed agent role, define:
   - Owned directories (read-write paths)
   - Readable directories (read-only paths)
   - Tool restrictions (which tools this agent should/should not use)
   - Primary responsibilities
7. **Dependency Graph** - Which components depend on which others
8. **Risk Assessment** - Technical risks and mitigations
```

### Step 0.5 - Initialize Project Structure

Run the init-project script:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init-project.mjs"
```

This creates the `.mamh/` directory structure:

```
.mamh/
  prd.md
  tech-spec.md
  constraints.md
  state/
    mamh-state.json
    session.json
  agents/
    registry.json
  tickets/
    milestones/
  reviews/
  logs/
```

### Step 0.6 - Write Planning Artifacts

Write these files from the gathered information:

- **`.mamh/prd.md`** - Product Requirements Document compiled from the analyst's output and user's interview answers.
- **`.mamh/tech-spec.md`** - Technical specification from the architect's output.
- **`.mamh/constraints.md`** - Hard constraints, scope boundaries, and user preferences consolidated into a single reference.
- **`.mamh/state/session.json`** - Session configuration:
  ```json
  {
    "projectName": "<derived from description>",
    "startedAt": "<ISO timestamp>",
    "currentPhase": 0,
    "currentMilestone": null,
    "agentApprovalMode": "<auto|suggest|locked>",
    "milestoneAdvanceMode": "<auto-advance|re-plan|user-decides>",
    "reviewMode": "<auto|peer|user>",
    "milestoneGranularity": "<fine|medium|coarse>"
  }
  ```

Update `.mamh/state/mamh-state.json`:
```json
{
  "phase": 0,
  "status": "planning-complete",
  "lastUpdated": "<ISO timestamp>"
}
```

Announce completion:
> "Phase 0 complete. PRD, tech spec, and constraints are ready in `.mamh/`. Moving to Phase 1: Agent Definition."

---

## Phase 1: Agent Definition

**Goal:** Create the agent roster -- one specialized agent definition per role, with scoped paths and tool restrictions.

### Step 1.1 - Agent Architecture

Delegate to the `architect` agent (Opus tier) with this prompt:

```
Based on the tech spec and PRD, define the complete agent roster for this project.

**Tech Spec:** <contents of .mamh/tech-spec.md>
**PRD:** <contents of .mamh/prd.md>
**Constraints:** <contents of .mamh/constraints.md>

For each agent, specify:
1. **Agent ID** - Unique identifier (e.g., "backend-engineer", "frontend-engineer", "test-engineer")
2. **Role Description** - One sentence describing what this agent does
3. **Owned Paths** - Directories this agent can read AND write (glob patterns)
4. **Readable Paths** - Directories this agent can read but NOT write (glob patterns)
5. **Forbidden Paths** - Directories this agent must never access
6. **Allowed Tools** - Which tools this agent may use (e.g., Bash, Edit, Write, Read, Glob, Grep, WebFetch)
7. **Restricted Tools** - Tools this agent must NOT use
8. **Model Tier** - haiku / sonnet / opus (based on task complexity)
9. **Memory** - Set to "project" for all agents (persistent learnings)
10. **Coordination Notes** - How this agent interacts with others (dependencies, handoff points)

Also define the **mamh-orchestrator** agent:
- Delegate mode (no code tools: no Edit, Write, Bash for code changes)
- Can use: Read, Glob, Grep (read-only), Task (to delegate), AskUserQuestion
- Coordinates all other agents
- Manages ticket assignment and review flow
```

### Step 1.2 - Generate Agent Definition Files

For each agent from the architect's output, generate a Claude Code agent markdown file at `.claude/agents/mamh-<agent-id>.md`.

Use templates from `${CLAUDE_PLUGIN_ROOT}/templates/agents/` as base if they exist. Merge the architect's specifications into the template.

Each agent file should follow this structure:

```markdown
# mamh-<agent-id>

<Role description>

## Scope

### Owned Paths (read-write)
- <glob patterns>

### Readable Paths (read-only)
- <glob patterns>

### Forbidden Paths
- <glob patterns>

## Tools
### Allowed
- <tool list>

### Restricted
- <tool list>

## Responsibilities
- <bullet list of primary responsibilities>

## Coordination
- <how this agent coordinates with others>

## Memory
- Type: project
- Store learnings in: .mamh/logs/<agent-id>-learnings.md
```

### Step 1.3 - Generate Agent Registry

Write `.mamh/agents/registry.json`:

```json
{
  "agents": [
    {
      "id": "mamh-<agent-id>",
      "role": "<role description>",
      "modelTier": "<haiku|sonnet|opus>",
      "ownedPaths": ["<glob patterns>"],
      "readablePaths": ["<glob patterns>"],
      "forbiddenPaths": ["<glob patterns>"],
      "status": "active",
      "ticketsCompleted": 0,
      "ticketsAssigned": 0
    }
  ],
  "generatedAt": "<ISO timestamp>",
  "totalAgents": "<count>"
}
```

### Step 1.4 - User Confirmation

Present the agent roster to the user in a table:

| Agent | Role | Model | Owned Paths | Status |
|-------|------|-------|-------------|--------|
| mamh-backend | Backend services | sonnet | `src/api/**`, `src/db/**` | Ready |
| mamh-frontend | UI components | sonnet | `src/ui/**`, `public/**` | Ready |
| ... | ... | ... | ... | ... |

Ask the user: "Does this agent roster look correct? You can add, remove, or modify agents before we proceed."

If the user approves, update state:
```json
{ "phase": 1, "status": "agents-defined", "lastUpdated": "<ISO timestamp>" }
```

Announce:
> "Phase 1 complete. Agent roster is locked in. Moving to Phase 2: Ticket Generation."

---

## Phase 2: Ticket Generation

**Goal:** Decompose the project into milestones, each containing agent-assigned tickets with dependencies.

### Step 2.1 - Milestone and Ticket Planning

Delegate to the `planner` agent (Opus tier) with this prompt:

```
Decompose this project into milestones and tickets.

**PRD:** <contents of .mamh/prd.md>
**Tech Spec:** <contents of .mamh/tech-spec.md>
**Constraints:** <contents of .mamh/constraints.md>
**Agent Registry:** <contents of .mamh/agents/registry.json>
**Milestone Granularity:** <fine|medium|coarse from session.json>

Rules:
1. Each milestone is a coherent, deliverable unit of work
2. Each ticket is assigned to exactly ONE agent
3. Tickets have explicit dependencies (list of ticket IDs that must complete first)
4. Tickets include acceptance criteria (testable conditions)
5. The first milestone should establish project scaffolding and shared interfaces
6. Milestones are ordered by dependency (infrastructure first, features second, polish last)

For each milestone, output:
- **Milestone ID** - M001, M002, etc.
- **Name** - Short descriptive name
- **Description** - What this milestone delivers
- **Tickets** - List of tickets:
  - **Ticket ID** - T001, T002, etc. (globally unique)
  - **Title** - Short title
  - **Description** - Detailed description of what to implement
  - **Agent** - Which agent (by ID) owns this ticket
  - **Dependencies** - List of ticket IDs that must complete first (empty list if none)
  - **Acceptance Criteria** - Bullet list of testable conditions
  - **Estimated Complexity** - low / medium / high
  - **Priority** - critical / high / medium / low
```

### Step 2.2 - Create Ticket File Structure

For each milestone, create the directory and ticket files:

```
.mamh/tickets/milestones/
  M001-<name>/
    _milestone.json       # Milestone metadata
    T001-<title>.md       # Ticket file
    T002-<title>.md       # Ticket file
  M002-<name>/
    _milestone.json
    T003-<title>.md
    ...
```

**`_milestone.json` format:**
```json
{
  "id": "M001",
  "name": "<name>",
  "description": "<description>",
  "status": "pending",
  "tickets": ["T001", "T002"],
  "createdAt": "<ISO timestamp>"
}
```

**Ticket file format (e.g., `T001-<title>.md`):**
```markdown
# T001: <Title>

**Agent:** mamh-<agent-id>
**Milestone:** M001
**Status:** pending
**Priority:** <critical|high|medium|low>
**Complexity:** <low|medium|high>
**Dependencies:** <comma-separated ticket IDs, or "none">

## Description
<Detailed description of what to implement>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Review Notes
<!-- Populated after review -->
```

### Step 2.3 - Create Agent Teams Tasks

For each ticket in the first milestone, create an Agent Teams task with:
- Task description from the ticket
- Dependency links to other tasks
- Assignment to the correct teammate agent

### Step 2.4 - Present Ticket Board

Display the ticket board to the user:

```
=== MAMH Ticket Board ===

Milestone M001: Project Scaffolding [PENDING]
  T001 [pending]  Setup project structure          -> mamh-backend    (no deps)
  T002 [pending]  Define shared interfaces         -> mamh-backend    (no deps)
  T003 [pending]  Initialize frontend scaffold     -> mamh-frontend   (deps: T001)
  T004 [pending]  Setup test infrastructure        -> mamh-test       (deps: T001)

Milestone M002: Core Features [PENDING]
  T005 [pending]  Implement user model             -> mamh-backend    (deps: T002)
  ...

Total: X tickets across Y milestones
```

Update state:
```json
{ "phase": 2, "status": "tickets-generated", "currentMilestone": "M001", "lastUpdated": "<ISO timestamp>" }
```

Announce:
> "Phase 2 complete. X tickets across Y milestones are ready. Moving to Phase 3: Execution."

---

## Phase 3: Execution (Autonomous)

**Goal:** Launch Agent Teams and execute the current milestone's tickets autonomously.

### Step 3.1 - Launch Agent Teams

Start Agent Teams in delegate mode with:
- **Team lead:** mamh-orchestrator (coordination only, no code tools)
- **Teammates:** All agents from `.mamh/agents/registry.json`
- **Task list:** All tickets from the current milestone that have no unresolved dependencies

Configure each teammate agent with:
- The agent definition from `.claude/agents/mamh-<agent-id>.md`
- Memory type: `project` (persistent learnings across tickets)
- Access to `.mamh/tickets/` for reading their assigned tickets

### Step 3.2 - Ticket Distribution

The orchestrator distributes tickets following these rules:

1. **Dependency resolution:** Only tickets whose dependencies are ALL completed can be claimed.
2. **Agent matching:** Each ticket is pre-assigned to a specific agent. The orchestrator sends the ticket to the correct agent.
3. **Parallelism:** Multiple agents work simultaneously on independent tickets.
4. **Self-claiming:** Agents pick up their next ticket automatically when they finish one.

### Step 3.3 - Scope Enforcement

The scope guard hook (`${CLAUDE_PLUGIN_ROOT}/scripts/scope-guard.mjs`) enforces path boundaries:

- Before any file write, the hook checks the agent's `ownedPaths` from `registry.json`.
- If the write target is outside the agent's owned paths, the write is **blocked** and the agent is informed:
  > "SCOPE VIOLATION: You attempted to write to `<path>` which is outside your owned paths. Coordinate with the agent that owns this path."
- Reads to `readablePaths` are allowed.
- Access to `forbiddenPaths` is blocked entirely.

### Step 3.4 - Agent-to-Agent Coordination

When an agent needs work from another agent:

1. The agent writes a coordination request to `.mamh/logs/coordination/<from-agent>-to-<to-agent>-<timestamp>.md`
2. The orchestrator detects the request and routes it to the target agent
3. The target agent responds in the same file
4. Both agents continue their work

Common coordination patterns:
- **Interface contract:** Backend agent defines an API; frontend agent consumes it
- **Shared types:** One agent creates type definitions; others import them
- **Blocking dependency:** One agent is blocked until another completes a prerequisite

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

## Phase 4: Review Gates

**Goal:** Validate completed work before marking tickets as approved.

Review gates fire when a ticket transitions to `completed` status. The review process depends on the configured `reviewMode`.

### Auto Review (`reviewMode: "auto"`)

Run automated checks:

1. **Build check:** Run the project build command. Must pass with zero errors.
2. **Test check:** Run the project test suite. All tests must pass.
3. **Diagnostics check:** Run LSP diagnostics on files touched by the ticket. Must return zero errors.
4. **Scope check:** Verify all file changes are within the agent's owned paths.

If ALL checks pass: Mark ticket as `approved`.
If ANY check fails: Mark ticket as `rejected`, attach failure details as review notes, return to `in_progress`.

### Peer Review (`reviewMode: "peer"`)

After auto review passes:

1. Spawn a reviewer teammate agent (use a different agent than the one that wrote the code).
2. The reviewer examines:
   - Code quality and style consistency
   - Acceptance criteria satisfaction
   - Edge cases and error handling
   - Integration with adjacent components
3. Reviewer outputs: `approved` with optional suggestions, or `rejected` with required changes.
4. If rejected, the original agent receives the feedback and reworks the ticket.

### User Review (`reviewMode: "user"`)

After auto review (and optionally peer review) passes:

1. Flag the ticket for human approval.
2. Present the user with:
   - Summary of changes (files modified, lines added/removed)
   - Acceptance criteria checklist
   - Any reviewer notes
3. User can: `approve`, `reject` (with feedback), or `skip` (approve and move on).

### Review Artifacts

Write review results to `.mamh/reviews/<ticket-id>-review.json`:
```json
{
  "ticketId": "T001",
  "reviewMode": "auto",
  "autoReview": {
    "build": "pass",
    "tests": "pass",
    "diagnostics": "pass",
    "scope": "pass"
  },
  "peerReview": null,
  "userReview": null,
  "result": "approved",
  "reviewedAt": "<ISO timestamp>"
}
```

---

## Phase 5: Milestone Iteration

**Goal:** Complete milestones sequentially until the project is done.

### Step 5.1 - Milestone Completion

A milestone is complete when ALL of its tickets have `approved` status. When this happens:

1. Update `_milestone.json` status to `completed`.
2. Generate a milestone summary in `.mamh/logs/M001-summary.md`:
   - What was delivered
   - Metrics (tickets completed, time elapsed, agents involved)
   - Issues encountered and how they were resolved
   - Learnings for future milestones
3. Archive completed ticket files (move to `.mamh/tickets/archive/M001-*/`).

### Step 5.2 - Roster Review

Before starting the next milestone, the orchestrator evaluates whether the agent roster needs changes:

- Are there agents that were underutilized? Consider removing them.
- Does the next milestone require expertise not in the current roster? Consider adding agents.
- Did any agent consistently struggle? Consider swapping to a higher model tier.

Apply changes based on `agentApprovalMode`.

### Step 5.3 - Advance Decision

Based on `milestoneAdvanceMode` from `session.json`:

- **`auto-advance`:** Immediately load the next milestone's tickets into Agent Teams and continue execution (return to Phase 3).
- **`re-plan`:** Delegate to the `planner` agent to re-evaluate remaining milestones based on what was learned. This may reorder, merge, split, or add milestones. Update ticket files accordingly, then continue.
- **`user-decides`:** Pause and present the user with:
  - Summary of completed milestone
  - Overview of next milestone
  - Options: "Continue", "Re-plan", "Modify next milestone", "Stop"

### Step 5.4 - Project Completion

When ALL milestones are complete:

1. Update state to `{ "phase": 5, "status": "project-complete" }`.
2. Generate a final project report in `.mamh/logs/project-report.md`:
   - Overall metrics
   - Architecture decisions and rationale
   - Known issues and technical debt
   - Recommended next steps
3. Announce to the user:
   > "MAMH project complete. All milestones delivered. See `.mamh/logs/project-report.md` for the full report."

---

## Status Dashboard

**Triggered by:** `mamh status`

Read `.mamh/state/mamh-state.json`, `session.json`, `registry.json`, and all milestone/ticket files. Display:

```
============================================================
  MAMH Status Dashboard
============================================================

  Project:    <project name>
  Phase:      <current phase name> (Phase <N>)
  Started:    <timestamp>
  Milestone:  <current milestone ID> - <name>

------------------------------------------------------------
  Agent Roster
------------------------------------------------------------
  Agent               | Model  | Assigned | Done | Status
  --------------------|--------|----------|------|--------
  mamh-backend        | sonnet |        3 |    2 | working
  mamh-frontend       | sonnet |        2 |    1 | working
  mamh-test           | sonnet |        1 |    0 | idle
  mamh-orchestrator   | opus   |      --- |  --- | coordinating

------------------------------------------------------------
  Tickets (Milestone <current>)
------------------------------------------------------------
  ID    | Title                     | Agent          | Status
  ------|---------------------------|----------------|----------
  T001  | Setup project structure   | mamh-backend   | approved
  T002  | Define shared interfaces  | mamh-backend   | approved
  T003  | Initialize frontend       | mamh-frontend  | in_progress
  T004  | Setup test infra          | mamh-test      | pending

------------------------------------------------------------
  Progress
------------------------------------------------------------
  Milestones:  1 / 4 completed
  Tickets:     5 / 18 approved | 2 in progress | 11 pending | 0 blocked

------------------------------------------------------------
  Blockers
------------------------------------------------------------
  (none)

============================================================
```

If there are blockers or failed tickets, highlight them prominently.

---

## Resume Protocol

**Triggered by:** `mamh resume`

### Steps

1. **Read state:** Load `.mamh/state/mamh-state.json`. If it does not exist, inform the user:
   > "No MAMH session found. Use `mamh <description>` to start a new project."

2. **Validate state:** Check that the state file contains valid phase and status fields.

3. **Determine resume point:** Based on the saved phase and status:

   | Saved Phase | Saved Status | Resume Action |
   |-------------|-------------|---------------|
   | 0 | `planning-complete` | Continue to Phase 1 |
   | 1 | `agents-defined` | Continue to Phase 2 |
   | 2 | `tickets-generated` | Continue to Phase 3 |
   | 3 | `executing` | Re-launch Agent Teams, resume ticket execution |
   | 4 | `reviewing` | Resume review cycle |
   | 5 | `milestone-complete` | Run advance decision |
   | 5 | `project-complete` | Inform user project is already complete |
   | Any | `stopped` | Resume from the phase indicated |

4. **Restore Agent Teams:** If resuming Phase 3, re-launch Agent Teams with:
   - All agents from `registry.json`
   - Ticket states from ticket files (skip completed/approved tickets)
   - In-progress tickets reset to `pending` (the agent may have lost context)

5. **Announce:**
   > "MAMH session resumed. Continuing from Phase <N>: <phase name>."

---

## Stop Protocol

**Triggered by:** `mamh stop`

### Steps

1. **Save current state:** Update `.mamh/state/mamh-state.json` with:
   ```json
   {
     "phase": "<current phase>",
     "status": "stopped",
     "stoppedAt": "<ISO timestamp>",
     "activeTickets": ["<list of in-progress ticket IDs>"],
     "lastUpdated": "<ISO timestamp>"
   }
   ```

2. **Gracefully shut down Agent Teams:**
   - Signal all teammate agents to stop after their current operation completes.
   - Do NOT interrupt mid-file-write operations.
   - Wait for agents to acknowledge stop (with a 30-second timeout).

3. **Mark in-progress tickets:** Set any `in_progress` tickets back to `pending` so they can be re-claimed on resume.

4. **Write stop summary:**
   > "MAMH session stopped and state saved. Progress:"
   > - "Milestone: M00X - <name>"
   > - "Tickets completed: X / Y"
   > - "Use `mamh resume` to continue."

---

## State File Reference

All state files live under `.mamh/state/`.

### `.mamh/state/mamh-state.json`

Primary state file. Always reflects current operational status.

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
  "stoppedAt": null,
  "activeTickets": [],
  "lastUpdated": "2026-02-08T12:00:00.000Z"
}
```

### `.mamh/state/session.json`

Session configuration. Set once during Phase 0, read throughout.

```json
{
  "projectName": "my-project",
  "startedAt": "2026-02-08T12:00:00.000Z",
  "currentPhase": 3,
  "currentMilestone": "M001",
  "agentApprovalMode": "suggest",
  "milestoneAdvanceMode": "user-decides",
  "reviewMode": "auto",
  "milestoneGranularity": "medium"
}
```

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
