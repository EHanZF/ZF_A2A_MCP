/**
 * runLocal.ts – Local skill runner for debugging
 *
 * Usage:
 *   node dist/Agents/swarm/runLocal.js @.mcp/build.input.local.json
 *   Or via VS Code Debug: F5 (with Debug: build_and_push skill configuration)
 *
 * This helper loads the skill input from a JSON file (via @filePath syntax)
 * and invokes the routing fabric locally for testing.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { RoutingFabric } from "./routingFabric.js";

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error("Usage: node runLocal.js @<input.json>");
    console.error("Example: node runLocal.js @.mcp/build.input.local.json");
    process.exit(1);
  }

  // Handle @file syntax (expand to actual path)
  const actualPath = inputPath.startsWith("@")
    ? path.resolve(inputPath.slice(1))
    : path.resolve(inputPath);

  if (!fs.existsSync(actualPath)) {
    console.error(`Input file not found: ${actualPath}`);
    process.exit(1);
  }

  try {
    const payload = JSON.parse(fs.readFileSync(actualPath, "utf-8"));

    console.log(`[runLocal] Loaded input from: ${actualPath}`);
    console.log(`[runLocal] Task: actions.build_and_push`);
    console.log(`[runLocal] Payload:`, JSON.stringify(payload, null, 2));
    console.log(`[runLocal] Starting routing fabric...\n`);

    const fabric = new RoutingFabric();
    const result = await fabric.route({
      source: "VSCode-Debug",
      task: "actions.build_and_push",
      payload,
    });

    console.log(`\n[runLocal] Route result:`, JSON.stringify(result, null, 2));
    console.log(`[runLocal] Success: ${result.response?.status === "success"}`);

    process.exit(result.response?.status === "success" ? 0 : 1);
  } catch (err: any) {
    console.error("[runLocal] Error:", err?.message || String(err));
    console.error(err?.stack);
    process.exit(1);
  }
}

main();
