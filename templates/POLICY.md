# {{PROJECT_NAME}} — Takt Policy

> Shared rules for all Takt agents. Read at session start. Violate nothing.
> Last updated: {{TIMESTAMP}}
> **Keep this file under ~200 lines.** If it grows beyond that, consolidate.

---

## Team Roster

{{AGENT_ROSTER}}

---

## Scope Rules

- You may ONLY write to files within your allowed paths (enforced by scope-guard hook).
- You may read files outside your scope unless they are listed as forbidden.
- You may NOT write to another agent's domain. Message them instead.
- If unsure who owns a file, check `.takt/agents/registry.json`.

---

## Hard Prohibitions

These rules are absolute. Violating any of them causes immediate ticket rejection.

### Never Do

1. **NEVER write outside your scope.** The scope-guard hook will block you. Do not attempt workarounds.
2. **NEVER write to the main working directory** if you have a worktree. All writes go to `.worktrees/takt-<your-id>/`.
3. **NEVER merge your branch into main.** The orchestrator handles all merges.
4. **NEVER commit secrets, API keys, tokens, passwords, or credentials** to any file.
5. **NEVER install new dependencies** without orchestrator approval. No `npm install`, `pip install`, etc.
6. **NEVER modify CI/CD pipelines, deployment configs, or infrastructure** without explicit orchestrator + user approval.
7. **NEVER run destructive commands** (`rm -rf`, `DROP TABLE`, `git reset --hard`, `git push --force`) unless the ticket explicitly requires it AND the orchestrator has approved it.
8. **NEVER disable security features** (CORS, CSP, authentication, rate limiting) even temporarily.
9. **NEVER log sensitive data** (passwords, tokens, PII, session IDs) at any log level.
10. **NEVER silently change a shared interface** (API contract, type definition, database schema) without notifying consuming agents FIRST.
11. **NEVER skip the Definition of Done checklist.** All criteria must be met before marking `review`.
12. **NEVER claim multiple tickets simultaneously.** One ticket at a time.
13. **NEVER skip escalation levels.** Peer first → orchestrator → user.
14. **NEVER retry the same failing approach more than twice.** Change approach or escalate.
15. **NEVER leave empty catch blocks or silent failures** in your code.

### Always Do

1. **ALWAYS sanitize user inputs** before queries, file paths, shell commands, or HTML output.
2. **ALWAYS use parameterized queries.** No string concatenation for database operations.
3. **ALWAYS validate data at trust boundaries** (API endpoints, file uploads, external responses).
4. **ALWAYS write tests** for new functionality. No untested code ships.
5. **ALWAYS follow existing project conventions.** Match surrounding code style.
6. **ALWAYS include ticket ID** in communications and non-obvious code comments.
7. **ALWAYS update ticket notes** with implementation details before marking for review.
8. **ALWAYS notify affected agents** when changing shared interfaces or exports.
9. **ALWAYS commit regularly** to your worktree branch.
10. **ALWAYS handle errors explicitly** with actionable error messages.

---

## Project Constraints

{{CONSTRAINTS}}

---

## Code Standards

{{CODE_STANDARDS}}

---

## Communication Rules

### Agent Teams Mode (`executionMode: "agent-teams"`)

- Use Agent Teams messaging (SendMessage) for all cross-agent communication.
- Every message must include: **Ticket ID**, **subject**, and **urgency** (`blocking` or `non-blocking`).
- Respond to `blocking` messages within your current work cycle.

### Subagent Mode (`executionMode: "subagents"`)

- There is no Agent Teams messaging. Communication is file-based.
- When you complete a ticket, write your output summary to `.takt/comms/<ticket-id>-output.md`.
- Output summary must include: files created/modified, interface contracts, blockers, and notes for dependent tickets.
- Do NOT use SendMessage or TeamCreate — they are not available in this mode.

### Both Modes

- Log architectural decisions to `.takt/comms/decisions.md`.
- Log notable changes to `.takt/comms/changelog.md`.

---

## Model Selection

Use the cheapest model that can handle the task:

| Task Type | Model | Examples |
|-----------|-------|---------|
| File scaffolding, boilerplate | haiku | Creating empty files, copying templates, config files |
| Running commands | haiku | Tests, lint, format, build, git operations |
| Simple code changes | haiku | Renaming, moving, small fixes with clear instructions |
| Feature implementation | sonnet | New features, bug fixes, refactoring, integration |
| Standard code review | sonnet | Style checks, convention adherence, simple logic review |
| Architecture decisions | opus | System design, complex trade-offs, security review |
| Requirements analysis | opus | Expanding vague requirements, identifying gaps |
| Complex debugging | opus | Multi-file issues, race conditions, security vulnerabilities |

Agents should default to their assigned model tier but may request escalation from the orchestrator for complex subtasks.

---

## File Ownership & Conflicts

- Each file has ONE owner. The owner has write authority.
- **Shared files** (types, configs): Propose → notify affected agents → wait for ack → apply.
- **Conflicts**: Agent in the file's primary domain goes first. Orchestrator arbitrates deadlocks.
- **Breaking changes**: Coordinate a migration plan with affected agents before applying.

---

## Ticket Rules

**Definition of Done** — ALL must be true before marking `review`:
- [ ] All acceptance criteria satisfied
- [ ] Tests written and passing
- [ ] No new diagnostic errors on changed files
- [ ] Ticket notes updated
- [ ] Affected agents notified of interface changes
- [ ] No files modified outside allowed scope

**If blocked**: Message the blocker, update ticket to `blocked`, claim another ticket, return when unblocked.

---

## Session Protocol

**Start**: Read this file → read state → read config → check messages → resume or claim ticket.

**End**: Save progress in ticket notes → update ticket status → notify waiting agents.

---

## Git Worktree Rules

- Your working directory: `.worktrees/takt-<your-id>/` (NOT project root)
- Your branch: `takt/<your-id>`
- `.takt/` is shared — all agents can write to it
- Do NOT merge to main. Orchestrator merges at milestone boundaries.
- Worktree path is in `.takt/agents/registry.json` → `worktreePath`

---

## Key Files

| File | Purpose |
|------|---------|
| `.takt/POLICY.md` | This file — shared rules |
| `.takt/HANDOFF.md` | Session handoff — what's done, decisions, next steps |
| `.takt/state/takt-state.json` | Current project state |
| `.takt/agents/registry.json` | Agent roster + scope boundaries |
| `.takt/tickets/milestones/` | Active milestone tickets |
| `.takt/comms/decisions.md` | Decision log |
| `.takt/comms/changelog.md` | Change log |
