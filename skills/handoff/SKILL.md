---
name: mamh-handoff
description: Update the MAMH handoff document with current project state, progress, decisions, and next steps. Triggers on "mamh handoff", "update handoff".
---

# MAMH Handoff — Update Handoff Document

This skill reads all current project state and generates a comprehensive `.mamh/HANDOFF.md` that captures everything needed for session continuity.

---

## Prerequisites

1. **MAMH project exists.** Verify `.mamh/state/mamh-state.json` exists. If not:
   > "No MAMH session found. Use `/mamh-plan` to start a new project."

---

## Steps

### Step 1 — Read All State

Read the following files to build a complete picture:

1. `.mamh/state/mamh-state.json` — current phase, milestone, ticket summary
2. `.mamh/session.json` — project name, execution mode, configuration
3. `.mamh/agents/registry.json` — agent roster, stats, scopes
4. `.mamh/HANDOFF.md` — existing handoff (preserve Milestone History)
5. `.mamh/comms/decisions.md` — key decisions made
6. `.mamh/comms/changelog.md` — completed work log
7. `.mamh/prd.md` — product requirements (read first 50 lines for summary)
8. `.mamh/constraints.md` — project constraints

Also read:
- All ticket files in the current milestone: `.mamh/tickets/milestones/<current-milestone>/`
- Milestone metadata: `.mamh/tickets/milestones/<current-milestone>/_milestone.json`
- Any milestone summaries in `.mamh/logs/M*-summary.md`

### Step 2 — Generate HANDOFF.md

Rewrite `.mamh/HANDOFF.md` using the template below. Preserve the **Milestone History** section from the existing file — append to it, never truncate.

```markdown
# MAMH Handoff

> Auto-updated by MAMH. Last updated: <ISO timestamp>

## Project Overview

**Project:** <project name>
**Phase:** <current phase name> (Phase <N>)
**Execution Mode:** <agent-teams | subagents>
**Current Milestone:** <milestone ID> — <milestone name>

## What Has Been Done

<Bulleted list of completed milestones and approved tickets in current milestone. Be specific — list features delivered, not just ticket IDs.>

## In Progress

<Bulleted list of tickets currently in_progress or pending in the current milestone. Include ticket ID, title, assigned agent, and status.>

## Agent Roster

| Agent | Model | Assigned | Done | Status |
|-------|-------|----------|------|--------|
| <agent-id> | <model> | <N> | <N> | <active/idle> |

## Key Decisions & Rationale

<Numbered list of significant decisions from decisions.md. Include the rationale for each.>

## Architecture & Patterns

<Brief summary of key architectural patterns established so far — framework choices, folder structure conventions, shared interfaces, etc.>

## Next Steps

<Ordered list of what needs to happen next. Be actionable — "Approve T005, then dispatch Batch 3" not "Continue working".>

## Open Questions / Blockers

<List any unresolved questions, blocked tickets, or issues requiring user input. If none, write "(none)".>

## Milestone History

<Preserve all previous milestone entries. Each entry follows the format below.>

### M001 — <name> (Completed <date>)
**Tickets:** <N>/<N> approved
**Agents:** <agent list>
**Delivered:** <bullet list of features>
**Issues:** <bullet list of issues encountered, or "(none)">
```

### Step 3 — Confirm

After writing, display a brief summary:

> "HANDOFF.md updated. Phase <N>, Milestone <ID>, <X>/<Y> tickets approved."
