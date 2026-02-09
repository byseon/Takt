---
name: review
description: Trigger MAMH review gates on completed tickets. Validates work through auto, peer, or user review. Triggers on "mamh review".
---

# MAMH Review — Phase 4

This skill triggers review gates on completed tickets. The review process validates work before marking tickets as approved, using the configured review mode (auto, peer, or user).

---

## Prerequisites

1. **Tickets exist.** Verify `.mamh/state/mamh-state.json` shows `phase >= 3`. If not, inform the user:
   > "No completed tickets to review. Run `/mamh:execute` first."
2. **Completed tickets exist.** Scan ticket files in the current milestone for any with `Status: completed` that have not yet been approved. If none found:
   > "No completed tickets pending review. All tickets are either already approved or still in progress."

---

## Phase 4: Review Gates

**Goal:** Validate completed work before marking tickets as approved.

Review gates fire when a ticket transitions to `completed` status. The review process depends on the configured `reviewMode` in `.mamh/state/session.json`.

### Auto Review (`reviewMode: "auto"`)

Run automated checks:

1. **Build check:** Run the project build command. Must pass with zero errors.
2. **Test check:** Run the project test suite. All tests must pass.
3. **Diagnostics check:** Run LSP diagnostics on files touched by the ticket. Must return zero errors.
4. **Scope check:** Verify all file changes are within the agent's owned paths.

If ALL checks pass: Mark ticket as `approved`.
If ANY check fails: Mark ticket as `rejected`, attach failure details as review notes, return to `in_progress`.

### Peer Review (`reviewMode: "peer"`)

After auto review passes:

1. Spawn a reviewer teammate agent (use a different agent than the one that wrote the code).
2. The reviewer examines:
   - Code quality and style consistency
   - Acceptance criteria satisfaction
   - Edge cases and error handling
   - Integration with adjacent components
3. Reviewer outputs: `approved` with optional suggestions, or `rejected` with required changes.
4. If rejected, the original agent receives the feedback and reworks the ticket.

### User Review (`reviewMode: "user"`)

After auto review (and optionally peer review) passes:

1. Flag the ticket for human approval.
2. Present the user with:
   - Summary of changes (files modified, lines added/removed)
   - Acceptance criteria checklist
   - Any reviewer notes
3. User can: `approve`, `reject` (with feedback), or `skip` (approve and move on).

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
