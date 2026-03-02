/**
 * Agents/skills/actions/scaffoldAgent.ts
 *
 * MCP tool for scaffolding new agents with:
 * - agent.ts boilerplate
 * - package.json template
 * - Kubernetes ConfigMap with RBAC rules
 * - Optional GitHub Actions workflow for CI
 * - SSH CA integration template (if requested)
 */

import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

export type AgentRoleType =
  | "orchestration-agent"
  | "coding-agent"
  | "review-agent"
  | "ci-agent"
  | "rag-agent"
  | "decision-agent";

export interface ScaffoldAgentInput {
  agentRole: AgentRoleType;
  capabilities: string[];
  description: string;
  withSSHCA?: boolean;              // Include SSH CA integration
  orgBoundary?: string;             // RASIC boundary (e.g., "BrakeControls")
  outputDir?: string;               // Output directory (default: ./scaffolded-agents)
  generateWorkflow?: boolean;        // Generate GitHub Actions workflows
  workflowSSHCAIntegration?: boolean; // Add SSH CA to workflow
}

export interface ScaffoldAgentOutput {
  agentId: string;
  agentRole: AgentRoleType;
  files: {
    path: string;
    content: string;
    type: "typescript" | "json" | "yaml" | "markdown";
  }[];
  summary: string;
}

/**
 * Generate unique agent ID.
 */
function generateAgentId(role: AgentRoleType): string {
  const rolePrefix = role.split("-")[0].toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${rolePrefix}${random}`;
}

/**
 * Generate agent.ts module.
 */
function generateAgentModule(input: ScaffoldAgentInput, agentId: string): string {
  const capabilities = input.capabilities.map(c => `      "${c}"`).join(",\n");

  return `/**
 * Generated agent module for ${input.agentRole}
 * 
 * Agent ID: ${agentId}
 * Description: ${input.description}
 * Org Boundary: ${input.orgBoundary || "undefined"}
 * 
 * This agent is auto-generated. Customize as needed.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "${input.agentRole}",
  version: "1.0.0"
});

/**
 * Define tools for this agent
 * 
 * Capabilities:
${input.capabilities.map(c => `   * - ${c}`).join("\n")}
 */
export const capabilities = [
${capabilities}
];

/**
 * Tool handler template
 */
server.tool("example.task", {
  description: "Example tool",
  inputSchema: {
    type: "object" as const,
    properties: {
      input: { type: "string" }
    }
  }
}, async (args: any) => {
  return {
    type: "text" as const,
    text: \`Processed: \${args.input}\`
  };
});

/**
 * Start server
 */
const transport = new StdioServerTransport();
await server.connect(transport);
`;
}

/**
 * Generate package.json.
 */
function generatePackageJson(input: ScaffoldAgentInput, agentId: string): string {
  return JSON.stringify(
    {
      name: `@zf-a2a/agent-${input.agentRole.replace(/-/g, "-")}`,
      version: "1.0.0",
      description: input.description,
      main: "dist/index.js",
      type: "module",
      scripts: {
        build: "tsc",
        dev: "ts-node src/index.ts",
        start: "node dist/index.js",
        test: "vitest",
        lint: "eslint src/**/*.ts"
      },
      dependencies: {
        "@modelcontextprotocol/sdk": "^0.5.0"
      },
      devDependencies: {
        "@types/node": "^20.0.0",
        typescript: "^5.0.0",
        "ts-node": "^10.0.0",
        eslint: "^8.0.0",
        vitest: "^0.34.0"
      },
      metadata: {
        agentId,
        role: input.agentRole,
        orgBoundary: input.orgBoundary || undefined,
        capabilities: input.capabilities
      }
    },
    null,
    2
  );
}

/**
 * Generate Kubernetes ConfigMap with RBAC rules.
 */
function generateKubernetesConfigMap(input: ScaffoldAgentInput, agentId: string): string {
  const rbacRules = {
    agentId,
    role: input.agentRole,
    orgBoundary: input.orgBoundary,
    rbac: {
      allowTools: input.capabilities,
      denyTools: []
    },
    safety: {
      hitlRequiredFor: ["deployment", "release"],
      denyIfDecisionContains: ["block", "error"]
    }
  };

  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-${agentId.toLowerCase()}-config
  namespace: zf-mcp
  labels:
    app.kubernetes.io/name: agent
    app.kubernetes.io/instance: ${agentId}
    agent-role: ${input.agentRole}
data:
  agent.id: "${agentId}"
  agent.role: "${input.agentRole}"
  agent.description: "${input.description.replace(/"/g, '\\"')}"
  rbac.json: |
${JSON.stringify(rbacRules, null, 4)
  .split("\n")
  .map(l => "    " + l)
  .join("\n")}
`;
}

/**
 * Generate GitHub Actions workflow for agent CI/CD.
 */
function generateGitHubWorkflow(input: ScaffoldAgentInput, agentId: string): string {
  let workflowContent = `name: Agent ${input.agentRole} CI

on:
  push:
    paths:
      - 'Agents/${agentId}/**'
      - '.github/workflows/agent-${agentId}.yml'
  pull_request:
  workflow_dispatch:

permissions:
  id-token: write
  contents: read
  packages: write

env:
  AGENT_ID: ${agentId}
  AGENT_ROLE: ${input.agentRole}
  ORG_BOUNDARY: ${input.orgBoundary || "default"}

jobs:
  build_and_test:
    runs-on: ubuntu-latest
    
    env:
      CI_GITHUB_ACTOR: \${{ github.actor }}
      CI_ROLE: developer

    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - run: npm ci
        working-directory: Agents/${agentId}
      
      - run: npm run build
        working-directory: Agents/${agentId}
      
      - run: npm run test
        working-directory: Agents/${agentId}
      
      - run: npm run lint
        working-directory: Agents/${agentId}

  deploy:
    needs: build_and_test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f k8s/configmap-${agentId}.yaml
          kubectl rollout restart deployment/${agentId}
        env:
          K8S_CONTEXT: \${{ secrets.K8S_CONTEXT }}
`;

  if (input.workflowSSHCAIntegration) {
    workflowContent += `
  ssh_ca_integration:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure SSH CA
        run: |
          echo "Setting up org-level SSH CA integration"
          # Org CA public key loading/validation
          mkdir -p ~/.ssh
          echo "\${{ secrets.ORG_SSH_CA_PUBKEY }}" >> ~/.ssh/known_hosts.d/github
      
      - name: Add SSH signed key
        run: |
          ssh-add ~/.ssh/agent-key
          # Request signature from GitHub org CA
          gh ca request-signature --key ~/.ssh/agent-key.pub --ttl 1h
`;
  }

  return workflowContent;
}

/**
 * Main scaffold function.
 */
export async function scaffoldAgent(input: ScaffoldAgentInput): Promise<ScaffoldAgentOutput> {
  const agentId = generateAgentId(input.agentRole);
  const outputDir = input.outputDir || `./scaffolded-agents/${agentId}`;
  const files: ScaffoldAgentOutput["files"] = [];

  // Generate files
  files.push({
    path: "src/index.ts",
    content: generateAgentModule(input, agentId),
    type: "typescript"
  });

  files.push({
    path: "package.json",
    content: generatePackageJson(input, agentId),
    type: "json"
  });

  files.push({
    path: "k8s/configmap.yaml",
    content: generateKubernetesConfigMap(input, agentId),
    type: "yaml"
  });

  files.push({
    path: "tsconfig.json",
    content: JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          lib: ["ES2020"],
          outDir: "./dist",
          rootDir: "./src",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"]
      },
      null,
      2
    ),
    type: "json"
  });

  if (input.generateWorkflow) {
    files.push({
      path: `.github/workflows/agent-${agentId.toLowerCase()}.yml`,
      content: generateGitHubWorkflow(input, agentId),
      type: "yaml"
    });
  }

  // Add README
  files.push({
    path: "README.md",
    content: `# Agent: ${input.agentRole}

**Agent ID:** ${agentId}

## Description
${input.description}

## Capabilities
${input.capabilities.map(c => `- ${c}`).join("\n")}

## Organization Boundary
${input.orgBoundary || "Not specified"}

## Development

\`\`\`bash
npm install
npm run build
npm start
\`\`\`

## RBAC & Security

This agent is configured with the following RBAC rules (see k8s/configmap.yaml):
- **Allow:** ${input.capabilities.join(", ")}
- **Org Boundary:** ${input.orgBoundary || "default"}

## SSH CA Integration
${input.withSSHCA ? "✓ SSH CA integration enabled" : "✗ SSH CA integration not enabled"}

## Deployment

\`\`\`bash
kubectl apply -f k8s/configmap.yaml
\`\`\`
`,
    type: "markdown"
  });

  return {
    agentId,
    agentRole: input.agentRole,
    files,
    summary: `Scaffolded agent ${agentId} with role ${input.agentRole}. Generated ${files.length} files.`
  };
}

export async function handleScaffoldAgent(input: ScaffoldAgentInput): Promise<any> {
  try {
    const result = await scaffoldAgent(input);
    return {
      status: "success",
      agentId: result.agentId,
      summary: result.summary,
      files: result.files.map(f => ({
        path: f.path,
        type: f.type,
        size: f.content.length
      }))
    };
  } catch (err) {
    return {
      status: "error",
      error: String(err)
    };
  }
}
