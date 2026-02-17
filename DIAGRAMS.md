# Takt Quick Mode + Validation — Diagrams

**Version:** 0.3.0
**Date:** 2026-02-16

This document contains visual diagrams for Quick Mode and Validation features using Mermaid syntax.

---

## 1. Quick Mode Sequence Diagram

Shows the full flow from quick entry creation through validation.

```mermaid
sequenceDiagram
    participant U as User
    participant Q as takt-quick
    participant C as context.mjs
    participant V as validate.mjs
    participant FS as .takt/

    U->>Q: takt quick "Fix auth bug" --type bug

    Note over Q: Generate quick ID<br/>20260216-143022_fix-auth-bug

    Q->>FS: Check/create .takt/quick/
    Q->>Q: Generate quick ID

    Q->>C: Gather context (git, tree, language)
    activate C
    C->>C: git status
    C->>C: Count files/dirs
    C->>C: Detect languages
    C-->>Q: Context JSON
    deactivate C

    Q->>FS: Save context artifact<br/>.takt/artifacts/quick/<id>/context.json

    Q->>Q: Render quick.md from template
    Q->>FS: Write quick.md

    Note over Q: Check auto_validate config

    alt auto_validate: true
        Q->>V: Run validation
        activate V
        V->>V: Detect preset (auto)
        V->>V: Build command list

        loop For each command
            V->>V: Spawn child process
            V->>V: Capture stdout/stderr
            V->>V: Record exit code + duration
        end

        V->>FS: Save validation logs<br/>.takt/artifacts/quick/<id>/logs/
        V->>V: Generate summary table
        V-->>Q: Validation results
        deactivate V

        Q->>FS: Append summary to quick.md
    else auto_validate: false or --no-validate
        Note over Q: Skip validation
    end

    Q-->>U: Quick entry created!<br/>File: .takt/quick/<id>/quick.md
```

---

## 2. Promote Flow Diagram

Shows the data transformation from quick entry to ticket.

```mermaid
flowchart TD
    QE[Quick Entry<br/>.takt/quick/id/quick.md] --> READ[Read & Extract<br/>title, steps, checks, notes]
    READ --> MS{Milestone<br/>exists?}

    MS -->|--milestone flag| EXPLICIT[Use specified milestone]
    MS -->|No flag| ACTIVE{Active<br/>milestone?}

    ACTIVE -->|Yes| EXISTING[Use current milestone]
    ACTIVE -->|No| CREATE[Create ad-hoc<br/>M-quick-YYYYMMDD-HHMMSS/]

    EXPLICIT --> GEN[Generate ticket ID<br/>scan all T### + increment]
    EXISTING --> GEN
    CREATE --> GEN

    GEN --> AGENT{Agent<br/>specified?}

    AGENT -->|--agent flag| ASSIGN[Assign to agent]
    AGENT -->|No flag| UNASSIGN[Leave unassigned]

    ASSIGN --> RENDER[Render ticket.md<br/>Origin: quick:id]
    UNASSIGN --> RENDER

    RENDER --> WRITE[Write ticket file<br/>.takt/tickets/milestones/<milestone>/T###-*.md]

    WRITE --> COPY[Copy artifacts<br/>quick/id/ → ticket/T###/]

    COPY --> UPDATE[Update quick.md<br/>Status: promoted<br/>Promoted: T###<br/>PromotedAt: timestamp]

    UPDATE --> DONE[Print confirmation]

    style QE fill:#e3f2fd,stroke:#1976d2
    style DONE fill:#c8e6c9,stroke:#388e3c
    style MS fill:#fff3e0,stroke:#f57c00
    style ACTIVE fill:#fff3e0,stroke:#f57c00
    style AGENT fill:#fff3e0,stroke:#f57c00
    style RENDER fill:#f3e5f5,stroke:#7b1fa2
    style COPY fill:#f3e5f5,stroke:#7b1fa2
```

---

## 3. Validation Preset Detection Flow

Shows how validation preset is auto-detected or configured.

```mermaid
flowchart TD
    START[takt validate] --> CONFIG{config.yaml<br/>exists?}

    CONFIG -->|Yes| PRESET{validate.preset<br/>defined?}
    CONFIG -->|No| AUTO[preset = auto]

    PRESET -->|Yes| USE[Use configured preset]
    PRESET -->|No| AUTO

    AUTO --> DETECT{Detect<br/>project type}

    DETECT -->|package.json| NODE[Node Preset]
    DETECT -->|pyproject.toml<br/>or setup.py| PYTHON[Python Preset]
    DETECT -->|None| CUSTOM{config.yaml has<br/>custom commands?}

    CUSTOM -->|Yes| CUSTOMP[Custom Preset]
    CUSTOM -->|No| ERROR[Error: No preset detected<br/>Show help message]

    USE --> CHECK{Which preset?}
    CHECK -->|python| PYTHON
    CHECK -->|node| NODE
    CHECK -->|custom| CUSTOMP

    PYTHON --> PYCMD[Build Python commands<br/>ruff, mypy, pytest]
    NODE --> NODECMD[Build Node commands<br/>lint, test, build]
    CUSTOMP --> CUSTCMD[Read custom commands<br/>from config.yaml]

    PYCMD --> RUN[Run commands sequentially]
    NODECMD --> RUN
    CUSTCMD --> RUN

    RUN --> CAPTURE[Capture output<br/>stdout, stderr, exit code]
    CAPTURE --> LOGS[Save logs<br/>.takt/artifacts/*/logs/]
    LOGS --> SUMMARY[Generate summary table]
    SUMMARY --> APPEND[Append to quick.md]
    APPEND --> DONE[Validation complete]

    style START fill:#e3f2fd,stroke:#1976d2
    style DONE fill:#c8e6c9,stroke:#388e3c
    style ERROR fill:#ffcdd2,stroke:#c62828
    style DETECT fill:#fff3e0,stroke:#f57c00
    style CONFIG fill:#fff3e0,stroke:#f57c00
    style PRESET fill:#fff3e0,stroke:#f57c00
    style CHECK fill:#fff3e0,stroke:#f57c00
    style CUSTOM fill:#fff3e0,stroke:#f57c00
```

---

## 4. Validation Execution Flow

Shows the detailed execution of validation commands with error handling.

```mermaid
flowchart TD
    START[Validation Start] --> RESOLVE[Resolve quick ID<br/>explicit or latest]
    RESOLVE --> PRESET[Determine preset]
    PRESET --> CMDS[Build command list]

    CMDS --> EMPTY{Commands<br/>list empty?}

    EMPTY -->|Yes| ERRSKIP[Error: No validation<br/>commands available]
    EMPTY -->|No| LOOP{For each<br/>command}

    LOOP -->|Next command| CHECK{Tool<br/>exists?}

    CHECK -->|No| REQUIRED{Required?}
    CHECK -->|Yes| SPAWN[Spawn child process]

    REQUIRED -->|Yes| FAIL[Mark as failed]
    REQUIRED -->|No| SKIP[Skip with warning]

    SPAWN --> TIMEOUT{Timeout<br/>exceeded?}

    TIMEOUT -->|Yes| KILL[Kill process<br/>Mark as failed<br/>Log timeout error]
    TIMEOUT -->|No| WAIT[Wait for completion]

    WAIT --> EXIT{Exit<br/>code?}

    EXIT -->|0| PASS[Mark as passed]
    EXIT -->|Non-zero| FAIL

    PASS --> CAP[Capture stdout/stderr]
    FAIL --> CAP
    SKIP --> CAP
    KILL --> CAP

    CAP --> SIZE{Output size<br/>> max_log_size?}

    SIZE -->|Yes| TRUNC[Truncate output<br/>Add warning message]
    SIZE -->|No| KEEP[Keep full output]

    TRUNC --> LOG[Write log file<br/>.takt/artifacts/*/logs/<name>.log]
    KEEP --> LOG

    LOG --> MORE{More<br/>commands?}

    MORE -->|Yes| LOOP
    MORE -->|No| SUMMARY[Generate summary table]

    SUMMARY --> APPEND[Append to entry file]
    APPEND --> STRICT{Strict<br/>mode?}

    STRICT -->|Yes + failures| EXITFAIL[Exit with error code 1]
    STRICT -->|No or all passed| EXITSUCCESS[Exit with code 0]

    ERRSKIP --> EXITFAIL

    style START fill:#e3f2fd,stroke:#1976d2
    style EXITSUCCESS fill:#c8e6c9,stroke:#388e3c
    style EXITFAIL fill:#ffcdd2,stroke:#c62828
    style ERRSKIP fill:#ffcdd2,stroke:#c62828
    style PASS fill:#c8e6c9,stroke:#388e3c
    style FAIL fill:#ffcdd2,stroke:#c62828
    style SKIP fill:#fff9c4,stroke:#f57f17
    style KILL fill:#ffcdd2,stroke:#c62828
    style EMPTY fill:#fff3e0,stroke:#f57c00
    style CHECK fill:#fff3e0,stroke:#f57c00
    style REQUIRED fill:#fff3e0,stroke:#f57c00
    style TIMEOUT fill:#fff3e0,stroke:#f57c00
    style EXIT fill:#fff3e0,stroke:#f57c00
    style SIZE fill:#fff3e0,stroke:#f57c00
    style MORE fill:#fff3e0,stroke:#f57c00
    style STRICT fill:#fff3e0,stroke:#f57c00
```

---

## 5. Review Gate Integration Flow

Shows how review-gate.mjs checks for validation artifacts.

```mermaid
flowchart TD
    START[Agent marks ticket<br/>as completed] --> HOOK[Orchestrator invokes<br/>review-gate.mjs]

    HOOK --> TICKET[Read ticket file]
    TICKET --> CHECK1{All checkboxes<br/>checked?}

    CHECK1 -->|No| BLOCK1[Block: Complete all<br/>acceptance criteria]
    CHECK1 -->|Yes| CHECK2{Status =<br/>completed?}

    CHECK2 -->|No| BLOCK2[Block: Set status<br/>to 'completed']
    CHECK2 -->|Yes| CHECK3{Agent has<br/>commits?}

    CHECK3 -->|No| BLOCK3[Block: No commits<br/>found on branch]
    CHECK3 -->|Yes| CONFIG{config.yaml<br/>exists?}

    CONFIG -->|No| ALLOW[Allow completion]
    CONFIG -->|Yes| REQVAL{require_validation<br/>= true?}

    REQVAL -->|No| ALLOW
    REQVAL -->|Yes| ARTIFACTS{Validation<br/>artifacts exist?}

    ARTIFACTS -->|No| BLOCK4[Block: Validation required<br/>but no artifacts found<br/>Suggest: takt validate]
    ARTIFACTS -->|Yes| CHECKTEST{require_test_artifacts<br/>= true?}

    CHECKTEST -->|No| ALLOW
    CHECKTEST -->|Yes| TESTLOGS{Test logs<br/>exist?}

    TESTLOGS -->|No| BLOCK5[Block: Test logs required<br/>but not found]
    TESTLOGS -->|Yes| ALLOW

    ALLOW --> NEXT[Continue to<br/>full review validation]

    BLOCK1 --> EXIT[Exit code 2]
    BLOCK2 --> EXIT
    BLOCK3 --> EXIT
    BLOCK4 --> EXIT
    BLOCK5 --> EXIT

    style START fill:#e3f2fd,stroke:#1976d2
    style ALLOW fill:#c8e6c9,stroke:#388e3c
    style NEXT fill:#c8e6c9,stroke:#388e3c
    style BLOCK1 fill:#ffcdd2,stroke:#c62828
    style BLOCK2 fill:#ffcdd2,stroke:#c62828
    style BLOCK3 fill:#ffcdd2,stroke:#c62828
    style BLOCK4 fill:#ffcdd2,stroke:#c62828
    style BLOCK5 fill:#ffcdd2,stroke:#c62828
    style EXIT fill:#ffcdd2,stroke:#c62828
    style CHECK1 fill:#fff3e0,stroke:#f57c00
    style CHECK2 fill:#fff3e0,stroke:#f57c00
    style CHECK3 fill:#fff3e0,stroke:#f57c00
    style CONFIG fill:#fff3e0,stroke:#f57c00
    style REQVAL fill:#fff3e0,stroke:#f57c00
    style ARTIFACTS fill:#fff3e0,stroke:#f57c00
    style CHECKTEST fill:#fff3e0,stroke:#f57c00
    style TESTLOGS fill:#fff3e0,stroke:#f57c00
```

---

## 6. Complete Workflow: Quick to Ticket

Shows the full lifecycle from quick entry creation to ticket completion.

```mermaid
flowchart TD
    START[User needs to<br/>fix a bug] --> QUICK[takt quick<br/>"Fix auth timeout" --type fix]

    QUICK --> QMD[.takt/quick/<id>/quick.md<br/>created]

    QMD --> WORK[User edits code<br/>Updates quick.md progress]

    WORK --> VALIDATE[takt validate]
    VALIDATE --> VRESULTS[Validation results<br/>appended to quick.md]

    VRESULTS --> DECISION{Scope<br/>grew?}

    DECISION -->|No, done| DONE1[Mark quick.md as done<br/>Keep as historical record]
    DECISION -->|Yes| PROMOTE[takt promote<br/>--milestone M002-api]

    PROMOTE --> TICKET[Ticket created<br/>.takt/tickets/milestones/M002-api/T042-*.md]

    TICKET --> ARTIFACTS[Artifacts copied<br/>quick/<id>/ → ticket/T042/]

    ARTIFACTS --> QUPDATE[quick.md updated<br/>Status: promoted<br/>Promoted: T042]

    QUPDATE --> ASSIGN[Assign to agent<br/>takt-backend]

    ASSIGN --> EXECUTE[takt execute<br/>Agent starts work]

    EXECUTE --> AGENTWORK[Agent completes ticket<br/>Marks checkboxes<br/>Sets status: completed]

    AGENTWORK --> GATE[Review gate triggered]

    GATE --> GATECHECK{Validation<br/>artifacts?}

    GATECHECK -->|Missing| BLOCK[Blocked: Run validation]
    GATECHECK -->|Found| REVIEW[Full review<br/>Build + Test + Peer]

    BLOCK --> VALTICKET[takt validate T042]
    VALTICKET --> GATE

    REVIEW --> APPROVE{Review<br/>passed?}

    APPROVE -->|No| FIXES[Agent fixes issues]
    APPROVE -->|Yes| MERGE[Merge agent branch<br/>to main]

    FIXES --> AGENTWORK

    MERGE --> ARCHIVE[Archive ticket<br/>to milestone archive]

    ARCHIVE --> DONE2[Milestone complete]

    style START fill:#e3f2fd,stroke:#1976d2
    style DONE1 fill:#c8e6c9,stroke:#388e3c
    style DONE2 fill:#c8e6c9,stroke:#388e3c
    style BLOCK fill:#ffcdd2,stroke:#c62828
    style DECISION fill:#fff3e0,stroke:#f57c00
    style GATECHECK fill:#fff3e0,stroke:#f57c00
    style APPROVE fill:#fff3e0,stroke:#f57c00
    style QUICK fill:#f3e5f5,stroke:#7b1fa2
    style PROMOTE fill:#f3e5f5,stroke:#7b1fa2
    style VALIDATE fill:#f3e5f5,stroke:#7b1fa2
    style VALTICKET fill:#f3e5f5,stroke:#7b1fa2
```

---

## 7. Context Gathering Process

Shows how context.mjs collects environment information.

```mermaid
flowchart TD
    START[context.mjs invoked] --> GIT{In git<br/>repo?}

    GIT -->|Yes| GITROOT[git rev-parse<br/>--show-toplevel]
    GIT -->|No| NOGIT[git: null]

    GITROOT --> BRANCH[git branch<br/>--show-current]
    BRANCH --> STATUS[git status<br/>--short]

    STATUS --> GITDATA[Collect git data:<br/>root, branch, status]
    NOGIT --> TREE[Count files/directories]
    GITDATA --> TREE

    TREE --> EXCLUDE[Exclude:<br/>.git/, node_modules/, .takt/]
    EXCLUDE --> COUNT[Count files,<br/>calculate total size]

    COUNT --> LANG[Detect languages<br/>from file extensions]

    LANG --> ENV[Get environment:<br/>Node.js version<br/>Python version<br/>Platform]

    ENV --> JSON[Build context JSON]

    JSON --> WRITE[Write to:<br/>.takt/artifacts/quick/<id>/context.json]

    WRITE --> ERROR{Any errors<br/>occurred?}

    ERROR -->|Yes| WARN[Log warnings<br/>Continue with partial data]
    ERROR -->|No| DONE[Return context object]

    WARN --> DONE

    style START fill:#e3f2fd,stroke:#1976d2
    style DONE fill:#c8e6c9,stroke:#388e3c
    style WARN fill:#fff9c4,stroke:#f57f17
    style GIT fill:#fff3e0,stroke:#f57c00
    style ERROR fill:#fff3e0,stroke:#f57c00
```

---

## 8. Config.yaml Loading and Defaults

Shows how configuration is resolved with fallback to defaults.

```mermaid
flowchart TD
    START[Skill needs config] --> EXISTS{.takt/config.yaml<br/>exists?}

    EXISTS -->|No| DEFAULTS[Use hardcoded defaults:<br/>preset: auto<br/>timeout: 300000<br/>retention: all]

    EXISTS -->|Yes| PARSE[Parse YAML<br/>via yaml-parse.mjs]

    PARSE --> VALID{Valid<br/>YAML?}

    VALID -->|No| ERROR[Log parse error<br/>Fall back to defaults]
    VALID -->|Yes| MERGE[Merge with defaults<br/>User config overrides]

    ERROR --> DEFAULTS

    MERGE --> VALIDATE{Values<br/>valid?}

    VALIDATE -->|No| WARN[Warn about invalid values<br/>Use defaults for those fields]
    VALIDATE -->|Yes| USE[Use merged config]

    WARN --> USE
    DEFAULTS --> USE

    USE --> RETURN[Return config object]

    style START fill:#e3f2fd,stroke:#1976d2
    style RETURN fill:#c8e6c9,stroke:#388e3c
    style ERROR fill:#ffcdd2,stroke:#c62828
    style WARN fill:#fff9c4,stroke:#f57f17
    style EXISTS fill:#fff3e0,stroke:#f57c00
    style VALID fill:#fff3e0,stroke:#f57c00
    style VALIDATE fill:#fff3e0,stroke:#f57c00
```

---

## 9. Artifact Retention Flow

Shows how artifacts are managed based on retention policy.

```mermaid
flowchart TD
    START[Artifact created] --> TYPE{Artifact<br/>type?}

    TYPE -->|Quick entry| QARTIFACT[.takt/artifacts/quick/<id>/]
    TYPE -->|Ticket| TARTIFACT[.takt/artifacts/ticket/<id>/]

    QARTIFACT --> QEVENT{Event?}
    TARTIFACT --> TEVENT{Event?}

    QEVENT -->|Entry promoted| QCONFIG{retention<br/>policy?}
    QEVENT -->|Entry deleted| QDELETE[Delete artifacts]

    QCONFIG -->|all| QKEEP[Keep quick artifacts]
    QCONFIG -->|promoted-only| QDELETE
    QCONFIG -->|none| QDELETE

    TEVENT -->|Ticket completed| TKEEP[Keep ticket artifacts]
    TEVENT -->|Ticket deleted| TDELETE[Delete artifacts]

    QKEEP --> SIZE1{Log size<br/>> max_log_size?}
    TKEEP --> SIZE2{Log size<br/>> max_log_size?}

    SIZE1 -->|Yes| TRUNC1[Truncate logs<br/>Add warning]
    SIZE1 -->|No| DONE1[Artifacts retained]

    SIZE2 -->|Yes| TRUNC2[Truncate logs<br/>Add warning]
    SIZE2 -->|No| DONE2[Artifacts retained]

    TRUNC1 --> DONE1
    TRUNC2 --> DONE2
    QDELETE --> DONE3[Artifacts deleted]
    TDELETE --> DONE3

    style START fill:#e3f2fd,stroke:#1976d2
    style DONE1 fill:#c8e6c9,stroke:#388e3c
    style DONE2 fill:#c8e6c9,stroke:#388e3c
    style DONE3 fill:#ffcdd2,stroke:#c62828
    style TYPE fill:#fff3e0,stroke:#f57c00
    style QEVENT fill:#fff3e0,stroke:#f57c00
    style TEVENT fill:#fff3e0,stroke:#f57c00
    style QCONFIG fill:#fff3e0,stroke:#f57c00
    style SIZE1 fill:#fff3e0,stroke:#f57c00
    style SIZE2 fill:#fff3e0,stroke:#f57c00
```

---

## 10. Error Handling Decision Tree

Shows how errors are handled across different components.

```mermaid
flowchart TD
    ERROR[Error occurred] --> WHERE{Component?}

    WHERE -->|Quick entry creation| QERR{Error type?}
    WHERE -->|Validation| VERR{Error type?}
    WHERE -->|Promotion| PERR{Error type?}
    WHERE -->|Review gate| RERR{Error type?}

    QERR -->|.takt/ missing| QCREATE[Run init-project.mjs<br/>Create .takt/]
    QERR -->|Context gathering failed| QWARN[Warn user<br/>Create with partial context]
    QERR -->|Template render failed| QFATAL[Fatal error<br/>Don't create entry]

    VERR -->|No preset detected| VHELP[Show help message<br/>Suggest custom config]
    VERR -->|All commands skipped| VFATAL[Fatal error<br/>No validation possible]
    VERR -->|Command timeout| VLOG[Log timeout<br/>Mark as failed<br/>Continue]
    VERR -->|Tool not found| VSKIP[Skip with warning<br/>Continue if not required]

    PERR -->|Entry not found| PFATAL[Fatal error<br/>List available entries]
    PERR -->|Already promoted| PINFO[Show existing ticket<br/>Don't re-promote]
    PERR -->|Milestone missing| PCREATE[Create ad-hoc milestone]
    PERR -->|Agent missing| PWARN[Warn user<br/>Leave unassigned]

    RERR -->|Checkboxes unchecked| RBLOCK[Block with exit code 2<br/>List missing criteria]
    RERR -->|Status not completed| RBLOCK
    RERR -->|No commits| RBLOCK
    RERR -->|Validation missing| RBLOCK

    QCREATE --> RETRY1[Retry operation]
    QWARN --> CONT1[Continue]
    QFATAL --> EXIT1[Exit with error]

    VHELP --> EXIT2[Exit with error]
    VFATAL --> EXIT2
    VLOG --> CONT2[Continue]
    VSKIP --> CONT2

    PFATAL --> EXIT3[Exit with error]
    PINFO --> EXIT3
    PCREATE --> CONT3[Continue]
    PWARN --> CONT3

    RBLOCK --> EXIT4[Exit with code 2<br/>Block completion]

    style ERROR fill:#ffcdd2,stroke:#c62828
    style EXIT1 fill:#ffcdd2,stroke:#c62828
    style EXIT2 fill:#ffcdd2,stroke:#c62828
    style EXIT3 fill:#ffcdd2,stroke:#c62828
    style EXIT4 fill:#ffcdd2,stroke:#c62828
    style QFATAL fill:#ffcdd2,stroke:#c62828
    style VFATAL fill:#ffcdd2,stroke:#c62828
    style PFATAL fill:#ffcdd2,stroke:#c62828
    style PINFO fill:#ffcdd2,stroke:#c62828
    style RBLOCK fill:#ffcdd2,stroke:#c62828
    style QWARN fill:#fff9c4,stroke:#f57f17
    style VLOG fill:#fff9c4,stroke:#f57f17
    style VSKIP fill:#fff9c4,stroke:#f57f17
    style PWARN fill:#fff9c4,stroke:#f57f17
    style CONT1 fill:#c8e6c9,stroke:#388e3c
    style CONT2 fill:#c8e6c9,stroke:#388e3c
    style CONT3 fill:#c8e6c9,stroke:#388e3c
    style RETRY1 fill:#c8e6c9,stroke:#388e3c
    style QCREATE fill:#c8e6c9,stroke:#388e3c
    style PCREATE fill:#c8e6c9,stroke:#388e3c
    style WHERE fill:#fff3e0,stroke:#f57c00
    style QERR fill:#fff3e0,stroke:#f57c00
    style VERR fill:#fff3e0,stroke:#f57c00
    style PERR fill:#fff3e0,stroke:#f57c00
    style RERR fill:#fff3e0,stroke:#f57c00
```

---

**Last Updated:** 2026-02-16
**Contributors:** Takt Team

**Note:** These diagrams use Mermaid syntax and can be rendered in:
- GitHub markdown files
- GitLab markdown files
- Documentation sites (MkDocs, Docusaurus, etc.)
- VS Code with Mermaid extension
- Online viewers (mermaid.live)
