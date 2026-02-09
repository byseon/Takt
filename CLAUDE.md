# MAMH Plugin — Developer Guide for LLMs

## Project Overview

MAMH (Multi-Agent Multi-Harness) is a Claude Code plugin that orchestrates teams of specialized AI agents to build complex projects autonomously. It's a standalone plugin repository installable via `claude plugin add`.

**Core Concept**: Instead of a single LLM context managing everything, MAMH generates a team of specialized agents (architect, planner, backend dev, frontend dev, QA, etc.) that work together through a ticket-based workflow, coordinated by an orchestrator agent.

**Key Innovation**: The plugin ships templates; agents are generated dynamically per-project based on the project's needs.

---

## Repository Structure

```
mamh/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (name, version, entry points)
├── skills/
│   └── mamh/
│       ├── SKILL.md             # Main skill entry point (CLI interface)
│       └── examples/            # Example usage scenarios
├── agents/
│   └── mamh-orchestrator.md     # Team lead agent (delegate mode, no code tools)
├── hooks/
│   └── hooks.json               # Hook configuration (SubagentStart)
├── scripts/
│   ├── hook-subagent-start.mjs  # Agent type rewriting hook
│   └── generate-agents.mjs      # Agent generation script
├── templates/
│   └── agents/                  # Agent templates (8 total)
│       ├── architect.md
│       ├── planner.md
│       ├── backend-dev.md
│       ├── frontend-dev.md
│       ├── qa-engineer.md
│       ├── devops.md
│       ├── researcher.md
│       └── designer.md
├── docs/
│   ├── ARCHITECTURE.md          # System design
│   ├── WORKFLOW.md              # Development workflow
│   └── TROUBLESHOOTING.md       # Common issues
├── PLAN.md                      # Original design plan
├── README.md                    # Installation + quick start
├── package.json                 # npm metadata (no runtime deps)
├── LICENSE                      # MIT License
└── .gitignore
```

---

## Key Architectural Decisions

### 1. Template-Based Agent Generation
**Decision**: Plugin ships templates; agents are generated per-project
**Rationale**: Different projects need different specialists. A frontend-heavy project doesn't need a DevOps agent; a CLI tool doesn't need a designer.
**Implementation**: `generate-agents.mjs` reads templates, substitutes `{{PLACEHOLDERS}}`, writes to `.claude/agents/mamh-*.md`

### 2. Portable Plugin Paths
**Decision**: Hooks use `${CLAUDE_PLUGIN_ROOT}` for portable paths
**Rationale**: Plugin can be installed anywhere; hardcoding paths breaks portability
**Example**:
```json
{
  "script": "${CLAUDE_PLUGIN_ROOT}/scripts/hook-subagent-start.mjs"
}
```

### 3. Zero External Dependencies
**Decision**: All scripts are ESM (.mjs) with zero external dependencies
**Rationale**: Simplifies installation, avoids version conflicts, faster cold start
**Implementation**: Use Node.js built-ins only (`fs`, `path`, `process`)

### 4. Project-Scoped State
**Decision**: State lives in `.mamh/` (per-project, not in plugin directory)
**Rationale**: Multiple projects can use MAMH simultaneously; state must be isolated
**Structure**:
```
.mamh/
├── state.json                   # Team state, active milestone
├── tickets/
│   ├── milestones/
│   │   └── <AGENT>-<NNN>-<slug>.md
│   ├── backlog/
│   └── done/
└── agents/                      # Symlink to .claude/agents/mamh-*
```

### 5. Agent Teams Execution Engine
**Decision**: Use Agent Teams (experimental feature) for parallel execution
**Rationale**: Native Claude Code feature for multi-agent orchestration; more efficient than spawning subagents manually
**Requirement**: Claude Code must have Agent Teams enabled

### 6. Orchestrator as Pure Coordinator
**Decision**: Orchestrator runs in delegate mode (no Write/Edit/Bash tools)
**Rationale**: Prevents orchestrator from doing work directly; enforces delegation discipline
**Enforcement**: Hook rewrites `mamh-orchestrator` subagent_type to omit code tools

---

## Coding Standards

### Scripts (`.mjs` files)
- **Module format**: Node.js ESM (not CommonJS)
- **Shebang**: `#!/usr/bin/env node` (for direct execution)
- **Dependencies**: ZERO external deps; use Node.js built-ins only
- **Error handling**: Try/catch with meaningful messages, exit codes (0=success, 1=error, 2=block)
- **Input/Output**: Read stdin for JSON input (hooks), write stdout for JSON output
- **Portability**: Use `${CLAUDE_PLUGIN_ROOT}` or relative paths, never hardcode `/Users/...`

**Example**:
```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

try {
  const input = JSON.parse(readFileSync(0, 'utf-8')); // stdin
  // ... process ...
  console.log(JSON.stringify(output, null, 2)); // stdout
  process.exit(0);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
```

### Templates (`.md` files in `templates/`)
- **Placeholders**: Use `{{PLACEHOLDER}}` syntax (double braces)
- **Common placeholders**: `{{PROJECT_NAME}}`, `{{PROJECT_ROOT}}`, `{{TIMESTAMP}}`
- **Format**: YAML frontmatter + markdown body
- **Frontmatter fields**: `name`, `model_override`, `temperature`, `capabilities`, `restrictions`

**Example**:
```markdown
---
name: mamh-backend-dev
model_override: sonnet
temperature: 0.3
---

# Backend Developer Agent

You are the backend developer for {{PROJECT_NAME}}.

Working directory: {{PROJECT_ROOT}}
```

### Agent Definitions (`.md` files in `.claude/agents/`)
- **Naming**: `mamh-<role>.md` (generated from templates)
- **Capabilities**: List allowed tools in frontmatter (or omit for full access)
- **Restrictions**: List forbidden tools in frontmatter (orchestrator should restrict Write/Edit/Bash)
- **Instructions**: Clear, specific, actionable

### Hooks (`hooks.json` + scripts)
- **Hook types**: SubagentStart (intercept agent spawning)
- **Exit codes**: 0 (allow), 2 (block), 1 (error)
- **Input**: JSON on stdin with `type`, `subagent_type`, `prompt`, etc.
- **Output**: Modified JSON on stdout (if allowing with changes)
- **Logging**: Write to stderr (doesn't pollute output)

### State Files (`.mamh/*.json`)
- **Format**: JSON with `version` and `timestamp` fields
- **Schema**: Define clear schema; include example in docs
- **Atomicity**: Write to temp file, then rename (avoid corruption)
- **Validation**: Check version compatibility on load

---

## Testing

### Plugin Installation Testing
```bash
# From plugin repo root
claude plugin add ./

# Verify installation
claude plugin list | grep mamh
```

### Integration Testing
```bash
# Create test project
mkdir /tmp/mamh-test && cd /tmp/mamh-test
git init

# Install plugin (if not global)
claude plugin add /path/to/mamh

# Run skill
mamh "Build a REST API for task management"

# Verify generated files
ls -la .mamh/
ls -la .claude/agents/mamh-*
```

### Hook Testing (Direct Script Execution)
```bash
# Test hook script directly
echo '{"type":"subagent_start","subagent_type":"mamh-orchestrator","prompt":"test"}' | \
  node scripts/hook-subagent-start.mjs

# Expected output: JSON with modified subagent_type
```

### Agent Generation Testing
```bash
# Test agent generation
node scripts/generate-agents.mjs --project-root=/tmp/test --team=small

# Verify output
ls /tmp/test/.claude/agents/mamh-*
```

---

## Important Constraints

### NEVER
- ❌ Add external npm dependencies to scripts (breaks zero-dependency promise)
- ❌ Store state in `~/.claude/` (reserved for Claude Code core)
- ❌ Hardcode absolute paths in hooks or templates (breaks portability)
- ❌ Give orchestrator agent Write/Edit/Bash tools (breaks delegation discipline)
- ❌ Use CommonJS (`require`) in scripts (must be ESM)
- ❌ Write generated files to plugin directory (breaks multi-project isolation)

### ALWAYS
- ✅ Use `${CLAUDE_PLUGIN_ROOT}` in `hooks.json` paths
- ✅ Use `{{PLACEHOLDER}}` syntax in templates
- ✅ Put generated files in `.mamh/` or `.claude/agents/mamh-*`
- ✅ Include `version` and `timestamp` in state files
- ✅ Handle errors gracefully with clear messages
- ✅ Test plugin in a separate test project (not in plugin repo itself)

---

## File Naming Conventions

| File Type | Naming Pattern | Location | Example |
|-----------|---------------|----------|---------|
| Plugin manifest | `plugin.json` | `.claude-plugin/` | `.claude-plugin/plugin.json` |
| Main skill | `SKILL.md` | `skills/mamh/` | `skills/mamh/SKILL.md` |
| Plugin agents | `mamh-orchestrator.md` | `agents/` | `agents/mamh-orchestrator.md` |
| Generated agents | `mamh-<role>.md` | `.claude/agents/` | `.claude/agents/mamh-backend-dev.md` |
| Templates | `<role>.md` | `templates/agents/` | `templates/agents/backend-dev.md` |
| Scripts | `<name>.mjs` | `scripts/` | `scripts/generate-agents.mjs` |
| Hooks config | `hooks.json` | `hooks/` | `hooks/hooks.json` |
| Tickets | `<AGENT>-<NNN>-<slug>.md` | `.mamh/tickets/milestones/` | `.mamh/tickets/milestones/BACKEND-001-setup-express.md` |
| State files | `<name>.json` | `.mamh/` | `.mamh/state.json` |

---

## Common Development Tasks

### Adding a New Agent Template
1. Create `templates/agents/<role>.md` with YAML frontmatter + instructions
2. Add placeholders: `{{PROJECT_NAME}}`, `{{PROJECT_ROOT}}`, `{{TIMESTAMP}}`
3. Update `scripts/generate-agents.mjs` to include new template
4. Update `skills/mamh/SKILL.md` documentation (team sizes, agent list)
5. Test generation: `node scripts/generate-agents.mjs --team=full`

### Modifying Hooks
1. Edit `hooks/hooks.json` to add/remove hook definitions
2. Update corresponding script in `scripts/hook-*.mjs`
3. Test: `echo '{}' | node scripts/hook-*.mjs`
4. Verify hook registration: `claude plugin list` (hooks should appear)

### Changing Default Configuration
1. Edit `.claude-plugin/plugin.json` → `config` section
2. Update documentation in `README.md` and `SKILL.md`
3. Add migration logic if config schema changes

### Adding a Subcommand
1. Update `skills/mamh/SKILL.md` → "# Subcommands" section
2. Add usage examples in `skills/mamh/examples/`
3. Update help text in skill
4. Document in `README.md`

### Updating Agent Capabilities
1. Edit template in `templates/agents/<role>.md`
2. Modify frontmatter: `capabilities` (allowed tools) or `restrictions` (forbidden tools)
3. Regenerate agents: `node scripts/generate-agents.mjs`
4. Test with sample task

---

## Workflow Integration

MAMH integrates with standard Claude Code workflows:

### Planning Phase
1. User invokes: `mamh "build feature X"`
2. Orchestrator generates project context (file tree, tech stack detection)
3. Planner agent creates breakdown (milestones, tickets)
4. Tickets written to `.mamh/tickets/milestones/`

### Execution Phase
1. Orchestrator assigns tickets to specialist agents
2. Agents work in parallel (Agent Teams)
3. Agents update ticket status (in-progress → testing → done)
4. Orchestrator monitors progress, unblocks dependencies

### Verification Phase
1. QA agent runs tests, checks functionality
2. Architect reviews code quality, architectural alignment
3. Orchestrator collects verification results
4. User receives summary with evidence

---

## State Management

### State File Schema (`.mamh/state.json`)
```json
{
  "version": "1.0.0",
  "timestamp": "2026-02-08T12:34:56Z",
  "project_root": "/Users/user/project",
  "active_milestone": "milestone-1",
  "team": ["mamh-orchestrator", "mamh-planner", "mamh-backend-dev"],
  "tickets": {
    "milestones": ["BACKEND-001-setup-express.md"],
    "in_progress": [],
    "done": []
  }
}
```

### State Transitions
- **Initialization**: `generate-agents.mjs` creates initial state
- **Ticket creation**: Planner adds to `milestones`
- **Ticket assignment**: Orchestrator moves to `in_progress`
- **Ticket completion**: Agents move to `done`
- **Cleanup**: Orchestrator archives completed milestones

---

## Debugging Tips

### Plugin Not Found
- Check installation: `claude plugin list`
- Verify `plugin.json` syntax (valid JSON)
- Check `skills/mamh/SKILL.md` exists

### Agents Not Generated
- Check `.mamh/` directory exists
- Run generation manually: `node scripts/generate-agents.mjs`
- Check template syntax (`{{PLACEHOLDERS}}`)

### Hook Not Firing
- Verify hooks registered: `claude plugin list` (shows hooks)
- Check script permissions: `chmod +x scripts/*.mjs`
- Test script directly: `echo '{}' | node scripts/hook-*.mjs`

### Orchestrator Doing Code Work
- Check hook is rewriting `subagent_type` correctly
- Verify orchestrator agent has `restrictions: [Write, Edit, Bash]` in frontmatter
- Check hook exit code (must be 0 to allow)

### Tickets Not Moving
- Check `.mamh/tickets/` structure (milestones/, backlog/, done/)
- Verify ticket naming: `<AGENT>-<NNN>-<slug>.md`
- Check orchestrator logs for errors

---

## Performance Considerations

### Agent Count
- **Small team** (3-4 agents): Faster, less coordination overhead
- **Full team** (8 agents): More parallelism, higher coordination cost
- **Rule of thumb**: Start small, scale up for complex projects

### Ticket Granularity
- **Too fine-grained**: High overhead (many small tickets)
- **Too coarse**: Low parallelism (agents idle waiting)
- **Sweet spot**: 2-4 hours of work per ticket

### State File I/O
- Minimize reads/writes (cache in memory)
- Use atomic writes (temp file → rename)
- Avoid polling (use event-driven updates)

---

## Security Considerations

### Sandbox Restrictions
- Orchestrator has no Write/Edit/Bash (enforced by hook)
- Specialist agents have full access (required for code work)
- User can override in agent definitions (not recommended)

### State File Access
- `.mamh/` is world-readable by default
- Sensitive data (API keys) should never be in state files
- Use environment variables for secrets

### Script Execution
- Hooks run in same security context as Claude Code
- Scripts have access to filesystem (be careful with writes)
- Validate input JSON schema before processing

---

## Versioning Strategy

### Plugin Versions
- **Format**: `MAJOR.MINOR.PATCH` (semver)
- **Increment MAJOR**: Breaking changes (state schema, hook API)
- **Increment MINOR**: New features (new agents, subcommands)
- **Increment PATCH**: Bug fixes, docs updates

### State File Versions
- **Format**: `MAJOR.MINOR` (no patch)
- **Compatibility**: Same MAJOR = compatible
- **Migration**: Provide migration scripts for MAJOR bumps

### Agent Template Versions
- **Tracked in**: Template frontmatter (`template_version: 1.2`)
- **Used for**: Detecting stale generated agents
- **Migration**: Regenerate agents on template version mismatch

---

## Contributing Guidelines

### Code Changes
1. Read this file (CLAUDE.md) first
2. Check PLAN.md for design rationale
3. Follow coding standards above
4. Test in a separate project (not plugin repo)
5. Update documentation (README, SKILL.md)

### Adding Features
1. Propose in GitHub issue first (avoid wasted work)
2. Check compatibility with zero-dependency constraint
3. Update relevant docs (README, SKILL.md, this file)
4. Add examples in `skills/mamh/examples/`

### Bug Fixes
1. Reproduce in isolated test case
2. Add test case to prevent regression
3. Fix root cause (not symptoms)
4. Update TROUBLESHOOTING.md if user-facing

---

## Related Documentation

- **[PLAN.md](PLAN.md)**: Original design plan and architectural decisions
- **[README.md](README.md)**: Installation and quick start guide
- **[skills/mamh/SKILL.md](skills/mamh/SKILL.md)**: Skill interface and subcommands
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Detailed system design
- **[docs/WORKFLOW.md](docs/WORKFLOW.md)**: Development workflow and best practices
- **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)**: Common issues and solutions

---

## Quick Reference

### Essential Commands
```bash
# Install plugin
claude plugin add ./

# Generate agents
node scripts/generate-agents.mjs --team=small

# Test hook
echo '{}' | node scripts/hook-subagent-start.mjs

# Run skill
mamh "task description"
```

### Key Directories
- `.claude-plugin/`: Plugin metadata
- `skills/mamh/`: Skill entry point
- `agents/`: Plugin agents (orchestrator)
- `templates/agents/`: Agent templates
- `scripts/`: Hook scripts and utilities
- `.mamh/`: Project state (generated, not in repo)

### Key Files
- `plugin.json`: Plugin manifest
- `SKILL.md`: Skill definition
- `hooks.json`: Hook configuration
- `mamh-orchestrator.md`: Team lead agent
- `generate-agents.mjs`: Agent generation script
- `hook-subagent-start.mjs`: Agent type rewriting hook

---

**Last Updated**: 2026-02-08
**Plugin Version**: 0.1.0 (alpha)
**Maintainer**: MAMH Development Team
