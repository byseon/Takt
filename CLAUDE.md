# MAMH Plugin — Developer Guide for LLMs

## Project Overview

MAMH (Multi-Agent Multi-Harness) is a Claude Code plugin that orchestrates teams of specialized AI agents to build complex projects autonomously. Load it with `claude --plugin-dir /path/to/mamh`.

**Core Concept**: Instead of a single LLM context managing everything, MAMH generates a team of specialized agents — each with scoped file access, defined responsibilities, and restricted tools — that work together through a ticket-based workflow, coordinated by an orchestrator agent.

**Key Innovation**: The plugin ships templates; agents are generated dynamically per-project based on the project's needs.

---

## Repository Structure

```
mamh/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (name, version, entry points)
├── skills/
│   ├── mamh/
│   │   └── SKILL.md             # Main entry point (help, routing, directory reference)
│   ├── plan/
│   │   └── SKILL.md             # /mamh-plan — Phases 0-2 (planning, agents, tickets)
│   ├── execute/
│   │   └── SKILL.md             # /mamh-execute — Phase 3 (Agent Teams execution)
│   ├── review/
│   │   └── SKILL.md             # /mamh-review — Phase 4 (review gates)
│   ├── next/
│   │   └── SKILL.md             # /mamh-next — Phase 5 (milestone iteration)
│   ├── status/
│   │   └── SKILL.md             # /mamh-status — Project dashboard
│   ├── resume/
│   │   └── SKILL.md             # /mamh-resume — Resume interrupted session
│   ├── handoff/
│   │   └── SKILL.md             # /mamh-handoff — Update HANDOFF.md
│   └── stop/
│       └── SKILL.md             # /mamh-stop — Graceful shutdown
├── agents/
│   └── mamh-orchestrator.md     # Team lead agent (delegate mode, no code tools)
├── hooks/
│   └── hooks.json               # Hook configuration (PreToolUse, TaskCompleted, TeammateIdle)
├── scripts/
│   ├── scope-guard.mjs          # PreToolUse hook: blocks out-of-scope writes
│   ├── review-gate.mjs          # TaskCompleted hook: enforces review checks
│   ├── keep-working.mjs         # TeammateIdle hook: prevents premature stopping
│   ├── init-project.mjs         # Creates .mamh/ directory in user projects
│   ├── worktree-setup.mjs       # Creates per-agent git worktrees
│   └── worktree-merge.mjs       # Merges agent branches at milestone completion
├── templates/
│   ├── POLICY.md                # Shared rulebook template (~130 lines)
│   └── agents/                  # Agent templates (8 total)
│       ├── backend.md
│       ├── frontend.md
│       ├── reviewer.md
│       ├── pm.md
│       ├── designer.md
│       ├── researcher.md
│       ├── content.md
│       └── devops.md
├── docs/
│   ├── README.md                # Internal developer docs
│   ├── TEMPLATES.md             # Template customization guide
│   ├── CONFIGURATION.md         # Configuration reference
│   └── POLICY.md                # Policy system explanation
├── CLAUDE.md                    # This file
├── STATUS.md                    # Project status, changelog, design decisions
├── README.md                    # User-facing installation + usage guide
├── package.json                 # npm metadata (no runtime deps)
├── LICENSE                      # MIT License
└── .gitignore
```

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Template-based agent generation | Different projects need different specialists. Templates are customized per-project during Phase 1. |
| `${CLAUDE_PLUGIN_ROOT}` in hook paths | Plugin works regardless of where it's installed. |
| Zero external dependencies | All scripts use Node.js built-ins only. No `npm install`, no version conflicts. |
| Project-scoped state (`.mamh/`) | Multiple projects can use MAMH simultaneously; state is isolated per-project. |
| Orchestrator has no Write/Edit tools | Enforces delegation-only pattern. |
| POLICY.md capped at ~200 lines | Minimize per-agent context consumption (~1,300 tokens vs ~4,500). |
| ESM modules (`.mjs`) | Modern JavaScript, no CommonJS. |
| Git worktree isolation | Each writing agent gets its own branch; no merge conflicts during parallel work. |
| Dual execution mode (agent-teams / subagents) | Agent Teams requires an experimental env var not available to all users. Subagent mode provides a fully functional fallback using Task tool batch dispatch with the main session as orchestrator. Mode is chosen during planning and stored in `session.json`. |

---

## Coding Standards

### Scripts (`.mjs` files)
- **Module format**: Node.js ESM (not CommonJS)
- **Dependencies**: ZERO external deps; use Node.js built-ins only (`fs`, `path`, `process`)
- **Error handling**: Try/catch with meaningful messages, exit codes (0=allow, 1=error, 2=block)
- **Input/Output**: Read stdin for JSON input (hooks), write stdout for JSON output
- **Portability**: Use `${CLAUDE_PLUGIN_ROOT}` or relative paths, never hardcode absolute paths

### Templates (`.md` files in `templates/`)
- **Placeholders**: Use `{{PLACEHOLDER}}` syntax (double braces)
- **Common placeholders**: `{{PROJECT_NAME}}`, `{{AGENT_NAME}}`, `{{ALLOWED_PATHS}}`, `{{READ_ONLY_PATHS}}`, `{{FORBIDDEN_PATHS}}`, `{{CONSTRAINTS}}`, `{{TIMESTAMP}}`
- **Agent templates**: YAML frontmatter + markdown body

### Hooks (`hooks.json` + scripts)
- **Hook types**: PreToolUse (scope-guard), TaskCompleted (review-gate), TeammateIdle (keep-working)
- **Exit codes**: 0 (allow), 2 (block), 1 (error)
- **Input**: JSON on stdin with tool/agent context
- **Output**: JSON on stdout (for blocking messages)
- **Mode awareness**: `scope-guard` fires in both execution modes. `TeammateIdle` (keep-working) and `TaskCompleted` (review-gate) only fire in agent-teams mode.

### State Files (`.mamh/*.json`)
- **Format**: JSON with clear schema
- **Location**: Always in `.mamh/` (project-scoped), never in plugin directory
- **Atomicity**: Write to temp file, then rename (avoid corruption)

---

## Testing

### Plugin Installation
```bash
# Option A: Permanent install (inside Claude Code)
/plugin marketplace add seongjinpark-88/multi-agent-multi-harness
/plugin install mamh@mamh-marketplace

# Option B: Session-only (from shell)
claude --plugin-dir /path/to/mamh
```

### Integration Testing
```bash
# Create test project
mkdir /tmp/mamh-test && cd /tmp/mamh-test
git init

# Launch Claude Code (with plugin loaded via either method above)
# In Claude Code, run:
# mamh "Build a REST API for task management"

# Verify generated files
ls -la .mamh/
ls -la .claude/agents/mamh-*
```

### Hook Testing (Direct Script Execution)
```bash
# Test scope-guard
echo '{"agent_name":"mamh-backend","tool_name":"Write","tool_input":{"file_path":"/project/src/api/auth.py"}}' | \
  node scripts/scope-guard.mjs

# Test review-gate
echo '{"agent_name":"mamh-backend","ticket_id":"BACKEND-001"}' | \
  node scripts/review-gate.mjs

# Test keep-working
echo '{"agent_name":"mamh-backend"}' | \
  node scripts/keep-working.mjs
```

---

## Important Constraints

### NEVER
- Add external npm dependencies to scripts
- Store state in `~/.claude/` (reserved for Claude Code core)
- Hardcode absolute paths in hooks or templates
- Give orchestrator agent Write/Edit/NotebookEdit tools
- Use CommonJS (`require`) in scripts
- Write generated files to plugin directory

### ALWAYS
- Use `${CLAUDE_PLUGIN_ROOT}` in `hooks.json` paths
- Use `{{PLACEHOLDER}}` syntax in templates
- Put generated files in `.mamh/` or `.claude/agents/mamh-*`
- Handle errors gracefully with clear messages
- Test plugin in a separate project (not in plugin repo itself)

---

## Common Development Tasks

### Adding a New Agent Template
1. Create `templates/agents/<role>.md` with YAML frontmatter + markdown instructions
2. Include placeholders: `{{PROJECT_NAME}}`, `{{AGENT_NAME}}`, `{{ALLOWED_PATHS}}`, etc.
3. Define: role, responsibilities, non-responsibilities, tools, scope, communication protocol, definition of done, stop conditions
4. Update `SKILL.md` and `README.md` documentation

### Modifying Hooks
1. Edit hook script in `scripts/`
2. Test directly with sample JSON on stdin
3. Verify exit codes: 0 = allow, 2 = block, 1 = error
4. Update `hooks/hooks.json` if adding/removing hooks

### Adding a Subcommand
1. Create a new `skills/<subcommand>/SKILL.md` with YAML frontmatter (`name` + `description`)
2. Update `skills/mamh/SKILL.md` subcommand routing table
3. Add usage examples
4. Document in `README.md`

---

## Related Documentation

- **[STATUS.md](STATUS.md)**: Current project status and changelog
- **[README.md](README.md)**: Installation and usage guide
- **[skills/mamh/SKILL.md](skills/mamh/SKILL.md)**: Main skill entry point (help, routing, directory reference)
- **[skills/plan/SKILL.md](skills/plan/SKILL.md)**: Planning skill (Phases 0-2)
- **[skills/execute/SKILL.md](skills/execute/SKILL.md)**: Execution skill (Phase 3)
- **[skills/review/SKILL.md](skills/review/SKILL.md)**: Review skill (Phase 4)
- **[skills/next/SKILL.md](skills/next/SKILL.md)**: Milestone iteration skill (Phase 5)
- **[skills/status/SKILL.md](skills/status/SKILL.md)**: Status dashboard skill
- **[skills/resume/SKILL.md](skills/resume/SKILL.md)**: Resume protocol skill
- **[skills/handoff/SKILL.md](skills/handoff/SKILL.md)**: Handoff document update skill
- **[skills/stop/SKILL.md](skills/stop/SKILL.md)**: Stop protocol skill
- **[docs/README.md](docs/README.md)**: Internal developer docs
- **[docs/TEMPLATES.md](docs/TEMPLATES.md)**: Template customization guide
- **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)**: Configuration reference
- **[docs/POLICY.md](docs/POLICY.md)**: Policy system explanation

---

**Last Updated**: 2026-02-10
**Plugin Version**: 0.1.4
