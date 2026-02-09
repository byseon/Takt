#!/usr/bin/env node

/**
 * init-project.mjs - MAMH project initialization script
 *
 * Creates the .mamh/ directory structure with all required files and
 * subdirectories. Called by the skill during Phase 0 (project setup).
 *
 * Usage:
 *   node init-project.mjs [project-directory]
 *
 * If no project directory is provided, the current working directory is used.
 *
 * Behavior:
 *   - Creates all directories and default files
 *   - Does NOT overwrite existing files (safe to run multiple times)
 *   - Prints a summary of what was created vs. what already existed
 *
 * Exit codes:
 *   0 = success
 *   1 = error
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";

// ---------------------------------------------------------------------------
// Directory structure definition
// ---------------------------------------------------------------------------

const DIRECTORIES = [
  ".mamh",
  ".mamh/agents",
  ".mamh/tickets",
  ".mamh/tickets/milestones",
  ".mamh/tickets/archive",
  ".mamh/comms",
  ".mamh/state",
];

// ---------------------------------------------------------------------------
// Default file contents
// ---------------------------------------------------------------------------

function getTimestamp() {
  return new Date().toISOString();
}

function getDefaultFiles() {
  const now = getTimestamp();

  return {
    ".mamh/session.json": JSON.stringify(
      {
        name: "",
        description: "",
        phase: "planning",
        currentMilestone: null,
        agentApprovalMode: "suggest",
        milestoneAdvanceMode: "user-decides",
        reviewMode: "auto",
        createdAt: now,
        updatedAt: now,
      },
      null,
      2
    ),

    ".mamh/prd.md": "",

    ".mamh/tech-spec.md": "",

    ".mamh/constraints.md": "",

    ".mamh/agents/registry.json": JSON.stringify(
      {
        agents: {},
        version: 1,
      },
      null,
      2
    ),

    ".mamh/comms/decisions.md": "",

    ".mamh/comms/changelog.md": "",

    ".mamh/state/mamh-state.json": JSON.stringify(
      {
        phase: "planning",
        phaseHistory: [],
        currentMilestone: null,
        milestones: [],
        agentsSpawned: [],
        startedAt: now,
        lastUpdatedAt: now,
      },
      null,
      2
    ),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const projectDir = process.argv[2] || process.cwd();
  const absoluteProjectDir = resolve(projectDir);

  // Validate that the project directory exists
  if (!existsSync(absoluteProjectDir)) {
    process.stderr.write(`Error: Project directory does not exist: ${absoluteProjectDir}\n`);
    process.exit(1);
  }

  const created = { dirs: [], files: [] };
  const skipped = { dirs: [], files: [] };
  const errors = [];

  // --- Create directories ---
  for (const dir of DIRECTORIES) {
    const fullPath = join(absoluteProjectDir, dir);
    if (existsSync(fullPath)) {
      skipped.dirs.push(dir);
    } else {
      try {
        mkdirSync(fullPath, { recursive: true });
        created.dirs.push(dir);
      } catch (err) {
        errors.push(`Failed to create directory ${dir}: ${err.message}`);
      }
    }
  }

  // --- Create default files ---
  const defaultFiles = getDefaultFiles();

  for (const [filePath, content] of Object.entries(defaultFiles)) {
    const fullPath = join(absoluteProjectDir, filePath);

    if (existsSync(fullPath)) {
      skipped.files.push(filePath);
    } else {
      try {
        // Ensure parent directory exists (should already from above, but be safe)
        const parentDir = join(fullPath, "..");
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true });
        }
        writeFileSync(fullPath, content, "utf-8");
        created.files.push(filePath);
      } catch (err) {
        errors.push(`Failed to create file ${filePath}: ${err.message}`);
      }
    }
  }

  // --- Print summary ---
  const mamhRoot = join(absoluteProjectDir, ".mamh");
  process.stdout.write(`\nMAMH Project Initialized: ${mamhRoot}\n`);
  process.stdout.write("=".repeat(50) + "\n\n");

  if (created.dirs.length > 0) {
    process.stdout.write(`Created directories (${created.dirs.length}):\n`);
    for (const d of created.dirs) {
      process.stdout.write(`  + ${d}/\n`);
    }
    process.stdout.write("\n");
  }

  if (created.files.length > 0) {
    process.stdout.write(`Created files (${created.files.length}):\n`);
    for (const f of created.files) {
      process.stdout.write(`  + ${f}\n`);
    }
    process.stdout.write("\n");
  }

  if (skipped.dirs.length > 0 || skipped.files.length > 0) {
    const totalSkipped = skipped.dirs.length + skipped.files.length;
    process.stdout.write(`Skipped (already exist) (${totalSkipped}):\n`);
    for (const d of skipped.dirs) {
      process.stdout.write(`  ~ ${d}/\n`);
    }
    for (const f of skipped.files) {
      process.stdout.write(`  ~ ${f}\n`);
    }
    process.stdout.write("\n");
  }

  if (errors.length > 0) {
    process.stderr.write(`Errors (${errors.length}):\n`);
    for (const e of errors) {
      process.stderr.write(`  ! ${e}\n`);
    }
    process.stderr.write("\n");
    process.exit(1);
  }

  const totalCreated = created.dirs.length + created.files.length;
  if (totalCreated === 0) {
    process.stdout.write("Nothing to do - all files and directories already exist.\n");
  } else {
    process.stdout.write(`Done. Created ${created.dirs.length} directories and ${created.files.length} files.\n`);
  }

  process.exit(0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`init-project: Unexpected error: ${err.message}\n`);
  process.exit(1);
}
