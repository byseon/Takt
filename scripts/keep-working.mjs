#!/usr/bin/env node

/**
 * keep-working.mjs - TeammateIdle hook
 *
 * When an agent goes idle, this hook checks whether the agent still has
 * pending or in-progress tickets assigned to it. If so, it directs the
 * agent to claim and work on the next available ticket.
 *
 * Exit codes:
 *   0 = allow idle (agent's work is done for this milestone)
 *   2 = block idle (agent has remaining work to do)
 *   1 = internal error
 *
 * Receives hook context via stdin as JSON:
 * {
 *   "agent_name": "takt-backend",
 *   "session_id": "..."
 * }
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract ticket metadata from a markdown ticket file.
 * Looks for YAML-style front matter or inline metadata fields.
 *
 * Returns: { id, status, assignee } or null if unparseable.
 */
function parseTicketMetadata(content, filename) {
  const meta = {
    id: filename.replace(/\.md$/, ""),
    status: null,
    assignee: null,
  };

  // Try to extract from YAML-style front matter (--- delimited)
  const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontMatterMatch) {
    const fm = frontMatterMatch[1];
    const statusMatch = fm.match(/^status:\s*(.+)$/m);
    const assigneeMatch = fm.match(/^assignee:\s*(.+)$/m);
    const idMatch = fm.match(/^id:\s*(.+)$/m);

    if (statusMatch) meta.status = statusMatch[1].trim().toLowerCase();
    if (assigneeMatch) meta.assignee = assigneeMatch[1].trim().toLowerCase();
    if (idMatch) meta.id = idMatch[1].trim();
  }

  // Try inline metadata patterns (e.g., **Status:** pending)
  // Note: tickets use **Status:** (colon inside bold), not **Status**:
  if (!meta.status) {
    const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i)
      || content.match(/\*\*status\*\*:\s*(.+)/i)
      || content.match(/status:\s*`?([^`\n]+)`?/i);
    if (statusMatch) {
      // Clean any stray markdown from captured value
      meta.status = statusMatch[1].replace(/\*+/g, "").trim().toLowerCase();
    }
  }

  if (!meta.assignee) {
    // Tickets use **Agent:** not **Assignee:**
    const assigneeMatch = content.match(/\*\*Agent:\*\*\s*(.+)/i)
      || content.match(/\*\*Assignee:\*\*\s*(.+)/i)
      || content.match(/\*\*assignee\*\*:\s*(.+)/i)
      || content.match(/\*\*Assigned\s*to:\*\*\s*(.+)/i)
      || content.match(/\*\*assigned\s*to\*\*:\s*(.+)/i)
      || content.match(/assignee:\s*`?([^`\n]+)`?/i)
      || content.match(/agent:\s*`?([^`\n]+)`?/i);
    if (assigneeMatch) {
      meta.assignee = assigneeMatch[1].replace(/\*+/g, "").trim().toLowerCase();
    }
  }

  if (!meta.status) {
    // Infer status from checkbox state
    const uncheckedCount = (content.match(/- \[ \]/g) || []).length;
    const checkedCount = (content.match(/- \[x\]/gi) || []).length;

    if (checkedCount > 0 && uncheckedCount === 0) {
      meta.status = "done";
    } else if (checkedCount > 0) {
      meta.status = "in_progress";
    } else if (uncheckedCount > 0) {
      meta.status = "pending";
    }
  }

  // Override: if all acceptance criteria checkboxes are checked, treat as done
  // regardless of what the status field says (agents sometimes forget to update it)
  const uncheckedAC = (content.match(/- \[ \]/g) || []).length;
  const checkedAC = (content.match(/- \[x\]/gi) || []).length;
  if (checkedAC > 0 && uncheckedAC === 0) {
    meta.status = "done";
  }

  return meta;
}

/**
 * Get the current milestone from session.json.
 */
function getCurrentMilestone() {
  const sessionPaths = [
    resolve(".takt", "session.json"),
    resolve(process.cwd(), ".takt", "session.json"),
  ];

  for (const sp of sessionPaths) {
    try {
      const raw = readFileSync(sp, "utf-8");
      const session = JSON.parse(raw);
      return session.currentMilestone || null;
    } catch {
      // Try next
    }
  }
  return null;
}

/**
 * Scan the milestone directory for tickets assigned to a given agent.
 * Returns tickets grouped by status.
 */
function findAgentTickets(agentName, milestone) {
  const base = resolve(".takt", "tickets", "milestones");
  const result = { pending: [], in_progress: [], done: [] };

  if (!existsSync(base)) {
    return result;
  }

  // Determine which directories to scan
  const dirsToScan = [];

  if (milestone) {
    const milestoneDir = join(base, milestone);
    if (existsSync(milestoneDir)) {
      dirsToScan.push(milestoneDir);
    }
  }

  // If no specific milestone, scan all milestone directories
  if (dirsToScan.length === 0) {
    try {
      const entries = readdirSync(base, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirsToScan.push(join(base, entry.name));
        }
      }
    } catch {
      return result;
    }
  }

  // Also check the milestones root for flat ticket structures
  dirsToScan.push(base);

  const seen = new Set();

  for (const dir of dirsToScan) {
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const fullPath = join(dir, file);

      // Skip if we already processed this file
      if (seen.has(fullPath)) continue;
      seen.add(fullPath);

      let content;
      try {
        content = readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const meta = parseTicketMetadata(content, file);

      // Check if this ticket is assigned to the agent
      const normalizedAgent = agentName.toLowerCase();
      const ticketAssignee = (meta.assignee || "").toLowerCase();

      if (ticketAssignee !== normalizedAgent) {
        continue;
      }

      const status = meta.status || "pending";

      if (status === "pending" || status === "todo" || status === "open") {
        result.pending.push(meta.id);
      } else if (status === "in_progress" || status === "in-progress" || status === "active" || status === "claimed") {
        result.in_progress.push(meta.id);
      } else if (
        status === "done" || status === "complete" || status === "completed" ||
        status === "closed" || status === "approved" || status === "review" ||
        status === "merged" || status.includes("complete")
      ) {
        result.done.push(meta.id);
      } else {
        // Unknown status — treat as pending
        result.pending.push(meta.id);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Safety timeout — if stdin hangs or script takes too long, fail open
  const timeout = setTimeout(() => {
    process.stderr.write("keep-working: Timeout reading stdin. Allowing idle.\n");
    process.exit(0);
  }, 5000);

  let input;

  try {
    const rawInput = readFileSync("/dev/stdin", "utf-8");
    input = JSON.parse(rawInput);
  } catch (err) {
    clearTimeout(timeout);
    process.stderr.write(`keep-working: Failed to parse stdin input: ${err.message}\n`);
    // Fail open — allow idle if we can't parse
    process.exit(0);
  }

  clearTimeout(timeout);

  const agentName = input.agent_name || process.env.CLAUDE_AGENT_NAME || "";

  if (!agentName || !agentName.startsWith("takt-")) {
    // Not a Takt agent — allow idle
    process.exit(0);
  }

  const milestone = getCurrentMilestone();

  // If no active milestone is set, allow idle — the hook's job is to keep
  // agents working during active execution, not during planning or between milestones.
  if (!milestone) {
    process.exit(0);
  }

  const tickets = findAgentTickets(agentName, milestone);

  const remaining = [...tickets.in_progress, ...tickets.pending];

  if (remaining.length === 0) {
    // No remaining work — agent can be idle
    process.exit(0);
  }

  // Build a helpful message directing the agent to continue working
  const parts = [];

  if (tickets.in_progress.length > 0) {
    parts.push(`In-progress tickets: ${tickets.in_progress.join(", ")}`);
  }

  if (tickets.pending.length > 0) {
    parts.push(`Pending tickets: ${tickets.pending.join(", ")}`);
  }

  const nextTicket = tickets.in_progress[0] || tickets.pending[0];
  const action = tickets.in_progress.length > 0
    ? `Continue working on ${nextTicket}.`
    : `Claim and work on ${nextTicket}.`;

  const message =
    `You have unclaimed tickets: ${remaining.join(", ")}. ${action}\n\n` +
    `Details:\n${parts.join("\n")}`;

  process.stdout.write(message);
  process.exit(2);
}

main().catch((err) => {
  process.stderr.write(`keep-working: Unexpected error: ${err.message}\n`);
  process.exit(1);
});
