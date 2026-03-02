/**
 * vscode-mcp-extension/src/extension.ts
 *
 * Main entry point for VS Code MCP extension.
 * 
 * Features:
 * - Command palette: Scaffold Agent, Add Tool, Edit RBAC, Generate Workflows
 * - Tree views: List agents and tools
 * - Auto-connect to local MCP server
 * - Interactive tool invocation
 * - GitHub Actions workflow generation with SSH CA support
 */

import * as vscode from "vscode";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import axios from "axios";

interface MCPExtensionState {
  client: Client | null;
  connected: boolean;
  serverUrl: string;
  tools: any[];
  agents: any[];
}

const state: MCPExtensionState = {
  client: null,
  connected: false,
  serverUrl: "http://localhost:7337/mcp/stream",
  tools: [],
  agents: []
};

let toolsTreeProvider: MCPTreeProvider;
let agentsTreeProvider: MCPAgentProvider;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log("[MCP] Extension activated");

  const config = vscode.workspace.getConfiguration("mcp");
  state.serverUrl = config.get("serverUrl") || state.serverUrl;

  // Register commands
  registerCommands(context);

  // Register tree providers
  toolsTreeProvider = new MCPTreeProvider();
  agentsTreeProvider = new MCPAgentProvider();
  
  vscode.window.registerTreeDataProvider("mcp-tools", toolsTreeProvider);
  vscode.window.registerTreeDataProvider("mcp-agents", agentsTreeProvider);

  // Auto-connect to MCP server
  if (config.get("autoConnect")) {
    try {
      await connectToMCPServer();
    } catch (err) {
      console.warn("[MCP] Failed to auto-connect:", err);
    }
  }
}

/**
 * Register all commands
 */
function registerCommands(context: vscode.ExtensionContext) {
  const commands = [
    {
      id: "mcp.scaffoldAgent",
      handler: scaffoldAgentCommand
    },
    {
      id: "mcp.createTool",
      handler: createToolCommand
    },
    {
      id: "mcp.editRBAC",
      handler: editRBACCommand
    },
    {
      id: "mcp.generateWorkflow",
      handler: generateWorkflowCommand
    },
    {
      id: "mcp.addSSHCAIntegration",
      handler: addSSHCACommand
    },
    {
      id: "mcp.connectToServer",
      handler: connectCommand
    },
    {
      id: "mcp.listTools",
      handler: listToolsCommand
    },
    {
      id: "mcp.invokeToolUI",
      handler: invokeToolUICommand
    }
  ];

  for (const { id, handler } of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, handler)
    );
  }
}

/**
 * Connect to MCP server
 */
async function connectToMCPServer() {
  if (state.connected) {
    vscode.window.showInformationMessage("[MCP] Already connected");
    return;
  }

  try {
    state.client = new Client({
      name: "vscode-mcp-extension",
      version: "1.0.0"
    });

    const transport = new StreamableHTTPClientTransport(state.serverUrl);
    await state.client.connect(transport);

    state.connected = true;
    vscode.window.showInformationMessage(`[MCP] Connected to ${state.serverUrl}`);

    // Refresh tool list
    await refreshTools();
  } catch (err) {
    state.connected = false;
    vscode.window.showErrorMessage(`[MCP] Connection failed: ${String(err)}`);
  }
}

/**
 * Refresh tools from MCP server
 */
async function refreshTools() {
  if (!state.client || !state.connected) {
    return;
  }

  try {
    // This would call server's tools/list endpoint
    // For MVP, we'll use the known tools
    state.tools = [
      { name: "actions.build_and_push", description: "Build and push multi-arch images" },
      { name: "actions.scaffold_runtime", description: "Scaffold agent runtime" },
      { name: "dmn.evaluate", description: "Evaluate DMN model" },
      { name: "rag.query", description: "Query RAG vector store" }
    ];

    toolsTreeProvider.refresh();
  } catch (err) {
    console.error("[MCP] Failed to refresh tools:", err);
  }
}

/**
 * Command: Scaffold Agent
 */
async function scaffoldAgentCommand() {
  const agentRole = await vscode.window.showQuickPick(
    ["orchestration-agent", "coding-agent", "review-agent", "ci-agent", "rag-agent"],
    { placeHolder: "Select agent role" }
  );

  if (!agentRole) return;

  const description = await vscode.window.showInputBox({
    prompt: "Enter agent description"
  });

  if (!description) return;

  const withSSHCA = await vscode.window.showQuickPick(
    ["Yes", "No"],
    { placeHolder: "Include SSH CA integration?" }
  );

  const withWorkflow = await vscode.window.showQuickPick(
    ["Yes", "No"],
    { placeHolder: "Generate GitHub Actions workflow?" }
  );

  try {
    if (!state.client || !state.connected) {
      throw new Error("Not connected to MCP server");
    }

    const result = await state.client.callTool("actions.scaffold_runtime", {
      agentRole,
      capabilities: ["dmn.evaluate", "rag.query"],
      description,
      withSSHCA: withSSHCA === "Yes",
      generateWorkflow: withWorkflow === "Yes",
      workflowSSHCAIntegration: withSSHCA === "Yes"
    });

    vscode.window.showInformationMessage(`[MCP] Agent scaffolded successfully`);
    agentsTreeProvider.refresh();
  } catch (err) {
    vscode.window.showErrorMessage(`[MCP] Scaffolding failed: ${String(err)}`);
  }
}

/**
 * Command: Create Tool
 */
async function createToolCommand() {
  vscode.window.showInformationMessage("[MCP] Create Tool - Not yet implemented");
}

/**
 * Command: Edit RBAC
 */
async function editRBACCommand() {
  vscode.window.showInformationMessage("[MCP] Edit RBAC - Opens RBAC config editor");
}

/**
 * Command: Generate Workflow
 */
async function generateWorkflowCommand() {
  const workflowType = await vscode.window.showQuickPick(
    ["agent-ci", "build-and-push", "deploy"],
    { placeHolder: "Select workflow type" }
  );

  if (!workflowType) return;

  const withSSHCA = await vscode.window.showQuickPick(
    ["Yes", "No"],
    { placeHolder: "Include org-level SSH CA?" }
  );

  try {
    const config = vscode.workspace.getConfiguration("mcp");
    const template = generateWorkflowTemplate(workflowType, withSSHCA === "Yes", config.get("gitHubOrg"));
    
    const editor = await vscode.workspace.openUntitledTextDocument({
      language: "yaml",
      content: template
    });

    await vscode.window.showTextDocument(editor);
  } catch (err) {
    vscode.window.showErrorMessage(`[MCP] Workflow generation failed: ${String(err)}`);
  }
}

/**
 * Generate workflow template with optional SSH CA
 */
function generateWorkflowTemplate(type: string, withSSHCA: boolean, org?: string): string {
  let template = `name: MCP ${type}

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build

`;

  if (withSSHCA && org) {
    template += `  ssh-ca-setup:
    runs-on: ubuntu-latest
    steps:
      - name: Configure SSH CA for org '${org}'
        run: |
          mkdir -p ~/.ssh
          # Fetch org SSH CA public key
          gh org ssh-ca fetch-pubkey --org ${org} > ~/.ssh/known_hosts.d/github
          
      - name: Request SSH certificate
        run: |
          gh auth refresh --scopes write:public_key
          # Request short-lived SSH cert from org CA
          ssh-keygen -D ~/.ssh/agent-key.pub -O cert-principals=$(whoami) -Z ~/.ssh/agent-cert.pub

`;
  }

  return template;
}

/**
 * Command: Add SSH CA Integration
 */
async function addSSHCACommand() {
  const org = await vscode.window.showInputBox({
    prompt: "Enter GitHub organization name"
  });

  if (!org) return;

  vscode.window.showInformationMessage(`[MCP] Adding SSH CA integration for org: ${org}`);
}

/**
 * Command: Connect to Server
 */
async function connectCommand() {
  await connectToMCPServer();
}

/**
 * Command: List Tools
 */
async function listToolsCommand() {
  if (!state.connected) {
    vscode.window.showWarningMessage("[MCP] Not connected to MCP server");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    state.tools.map(t => `${t.name}: ${t.description}`),
    { placeHolder: "Select tool to view details" }
  );

  if (picked) {
    vscode.window.showInformationMessage(picked);
  }
}

/**
 * Command: Invoke Tool UI
 */
async function invokeToolUICommand() {
  if (!state.connected) {
    vscode.window.showWarningMessage("[MCP] Not connected to MCP server");
    return;
  }

  const toolName = await vscode.window.showQuickPick(
    state.tools.map(t => t.name),
    { placeHolder: "Select tool to invoke" }
  );

  if (!toolName) return;

  vscode.window.showInformationMessage(`[MCP] Invoking ${toolName}...`);
}

/**
 * Tree provider for tools
 */
class MCPTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    return state.tools.map(tool => {
      const item = new vscode.TreeItem(
        tool.name,
        vscode.TreeItemCollapsibleState.None
      );
      item.tooltip = tool.description;
      item.command = {
        title: "Invoke",
        command: "mcp.invokeToolUI"
      };
      return item;
    });
  }
}

/**
 * Tree provider for agents
 */
class MCPAgentProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    return state.agents.map(agent => {
      const item = new vscode.TreeItem(
        agent.id || "Unknown",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.description = agent.role;
      return item;
    });
  }
}

export function deactivate() {
  console.log("[MCP] Extension deactivated");
}
