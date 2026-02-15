---
name: takt-status
description: Show the Takt project dashboard with agent roster, ticket board, and progress. Triggers on "takt status".
---

# Takt Status — Project Dashboard

This skill displays the current Takt project status, including the agent roster, ticket board, milestone progress, and any blockers.

---

## Prerequisites

1. **Takt project exists.** Verify `.takt/state/takt-state.json` exists. If not:
   > "No Takt session found. Use `/takt-plan` to start a new project."

---

## Status Dashboard

Read `.takt/state/takt-state.json`, `session.json`, `registry.json`, and all milestone/ticket files. Display:

```
============================================================
  Takt Status Dashboard
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
  takt-backend        | sonnet |        3 |    2 | working
  takt-frontend       | sonnet |        2 |    1 | working
  takt-test           | sonnet |        1 |    0 | idle
  takt-orchestrator   | opus   |      --- |  --- | coordinating

------------------------------------------------------------
  Tickets (Milestone <current>)
------------------------------------------------------------
  ID    | Title                     | Agent          | Status
  ------|---------------------------|----------------|----------
  T001  | Setup project structure   | takt-backend   | approved
  T002  | Define shared interfaces  | takt-backend   | approved
  T003  | Initialize frontend       | takt-frontend  | in_progress
  T004  | Setup test infra          | takt-test      | pending

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

## State File Reference

All state files live under `.takt/state/`.

### `.takt/state/takt-state.json`

Primary state file. Always reflects current operational status.

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
  "lastUpdated": "2026-02-08T12:00:00.000Z"
}
```

### `.takt/state/session.json`

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
