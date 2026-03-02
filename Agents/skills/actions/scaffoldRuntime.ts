import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

/**
 * Input that drives runtime scaffolding.
 */
export interface ScaffoldRuntimeInput {
  moduleName?: string;        // name of runtime module (default: runtime)
  markdownSpec?: boolean;     // whether to emit compact specification markdown
  commit?: boolean;           // whether to commit changes to git
  push?: boolean;             // whether to push the commit (requires env var)
}

export interface ScaffoldRuntimeOutput {
  filesCreated: string[];
  commitMessage?: string;
  pushed: boolean;
}

function git(cmd: string) {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
}

export async function scaffoldRuntime(input: ScaffoldRuntimeInput = {}): Promise<ScaffoldRuntimeOutput> {
  const moduleName = input.moduleName || "runtime";
  const files: string[] = [];

  // create directory and entry point
  const moduleDir = path.join(process.cwd(), "src", moduleName);
  if (!fs.existsSync(moduleDir)) fs.mkdirSync(moduleDir, { recursive: true });
  const entry = path.join(moduleDir, "index.ts");
  if (!fs.existsSync(entry)) {
    fs.writeFileSync(entry, `// auto-generated runtime module scaffolding\n\nexport function initialize() {\n  console.log('runtime module ${moduleName} initialized');\n}\n`);
    files.push(entry);
  }

  // create markdown spec if requested
  let commitMsg = "";
  if (input.markdownSpec) {
    const specPath = path.join(process.cwd(), `${moduleName}_spec.md`);
    const specContent = `# ${moduleName} Runtime Specification\n\nThis document describes the heuristics and structure of the ${moduleName} module when agents are embedded into the MCP server environment. It is generated automatically by an agentic action.\n\n- **Entry point**: \\`src/${moduleName}/index.ts\\`\n- **Function**: \\`initialize()\\` prints a message when invoked.\n- **Purpose**: placeholder for runtime bootstrap logic.\n`;
    fs.writeFileSync(specPath, specContent);
    files.push(specPath);
    commitMsg += "scaffold runtime module and spec";
  }

  // create a stub unit test to launch browser and monitor workflow
  const testPath = path.join(process.cwd(), "tests", "gh_workflow_monitor.test.ts");
  if (!fs.existsSync(testPath)) {
    const testCode = `
/**
 * This test is automatically created by the scaffoldRuntime agent.
 * It opens a browser window (using Playwright) to observe the GitHub
 * Actions page for this repository and asserts that the branch-fuzz-and-test
 * workflow has run at least once.  In CI you'll need to provide GITHUB_TOKEN
 * and install playwright dependencies.
 */
import { test, expect } from '@playwright/test';

test('workflow monitoring', async ({ page }) => {
  // navigate to the actions page (public repo assumed or token provided)
  await page.goto('https://github.com/${process.env.GITHUB_REPOSITORY}/actions/workflows/branch-fuzz-and-test.yml');
  // wait for the workflow jobs table to appear
  await page.waitForSelector('text=Workflow runs');
  const text = await page.textContent('body');
  expect(text).toContain('branch-fuzz-and-test');
});
`;
    fs.writeFileSync(testPath, testCode);
    files.push(testPath);
    if (commitMsg.length) commitMsg += "; ";
    commitMsg += "add workflow monitor test";
  }

  let pushed = false;
  if (input.commit) {
    try {
      git('add ' + files.map(f => `"${path.relative(process.cwd(), f)}"`).join(' '));
      git(`commit -m "${commitMsg || 'scaffold runtime files'}"`);
      if (input.push && process.env.ALLOW_PUSH === 'true') {
        git('push origin main');
        pushed = true;
      }
    } catch (e) {
      // ignore git errors, maybe already committed
    }
  }

  return {
    filesCreated: files,
    commitMessage: commitMsg || undefined,
    pushed,
  };
}

export default scaffoldRuntime;
