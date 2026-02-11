---
name: mamh-next
description: Advance to the next MAMH milestone after the current one completes. Triggers on "mamh next".
---

# MAMH Next — Phase 5

This skill handles milestone completion, roster review, and advancement to the next milestone. It runs after all tickets in the current milestone have been approved.

---

## Prerequisites

1. **Current milestone is complete.** Verify all tickets in the current milestone have `approved` status by reading ticket files in `.mamh/tickets/milestones/<current-milestone>/`. If any tickets are not yet approved:
   > "Milestone is not yet complete. X tickets still pending approval. Run `/mamh-review` to review completed tickets."
2. **State file exists.** Verify `.mamh/state/mamh-state.json` exists and shows `phase >= 3`.

---

## Phase 5: Milestone Iteration

**Goal:** Complete milestones sequentially until the project is done.

### Step 5.1 - Milestone Completion

A milestone is complete when ALL of its tickets have `approved` status. When this happens:

1. Move all ticket files from `.mamh/tickets/milestones/<milestone>/` to `.mamh/tickets/archive/<milestone>/`.
2. **Bundle ticket artifacts** into the archive directory alongside the tickets:
   - Move `.mamh/comms/<ticket-id>-output.md` → `.mamh/tickets/archive/<milestone>/<ticket-id>-output.md` for each ticket
   - Move `.mamh/reviews/<ticket-id>-review.json` → `.mamh/tickets/archive/<milestone>/<ticket-id>-review.json` for each ticket
   - Move `.mamh/comms/<ticket-id>-review-output.md` → `.mamh/tickets/archive/<milestone>/` (if peer review was used in subagent mode)
   - This keeps `comms/` and `reviews/` clean — only active milestone artifacts remain there.
3. Update `_milestone.json`: set `status` → `completed`, add `completedAt` → ISO timestamp.
4. Update `mamh-state.json` milestones array entry to reflect completion.
5. Generate a milestone summary in `.mamh/logs/M001-summary.md`:
   - What was delivered
   - Metrics (tickets completed, time elapsed, agents involved)
   - Issues encountered and how they were resolved
   - Learnings for future milestones
6. **Update `.mamh/HANDOFF.md`** — This is a critical step. Perform a FULL handoff update:
   a. Read the existing `.mamh/HANDOFF.md` to preserve Milestone History.
   b. Rewrite the entire file using the current state. Update ALL sections:
      - **What Has Been Done** — add the completed milestone's deliverables
      - **In Progress** — clear completed milestone tickets, show next milestone's tickets
      - **Agent Roster** — updated stats
      - **Next Steps** — what the next milestone requires
      - **Milestone History** — append a new entry:
        ```markdown
        ### <milestone-id> — <name> (Completed <ISO date>)
        **Tickets:** <completed>/<total> approved
        **Agents:** <comma-separated agent list>
        **Delivered:** <bulleted list of features/changes delivered>
        **Issues:** <bulleted list of issues encountered, or "(none)">
        ```
   c. If this is a manual invocation (user ran `/mamh-handoff`), you may also invoke that skill instead.

### Step 5.1b - Git Worktree Merge

After all tickets are approved, merge each agent's worktree branch back into `main`. Run the worktree merge script:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-merge.mjs"
```

This performs the following for each writing agent:

1. **Run tests** in the agent's worktree to confirm passing state
2. **Merge** the agent's branch into main: `git merge mamh/<agent-id> --no-ff -m "M001: merge mamh-<agent-id> changes"`
3. **Resolve conflicts** if any occur (rare due to scope enforcement):
   - Identify which agents' changes conflict
   - Delegate conflict resolution to the agent that owns the conflicting file
   - If ownership is ambiguous, ask the user
4. **Remove worktrees** after successful merge: `git worktree remove .worktrees/mamh-<agent-id>`
5. **Delete branches**: `git branch -d mamh/<agent-id>`

Fresh worktrees are created for the next milestone when `/mamh-execute` runs again (Step 3.0).

### Step 5.2 - Roster Review

Before starting the next milestone, the orchestrator evaluates whether the agent roster needs changes:

- Are there agents that were underutilized? Consider removing them.
- Does the next milestone require expertise not in the current roster? Consider adding agents.
- Did any agent consistently struggle? Consider swapping to a higher model tier.

Apply changes based on `agentApprovalMode`.

### Step 5.3 - Advance Decision

Based on `milestoneAdvanceMode` from `session.json`:

Read `executionMode` from `.mamh/session.json` (default: `"agent-teams"` if env var set, else `"subagents"`).

- **`auto-advance`:**
  - **Agent Teams mode:** Immediately load the next milestone's tickets into Agent Teams and continue execution (return to Phase 3, Section A).
  - **Subagent mode:** Rebuild the dependency graph for the next milestone's tickets, compute parallel batches, and resume batch execution (return to Phase 3, Section B).
- **`re-plan`:** Delegate to the `planner` agent (via Task tool for one-shot analysis) to re-evaluate remaining milestones based on what was learned. This may reorder, merge, split, or add milestones. Update ticket files accordingly, then continue with the appropriate execution mode.
- **`user-decides`:** Pause and present the user with:
  - Summary of completed milestone
  - Overview of next milestone
  - Options: "Continue", "Re-plan", "Modify next milestone", "Stop"

### Step 5.4 - Project Completion

When ALL milestones are complete:

1. **Final worktree merge** — Run Step 5.1b one last time to merge any remaining agent branches.
2. **Clean up all worktrees** — Remove `.worktrees/` directory and all `mamh/*` branches.
3. Update state to `{ "phase": 5, "status": "project-complete" }`.
4. Generate a final project report in `.mamh/logs/project-report.md`:
   - Overall metrics
   - Architecture decisions and rationale
   - Known issues and technical debt
   - Recommended next steps
5. Announce to the user:
   > "MAMH project complete. All milestones delivered. See `.mamh/logs/project-report.md` for the full report."
