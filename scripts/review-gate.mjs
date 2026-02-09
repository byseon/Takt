#!/usr/bin/env node

/**
 * review-gate.mjs - TaskCompleted hook
 *
 * Enforces review checks before a ticket can be marked as complete.
 * Validates that all acceptance criteria checkboxes are checked and
 * applies the configured review mode (auto/peer/user).
 *
 * Exit codes:
 *   0 = approve completion
 *   2 = block completion (criteria unmet or review required)
 *   1 = internal error
 *
 * Receives hook context via stdin as JSON:
 * {
 *   "agent_name": "mamh-backend",
 *   "task_id": "BACKEND-001",
 *   "milestone": "M1",
 *   "session_id": "..."
 * }
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a markdown ticket file and extract acceptance criteria checkboxes.
 * Returns an object with arrays of checked and unchecked items.
 */
function parseAcceptanceCriteria(content) {
  const lines = content.split("\n");
  const checked = [];
  const unchecked = [];

  let inAcceptanceCriteria = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect the acceptance criteria section header
    if (/^#{1,4}\s*acceptance\s+criteria/i.test(trimmed)) {
      inAcceptanceCriteria = true;
      continue;
    }

    // If we hit another heading, we have left the acceptance criteria section
    if (inAcceptanceCriteria && /^#{1,4}\s+/.test(trimmed) && !/acceptance\s+criteria/i.test(trimmed)) {
      inAcceptanceCriteria = false;
      continue;
    }

    // Also parse checkboxes outside of an explicit section (some tickets
    // use checkboxes inline without a dedicated heading)
    const checkedMatch = trimmed.match(/^-\s*\[x\]\s+(.+)$/i);
    const uncheckedMatch = trimmed.match(/^-\s*\[\s\]\s+(.+)$/);

    if (checkedMatch) {
      checked.push(checkedMatch[1].trim());
    } else if (uncheckedMatch) {
      unchecked.push(uncheckedMatch[1].trim());
    }
  }

  return { checked, unchecked };
}

/**
 * Find a ticket file by its ID in the milestones directory tree.
 * Tickets may be stored as:
 *   .mamh/tickets/milestones/<milestone>/<ticket-id>.md
 *   .mamh/tickets/milestones/<ticket-id>.md
 *   .mamh/tickets/milestones/<milestone>/<any-file-containing-ticket-id>.md
 */
function findTicketFile(ticketId, milestone) {
  const base = resolve(".mamh", "tickets", "milestones");

  if (!existsSync(base)) {
    return null;
  }

  // Strategy 1: Direct file match — .mamh/tickets/milestones/<milestone>/<ticketId>.md
  if (milestone) {
    const direct = join(base, milestone, `${ticketId}.md`);
    if (existsSync(direct)) return direct;
  }

  // Strategy 2: Direct file at milestones root
  const directRoot = join(base, `${ticketId}.md`);
  if (existsSync(directRoot)) return directRoot;

  // Strategy 3: Search milestone directories for matching filename
  try {
    const entries = readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const milestoneDir = join(base, entry.name);
        try {
          const tickets = readdirSync(milestoneDir);
          for (const ticket of tickets) {
            if (ticket.includes(ticketId) && ticket.endsWith(".md")) {
              return join(milestoneDir, ticket);
            }
          }
        } catch {
          // Skip unreadable directories
        }
      }
    }
  } catch {
    // milestones dir unreadable
  }

  // Strategy 4: Search all .md files for a ticket ID reference in content
  try {
    const entries = readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const milestoneDir = join(base, entry.name);
        try {
          const tickets = readdirSync(milestoneDir);
          for (const ticket of tickets) {
            if (!ticket.endsWith(".md")) continue;
            const fullPath = join(milestoneDir, ticket);
            try {
              const content = readFileSync(fullPath, "utf-8");
              if (content.includes(ticketId)) {
                return fullPath;
              }
            } catch {
              // Skip unreadable files
            }
          }
        } catch {
          // Skip unreadable directories
        }
      }
    }
  } catch {
    // Fall through
  }

  return null;
}

/**
 * Read the session configuration to determine review mode.
 */
function getReviewMode() {
  const sessionPaths = [
    resolve(".mamh", "session.json"),
    resolve(process.cwd(), ".mamh", "session.json"),
  ];

  for (const sp of sessionPaths) {
    try {
      const raw = readFileSync(sp, "utf-8");
      const session = JSON.parse(raw);
      return session.reviewMode || "auto";
    } catch {
      // Try next path
    }
  }

  // Default to auto if session.json not found
  return "auto";
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
    process.stderr.write(`review-gate: Failed to parse stdin input: ${err.message}\n`);
    // Fail open — don't block if we can't parse the hook context
    process.exit(0);
  }

  const agentName = input.agent_name || process.env.CLAUDE_AGENT_NAME || "unknown";
  const taskId = input.task_id || input.ticket_id || input.ticketId || "";
  const milestone = input.milestone || input.currentMilestone || null;

  // If no task ID provided, we can't validate — allow completion
  if (!taskId) {
    process.stderr.write("review-gate: No task_id provided in hook input. Allowing completion.\n");
    process.exit(0);
  }

  // Find the ticket file
  const ticketPath = findTicketFile(taskId, milestone);

  if (!ticketPath) {
    process.stderr.write(`review-gate: Could not find ticket file for ${taskId}. Allowing completion.\n`);
    process.exit(0);
  }

  // Parse acceptance criteria
  let ticketContent;
  try {
    ticketContent = readFileSync(ticketPath, "utf-8");
  } catch (err) {
    process.stderr.write(`review-gate: Could not read ticket file ${ticketPath}: ${err.message}\n`);
    process.exit(0);
  }

  const { checked, unchecked } = parseAcceptanceCriteria(ticketContent);
  const totalCriteria = checked.length + unchecked.length;

  // Determine review mode
  const reviewMode = getReviewMode();

  // --- Auto mode ---
  if (reviewMode === "auto") {
    if (totalCriteria === 0) {
      // No acceptance criteria defined — allow completion
      process.exit(0);
    }

    if (unchecked.length === 0) {
      // All criteria checked — approve
      process.exit(0);
    }

    // Some criteria remain unchecked — block
    const summary = unchecked.map((item) => `  - [ ] ${item}`).join("\n");
    const message =
      `REVIEW GATE: Ticket ${taskId} cannot be completed. ` +
      `${unchecked.length} of ${totalCriteria} acceptance criteria remain unchecked:\n${summary}\n\n` +
      `Complete all acceptance criteria before marking this ticket as done.`;
    process.stdout.write(message);
    process.exit(2);
  }

  // --- Peer review mode ---
  if (reviewMode === "peer") {
    // Even if all criteria are checked, peer review is required
    const criteriaStatus =
      unchecked.length > 0
        ? ` Additionally, ${unchecked.length} acceptance criteria are still unchecked.`
        : " All acceptance criteria are checked.";
    const message =
      `REVIEW GATE: Ticket ${taskId} requires peer review before completion.${criteriaStatus} ` +
      `Sending to reviewer agent.`;
    process.stdout.write(message);
    process.exit(2);
  }

  // --- User review mode ---
  if (reviewMode === "user") {
    const criteriaStatus =
      unchecked.length > 0
        ? ` Note: ${unchecked.length} acceptance criteria are still unchecked.`
        : " All acceptance criteria are checked.";
    const message =
      `REVIEW GATE: Ticket ${taskId} requires user approval before completion.${criteriaStatus}`;
    process.stdout.write(message);
    process.exit(2);
  }

  // Unknown review mode — fail open
  process.stderr.write(`review-gate: Unknown reviewMode "${reviewMode}". Allowing completion.\n`);
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`review-gate: Unexpected error: ${err.message}\n`);
  process.exit(1);
});
