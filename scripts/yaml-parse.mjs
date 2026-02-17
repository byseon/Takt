#!/usr/bin/env node

/**
 * yaml-parse.mjs - Minimal YAML parser for .takt/config.yaml
 *
 * Zero external dependencies. Supports:
 *   - Scalars: string, number, boolean, null
 *   - Arrays: `- item` syntax
 *   - Nested objects: 2-space indentation
 *   - Comments: `#` (full-line and inline)
 *   - Quoted strings: single and double quotes
 *
 * Does NOT support: anchors, aliases, multi-line strings, flow syntax.
 *
 * Usage:
 *   import { parseYaml } from './yaml-parse.mjs';
 *   const obj = parseYaml(yamlText);
 *
 * CLI mode:
 *   echo "key: value" | node yaml-parse.mjs
 */

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

/**
 * Strip inline comments from a value string.
 * Respects quoted strings — does not strip # inside quotes.
 */
function stripInlineComment(value) {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === "#" && !inSingle && !inDouble) {
      // Found an unquoted #. Must be preceded by whitespace to count as comment.
      if (i === 0 || /\s/.test(value[i - 1])) {
        return value.slice(0, i).trimEnd();
      }
    }
  }

  return value;
}

/**
 * Parse a scalar value string into the appropriate JS type.
 * Handles: quoted strings, booleans, null, numbers, plain strings.
 */
function parseScalar(raw) {
  const value = raw.trim();

  if (value === "") return "";

  // Double-quoted string
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  // Single-quoted string
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  // Null
  const lower = value.toLowerCase();
  if (lower === "null" || lower === "~" || lower === "") {
    return null;
  }

  // Boolean
  if (lower === "true" || lower === "yes") return true;
  if (lower === "false" || lower === "no") return false;

  // Number (integer or float)
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  // Plain string
  return value;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a YAML text string into a plain JavaScript object.
 *
 * @param {string} text - YAML text to parse
 * @returns {object} Parsed JavaScript object
 */
export function parseYaml(text) {
  if (!text || typeof text !== "string") {
    return {};
  }

  const lines = text.split("\n");
  const result = {};

  // Stack tracks the current nesting context.
  // Each entry: { indent, obj, key }
  //   - indent: the indentation level of this object
  //   - obj: the object or array being populated
  //   - key: the key in the parent object that holds this obj (for reference)
  const stack = [{ indent: -1, obj: result, key: null }];

  /**
   * Get the current context (top of stack).
   */
  function current() {
    return stack[stack.length - 1];
  }

  /**
   * Pop stack entries until we find one at a level less than the given indent.
   */
  function popToIndent(indent) {
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Skip empty lines
    if (rawLine.trim() === "") continue;

    // Skip full-line comments
    if (rawLine.trim().startsWith("#")) continue;

    // Calculate indentation (number of leading spaces)
    const stripped = rawLine.replace(/\t/g, "  "); // normalize tabs to 2 spaces
    const indent = stripped.length - stripped.trimStart().length;
    const trimmed = stripped.trim();

    // Pop stack to find the correct parent for this indentation level
    popToIndent(indent);

    const ctx = current();

    // --- Array item: `- value` or `- key: value` ---
    const arrayItemMatch = trimmed.match(/^-\s+(.*)/);
    if (arrayItemMatch) {
      const itemContent = arrayItemMatch[1].trim();

      // Ensure the current context object is an array, or create one
      if (!Array.isArray(ctx.obj)) {
        // This shouldn't normally happen with well-formed YAML, but handle it
        // by treating the array item as a plain value
        continue;
      }

      // Check if the array item is a key: value pair (nested object in array)
      const kvMatch = itemContent.match(/^([^\s:]+)\s*:\s*(.*)/);
      if (kvMatch) {
        const key = kvMatch[1];
        const rawVal = stripInlineComment(kvMatch[2].trim());
        const nestedObj = {};

        if (rawVal === "" || rawVal === undefined) {
          // Key with no value — might have children on subsequent lines
          nestedObj[key] = {};
          ctx.obj.push(nestedObj);
          // Push the inner object for potential children
          // Array item indent + 2 for the "- " prefix + key indent
          stack.push({ indent: indent + 2, obj: nestedObj[key], key });
        } else {
          nestedObj[key] = parseScalar(rawVal);
          ctx.obj.push(nestedObj);
        }
      } else {
        // Simple array item
        const rawVal = stripInlineComment(itemContent);
        ctx.obj.push(parseScalar(rawVal));
      }

      continue;
    }

    // --- Key: value pair ---
    const kvMatch = trimmed.match(/^([^\s:#][^:#]*?)\s*:\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const rawVal = stripInlineComment(kvMatch[2].trim());

      if (rawVal === "" || rawVal === undefined) {
        // Key with no value — could be a nested object or array.
        // Peek at the next non-empty, non-comment line to determine which.
        let nextType = "object"; // default assumption
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          const nextTrimmed = nextLine.trim();
          if (nextTrimmed === "" || nextTrimmed.startsWith("#")) continue;

          if (nextTrimmed.startsWith("- ")) {
            nextType = "array";
          }
          break;
        }

        const child = nextType === "array" ? [] : {};
        if (Array.isArray(ctx.obj)) {
          // We are inside an array — create a keyed object entry
          const entry = {};
          entry[key] = child;
          ctx.obj.push(entry);
        } else {
          ctx.obj[key] = child;
        }

        stack.push({ indent, obj: child, key });
      } else {
        // Key with a scalar value
        if (Array.isArray(ctx.obj)) {
          const entry = {};
          entry[key] = parseScalar(rawVal);
          ctx.obj.push(entry);
        } else {
          ctx.obj[key] = parseScalar(rawVal);
        }
      }

      continue;
    }

    // If the line doesn't match any pattern, skip it
  }

  return result;
}

// ---------------------------------------------------------------------------
// CLI mode: echo "yaml" | node yaml-parse.mjs
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const input = readFileSync("/dev/stdin", "utf-8");
    const parsed = parseYaml(input);
    process.stdout.write(JSON.stringify(parsed, null, 2) + "\n");
    process.exit(0);
  } catch (err) {
    process.stderr.write(`yaml-parse: ${err.message}\n`);
    process.exit(1);
  }
}
