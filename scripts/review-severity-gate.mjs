#!/usr/bin/env node

/**
 * review-severity-gate.mjs - Cross-model review severity gate
 *
 * Checks the synthesized findings from a cross-model review and blocks
 * completion if any CRITICAL or HIGH severity issues remain.
 *
 * Called programmatically by the review skill during the re-review loop.
 * NOT registered as a hook.
 *
 * Exit codes:
 *   0 = pass (no CRITICAL/HIGH issues)
 *   2 = block (CRITICAL or HIGH issues remain)
 *   1 = internal error
 *
 * Input (JSON on stdin):
 * {
 *   "ticketId": "BACKEND-001",
 *   "milestone": "M1",
 *   "sessionId": "..."
 * }
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the review JSON file for a given ticket ID.
 * Searches in .takt/reviews/ directory.
 */
function findReviewFile(ticketId) {
  const searchRoots = [
    resolve(".takt", "reviews"),
    resolve(process.cwd(), ".takt", "reviews"),
  ];

  for (const reviewDir of searchRoots) {
    if (!existsSync(reviewDir)) {
      continue;
    }

    const directPath = resolve(reviewDir, `${ticketId}-review.json`);
    if (existsSync(directPath)) {
      return directPath;
    }
  }

  return null;
}

/**
 * Extract the latest round's synthesized findings from the review JSON.
 * Returns the summary object with severity counts, or null if not found.
 */
function getLatestRoundSummary(reviewData) {
  const crossModel = reviewData.crossModelReview;
  if (!crossModel || !crossModel.enabled) {
    return null;
  }

  const rounds = crossModel.rounds;
  if (!Array.isArray(rounds) || rounds.length === 0) {
    return null;
  }

  const latestRound = rounds[rounds.length - 1];
  return latestRound.summary || null;
}

/**
 * Check if any blocking severities (CRITICAL or HIGH) exist.
 */
function hasBlockingSeverities(summary) {
  const critical = summary.critical || 0;
  const high = summary.high || 0;
  return critical > 0 || high > 0;
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
    process.stderr.write(
      `review-severity-gate: Failed to parse stdin: ${err.message}\n`
    );
    process.exit(1);
  }

  const ticketId = input.ticketId || input.ticket_id || "";

  // Validate ticketId format to prevent path injection
  if (ticketId && !/^[A-Za-z0-9_-]+$/.test(ticketId)) {
    process.stderr.write(
      `review-severity-gate: Invalid ticketId format: ${ticketId}\n`
    );
    process.exit(1);
  }

  if (!ticketId) {
    process.stderr.write(
      "review-severity-gate: No ticketId provided. Cannot check severity.\n"
    );
    process.exit(1);
  }

  // Find the review file
  const reviewPath = findReviewFile(ticketId);

  if (!reviewPath) {
    process.stdout.write(
      `SEVERITY GATE: No review file found for ${ticketId}. ` +
        "Cross-model review must be run before approval."
    );
    process.exit(2);
  }

  // Parse the review JSON
  let reviewData;
  try {
    const raw = readFileSync(reviewPath, "utf-8");
    reviewData = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(
      `review-severity-gate: Failed to parse review file: ${err.message}\n`
    );
    process.exit(1);
  }

  // Get the latest round summary
  const summary = getLatestRoundSummary(reviewData);

  if (!summary) {
    process.stdout.write(
      `SEVERITY GATE: No cross-model review rounds found for ${ticketId}. ` +
        "Review must complete before approval."
    );
    process.exit(2);
  }

  // Check for blocking severities
  if (hasBlockingSeverities(summary)) {
    const critical = summary.critical || 0;
    const high = summary.high || 0;
    const medium = summary.medium || 0;
    const low = summary.low || 0;

    const message =
      `SEVERITY GATE: Ticket ${ticketId} has blocking issues.\n` +
      `  CRITICAL: ${critical} | HIGH: ${high} | MEDIUM: ${medium} | LOW: ${low}\n` +
      `All CRITICAL and HIGH issues must be resolved before approval.`;
    process.stdout.write(message);
    process.exit(2);
  }

  // No blocking issues — gate passes
  const medium = summary.medium || 0;
  const low = summary.low || 0;
  const remaining = medium + low;

  if (remaining > 0) {
    process.stdout.write(
      `SEVERITY GATE PASSED: Ticket ${ticketId} — ` +
        `${remaining} non-blocking issues remain (${medium} MEDIUM, ${low} LOW).`
    );
  } else {
    process.stdout.write(
      `SEVERITY GATE PASSED: Ticket ${ticketId} — no issues remaining.`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(
    `review-severity-gate: Unexpected error: ${err.message}\n`
  );
  process.exit(1);
});
