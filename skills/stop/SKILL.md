---
name: stop
description: Gracefully stop the MAMH session, save state, and shut down Agent Teams. Triggers on "mamh stop".
---

# MAMH Stop — Stop Protocol

This skill gracefully shuts down Agent Teams, saves the current state, and marks in-progress tickets as pending so they can be resumed later with `/mamh:resume`.

---

## Prerequisites

1. **MAMH session is active.** Verify `.mamh/state/mamh-state.json` exists and `status` is not `stopped` or `project-complete`. If the state file does not exist:
   > "No MAMH session found. Nothing to stop."
   If already stopped:
   > "MAMH session is already stopped. Use `/mamh:resume` to continue."

---

## Stop Protocol

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
   > - "Use `/mamh:resume` to continue."

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
