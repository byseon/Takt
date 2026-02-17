---
name: takt-validate
description: Run validation checks (lint, typecheck, tests) with preset detection. Saves artifacts. Triggers on "takt validate".
---

# Takt Validate — Run Validation Checks

Run project validation commands (lint, typecheck, tests, format checks) using auto-detected or specified presets. Results are saved as artifacts and can be appended to quick entries or ticket files.

---

## Usage

```
takt validate [--mode quick|ticket] [--id <id>] [--preset python|node|auto] [--strict]
```

**Defaults:** `--preset auto`, `--mode` auto-detected, `--id` most recent entry

---

## Workflow

### Step 1: Resolve Mode and ID

1. If `--mode` not specified: auto-detect
   - If `.takt/quick/` has entries -> mode is `quick`
   - Else if `.takt/tickets/milestones/` has entries -> mode is `ticket`
   - Else -> error: "No quick entries or tickets found. Create one first."
2. If `--id` not specified: use most recent entry in the detected mode
   - For quick mode: sort `.takt/quick/` directories by name (timestamp-based, newest first)
   - For ticket mode: scan ticket files for the most recently modified

### Step 2: Determine Config

Check for `.takt/config.yaml` (optional). If present, read validation settings. If absent, use preset defaults.

### Step 3: Run Validation

Execute the validation script:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate.mjs" . --preset <preset> [--config .takt/config.yaml]
```

Parse the JSON output from stdout.

### Step 4: Save Artifacts

For each validation command result:
- Save output to `.takt/artifacts/<mode>/<id>/logs/<command-name>.log`
  - Contents: command name, full command, exit code, stdout, stderr, duration

Create the artifacts directory structure if it doesn't exist.

### Step 5: Generate Summary

Create a markdown validation summary table:

```markdown
| Check | Status | Duration |
|-------|--------|----------|
| lint | PASS | 1.2s |
| typecheck | PASS | 3.4s |
| test | FAIL | 12.1s |
| format | SKIP | - |

**Result: 2/3 passed, 1 failed, 1 skipped**
```

### Step 6: Update Entry File

Find the relevant entry file:
- Quick mode: `.takt/quick/<id>/quick.md`
- Ticket mode: scan `.takt/tickets/milestones/` for matching ticket ID

Replace the content under `## Validation Summary` heading with the generated summary. If the heading doesn't exist, append it.

### Step 7: Report Results

Print the validation summary to the user.

**Exit behavior:**
- In quick mode without `--strict`: warn on failures but don't error
- With `--strict` or in ticket mode: report failures clearly and recommend fixes

---

## Notes

- Validation is opt-in in quick mode (can be skipped with `--no-validate` on `takt quick`)
- In ticket mode, validation artifacts may be required by review-gate if `review.require_validation: true` in config.yaml
- Custom commands can be added via `validate.commands[]` in config.yaml
