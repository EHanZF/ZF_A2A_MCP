import fs from "fs";
import path from "path";

export interface WorkflowIssue {
  file: string;
  line: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  recommendation: string;
}

export function reviewGitHubActions(root = ".github/workflows"): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];

  function load(file: string) {
    return fs.readFileSync(file, "utf-8").split("\n");
  }

  if (!fs.existsSync(root)) return issues;

  const files = fs.readdirSync(root).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));

  for (const file of files) {
    const full = path.join(root, file);
    const lines = load(full);

    lines.forEach((line, i) => {
      // Basic security checks
      if (line.includes("pull_request_target")) {
        issues.push({
          file,
          line: i + 1,
          severity: "HIGH",
          message: "pull_request_target used — can be exploited for injection.",
          recommendation: "Switch to pull_request or add strict path filtering."
        });
      }

      if (line.includes("sudo")) {
        issues.push({
          file,
          line: i + 1,
          severity: "HIGH",
          message: "sudo used in CI workflow.",
          recommendation: "Avoid sudo in GitHub Actions to reduce privilege escalation risk."
        });
      }

      if (line.includes("::set-output")) {
        issues.push({
          file,
          line: i + 1,
          severity: "LOW",
          message: "::set-output deprecated.",
          recommendation: "Use $GITHUB_OUTPUT file API instead."
        });
      }

      if (line.includes("node-version: 16") || line.includes("node-version: 14")) {
        issues.push({
          file,
          line: i + 1,
          severity: "MEDIUM",
          message: "Outdated Node version used.",
          recommendation: "Upgrade to node-version: 22 for OCI-based Actions."
        });
      }

      if (line.includes("docker login") && !line.includes("${{ secrets.")) {
        issues.push({
          file,
          line: i + 1,
          severity: "HIGH",
          message: "docker login without GitHub Secret.",
          recommendation: "Always use secrets for credentials."
        });
      }
    });
  }

  return issues;
}
