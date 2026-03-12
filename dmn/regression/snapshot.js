#!/usr/bin/env node
import fs from "fs";
import { DmnEngine } from "dmn-engine";

const engine = new DmnEngine();
const file = process.argv[2];
const xml = fs.readFileSync(file, "utf8");

engine.parse(xml, (err, def) => {
  if (err) throw err;

  const sampleInputs = JSON.parse(fs.readFileSync("./dmn/tests/test_inputs.json"));

  engine.execute(def, sampleInputs, (err, output) => {
    if (err) throw err;

    // Behavior fingerprint
    console.log(JSON.stringify(output, null, 2));
  });
});
