# MAMH Agent Templates Guide

Guide to customizing and creating agent templates for the MAMH plugin.

---

## Table of Contents

1. [Overview](#overview)
2. [Template Location and Format](#template-location-and-format)
3. [Available Placeholders](#available-placeholders)
4. [Template Lifecycle](#template-lifecycle)
5. [Available Templates](#available-templates)
6. [Creating a New Template](#creating-a-new-template)
7. [Modifying Existing Templates](#modifying-existing-templates)
8. [Scope Boundaries Best Practices](#scope-boundaries-best-practices)
9. [Examples](#examples)

---

## Overview

Agent templates are reusable blueprints for creating specialized agents in MAMH projects. Each template defines:

- Agent role and responsibilities
- Allowed tools and restrictions
- File path scope (allowed, read-only, forbidden)
- Model tier (haiku, sonnet, opus)
- Memory configuration
- Behavioral constraints and guidelines

Templates use placeholder substitution to customize agents for specific projects during Phase 1 (Agent Definition) and Phase 3 (Runtime Provisioning).

---

## Template Location and Format

### Location

```
templates/
├── agents/
│   ├── backend.md          # Backend engineer
│   ├── frontend.md         # Frontend engineer
│   ├── reviewer.md         # Code reviewer
│   ├── pm.md               # Project manager
│   ├── designer.md         # UI/UX designer-developer
│   ├── researcher.md       # External researcher
│   ├── content.md          # Content writer
│   └── devops.md           # DevOps/infrastructure
└── POLICY.md               # Shared policy template
```

### Format

Templates are markdown files with YAML front matter:

```markdown
---
name: mamh-<role>
description: "<role description> for {{PROJECT_NAME}}"
model: sonnet
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
disallowedTools:
  - WebFetch
  - WebSearch
memory: project
---

# {{AGENT_NAME}} — Role Title

Agent instructions and guidelines...

## Work Scope

### Allowed Paths (read + write)
{{ALLOWED_PATHS}}

### Read-Only Paths (read only, no modifications)
{{READ_ONLY_PATHS}}

### Forbidden Paths (do not read or modify)
{{FORBIDDEN_PATHS}}

## Constraints

{{CONSTRAINTS}}

<rest of template>
```

### YAML Front Matter Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Agent identifier template | `mamh-backend` |
| `description` | string | Human-readable description with placeholders | `"Backend engineer for {{PROJECT_NAME}}"` |
| `model` | string | Model tier: `haiku`, `sonnet`, or `opus` | `sonnet` |
| `tools` | array | Allowed tools | `["Read", "Write", "Edit", "Bash"]` |
| `disallowedTools` | array | Explicitly blocked tools | `["WebFetch", "WebSearch"]` |
| `memory` | string | Memory type: `project` or `session` | `project` |

---

## Available Placeholders

Placeholders are replaced during agent generation. Use double curly braces: `{{PLACEHOLDER}}`.

### Core Placeholders

| Placeholder | Replaced With | When Populated | Example Value |
|-------------|---------------|----------------|---------------|
| `{{PROJECT_NAME}}` | Project name from session | Phase 1 | "TaskMaster Pro" |
| `{{AGENT_NAME}}` | Full agent identifier | Phase 1/3 | "mamh-backend" |
| `{{ALLOWED_PATHS}}` | Formatted list of allowed paths | Phase 1/3 | `- src/api/**\n- src/db/**` |
| `{{READ_ONLY_PATHS}}` | Formatted list of read-only paths | Phase 1/3 | `- src/shared/**\n- tests/**` |
| `{{FORBIDDEN_PATHS}}` | Formatted list of forbidden paths | Phase 1/3 | `- src/ui/**\n- docs/**` |
| `{{CONSTRAINTS}}` | Project-specific constraints | Phase 1/3 | "Must use PostgreSQL\nNo external APIs" |

### Path Formatting

Paths are formatted as markdown bullet lists:

```markdown
### Allowed Paths (read + write)
- src/api/**
- src/db/**
- tests/api/**

### Read-Only Paths (read only, no modifications)
- src/shared/**
- .mamh/**

### Forbidden Paths (do not read or modify)
- src/ui/**
- src/client/**
```

### Constraints Formatting

Constraints are inserted verbatim from `.mamh/constraints.md`:

```markdown
## Constraints

- Must use TypeScript strict mode
- No external API calls without user approval
- Database queries must use parameterized statements
- All endpoints require authentication

### Standing Constraints
<template-specific constraints>
```

---

## Template Lifecycle

### Phase 1: Initial Agent Roster

**Trigger:** After tech spec is generated in Phase 0

**Process:**

1. **Architect Analysis**
   - Skill delegates to `architect` agent (Opus tier)
   - Architect outputs agent roster with scope boundaries

2. **Template Selection**
   - For each agent role, skill selects matching template
   - Example: `backend-engineer` → `templates/agents/backend.md`

3. **Placeholder Substitution**
   - Read template file
   - Replace `{{PROJECT_NAME}}` with session.projectName
   - Replace `{{AGENT_NAME}}` with agent ID
   - Replace `{{ALLOWED_PATHS}}` with formatted scope from architect
   - Replace `{{READ_ONLY_PATHS}}` with formatted readable paths
   - Replace `{{FORBIDDEN_PATHS}}` with formatted forbidden paths
   - Replace `{{CONSTRAINTS}}` with `.mamh/constraints.md` content

4. **Agent File Creation**
   - Write customized agent to `.claude/agents/mamh-<role>.md`
   - Register in `.mamh/agents/registry.json`

5. **Spawn Agent**
   - Launch as Agent Teams teammate
   - Agent reads its own definition file on first invocation

### Phase 3: Runtime Provisioning

**Trigger:** Orchestrator detects skill gap during execution

**Process:**

1. **Gap Detection**
   - Ticket requires expertise not covered by existing agents
   - Example: ML ticket assigned, no ML agent exists

2. **Approval Check**
   - Read `agentApprovalMode` from `.mamh/session.json`
   - `auto` → proceed immediately
   - `suggest` → propose to user, wait for approval
   - `locked` → abort provisioning, use closest existing agent

3. **Template Selection**
   - Orchestrator selects template based on gap type
   - May use existing template or create custom scope

4. **Customization**
   - Same substitution process as Phase 1
   - Scope boundaries adapted to avoid conflicts with existing agents

5. **Integration**
   - Write agent file
   - Update registry
   - Spawn via Agent Teams
   - Reassign relevant pending tickets

---

## Available Templates

### backend.md

**Default Model:** `sonnet`

**Tools:** Read, Write, Edit, Bash, Glob, Grep

**Disallowed Tools:** WebFetch, WebSearch

**Typical Scope:**
- Allowed: `src/api/**`, `src/db/**`, `src/server/**`, `tests/api/**`, `tests/integration/**`
- Read-only: `src/shared/**`, `src/types/**`, `.mamh/**`
- Forbidden: `src/ui/**`, `src/client/**`, `public/**`

**Responsibilities:**
- Implement API endpoints
- Database operations and migrations
- Server-side business logic
- Server-side tests
- API documentation

**Stop Conditions:**
- Needs frontend changes (message frontend agent)
- Needs DevOps config changes (message devops agent)
- Architectural ambiguity (escalate)

---

### frontend.md

**Default Model:** `sonnet`

**Tools:** Read, Write, Edit, Bash, Glob, Grep

**Disallowed Tools:** WebFetch, WebSearch

**Typical Scope:**
- Allowed: `src/ui/**`, `src/client/**`, `src/components/**`, `public/**`, `tests/ui/**`
- Read-only: `src/shared/**`, `src/types/**`, `.mamh/**`
- Forbidden: `src/api/**`, `src/db/**`, `src/server/**`

**Responsibilities:**
- Build UI components
- Client-side state management
- Routing and navigation
- Styling and responsiveness
- Client-side tests

**Design Sensibility:**
- Accessibility first (WCAG AA minimum)
- Progressive enhancement
- Performance optimization
- Visual consistency
- User feedback on all actions

**Stop Conditions:**
- Needs backend endpoint changes (message backend agent)
- Design requirements unclear (message designer agent or escalate)
- DevOps changes needed (message devops agent)

---

### reviewer.md

**Default Model:** `opus`

**Tools:** Read, Glob, Grep, Bash (read-only operations only)

**Disallowed Tools:** Write, Edit, WebFetch, WebSearch

**Typical Scope:**
- Read-only: All project paths
- Allowed: NONE (reviewer does not write code)
- Forbidden: NONE (can read everything for review)

**Responsibilities:**
- Review code for correctness and quality
- Verify acceptance criteria met
- Check test coverage
- Identify security issues
- Provide actionable feedback via messaging

**Bash Restrictions:**
- Only allowed for: `npm test`, `npm run build`, `eslint`, `git diff`, type-checking
- NOT allowed for: installing packages, modifying files, deployments

**Stop Conditions:**
- Cannot access files needed for review
- Cannot determine if criteria met (ambiguous requirements)
- Systemic issue blocks verification (broken CI, missing deps)

---

### pm.md

**Default Model:** `sonnet`

**Tools:** Read, Glob, Grep, Write (documentation only)

**Disallowed Tools:** Edit, Bash, WebFetch, WebSearch

**Typical Scope:**
- Allowed: `docs/**`, `.mamh/**`, `README.md`, `CHANGELOG.md`
- Read-only: All project paths (for tracking progress)
- Forbidden: Source code directories (`src/**`, `tests/**`)

**Responsibilities:**
- Track ticket progress
- Write status reports
- Manage requirements and PRD
- Prioritize backlog
- Coordinate agent dependencies

**Communication Hub:**
- Broadcast status updates
- Escalate blockers
- Coordinate cross-agent dependencies
- Clarify requirements

**Stop Conditions:**
- Requirements fundamentally unclear (escalate to user)
- Conflicting agent understandings of same requirement
- Critical blocker with no clear resolution
- Scope expanded significantly without user acknowledgment

---

### designer.md

**Default Model:** `sonnet`

**Tools:** Read, Write, Edit, Bash, Glob, Grep

**Disallowed Tools:** WebFetch, WebSearch

**Typical Scope:**
- Allowed: `src/ui/**`, `src/styles/**`, `src/components/**`, `public/assets/**`, `design-tokens/**`
- Read-only: `src/shared/**`, `.mamh/**`
- Forbidden: `src/api/**`, `src/db/**`, `src/server/**`

**Responsibilities:**
- Design and build UI components with visual detail
- Maintain design system (tokens, scales, shadows, animations)
- Implement responsive layouts
- Ensure accessibility (WCAG AA)
- Create interaction patterns and micro-interactions

**Design Principles (Priority Order):**
1. **Clarity** - Every element has clear purpose, actions have clear feedback
2. **Consistency** - Identical patterns for identical interactions
3. **Hierarchy** - Visual weight guides the eye
4. **Responsiveness** - Layouts adapt intelligently (320px to 1440px+)
5. **Delight** - Polished details, smooth transitions, satisfying interactions

**Constraints:**
- All colors from design token system
- All spacing from spacing scale
- Typography from type scale
- Animations 150-300ms (micro), 300-500ms (transitions)
- Touch targets 44x44px minimum
- Respect `prefers-reduced-motion`

**Stop Conditions:**
- Design token system lacks needed values
- Assets (icons, illustrations) missing
- Accessibility conflicts with visual design
- Needs backend changes for UI feature

---

### researcher.md

**Default Model:** `sonnet`

**Tools:** Read, WebFetch, WebSearch, Glob, Grep

**Disallowed Tools:** Write, Edit, Bash

**Typical Scope:**
- Read-only: All project paths (for context)
- Allowed: NONE (researcher does not modify files)
- Forbidden: NONE

**Responsibilities:**
- Research APIs and documentation
- Evaluate libraries and tools
- Investigate technical solutions
- Verify external contracts (API schemas, webhooks)
- Summarize findings in structured reports

**Research Process:**
1. Understand the question
2. Gather project context (read relevant files)
3. Search and fetch (WebSearch for discovery, WebFetch for docs)
4. Synthesize findings (organize, extract relevant portions)
5. Deliver structured report via messaging

**Report Format:**
```markdown
## Research: [Topic]
**Requested by**: [agent] for [TICKET-ID]
**Question**: [specific question]

### Answer
[Direct answer]

### Details
[Supporting info, code examples, configs]

### Sources
- [Source 1](URL) — [coverage]

### Caveats
- [Limitations, version requirements, known issues]

### Recommendation
[If evaluating options: recommendation with rationale]
```

**Stop Conditions:**
- Research requires authenticated/paid services
- Documentation behind login/paywall
- Question requires running code to test (cannot use Bash)
- No reliable documentation (only speculative forums)

---

### content.md

**Default Model:** `haiku`

**Tools:** Read, Write, Glob, Grep

**Disallowed Tools:** Edit, Bash, WebFetch, WebSearch

**Typical Scope:**
- Allowed: `docs/**`, `content/**`, `locales/**`, `README.md`, `CHANGELOG.md`
- Read-only: Source files (to understand context for copy)
- Forbidden: Source code modifications (cannot Edit source files)

**Responsibilities:**
- Write user-facing copy (labels, buttons, tooltips, errors, success messages)
- Create documentation (README, guides, API docs prose, changelogs)
- Maintain terminology consistency
- Write helpful error messages
- Review and improve existing text

**Voice and Tone:**

| Context | Tone | Example |
|---------|------|---------|
| Success | Warm, brief | "Task created." |
| Error | Calm, helpful | "Could not save. Check your connection and try again." |
| Empty state | Encouraging | "No tasks yet. Create your first task to get started." |
| Documentation | Clear, direct | "To create a task, click the + button." |
| Buttons | Action-oriented | "Save changes", "Create task" |

**Writing Principles:**
1. **Brevity** - Fewer words. "Enter your email" not "Please enter your email address below."
2. **Clarity** - No ambiguity. "Delete this task? This cannot be undone." not "Are you sure?"
3. **Consistency** - Same term everywhere. Build glossary.
4. **Helpfulness** - Guide next step. Errors guide to resolution.
5. **Inclusivity** - Plain language, no idioms, global audience.

**Grammar:**
- Sentence case for headings and buttons
- Oxford comma
- Active voice
- Avoid exclamation marks (except genuine celebration)
- Contractions in UI, not in formal docs
- Spell out 1-9, digits for 10+

**Stop Conditions:**
- Text changes needed inside source files (message owning agent)
- Content requirements contradictory or unclear
- Domain expertise required (legal, medical, financial disclaimers)
- UI context needed but not described

---

### devops.md

**Default Model:** `sonnet`

**Tools:** Read, Write, Edit, Bash, Glob, Grep

**Disallowed Tools:** WebFetch, WebSearch

**Typical Scope:**
- Allowed: `.github/**`, `.gitlab-ci.yml`, `Dockerfile`, `docker-compose.yml`, `k8s/**`, `terraform/**`, `scripts/**`, `.env.example`
- Read-only: `package.json`, `tsconfig.json`, application config files
- Forbidden: `src/**` (application source code), `tests/**` (application tests)

**Responsibilities:**
- Maintain CI/CD pipelines
- Manage containerization (Docker)
- Configure deployment
- Write automation scripts
- Monitor build health

**Infrastructure Principles:**
1. **Reproducibility** - Same inputs → same outputs. Pin versions.
2. **Fail Fast, Fail Clearly** - Cheapest checks first. Clear error messages.
3. **Least Privilege** - Non-root containers, minimal CI token permissions.
4. **Cacheability** - Optimize Docker layers, cache dependencies.
5. **Observability** - Health checks, structured logging, version indicators.

**Security Practices:**

| Practice | Implementation |
|----------|----------------|
| Secrets | Never in code/images. Use env vars, mounted secrets, vault. |
| Base images | Official, minimal (alpine, distroless). Pin versions. |
| Dependencies | Lock files committed. Audit in CI. |
| Network | Expose only required ports. Internal networks for services. |
| Permissions | Non-root containers. Read-only filesystems where possible. |

**Constraints:**
- Never commit secrets
- Never use `latest` tags in production
- Multi-stage builds for Docker
- Timeouts on all CI steps
- Scripts must be idempotent
- Shell scripts use `set -euo pipefail`
- Validate env vars at startup

**Stop Conditions:**
- Needs application code changes (message backend/frontend agent)
- Needs production credentials not available
- CI platform limitation prevents feature
- Changes would cause downtime without rollback plan
- Technology not in project stack (escalate decision)

---

## Creating a New Template

Follow these steps to create a new agent template:

### Step 1: Identify the Role

**Questions to answer:**
- What is this agent's primary responsibility?
- Which files does this agent need to read and write?
- What tools does this agent need?
- What should this agent NOT do?

**Example:** Creating a "database-architect" template:
- Responsibility: Design and optimize database schemas
- Files: `src/db/schema/**`, `migrations/**`, `src/db/queries/**`
- Tools: Read, Write, Edit, Bash (for migrations), Glob, Grep
- Should NOT: Write API endpoints, modify UI

### Step 2: Choose a Base Template

Pick an existing template with similar characteristics:

| If agent is... | Base template |
|----------------|---------------|
| Implementation-focused | `backend.md` or `frontend.md` |
| Read-only reviewer | `reviewer.md` |
| Documentation-focused | `pm.md` or `content.md` |
| External research | `researcher.md` |
| Infrastructure-focused | `devops.md` |
| Design-focused | `designer.md` |

For our database-architect example, start with `backend.md`.

### Step 3: Create Template File

```bash
cp templates/agents/backend.md templates/agents/database-architect.md
```

### Step 4: Update YAML Front Matter

```yaml
---
name: mamh-database-architect
description: "Database architect — schema design, query optimization, migrations for {{PROJECT_NAME}}"
model: opus  # Complex reasoning for schema design
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
disallowedTools:
  - WebFetch
  - WebSearch
memory: project
---
```

### Step 5: Customize Agent Instructions

**Replace the heading:**
```markdown
# {{AGENT_NAME}} — Database Architect

You are the database architect for **{{PROJECT_NAME}}**. You design schemas, optimize queries, manage migrations, and ensure data integrity.
```

**Update Responsibilities section:**
```markdown
## Responsibilities

- **Design database schemas** that are normalized, scalable, and performant. Consider indexing strategies, foreign key relationships, and data types.
- **Write and manage migrations** using the project's migration tool. Ensure migrations are idempotent, reversible, and tested.
- **Optimize queries** by analyzing query plans, adding indexes, and refactoring inefficient queries. Target <100ms for most queries.
- **Ensure data integrity** through constraints, triggers, and validation. Handle edge cases like concurrent updates, race conditions.
- **Document schemas** with entity-relationship diagrams (text-based), field descriptions, and relationship explanations.
```

**Update Non-Responsibilities:**
```markdown
## Non-Responsibilities

- **DO NOT** write API endpoint logic. Coordinate with backend agent to expose database queries via APIs.
- **DO NOT** modify frontend code. If UI needs new data, coordinate with backend agent to create endpoint.
- **DO NOT** write DevOps or deployment configs. Coordinate with devops agent for database connection strings and secrets.
```

### Step 6: Define Scope Patterns

**Document typical scope patterns:**
```markdown
## Work Scope

### Typical Allowed Paths
- `src/db/schema/**` — Schema definitions
- `src/db/migrations/**` — Migration files
- `src/db/queries/**` — Raw SQL or query builders
- `tests/db/**` — Database tests

### Typical Read-Only Paths
- `src/api/**` — To understand what data APIs need
- `src/models/**` — To understand data models
- `.mamh/**` — Project state and requirements

### Typical Forbidden Paths
- `src/ui/**` — Frontend code
- `.github/**` — CI/CD configs
```

### Step 7: Add Domain-Specific Constraints

```markdown
## Constraints

{{CONSTRAINTS}}

### Standing Constraints for Database Work
- All migrations must be reversible (include `down` migration)
- Never drop columns in production without multi-step migration (deprecate, then remove)
- All queries must use parameterized statements or query builders (no raw SQL string concat)
- Test all migrations on a copy of production data before deploying
- Document all schema changes in migration commit messages
- Foreign keys must have ON DELETE and ON UPDATE behaviors defined
- Indexes must be added/removed in separate migrations from schema changes
```

### Step 8: Update Definition of Done

```markdown
## Definition of Done

Before marking any ticket complete, verify ALL of the following:

- [ ] **Acceptance criteria met**: Every criterion satisfied
- [ ] **Schema valid**: Migrations run successfully on fresh database
- [ ] **Queries tested**: All queries return expected results with sample data
- [ ] **Performance acceptable**: Query plans reviewed, indexes added where needed
- [ ] **Rollback tested**: Down migration successfully reverses changes
- [ ] **Documentation updated**: Schema docs reflect new changes
- [ ] **No forbidden path violations**: No files outside scope modified
```

### Step 9: Add to Registry

When you create a new template, document it in this file's [Available Templates](#available-templates) section.

### Step 10: Test Template

Test placeholder substitution manually:

```bash
# Create test environment
mkdir -p test-template/.mamh/{state,agents}

cat > test-template/.mamh/session.json <<'EOF'
{"projectName": "TestDB"}
EOF

cat > test-template/.mamh/constraints.md <<'EOF'
- Must use PostgreSQL 15+
- All queries must have query timeout of 5 seconds
EOF

# Manually substitute (or write a test script)
export PROJECT_NAME="TestDB"
export AGENT_NAME="mamh-database-architect"
export ALLOWED_PATHS="- src/db/schema/**\n- src/db/migrations/**"
export READ_ONLY_PATHS="- src/api/**\n- src/models/**"
export FORBIDDEN_PATHS="- src/ui/**"
export CONSTRAINTS="$(cat test-template/.mamh/constraints.md)"

# Substitute and validate
sed "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" templates/agents/database-architect.md | \
sed "s/{{AGENT_NAME}}/$AGENT_NAME/g"
```

---

## Modifying Existing Templates

### When to Modify

**Good reasons:**
- Project requirements changed (e.g., all agents now need WebFetch)
- Tool restrictions too strict (agent commonly needs blocked tool)
- Scope patterns commonly conflict (adjust typical boundaries)
- Instructions unclear or incomplete

**Bad reasons:**
- One-off project needs specific variation (customize at Phase 1 instead)
- Personal preference without user feedback

### Modification Process

1. **Test current behavior** - Document what works/doesn't work
2. **Make minimal change** - Change only what's necessary
3. **Update documentation** - Update this guide if scope patterns change
4. **Test with new projects** - Verify change works for fresh projects
5. **Update version** - If breaking change, note in plugin changelog

### Example: Adding WebFetch to Backend Template

**Scenario:** Backend agents commonly need to call external APIs for validation.

**Change:**

```diff
--- a/templates/agents/backend.md
+++ b/templates/agents/backend.md
@@ -8,6 +8,7 @@ tools:
   - Bash
   - Glob
   - Grep
+  - WebFetch
 disallowedTools:
-  - WebFetch
   - WebSearch
```

**Update instructions:**

```diff
@@ -30,7 +30,7 @@

 ## Responsibilities

-- **Implement API endpoints** according to specs...
+- **Implement API endpoints** including external API integrations when specified...
+- **Call external services** using WebFetch for validation, enrichment, or third-party integrations as documented in tech spec.
```

**Test:** Create new project with external API requirement, verify backend agent can call APIs.

---

## Scope Boundaries Best Practices

### Glob Pattern Design

**Principles:**
1. **Specific over broad** - `src/api/**` not `src/**`
2. **Explicit over implicit** - List specific subdirs rather than allowing entire tree
3. **Non-overlapping** - Avoid two agents owning same path
4. **Predictable** - Developers should intuitively know which agent owns which file

### Common Patterns

| Pattern | Matches | Use Case |
|---------|---------|----------|
| `src/api/**` | All files under `src/api/` recursively | Backend API code |
| `src/ui/**` | All files under `src/ui/` recursively | Frontend UI code |
| `tests/**/*.test.ts` | Test files anywhere in tests/ | Test files only |
| `*.config.js` | Config files at root | Root configs |
| `docs/**/*.md` | Markdown files in docs | Documentation |
| `src/*/index.ts` | Index files one level deep | Entry points |
| `.github/workflows/*.yml` | GitHub workflow files | CI workflows |

### Avoiding Conflicts

**Problem:** Two agents need to modify same file (e.g., `src/shared/types.ts`)

**Solutions:**

1. **Read-only for both** - Neither agent writes, coordinate via messaging
2. **Ownership hierarchy** - One agent owns, other requests changes via messaging
3. **Split file** - Create separate files for each agent's concerns
4. **Coordination agent** - Create dedicated agent for shared files

**Example:**

```json
{
  "mamh-backend": {
    "allowedPaths": ["src/api/**"],
    "readablePaths": ["src/shared/**"]
  },
  "mamh-frontend": {
    "allowedPaths": ["src/ui/**"],
    "readablePaths": ["src/shared/**"]
  },
  "mamh-types": {
    "allowedPaths": ["src/shared/**"],
    "readablePaths": ["src/api/**", "src/ui/**"]
  }
}
```

### Testing Scope Boundaries

Use `scope-guard.mjs` to test patterns:

```bash
# Test backend writing to API (should allow)
echo '{"tool_name":"Write","tool_input":{"file_path":"'$(pwd)'/src/api/users.ts"},"agent_name":"mamh-backend"}' \
  | node scripts/scope-guard.mjs

# Test backend writing to UI (should block)
echo '{"tool_name":"Write","tool_input":{"file_path":"'$(pwd)'/src/ui/App.tsx"},"agent_name":"mamh-backend"}' \
  | node scripts/scope-guard.mjs
```

---

## Examples

### Example 1: Simple Backend Agent

**Project:** REST API for task management

**Agent Config (from registry.json):**
```json
{
  "mamh-backend": {
    "allowedPaths": [
      "src/api/**",
      "src/db/**",
      "tests/api/**"
    ],
    "readablePaths": [
      "src/shared/**",
      ".mamh/**"
    ],
    "forbiddenPaths": [
      "src/ui/**",
      "public/**"
    ]
  }
}
```

**Generated Agent File (`.claude/agents/mamh-backend.md`):**

```markdown
---
name: mamh-backend
description: "Backend implementation — APIs, server logic, database for TaskMaster Pro"
model: sonnet
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
disallowedTools:
  - WebFetch
  - WebSearch
memory: project
---

# mamh-backend — Backend Engineer

You are the backend engineer for **TaskMaster Pro**. You own all server-side code...

## Work Scope

### Allowed Paths (read + write)
- src/api/**
- src/db/**
- tests/api/**

### Read-Only Paths (read only, no modifications)
- src/shared/**
- .mamh/**

### Forbidden Paths (do not read or modify)
- src/ui/**
- public/**

## Constraints

- Must use PostgreSQL for database
- All endpoints require JWT authentication
- Rate limiting: 100 requests per minute per user

### Standing Constraints
- Never commit secrets...
```

### Example 2: Specialized ML Engineer (Runtime Provisioning)

**Scenario:** Project initially had backend/frontend agents. Milestone 3 introduces ML features.

**Gap Detection:**
- Ticket M3-T005: "Implement recommendation engine"
- No existing agent has ML expertise or owns `src/ml/**`

**Provisioning Process:**

1. Orchestrator detects gap
2. Checks `agentApprovalMode`: `suggest`
3. Proposes to user:
   > "Ticket M3-T005 requires ML expertise. I recommend creating a new agent:
   > - **Role**: ML Engineer
   > - **Scope**: `src/ml/**`, `models/**`, `tests/ml/**`
   > - **Model**: Opus (complex reasoning)
   >
   > Approve?"

4. User approves
5. Orchestrator reads template (creates new or adapts backend template)
6. Substitutes placeholders:
   - `{{PROJECT_NAME}}` → "TaskMaster Pro"
   - `{{AGENT_NAME}}` → "mamh-ml"
   - `{{ALLOWED_PATHS}}` → "- src/ml/**\n- models/**\n- tests/ml/**"
   - `{{READ_ONLY_PATHS}}` → "- src/api/**\n- src/shared/**"
   - `{{FORBIDDEN_PATHS}}` → "- src/ui/**"
   - `{{CONSTRAINTS}}` → (from constraints.md)

7. Writes `.claude/agents/mamh-ml.md`
8. Updates registry:
   ```json
   {
     "mamh-ml": {
       "allowedPaths": ["src/ml/**", "models/**", "tests/ml/**"],
       "readablePaths": ["src/api/**", "src/shared/**"],
       "forbiddenPaths": ["src/ui/**"],
       "status": "active",
       "created": "runtime",
       "reason": "ML features in Milestone 3",
       "createdAt": "2026-02-08T15:30:00Z"
     }
   }
   ```

9. Spawns agent, assigns M3-T005

---

## See Also

- [README.md](./README.md) - Developer guide
- [CONFIGURATION.md](./CONFIGURATION.md) - Configuration reference
- [SKILL.md](../skills/mamh/SKILL.md) - Full workflow specification
