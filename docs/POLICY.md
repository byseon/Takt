# POLICY.md — Shared Agent Policy System

This document explains the MAMH shared policy system: what it is, how it works, and how to customize it.

---

## What Is POLICY.md?

POLICY.md is a shared rulebook that governs the behavior of ALL agents in a MAMH project. It defines communication protocols, file ownership rules, code standards, ticket workflow, review requirements, safety constraints, and session procedures.

Every agent reads POLICY.md at the start of every session and follows its rules throughout execution. It is the single source of truth for "how we work together" within a project.

Think of it as a team charter for AI agents. Humans have engineering handbooks and onboarding docs; MAMH agents have POLICY.md.

---

## How It Gets Generated

POLICY.md is generated during **Phase 0 (Planning Interview)** of the MAMH lifecycle, after the PRD, tech spec, and constraints have been established.

### Generation Flow

```
1. User triggers MAMH with a project description
2. Phase 0 runs: analyst expands requirements, architect creates tech spec
3. User answers planning interview questions (constraints, tech stack, review mode)
4. MAMH reads the template from:
     ${CLAUDE_PLUGIN_ROOT}/templates/POLICY.md
5. MAMH substitutes placeholders with project-specific content:
     {{PROJECT_NAME}}      <-- derived from project description
     {{TIMESTAMP}}         <-- current ISO timestamp
     {{AGENT_ROSTER}}      <-- generated from registry.json after Phase 1
     {{CONSTRAINTS}}       <-- from user interview + constraints.md
     {{TECHNOLOGY_STACK}}  <-- from tech spec + user preferences
     {{CODE_STANDARDS}}    <-- detected from codebase or user-specified
6. The customized file is written to:
     .mamh/POLICY.md
```

The `{{AGENT_ROSTER}}` placeholder is filled after Phase 1 (Agent Definition) completes, since the roster is not known until agents are defined. POLICY.md may be written in two passes: once with partial content after Phase 0, and updated with the full roster after Phase 1.

### Placeholder Reference

| Placeholder | Source | Example Value |
|-------------|--------|---------------|
| `{{PROJECT_NAME}}` | Derived from user's project description | `TaskFlow API` |
| `{{TIMESTAMP}}` | Generation time | `2026-02-08T14:30:00Z` |
| `{{AGENT_ROSTER}}` | `.mamh/agents/registry.json` | Table of agent IDs, roles, owned paths |
| `{{CONSTRAINTS}}` | User interview answers + `.mamh/constraints.md` | `- Must use PostgreSQL\n- No external API calls` |
| `{{TECHNOLOGY_STACK}}` | Tech spec + user preferences | `- Runtime: Node.js 20\n- Framework: Express` |
| `{{CODE_STANDARDS}}` | Detected from codebase or user-specified | `- Use ESLint with Airbnb config\n- Prefer async/await` |

---

## Where It Lives

### Template Location (in the plugin repository)

```
templates/POLICY.md
```

This is the canonical template that ships with the MAMH plugin. It contains all placeholder variables and the full structure of sections. It is never modified at runtime.

### Per-Project Location (generated per project)

```
.mamh/POLICY.md
```

This is the customized, project-specific version. It lives inside the `.mamh/` directory alongside other project state files. Each MAMH project gets its own copy with its own content.

---

## How Agents Use It

Every agent follows the **Session Protocol** defined in Section 10 of POLICY.md. The first step of every session is:

```
1. Read .mamh/POLICY.md
2. Read .mamh/state/mamh-state.json
3. Read .mamh/state/session.json
4. Read assigned tickets
5. Check for unread messages
6. Resume or claim work
```

Agents treat POLICY.md as authoritative. If an agent's individual instructions (in `.claude/agents/mamh-<id>.md`) conflict with POLICY.md, the policy wins for team-wide rules (communication, workflow, safety) while the agent definition wins for role-specific rules (allowed paths, tools, responsibilities).

### What Agents Get From POLICY.md

| Section | What Agents Learn |
|---------|-------------------|
| Agent Identity & Scope | Who they are, what files they own, how to check ownership |
| Communication Protocol | How to message other agents, format, urgency levels |
| File Ownership | Rules for modifying shared files, conflict resolution |
| Code Standards | Project conventions, commit hygiene, dependency rules |
| Ticket Workflow | Lifecycle states, claiming rules, definition of done |
| Review Requirements | What checks must pass before a ticket is accepted |
| Constraints | Hard rules that cannot be violated |
| Technology Stack | Approved technologies, no unauthorized additions |
| Safety & Security | Security rules that apply to all agents at all times |
| Session Protocol | What to do at session start and end |
| Error Handling | How to diagnose, retry, and escalate problems |
| Coordination Patterns | Recipes for common multi-agent interactions |

---

## How Users Can Customize It

Users have two customization points:

### 1. Customize the Template (affects all future projects)

Edit `templates/POLICY.md` in the plugin repository. This changes the policy for every new project initialized with MAMH going forward. Existing projects are not affected.

Common template customizations:
- Add company-specific coding standards to Section 4
- Add organization security policies to Section 9
- Modify the review requirements in Section 6
- Add custom coordination patterns to Section 12
- Change the ticket workflow states in Section 5

### 2. Customize the Generated File (affects one project)

Edit `.mamh/POLICY.md` directly in the project directory. This changes the policy for that specific project only.

Common per-project customizations:
- Tighten constraints for a security-sensitive project
- Relax review requirements for a rapid prototype
- Add project-specific coordination rules between specific agents
- Update the technology stack as decisions evolve
- Add new sections for project-specific concerns

**Important:** If you edit the generated file, your changes persist across sessions. Agents re-read the file at every session start, so changes take effect immediately.

### What NOT to Customize

Avoid removing or weakening:
- The Safety & Security section (Section 9). These rules prevent destructive mistakes.
- The Session Protocol (Section 10). Agents rely on this to initialize correctly.
- The Ticket Workflow lifecycle (Section 5). The orchestrator and review gates depend on these state transitions.

---

## How the Orchestrator Updates It

The orchestrator can append new rules to POLICY.md during execution. This happens in specific scenarios:

### When New Rules Are Added

| Trigger | What Gets Added | Where |
|---------|----------------|-------|
| A coordination conflict is resolved | New conflict resolution rule | Section 3 |
| A security issue is discovered | New safety rule | Section 9 |
| A new convention emerges from code review | New code standard | Section 4 |
| User requests a policy change mid-project | Whatever the user specifies | Appropriate section |
| Milestone retrospective identifies a process gap | New workflow rule | Appropriate section |

### Update Protocol

When the orchestrator updates POLICY.md:

1. The orchestrator appends the new rule to the appropriate section.
2. The orchestrator updates the `{{TIMESTAMP}}` line at the top of the file.
3. The orchestrator messages ALL agents: `"POLICY.md updated — new rule added to Section N: <summary>"`
4. Agents incorporate the new rule in their current work cycle.

Rules are only appended, never silently removed. If a rule needs to be deprecated, the orchestrator marks it as `[DEPRECATED]` with a reason and replacement, rather than deleting it.

### Programmatic Updates

The init-project script and agent generation scripts may also update POLICY.md:

- `init-project.mjs` writes the initial POLICY.md with partial placeholders.
- After Phase 1 completes, the orchestrator fills in `{{AGENT_ROSTER}}` with the actual roster.
- If agents are added or removed mid-project (dynamic provisioning), the roster section is updated to reflect the current team.

---

## Relationship to the Napkin Pattern

MAMH's POLICY.md is inspired by the **napkin pattern** (persistent learning files that accumulate knowledge over time) but serves a different purpose:

| Aspect | Napkin Files | POLICY.md |
|--------|-------------|-----------|
| **Scope** | Individual agent | All agents in the team |
| **Content** | Personal learnings, heuristics, discovered patterns | Team-wide rules, protocols, constraints |
| **Growth** | Organic (agents add learnings as they discover them) | Structured (orchestrator adds rules at defined points) |
| **Authority** | Advisory (suggestions for the agent's own behavior) | Authoritative (mandatory rules all agents must follow) |
| **Persistence** | Across sessions for one agent | Across sessions for all agents |
| **Location** | Agent-specific memory files | `.mamh/POLICY.md` (shared) |

### How They Complement Each Other

- **POLICY.md** says: "Here is how we work together as a team."
- **Agent napkin/memory** says: "Here is what I have learned about my specific domain."

An agent's personal learnings (e.g., "the database connection pool needs at least 10 connections for this workload") do not belong in POLICY.md. They belong in the agent's project memory or ticket notes.

Team-wide rules (e.g., "all API responses must include a `requestId` header for tracing") belong in POLICY.md so every agent follows them consistently.

### Promotion Path

Sometimes an individual agent's learning becomes a team-wide rule. The promotion path is:

```
Agent discovers pattern --> Notes it in ticket notes / learnings
   --> Orchestrator sees it during milestone review
      --> If broadly applicable: promoted to POLICY.md
      --> If agent-specific: stays in agent memory
```

This ensures POLICY.md stays focused on team-wide concerns while agents retain domain-specific knowledge in their own memory.

---

## File Structure Within .mamh/

For reference, here is where POLICY.md sits relative to other MAMH state files:

```
.mamh/
  POLICY.md                  <-- THIS FILE (generated, shared rulebook)
  prd.md                     # Product Requirements Document
  tech-spec.md               # Technical Specification
  constraints.md             # Hard constraints and preferences
  state/
    mamh-state.json          # Current operational state
    session.json             # Session configuration
  agents/
    registry.json            # Agent roster with path boundaries
  tickets/
    milestones/              # Active milestone ticket files
    archive/                 # Completed milestone tickets
  reviews/                   # Review results per ticket
  comms/
    decisions.md             # Architectural decision log
    changelog.md             # Notable changes log
  logs/
    coordination/            # Agent-to-agent message logs
    errors/                  # Error and failure logs
    scope-violations.md      # Scope enforcement log
```

---

## Summary

| Question | Answer |
|----------|--------|
| What is it? | A shared rulebook for all MAMH agents in a project |
| Where is the template? | `templates/POLICY.md` in the plugin repo |
| Where is the generated file? | `.mamh/POLICY.md` in each project |
| When is it created? | During Phase 0 (Planning Interview) |
| Who reads it? | Every agent, at the start of every session |
| Who writes it? | The orchestrator (generated from template + project details) |
| Who can update it? | The orchestrator (during execution) or the user (manually) |
| How is it different from napkin? | Team-wide rules vs. individual agent learnings |
