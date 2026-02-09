#!/usr/bin/env node

/**
 * worktree-setup.mjs - Git worktree management for MAMH agents
 *
 * Creates isolated git worktrees for each agent with write access, ensuring
 * agents cannot step on each other's files during parallel execution.
 *
 * Usage:
 *   node worktree-setup.mjs [project-directory]
 *   node worktree-setup.mjs --cleanup [project-directory]
 *   node worktree-setup.mjs --merge [project-directory]
 *
 * Behavior:
 *   - Reads .mamh/agents/registry.json for agent list
 *   - Creates a git worktree per write-capable agent
 *   - Updates registry.json with worktreePath for each agent
 *   - Idempotent: safe to run multiple times
 *
 * Flags:
 *   --cleanup   Remove all MAMH worktrees and clean up branches
 *   --merge     Merge all agent branches back to main (delegates to worktree-merge.mjs)
 *
 * Exit codes:
 *   0 = success
 *   1 = error
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKTREE_DIR = ".worktrees";
const WORKTREE_PREFIX = "mamh-";
const BRANCH_PREFIX = "mamh/";

// Tools that indicate write access
const WRITE_TOOLS = [
  "Write",
  "Edit",
  "MultiEdit",
  "NotebookEdit",
  "CreateFile",
  "RenameFile",
  "DeleteFile",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Execute a git command in the given directory. Returns stdout as a string.
 * Throws on non-zero exit code.
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
 * Check if the given directory is inside a git repository.
 */
function isGitRepo(dir) {
  try {
    git("rev-parse --is-inside-work-tree", dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the list of existing git worktree paths.
 */
function listWorktrees(projectDir) {
  try {
    const output = git("worktree list --porcelain", projectDir);
    const paths = [];
    for (const line of output.split("\n")) {
      if (line.startsWith("worktree ")) {
        paths.push(line.slice("worktree ".length));
      }
    }
    return paths;
  } catch {
    return [];
  }
}

/**
 * Check if a local branch exists.
 */
function branchExists(branchName, projectDir) {
  try {
    git(`rev-parse --verify refs/heads/${branchName}`, projectDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determine if an agent has write access by checking its tools list
 * or a hasWriteAccess field in the registry.
 */
function agentHasWriteAccess(agentConfig) {
  // Explicit field takes precedence
  if (typeof agentConfig.hasWriteAccess === "boolean") {
    return agentConfig.hasWriteAccess;
  }

  // Check tools list for write tools
  const tools = agentConfig.tools || [];
  return tools.some((tool) => WRITE_TOOLS.includes(tool));
}

/**
 * Ensure .worktrees/ is in .gitignore.
 */
function ensureGitignore(projectDir) {
  const gitignorePath = join(projectDir, ".gitignore");
  const entry = WORKTREE_DIR + "/";

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    // Check if already present (exact line match)
    const lines = content.split("\n").map((l) => l.trim());
    if (lines.includes(entry) || lines.includes(WORKTREE_DIR)) {
      return false; // Already present
    }
    // Append
    const separator = content.endsWith("\n") ? "" : "\n";
    writeFileSync(gitignorePath, content + separator + entry + "\n", "utf-8");
    return true;
  } else {
    writeFileSync(gitignorePath, entry + "\n", "utf-8");
    return true;
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Main setup: create worktrees for all write-capable agents.
 */
function setupWorktrees(projectDir) {
  if (!isGitRepo(projectDir)) {
    process.stderr.write("Error: Not a git repository. Worktrees require git.\n");
    process.exit(1);
  }

  // Read registry
  const registryPath = join(projectDir, ".mamh", "agents", "registry.json");
  if (!existsSync(registryPath)) {
    process.stderr.write("Error: Agent registry not found at .mamh/agents/registry.json\n");
    process.stderr.write("Run init-project.mjs first to initialize the MAMH project.\n");
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
  if (Object.keys(agents).length === 0) {
    process.stdout.write("No agents found in registry. Nothing to do.\n");
    process.exit(0);
  }

  // Ensure worktree directory exists
  const worktreeBase = join(projectDir, WORKTREE_DIR);
  if (!existsSync(worktreeBase)) {
    mkdirSync(worktreeBase, { recursive: true });
  }

  // Ensure .gitignore includes .worktrees/
  const gitignoreUpdated = ensureGitignore(projectDir);

  // Get existing worktrees for idempotency check
  const existingWorktrees = listWorktrees(projectDir);

  const created = [];
  const skipped = [];
  const errors = [];

  for (const [agentName, agentConfig] of Object.entries(agents)) {
    if (!agentHasWriteAccess(agentConfig)) {
      skipped.push({ name: agentName, reason: "no write access" });
      continue;
    }

    const worktreeName = `${WORKTREE_PREFIX}${agentName}`;
    const worktreePath = join(worktreeBase, worktreeName);
    const branchName = `${BRANCH_PREFIX}${agentName}`;
    const absoluteWorktreePath = resolve(worktreePath);

    // Check if worktree already exists
    if (existingWorktrees.includes(absoluteWorktreePath) || existsSync(worktreePath)) {
      // Update registry with path even if worktree already exists
      agentConfig.worktreePath = worktreePath;
      skipped.push({ name: agentName, reason: "worktree already exists" });
      continue;
    }

    try {
      if (branchExists(branchName, projectDir)) {
        // Branch exists, create worktree using existing branch
        git(`worktree add ${absoluteWorktreePath} ${branchName}`, projectDir);
      } else {
        // Create new branch from main
        git(`worktree add ${absoluteWorktreePath} -b ${branchName} main`, projectDir);
      }

      agentConfig.worktreePath = worktreePath;
      created.push({ name: agentName, path: worktreePath, branch: branchName });
    } catch (err) {
      errors.push({ name: agentName, error: err.message });
    }
  }

  // Update registry with worktree paths
  try {
    writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf-8");
  } catch (err) {
    process.stderr.write(`Error: Failed to update registry.json: ${err.message}\n`);
    process.exit(1);
  }

  // --- Print summary ---
  process.stdout.write("\nMAMH Worktree Setup\n");
  process.stdout.write("=".repeat(50) + "\n\n");

  if (gitignoreUpdated) {
    process.stdout.write("Updated .gitignore to include .worktrees/\n\n");
  }

  if (created.length > 0) {
    process.stdout.write(`Created worktrees (${created.length}):\n`);
    for (const w of created) {
      process.stdout.write(`  + ${w.name} -> ${w.path} [branch: ${w.branch}]\n`);
    }
    process.stdout.write("\n");
  }

  if (skipped.length > 0) {
    process.stdout.write(`Skipped (${skipped.length}):\n`);
    for (const s of skipped) {
      process.stdout.write(`  ~ ${s.name} (${s.reason})\n`);
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

  if (created.length === 0 && errors.length === 0) {
    process.stdout.write("Nothing to do - all worktrees already exist.\n");
  } else if (errors.length === 0) {
    process.stdout.write(`Done. Created ${created.length} worktrees.\n`);
  } else {
    process.stdout.write(`Done with errors. Created ${created.length}, failed ${errors.length}.\n`);
    process.exit(1);
  }
}

/**
 * Cleanup: remove all MAMH worktrees and optionally delete branches.
 */
function cleanupWorktrees(projectDir) {
  if (!isGitRepo(projectDir)) {
    process.stderr.write("Error: Not a git repository.\n");
    process.exit(1);
  }

  const registryPath = join(projectDir, ".mamh", "agents", "registry.json");
  let registry = null;
  if (existsSync(registryPath)) {
    try {
      registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    } catch {
      // Continue without registry
    }
  }

  const existingWorktrees = listWorktrees(projectDir);
  const worktreeBase = resolve(projectDir, WORKTREE_DIR);
  const removed = [];
  const errors = [];

  // Remove worktrees that are under .worktrees/mamh-*
  for (const wtPath of existingWorktrees) {
    if (wtPath.startsWith(worktreeBase) && wtPath.includes(WORKTREE_PREFIX)) {
      try {
        git(`worktree remove ${wtPath} --force`, projectDir);
        removed.push(wtPath);
      } catch (err) {
        errors.push({ path: wtPath, error: err.message });
      }
    }
  }

  // Clean up branches
  if (registry && registry.agents) {
    for (const [agentName, agentConfig] of Object.entries(registry.agents)) {
      const branchName = `${BRANCH_PREFIX}${agentName}`;
      if (branchExists(branchName, projectDir)) {
        try {
          git(`branch -D ${branchName}`, projectDir);
        } catch {
          // Branch deletion failure is non-critical
        }
      }
      // Clear worktree path from registry
      delete agentConfig.worktreePath;
    }

    try {
      writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf-8");
    } catch {
      // Non-critical
    }
  }

  // Prune worktree metadata
  try {
    git("worktree prune", projectDir);
  } catch {
    // Non-critical
  }

  // --- Print summary ---
  process.stdout.write("\nMAMH Worktree Cleanup\n");
  process.stdout.write("=".repeat(50) + "\n\n");

  if (removed.length > 0) {
    process.stdout.write(`Removed worktrees (${removed.length}):\n`);
    for (const r of removed) {
      process.stdout.write(`  - ${r}\n`);
    }
    process.stdout.write("\n");
  }

  if (errors.length > 0) {
    process.stderr.write(`Errors (${errors.length}):\n`);
    for (const e of errors) {
      process.stderr.write(`  ! ${e.path}: ${e.error}\n`);
    }
    process.stderr.write("\n");
  }

  if (removed.length === 0 && errors.length === 0) {
    process.stdout.write("No MAMH worktrees found. Nothing to clean up.\n");
  } else {
    process.stdout.write(`Done. Removed ${removed.length} worktrees.\n`);
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const positional = args.filter((a) => !a.startsWith("--"));

  const projectDir = resolve(positional[0] || process.cwd());

  if (!existsSync(projectDir)) {
    process.stderr.write(`Error: Directory does not exist: ${projectDir}\n`);
    process.exit(1);
  }

  if (flags.includes("--cleanup")) {
    cleanupWorktrees(projectDir);
  } else if (flags.includes("--merge")) {
    // Delegate to worktree-merge.mjs
    const mergeScript = join(import.meta.url.replace("file://", ""), "..", "worktree-merge.mjs");
    process.stdout.write("Delegating to worktree-merge.mjs...\n");
    try {
      execSync(`node ${resolve(mergeScript)} ${projectDir}`, {
        cwd: projectDir,
        stdio: "inherit",
      });
    } catch (err) {
      process.exit(err.status || 1);
    }
  } else {
    setupWorktrees(projectDir);
  }
}

try {
  main();
} catch (err) {
  process.stderr.write(`worktree-setup: Unexpected error: ${err.message}\n`);
  process.exit(1);
}
