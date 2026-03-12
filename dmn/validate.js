#!/usr/bin/env node
import fs from "fs";
import { XMLParser } from "fast-xml-parser";
import xmllint from "xmllint";

const file = process.argv[2];
if (!file) {
  console.error("Usage: validate.js <dmn-file>");
  process.exit(1);
}

const xml = fs.readFileSync(file, "utf8");

// 1. Validate XML well-formedness
try {
  const parser = new XMLParser({ ignoreAttributes: false });
  parser.parse(xml);
} catch (e) {
  console.error(`XML parse error in ${file}:`, e.message);
  process.exit(1);
}

// 2. Validate against XSD
const result = xmllint.validateXML({
  xml,
  schema: fs.readFileSync("./dmn/schemas/dmn-v1.xsd", "utf8")
});

if (result.errors) {
  console.error(`Schema validation errors in ${file}:`, result.errors);
  process.exit(1);
}

// 3. Basic semantic checks (very simple example)
if (xml.includes("hitPolicy=\"UNIQUE\"") && xml.includes("otherwise")) {
  console.warn(`Warning: UNIQUE hit policy should not contain 'otherwise' in ${file}`);
}

console.log(`${file} is valid.`);
