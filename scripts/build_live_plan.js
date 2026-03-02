#!/usr/bin/env node
/**
 * Build live plan for CI/CD orchestration.
 * Generates config/live_plan.json with routing matrix.
 */
import fs from 'fs';
import path from 'path';

function buildLivePlan() {
  const configDir = './config';
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const livePlan = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    vector_matrix: [
      { vector: "mcp-server" },
      { vector: "agent-cdyp7" },
      { vector: "orchestrator" }
    ],
    routing_rules: [
      {
        source: "GHA",
        target: "vector-space-tests",
        condition: "PR to main"
      }
    ]
  };

  const outPath = path.join(configDir, 'live_plan.json');
  fs.writeFileSync(outPath, JSON.stringify(livePlan, null, 2));
  console.log(`✓ Generated ${outPath}`);
}

buildLivePlan();
