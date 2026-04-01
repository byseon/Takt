---
name: takt-review
description: Trigger Takt review gates on completed tickets. Validates work through auto, peer, or user review. Triggers on "takt review".
---

# Takt Review — Phase 4

This skill runs the **full review process** on completed tickets — build checks, test runs, peer review, and/or user approval depending on the configured review mode.

> **Two-layer review model:** The `review-gate.mjs` script is a lightweight **completion gate** — invoked programmatically by the orchestrator, it validates that acceptance criteria checkboxes are checked before allowing a ticket to be marked complete. This skill (`/takt-review`) runs the **full validation**: build, test, diagnostics, scope checks, and optional peer/user review. In subagent mode, the main session invokes this logic inline during Step 3.2-S.3 of execution.

---

## Prerequisites

1. **Tickets exist.** Verify `.takt/state/takt-state.json` shows `phase >= 3`. If not, inform the user:
   > "No completed tickets to review. Run `/takt-execute` first."
2. **Completed tickets exist.** Scan ticket files in the current milestone for any with `Status: completed` that have not yet been approved. If none found:
   > "No completed tickets pending review. All tickets are either already approved or still in progress."

---

## Phase 4: Review Gates

**Goal:** Validate completed work before marking tickets as approved.

Review gates fire when a ticket transitions to `completed` status. The review process depends on the configured `reviewMode` in `.takt/session.json`.

### Worktree Context

Each agent works in its own git worktree at `.worktrees/takt-<agent-id>/`. When reviewing:

- **Build and test checks** must run inside the agent's worktree directory
- **Scope checks** verify files changed within the worktree are within the agent's owned paths
- **Peer reviewers** inspect the agent's worktree and can compare against main: `git diff main...takt/<agent-id>`
- **User review diffs** should be generated from the worktree branch: `git diff main...takt/<agent-id> --stat`

### Auto Review (`reviewMode: "auto"`)

Run automated checks inside the agent's worktree (`.worktrees/takt-<agent-id>/`):

1. **Build check:** Run the project build command in the worktree. Must pass with zero errors.
2. **Test check:** Run the project test suite in the worktree. All tests must pass.
3. **Diagnostics check:** Run LSP diagnostics on files touched by the ticket. Must return zero errors.
4. **Scope check:** Verify all file changes are within the agent's owned paths.

If ALL checks pass: Mark ticket as `approved`.
If ANY check fails: Mark ticket as `rejected`, attach failure details as review notes, return to `in_progress`.

### Peer Review (`reviewMode: "peer"`)

After auto review passes, the peer review mechanism depends on the execution mode. Read `executionMode` from `.takt/session.json` (default: `"agent-teams"` if env var set, else `"subagents"`).

**Agent Teams mode (`executionMode: "agent-teams"`):**

1. Assign the review to the **takt-reviewer** teammate (a permanent team member, always present — do NOT spawn a new agent).
2. The reviewer examines the items listed below.
3. Reviewer outputs: `approved` with optional suggestions, or `rejected` with required changes.
4. If rejected, the original agent receives the feedback via SendMessage and reworks the ticket.

**Subagent mode (`executionMode: "subagents"`):**

1. Dispatch a reviewer via the Task tool with `subagent_type: "general-purpose"` and `model: "opus"`.
2. The reviewer Task prompt includes: ticket content, files changed (git diff), acceptance criteria, and POLICY rules.
3. Reviewer outputs: `approved` or `rejected` with feedback, written to `.takt/comms/<ticket-id>-review-output.md`.
4. If rejected, the main session re-dispatches the original agent with the reviewer's feedback included in the prompt.

**In both modes, the reviewer examines:**
- Code quality and style consistency
- Acceptance criteria satisfaction
- Edge cases and error handling
- Integration with adjacent components

### Cross-Model Review (Dual Reviewer Dispatch)

When `crossModelReview: true` in `.takt/session.json` AND `codexAvailable: true`, the review phase dispatches TWO parallel reviewers instead of one:

**Subagents Mode:**
1. **Opus Reviewer**: `Task(model="opus", prompt=<review prompt with changed files, acceptance criteria, POLICY rules>)`
2. **Codex Reviewer**: `ask_codex(agent_role="code-reviewer", prompt=<review prompt>, context_files=<changed file paths>, background=true, working_directory=<agent worktree path>)`
3. Wait for both to complete. Use `wait_for_job` for the Codex reviewer.

**Agent Teams Mode:**
1. **Opus Reviewer**: `SendMessage` to permanent `takt-reviewer` teammate with review request
2. **Codex Reviewer**: Orchestrator calls `ask_codex` directly with `agent_role="code-reviewer"`
3. Collect both results before proceeding to synthesis.

**Fallback:** If `codexAvailable: false` or `ask_codex` fails, fall back to single Opus reviewer (existing behavior) and log a warning.

### Severity Classification

Each reviewer assigns one of four severity levels to every finding:

| Level | Definition | Blocks Approval? |
|-------|-----------|-----------------|
| CRITICAL | Security vulnerability, data loss risk, crash/panic | Yes |
| HIGH | Incorrect behavior, failing tests, broken API contract | Yes |
| MEDIUM | Code smell, missing edge case, suboptimal performance | No |
| LOW | Style suggestion, naming preference, minor refactoring | No |

Reviewers assign severity independently. The synthesis step preserves original severity ratings.

### Review Synthesis

**Ownership:**
- **Subagents mode**: Main session performs synthesis inline
- **Agent Teams mode**: `takt-reviewer` agent performs synthesis (has Bash access for file writing)

**Synthesis Algorithm:**
1. Collect all findings from Opus reviewer and Codex reviewer
2. Deduplicate: findings targeting the same file + line range + issue type are merged (keep the higher severity)
3. Tag each finding with its source: `[Opus]`, `[Codex]`, or `[Both]` (if both reviewers found it)
4. Sort by severity descending (CRITICAL first)
5. Generate summary counts: `{ critical: N, high: N, medium: N, low: N }`

**Review Artifact** — write to `.takt/reviews/<ticket-id>-review.json`:
```json
{
  "crossModelReview": {
    "enabled": true,
    "rounds": [
      {
        "round": 1,
        "opusFindings": [
          { "file": "src/auth.ts", "line": 42, "severity": "HIGH", "issue": "Missing null check" }
        ],
        "codexFindings": [
          { "file": "src/auth.ts", "line": 40, "severity": "CRITICAL", "issue": "SQL injection risk" }
        ],
        "synthesized": [
          { "file": "src/auth.ts", "line": 40, "severity": "CRITICAL", "issue": "SQL injection risk", "source": "Codex" },
          { "file": "src/auth.ts", "line": 42, "severity": "HIGH", "issue": "Missing null check", "source": "Opus" }
        ],
        "summary": { "critical": 1, "high": 1, "medium": 0, "low": 0 }
      }
    ],
    "finalVerdict": "approved",
    "totalRounds": 1
  }
}
```

**Side-by-Side Comparison** — write to `.takt/reviews/<ticket-id>-comparison.md`:

| # | Opus Finding | Codex Finding | Severity | Source |
|---|-------------|---------------|----------|--------|
| 1 | — | SQL injection in auth.ts:40 | CRITICAL | Codex only |
| 2 | Missing null check auth.ts:42 | — | HIGH | Opus only |

This comparison table provides transparency into what each model caught independently.

### Re-Review Loop

After synthesis, run the severity gate to determine if the ticket passes:

**Loop Protocol:**
```
maxRounds = session.maxReviewRounds || 3
round = 1

LOOP:
  1. Dispatch dual reviewers (see Cross-Model Review Dispatch above)
  2. Synthesize findings (see Review Synthesis above)
  3. Run severity gate: `echo '{"ticketId":"<id>"}' | node scripts/review-severity-gate.mjs`
  4. IF gate passes (exit 0) → mark ticket `approved`, write final verdict to review JSON, EXIT
  5. IF round >= maxRounds:
     - IF any CRITICAL remaining → mark ticket `blocked`, escalate to user with finding details
     - IF only HIGH remaining → mark ticket `approved-with-warnings`, log unresolved HIGH findings
     - EXIT
  6. Generate fix instructions from all CRITICAL and HIGH findings in the synthesized list
  7. Dispatch the original agent to apply fixes (use same backend as the ticket)
  8. round++, GOTO LOOP
```

**Between rounds:** When dispatching reviewers for round > 1, include the previous round's synthesized findings in the review prompt. Instruct reviewers to:
- Verify that previously identified CRITICAL/HIGH issues have been fixed
- Check for NEW issues introduced by the fixes
- Do NOT re-report MEDIUM/LOW findings from prior rounds

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
2. **Write review result** to `.takt/reviews/<ticket-id>-review.json` (see format below).
3. **Update agent stats** in `.takt/agents/registry.json`: increment `ticketsCompleted` (+1), decrement `ticketsAssigned` (-1) for the owning agent.
4. **Update state file** `.takt/state/takt-state.json`: adjust `ticketsSummary` counts (decrement `completed`, increment `approved` or move to the appropriate bucket).
5. **Update HANDOFF.md** with a line noting the ticket approval.
6. **Check milestone completion:** Are ALL tickets in the current milestone now `approved`?
   - If YES → trigger milestone completion (invoke `/takt-next` or proceed inline).
   - If NO → continue with remaining tickets.

### Review Artifacts

Write review results to `.takt/reviews/<ticket-id>-review.json`:
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

## Evidence-Based Review (Optional)

This section only activates when `.takt/config.yaml` exists with `review.require_validation: true`.

### Validation Artifact Check

When evidence-based review is enabled, the review process includes an additional check:

1. **Check for validation artifacts:** Verify that `.takt/artifacts/ticket/<ticket-id>/logs/` contains validation log files.
2. **If artifacts are missing:**
   - In `auto` mode: Automatically run `takt-validate --mode ticket --id <ticket-id>` before proceeding with review.
   - In `peer` mode: Note the missing artifacts in the review request to the reviewer agent.
   - In `user` mode: Flag the missing artifacts in the review summary presented to the user.
3. **If artifacts exist:** Include a validation summary in the review output, noting pass/fail counts.

### Configuration

To enable evidence-based review, create or edit `.takt/config.yaml`:

```yaml
review:
  require_validation: true      # Require validation artifacts for review-gate
  require_test_artifacts: false  # Require test output artifacts (future)
```

When disabled (default), the review process works exactly as before — no behavioral change.

---

## Error Handling

### Agent Failure During Review

If the reviewer agent fails (crashes, times out, or produces invalid output):

1. Mark the ticket as `failed` with error details in review notes.
2. Log the failure to `.takt/logs/errors/<ticket-id>-error.md`.
3. Attempt recovery:
   - If the failure is transient (timeout, rate limit): retry once.
   - If the failure is persistent: reassign to a different reviewer agent or escalate to a higher model tier.
   - If no recovery is possible: mark as `blocked` and notify the user.
