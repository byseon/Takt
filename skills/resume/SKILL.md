---
name: resume
description: Resume an interrupted MAMH session from the last saved state. Triggers on "mamh resume".
---

# MAMH Resume — Resume Protocol

This skill resumes an interrupted MAMH session. It reads the saved state, determines the correct resume point, restores Agent Teams if needed, and continues execution.

---

## Prerequisites

1. **Agent Teams is enabled.** The environment variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` must be set. If it is not, inform the user:
   > "MAMH requires Claude Code Agent Teams. Please enable it by setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in your environment, then try again."

---

## Resume Protocol

### Steps

1. **Read state:** Load `.mamh/state/mamh-state.json`. If it does not exist, inform the user:
   > "No MAMH session found. Use `/mamh:plan` to start a new project."

2. **Validate state:** Check that the state file contains valid phase and status fields.

3. **Determine resume point:** Based on the saved phase and status:

   | Saved Phase | Saved Status | Resume Action |
   |-------------|-------------|---------------|
   | 0 | `planning-complete` | Continue to Phase 1 |
   | 1 | `agents-defined` | Continue to Phase 2 |
   | 2 | `tickets-generated` | Continue to Phase 3 |
   | 3 | `executing` | Re-launch Agent Teams, resume ticket execution |
   | 4 | `reviewing` | Resume review cycle |
   | 5 | `milestone-complete` | Run advance decision |
   | 5 | `project-complete` | Inform user project is already complete |
   | Any | `stopped` | Resume from the phase indicated |

4. **Restore Agent Teams:** If resuming Phase 3, re-launch Agent Teams with:
   - All agents from `registry.json`
   - Ticket states from ticket files (skip completed/approved tickets)
   - In-progress tickets reset to `pending` (the agent may have lost context)

5. **Announce:**
   > "MAMH session resumed. Continuing from Phase <N>: <phase name>."

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
