#!/usr/bin/env node
import fs from "fs";
import { execSync } from "child_process";

const models = fs.readdirSync("./dmn/models").filter(f => f.endsWith(".dmn"));
const historyFolder = "./dmn/regression/history";
fs.mkdirSync(historyFolder, { recursive: true });

let failures = 0;

for (const model of models) {
  console.log(`Running regression tests for ${model}`);

  try {
    execSync(`node dmn/validators/validate.js dmn/models/${model}`, { stdio: "inherit" });
    execSync(`node dmn/validators/simulate.js dmn/models/${model}`, { stdio: "inherit" });
  } catch (e) {
    console.error(`Error in model: ${model}`);
    failures++;
  }

  // Generate behavior fingerprint for regression tracking
  const fingerprint = execSync(
    `node dmn/regression/snapshot.js dmn/models/${model}`
  ).toString();

  fs.writeFileSync(
    `${historyFolder}/${model}.snapshot`,
    fingerprint
  );
}

if (failures > 0) {
  console.error(`Nightly regression failed for ${failures} model(s).`);
  process.exit(1);
}

console.log("Nightly regression passed for all DMN models.");
