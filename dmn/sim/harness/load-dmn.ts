import fs from "fs";
import { DmnEngine } from "dmn-engine";

export async function loadDMN(path: string) {
  const xml = fs.readFileSync(path, "utf8");
  return new Promise((resolve, reject) => {
    const engine = new DmnEngine();
    engine.parse(xml, (err, definitions) => {
      if (err) return reject(err);
      resolve({ engine, definitions });
    });
  });
}
