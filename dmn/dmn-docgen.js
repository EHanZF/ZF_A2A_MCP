#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

const inputFolder = "./dmn/models/";
const outFolder = "./dmn/docs/";

fs.mkdirSync(outFolder, { recursive: true });

const parser = new XMLParser({ ignoreAttributes: false });

function extractDecision(decision) {
  return {
    id: decision["@_id"],
    name: decision["@_name"],
    hitPolicy:
      decision?.decisionTable?.["@_hitPolicy"] || "UNSPECIFIED",
    rules:
      decision?.decisionTable?.rule?.length ||
      (decision?.decisionTable?.rule ? 1 : 0)
  };
}

function extractDRD(xmlJson) {
  const drd = xmlJson.definitions?.["decision"] || [];
  return Array.isArray(drd) ? drd : [drd];
}

function generateMarkdown(modelName, decisions) {
  const lines = [];
  lines.push(`# DMN Model: ${modelName}`);
  lines.push("");

  for (const d of decisions) {
    lines.push(`## Decision: ${d.name}`);
    lines.push(`**ID:** \`${d.id}\``);
    lines.push(`**Hit Policy:** \`${d.hitPolicy}\``);
    lines.push(`**Rules:** ${d.rules}`);
    lines.push("---");
  }

  return lines.join("\n");
}

function processFile(file) {
  const xml = fs.readFileSync(file, "utf8");
  const json = parser.parse(xml);

  const name = path.basename(file);
  const drd = extractDRD(json);

  const decisions = drd.map(extractDecision);
  const doc = generateMarkdown(name, decisions);

  fs.writeFileSync(`${outFolder}/${name}.md`, doc);
  console.log(`Generated documentation for ${name}`);
}

for (const file of fs.readdirSync(inputFolder)) {
  if (file.endsWith(".dmn")) {
    processFile(`${inputFolder}/${file}`);
  }
}
