#!/usr/bin/env node

/**
 * scope-guard.mjs - PreToolUse hook for Write/Edit tools
 *
 * Enforces agent scope boundaries by checking whether the target file path
 * falls within the agent's allowed paths as defined in the Takt agent registry.
 *
 * Exit codes:
 *   0 = allow the write
 *   2 = block the write (scope violation)
 *   1 = internal error
 *
 * Receives hook context via stdin as JSON:
 * {
 *   "tool_name": "Write" | "Edit",
 *   "tool_input": { "file_path": "/path/to/file" },
 *   "agent_name": "takt-backend",
 *   "session_id": "..."
 * }
 */

import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

// ---------------------------------------------------------------------------
// Minimal glob matcher (supports ** and * patterns, no external deps)
// ---------------------------------------------------------------------------

/**
 * Match a file path against a glob pattern.
 *
 * Supported syntax:
 *   **  - matches any number of path segments (including zero)
 *   *   - matches any characters within a single path segment
 *   ?   - matches exactly one character
 *
 * All matching is done on normalized forward-slash paths.
 */
function globMatch(pattern, filePath) {
  // Normalize to forward slashes for consistent matching
  const normPattern = pattern.replace(/\\/g, "/");
  const normPath = filePath.replace(/\\/g, "/");

  // Convert glob pattern to a regular expression
  let regexStr = "^";
  let i = 0;

  while (i < normPattern.length) {
    const ch = normPattern[i];

    if (ch === "*") {
      if (normPattern[i + 1] === "*") {
        // ** pattern
        // Skip any trailing slash after **
        if (normPattern[i + 2] === "/") {
          // **/ matches zero or more path segments followed by /
          regexStr += "(?:.+/)?";
          i += 3;
        } else {
          // ** at end matches everything remaining
          regexStr += ".*";
          i += 2;
        }
      } else {
        // Single * matches anything except /
        regexStr += "[^/]*";
        i += 1;
      }
    } else if (ch === "?") {
      regexStr += "[^/]";
      i += 1;
    } else if (ch === ".") {
      regexStr += "\\.";
      i += 1;
    } else if (ch === "(") {
      regexStr += "\\(";
      i += 1;
    } else if (ch === ")") {
      regexStr += "\\)";
      i += 1;
    } else if (ch === "{") {
      regexStr += "\\{";
      i += 1;
    } else if (ch === "}") {
      regexStr += "\\}";
      i += 1;
    } else if (ch === "[") {
      regexStr += "\\[";
      i += 1;
    } else if (ch === "]") {
      regexStr += "\\]";
      i += 1;
    } else if (ch === "+") {
      regexStr += "\\+";
      i += 1;
    } else if (ch === "^") {
      regexStr += "\\^";
      i += 1;
    } else if (ch === "$") {
      regexStr += "\\$";
      i += 1;
    } else if (ch === "|") {
      regexStr += "\\|";
      i += 1;
    } else {
      regexStr += ch;
      i += 1;
    }
  }

  regexStr += "$";

  try {
    const regex = new RegExp(regexStr);
    return regex.test(normPath);
  } catch {
    // If regex construction fails, fall back to prefix matching
    const patternPrefix = normPattern.replace(/\*\*.*$/, "").replace(/\*.*$/, "");
    return normPath.startsWith(patternPrefix);
  }
}

/**
 * Check if a file path matches any of the allowed glob patterns.
 */
function isPathAllowed(filePath, allowedPaths) {
  if (!allowedPaths || allowedPaths.length === 0) {
    return false;
  }
  return allowedPaths.some((pattern) => globMatch(pattern, filePath));
}

/**
 * Find which agent (if any) owns the given file path.
 * Returns the agent name or null.
 */
function findOwningAgent(filePath, agents) {
  for (const [agentName, agentConfig] of Object.entries(agents)) {
    const paths = agentConfig.allowedPaths || agentConfig.scope || [];
    if (isPathAllowed(filePath, paths)) {
      return agentName;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let input;

  try {
    const rawInput = readFileSync("/dev/stdin", "utf-8");
    input = JSON.parse(rawInput);
  } catch (err) {
    process.stderr.write(`scope-guard: Failed to parse stdin input: ${err.message}\n`);
    // On parse failure, allow the operation (fail open) so we don't block
    // legitimate operations when the hook context is malformed.
    process.exit(0);
  }

  const toolName = input.tool_name || "Unknown";
  const toolInput = input.tool_input || {};
  const filePath = toolInput.file_path || toolInput.filePath || "";
  const agentName = input.agent_name || process.env.CLAUDE_AGENT_NAME || "";

  // If we cannot identify the agent, allow the operation (likely the orchestrator)
  if (!agentName) {
    process.exit(0);
  }

  // If there is no file path, allow (nothing to guard)
  if (!filePath) {
    process.exit(0);
  }

  // Resolve to absolute path
  const absolutePath = resolve(filePath);

  // Locate and read the agent registry
  const registryPaths = [
    resolve(".takt", "agents", "registry.json"),
    resolve(process.cwd(), ".takt", "agents", "registry.json"),
  ];

  let registry = null;

  for (const rp of registryPaths) {
    try {
      const raw = readFileSync(rp, "utf-8");
      registry = JSON.parse(raw);
      break;
    } catch {
      // Try next path
    }
  }

  // If no registry exists, allow the operation (Takt not initialized)
  if (!registry || !registry.agents) {
    process.exit(0);
  }

  const agents = registry.agents;
  const agentConfig = agents[agentName];

  // If the agent is not in the registry, allow (might be an unregistered agent)
  if (!agentConfig) {
    process.exit(0);
  }

  const allowedPaths = agentConfig.allowedPaths || agentConfig.scope || [];

  // If no scope restrictions defined, allow everything
  if (allowedPaths.length === 0) {
    process.exit(0);
  }

  // Check if the file is within the agent's allowed scope
  if (!isPathAllowed(absolutePath, allowedPaths)) {
    // --- SCOPE BLOCKED ---
    const owner = findOwningAgent(absolutePath, agents);
    const ownerHint = owner
      ? ` This file belongs to ${owner}'s scope. Send a message to ${owner} instead.`
      : " No agent is assigned to this path.";

    const message = `SCOPE VIOLATION: ${agentName} cannot write to ${absolutePath}.${ownerHint}`;
    process.stdout.write(message);
    process.exit(2);
  }

  // ---------------------------------------------------------------------------
  // Worktree enforcement
  // ---------------------------------------------------------------------------
  // If the agent has a worktreePath assigned, all writes must go to the worktree
  // directory, not the main working directory. This prevents agents from stepping
  // on each other's files during parallel execution.

  const worktreePath = agentConfig.worktreePath || null;

  if (worktreePath) {
    // Resolve the worktree path relative to the project root (cwd)
    const absoluteWorktreePath = resolve(worktreePath);

    // Normalize both paths for comparison (ensure trailing sep consistency)
    const normalizedWorktree = absoluteWorktreePath.endsWith(sep)
      ? absoluteWorktreePath
      : absoluteWorktreePath + sep;
    const normalizedFile = absolutePath;

    // Allow writes within the worktree
    const isInWorktree = normalizedFile.startsWith(normalizedWorktree) ||
      normalizedFile === absoluteWorktreePath;

    // Also allow writes to .takt/ directory (shared state that all agents need)
    const taktDir = resolve(".takt") + sep;
    const isInMamh = normalizedFile.startsWith(taktDir);

    if (!isInWorktree && !isInMamh) {
      const message =
        `WORKTREE VIOLATION: ${agentName} must write to their worktree at ` +
        `${worktreePath}/ instead of the main working directory. ` +
        `Target file: ${absolutePath}`;
      process.stdout.write(message);
      process.exit(2);
    }
  }

  // --- ALLOWED ---
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`scope-guard: Unexpected error: ${err.message}\n`);
  process.exit(1);
});
