#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { loadDMN } from "./load-dmn";
import { compare } from "./compare";

async function runScenario(name: string) {
  const { engine, definitions } = await loadDMN(
    path.resolve(__dirname, "../../models/cat5_system_release_process.dmn")
  );

  const scenarioPath = path.resolve(__dirname, `./scenarios/${name}.json`);
  const baselinePath = path.resolve(__dirname, `./baselines/${name}.json`);

  const input = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));

  return new Promise((resolve, reject) => {
    engine.execute(definitions, input, (err, output) => {
      if (err) return reject(err);

      const ok = compare(output, baselinePath);
      resolve({ ok, output, name });
    });
  });
}

(async () => {
  const scenarios = ["scenario_pass", "scenario_fail", "scenario_pwcond"];
  let failures = 0;

  for (const s of scenarios) {
    const { ok, output, name } = (await runScenario(s)) as any;

    if (!ok) {
      console.error(`❌ DMN regression failed for ${name}`);
      console.error("Output:", JSON.stringify(output, null, 2));

      failures++;
    } else {
      console.log(`✔ PASS: ${name}`);
    }
  }

  if (failures > 0) process.exit(1);
  console.log("🎉 DMN simulation harness passed.");
})();
