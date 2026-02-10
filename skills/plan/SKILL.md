---
name: mamh-plan
description: Run MAMH planning phases — requirements interview, agent definition, and ticket generation. Triggers on "mamh plan", or when starting a new MAMH project with "mamh <description>".
---

# MAMH Plan — Phases 0-2

> This is `/mamh-plan` — the MAMH planning workflow. NOT the generic `/plan` skill.
> If the user said `mamh <description>`, you are in the right place.

This skill runs the first three phases of the MAMH lifecycle: **Planning Interview** (Phase 0), **Agent Definition** (Phase 1), and **Ticket Generation** (Phase 2). It transforms a project idea into a concrete plan with agents and tickets ready for execution.

**Delegation mechanism:** Phases 0-2 use the **Task tool** for 1:1 delegation (one-shot analysis). This is intentional — planning does not require Agent Teams coordination. Agent Teams is only used in Phase 3 (execution).

---

## Prerequisites

Before starting, verify the following:

1. **Check Agent Teams availability.** Check whether the environment variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. Record the result — this determines which execution modes are available during the planning interview (Step 0.3, Question 7). Both modes are fully supported; Agent Teams is NOT required.
2. **Plugin scripts exist.** The plugin root is available via `${CLAUDE_PLUGIN_ROOT}`. Verify that `${CLAUDE_PLUGIN_ROOT}/scripts/init-project.mjs` exists. If not, warn the user that the plugin installation may be incomplete.

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

Delegate to the `analyst` agent (Opus tier) via the Task tool (use Task tool for this one-shot delegation):

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

Ask these questions in order (skip Q1-Q6 if the analyst's output already answers them definitively; Q7 must ALWAYS be asked):

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

7. **Execution Mode** *(MUST ASK — do not skip this question)*: "How should agents execute tickets during Phase 3?"
   - **Agent Teams** - Persistent teammate sessions with shared task list and native messaging. Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
   - **Subagents** - Task-tool batch dispatch. Main session orchestrates. No experimental features required.
   - Default: `"agent-teams"` if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var is set, `"subagents"` otherwise
   - Mark the recommended option based on env var availability: if env var is set, recommend Agent Teams; if not, recommend Subagents
   - If the user picks Agent Teams but the env var is missing, explain how to set it (`export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) and offer to fall back to Subagents

### Step 0.4 - Tech Spec Generation

Delegate to the `architect` agent (Opus tier) via the Task tool (use Task tool for this one-shot delegation):

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
    "name": "<derived from description>",
    "description": "<project description>",
    "phase": 0,
    "currentMilestone": null,
    "executionMode": "<agent-teams|subagents>",
    "agentApprovalMode": "<auto|suggest|locked>",
    "milestoneAdvanceMode": "<auto-advance|re-plan|user-decides>",
    "reviewMode": "<auto|peer|user>",
    "milestoneGranularity": "<fine|medium|coarse>",
    "createdAt": "<ISO timestamp>",
    "updatedAt": "<ISO timestamp>"
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

Delegate to the `architect` agent (Opus tier) via the Task tool (use Task tool for this one-shot delegation):

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
- Delegate mode (no code tools: no Edit, Write, NotebookEdit)
- Can use: Read, Glob, Grep, Bash (verification only), TeamCreate, SendMessage, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion
- Disallowed: Write, Edit, NotebookEdit, Task
- Coordinates all other agents via Agent Teams
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
  "agents": {
    "mamh-<agent-id>": {
      "id": "mamh-<agent-id>",
      "role": "<role description>",
      "modelTier": "<haiku|sonnet|opus>",
      "allowedPaths": ["<glob patterns>"],
      "readablePaths": ["<glob patterns>"],
      "forbiddenPaths": ["<glob patterns>"],
      "status": "active",
      "ticketsCompleted": 0,
      "ticketsAssigned": 0,
      "created": "phase1"
    }
  },
  "generatedAt": "<ISO timestamp>",
  "totalAgents": "<count>",
  "version": 1
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

Delegate to the `planner` agent (Sonnet tier) via the Task tool (use Task tool for this one-shot delegation):

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
**ApprovedAt:**

## Description
<Detailed description of what to implement>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Review Notes
<!-- Populated after review -->
```

### Step 2.3 - Create Agent Teams Tasks (Agent Teams mode only)

**Skip this step if `executionMode` is `"subagents"`.** In subagent mode, ticket dispatch happens during Phase 3 execution.

If `executionMode` is `"agent-teams"`, for each ticket in the first milestone, create an Agent Teams task with:
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
