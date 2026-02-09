# MAMH — Multi-Agent Multi-Harness

**Orchestrate teams of specialized AI agents to build complex projects autonomously.**

MAMH is a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that replaces the single-LLM-does-everything paradigm with a coordinated team of purpose-built specialists. Instead of one context window juggling backend, frontend, testing, and deployment, MAMH generates a team of agents — each with scoped file access, defined responsibilities, and restricted tools — that work in parallel through a ticket-based workflow with review gates, milestone-driven delivery, and scope enforcement.

```
                              You say:
               "mamh: Build an AI communication platform"
                              |
                    MAMH takes it from there.
```

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
  - [For Humans](#for-humans)
  - [For LLMs (Automated Installation)](#for-llms-automated-installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Commands](#commands)
  - [Example Session](#example-session)
- [What Gets Generated](#what-gets-generated)
- [Agent Templates](#agent-templates)
- [Configuration](#configuration)
- [Hooks (Scope Enforcement)](#hooks-scope-enforcement)
- [Git Worktree Isolation](#git-worktree-isolation)
- [POLICY.md — Shared Rulebook](#policymd--shared-rulebook)
- [Plugin Repository Structure](#plugin-repository-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Automated Planning** | Interview --> PRD --> tech spec --> agent roster --> tickets. No manual project setup. |
| **Dynamic Agent Provisioning** | Creates specialized agents on-the-fly based on project needs. A CLI tool gets different agents than a full-stack web app. |
| **Scope Enforcement** | Hooks block agents from writing outside their domain. The backend agent cannot touch frontend files. Period. |
| **Review Gates** | Tickets must pass acceptance criteria checks, build verification, and optional peer/user review before completion. |
| **Milestone-Driven Execution** | Work is organized into ordered milestones with dependency tracking. Infrastructure ships before features. |
| **Git Worktree Isolation** | Each agent works in its own git worktree branch. No merge conflicts during parallel work. Branches merge at milestone boundaries. |
| **Shared POLICY.md** | A team-wide rulebook that every agent reads at session start. Defines communication protocols, code standards, safety rules, and coordination patterns. |
| **Resume/Stop Support** | Save state at any point, shut down cleanly, and resume later exactly where you left off. |
| **Zero External Dependencies** | All scripts use Node.js built-ins only. No `npm install` required. No version conflicts. |

---

## Architecture

```
User: "mamh: Build an AI scoring platform"
         |
  +------v------+
  |  MAMH Skill  |  <-- Plugin entry point (skills/mamh/SKILL.md)
  +------+------+
         |
         |  Phase 0: Planning Interview
         |    - Analyst agent expands requirements
         |    - User answers scoping questions (agent roles, constraints, tech stack)
         |    - Architect agent creates tech spec
         |    - Writes PRD, tech spec, constraints to .mamh/
         |
         |  Phase 1: Agent Definition
         |    - Architect designs agent roster with scoped paths
         |    - Agent definition files generated from templates
         |    - User confirms or modifies the roster
         |    - Registry written to .mamh/agents/registry.json
         |
         |  Phase 2: Ticket Generation
         |    - Planner decomposes project into milestones + tickets
         |    - Each ticket assigned to one agent with dependencies
         |    - Acceptance criteria defined per ticket
         |    - Ticket board presented to user
         |
  +------v------+
  | Agent Teams  |  <-- Claude Code native multi-agent execution
  +------+------+
         |
         |  Phase 3: Parallel Execution
         |    - Orchestrator distributes tickets to specialist agents
         |    - Agents work in parallel on independent tickets
         |    - Scope guard hook blocks out-of-bounds writes
         |    - Keep-working hook prevents agents from stopping early
         |    - Agents coordinate via messaging for shared interfaces
         |
         |  Phase 4: Review Gates
         |    - Auto: build + test + diagnostics + scope check
         |    - Peer: reviewer agent examines code quality
         |    - User: human approval for critical changes
         |    - Failed reviews return tickets to the author with feedback
         |
         |  Phase 5: Milestone Iteration
         |    - Completed milestones archived
         |    - Roster re-evaluated for next milestone
         |    - Advance mode: auto / re-plan / user-decides
         |    - Repeat Phases 3-5 until all milestones complete
         |
  +------v------+
  |   Complete   |  <-- Final report in .mamh/logs/project-report.md
  +-------------+
```

### Component Map

```
mamh/                              <-- Plugin repository (you install this)
  .claude-plugin/plugin.json       <-- Plugin manifest
  skills/mamh/SKILL.md             <-- Skill entry point (6-phase lifecycle)
  agents/mamh-orchestrator.md      <-- Team lead (delegate mode, no code tools)
  templates/agents/*.md            <-- 8 agent templates (backend, frontend, etc.)
  templates/POLICY.md              <-- Shared rulebook template
  hooks/hooks.json                 <-- Hook configuration
  scripts/
    scope-guard.mjs                <-- PreToolUse hook: blocks scope violations
    review-gate.mjs                <-- TaskCompleted hook: enforces review checks
    keep-working.mjs               <-- TeammateIdle hook: prevents premature stopping
    init-project.mjs               <-- Project initialization script

your-project/                      <-- Your project (MAMH writes here at runtime)
  .mamh/                           <-- Project state (generated)
    POLICY.md                      <-- Customized shared rulebook
    prd.md, tech-spec.md, ...      <-- Planning artifacts
    agents/registry.json           <-- Agent roster with scoped paths
    tickets/milestones/            <-- Milestone directories with ticket files
    state/mamh-state.json          <-- Phase/progress tracking
  .claude/agents/
    mamh-backend.md                <-- Generated agent definitions
    mamh-frontend.md
    mamh-reviewer.md
    ...
```

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **Claude Code** | Latest version. MAMH is a Claude Code plugin. |
| **Agent Teams** | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` must be set in your environment. This is an experimental Claude Code feature that enables multi-agent orchestration. |
| **Node.js** | >= 18.0.0. Required for hook scripts (all ESM, zero external deps). |
| **Git** | Required for worktree isolation. Each agent gets its own branch. |

### Verify Requirements

```bash
# Check Claude Code
claude --version

# Check Node.js
node --version  # Must be >= 18.0.0

# Check Git
git --version

# Check Agent Teams is enabled
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # Should print "1"
```

If Agent Teams is not enabled:

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# Or set it for the current session
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

---

## Installation

### For Humans

#### Option A: Permanent Install (Recommended)

```bash
# 1. In Claude Code, add the marketplace:
/plugin marketplace add seongjinpark-88/multi-agent-multi-harness

# 2. Install the plugin:
/plugin install mamh@mamh-marketplace

# Done. The plugin persists across sessions.
# Skills available as: /mamh:<command>
```

#### Option B: Development / One-Off Testing

```bash
# Clone the repository
git clone https://github.com/seongjinpark-88/multi-agent-multi-harness.git

# Launch Claude Code with the plugin loaded for this session only
claude --plugin-dir /path/to/multi-agent-multi-harness
```

> **Tip:** For repeated local testing, use a shell alias:
> ```bash
> alias claude-mamh='claude --plugin-dir /path/to/multi-agent-multi-harness'
> ```

No `npm install`. No build step. No dependencies to resolve.

### For LLMs (Automated Installation)

If you are an LLM installing MAMH into a Claude Code environment, follow these steps exactly:

#### Step 1: Verify Claude Code is Available

```bash
# Confirm claude CLI exists and responds
claude --version
```

If this fails, Claude Code is not installed. Stop and inform the user.

#### Step 2: Verify Agent Teams is Enabled

```bash
# Check the environment variable
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
```

Expected output: `1`

If the variable is not set or is not `1`, inform the user:

> "MAMH requires Claude Code Agent Teams. Please enable it by running:
> `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
> Add this to your shell profile for persistence."

#### Step 3: Verify Node.js >= 18

```bash
node --version
```

The major version must be 18 or higher. If not, inform the user to upgrade Node.js.

#### Step 4: Clone or Locate the Plugin Repository

```bash
# If not already cloned:
git clone https://github.com/seongjinpark-88/multi-agent-multi-harness.git /path/to/mamh

# Verify the plugin manifest exists:
cat /path/to/mamh/.claude-plugin/plugin.json
```

The file must exist and contain `"name": "mamh"`.

#### Step 5: Install the Plugin

**Option A — Permanent install (if running inside Claude Code):**
```
/plugin marketplace add seongjinpark-88/multi-agent-multi-harness
/plugin install mamh@mamh-marketplace
```

**Option B — Session-only (from shell):**
```bash
claude --plugin-dir /path/to/multi-agent-multi-harness
```

#### Step 6: Test with a Simple Project

```bash
# Create a throwaway test project
mkdir /tmp/mamh-test && cd /tmp/mamh-test
git init

# Launch Claude Code with the MAMH plugin loaded
claude --plugin-dir /path/to/multi-agent-multi-harness

# In Claude Code, trigger MAMH:
# mamh "Build a simple hello world REST API"

# After Phase 0 completes, verify generated files:
ls -la .mamh/
# Expected: session.json, prd.md, tech-spec.md, constraints.md, agents/, tickets/, state/, comms/

ls -la .claude/agents/mamh-*
# Expected: mamh-orchestrator.md plus specialist agent files
```

### Testing in Another Project

```bash
# Navigate to any git-initialized project
cd /path/to/your/project

# Launch Claude Code with MAMH plugin loaded
claude --plugin-dir /path/to/multi-agent-multi-harness

# In Claude Code, type:
mamh "Build a React dashboard with charts and user authentication"

# MAMH will run the planning interview, then you are off to the races.

# Check what was generated:
ls -la .mamh/
ls -la .claude/agents/mamh-*
cat .mamh/agents/registry.json
```

---

## Quick Start

```
mamh "Build a React dashboard with charts and user authentication"
```

That is it. MAMH handles everything:

1. **Plans** the project (interview, PRD, tech spec)
2. **Creates** specialist agents (backend, frontend, reviewer, etc.)
3. **Generates** tickets organized into milestones
4. **Executes** tickets in parallel with scope enforcement
5. **Reviews** completed work (automated build/test checks + optional peer review)
6. **Delivers** milestone by milestone until the project is complete

You can check progress at any time with `mamh status`, trigger manual review with `mamh review`, advance milestones with `mamh next`, or gracefully stop with `mamh stop`.

---

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `mamh <description>` | Start a new project. Runs the full 6-phase lifecycle. |
| `mamh status` | Display the status dashboard with agent roster, ticket board, and progress. |
| `mamh review` | Manually trigger a review cycle on all completed but unreviewed tickets. |
| `mamh next` | Advance to the next milestone (after the current one completes). |
| `mamh resume` | Resume an interrupted session from the last saved state. |
| `mamh stop` | Gracefully shut down all agents, save state, and mark in-progress tickets as pending. |

Running bare `mamh` with no arguments displays a help message listing these commands.

### Example Session

Here is a complete walkthrough of running MAMH on a real project:

```
mamh "Build a todo app with React frontend and FastAPI backend"
```

#### Phase 0: Planning Interview

```
============================================================
  MAMH — Phase 0: Planning Interview
============================================================

Analyzing project description...

Delegating to analyst agent for requirements expansion...

  Core Requirements:
  - User can create, read, update, delete todo items
  - Todo items have: title, description, priority, due date, status
  - Filter and sort todos by priority, status, due date
  - User authentication (signup, login, logout)
  - Persistent storage with a database

  Non-Functional Requirements:
  - Responsive UI (mobile + desktop)
  - API response times < 200ms
  - Input validation on both client and server

  Suggested Agent Roles:
  - backend-engineer (FastAPI, database, auth)
  - frontend-engineer (React, UI components, state)
  - reviewer (code quality, security)

------------------------------------------------------------
Planning Interview
------------------------------------------------------------

Q1: Based on your project, I recommend these agent roles:
    [backend-engineer, frontend-engineer, reviewer]
    Would you like to add, remove, or modify any?

> Looks good, add a designer for the UI.

Q2: Are there any hard constraints?

> Must use PostgreSQL. Must use TypeScript for the frontend.

Q3: Technology preferences?
    - Language/runtime: Python 3.11+ (backend), TypeScript (frontend)
    - Framework: FastAPI (backend), React 18 (frontend)
    - Database: PostgreSQL
    - Deployment: Docker

> Use your best judgment for the rest.

Q4: How granular should milestones be?
    [Fine | Medium | Coarse]

> Medium

Q5: How should completed work be reviewed?
    [Auto | Peer | User]

> Auto

Q6: When a milestone completes, what should happen?
    [Auto-advance | Re-plan | User-decides]

> User-decides

Delegating to architect agent for tech spec generation...

Writing planning artifacts to .mamh/...
  + .mamh/prd.md
  + .mamh/tech-spec.md
  + .mamh/constraints.md
  + .mamh/state/session.json
  + .mamh/state/mamh-state.json

Phase 0 complete. PRD, tech spec, and constraints are ready.
Moving to Phase 1: Agent Definition.
```

#### Phase 1: Agent Definition

```
============================================================
  MAMH — Phase 1: Agent Definition
============================================================

Delegating to architect agent for agent roster design...

Generating agent definition files from templates...
  + .claude/agents/mamh-backend.md
  + .claude/agents/mamh-frontend.md
  + .claude/agents/mamh-designer.md
  + .claude/agents/mamh-reviewer.md

------------------------------------------------------------
Agent Roster
------------------------------------------------------------

  Agent            | Role                | Model  | Owned Paths                  | Status
  -----------------|---------------------|--------|------------------------------|--------
  mamh-backend     | Backend engineer    | sonnet | src/api/**, src/db/**, tests/api/** | Ready
  mamh-frontend    | Frontend engineer   | sonnet | src/ui/**, public/**         | Ready
  mamh-designer    | UI/UX designer      | sonnet | src/ui/components/**, src/ui/styles/** | Ready
  mamh-reviewer    | Code reviewer       | opus   | (read-only: all)             | Ready
  mamh-orchestrator| Team lead           | opus   | (delegate mode, no code)     | Ready

Does this agent roster look correct?

> Yes, proceed.

Phase 1 complete. Agent roster locked in.
Moving to Phase 2: Ticket Generation.
```

#### Phase 2: Ticket Generation

```
============================================================
  MAMH — Phase 2: Ticket Generation
============================================================

Delegating to planner agent for milestone and ticket decomposition...

=== MAMH Ticket Board ===

Milestone M001: Project Scaffolding [PENDING]
  T001 [pending]  Setup FastAPI project structure      -> mamh-backend    (no deps)
  T002 [pending]  Setup React + TypeScript scaffold    -> mamh-frontend   (no deps)
  T003 [pending]  Define shared API types              -> mamh-backend    (no deps)
  T004 [pending]  Setup PostgreSQL schema + migrations -> mamh-backend    (deps: T001)
  T005 [pending]  Setup design tokens + base styles    -> mamh-designer   (deps: T002)

Milestone M002: Authentication [PENDING]
  T006 [pending]  Implement auth endpoints             -> mamh-backend    (deps: T004)
  T007 [pending]  Implement login/signup UI            -> mamh-frontend   (deps: T005, T006)
  T008 [pending]  Add JWT middleware + protected routes -> mamh-backend   (deps: T006)

Milestone M003: Core CRUD [PENDING]
  T009 [pending]  Implement todo CRUD endpoints        -> mamh-backend    (deps: T008)
  T010 [pending]  Implement todo list + detail views   -> mamh-frontend   (deps: T009)
  T011 [pending]  Implement todo create/edit forms     -> mamh-frontend   (deps: T009)
  T012 [pending]  Add filtering + sorting              -> mamh-backend    (deps: T009)
  T013 [pending]  Add filter/sort UI controls          -> mamh-frontend   (deps: T012)

Milestone M004: Polish + Review [PENDING]
  T014 [pending]  Responsive layout pass               -> mamh-designer   (deps: T013)
  T015 [pending]  Error handling + loading states      -> mamh-frontend   (deps: T013)
  T016 [pending]  Full code review                     -> mamh-reviewer   (deps: T014, T015)
  T017 [pending]  Docker compose setup                 -> mamh-backend    (deps: T016)

Total: 17 tickets across 4 milestones

Phase 2 complete. 17 tickets across 4 milestones are ready.
Moving to Phase 3: Execution.
```

#### Phase 3: Parallel Execution

```
============================================================
  MAMH — Phase 3: Execution (Milestone M001)
============================================================

Launching Agent Teams...
  Team lead:  mamh-orchestrator (delegate mode)
  Teammates:  mamh-backend, mamh-frontend, mamh-designer, mamh-reviewer

Distributing tickets with no unresolved dependencies...
  -> mamh-backend:   T001 (Setup FastAPI project structure)
  -> mamh-frontend:  T002 (Setup React + TypeScript scaffold)
  -> mamh-backend:   T003 (Define shared API types)

[mamh-backend]   T001: Creating FastAPI project structure...
                 - src/api/main.py (FastAPI app)
                 - src/api/routes/ (endpoint modules)
                 - src/api/models/ (Pydantic models)
                 - src/db/ (SQLAlchemy setup)
                 - tests/api/ (pytest structure)
                 T001 -> completed

[mamh-frontend]  T002: Setting up React + TypeScript scaffold...
                 - src/ui/ (Vite + React + TypeScript)
                 - src/ui/components/ (component library)
                 - src/ui/pages/ (route pages)
                 - public/ (static assets)
                 T002 -> completed

[mamh-backend]   T003: Defining shared API types...
                 - src/api/schemas/todo.py (TodoCreate, TodoRead, TodoUpdate)
                 - src/api/schemas/user.py (UserCreate, UserRead, Token)
                 T003 -> completed

Dependencies resolved. Releasing blocked tickets...
  -> mamh-backend:   T004 (Setup PostgreSQL schema + migrations)
  -> mamh-designer:  T005 (Setup design tokens + base styles)

[mamh-backend]   T004: Creating database schema and migrations...
[mamh-designer]  T005: Establishing design token system...
```

#### Phase 4: Review Gates

```
============================================================
  MAMH — Phase 4: Review Gates (Milestone M001)
============================================================

Running auto-review on completed tickets...

  T001 — Setup FastAPI project structure
    Build check:       PASS (python -m pytest exits 0)
    Test check:        PASS (3/3 tests pass)
    Diagnostics check: PASS (0 errors)
    Scope check:       PASS (all files in src/api/**, src/db/**, tests/api/**)
    Result:            APPROVED

  T002 — Setup React + TypeScript scaffold
    Build check:       PASS (npm run build exits 0)
    Test check:        PASS (5/5 tests pass)
    Diagnostics check: PASS (0 errors, 0 warnings)
    Scope check:       PASS (all files in src/ui/**, public/**)
    Result:            APPROVED

  T003 — Define shared API types
    Build check:       PASS
    Test check:        PASS (2/2 tests pass)
    Diagnostics check: PASS
    Scope check:       PASS
    Result:            APPROVED

  T004 — Setup PostgreSQL schema + migrations
    Build check:       PASS
    Test check:        PASS (4/4 tests pass)
    Diagnostics check: PASS
    Scope check:       PASS
    Result:            APPROVED

  T005 — Setup design tokens + base styles
    Build check:       PASS
    Test check:        PASS (2/2 tests pass)
    Diagnostics check: PASS
    Scope check:       PASS
    Result:            APPROVED

All 5 tickets in M001 approved.
```

#### Phase 5: Milestone Completion

```
============================================================
  MAMH — Phase 5: Milestone Iteration
============================================================

Milestone M001: Project Scaffolding -> COMPLETE

  Summary:
  - 5 tickets completed, 0 rejected
  - Agents involved: mamh-backend (3), mamh-frontend (1), mamh-designer (1)
  - Deliverables: FastAPI scaffold, React scaffold, shared types,
    database schema, design token system

  Archiving completed tickets to .mamh/tickets/archive/M001-scaffolding/

------------------------------------------------------------
Next: Milestone M002 — Authentication (3 tickets)
------------------------------------------------------------

  T006 [pending]  Implement auth endpoints             -> mamh-backend
  T007 [pending]  Implement login/signup UI            -> mamh-frontend
  T008 [pending]  Add JWT middleware + protected routes -> mamh-backend

Milestone advance mode: user-decides

Options:
  [Continue]  Start M002 with the current roster
  [Re-plan]   Re-evaluate remaining milestones
  [Modify]    Change the next milestone's tickets
  [Stop]      Save state and stop

> Continue
```

The cycle repeats for each milestone until the project is complete.

---

## What Gets Generated

### In Your Project (`.mamh/`)

```
.mamh/
  POLICY.md                              # Shared rules all agents follow
  prd.md                                 # Product Requirements Document
  tech-spec.md                           # Technical Specification
  constraints.md                         # Hard constraints and preferences
  session.json                           # Project configuration (legacy location)
  state/
    mamh-state.json                      # Current phase, milestone, ticket counts
    session.json                         # Session configuration
  agents/
    registry.json                        # Agent roster with scoped path boundaries
  tickets/
    milestones/
      M001-scaffolding/
        _milestone.json                  # Milestone metadata and status
        T001-setup-fastapi.md            # Individual ticket files
        T002-setup-react.md
        T003-shared-types.md
        T004-postgres-schema.md
        T005-design-tokens.md
      M002-authentication/
        _milestone.json
        T006-auth-endpoints.md
        T007-login-signup-ui.md
        T008-jwt-middleware.md
      M003-core-crud/
        ...
      M004-polish-review/
        ...
    archive/                             # Completed milestone tickets moved here
      M001-scaffolding/
        ...
  reviews/
    T001-review.json                     # Review results per ticket
    T002-review.json
    ...
  comms/
    decisions.md                         # Architectural decisions log
    changelog.md                         # Change log for notable events
  logs/
    coordination/                        # Agent-to-agent message logs
    errors/                              # Error and failure logs
    scope-violations.md                  # Scope enforcement violation log
    M001-summary.md                      # Milestone completion summaries
    project-report.md                    # Final project report (on completion)
```

### Agent Definitions (`.claude/agents/`)

```
.claude/agents/
  mamh-orchestrator.md       # Team lead — delegate mode, no code tools
  mamh-backend.md            # Backend engineer — APIs, database, server logic
  mamh-frontend.md           # Frontend engineer — UI, state, routing, styling
  mamh-designer.md           # UI/UX designer — visual design, component arch
  mamh-reviewer.md           # Code reviewer — read-only, quality gatekeeper
  ...                        # Additional agents as needed per project
```

Each agent file defines:
- Role description and responsibilities
- Allowed tools (Read, Write, Edit, Bash, Glob, Grep, etc.)
- Disallowed tools (prevents out-of-scope actions)
- Owned paths (read-write glob patterns)
- Read-only paths
- Forbidden paths
- Communication protocol
- Definition of done
- Stop conditions (when to escalate instead of looping)

---

## Agent Templates

MAMH ships with 8 agent templates. During Phase 1, the architect selects which agents a project needs and customizes their scope. Not every project uses every template.

| Template | Default Model | Tools | Scope | Description |
|----------|--------------|-------|-------|-------------|
| **backend** | sonnet | Read, Write, Edit, Bash, Glob, Grep | Server-side code | APIs, database, server logic, server-side tests. Cannot touch frontend files. |
| **frontend** | sonnet | Read, Write, Edit, Bash, Glob, Grep | Client-side code | UI components, state management, routing, styling, client-side tests. Cannot touch server files. |
| **reviewer** | opus | Read, Glob, Grep, Bash (read-only) | Read-only: all | Code review, quality gates, security checks. Cannot write or edit any files. Bash restricted to running tests and linters only. |
| **pm** | sonnet | Read, Write, Glob, Grep | Docs only | Requirements management, status reports, ticket tracking. Cannot run commands or edit source code. |
| **designer** | sonnet | Read, Write, Edit, Bash, Glob, Grep | UI components + styles | Visual design, design tokens, component architecture, responsive layouts, accessibility. |
| **researcher** | sonnet | Read, WebFetch, WebSearch, Glob, Grep | External + read-only project | API documentation research, library evaluation, solution investigation. Cannot modify project files. |
| **content** | haiku | Read, Write, Glob, Grep | Content paths | User-facing copy, documentation, error messages, help text. Cannot edit source code or run commands. |
| **devops** | sonnet | Read, Write, Edit, Bash, Glob, Grep | Infrastructure | CI/CD pipelines, Dockerfiles, deployment configs, automation scripts. Cannot modify application source code. |

### The Orchestrator

The **mamh-orchestrator** is always present. It runs in **delegate mode**:

- **Allowed**: Read, Glob, Grep, Bash, Task (delegation), AskUserQuestion
- **Disallowed**: Write, Edit, NotebookEdit
- **Model**: opus
- **Role**: Coordination only. Distributes tickets, monitors progress, triggers reviews, manages milestones, provisions new agents. Never writes code directly.

---

## Configuration

All configuration is set during the Phase 0 planning interview and stored in `.mamh/state/session.json`. You can also set defaults in the plugin manifest (`.claude-plugin/plugin.json`).

### Agent Approval Mode

Controls whether the orchestrator can create new agents during execution.

| Mode | Behavior |
|------|----------|
| `auto` | Orchestrator creates agents without asking. Logs the decision. |
| `suggest` | Orchestrator proposes the new agent with rationale. Waits for user approval. **(default)** |
| `locked` | No new agents after Phase 1. Tickets are assigned to the closest existing agent. |

### Milestone Advance Mode

Controls what happens when a milestone completes.

| Mode | Behavior |
|------|----------|
| `auto-advance` | Immediately start the next milestone. No pause. |
| `re-plan` | Planner agent re-evaluates remaining milestones based on what was learned. May reorder, merge, split, or add milestones. |
| `user-decides` | Pause and present the user with options: Continue, Re-plan, Modify, Stop. **(default)** |

### Review Mode

Controls how completed tickets are validated.

| Mode | Behavior |
|------|----------|
| `auto` | Build + test + diagnostics + scope check. All pass = approved. Any fail = rejected with details. **(default)** |
| `peer` | After auto checks pass, a reviewer agent examines code quality, security, and test coverage. |
| `user` | After auto (and optionally peer) checks pass, the ticket is flagged for human approval. |

### Milestone Granularity

Controls how tickets are grouped into milestones.

| Granularity | Tickets per Milestone | Best For |
|-------------|----------------------|----------|
| `fine` | 1-3 | Rapid iteration, frequent checkpoints |
| `medium` | 4-8 | Balanced delivery **(default)** |
| `coarse` | 9+ | Large batches, less interruption |

---

## Hooks (Scope Enforcement)

MAMH uses three hooks to enforce team discipline. They are configured in `hooks/hooks.json` and execute scripts from `scripts/`.

### scope-guard.mjs

**Event**: `PreToolUse` (fires on every `Write` and `Edit` operation)

Reads the agent's allowed paths from `.mamh/agents/registry.json` and checks whether the target file falls within scope.

- **Allow** (exit 0): File is within the agent's owned paths.
- **Block** (exit 2): File is outside scope. Returns a message identifying the violation and suggesting which agent owns the target path.
- **Fail open** (exit 0): If the registry does not exist or the agent is not registered, the write is allowed. This prevents blocking legitimate operations before MAMH is fully initialized.

Example blocked message:
```
SCOPE VIOLATION: mamh-frontend cannot write to /project/src/api/routes/auth.py.
This file belongs to mamh-backend's scope. Send a message to mamh-backend instead.
```

### review-gate.mjs

**Event**: `TaskCompleted` (fires when an agent marks a ticket as done)

Reads the ticket file, parses acceptance criteria checkboxes, and enforces the configured review mode:

- **Auto mode**: If all `- [x]` checkboxes are checked, approve. If any `- [ ]` remain unchecked, block with a list of unmet criteria.
- **Peer mode**: Block and route to the reviewer agent regardless of checkbox state.
- **User mode**: Block and flag for human approval.

### keep-working.mjs

**Event**: `TeammateIdle` (fires when an agent reports it has nothing to do)

Scans the current milestone's tickets for any still assigned to the idle agent that are `pending` or `in_progress`. If found:

- **Block idle** (exit 2): Directs the agent to its next ticket with a specific message.
- **Allow idle** (exit 0): Agent genuinely has no remaining work in this milestone.

---

## Git Worktree Isolation

Each agent with write permission operates in its own git worktree, branched from `main`. This eliminates merge conflicts during parallel execution.

### How It Works

1. **Setup** (Phase 3 launch): For each writing agent, the orchestrator creates a worktree:
   ```bash
   git worktree add .worktrees/mamh-backend -b mamh/backend main
   git worktree add .worktrees/mamh-frontend -b mamh/frontend main
   ```

2. **Execution**: Each agent's working directory is set to its worktree. The backend agent writes to `.worktrees/mamh-backend/src/api/...` while the frontend agent writes to `.worktrees/mamh-frontend/src/ui/...`. They never touch the same files.

3. **Merge** (milestone completion): The orchestrator merges each agent's branch back to main:
   ```bash
   git merge mamh/backend --no-ff -m "M001: merge mamh-backend changes"
   git merge mamh/frontend --no-ff -m "M001: merge mamh-frontend changes"
   ```

4. **Cleanup**: Worktrees are removed after successful merge. Fresh worktrees are created for the next milestone.

### Conflict Resolution

If a merge conflict occurs (rare, because scope enforcement prevents agents from touching the same files):

1. The orchestrator identifies which agents' changes conflict.
2. It delegates conflict resolution to the agent that owns the conflicting file.
3. If ownership is ambiguous, the orchestrator asks the user.

---

## POLICY.md -- Shared Rulebook

Every MAMH project gets a `.mamh/POLICY.md` file that all agents read at session start. It is generated from the template at `templates/POLICY.md` with project-specific values substituted in.

### What It Defines

| Section | Content |
|---------|---------|
| Agent Identity & Scope | Who each agent is, what files they own, how to check ownership |
| Communication Protocol | Message format, urgency levels, escalation path |
| File Ownership & Conflict Resolution | Rules for shared files, priority ordering, interface contracts |
| Code Standards | Project conventions, commit hygiene, dependency management |
| Ticket Workflow | Lifecycle states, claiming rules, definition of done |
| Review Requirements | Auto, peer, and user review processes |
| Constraints | Hard rules that cannot be violated |
| Technology Stack | Approved technologies, no unauthorized additions |
| Safety & Security | Rules that apply to all agents at all times (no secrets in code, parameterized queries, input validation) |
| Session Protocol | What every agent does at session start and end |
| Error Handling & Recovery | Diagnose, retry, escalate procedures |
| Coordination Patterns | Recipes for shared interface changes, handoffs, blocking dependencies |

### Template Placeholders

| Placeholder | Source |
|-------------|--------|
| `{{PROJECT_NAME}}` | Derived from user's project description |
| `{{TIMESTAMP}}` | Generation time |
| `{{AGENT_ROSTER}}` | From `.mamh/agents/registry.json` (filled after Phase 1) |
| `{{CONSTRAINTS}}` | User interview answers + `.mamh/constraints.md` |
| `{{TECHNOLOGY_STACK}}` | Tech spec + user preferences |
| `{{CODE_STANDARDS}}` | Detected from codebase or user-specified |

### Customization

- **Edit the template** (`templates/POLICY.md`) to change policy for all future projects.
- **Edit the generated file** (`.mamh/POLICY.md`) to change policy for one project.
- Changes take effect immediately because agents re-read the file at every session start.

---

## Plugin Repository Structure

```
mamh/
  .claude-plugin/
    plugin.json                  # Plugin manifest: name, version, skills, agents,
                                 #   hooks, scripts, templates, config, requirements

  skills/
    mamh/
      SKILL.md                   # Main skill entry point — the complete 6-phase
                                 #   lifecycle definition with all subcommands

  agents/
    mamh-orchestrator.md         # Team lead agent definition — delegate mode,
                                 #   no Write/Edit tools, coordinates all other agents

  hooks/
    hooks.json                   # Hook configuration:
                                 #   - PreToolUse (Write/Edit) -> scope-guard.mjs
                                 #   - TaskCompleted -> review-gate.mjs
                                 #   - TeammateIdle -> keep-working.mjs

  scripts/
    scope-guard.mjs              # Scope enforcement hook script (242 lines)
    review-gate.mjs              # Review gate hook script (279 lines)
    keep-working.mjs             # Keep-working hook script (262 lines)
    init-project.mjs             # Project initialization script (218 lines)

  templates/
    POLICY.md                    # Shared rulebook template with {{PLACEHOLDERS}}
    agents/
      backend.md                 # Backend engineer template
      frontend.md                # Frontend engineer template
      reviewer.md                # Code reviewer template (read-only)
      pm.md                      # Project manager template (docs only)
      designer.md                # UI/UX designer template
      researcher.md              # External researcher template (read-only)
      content.md                 # Content writer template
      devops.md                  # DevOps/infrastructure template

  docs/
    POLICY.md                    # Documentation explaining the policy system

  CLAUDE.md                      # Developer guide for LLMs working on this repo
  STATUS.md                      # Project status, changelog, design decisions
  README.md                      # This file
  package.json                   # npm metadata (no runtime dependencies)
  LICENSE                        # MIT License
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Zero external dependencies** | All scripts use Node.js built-ins only. No `npm install`, no version conflicts, faster cold start. |
| **Template-based agent generation** | Different projects need different specialists. Templates are customized per-project during Phase 1. |
| **Portable plugin paths** | Hooks use `${CLAUDE_PLUGIN_ROOT}` so the plugin works regardless of where it is installed. |
| **Project-scoped state** | All state lives in `.mamh/` inside the project, not in the plugin directory. Multiple projects can use MAMH simultaneously. |
| **Orchestrator as pure coordinator** | The orchestrator has no Write/Edit tools. It cannot do work directly. This enforces delegation discipline. |
| **ESM modules** | All scripts are `.mjs` (ECMAScript modules). No CommonJS. |

---

## Troubleshooting

### Plugin Not Loading

```bash
# Option A: If installed via marketplace, check it's enabled:
/plugin  # Go to "Installed" tab and verify mamh is listed

# Option B: If using --plugin-dir, make sure you're passing the correct path:
claude --plugin-dir /path/to/multi-agent-multi-harness

# Verify the plugin manifest is valid JSON:
node -e "JSON.parse(require('fs').readFileSync('/path/to/multi-agent-multi-harness/.claude-plugin/plugin.json','utf-8')); console.log('OK')"

# If marketplace install doesn't work, try clearing the cache:
# rm -rf ~/.claude/plugins/cache
# Then restart Claude Code and reinstall.
```

### Agent Teams Not Working

```bash
# Ensure the environment variable is set
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
# Must output: 1

# If not set:
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# Add to your shell profile for persistence:
echo 'export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1' >> ~/.zshrc
# or
echo 'export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1' >> ~/.bashrc
```

### Scope Violations

If an agent is unexpectedly blocked from writing:

```bash
# Check the agent's allowed paths in the registry
cat .mamh/agents/registry.json | python3 -m json.tool

# Verify the path patterns match the target file
# Patterns use glob syntax: ** matches any path segments, * matches within a segment
```

Common causes:
- Path pattern does not include the subdirectory (e.g., `src/api/**` does not match `src/api.py` at root level)
- Agent name in the registry does not match the agent's actual name
- Registry file is missing or has invalid JSON

### Agents Stopping Early

The `keep-working.mjs` hook should prevent agents from going idle when they still have assigned tickets. If agents are stopping:

```bash
# Check that the hook is registered
cat /path/to/mamh/hooks/hooks.json

# Verify the hook script is executable
ls -la /path/to/mamh/scripts/keep-working.mjs

# Test the hook directly
echo '{"agent_name":"mamh-backend"}' | node /path/to/mamh/scripts/keep-working.mjs
```

### Tickets Not Completing (Review Gate Blocking)

```bash
# Check the review mode
cat .mamh/state/session.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('reviewMode','auto'))"

# Check unchecked acceptance criteria in a ticket
grep -c '\- \[ \]' .mamh/tickets/milestones/M001-*/T001-*.md

# If using peer or user review mode, the review gate intentionally blocks
# until the reviewer agent or user approves
```

### Resuming After an Interruption

```bash
# Check saved state
cat .mamh/state/mamh-state.json | python3 -m json.tool

# Resume from where you left off
# In Claude Code, type:
mamh resume
```

The resume protocol:
1. Reads `.mamh/state/mamh-state.json` to determine the last phase and status.
2. Resets any `in_progress` tickets to `pending` (the agent may have lost context).
3. Re-launches Agent Teams with the current roster and remaining tickets.

### Init Script Errors

```bash
# Run the init script manually to see detailed output
node /path/to/mamh/scripts/init-project.mjs /path/to/your/project

# The script is idempotent — safe to run multiple times.
# It will skip files/directories that already exist.
```

---

## Contributing

1. **Fork the repository** and clone your fork.

2. **Read `CLAUDE.md`** first. It contains the complete developer guide: coding standards, architectural decisions, naming conventions, and testing procedures.

3. **Read `STATUS.md`** for current project status and design decisions.

4. **Follow these coding standards**:
   - All scripts must be ESM (`.mjs`), not CommonJS
   - Zero external dependencies (Node.js built-ins only)
   - Use `${CLAUDE_PLUGIN_ROOT}` for portable paths in hooks
   - Use `{{PLACEHOLDER}}` syntax in templates
   - State files go in `.mamh/` (project-scoped), never in the plugin directory
   - Test in a separate project, not in the plugin repo itself

5. **Test your changes**:
   ```bash
   # Create a test project
   mkdir /tmp/mamh-test && cd /tmp/mamh-test && git init

   # Launch Claude Code with your fork loaded as a plugin
   claude --plugin-dir /path/to/your/fork

   # Run MAMH and verify your changes work
   mamh "Build a simple REST API"
   ```

6. **Submit a pull request** with a clear description of what changed and why.

### Adding a New Agent Template

1. Create `templates/agents/<role>.md` with YAML frontmatter + markdown instructions
2. Include placeholders: `{{PROJECT_NAME}}`, `{{AGENT_NAME}}`, `{{ALLOWED_PATHS}}`, `{{READ_ONLY_PATHS}}`, `{{FORBIDDEN_PATHS}}`, `{{CONSTRAINTS}}`
3. Define: role, responsibilities, non-responsibilities, tools, scope, communication protocol, definition of done, stop conditions
4. Update documentation in `SKILL.md` and this README

### Modifying Hooks

1. Edit the hook script in `scripts/`
2. Test directly: `echo '{"agent_name":"mamh-backend","tool_name":"Write","tool_input":{"file_path":"/test"}}' | node scripts/scope-guard.mjs`
3. Verify exit codes: 0 = allow, 2 = block, 1 = error

---

## License

MIT License. See [LICENSE](LICENSE) for the full text.

---

**MAMH v0.1.0** -- Built for Claude Code. Zero dependencies. Maximum autonomy.
