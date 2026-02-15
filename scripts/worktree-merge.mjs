#!/usr/bin/env node

/**
 * worktree-merge.mjs - Merge agent worktree branches back to main
 *
 * Used at milestone completion to integrate all agent work into the main branch.
 * Runs tests per-branch before merging and a full test suite after all merges.
 *
 * Usage:
 *   node worktree-merge.mjs [project-directory]
 *
 * Behavior:
 *   - Reads .takt/agents/registry.json for worktree info
 *   - For each agent with a worktree:
 *     1. Checks if branch has commits ahead of main
 *     2. Runs tests in the worktree (if test command is configured)
 *     3. Merges to main with --no-ff
 *   - On merge conflict: logs the conflict, skips branch, reports to user
 *   - After all merges: runs full test suite on main
 *   - Prints merge summary
 *
 * Exit codes:
 *   0 = success (all merges completed)
 *   1 = error or partial failure
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Execute a git command in the given directory. Returns stdout as a string.
 */
function git(args, cwd) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.trim() : err.message;
    throw new Error(`git ${args} failed: ${stderr}`);
  }
}

/**
 * Run a shell command and return { success, output }.
 */
function run(cmd, cwd) {
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 300000, // 5 minute timeout for test suites
    });
    return { success: true, output: output.trim() };
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "");
    return { success: false, output: output.trim() };
  }
}

/**
 * Check if a branch has commits ahead of main.
 * Returns the number of commits ahead.
 */
function commitsAheadOfMain(branchName, projectDir) {
  try {
    const count = git(`rev-list --count main..${branchName}`, projectDir);
    return parseInt(count, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Detect the project's test command by checking common configurations.
 */
function detectTestCommand(projectDir) {
  // Check package.json for npm test
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        return "npm test";
      }
    } catch {
      // Continue checking
    }
  }

  // Check for common test runners
  if (existsSync(join(projectDir, "pytest.ini")) || existsSync(join(projectDir, "setup.py"))) {
    return "python -m pytest";
  }

  if (existsSync(join(projectDir, "Makefile"))) {
    try {
      const makefile = readFileSync(join(projectDir, "Makefile"), "utf-8");
      if (makefile.includes("test:")) {
        return "make test";
      }
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Read session.json for any merge-related configuration.
 */
function getSessionConfig(projectDir) {
  const sessionPath = join(projectDir, ".takt", "session.json");
  try {
    return JSON.parse(readFileSync(sessionPath, "utf-8"));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const projectDir = resolve(process.argv[2] || process.cwd());

  if (!existsSync(projectDir)) {
    process.stderr.write(`Error: Directory does not exist: ${projectDir}\n`);
    process.exit(1);
  }

  // Read registry
  const registryPath = join(projectDir, ".takt", "agents", "registry.json");
  if (!existsSync(registryPath)) {
    process.stderr.write("Error: Agent registry not found at .takt/agents/registry.json\n");
    process.exit(1);
  }

  let registry;
  try {
    registry = JSON.parse(readFileSync(registryPath, "utf-8"));
  } catch (err) {
    process.stderr.write(`Error: Failed to parse registry.json: ${err.message}\n`);
    process.exit(1);
  }

  const agents = registry.agents || {};
  const testCommand = detectTestCommand(projectDir);

  // Ensure we are on main before merging
  try {
    const currentBranch = git("rev-parse --abbrev-ref HEAD", projectDir);
    if (currentBranch !== "main") {
      process.stdout.write(`Switching to main branch (currently on ${currentBranch})...\n`);
      git("checkout main", projectDir);
    }
  } catch (err) {
    process.stderr.write(`Error: Could not switch to main branch: ${err.message}\n`);
    process.exit(1);
  }

  // Collect agents with worktrees
  const agentBranches = [];
  for (const [agentName, agentConfig] of Object.entries(agents)) {
    if (agentConfig.worktreePath) {
      const branchName = `takt/${agentName}`;
      agentBranches.push({ name: agentName, branch: branchName, config: agentConfig });
    }
  }

  if (agentBranches.length === 0) {
    process.stdout.write("No agent worktrees found. Nothing to merge.\n");
    process.exit(0);
  }

  process.stdout.write("\nTakt Worktree Merge\n");
  process.stdout.write("=".repeat(50) + "\n\n");
  process.stdout.write(`Found ${agentBranches.length} agent branches to merge.\n`);
  if (testCommand) {
    process.stdout.write(`Test command: ${testCommand}\n`);
  } else {
    process.stdout.write("No test command detected. Skipping pre-merge tests.\n");
  }
  process.stdout.write("\n");

  const merged = [];
  const skippedNoChanges = [];
  const skippedTestFail = [];
  const conflicts = [];
  const errors = [];

  for (const agent of agentBranches) {
    const { name, branch, config } = agent;
    process.stdout.write(`--- ${name} (${branch}) ---\n`);

    // Check if branch has changes
    const ahead = commitsAheadOfMain(branch, projectDir);
    if (ahead === 0) {
      process.stdout.write(`  No changes ahead of main. Skipping.\n\n`);
      skippedNoChanges.push(name);
      continue;
    }

    process.stdout.write(`  ${ahead} commit(s) ahead of main.\n`);

    // Run tests in the worktree before merging
    if (testCommand && config.worktreePath) {
      const worktreeAbsolute = resolve(projectDir, config.worktreePath);
      if (existsSync(worktreeAbsolute)) {
        process.stdout.write(`  Running tests in worktree...\n`);
        const testResult = run(testCommand, worktreeAbsolute);
        if (!testResult.success) {
          process.stdout.write(`  Tests FAILED. Skipping merge.\n`);
          if (testResult.output) {
            process.stdout.write(`  Test output (last 5 lines):\n`);
            const lines = testResult.output.split("\n").slice(-5);
            for (const line of lines) {
              process.stdout.write(`    ${line}\n`);
            }
          }
          process.stdout.write("\n");
          skippedTestFail.push(name);
          continue;
        }
        process.stdout.write(`  Tests passed.\n`);
      }
    }

    // Attempt merge
    try {
      git(`merge --no-ff ${branch} -m "Merge ${branch}: integrate ${name} agent work"`, projectDir);
      process.stdout.write(`  Merged successfully.\n\n`);
      merged.push(name);
    } catch (err) {
      // Check if it is a merge conflict
      if (err.message.includes("CONFLICT") || err.message.includes("Automatic merge failed")) {
        process.stdout.write(`  MERGE CONFLICT detected. Aborting merge for this branch.\n\n`);
        // Abort the failed merge
        try {
          git("merge --abort", projectDir);
        } catch {
          // If abort fails, try reset
          try {
            git("reset --merge", projectDir);
          } catch {
            // Last resort
          }
        }
        conflicts.push({ name, error: err.message });
      } else {
        process.stdout.write(`  ERROR: ${err.message}\n\n`);
        // Try to clean up
        try {
          git("merge --abort", projectDir);
        } catch {
          // Ignore
        }
        errors.push({ name, error: err.message });
      }
    }
  }

  // Run full test suite on main after all merges
  if (merged.length > 0 && testCommand) {
    process.stdout.write("--- Running full test suite on main ---\n");
    const fullTest = run(testCommand, projectDir);
    if (fullTest.success) {
      process.stdout.write("  Full test suite PASSED.\n\n");
    } else {
      process.stdout.write("  Full test suite FAILED.\n");
      if (fullTest.output) {
        const lines = fullTest.output.split("\n").slice(-10);
        for (const line of lines) {
          process.stdout.write(`    ${line}\n`);
        }
      }
      process.stdout.write("\n");
    }
  }

  // --- Print summary ---
  process.stdout.write("=".repeat(50) + "\n");
  process.stdout.write("Merge Summary\n");
  process.stdout.write("=".repeat(50) + "\n\n");

  if (merged.length > 0) {
    process.stdout.write(`Merged (${merged.length}):\n`);
    for (const m of merged) {
      process.stdout.write(`  + ${m}\n`);
    }
    process.stdout.write("\n");
  }

  if (skippedNoChanges.length > 0) {
    process.stdout.write(`Skipped - no changes (${skippedNoChanges.length}):\n`);
    for (const s of skippedNoChanges) {
      process.stdout.write(`  ~ ${s}\n`);
    }
    process.stdout.write("\n");
  }

  if (skippedTestFail.length > 0) {
    process.stdout.write(`Skipped - tests failed (${skippedTestFail.length}):\n`);
    for (const s of skippedTestFail) {
      process.stdout.write(`  ! ${s}\n`);
    }
    process.stdout.write("\n");
  }

  if (conflicts.length > 0) {
    process.stdout.write(`Merge conflicts (${conflicts.length}):\n`);
    for (const c of conflicts) {
      process.stdout.write(`  ! ${c.name}: requires manual resolution\n`);
    }
    process.stdout.write("\n");
  }

  if (errors.length > 0) {
    process.stderr.write(`Errors (${errors.length}):\n`);
    for (const e of errors) {
      process.stderr.write(`  ! ${e.name}: ${e.error}\n`);
    }
    process.stderr.write("\n");
  }

  const totalIssues = skippedTestFail.length + conflicts.length + errors.length;
  if (totalIssues > 0) {
    process.stdout.write(`Done with issues. Merged ${merged.length}, issues ${totalIssues}.\n`);
    process.exit(1);
  } else {
    process.stdout.write(`Done. Merged ${merged.length} branches into main.\n`);
    process.exit(0);
  }
}

try {
  main();
} catch (err) {
  process.stderr.write(`worktree-merge: Unexpected error: ${err.message}\n`);
  process.exit(1);
}
