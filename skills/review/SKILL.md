---
name: mamh-review
description: Trigger MAMH review gates on completed tickets. Validates work through auto, peer, or user review. Triggers on "mamh review".
---

# MAMH Review — Phase 4

This skill runs the **full review process** on completed tickets — build checks, test runs, peer review, and/or user approval depending on the configured review mode.

> **Two-layer review model:** The `review-gate.mjs` hook (TaskCompleted event) is a lightweight **completion gate** — it only validates that acceptance criteria checkboxes are checked before allowing a ticket to be marked complete. This skill (`/mamh-review`) runs the **full validation**: build, test, diagnostics, scope checks, and optional peer/user review. In subagent mode, the main session invokes this logic inline during Step 3.2-S.3 of execution.

---

## Prerequisites

1. **Tickets exist.** Verify `.mamh/state/mamh-state.json` shows `phase >= 3`. If not, inform the user:
   > "No completed tickets to review. Run `/mamh-execute` first."
2. **Completed tickets exist.** Scan ticket files in the current milestone for any with `Status: completed` that have not yet been approved. If none found:
   > "No completed tickets pending review. All tickets are either already approved or still in progress."

---

## Phase 4: Review Gates

**Goal:** Validate completed work before marking tickets as approved.

Review gates fire when a ticket transitions to `completed` status. The review process depends on the configured `reviewMode` in `.mamh/session.json`.

### Worktree Context

Each agent works in its own git worktree at `.worktrees/mamh-<agent-id>/`. When reviewing:

- **Build and test checks** must run inside the agent's worktree directory
- **Scope checks** verify files changed within the worktree are within the agent's owned paths
- **Peer reviewers** inspect the agent's worktree and can compare against main: `git diff main...mamh/<agent-id>`
- **User review diffs** should be generated from the worktree branch: `git diff main...mamh/<agent-id> --stat`

### Auto Review (`reviewMode: "auto"`)

Run automated checks inside the agent's worktree (`.worktrees/mamh-<agent-id>/`):

1. **Build check:** Run the project build command in the worktree. Must pass with zero errors.
2. **Test check:** Run the project test suite in the worktree. All tests must pass.
3. **Diagnostics check:** Run LSP diagnostics on files touched by the ticket. Must return zero errors.
4. **Scope check:** Verify all file changes are within the agent's owned paths.

If ALL checks pass: Mark ticket as `approved`.
If ANY check fails: Mark ticket as `rejected`, attach failure details as review notes, return to `in_progress`.

### Peer Review (`reviewMode: "peer"`)

After auto review passes, the peer review mechanism depends on the execution mode. Read `executionMode` from `.mamh/session.json` (default: `"agent-teams"` if env var set, else `"subagents"`).

**Agent Teams mode (`executionMode: "agent-teams"`):**

1. Spawn a reviewer teammate agent (use a different agent than the one that wrote the code).
2. The reviewer examines the items listed below.
3. Reviewer outputs: `approved` with optional suggestions, or `rejected` with required changes.
4. If rejected, the original agent receives the feedback via SendMessage and reworks the ticket.

**Subagent mode (`executionMode: "subagents"`):**

1. Dispatch a reviewer via the Task tool with `subagent_type: "general-purpose"` and `model: "opus"`.
2. The reviewer Task prompt includes: ticket content, files changed (git diff), acceptance criteria, and POLICY rules.
3. Reviewer outputs: `approved` or `rejected` with feedback, written to `.mamh/comms/<ticket-id>-review-output.md`.
4. If rejected, the main session re-dispatches the original agent with the reviewer's feedback included in the prompt.

**In both modes, the reviewer examines:**
- Code quality and style consistency
- Acceptance criteria satisfaction
- Edge cases and error handling
- Integration with adjacent components

### User Review (`reviewMode: "user"`)

After auto review (and optionally peer review) passes:

1. Flag the ticket for human approval.
2. Present the user with:
   - Summary of changes (files modified, lines added/removed)
   - Acceptance criteria checklist
   - Any reviewer notes
3. User can: `approve`, `reject` (with feedback), or `skip` (approve and move on).

### After Approval — State Mutation

After marking a ticket as approved (in any review mode), perform these state updates:

1. **Update ticket file:** Set `**Status:** approved` and add `**ApprovedAt:** <ISO timestamp>` in the ticket's metadata header.
2. **Write review result** to `.mamh/reviews/<ticket-id>-review.json` (see format below).
3. **Update agent stats** in `.mamh/agents/registry.json`: increment `ticketsCompleted` (+1), decrement `ticketsAssigned` (-1) for the owning agent.
4. **Update state file** `.mamh/state/mamh-state.json`: adjust `ticketsSummary` counts (decrement `completed`, increment `approved` or move to the appropriate bucket).
5. **Update HANDOFF.md** with a line noting the ticket approval.
6. **Check milestone completion:** Are ALL tickets in the current milestone now `approved`?
   - If YES → trigger milestone completion (invoke `/mamh-next` or proceed inline).
   - If NO → continue with remaining tickets.

### Review Artifacts

Write review results to `.mamh/reviews/<ticket-id>-review.json`:
```json
{
  "ticketId": "T001",
  "reviewMode": "auto",
  "autoReview": {
    "build": "pass",
    "tests": "pass",
    "diagnostics": "pass",
    "scope": "pass"
  },
  "peerReview": null,
  "userReview": null,
  "result": "approved",
  "reviewedAt": "<ISO timestamp>"
}
```

---

## Error Handling

### Agent Failure During Review

If the reviewer agent fails (crashes, times out, or produces invalid output):

1. Mark the ticket as `failed` with error details in review notes.
2. Log the failure to `.mamh/logs/errors/<ticket-id>-error.md`.
3. Attempt recovery:
   - If the failure is transient (timeout, rate limit): retry once.
   - If the failure is persistent: reassign to a different reviewer agent or escalate to a higher model tier.
   - If no recovery is possible: mark as `blocked` and notify the user.
