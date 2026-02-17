import { WorkflowIssue } from "./reviewGitHubActions.js";

export function summarizeIssues(issues: WorkflowIssue[]): string {
  if (issues.length === 0) return "No issues detected.";

  const counts = {
    high: issues.filter(i => i.severity === "HIGH").length,
    med: issues.filter(i => i.severity === "MEDIUM").length,
    low: issues.filter(i => i.severity === "LOW").length
  };

  return `
Found ${issues.length} issues in GitHub Actions workflows:
- HIGH: ${counts.high}
- MEDIUM: ${counts.med}
- LOW: ${counts.low}

Top suggestions:
${issues.slice(0,5).map(i => `- [${i.severity}] ${i.message} (file: ${i.file}:${i.line})`).join("\n")}
  `.trim();
}
