#!/usr/bin/env node

/**
 * validate.mjs - Validation runner for Takt projects
 *
 * Executes preset validation commands (lint, typecheck, test, format)
 * and captures outputs as structured JSON.
 *
 * Usage:
 *   node validate.mjs [project-dir] --preset <python|node|auto> [--config <config.yaml>]
 *
 * Output: JSON to stdout with per-command results and summary.
 *
 * Zero external dependencies. Uses child_process.execSync with configurable
 * timeouts (default 300s per command).
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    projectDir: process.cwd(),
    preset: "auto",
    config: null,
  };

  let i = 2; // skip node and script path
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--preset" && i + 1 < argv.length) {
      args.preset = argv[i + 1].toLowerCase();
      i += 2;
    } else if (arg === "--config" && i + 1 < argv.length) {
      args.config = resolve(argv[i + 1]);
      i += 2;
    } else if (!arg.startsWith("--")) {
      args.projectDir = resolve(arg);
      i += 1;
    } else {
      // Unknown flag — skip
      i += 1;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes per command

/**
 * Check if a command exists in PATH.
 * Returns true if the command is available.
 */
function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a validation command and capture results.
 *
 * @param {string} name - Human-readable name for this check
 * @param {string} command - Shell command to execute
 * @param {string} cwd - Working directory
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {object} Result object with name, command, exitCode, stdout, stderr, durationMs, passed, skipped
 */
function runCommand(name, command, cwd, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();
  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    stdout = execSync(command, {
      cwd,
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    });
  } catch (err) {
    // execSync throws on non-zero exit codes
    exitCode = err.status || 1;
    stdout = err.stdout || "";
    stderr = err.stderr || "";
  }

  const durationMs = Date.now() - start;

  // Truncate large outputs
  const maxLen = 10000;
  if (stdout.length > maxLen) {
    stdout = stdout.slice(0, maxLen) + "\n... (truncated)";
  }
  if (stderr.length > maxLen) {
    stderr = stderr.slice(0, maxLen) + "\n... (truncated)";
  }

  return {
    name,
    command,
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    durationMs,
    passed: exitCode === 0,
    skipped: false,
  };
}

/**
 * Create a skipped result entry.
 */
function skippedResult(name, reason) {
  return {
    name,
    command: null,
    exitCode: null,
    stdout: "",
    stderr: reason,
    durationMs: 0,
    passed: false,
    skipped: true,
  };
}

/**
 * Detect the project preset based on files present.
 *
 * @param {string} dir - Project directory
 * @returns {string[]} Array of presets to run (e.g., ["python"], ["node"], ["python", "node"])
 */
function detectPreset(dir) {
  const hasPython =
    existsSync(join(dir, "pyproject.toml")) ||
    existsSync(join(dir, "requirements.txt")) ||
    existsSync(join(dir, "setup.py"));

  const hasNode = existsSync(join(dir, "package.json"));

  if (hasPython && hasNode) return ["python", "node"];
  if (hasPython) return ["python"];
  if (hasNode) return ["node"];

  return [];
}

/**
 * Read and parse package.json from the project directory.
 * Returns the parsed object or null if not found/invalid.
 */
function readPackageJson(dir) {
  const pkgPath = join(dir, "package.json");
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Detect the Node.js package manager for the project.
 */
function detectNodePackageManager(dir) {
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "bun.lockb"))) return "bun";
  return "npm";
}

/**
 * Check if a package.json has a specific script defined.
 */
function hasScript(pkg, name) {
  return pkg && pkg.scripts && typeof pkg.scripts[name] === "string";
}

/**
 * Check if a test script is the default npm placeholder.
 */
function isDefaultTestScript(pkg) {
  if (!hasScript(pkg, "test")) return true;
  return pkg.scripts.test.includes('echo "Error: no test specified"');
}

// ---------------------------------------------------------------------------
// Preset command builders
// ---------------------------------------------------------------------------

/**
 * Build Python validation commands.
 * Only includes commands for tools that are available in PATH.
 */
function buildPythonCommands(dir) {
  const commands = [];

  // 1. compileall — always available with Python
  if (commandExists("python") || commandExists("python3")) {
    const python = commandExists("python3") ? "python3" : "python";
    commands.push({
      name: "compileall",
      command: `${python} -m compileall -q .`,
    });
  }

  // Detect if uv is available for running tools
  const hasUv = commandExists("uv");

  // 2. ruff check
  if (commandExists("ruff")) {
    commands.push({
      name: "ruff-check",
      command: hasUv ? "uv run ruff check ." : "ruff check .",
    });
  }

  // 3. ruff format --check
  if (commandExists("ruff")) {
    commands.push({
      name: "ruff-format",
      command: hasUv ? "uv run ruff format --check ." : "ruff format --check .",
    });
  }

  // 4. pytest
  if (commandExists("pytest")) {
    commands.push({
      name: "pytest",
      command: hasUv ? "uv run pytest -q" : "pytest -q",
    });
  }

  // 5. mypy
  if (commandExists("mypy")) {
    commands.push({
      name: "mypy",
      command: hasUv ? "uv run mypy ." : "mypy .",
    });
  }

  return commands;
}

/**
 * Build Node.js validation commands.
 * Detects package manager and available scripts.
 */
function buildNodeCommands(dir) {
  const commands = [];
  const pm = detectNodePackageManager(dir);
  const pkg = readPackageJson(dir);

  if (!pkg) {
    return []; // No valid package.json — nothing to run
  }

  // 1. Lint
  if (hasScript(pkg, "lint")) {
    commands.push({
      name: "lint",
      command: `${pm} run lint`,
    });
  }

  // 2. Typecheck
  if (hasScript(pkg, "typecheck")) {
    commands.push({
      name: "typecheck",
      command: `${pm} run typecheck`,
    });
  } else if (existsSync(join(dir, "tsconfig.json"))) {
    commands.push({
      name: "typecheck",
      command: "npx tsc --noEmit",
    });
  }

  // 3. Test
  if (hasScript(pkg, "test") && !isDefaultTestScript(pkg)) {
    commands.push({
      name: "test",
      command: `${pm} test`,
    });
  }

  // 4. Format check
  if (hasScript(pkg, "format:check")) {
    commands.push({
      name: "format-check",
      command: `${pm} run format:check`,
    });
  } else if (hasScript(pkg, "fmt:check")) {
    commands.push({
      name: "format-check",
      command: `${pm} run fmt:check`,
    });
  }

  return commands;
}

// ---------------------------------------------------------------------------
// Config overrides
// ---------------------------------------------------------------------------

/**
 * Load and merge config overrides from a YAML config file.
 * Uses parseYaml from yaml-parse.mjs.
 */
async function loadConfigOverrides(configPath) {
  if (!configPath || !existsSync(configPath)) {
    return null;
  }

  try {
    // Dynamic import of yaml-parse.mjs from the same directory
    const { parseYaml } = await import("./yaml-parse.mjs");
    const raw = readFileSync(configPath, "utf-8");
    return parseYaml(raw);
  } catch (err) {
    process.stderr.write(`validate: Warning: could not load config ${configPath}: ${err.message}\n`);
    return null;
  }
}

/**
 * Extract custom commands from config and append to the commands list.
 * Looks for validate.commands[] in the config object.
 */
function getCustomCommands(config) {
  if (!config || !config.validate || !Array.isArray(config.validate.commands)) {
    return [];
  }

  return config.validate.commands
    .filter((entry) => {
      if (typeof entry === "string") return true;
      if (typeof entry === "object" && entry.command) return true;
      return false;
    })
    .map((entry) => {
      if (typeof entry === "string") {
        return { name: entry.split(" ")[0], command: entry };
      }
      return {
        name: entry.name || entry.command.split(" ")[0],
        command: entry.command,
      };
    });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const dir = args.projectDir;

  // Verify project directory exists
  if (!existsSync(dir)) {
    process.stderr.write(`validate: Directory does not exist: ${dir}\n`);
    process.exit(1);
  }

  // Determine presets to run
  let presets;

  if (args.preset === "auto") {
    presets = detectPreset(dir);
    if (presets.length === 0) {
      process.stderr.write(
        "validate: Could not auto-detect project type. " +
        "No package.json, pyproject.toml, requirements.txt, or setup.py found.\n" +
        "Use --preset <python|node> to specify manually.\n",
      );
      process.exit(1);
    }
  } else if (args.preset === "python") {
    presets = ["python"];
  } else if (args.preset === "node") {
    presets = ["node"];
  } else {
    process.stderr.write(`validate: Unknown preset "${args.preset}". Use python, node, or auto.\n`);
    process.exit(1);
  }

  // Load config overrides if provided
  const config = await loadConfigOverrides(args.config);

  // Build command list from all presets
  let allCommands = [];

  for (const preset of presets) {
    if (preset === "python") {
      allCommands.push(...buildPythonCommands(dir));
    } else if (preset === "node") {
      allCommands.push(...buildNodeCommands(dir));
    }
  }

  // Append custom commands from config
  if (config) {
    allCommands.push(...getCustomCommands(config));
  }

  // Run all commands and collect results
  const results = [];

  for (const cmd of allCommands) {
    const result = runCommand(cmd.name, cmd.command, dir);
    results.push(result);
  }

  // Build summary
  const total = results.length;
  const passed = results.filter((r) => r.passed && !r.skipped).length;
  const failed = results.filter((r) => !r.passed && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;

  const output = {
    preset: presets.length === 1 ? presets[0] : presets.join("+"),
    timestamp: new Date().toISOString(),
    results,
    summary: { total, passed, failed, skipped },
    overallPass: failed === 0,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`validate: Unexpected error: ${err.message}\n`);
  process.exit(1);
});
