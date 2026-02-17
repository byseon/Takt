---
name: takt-quick
description: Quick single-task mode for bugs, small features, and research. No agents or planning overhead. Triggers on "takt quick".
---

# Takt Quick — Lightweight Single-Task Mode

Quick mode bypasses Takt's full planning/agent workflow for small tasks: bug fixes, tiny features, research spikes. It creates a tracked quick entry with auto-collected context and optional validation — no agents, no tickets, no milestones.

---

## Usage

```
takt quick "<title>" [--type bug|feat|research] [--scope <path/glob>] [--run <skill>] [--no-validate]
```

**Defaults:** `--type feat`, `--scope .`

---

## Workflow

### Step 1: Initialize

1. Check if `.takt/` exists. If not, run init:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/init-project.mjs"
   ```
2. Ensure `.takt/quick/` and `.takt/artifacts/quick/` exist (create via Bash `mkdir -p` if missing).

### Step 2: Generate Quick ID

Format: `YYYYMMDD-HHMMSS_<slug>`

Where slug = title lowercased, non-alphanumeric characters replaced with hyphens, max 40 chars, trailing hyphens stripped.

Example: `20260216-143022_fix-auth-token-refresh`

### Step 3: Create Quick Entry Directory

Create `.takt/quick/<quick-id>/`

### Step 4: Gather Context

Run context gathering:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/context.mjs" . --scope "<scope>" --title "<title>" --output json
```

Save raw context output to `.takt/artifacts/quick/<quick-id>/context/context.json`

If context.mjs is not available or fails, skip gracefully and note "Context gathering unavailable" in the template.

### Step 5: Render Quick Entry

Read the template from `${CLAUDE_PLUGIN_ROOT}/templates/quick.md` and fill placeholders:
- `{{TITLE}}` = user's title
- `{{QUICK_ID}}` = generated ID
- `{{TYPE}}` = bug|feat|research
- `{{TIMESTAMP}}` = ISO 8601 timestamp
- `{{SCOPE}}` = scope path/glob
- `{{CONTEXT_SUMMARY}}` = formatted context from Step 4 (or "No context collected" if unavailable)

Write rendered template to `.takt/quick/<quick-id>/quick.md`

### Step 6: Optional Skill Invocation

If `--run <skill>` is provided, invoke the skill:
```
Skill(skill="<skill>")
```
Pass the quick entry context (scope, title, type) as context.

### Step 7: Optional Validation

If `--no-validate` is NOT set:
```
Skill(skill="takt-validate", args="--mode quick --id <quick-id>")
```

If takt-validate is not available or validation fails, warn but don't error.

### Step 8: Print Summary

```
Quick entry created: .takt/quick/<quick-id>/quick.md

Next steps:
  - Edit quick.md to add steps and acceptance checks
  - Run validation: takt validate --mode quick --id <quick-id>
  - When done or scope grows: takt promote <quick-id> --to ticket
```

---

## Notes

- Quick mode does NOT create agents, milestones, or tickets.
- Quick mode does NOT modify session.json or takt-state.json.
- Quick entries are independent of structured mode — both can coexist in the same project.
- The `.takt/quick/` directory is created by init-project.mjs (v0.3.0+) or lazily by this skill.
