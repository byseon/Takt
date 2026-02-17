# Takt Plugin Developer Documentation

Internal developer documentation for the Takt (formerly MAMH) Claude Code plugin.

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Development Setup](#development-setup)
3. [How the Plugin Works](#how-the-plugin-works)
4. [Hook System](#hook-system)
5. [Agent Templates](#agent-templates)
6. [State Management](#state-management)
7. [Testing the Plugin](#testing-the-plugin)
8. [Debugging](#debugging)

---

## Directory Structure

```
skills_dev/
├── .claude-plugin/
│   └── plugin.json                 # Plugin manifest (defines skills, agents, hooks)
├── agents/
│   └── takt-orchestrator.md        # Team lead agent definition
├── docs/
│   ├── README.md                   # This file (developer guide)
│   ├── TEMPLATES.md                # Template customization guide
│   ├── CONFIGURATION.md            # Configuration reference
│   └── POLICY.md                   # Generated shared policy for projects
├── hooks/
│   └── hooks.json                  # Hook registration (PreToolUse)
├── scripts/
│   ├── init-project.mjs            # Phase 0 initialization script
│   ├── scope-guard.mjs             # PreToolUse hook enforces path boundaries
│   ├── review-gate.mjs             # Standalone script: validates acceptance criteria
│   └── keep-working.mjs            # Standalone script: checks for remaining tickets
├── skills/
│   └── takt/
│       └── SKILL.md                # Main skill definition (6-phase workflow)
├── templates/
│   ├── agents/
│   │   ├── backend.md              # Backend engineer template
│   │   ├── frontend.md             # Frontend engineer template
│   │   ├── reviewer.md             # Code reviewer template
│   │   ├── designer.md             # UI/UX designer-developer template
│   │   ├── researcher.md           # External researcher template
│   │   ├── content.md              # Content writer template
│   │   └── devops.md               # DevOps/infrastructure template
│   └── POLICY.md                   # Shared policy template for projects
└── package.json                    # Plugin metadata and dependencies
```

### What Each Directory Does

| Directory | Purpose |
|-----------|---------|
| `.claude-plugin/` | Plugin manifest read by Claude Code. Defines skills, agents, hooks, and scripts. |
| `agents/` | Agent definitions. Only contains `takt-orchestrator.md` (team lead). Other agents are generated per-project in `.claude/agents/` from templates. |
| `docs/` | Documentation for developers and users. |
| `hooks/` | Hook registration file. Maps hook events to script files. |
| `scripts/` | Executable Node.js scripts that implement hooks and utilities. |
| `skills/` | Skill definitions. `takt/SKILL.md` contains the entire 6-phase workflow. |
| `templates/` | Reusable templates for generating project-specific agents and policies. |

---

## Development Setup

### Prerequisites

1. **Node.js 18+** (scripts use ES modules)
2. **Claude Code** with Agent Teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
3. **Git** (for worktree management)

### Local Plugin Installation

To install the plugin locally for development:

```bash
# From the plugin root directory
cd ~/dev/skills_dev

# Link to Claude Code's plugin directory
ln -s "$(pwd)" ~/.claude/plugins/takt

# Verify installation
ls -la ~/.claude/plugins/takt
```

Claude Code automatically discovers plugins in `~/.claude/plugins/`.

### Testing Without Installation

You can test scripts directly:

```bash
# Test init-project script
node scripts/init-project.mjs /path/to/test-project

# Test scope-guard with mock input
echo '{"tool_name":"Write","tool_input":{"file_path":"src/api/users.ts"},"agent_name":"takt-backend"}' | node scripts/scope-guard.mjs

# Test review-gate with mock input
echo '{"agent_name":"takt-backend","task_id":"T001","milestone":"M001"}' | node scripts/review-gate.mjs

# Test keep-working with mock input
echo '{"agent_name":"takt-backend"}' | node scripts/keep-working.mjs
```

---

## How the Plugin Works

### Plugin Lifecycle

```
User triggers skill → Takt phases → Hooks enforce rules → Agents execute → Review gates → Milestone completion
```

### The 6 Phases

| Phase | Name | Purpose | Key Artifacts Generated |
|-------|------|---------|-------------------------|
| 0 | Planning Interview | Transform idea into structured PRD | `.takt/prd.md`, `.takt/tech-spec.md`, `.takt/constraints.md` |
| 1 | Agent Definition | Create specialized agent roster | `.claude/agents/takt-*.md`, `.takt/agents/registry.json` |
| 2 | Ticket Generation | Decompose into milestones and tickets | `.takt/tickets/milestones/M00X/T00Y.md` |
| 3 | Execution | Launch Agent Teams, autonomous work | Modified source files, test results |
| 4 | Review Gates | Validate work before approval | `.takt/reviews/T00Y-review.json` |
| 5 | Milestone Iteration | Complete milestones sequentially | `.takt/logs/M00X-summary.md`, `.takt/logs/project-report.md` |

### Agent Spawning Process

**Phase 1 (Initial Roster):**

1. Skill delegates to `analyst` agent (via OMC) to analyze project requirements
2. Skill delegates to `architect` agent (via OMC) to create agent roster and scope map
3. For each agent role, skill reads template from `templates/agents/<role>.md`
4. Skill substitutes placeholders (`{{PROJECT_NAME}}`, `{{ALLOWED_PATHS}}`, etc.)
5. Skill writes customized agent file to `.claude/agents/takt-<role>.md`
6. Skill updates `.takt/agents/registry.json` with scope boundaries

**Phase 3 (Runtime Provisioning):**

1. Orchestrator detects gap (ticket requires uncovered skill)
2. Orchestrator checks `agentApprovalMode` in `.takt/session.json`:
   - `auto` → create immediately
   - `suggest` → propose to user, await approval
   - `locked` → do not create, use closest existing agent
3. Orchestrator reads matching template from `templates/agents/`
4. Orchestrator substitutes placeholders
5. Orchestrator writes agent file, updates registry, spawns agent via Agent Teams

---

## Hook System

Hooks are event-driven scripts that enforce rules during Agent Teams execution. Claude Code invokes hooks at specific lifecycle events.

### Hook Configuration

Hooks are registered in `hooks/hooks.json`:

```json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "tools": ["Write", "Edit"],
      "script": "${CLAUDE_PLUGIN_ROOT}/scripts/scope-guard.mjs",
      "description": "Blocks agents from writing outside their allowed scope"
    },
  ]
}

```

### Hook 1: scope-guard.mjs (PreToolUse)

**Trigger:** Before any agent uses `Write` or `Edit` tool

**Purpose:** Enforce path boundaries defined in agent registry

**Input (via stdin):**
```json
{
  "tool_name": "Write",
  "tool_input": { "file_path": "/absolute/path/to/file.ts" },
  "agent_name": "takt-backend",
  "session_id": "..."
}
```

**Logic:**

1. Read `.takt/agents/registry.json`
2. Look up agent's `allowedPaths` (glob patterns)
3. Match `file_path` against patterns using minimal glob matcher
4. If match → exit 0 (allow)
5. If no match → find owning agent, exit 2 (block), print helpful message

**Exit Codes:**
- `0` = allow write
- `2` = block write (scope violation)
- `1` = internal error

**Example Block Message:**
```
SCOPE VIOLATION: takt-backend cannot write to src/ui/components/Button.tsx. This file belongs to takt-frontend's scope. Send a message to takt-frontend instead.
```

**Glob Matching Logic:**

The script implements a minimal glob matcher supporting:
- `**` = matches any number of path segments
- `*` = matches any characters within a single segment
- `?` = matches exactly one character

Example patterns:
- `src/api/**` → matches `src/api/users.ts`, `src/api/v1/auth.ts`
- `src/*.ts` → matches `src/index.ts` but NOT `src/api/users.ts`
- `tests/**/*.test.ts` → matches any test file in nested test directories

### Script 2: review-gate.mjs (standalone)

**Not registered as a hook.** Invoked programmatically by the orchestrator when an agent reports ticket completion.

**Purpose:** Validate acceptance criteria before approval

**Input (via stdin):**
```json
{
  "agent_name": "takt-backend",
  "task_id": "T001",
  "milestone": "M001",
  "session_id": "..."
}
```

**Logic:**

1. Locate ticket file in `.takt/tickets/milestones/<milestone>/<task_id>.md`
2. Parse acceptance criteria checkboxes:
   ```markdown
   ## Acceptance Criteria
   - [x] Criterion 1 (checked)
   - [ ] Criterion 2 (unchecked)
   ```
3. Read `.takt/session.json` to get `reviewMode`
4. Apply review mode logic:
   - **auto**: If all checkboxes checked → approve (exit 0), else block (exit 2)
   - **peer**: Block completion (exit 2), trigger reviewer agent
   - **user**: Block completion (exit 2), prompt user for approval

**Exit Codes:**
- `0` = approve completion
- `2` = block completion (criteria unmet or review required)
- `1` = internal error

**Example Block Message (auto mode):**
```
REVIEW GATE: Ticket T001 cannot be completed. 2 of 5 acceptance criteria remain unchecked:
  - [ ] Add error handling for invalid input
  - [ ] Write integration tests

Complete all acceptance criteria before marking this ticket as done.
```

### Script 3: keep-working.mjs (standalone)

**Not registered as a hook.** Invoked programmatically by the orchestrator to check if an agent has remaining work.

**Purpose:** Check whether an agent has remaining assigned tickets in the current milestone

**Input (via stdin):**
```json
{
  "agent_name": "takt-backend",
  "session_id": "..."
}
```

**Logic:**

1. Read `.takt/session.json` to get `currentMilestone`
2. Scan `.takt/tickets/milestones/<milestone>/` for tickets assigned to agent
3. Parse ticket metadata (status, assignee) from markdown files
4. Categorize tickets: `pending`, `in_progress`, `done`
5. If `pending` or `in_progress` tickets exist → exit 2 with ticket list
6. If no remaining tickets → exit 0 (agent can be shut down)

**Exit Codes:**
- `0` = allow idle (no remaining work)
- `2` = block idle (agent has remaining tickets)
- `1` = internal error

**Example Block Message:**
```
You have unclaimed tickets: T002, T003, T004. Claim and work on T002.

Details:
In-progress tickets: T002
Pending tickets: T003, T004
```

**Ticket Metadata Parsing:**

The script parses ticket files flexibly, supporting:
- YAML front matter: `---\nstatus: pending\nassignee: takt-backend\n---`
- Inline bold: `**Status:** in_progress`
- Inline code: `Assignee: \`takt-backend\``
- Checkbox inference: All checked → done, some checked → in_progress, none checked → pending

---

## Agent Templates

Agent templates are markdown files with YAML front matter and placeholder substitution.

### Template Structure

```markdown
---
name: takt-<role>
description: "<role description> for {{PROJECT_NAME}}"
model: sonnet
tools:
  - Read
  - Write
  - Edit
disallowedTools:
  - WebFetch
memory: project
---

# {{AGENT_NAME}} — Role Title

You are the <role> for **{{PROJECT_NAME}}**. <role description>

## Work Scope

### Allowed Paths (read + write)
{{ALLOWED_PATHS}}

### Read-Only Paths (read only, no modifications)
{{READ_ONLY_PATHS}}

### Forbidden Paths (do not read or modify)
{{FORBIDDEN_PATHS}}

## Constraints

{{CONSTRAINTS}}

<rest of agent instructions>
```

### Template Placeholders

| Placeholder | Replaced With | Example |
|-------------|---------------|---------|
| `{{PROJECT_NAME}}` | Project name from `.takt/session.json` | "TaskMaster Pro" |
| `{{AGENT_NAME}}` | Full agent name from registry | "takt-backend" |
| `{{ALLOWED_PATHS}}` | Formatted list of allowed paths | `- src/api/**\n- src/db/**` |
| `{{READ_ONLY_PATHS}}` | Formatted list of read-only paths | `- src/shared/**\n- tests/**` |
| `{{FORBIDDEN_PATHS}}` | Formatted list of forbidden paths | `- src/ui/**\n- docs/**` |
| `{{CONSTRAINTS}}` | Project-specific constraints from `.takt/constraints.md` | "Must use PostgreSQL\nNo external APIs" |

### Substitution Process

**During Phase 1 (initial roster):**

```javascript
// Pseudo-code
const template = readFile('templates/agents/backend.md');
const projectName = session.projectName;
const agentConfig = registry.agents['takt-backend'];

let agentFile = template;
agentFile = agentFile.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
agentFile = agentFile.replace(/\{\{AGENT_NAME\}\}/g, 'takt-backend');
agentFile = agentFile.replace(/\{\{ALLOWED_PATHS\}\}/g, formatPathList(agentConfig.allowedPaths));
agentFile = agentFile.replace(/\{\{READ_ONLY_PATHS\}\}/g, formatPathList(agentConfig.readablePaths));
agentFile = agentFile.replace(/\{\{FORBIDDEN_PATHS\}\}/g, formatPathList(agentConfig.forbiddenPaths));
agentFile = agentFile.replace(/\{\{CONSTRAINTS\}\}/g, readFile('.takt/constraints.md'));

writeFile('.claude/agents/takt-backend.md', agentFile);
```

**During Phase 3 (runtime provisioning):**

Same substitution logic, but initiated by orchestrator agent when gap is detected.

---

## State Management

Takt maintains state across multiple JSON and Markdown files in `.takt/`.

### State File Locations

All state files live under `.takt/` in the user's project directory.

```
.takt/
├── session.json              # Session configuration (set once in Phase 0)
├── prd.md                    # Product Requirements Document
├── tech-spec.md              # Technical specification
├── constraints.md            # Hard constraints and preferences
├── state/
│   └── takt-state.json       # Current operational state (phase, milestone, ticket counts)
├── agents/
│   └── registry.json         # Agent roster with scope boundaries
├── tickets/
│   ├── milestones/
│   │   └── M001-name/
│   │       ├── _milestone.json
│   │       └── T001-agent-title.md
│   └── archive/              # Completed milestone tickets
├── reviews/
│   └── T001-review.json      # Review results per ticket
└── logs/
    ├── coordination/         # Agent-to-agent messages
    ├── errors/               # Error logs
    ├── M001-summary.md       # Milestone summaries
    └── project-report.md     # Final report
```

### session.json (Configuration)

Set once during Phase 0, read throughout. Never modified after initialization.

```json
{
  "projectName": "TaskMaster Pro",
  "startedAt": "2026-02-08T12:00:00.000Z",
  "currentPhase": 3,
  "currentMilestone": "M001",
  "agentApprovalMode": "suggest",
  "milestoneAdvanceMode": "user-decides",
  "reviewMode": "auto",
  "milestoneGranularity": "medium"
}
```

### takt-state.json (Operational State)

Updated continuously during execution. Reflects current status.

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
  "stoppedAt": null,
  "activeTickets": [],
  "lastUpdated": "2026-02-08T15:30:00.000Z"
}
```

### registry.json (Agent Roster)

Agent definitions with scope boundaries. Updated when agents are added/removed.

```json
{
  "agents": {
    "takt-backend": {
      "id": "takt-backend",
      "role": "Backend implementation",
      "modelTier": "sonnet",
      "allowedPaths": ["src/api/**", "src/db/**", "tests/api/**"],
      "readablePaths": ["src/shared/**", ".takt/**"],
      "forbiddenPaths": ["src/ui/**", "src/client/**"],
      "status": "active",
      "ticketsCompleted": 5,
      "ticketsAssigned": 3
    },
    "takt-frontend": {
      "id": "takt-frontend",
      "role": "Frontend implementation",
      "modelTier": "sonnet",
      "allowedPaths": ["src/ui/**", "src/client/**", "tests/ui/**"],
      "readablePaths": ["src/shared/**", ".takt/**"],
      "forbiddenPaths": ["src/api/**", "src/db/**"],
      "status": "active",
      "ticketsCompleted": 4,
      "ticketsAssigned": 2
    }
  },
  "generatedAt": "2026-02-08T12:30:00.000Z",
  "totalAgents": 2
}
```

### Ticket File Format

Each ticket is a markdown file with metadata and checkboxes.

**Example:** `.takt/tickets/milestones/M001-scaffolding/T001-backend-setup-project.md`

```markdown
# T001: Setup Project Structure

**Agent:** takt-backend
**Milestone:** M001
**Status:** pending
**Priority:** critical
**Complexity:** low
**Dependencies:** none

## Description

Initialize the Node.js project with TypeScript, ESLint, Prettier, and testing framework.
Set up directory structure according to tech spec.

## Acceptance Criteria

- [ ] package.json created with correct dependencies
- [ ] tsconfig.json configured for strict mode
- [ ] ESLint and Prettier configured
- [ ] Jest configured for unit testing
- [ ] Directory structure matches tech spec
- [ ] README.md with setup instructions

## Review Notes

<!-- Populated after review -->
```

---

## Testing the Plugin

### Unit Testing Hook Scripts

Test hooks in isolation with mock inputs:

```bash
# Test scope-guard - should ALLOW (backend writing to api)
echo '{"tool_name":"Write","tool_input":{"file_path":"'$(pwd)'/src/api/users.ts"},"agent_name":"takt-backend"}' \
  | node scripts/scope-guard.mjs
echo "Exit code: $?"  # Should be 0

# Test scope-guard - should BLOCK (backend writing to ui)
echo '{"tool_name":"Write","tool_input":{"file_path":"'$(pwd)'/src/ui/Button.tsx"},"agent_name":"takt-backend"}' \
  | node scripts/scope-guard.mjs
echo "Exit code: $?"  # Should be 2

# Test review-gate - create mock ticket first
mkdir -p .takt/tickets/milestones/M001
cat > .takt/tickets/milestones/M001/T001.md <<'EOF'
# T001: Test Ticket
**Status:** pending
## Acceptance Criteria
- [ ] Unchecked item
EOF

echo '{"agent_name":"takt-backend","task_id":"T001","milestone":"M001"}' \
  | node scripts/review-gate.mjs
echo "Exit code: $?"  # Should be 2 (blocked, criteria unchecked)
```

### Integration Testing

Test the full workflow in a scratch project:

```bash
# Create test project
mkdir ~/test-takt-project
cd ~/test-takt-project
git init

# Set environment variable
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# Trigger skill in Claude Code
# Say: "takt: build a simple REST API for managing tasks"

# Monitor state files
watch -n 2 'cat .takt/state/takt-state.json | jq'

# Check generated agents
ls -la .claude/agents/

# Check tickets
find .takt/tickets/milestones -name "*.md"

# Check logs
tail -f .takt/logs/*.md
```

### Testing Agent Templates

Validate that templates substitute correctly:

```bash
# Create mock session and registry
mkdir -p .takt/{state,agents}

cat > .takt/session.json <<'EOF'
{
  "projectName": "Test Project",
  "agentApprovalMode": "auto"
}
EOF

cat > .takt/agents/registry.json <<'EOF'
{
  "agents": {
    "takt-backend": {
      "allowedPaths": ["src/api/**"],
      "readablePaths": ["src/shared/**"],
      "forbiddenPaths": ["src/ui/**"]
    }
  }
}
EOF

cat > .takt/constraints.md <<'EOF'
- Must use TypeScript strict mode
- No external API calls without user approval
EOF

# Manually run template substitution (pseudo-code, implement as needed)
# This would be done programmatically by the skill
```

---

## Debugging

### Debug Hooks

Hooks output to stdout (messages) and stderr (errors). Capture for debugging:

```bash
# Run hook with debug output
echo '<hook-input-json>' | node scripts/scope-guard.mjs 2>&1 | tee hook-debug.log
```

### Trace Hook Invocations

Claude Code logs hook invocations. Check logs:

```bash
# macOS
tail -f ~/Library/Logs/Claude/claude-code.log | grep -i "hook"

# Linux
tail -f ~/.config/Claude/logs/claude-code.log | grep -i "hook"
```

### Debug State Management

Validate state file integrity:

```bash
# Check JSON syntax
jq . .takt/state/takt-state.json
jq . .takt/agents/registry.json
jq . .takt/session.json

# Watch state changes in real-time
watch -n 1 'jq . .takt/state/takt-state.json'
```

### Debug Glob Matching

Test glob patterns against file paths:

```javascript
// Add to scope-guard.mjs for debugging
console.error(`Pattern: ${pattern}`);
console.error(`Path: ${filePath}`);
console.error(`Normalized pattern: ${normPattern}`);
console.error(`Normalized path: ${normPath}`);
console.error(`Regex: ${regexStr}`);
console.error(`Match: ${regex.test(normPath)}`);
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Hooks not firing | Hooks not registered in `hooks.json` | Verify `hooks.json` matches `plugin.json` reference |
| Scope violations not blocked | Registry not found or malformed | Check `.takt/agents/registry.json` exists and has valid JSON |
| Agents write to wrong paths | Glob patterns too broad | Narrow patterns in registry, test with mock inputs |
| Tickets not found by hooks | File naming mismatch | Ensure ticket IDs match filenames exactly |
| Review gate always passes | Acceptance criteria not parseable | Use standard markdown checkbox format: `- [ ]` and `- [x]` |

### Verbose Logging

Enable verbose mode by setting environment variable:

```bash
export TAKT_DEBUG=1
```

Then add debug statements to scripts:

```javascript
if (process.env.TAKT_DEBUG) {
  console.error(`[DEBUG] ${message}`);
}
```

---

## Contributing

When modifying the plugin:

1. **Test hooks in isolation** before integration testing
2. **Update templates** when adding new placeholders
3. **Document new hooks** in this file and in hook comments
4. **Version state schemas** when changing `.takt/*.json` formats
5. **Maintain backward compatibility** or provide migration scripts

---

## See Also

- [TEMPLATES.md](./TEMPLATES.md) - Guide to customizing agent templates
- [CONFIGURATION.md](./CONFIGURATION.md) - Configuration reference
- [SKILL.md](../skills/takt/SKILL.md) - Full 6-phase workflow specification
