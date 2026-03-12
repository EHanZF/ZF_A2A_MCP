import fs from "fs";

export function compare(actual: any, baselinePath: string) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  return JSON.stringify(actual) === JSON.stringify(baseline);
}
