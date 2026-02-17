#!/usr/bin/env node

/**
 * context.mjs - Context gathering script for Takt quick mode entries
 *
 * Collects project information including git status, recent commits,
 * directory tree, language/package-manager detection, and optional
 * scoped file/keyword search.
 *
 * Usage:
 *   node context.mjs [project-dir] [--scope <path/glob>] [--title "<title>"] [--output json|md]
 *
 * Output: JSON to stdout (default) or markdown summary (--output md).
 *
 * Zero external dependencies. Uses child_process.execSync with 5s timeouts.
 */

import { execSync, execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, basename, relative } from "node:path";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    projectDir: process.cwd(),
    scope: null,
    title: null,
    output: "json",
  };

  let i = 2; // skip node and script path
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--scope" && i + 1 < argv.length) {
      args.scope = argv[i + 1];
      i += 2;
    } else if (arg === "--title" && i + 1 < argv.length) {
      args.title = argv[i + 1];
      i += 2;
    } else if (arg === "--output" && i + 1 < argv.length) {
      args.output = argv[i + 1];
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

/**
 * Execute a command and return stdout, or null on failure.
 * All commands have a 5-second timeout.
 */
function exec(command, cwd) {
  try {
    const result = execSync(command, {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Check if a directory is a git repository.
 */
function isGitRepo(dir) {
  return exec("git rev-parse --is-inside-work-tree", dir) === "true";
}

// ---------------------------------------------------------------------------
// Git information gathering
// ---------------------------------------------------------------------------

function gatherGitInfo(dir) {
  if (!isGitRepo(dir)) {
    return {
      isRepo: false,
      branch: null,
      status: [],
      recentCommits: [],
      diffStat: null,
    };
  }

  const branch = exec("git branch --show-current", dir) || null;

  // git status --porcelain
  const statusRaw = exec("git status --porcelain", dir);
  const status = statusRaw
    ? statusRaw.split("\n").filter((l) => l.trim() !== "")
    : [];

  // Recent commits (last 10)
  const logRaw = exec("git log --oneline -10", dir);
  const recentCommits = logRaw
    ? logRaw.split("\n").filter((l) => l.trim() !== "")
    : [];

  // Diff stat
  const diffStat = exec("git diff --stat", dir) || null;

  return {
    isRepo: true,
    branch,
    status,
    recentCommits,
    diffStat,
  };
}

// ---------------------------------------------------------------------------
// Directory tree (respects .gitignore, max depth 3)
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".takt",
  "__pycache__",
  ".venv",
  "venv",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".next",
  ".nuxt",
  "dist",
  "build",
  ".tox",
  ".eggs",
  "*.egg-info",
  ".DS_Store",
]);

function buildTree(dir, prefix, depth, maxDepth, lineCount) {
  if (depth > maxDepth || lineCount.value >= 500) {
    return [];
  }

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  // Sort: directories first, then files, both alphabetical
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const lines = [];

  for (let i = 0; i < entries.length; i++) {
    if (lineCount.value >= 500) break;

    const entry = entries[i];
    const name = entry.name;

    // Skip hidden files (except a few useful ones) and known noise directories
    if (name.startsWith(".") && name !== ".env.example" && name !== ".gitignore") {
      continue;
    }
    if (SKIP_DIRS.has(name)) continue;

    const isLast = (() => {
      for (let j = i + 1; j < entries.length; j++) {
        const n = entries[j].name;
        if (n.startsWith(".") && n !== ".env.example" && n !== ".gitignore") continue;
        if (SKIP_DIRS.has(n)) continue;
        return false;
      }
      return true;
    })();
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";

    if (entry.isDirectory()) {
      lines.push(`${prefix}${connector}${name}/`);
      lineCount.value++;

      const children = buildTree(
        join(dir, name),
        prefix + childPrefix,
        depth + 1,
        maxDepth,
        lineCount,
      );
      lines.push(...children);
    } else {
      lines.push(`${prefix}${connector}${name}`);
      lineCount.value++;
    }
  }

  return lines;
}

function gatherTree(dir) {
  const lineCount = { value: 0 };
  const rootName = basename(dir) + "/";
  const lines = [rootName, ...buildTree(dir, "", 0, 3, lineCount)];

  if (lineCount.value >= 500) {
    lines.push("... (truncated at 500 entries)");
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Language and package manager detection
// ---------------------------------------------------------------------------

const LANGUAGE_MARKERS = [
  { file: "package.json", language: "node" },
  { file: "tsconfig.json", language: "typescript" },
  { file: "pyproject.toml", language: "python" },
  { file: "setup.py", language: "python" },
  { file: "requirements.txt", language: "python" },
  { file: "Pipfile", language: "python" },
  { file: "go.mod", language: "go" },
  { file: "Cargo.toml", language: "rust" },
  { file: "Gemfile", language: "ruby" },
  { file: "pom.xml", language: "java" },
  { file: "build.gradle", language: "java" },
  { file: "build.gradle.kts", language: "kotlin" },
  { file: "mix.exs", language: "elixir" },
  { file: "pubspec.yaml", language: "dart" },
  { file: "composer.json", language: "php" },
];

const PACKAGE_MANAGER_MARKERS = [
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "bun.lockb", pm: "bun" },
  { file: "package-lock.json", pm: "npm" },
  { file: "Pipfile.lock", pm: "pipenv" },
  { file: "poetry.lock", pm: "poetry" },
  { file: "uv.lock", pm: "uv" },
];

function detectLanguages(dir) {
  const detected = [];

  for (const marker of LANGUAGE_MARKERS) {
    if (existsSync(join(dir, marker.file))) {
      if (!detected.includes(marker.language)) {
        detected.push(marker.language);
      }
    }
  }

  return detected;
}

function detectPackageManager(dir) {
  for (const marker of PACKAGE_MANAGER_MARKERS) {
    if (existsSync(join(dir, marker.file))) {
      return marker.pm;
    }
  }

  // Fallback: if package.json exists but no lockfile detected
  if (existsSync(join(dir, "package.json"))) {
    return "npm";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Scope matching and keyword search
// ---------------------------------------------------------------------------

/**
 * Find files matching a scope pattern (simple glob or directory path).
 * Uses `git ls-files` if in a git repo, otherwise falls back to readdir.
 */
function findScopeFiles(dir, scope) {
  // Try git ls-files first (respects .gitignore)
  // Use execFileSync with argument array to avoid shell injection
  let gitResult = null;
  try {
    gitResult = execFileSync("git", ["ls-files", "--", scope], {
      cwd: dir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    gitResult = null;
  }
  if (gitResult) {
    return gitResult.split("\n").filter((l) => l.trim() !== "").slice(0, 100);
  }

  // Fallback: check if scope is a directory
  const scopePath = resolve(dir, scope);
  if (existsSync(scopePath)) {
    try {
      const stat = statSync(scopePath);
      if (stat.isDirectory()) {
        const files = [];
        const entries = readdirSync(scopePath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) {
            files.push(relative(dir, join(scopePath, entry.name)));
          }
        }
        return files.slice(0, 100);
      } else {
        return [relative(dir, scopePath)];
      }
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Best-effort grep for title keywords in scoped files.
 * Splits the title into keywords and searches for each.
 */
function searchTitleInScope(dir, scope, title) {
  if (!title || !scope) return [];

  // Extract meaningful keywords (skip short words)
  const keywords = title
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter((w) => w.length > 0);

  if (keywords.length === 0) return [];

  const matches = [];

  for (const keyword of keywords.slice(0, 5)) {
    // Use execFileSync with argument arrays to avoid shell injection
    let result = null;
    try {
      result = execFileSync("git", ["grep", "-l", "-i", keyword, "--", scope], {
        cwd: dir,
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      // git grep failed or not in a git repo — try plain grep
      try {
        result = execFileSync("grep", ["-rl", "-i", keyword, scope], {
          cwd: dir,
          encoding: "utf-8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
      } catch {
        result = null;
      }
    }
    if (result) {
      const files = result.split("\n").filter((l) => l.trim() !== "");
      for (const file of files) {
        if (!matches.includes(file)) {
          matches.push(file);
        }
      }
    }
    if (matches.length >= 20) break;
  }

  return matches.slice(0, 20);
}

// ---------------------------------------------------------------------------
// Output formatters
// ---------------------------------------------------------------------------

function formatJson(context) {
  return JSON.stringify(context, null, 2);
}

function formatMarkdown(context) {
  const lines = [];

  lines.push("# Project Context");
  lines.push("");
  lines.push(`**Directory:** \`${context.projectDir}\``);
  lines.push(`**Languages:** ${context.languages.join(", ") || "unknown"}`);
  if (context.packageManager) {
    lines.push(`**Package Manager:** ${context.packageManager}`);
  }
  lines.push("");

  // Git info
  if (context.git.isRepo) {
    lines.push("## Git Status");
    lines.push("");
    if (context.git.branch) {
      lines.push(`**Branch:** ${context.git.branch}`);
    }
    if (context.git.status.length > 0) {
      lines.push("");
      lines.push("**Modified files:**");
      lines.push("```");
      for (const line of context.git.status.slice(0, 30)) {
        lines.push(line);
      }
      if (context.git.status.length > 30) {
        lines.push(`... and ${context.git.status.length - 30} more`);
      }
      lines.push("```");
    } else {
      lines.push("Working tree clean.");
    }
    lines.push("");

    if (context.git.recentCommits.length > 0) {
      lines.push("**Recent commits:**");
      lines.push("```");
      for (const commit of context.git.recentCommits) {
        lines.push(commit);
      }
      lines.push("```");
      lines.push("");
    }

    if (context.git.diffStat) {
      lines.push("**Diff stat:**");
      lines.push("```");
      lines.push(context.git.diffStat);
      lines.push("```");
      lines.push("");
    }
  } else {
    lines.push("## Git");
    lines.push("");
    lines.push("Not a git repository.");
    lines.push("");
  }

  // Directory tree
  lines.push("## Directory Tree");
  lines.push("");
  lines.push("```");
  for (const line of context.tree) {
    lines.push(line);
  }
  lines.push("```");
  lines.push("");

  // Scope matches
  if (context.scopeFiles && context.scopeFiles.length > 0) {
    lines.push("## Scoped Files");
    lines.push("");
    for (const file of context.scopeFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }

  // Title keyword matches
  if (context.titleMatches && context.titleMatches.length > 0) {
    lines.push("## Title Keyword Matches");
    lines.push("");
    for (const file of context.titleMatches) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);
  const dir = args.projectDir;

  // Verify project directory exists
  if (!existsSync(dir)) {
    process.stderr.write(`context: Directory does not exist: ${dir}\n`);
    process.exit(1);
  }

  // Gather all context
  const context = {
    projectDir: dir,
    timestamp: new Date().toISOString(),
    git: gatherGitInfo(dir),
    tree: gatherTree(dir),
    languages: detectLanguages(dir),
    packageManager: detectPackageManager(dir),
    scopeFiles: null,
    titleMatches: null,
  };

  // Optional scope filtering
  if (args.scope) {
    context.scopeFiles = findScopeFiles(dir, args.scope);
  }

  // Optional title keyword search
  if (args.title && args.scope) {
    context.titleMatches = searchTitleInScope(dir, args.scope, args.title);
  }

  // Output
  if (args.output === "md" || args.output === "markdown") {
    process.stdout.write(formatMarkdown(context) + "\n");
  } else {
    process.stdout.write(formatJson(context) + "\n");
  }

  process.exit(0);
}

main();
