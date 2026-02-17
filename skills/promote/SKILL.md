---
name: takt-promote
description: Promote a quick entry to a full structured ticket. Triggers on "takt promote".
---

# Takt Promote — Quick Entry to Structured Ticket

Promote a quick mode entry to a full structured ticket when the scope grows beyond what quick mode handles well. Carries over context, acceptance checks, notes, and artifacts.

---

## Usage

```
takt promote <quick-id> --to ticket [--milestone <id>] [--agent <agent-id>] [--branch]
```

---

## Workflow

### Step 1: Read Quick Entry

Read `.takt/quick/<quick-id>/quick.md`. Extract:
- Title (from `# Quick: <title>`)
- Type (from `**Type:**`)
- Scope (from `**Scope:**`)
- Status (from `**Status:**`)
- Promoted field (from `**Promoted:**`)
- Content under `## Steps` section
- Content under `## Acceptance Checks` section
- Content under `## Notes` section
- Content under `## Validation Summary` section

If the file doesn't exist, error: "Quick entry not found: <quick-id>"

### Step 2: Check Promotion Status

Read the `**Promoted:**` field. If not `none`, warn:
> "This quick entry was already promoted to <ticket-id>. Promote again? This will create a new ticket."

Ask for confirmation before proceeding.

### Step 3: Determine Target Milestone

Priority order:
1. `--milestone <id>` if provided
2. Current milestone from `.takt/state/takt-state.json` -> `currentMilestone`
3. If no milestone exists: create an ad-hoc milestone directory `M-quick-<timestamp>/` with a `_milestone.json`:
   ```json
   {
     "id": "M-quick-<timestamp>",
     "name": "Quick Promotions",
     "status": "active",
     "createdAt": "<ISO>",
     "origin": "quick-promote"
   }
   ```

### Step 4: Generate Ticket ID

Scan all existing tickets across ALL milestones (including archive) for the highest `T<NNN>` number. Increment by 1. Format: `T<NNN>` with zero-padding to 3 digits.

### Step 5: Render Ticket

Read the template from `${CLAUDE_PLUGIN_ROOT}/templates/ticket.md` and fill placeholders:
- `{{TICKET_ID}}` = generated ticket ID (e.g., `T042`)
- `{{TITLE}}` = title from quick entry
- `{{AGENT}}` = `--agent` value or `unassigned`
- `{{MILESTONE}}` = target milestone ID
- `{{PRIORITY}}` = `medium` (default for promoted tickets)
- `{{COMPLEXITY}}` = `medium` (default)
- `{{DEPENDENCIES}}` = `none`
- `{{ORIGIN}}` = `quick:<quick-id>`
- `{{DESCRIPTION}}` = content from quick entry's Steps + Notes sections
- `{{ACCEPTANCE_CRITERIA}}` = carried over from quick entry's Acceptance Checks (preserve checkbox format)

### Step 6: Write Ticket File

Write to `.takt/tickets/milestones/<milestone>/<ticket-id>-<agent>-<slug>.md`

Where slug = title lowercased, spaces to hyphens, max 30 chars.

### Step 7: Copy Artifacts

Copy `.takt/artifacts/quick/<quick-id>/` -> `.takt/artifacts/ticket/<ticket-id>/`

Preserve originals (copy, don't move). Create destination directories as needed.

### Step 8: Update Quick Entry

Edit `.takt/quick/<quick-id>/quick.md`:
- Set `**Promoted:** <ticket-id>`
- Set `**Status:** promoted`

### Step 9: Optional Branch Setup

If `--branch` flag is set and worktree-setup script exists:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.mjs"
```

### Step 10: Print Confirmation

```
Promoted: <quick-id> -> <ticket-id>

Ticket: .takt/tickets/milestones/<milestone>/<filename>.md
Artifacts: .takt/artifacts/ticket/<ticket-id>/
Origin: quick:<quick-id>

Next steps:
  - Assign an agent: edit the ticket's Agent field
  - Run execution: takt execute
  - Or continue working in quick mode on other tasks
```

---

## Notes

- Promote copies artifacts (doesn't move) to preserve quick entry history
- The Origin field on the ticket traces back to the quick entry
- Promoted quick entries are marked with Status: promoted and the ticket ID
