---
name: takt-plan
description: Run Takt planning phases — quick interview, plan generation, and approval. Triggers on "takt plan", or when starting a new Takt project with "takt <description>".
---

# Takt Plan — Phases 0-2

> This is `/takt-plan` — the Takt planning workflow. NOT the generic `/plan` skill.
> If the user said `takt <description>`, you are in the right place.

This skill runs planning through a **progressive disclosure** flow:

1. **3 quick questions** — constraints, execution mode, involvement level
2. **Auto-generate the full plan** — PRD, tech spec, agents, milestones, tickets
3. **Show the plan summary** — one readable block for the user
4. **User approves or modifies** — single approval gate before execution

**Delegation mechanism:** Planning uses the **Task tool** for one-shot analysis. Agent Teams is only used in Phase 3 (execution).

---

## Prerequisites

1. **Check Agent Teams availability.** Check whether `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. Record the result — it determines the default for Question 2.
2. **Plugin scripts exist.** Verify `${CLAUDE_PLUGIN_ROOT}/scripts/init-project.mjs` exists.

---

## Phase 0: Planning

### Step 0.0 — Existing Project Detection

Check if `.takt/session.json` exists. If it does, an existing Takt project is present.

**If NO existing project** → skip to Step 0.1 (fresh start).

**If existing project found**, read `.takt/session.json` and `.takt/HANDOFF.md` to understand current state. Then ask:

> "Existing Takt project found: **<project name>** (<N> milestones completed). Is this new work an extension of the current feature, or a new feature?"

Options:
- **Extend current feature** — Add more milestones and tickets to the existing project. Keeps all current state.
- **New feature** — Archive completed work and start a fresh plan. Keeps project-level context (agents, tech spec, constraints).

#### Path A: Extend Current Feature

1. Read existing tech spec, constraints, agent roster, and milestone history
2. Skip to Step 0.3 (plan generation) — but include existing context:
   - Pass existing tech spec and constraints to the analyst and architect (they refine, not recreate)
   - Planner receives the existing milestone history so new milestones continue the numbering (e.g., if M001-M003 are done, new milestones start at M004)
   - Ticket numbering also continues from where the last feature left off
3. Existing agents are reused. New agents can be added if the extension requires them.
4. Skip Steps 0.5 init (`.takt/` already exists) — jump to Phase 1 for any new agent files, then Phase 2 for new tickets

#### Path B: New Feature

1. **Archive feature-level state** — move ephemeral files to `.takt/features-archive/<feature-name>-<timestamp>/`:
   - `.takt/prd.md`
   - `.takt/tickets/milestones/` (any remaining active milestones)
   - `.takt/tickets/archive/` (completed milestones — already bundled with artifacts)
   - `.takt/comms/` (all files except `decisions.md` — decisions persist across features)
   - `.takt/reviews/` (any remaining active reviews)
   - `.takt/logs/` (milestone summaries, error logs)
   - `.takt/state/takt-state.json` (reset after archiving)
2. **Keep project-level state** — these persist across features:
   - `.takt/session.json` (update `phase` to 0, `currentMilestone` to null, increment `featureCount`)
   - `.takt/constraints.md`
   - `.takt/tech-spec.md`
   - `.takt/POLICY.md`
   - `.takt/agents/registry.json` (reset `ticketsCompleted`/`ticketsAssigned` to 0)
   - `.takt/comms/decisions.md` (architectural decisions persist)
   - `.claude/agents/takt-*.md` (agent definitions)
3. **Ask about revisions** (single question):
   > "Want to revise any project-level docs before planning the new feature?"
   Options:
   - "No — current tech spec, constraints, and agents are fine"
   - "Update constraints" → user provides new/modified constraints, merged into `constraints.md`
   - "Update tech spec" → re-run architect Task with new context, overwrite `tech-spec.md`
   - "Update agent roster" → user specifies agent changes (add/remove/modify), applied to registry
4. **Reset ticket and milestone numbering** — new feature starts from T001, M001
5. Proceed to Step 0.1 with existing project context available to all planning Tasks

---

### Step 0.1 — Parse the Project Description

Read the user's project description. Extract:
- Domain (web app, CLI, API, library, mobile, etc.)
- Scale hints (small, medium, large)
- Explicit technology mentions
- Explicit constraints

### Step 0.2 — Three Quick Questions

**If arriving from Path B (new feature):** Skip Q1 (constraints already known, unless user revised them in Step 0.0) and Q2 (execution mode already chosen). Only ask Q3 (involvement level) — user may want different involvement for a different feature. If arriving from Path A (extend), also skip Q1/Q2 and only ask Q3.

Use `AskUserQuestion` for each. These are the ONLY questions before plan generation.

**Question 1 — Constraints:**
> "Any hard constraints I should know about? (tech stack, existing code, platforms, etc.)"

Options:
- "No constraints — use your best judgment"
- "Must use specific tech stack" → follow up with details
- "Working with existing codebase" → follow up with key paths
- (Other — free text)

**Question 2 — Execution Mode:**
> "How should agents run during execution?"

Options:
- **Agent Teams** — Persistent teammates with shared task list. *(Show as recommended if env var is set)*
- **Subagents** — Task-tool batch dispatch. No experimental features required. *(Show as recommended if env var is NOT set)*

If the user picks Agent Teams but the env var is missing, explain how to set it and offer Subagents as fallback.

**Question 3 — Involvement Level:**
> "How involved do you want to be during execution?"

Options:
- **Autonomous** — Auto-review, auto-advance milestones. You'll see progress one-liners. Intervene only if something breaks.
- **Milestone checkpoints** — Auto-review tickets, but pause between milestones for your approval. *(Recommended)*
- **Hands-on** — You review and approve every ticket manually. Most control, most interaction.

This single question determines smart defaults:

| Involvement | `reviewMode` | `milestoneAdvanceMode` | `milestoneGranularity` |
|-------------|-------------|----------------------|----------------------|
| Autonomous | `auto` | `auto-advance` | `coarse` |
| Milestone checkpoints | `auto` | `user-decides` | `medium` |
| Hands-on | `user` | `user-decides` | `fine` |

`agentApprovalMode` always defaults to `"suggest"` (propose new agents, ask before creating).

### Step 0.3 — Generate the Full Plan

Run **two parallel Task delegations** (no user interaction needed):

**Task 1 — Analyst (Sonnet tier):**
```
Analyze this project and produce a structured requirements document.

Project description: "<user's description>"
Constraints: <from Q1>

Output:
1. Core Requirements — must-have features
2. Non-Functional Requirements — performance, security, scalability
3. Implied Requirements — things the user likely expects but didn't state
4. Scope Boundaries — what is explicitly OUT of scope for v1
5. Suggested Agent Roles — specialist agents this project needs (e.g., backend, frontend, test, devops)
```

**Task 2 — Architect (Sonnet tier):**
```
Create a technical specification for this project.

Project description: "<user's description>"
Constraints: <from Q1>

Output:
1. Architecture Overview — high-level design, components
2. Technology Stack — exact versions and rationale
3. Directory Structure — proposed project layout
4. Data Models — core entities and relationships
5. API Design — endpoints or interfaces (if applicable)
6. Agent Scope Map — for each agent role:
   - Owned directories (read-write paths, glob patterns)
   - Readable directories (read-only paths)
   - Forbidden paths
   - Model tier (haiku/sonnet/opus)
7. Dependency Graph — which components depend on which
8. Code Standards — naming conventions, file organization, import style, test patterns, and any stack-specific standards (e.g., "use functional components" for React, "use pydantic models" for FastAPI)
```

After both complete, run a **third Task delegation**:

**Task 3 — Planner (Sonnet tier):**
```
Decompose this project into milestones and tickets.

PRD: <analyst output>
Tech Spec: <architect output>
Constraints: <from Q1>
Milestone Granularity: <derived from Q3>
Agent Roles: <from architect's agent scope map>

Rules:
1. Each milestone is a coherent, deliverable unit
2. Each ticket assigned to exactly ONE agent
3. Tickets have explicit dependencies (ticket IDs)
4. Tickets include testable acceptance criteria
5. First milestone: scaffolding + shared interfaces
6. Order: infrastructure → features → integration → polish

For each milestone, output:
- Milestone ID (M001, M002, ...)
- Name, description
- Tickets with: ID (T001, T002, ...), title, description, agent, dependencies, acceptance criteria, complexity (low/medium/high), priority (critical/high/medium/low)
```

### Step 0.4 — Show Plan Summary

Display a single, readable plan summary. This is the ONE approval gate.

```
================================================================
  Takt Plan Summary
================================================================

  Project:     <name derived from description>
  Execution:   <Agent Teams | Subagents>
  Involvement: <Autonomous | Milestone checkpoints | Hands-on>

----------------------------------------------------------------
  Agent Roster (<N> agents)
----------------------------------------------------------------
  Agent              | Model  | Owned Paths
  -------------------|--------|---------------------------
  takt-backend       | sonnet | src/api/**, src/db/**
  takt-frontend      | sonnet | src/ui/**, public/**
  takt-test          | sonnet | tests/**
  ...

----------------------------------------------------------------
  Milestones (<N> milestones, <M> tickets total)
----------------------------------------------------------------
  M001: Project Scaffolding (X tickets)
    T001  Setup project structure        -> takt-backend   (no deps)
    T002  Define shared interfaces       -> takt-backend   (no deps)
    T003  Initialize frontend scaffold   -> takt-frontend  (deps: T001)

  M002: Core Features (Y tickets)
    T004  Implement user model           -> takt-backend   (deps: T002)
    T005  User registration UI           -> takt-frontend  (deps: T004)
    ...

================================================================
  [Approve]  [Modify agents]  [Modify tickets]  [Start over]
================================================================
```

Ask the user: **"Does this plan look good? You can approve to start execution, or ask me to modify agents, tickets, or milestones."**

- **Approve** → proceed to Phase 1 (file generation)
- **Modify agents** → user specifies changes, re-run architect Task with modifications
- **Modify tickets** → user specifies changes, re-run planner Task with modifications
- **Start over** → return to Step 0.1

### Step 0.5 — Initialize Project & Write Files

After approval, generate all files automatically (no further user input).

**Initialize project structure:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init-project.mjs"
```

**Write planning artifacts:**
- `.takt/prd.md` — from analyst output
- `.takt/tech-spec.md` — from architect output
- `.takt/constraints.md` — from Q1 answers + scope boundaries
- `.takt/session.json`:
  ```json
  {
    "name": "<project name>",
    "description": "<project description>",
    "phase": 0,
    "currentMilestone": null,
    "executionMode": "<agent-teams|subagents>",
    "agentApprovalMode": "suggest",
    "milestoneAdvanceMode": "<from involvement level>",
    "reviewMode": "<from involvement level>",
    "milestoneGranularity": "<from involvement level>",
    "featureCount": 1,
    "currentFeature": "<feature description>",
    "createdAt": "<ISO timestamp>",
    "updatedAt": "<ISO timestamp>"
  }
  ```

---

## Phase 1: Agent Definition (Auto)

No user input needed — plan was already approved.

### Step 1.1 — Generate Agent Files

For each agent from the approved plan, generate `.claude/agents/takt-<agent-id>.md`.

Use templates from `${CLAUDE_PLUGIN_ROOT}/templates/agents/` as base. Merge the architect's scope map.

Also define these **mandatory agents** (always included regardless of project type):

**takt-orchestrator:**
- Delegate mode (no code tools: no Edit, Write, Bash for code changes)
- Can use: Read, Glob, Grep (read-only), TeamCreate, SendMessage, TaskCreate/Update/List/Get, AskUserQuestion
- Coordinates all other agents
- Manages ticket assignment and review flow

**takt-reviewer:**
- Read-only access to ALL project files and ALL agent worktrees (`.worktrees/**`)
- Can use: Read, Glob, Grep, Bash (tests/build/lint only)
- Cannot use: Write, Edit, WebFetch, WebSearch
- Model: opus
- Reviews ALL completed tickets for correctness, security, quality, and adherence to acceptance criteria
- Provides actionable feedback via Agent Teams messaging
- Uses the template at `${CLAUDE_PLUGIN_ROOT}/templates/agents/reviewer.md`

The reviewer agent is a permanent team member — it is NOT optional and should NOT be removed during roster review (Phase 5). Every project needs code review regardless of size or domain.

Agent file structure:
```markdown
# takt-<agent-id>

<Role description>

## Scope

### Owned Paths (read-write)
- <glob patterns>

### Readable Paths (read-only)
- <glob patterns>

### Forbidden Paths
- <glob patterns>

## Responsibilities
- <bullet list>

## Coordination
- <how this agent coordinates with others>
```

### Step 1.2 — Render POLICY.md

Generate `.takt/POLICY.md` from the template at `${CLAUDE_PLUGIN_ROOT}/templates/POLICY.md`. Fill placeholders:

| Placeholder | Source |
|-------------|--------|
| `{{PROJECT_NAME}}` | Project name from session.json |
| `{{TIMESTAMP}}` | Current ISO timestamp |
| `{{AGENT_ROSTER}}` | Agent table from Step 1.1 |
| `{{CONSTRAINTS}}` | Content from `.takt/constraints.md` (written in Step 0.5 from Q1 answers) |
| `{{CODE_STANDARDS}}` | Code Standards section from the architect output (Task 2, item 8) |

**Cross-check:** Before writing POLICY.md, scan the user's constraints (from `{{CONSTRAINTS}}`) against POLICY's "Hard Prohibitions" section. If any constraint contradicts a prohibition (e.g., user says "install packages freely" vs. prohibition #5 "NEVER install new dependencies without approval"), resolve by noting the override in the rendered POLICY.md under a "Project Overrides" subsection after Hard Prohibitions.

### Step 1.3 — Generate Registry

Write `.takt/agents/registry.json`:
```json
{
  "agents": {
    "takt-<agent-id>": {
      "id": "takt-<agent-id>",
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

Update state: `{ "phase": 1, "status": "agents-defined" }`

---

## Phase 2: Ticket Generation (Auto)

No user input needed — plan was already approved.

### Step 2.1 — Create Ticket Files

For each milestone, create the directory and files:

```
.takt/tickets/milestones/
  M001-<name>/
    _milestone.json
    T001-<title>.md
    T002-<title>.md
  M002-<name>/
    _milestone.json
    ...
```

**`_milestone.json`:**
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

**Ticket file (`T001-<title>.md`):**
```markdown
# T001: <Title>

**Agent:** takt-<agent-id>
**Milestone:** M001
**Status:** pending
**Priority:** <critical|high|medium|low>
**Complexity:** <low|medium|high>
**Dependencies:** <comma-separated ticket IDs, or "none">
**ApprovedAt:**

## Description
<Detailed description>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Review Notes
<!-- Populated after review -->
```

### Step 2.2 — Agent Teams Task Setup (agent-teams mode only)

**Skip if `executionMode` is `"subagents"`.** In subagent mode, dispatch happens in Phase 3.

If agent-teams mode, create Agent Teams tasks for each ticket in the first milestone with dependency links.

### Step 2.3 — Write Initial HANDOFF.md

Write a comprehensive `.takt/HANDOFF.md` capturing the full plan:

```markdown
# Takt Handoff

> Auto-updated by Takt. Last updated: <ISO timestamp>

## Project Overview

**Project:** <name>
**Phase:** Planning Complete (Phase 2)
**Execution Mode:** <agent-teams | subagents>
**Involvement:** <autonomous | milestone checkpoints | hands-on>

## What Has Been Done
- Planning complete: PRD, tech spec, agent roster, milestones, tickets generated
- <N> agents defined, <M> tickets across <K> milestones
- Feature <featureCount>: <currentFeature>

## Agent Roster

| Agent | Model | Owned Paths |
|-------|-------|-------------|
| ... | ... | ... |

## Milestones

| ID | Name | Tickets | Status |
|----|------|---------|--------|
| M001 | ... | N | pending |
| M002 | ... | N | pending |

## Next Steps
- Execute M001: <milestone name> (<N> tickets)

## Open Questions / Blockers
(none)

## Milestone History
(none yet)

## Feature History
<!-- Populated when starting a new feature via Path B -->
```

### Step 2.4 — Ready for Execution

Update state:
```json
{ "phase": 2, "status": "tickets-generated", "currentMilestone": "M001" }
```

Print:
```
[Takt] Planning complete. <N> agents, <M> tickets, <K> milestones.
[Takt] Ready to execute. Starting M001: <milestone name>.
```

Automatically invoke `/takt-execute` to begin Phase 3.
