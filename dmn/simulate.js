#!/usr/bin/env node
import fs from "fs";
import { DmnEngine } from "dmn-engine";

const engine = new DmnEngine();

const model = process.argv[2];
if (!model) {
  console.error("Usage: simulate.js <dmn-file>");
  process.exit(1);
}

const xml = fs.readFileSync(model, "utf8");
const inputs = JSON.parse(fs.readFileSync("./dmn/tests/test_inputs.json"));
const expected = JSON.parse(fs.readFileSync("./dmn/tests/test_outputs.json"));

engine.parse(xml, (err, definitions) => {
  if (err) {
    console.error("DMN parse error:", err);
    process.exit(1);
  }

  engine.execute(definitions, inputs, (err, result) => {
    if (err) {
      console.error("DMN execution error:", err);
      process.exit(1);
    }

    if (JSON.stringify(result) !== JSON.stringify(expected)) {
      console.error("DMN simulation failed.\nExpected:", expected, "\nGot:", result);
      process.exit(1);
    }

    console.log("DMN simulation passed.");
  });
});
