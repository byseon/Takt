---
name: takt-resume
description: Resume an interrupted Takt session from the last saved state. Triggers on "takt resume".
---

# Takt Resume — Resume Protocol

This skill resumes an interrupted Takt session. It reads the saved state, determines the correct resume point, restores execution (Agent Teams or subagent dispatch) based on `executionMode`, and continues.

---

## Prerequisites

1. **Read execution mode.** Load `.takt/session.json` and read `executionMode`. If missing, default to `"agent-teams"` if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set, otherwise `"subagents"`.
2. **Agent Teams env var (agent-teams mode only).** If `executionMode` is `"agent-teams"`, verify `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If it is not, inform the user:
   > "Agent Teams mode requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Set the env var and retry, or switch to subagent mode by updating `executionMode` in `.takt/session.json`."

---

## Resume Protocol

### Steps

1. **Read HANDOFF.md:** Read `.takt/HANDOFF.md` — this contains the full project context: what's done, key decisions, agent roster, and next steps.

2. **Read state:** Load `.takt/state/takt-state.json`. If it does not exist, inform the user:
   > "No Takt session found. Use `/takt-plan` to start a new project."

3. **Validate state:** Check that the state file contains valid phase and status fields.

4. **Determine resume point:** Based on the saved phase and status:

   | Saved Phase | Saved Status | Resume Action |
   |-------------|-------------|---------------|
   | 0 | `planning-complete` | Continue to Phase 1 |
   | 1 | `agents-defined` | Continue to Phase 2 |
   | 2 | `tickets-generated` | Continue to Phase 3 |
   | 3 | `executing` | Restore execution (mode-dependent — see step 6) |
   | 4 | `reviewing` | Resume review cycle |
   | 5 | `milestone-complete` | Run advance decision |
   | 5 | `project-complete` | Inform user project is already complete |
   | Any | `stopped` | Resume from the phase indicated |

5. **Verify git worktrees:** If resuming Phase 3 or later, check that agent worktrees still exist:
   - Verify `.worktrees/takt-<agent-id>/` directories exist for each agent in `registry.json`
   - Verify agent branches `takt/<agent-id>` exist
   - If worktrees are missing (e.g., manual cleanup), recreate them: `node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.mjs"`
   - If worktrees exist, they contain the agent's prior work — do NOT recreate them

6. **Restore execution (mode-dependent):** If resuming Phase 3:

   **Agent Teams mode (`executionMode: "agent-teams"`):**
   - Re-launch Agent Teams with all agents from `registry.json`
   - Each agent's worktree path (`.worktrees/takt-<agent-id>/`) as their working directory
   - Ticket states from ticket files (skip completed/approved tickets)
   - In-progress tickets reset to `pending` (the agent may have lost context)

   **Subagent mode (`executionMode: "subagents"`):**
   - Rebuild the dependency graph from remaining tickets (skip completed/approved)
   - Reset in-progress tickets to `pending`
   - Recompute parallel batches from the updated dependency graph
   - Resume batch execution from Section B of `/takt-execute`

7. **Announce:**
   > "Takt session resumed. Continuing from Phase <N>: <phase name>."

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
