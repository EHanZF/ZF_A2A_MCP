import { McpServer } from "@modelcontextprotocol/sdk/server";
import { reviewGitHubActions } from "./reviewGitHubActions.js";
import { summarizeIssues } from "./suggestions.js";

const server = new McpServer({
  name: "mcp-review-agent",
  version: "1.0.0"
});

server.tool("review_github_actions", {
  description: "Review GitHub Actions workflows for security, correctness, and best practices.",
  inputSchema: {
    type: "object",
    properties: { path: { type: "string", default: ".github/workflows" } },
    required: []
  },
  outputSchema: {
    type: "object",
    properties: {
      issues: { type: "array", items: { type: "object" } },
      summary: { type: "string" }
    }
  }
}, async ({ path }) => {
  const issues = reviewGitHubActions(path ?? ".github/workflows");
  const summary = summarizeIssues(issues);
  return { issues, summary };
});

server.start();
