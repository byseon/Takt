# Takt Plugin — Developer Guide for LLMs

## Project Overview

Takt (formerly MAMH) is a Claude Code plugin that orchestrates teams of specialized AI agents to build complex projects autonomously. Load it with `claude --plugin-dir /path/to/takt`.

**Core Concept**: Instead of a single LLM context managing everything, Takt generates a team of specialized agents — each with scoped file access, defined responsibilities, and restricted tools — that work together through a ticket-based workflow, coordinated by an orchestrator agent.

**Key Innovation**: The plugin ships templates; agents are generated dynamically per-project based on the project's needs.

---

## Repository Structure

```
takt/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (name, version, entry points)
├── skills/
│   ├── takt/
│   │   └── SKILL.md             # Main entry point (help, routing, directory reference)
│   ├── plan/
│   │   └── SKILL.md             # /takt-plan — Phases 0-2 (planning, agents, tickets)
│   ├── execute/
│   │   └── SKILL.md             # /takt-execute — Phase 3 (Agent Teams execution)
│   ├── review/
│   │   └── SKILL.md             # /takt-review — Phase 4 (review gates)
│   ├── next/
│   │   └── SKILL.md             # /takt-next — Phase 5 (milestone iteration)
│   ├── status/
│   │   └── SKILL.md             # /takt-status — Project dashboard
│   ├── resume/
│   │   └── SKILL.md             # /takt-resume — Resume interrupted session
│   ├── handoff/
│   │   └── SKILL.md             # /takt-handoff — Update HANDOFF.md
│   └── stop/
│       └── SKILL.md             # /takt-stop — Graceful shutdown
├── agents/
│   └── takt-orchestrator.md     # Team lead agent (delegate mode, no code tools)
├── hooks/
│   └── hooks.json               # Hook configuration (PreToolUse, TaskCompleted, TeammateIdle)
├── scripts/
│   ├── scope-guard.mjs          # PreToolUse hook: blocks out-of-scope writes
│   ├── review-gate.mjs          # TaskCompleted hook: enforces review checks
│   ├── keep-working.mjs         # TeammateIdle hook: prevents premature stopping
│   ├── init-project.mjs         # Creates .takt/ directory in user projects
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
| Project-scoped state (`.takt/`) | Multiple projects can use Takt simultaneously; state is isolated per-project. |
| Orchestrator has no Write/Edit tools | Enforces delegation-only pattern. |
| POLICY.md capped at ~200 lines | Minimize per-agent context consumption (~1,300 tokens vs ~4,500). |
| ESM modules (`.mjs`) | Modern JavaScript, no CommonJS. |
| Git worktree isolation | Each writing agent gets its own branch; no merge conflicts during parallel work. |
| Dual execution mode (agent-teams / subagents) | Agent Teams requires an experimental env var not available to all users. Subagent mode provides a fully functional fallback using Task tool batch dispatch with the main session as orchestrator. Mode is chosen during planning and stored in `session.json`. |
| Mandatory reviewer agent | Every project includes a permanent opus-tier reviewer that cannot be removed during roster review. Ensures code quality regardless of project type. |

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

### State Files (`.takt/*.json`)
- **Format**: JSON with clear schema
- **Location**: Always in `.takt/` (project-scoped), never in plugin directory
- **Atomicity**: Write to temp file, then rename (avoid corruption)

---

## Testing

### Plugin Installation
```bash
# Option A: Permanent install (inside Claude Code)
# Load the plugin
claude --plugin-dir /path/to/takt

# Option B: Session-only (from shell)
claude --plugin-dir /path/to/takt
```

### Integration Testing
```bash
# Create test project
mkdir /tmp/takt-test && cd /tmp/takt-test
git init

# Launch Claude Code (with plugin loaded via either method above)
# In Claude Code, run:
# takt "Build a REST API for task management"

# Verify generated files
ls -la .takt/
ls -la .claude/agents/takt-*
```

### Hook Testing (Direct Script Execution)
```bash
# Test scope-guard
echo '{"agent_name":"takt-backend","tool_name":"Write","tool_input":{"file_path":"/project/src/api/auth.py"}}' | \
  node scripts/scope-guard.mjs

# Test review-gate
echo '{"agent_name":"takt-backend","ticket_id":"BACKEND-001"}' | \
  node scripts/review-gate.mjs

# Test keep-working
echo '{"agent_name":"takt-backend"}' | \
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
- Put generated files in `.takt/` or `.claude/agents/takt-*`
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
2. Update `skills/takt/SKILL.md` subcommand routing table
3. Add usage examples
4. Document in `README.md`

---

## Related Documentation

- **[STATUS.md](STATUS.md)**: Current project status and changelog
- **[README.md](README.md)**: Installation and usage guide
- **[skills/takt/SKILL.md](skills/takt/SKILL.md)**: Main skill entry point (help, routing, directory reference)
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

**Last Updated**: 2026-02-15
**Plugin Version**: 0.2.0
