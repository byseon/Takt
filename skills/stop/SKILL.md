---
name: takt-stop
description: Gracefully stop the Takt session, save state, and shut down execution. Triggers on "takt stop".
---

# Takt Stop — Stop Protocol

This skill gracefully shuts down execution (Agent Teams or subagent dispatch), saves the current state, and marks in-progress tickets as pending so they can be resumed later with `/takt-resume`.

---

## Prerequisites

1. **Takt session is active.** Verify `.takt/state/takt-state.json` exists and `status` is not `stopped` or `project-complete`. If the state file does not exist:
   > "No Takt session found. Nothing to stop."
   If already stopped:
   > "Takt session is already stopped. Use `/takt-resume` to continue."

---

## Stop Protocol

### Steps

1. **Save current state:** Update `.takt/state/takt-state.json` with:
   ```json
   {
     "phase": "<current phase>",
     "status": "stopped",
     "stoppedAt": "<ISO timestamp>",
     "activeTickets": ["<list of in-progress ticket IDs>"],
     "lastUpdated": "<ISO timestamp>"
   }
   ```

2. **Shut down execution (mode-dependent):**

   Read `executionMode` from `.takt/session.json` (default: `"agent-teams"` if env var set, else `"subagents"`).

   **Agent Teams mode (`executionMode: "agent-teams"`):**
   - Signal all teammate agents to stop after their current operation completes.
   - Do NOT interrupt mid-file-write operations.
   - Wait for agents to acknowledge stop (with a 30-second timeout).

   **Subagent mode (`executionMode: "subagents"`):**
   - Stop dispatching new Task batches. Do NOT dispatch the next batch.
   - Allow any currently running Task subagents to complete (they are atomic — cannot be interrupted mid-execution).
   - Collect results from any completed Tasks before saving state.

3. **Mark in-progress tickets:** Set any `in_progress` tickets back to `pending` so they can be re-claimed on resume.

4. **Preserve git worktrees:** Do NOT remove `.worktrees/` or delete agent branches. Worktrees contain uncommitted work that agents need when resuming. Each agent's worktree at `.worktrees/takt-<agent-id>/` and branch `takt/<agent-id>` must remain intact for `/takt-resume`.

5. **Update HANDOFF.md:** Update `.takt/HANDOFF.md` with current progress, in-progress work, and clear resume instructions under Next Steps.

6. **Write stop summary:**
   > "Takt session stopped and state saved. Progress:"
   > - "Milestone: M00X - <name>"
   > - "Tickets completed: X / Y"
   > - "Use `/takt-resume` to continue."

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
  "name": "my-project",
  "description": "A project description",
  "phase": 3,
  "currentMilestone": "M001",
  "executionMode": "agent-teams",
  "agentApprovalMode": "suggest",
  "milestoneAdvanceMode": "user-decides",
  "reviewMode": "auto",
  "milestoneGranularity": "medium",
  "createdAt": "2026-02-08T12:00:00.000Z",
  "updatedAt": "2026-02-08T15:30:00.000Z"
}
```
