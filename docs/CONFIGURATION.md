# Takt Configuration Reference

Complete reference for configuring Takt sessions, agents, and plugin behavior.

---

## Table of Contents

1. [Configuration Files Overview](#configuration-files-overview)
2. [session.json - Session Configuration](#sessionjson---session-configuration)
3. [registry.json - Agent Roster](#registryjson---agent-roster)
4. [takt-state.json - Operational State](#takt-statejson---operational-state)
5. [plugin.json - Plugin Configuration](#pluginjson---plugin-configuration)
6. [Environment Variables](#environment-variables)
7. [Changing Modes Mid-Project](#changing-modes-mid-project)
8. [Configuration Examples](#configuration-examples)

---

## Configuration Files Overview

Takt uses multiple configuration files with distinct purposes:

| File | Location | Purpose | Set When | Mutable |
|------|----------|---------|----------|---------|
| `session.json` | `.takt/session.json` | Session preferences and modes | Phase 0 | Read-only after init |
| `registry.json` | `.takt/agents/registry.json` | Agent roster with scope boundaries | Phase 1 | Updated when agents added/removed |
| `takt-state.json` | `.takt/state/takt-state.json` | Current operational state | Phase 0 | Continuously updated |
| `plugin.json` | `.claude-plugin/plugin.json` | Plugin manifest and defaults | Plugin install | Read-only (developer) |

---

## session.json - Session Configuration

### Location

`.takt/session.json`

### Purpose

Stores user preferences and session configuration set during Phase 0 (Planning Interview). These settings control how Takt operates throughout the project lifecycle.

### When Set

Created by `init-project.mjs` during Phase 0 with defaults, then populated by the planning interview.

### Schema

```json
{
  "name": "string",
  "description": "string",
  "phase": "number (0-5)",
  "currentMilestone": "string | null",
  "executionMode": "agent-teams | subagents",
  "agentApprovalMode": "auto | suggest | locked",
  "milestoneAdvanceMode": "auto-advance | re-plan | user-decides",
  "reviewMode": "auto | peer | user",
  "milestoneGranularity": "fine | medium | coarse",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

### Field Reference

#### name

**Type:** `string`

**Description:** Project name, used in agent descriptions and UI.

**Example:** `"TaskMaster Pro"`

**Set During:** Planning interview or derived from user's initial description

---

#### description

**Type:** `string`

**Description:** Human-readable project description.

**Example:** `"A REST API for managing tasks with user authentication and real-time updates"`

**Set During:** Planning interview

---

#### phase

**Type:** `number` (0-5)

**Description:** Current phase of execution. Updated automatically as phases complete.

**Values:**
- `0` - Planning Interview
- `1` - Agent Definition
- `2` - Ticket Generation
- `3` - Execution
- `4` - Review Gates
- `5` - Milestone Iteration / Project Complete

**Set During:** Automatically during workflow

---

#### currentMilestone

**Type:** `string | null`

**Description:** ID of the currently active milestone (e.g., `"M001"`). Null if no milestone active.

**Example:** `"M001"`

**Set During:** Phase 2 (Ticket Generation), updated during Phase 5 (Milestone Iteration)

---

#### executionMode

**Type:** `enum` - `"agent-teams" | "subagents"`

**Description:** Controls how Phase 3 execution is performed. Determines whether Takt uses Agent Teams (persistent teammates with shared task list) or Subagents (Task-tool-based parallel batch execution with the main session as orchestrator).

**Values:**

| Value | Mechanism | Orchestrator | Communication | Requires |
|-------|-----------|-------------|---------------|----------|
| `agent-teams` | TeamCreate + SendMessage | `takt-orchestrator.md` agent in delegate mode | Agent Teams native messaging | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
| `subagents` | Task tool parallel dispatches | Main session acts as orchestrator | File-based via `.takt/comms/<ticket-id>-output.md` | Nothing extra |

**Default:** `"agent-teams"` if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var is set, `"subagents"` otherwise. Auto-detected by `init-project.mjs`.

**Example:**
```json
{
  "executionMode": "subagents"
}
```

**Set During:** Planning interview (Phase 0, Step 0.3, Question 7)

**Impact:**
- **Phase 3 (Execution):** Determines which execution path is used:
  - `agent-teams` → Section A of `/takt-execute` (TeamCreate, SendMessage, shared task list, shutdown lifecycle)
  - `subagents` → Section B of `/takt-execute` (Task tool batch dispatch, file-based communication, main session orchestration)
- **Phase 4 (Review):** Peer review uses teammate agent (agent-teams) or Task dispatch (subagents)
- **Resume:** Agent Teams re-launches team; Subagents rebuilds dependency graph
- **Stop:** Agent Teams signals teammates; Subagents stops dispatching batches
- **Hooks:** Only `PreToolUse` (scope-guard) is registered as a hook. Agent shutdown is handled by the orchestrator via `shutdown_request` messages.

---

#### agentApprovalMode

**Type:** `enum` - `"auto" | "suggest" | "locked"`

**Description:** Controls whether the orchestrator can create new agents at runtime when skill gaps are detected.

**Values:**

| Value | Behavior | Use When |
|-------|----------|----------|
| `auto` | Orchestrator creates new agents automatically without asking | You trust autonomous provisioning and want minimal interruption |
| `suggest` | Orchestrator proposes new agents and waits for user approval | You want visibility into roster changes before they happen |
| `locked` | No new agents after Phase 1. Assign work to closest existing agent | You want a fixed roster, no runtime surprises |

**Default:** `"suggest"` (from plugin.json)

**Example:**
```json
{
  "agentApprovalMode": "suggest"
}
```

**Set During:** Planning interview (Phase 0, Step 0.3)

**Impact:**
- **Phase 3 (Execution):** When orchestrator detects a ticket requiring skills not covered by existing agents:
  - `auto` → Creates agent immediately, logs decision
  - `suggest` → Pauses, proposes agent to user with rationale, waits for approval
  - `locked` → Does NOT create agent, assigns to closest match, logs warning

---

#### milestoneAdvanceMode

**Type:** `enum` - `"auto-advance" | "re-plan" | "user-decides"`

**Description:** Controls what happens when a milestone completes.

**Values:**

| Value | Behavior | Use When |
|-------|----------|----------|
| `auto-advance` | Immediately start next milestone without pausing | You trust the plan and want continuous execution |
| `re-plan` | Delegate to planner agent to re-evaluate remaining milestones based on learnings | Plans often need adjustment based on what was learned |
| `user-decides` | Pause, present summary, and ask user how to proceed | You want control over major transitions |

**Default:** `"user-decides"` (from plugin.json)

**Example:**
```json
{
  "milestoneAdvanceMode": "user-decides"
}
```

**Set During:** Planning interview (Phase 0, Step 0.3)

**Impact:**
- **Phase 5 (Milestone Iteration):** When all tickets in a milestone are approved:
  - `auto-advance` → Load next milestone's tickets into Agent Teams, continue execution
  - `re-plan` → Spawn planner agent to review remaining milestones, potentially reorder/merge/split, then continue
  - `user-decides` → Display milestone summary and next milestone preview, prompt user: "Continue", "Re-plan", "Modify", or "Stop"

---

#### reviewMode

**Type:** `enum` - `"auto" | "peer" | "user"`

**Description:** Controls how completed tickets are reviewed before approval.

**Values:**

| Value | Behavior | Checks Performed | Use When |
|-------|----------|------------------|----------|
| `auto` | Automated verification only | Build, tests, diagnostics, scope | You trust automated checks and want fast iteration |
| `peer` | Auto checks + reviewer agent | Auto checks + code quality, security, style | You want AI code review before approval |
| `user` | Auto checks + user approval | Auto checks + human judgment | You want manual approval on every ticket |

**Default:** `"auto"` (from plugin.json)

**Example:**
```json
{
  "reviewMode": "peer"
}
```

**Set During:** Planning interview (Phase 0, Step 0.3)

**Impact:**
- **Phase 4 (Review Gates):** When `review-gate.mjs` hook fires on ticket completion:
  - `auto`:
    - Run build command (must pass)
    - Run test suite (all tests must pass)
    - Run diagnostics on changed files (zero errors)
    - Verify scope compliance
    - If ALL pass → approve, else reject with details
  - `peer`:
    - Run auto checks first
    - If auto passes, spawn reviewer agent (different agent than author)
    - Reviewer checks: correctness, quality, security, testing, conventions
    - Reviewer outputs: `approved` or `rejected` with feedback
    - If rejected, original agent reworks
  - `user`:
    - Run auto checks
    - Optionally run peer review
    - Flag ticket for human approval
    - Present: change summary, acceptance criteria checklist, reviewer notes
    - User chooses: `approve`, `reject` (with feedback), or `skip`

---

#### milestoneGranularity

**Type:** `enum` - `"fine" | "medium" | "coarse"`

**Description:** Controls how granular milestones should be. Affects ticket-to-milestone ratio.

**Values:**

| Value | Tickets per Milestone | Milestones per Project | Use When |
|-------|----------------------|------------------------|----------|
| `fine` | 1-3 | Many | You want frequent checkpoints and validation |
| `medium` | 4-8 | Balanced | Standard projects, balanced interruption vs. flow |
| `coarse` | 9+ | Few | You want minimal interruption, long execution periods |

**Default:** `"medium"` (from plugin.json)

**Example:**
```json
{
  "milestoneGranularity": "fine"
}
```

**Set During:** Planning interview (Phase 0, Step 0.3)

**Impact:**
- **Phase 2 (Ticket Generation):** Planner agent uses this to determine milestone boundaries
- **Fine:** More milestones with fewer tickets each. More frequent "milestone complete" events.
- **Coarse:** Fewer milestones with more tickets each. Longer execution between pauses.

---

#### createdAt / updatedAt

**Type:** `string` (ISO 8601 timestamp)

**Description:** Session creation and last update timestamps.

**Example:**
```json
{
  "createdAt": "2026-02-08T12:00:00.000Z",
  "updatedAt": "2026-02-08T15:30:00.000Z"
}
```

**Set During:**
- `createdAt`: Phase 0 initialization
- `updatedAt`: Any field update (rare after Phase 0)

---

### Complete Example

```json
{
  "name": "TaskMaster Pro",
  "description": "A REST API for managing tasks with user authentication and real-time updates",
  "phase": 3,
  "currentMilestone": "M002",
  "executionMode": "agent-teams",
  "agentApprovalMode": "suggest",
  "milestoneAdvanceMode": "auto-advance",
  "reviewMode": "peer",
  "milestoneGranularity": "medium",
  "createdAt": "2026-02-08T12:00:00.000Z",
  "updatedAt": "2026-02-08T15:30:00.000Z"
}
```

---

## registry.json - Agent Roster

### Location

`.takt/agents/registry.json`

### Purpose

Defines the complete agent roster with scope boundaries, tool permissions, and status tracking. Used by hooks (scope-guard) to enforce path boundaries.

### When Set

Created in Phase 1 (Agent Definition), updated when agents are added or removed.

### Schema

```json
{
  "agents": {
    "<agent-id>": {
      "id": "string",
      "role": "string",
      "modelTier": "haiku | sonnet | opus",
      "allowedPaths": ["glob patterns"],
      "readablePaths": ["glob patterns"],
      "forbiddenPaths": ["glob patterns"],
      "status": "active | idle | retired",
      "ticketsCompleted": "number",
      "ticketsAssigned": "number",
      "created": "phase1 | runtime",
      "reason": "string (if created at runtime)",
      "createdAt": "ISO 8601 timestamp"
    }
  },
  "generatedAt": "ISO 8601 timestamp",
  "totalAgents": "number",
  "version": 1
}
```

### Field Reference

#### agents

**Type:** `object` - Map of agent ID to agent configuration

**Description:** Each key is an agent identifier (e.g., `"takt-backend"`), each value is the agent's configuration.

---

#### agents[id].id

**Type:** `string`

**Description:** Unique agent identifier. Must match the key and the agent filename.

**Format:** `takt-<role>`

**Example:** `"takt-backend"`

---

#### agents[id].role

**Type:** `string`

**Description:** Human-readable role description.

**Example:** `"Backend implementation — APIs, server logic, database"`

---

#### agents[id].modelTier

**Type:** `enum` - `"haiku" | "sonnet" | "opus"`

**Description:** Claude model tier to use for this agent.

**Values:**
- `haiku` - Fast, cost-effective, simple tasks
- `sonnet` - Balanced, standard work
- `opus` - Complex reasoning, critical decisions

**Example:** `"sonnet"`

---

#### agents[id].allowedPaths

**Type:** `array of strings` (glob patterns)

**Description:** File paths this agent can READ and WRITE. Enforced by `scope-guard.mjs` hook.

**Glob Syntax:**
- `**` - Matches any number of path segments (including zero)
- `*` - Matches any characters within a single segment
- `?` - Matches exactly one character

**Examples:**
```json
{
  "allowedPaths": [
    "src/api/**",
    "src/db/**",
    "tests/api/**"
  ]
}
```

**Enforcement:**
- Before any `Write` or `Edit` operation, `scope-guard.mjs` checks if target file matches any pattern in `allowedPaths`
- If match → allow (exit 0)
- If no match → block (exit 2), show helpful message

---

#### agents[id].readablePaths

**Type:** `array of strings` (glob patterns)

**Description:** File paths this agent can READ but NOT write. For context gathering.

**Example:**
```json
{
  "readablePaths": [
    "src/shared/**",
    ".takt/**",
    "package.json"
  ]
}
```

**Enforcement:**
- Read operations are NOT blocked (agents can always read)
- Write operations to `readablePaths` are blocked by scope-guard

---

#### agents[id].forbiddenPaths

**Type:** `array of strings` (glob patterns)

**Description:** File paths this agent must NOT access at all. For documentation/coordination purposes.

**Example:**
```json
{
  "forbiddenPaths": [
    "src/ui/**",
    "src/client/**"
  ]
}
```

**Enforcement:**
- Currently informational only (read operations not blocked)
- Write operations blocked by scope-guard
- Future: May block reads as well

---

#### agents[id].status

**Type:** `enum` - `"active" | "idle" | "retired"`

**Description:** Current agent status.

**Values:**
- `active` - Agent has assigned tickets and is working
- `idle` - Agent has no assigned tickets but is available
- `retired` - Agent removed from roster, no longer used

**Example:** `"active"`

---

#### agents[id].ticketsCompleted

**Type:** `number`

**Description:** Count of tickets this agent has successfully completed.

**Example:** `5`

**Updated:** When ticket transitions to `done` status

---

#### agents[id].ticketsAssigned

**Type:** `number`

**Description:** Count of tickets currently assigned to this agent (pending or in-progress).

**Example:** `2`

**Updated:** When tickets are assigned or completed

---

#### agents[id].created

**Type:** `enum` - `"phase1" | "runtime"`

**Description:** When this agent was created.

**Values:**
- `phase1` - Created during initial roster definition
- `runtime` - Provisioned during Phase 3 execution

**Example:** `"runtime"`

---

#### agents[id].reason

**Type:** `string` (optional, only if `created: "runtime"`)

**Description:** Why this agent was provisioned at runtime.

**Example:** `"ML pipeline tickets in M3 require specialized ML agent"`

---

#### agents[id].createdAt

**Type:** `string` (ISO 8601 timestamp, optional for phase1 agents)

**Description:** Timestamp when agent was created.

**Example:** `"2026-02-08T15:30:00.000Z"`

---

### Complete Example

```json
{
  "agents": {
    "takt-backend": {
      "id": "takt-backend",
      "role": "Backend implementation — APIs, server logic, database",
      "modelTier": "sonnet",
      "allowedPaths": [
        "src/api/**",
        "src/db/**",
        "tests/api/**"
      ],
      "readablePaths": [
        "src/shared/**",
        ".takt/**"
      ],
      "forbiddenPaths": [
        "src/ui/**",
        "src/client/**"
      ],
      "status": "active",
      "ticketsCompleted": 5,
      "ticketsAssigned": 2,
      "created": "phase1"
    },
    "takt-frontend": {
      "id": "takt-frontend",
      "role": "Frontend implementation — UI components, client logic",
      "modelTier": "sonnet",
      "allowedPaths": [
        "src/ui/**",
        "src/client/**",
        "tests/ui/**"
      ],
      "readablePaths": [
        "src/shared/**",
        ".takt/**"
      ],
      "forbiddenPaths": [
        "src/api/**",
        "src/db/**"
      ],
      "status": "active",
      "ticketsCompleted": 4,
      "ticketsAssigned": 1,
      "created": "phase1"
    },
    "takt-ml": {
      "id": "takt-ml",
      "role": "ML Engineer — recommendation engine and model training",
      "modelTier": "opus",
      "allowedPaths": [
        "src/ml/**",
        "models/**",
        "tests/ml/**"
      ],
      "readablePaths": [
        "src/api/**",
        "src/shared/**"
      ],
      "forbiddenPaths": [
        "src/ui/**"
      ],
      "status": "active",
      "ticketsCompleted": 0,
      "ticketsAssigned": 3,
      "created": "runtime",
      "reason": "ML features in Milestone 3 require specialized agent",
      "createdAt": "2026-02-08T15:30:00.000Z"
    }
  },
  "generatedAt": "2026-02-08T12:30:00.000Z",
  "totalAgents": 3,
  "version": 1
}
```

---

## takt-state.json - Operational State

### Location

`.takt/state/takt-state.json`

### Purpose

Tracks current operational state during execution. Continuously updated to reflect progress, active agents, and ticket counts. Used for status dashboards and resume functionality.

### When Set

Created in Phase 0, updated continuously throughout all phases.

### Schema

```json
{
  "phase": "number (0-5)",
  "status": "string",
  "currentMilestone": "string | null",
  "activeAgents": ["array of agent IDs"],
  "ticketsSummary": {
    "total": "number",
    "completed": "number",
    "inProgress": "number",
    "pending": "number",
    "blocked": "number",
    "failed": "number"
  },
  "stoppedAt": "ISO 8601 timestamp | null",
  "activeTickets": ["array of ticket IDs"],
  "phaseHistory": [
    {
      "phase": "number",
      "startedAt": "ISO 8601 timestamp",
      "completedAt": "ISO 8601 timestamp",
      "duration": "number (milliseconds)"
    }
  ],
  "milestones": [
    {
      "id": "string",
      "status": "pending | active | completed",
      "startedAt": "ISO 8601 timestamp | null",
      "completedAt": "ISO 8601 timestamp | null"
    }
  ],
  "agentsSpawned": ["array of agent IDs"],
  "startedAt": "ISO 8601 timestamp",
  "lastUpdatedAt": "ISO 8601 timestamp"
}
```

### Field Reference

#### phase

**Type:** `number` (0-5)

**Description:** Current phase of execution. Same as `session.json` phase but reflects real-time state.

**Values:** 0 (Planning) → 5 (Complete)

---

#### status

**Type:** `string`

**Description:** Human-readable status within current phase.

**Common Values:**
- Phase 0: `"planning"`, `"planning-complete"`
- Phase 1: `"defining-agents"`, `"agents-defined"`
- Phase 2: `"generating-tickets"`, `"tickets-generated"`
- Phase 3: `"executing"`, `"paused"`, `"stopped"`
- Phase 4: `"reviewing"`
- Phase 5: `"milestone-complete"`, `"project-complete"`

**Example:** `"executing"`

---

#### currentMilestone

**Type:** `string | null`

**Description:** ID of active milestone. Null before Phase 2 or after project completion.

**Example:** `"M002"`

---

#### activeAgents

**Type:** `array of strings`

**Description:** List of agent IDs currently working (have tickets in-progress).

**Example:**
```json
{
  "activeAgents": ["takt-backend", "takt-frontend"]
}
```

---

#### ticketsSummary

**Type:** `object`

**Description:** Aggregate counts of tickets across all states.

**Fields:**
- `total` - Total tickets across all milestones
- `completed` - Tickets with `done` status (approved)
- `inProgress` - Tickets currently being worked on
- `pending` - Tickets not yet claimed
- `blocked` - Tickets blocked by dependencies or issues
- `failed` - Tickets that failed and need reassignment

**Example:**
```json
{
  "ticketsSummary": {
    "total": 18,
    "completed": 8,
    "inProgress": 2,
    "pending": 7,
    "blocked": 1,
    "failed": 0
  }
}
```

---

#### stoppedAt

**Type:** `string | null` (ISO 8601 timestamp)

**Description:** Timestamp when session was stopped. Null if running.

**Example:** `"2026-02-08T18:00:00.000Z"`

**Set When:** User invokes `takt stop` or orchestrator pauses for blocker

---

#### activeTickets

**Type:** `array of strings`

**Description:** List of ticket IDs currently `in_progress`.

**Example:**
```json
{
  "activeTickets": ["T005", "T007"]
}
```

---

#### phaseHistory

**Type:** `array of objects`

**Description:** History of phase transitions with timestamps and durations.

**Example:**
```json
{
  "phaseHistory": [
    {
      "phase": 0,
      "startedAt": "2026-02-08T12:00:00.000Z",
      "completedAt": "2026-02-08T12:15:00.000Z",
      "duration": 900000
    },
    {
      "phase": 1,
      "startedAt": "2026-02-08T12:15:00.000Z",
      "completedAt": "2026-02-08T12:30:00.000Z",
      "duration": 900000
    }
  ]
}
```

---

#### milestones

**Type:** `array of objects`

**Description:** List of all milestones with status tracking.

**Example:**
```json
{
  "milestones": [
    {
      "id": "M001",
      "status": "completed",
      "startedAt": "2026-02-08T13:00:00.000Z",
      "completedAt": "2026-02-08T15:00:00.000Z"
    },
    {
      "id": "M002",
      "status": "active",
      "startedAt": "2026-02-08T15:00:00.000Z",
      "completedAt": null
    },
    {
      "id": "M003",
      "status": "pending",
      "startedAt": null,
      "completedAt": null
    }
  ]
}
```

---

### Complete Example

```json
{
  "phase": 3,
  "status": "executing",
  "currentMilestone": "M002",
  "activeAgents": ["takt-backend", "takt-frontend"],
  "ticketsSummary": {
    "total": 18,
    "completed": 8,
    "inProgress": 2,
    "pending": 7,
    "blocked": 1,
    "failed": 0
  },
  "stoppedAt": null,
  "activeTickets": ["T009", "T010"],
  "phaseHistory": [
    {
      "phase": 0,
      "startedAt": "2026-02-08T12:00:00.000Z",
      "completedAt": "2026-02-08T12:15:00.000Z",
      "duration": 900000
    },
    {
      "phase": 1,
      "startedAt": "2026-02-08T12:15:00.000Z",
      "completedAt": "2026-02-08T12:30:00.000Z",
      "duration": 900000
    },
    {
      "phase": 2,
      "startedAt": "2026-02-08T12:30:00.000Z",
      "completedAt": "2026-02-08T13:00:00.000Z",
      "duration": 1800000
    },
    {
      "phase": 3,
      "startedAt": "2026-02-08T13:00:00.000Z",
      "completedAt": null,
      "duration": null
    }
  ],
  "milestones": [
    {
      "id": "M001",
      "status": "completed",
      "startedAt": "2026-02-08T13:00:00.000Z",
      "completedAt": "2026-02-08T15:00:00.000Z"
    },
    {
      "id": "M002",
      "status": "active",
      "startedAt": "2026-02-08T15:00:00.000Z",
      "completedAt": null
    }
  ],
  "agentsSpawned": ["takt-backend", "takt-frontend", "takt-reviewer"],
  "startedAt": "2026-02-08T12:00:00.000Z",
  "lastUpdatedAt": "2026-02-08T16:30:00.000Z"
}
```

---

## plugin.json - Plugin Configuration

### Location

`.claude-plugin/plugin.json`

### Purpose

Plugin manifest read by Claude Code. Defines skills, agents, hooks, scripts, and default configuration values.

### When Set

Set once during plugin development. Users do not modify this file.

### Schema

```json
{
  "name": "string",
  "version": "string",
  "description": "string",
  "author": "string",
  "skills": [
    {
      "name": "string",
      "path": "string",
      "description": "string",
      "triggers": ["array of strings"]
    }
  ],
  "agents": [
    {
      "name": "string",
      "path": "string",
      "description": "string"
    }
  ],
  "hooks": {
    "path": "string"
  },
  "scripts": {
    "<script-name>": "string (path)"
  },
  "templates": {
    "agents": "string (path)"
  },
  "config": {
    "<config-key>": {
      "type": "string",
      "enum": ["array of valid values"],
      "default": "any",
      "description": "string"
    }
  },
  "requirements": {
    "experimental": ["array of env vars"],
    "minClaudeCodeVersion": "string"
  }
}
```

### Field Reference

#### config

**Type:** `object`

**Description:** Default configuration values for session settings. Used to populate `.takt/session.json` if user does not specify during planning interview.

**Example:**
```json
{
  "config": {
    "agentApprovalMode": {
      "type": "string",
      "enum": ["auto", "suggest", "locked"],
      "default": "suggest",
      "description": "Controls whether the orchestrator can create new agents at runtime."
    },
    "milestoneAdvanceMode": {
      "type": "string",
      "enum": ["auto-advance", "re-plan", "user-decides"],
      "default": "user-decides",
      "description": "Controls what happens when a milestone completes."
    },
    "reviewMode": {
      "type": "string",
      "enum": ["auto", "peer", "user"],
      "default": "auto",
      "description": "Controls how completed tickets are reviewed."
    }
  }
}
```

---

#### requirements.experimental

**Type:** `array of strings`

**Description:** Required experimental environment variables.

**Example:**
```json
{
  "requirements": {
    "experimental": ["CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"]
  }
}
```

**Enforcement:** Skill checks for this env var before starting. If not set, instructs user to enable it.

---

### Complete Example

See `.claude-plugin/plugin.json` in the plugin root.

---

## Environment Variables

### CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS

**Required:** Only if `executionMode` is `"agent-teams"`. Not required for `"subagents"` mode.

**Type:** `boolean` (set as `1` or `true`)

**Description:** Enables Agent Teams feature in Claude Code. Required for agent-teams execution mode to spawn and coordinate persistent teammate sessions. Not needed for subagent mode, which uses the Task tool instead.

**Set In:**
```bash
# macOS/Linux (bash/zsh)
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# Add to shell profile for persistence
echo 'export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1' >> ~/.zshrc

# Windows (PowerShell)
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"
```

**Verify:**
```bash
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
# Should output: 1
```

**Auto-detection:** `init-project.mjs` checks this env var at project initialization to set the default `executionMode` in `session.json`. If the env var is set, defaults to `"agent-teams"`; otherwise defaults to `"subagents"`. The user can override during the planning interview.

---

### CLAUDE_PLUGIN_ROOT

**Required:** No (set automatically by Claude Code)

**Type:** `string` (absolute path)

**Description:** Absolute path to the plugin root directory. Used in hook script paths.

**Example:** `/Users/username/.claude/plugins/takt`

**Usage in hooks.json:**
```json
{
  "script": "${CLAUDE_PLUGIN_ROOT}/scripts/scope-guard.mjs"
}
```

Claude Code replaces `${CLAUDE_PLUGIN_ROOT}` with the actual path at runtime.

---

### CLAUDE_AGENT_NAME

**Required:** No (set automatically by Agent Teams)

**Type:** `string`

**Description:** Name of the agent currently executing. Set by Claude Code when invoking agent.

**Example:** `"takt-backend"`

**Usage in hooks:** Scripts use this to identify which agent triggered the hook.

---

### TAKT_DEBUG

**Required:** No (optional, for development)

**Type:** `boolean` (set as `1` or `true`)

**Description:** Enables verbose debug logging in hook scripts.

**Set In:**
```bash
export TAKT_DEBUG=1
```

**Usage in scripts:**
```javascript
if (process.env.TAKT_DEBUG) {
  console.error(`[DEBUG] ${message}`);
}
```

---

## Changing Modes Mid-Project

While `session.json` is designed to be read-only after Phase 0, you can change modes mid-project if needed.

### Safe Changes

The following can be changed safely at any time:

#### Change Review Mode

```bash
# Stop execution if running
# Say: "takt stop"

# Edit session.json
cd .takt
jq '.reviewMode = "peer"' session.json > session.tmp && mv session.tmp session.json

# Resume
# Say: "takt resume"
```

**Effect:** Next ticket completion will use new review mode.

---

#### Change Milestone Advance Mode

```bash
# Edit at milestone boundary (when milestone just completed)
jq '.milestoneAdvanceMode = "auto-advance"' .takt/session.json > .takt/session.tmp
mv .takt/session.tmp .takt/session.json
```

**Effect:** Next milestone completion will use new advance mode.

---

### Risky Changes

The following changes are risky and may cause inconsistencies:

#### Change Agent Approval Mode

**Risk:** If changing from `suggest` to `auto`, orchestrator may immediately provision agents you haven't reviewed.

**Mitigation:**
1. Stop execution
2. Review pending tickets to identify potential gaps
3. Change mode
4. Resume with awareness that new agents may spawn

---

#### Change Milestone Granularity

**Risk:** Existing milestones are already planned. Changing granularity does not retroactively modify them.

**Mitigation:** Use `milestoneAdvanceMode: "re-plan"` to trigger replanning at next milestone boundary.

---

### Procedure for Safe Mode Change

```bash
# 1. Stop execution
# In Claude Code, say: "takt stop"

# 2. Backup current state
cp .takt/session.json .takt/session.json.backup

# 3. Edit session.json
# Use jq or text editor to change desired fields

# 4. Validate JSON syntax
jq . .takt/session.json > /dev/null
echo $?  # Should output: 0

# 5. Resume execution
# In Claude Code, say: "takt resume"
```

---

## Configuration Examples

### Example 1: Autonomous, Fast Iteration

**Goal:** Minimize interruptions, trust automation

```json
{
  "agentApprovalMode": "auto",
  "milestoneAdvanceMode": "auto-advance",
  "reviewMode": "auto",
  "milestoneGranularity": "coarse"
}
```

**Behavior:**
- New agents created automatically when needed
- Milestones advance immediately without pausing
- Tickets approved if build/tests pass
- Large milestones with many tickets each

**Use For:** Internal tools, experimental projects, trusted automation

---

### Example 2: High Visibility, Manual Control

**Goal:** Review everything, no surprises

```json
{
  "agentApprovalMode": "suggest",
  "milestoneAdvanceMode": "user-decides",
  "reviewMode": "user",
  "milestoneGranularity": "fine"
}
```

**Behavior:**
- Orchestrator proposes new agents, waits for approval
- Pauses at every milestone completion for user decision
- User manually approves every ticket
- Small milestones with frequent checkpoints

**Use For:** Production applications, regulated environments, learning Takt

---

### Example 3: Balanced, AI-Reviewed

**Goal:** Balance automation and quality

```json
{
  "agentApprovalMode": "suggest",
  "milestoneAdvanceMode": "auto-advance",
  "reviewMode": "peer",
  "milestoneGranularity": "medium"
}
```

**Behavior:**
- Orchestrator proposes new agents (user approval required)
- Milestones advance automatically
- AI reviewer checks every ticket before approval
- Medium-sized milestones (4-8 tickets)

**Use For:** Most projects, standard workflow, quality-focused teams

---

### Example 4: Locked Roster, Adaptive Planning

**Goal:** Fixed team, flexible planning

```json
{
  "agentApprovalMode": "locked",
  "milestoneAdvanceMode": "re-plan",
  "reviewMode": "auto",
  "milestoneGranularity": "medium"
}
```

**Behavior:**
- No new agents after Phase 1 (work assigned to existing agents)
- Planner re-evaluates remaining milestones after each completion
- Automated review (build/test checks)
- Medium-sized milestones

**Use For:** Constrained environments, budget-sensitive projects, predictable teams

---

## config.yaml - Project Configuration

### Location

`.takt/config.yaml`

### Purpose

Optional project-level configuration for quick mode, validation presets, and review settings. NOT created by default — everything works with sensible defaults. Created when user runs `takt quick` for the first time or manually.

### When Set

Created on demand. Can be edited at any time.

### Schema

```yaml
# Takt Configuration — all fields optional

quick:
  default_type: feat          # bug | feat | research
  auto_validate: true         # Run validation after quick entry creation
  strict_validation: false    # Fail on errors (default: warn only)

validate:
  preset: auto                # auto | python | node
  timeout: 300000             # Per-command timeout in ms (default: 5 min)
  python:
    prefer_uv: true           # Prefer uv run for ruff/pytest
    mypy_enabled: true        # Include mypy in python preset
    pytest_args: ""            # Extra args for pytest
  node:
    package_manager: auto     # auto | npm | pnpm | yarn | bun
    lint_script: "lint"       # package.json script name for linting
    test_script: "test"       # package.json script name for testing
  commands: []                # Custom commands: [{name, command, optional}]

review:
  require_validation: false   # Require validation artifacts for review-gate
  require_test_artifacts: false  # Require test output artifacts

artifacts:
  retention: all              # all | last-milestone | none
  max_log_size: 1048576       # Max bytes per log file (1MB)
```

### Field Reference

#### quick.default_type

**Type:** `enum` - `"feat" | "bug" | "research"`

**Description:** Default type for quick entries when `--type` is not specified.

**Default:** `"feat"`

---

#### quick.auto_validate

**Type:** `boolean`

**Description:** Whether to automatically run validation after creating a quick entry.

**Default:** `true`

---

#### quick.strict_validation

**Type:** `boolean`

**Description:** In strict mode, validation failures cause the quick command to error instead of just warning.

**Default:** `false`

---

#### validate.preset

**Type:** `enum` - `"auto" | "python" | "node"`

**Description:** Default validation preset. `auto` detects based on project files.

**Default:** `"auto"`

---

#### validate.timeout

**Type:** `number` (milliseconds)

**Description:** Per-command timeout for validation commands.

**Default:** `300000` (5 minutes)

---

#### validate.commands

**Type:** `array of objects`

**Description:** Custom validation commands appended to the preset.

**Schema per entry:**
```yaml
- name: "custom-lint"
  command: "custom-lint-tool ."
  optional: true    # If true, skip when tool not found
```

---

#### review.require_validation

**Type:** `boolean`

**Description:** When true, the review-gate script requires validation artifacts to exist before allowing ticket completion.

**Default:** `false`

**Impact:** Only affects structured mode review gates. Quick mode is never blocked by this.

---

#### artifacts.retention

**Type:** `enum` - `"all" | "last-milestone" | "none"`

**Description:** How long to keep artifacts. `all` keeps everything, `last-milestone` cleans up on milestone completion, `none` deletes after successful review.

**Default:** `"all"`

---

## See Also

- [README.md](./README.md) - Developer guide
- [TEMPLATES.md](./TEMPLATES.md) - Template customization guide
- [SKILL.md](../skills/takt/SKILL.md) - Full workflow specification
