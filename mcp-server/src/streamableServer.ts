/**
 * mcp-server/src/streamableServer.ts
 *
 * MCP Streamable HTTP server using official SDK.
 * Supports WebSocket and HTTP long-polling for bidirectional communication.
 * 
 * Integrates with RBAC enforcement layer for all tool invocations.
 */

import {
  Server,
  Tool,
  TextContent,
  ErrorContent
} from "@modelcontextprotocol/sdk/types.js";
import {
  StreamableHTTPServer,
  StreamableHTTPUpgradeHandler
} from "@modelcontextprotocol/sdk/server/http.js";
import { enforceRBAC, auditLog, type Identity } from "../../adk/security/rbac.js";
import { RoutingFabric } from "../../Agents/swarm/routingFabric.js";

/**
 * Initialize Streamable HTTP Server with MCP tools and RBAC enforcement.
 */
export async function createStreamableServer(): Promise<{
  server: Server;
  upgrade: StreamableHTTPUpgradeHandler;
}> {
  const server = new Server({
    name: "zf-a2a-mcp",
    version: "1.0.0"
  });

  const fabric = new RoutingFabric();

  // ═══════════════════════════════════════════════════════════════════════════
  // TOOL REGISTRATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * actions.build_and_push
   *
   * Multi-architecture container build and push.
   * Requires: developer or admin role.
   */
  server.tool("actions.build_and_push", {
    description: "Build and push multi-architecture Docker images",
    inputSchema: {
      type: "object" as const,
      properties: {
        image: { type: "string", description: "Image name (e.g., ghcr.io/owner/repo)" },
        tags: { type: "array", items: { type: "string" }, description: "Additional tags" },
        autoTag: {
          type: "object",
          properties: {
            sha: { type: "string" },
            branch: { type: "string" },
            semver: { type: "string" }
          }
        },
        platforms: {
          type: "array",
          items: { type: "string" },
          description: "Target platforms (e.g., linux/amd64, linux/arm64)"
        },
        push: { type: "boolean", description: "Push after build" },
        dryRun: { type: "boolean" }
      },
      required: ["image"]
    }
  }, async (input: any, identity?: Identity) => {
    // Tool-level RBAC enforcement
    const decision = enforceRBAC(identity || { id: "unknown", role: "reader", source: "http-header", timestamp: Date.now() }, "actions.build_and_push");
    if (!decision.allowed) {
      console.warn(auditLog(identity!, "actions.build_and_push", decision, input));
      return {
        type: "text" as const,
        text: `Access Denied: ${decision.reason}`
      };
    }

    try {
      const result = await fabric.route({
        source: "MCP_STREAMABLE",
        task: "actions.build_and_push",
        payload: input
      });
      
      console.info(auditLog(identity!, "actions.build_and_push", { allowed: true }, input));
      
      return {
        type: "text" as const,
        text: JSON.stringify(result.response, null, 2)
      };
    } catch (err) {
      return {
        type: "text" as const,
        text: `Error: ${String(err)}`
      };
    }
  });

  /**
   * actions.scaffold_runtime
   *
   * Generate agent boilerplate and CI workflows.
   * Requires: developer or admin role.
   */
  server.tool("actions.scaffold_runtime", {
    description: "Scaffold agent runtime + GitHub Actions workflows",
    inputSchema: {
      type: "object" as const,
      properties: {
        agentRole: {
          type: "string",
          enum: ["orchestration-agent", "coding-agent", "review-agent", "ci-agent"],
          description: "Agent role/type"
        },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description: "Agent capabilities (e.g., dmn.evaluate, actions.build_and_push)"
        },
        description: { type: "string" },
        withSSHCA: {
          type: "boolean",
          description: "Include org-level SSH CA integration in generated workflows"
        },
        orgBoundary: { type: "string", description: "Organization boundary for RASIC" }
      },
      required: ["agentRole", "capabilities"]
    }
  }, async (input: any, identity?: Identity) => {
    const decision = enforceRBAC(identity || { id: "unknown", role: "reader", source: "http-header", timestamp: Date.now() }, "actions.scaffold_runtime");
    if (!decision.allowed) {
      console.warn(auditLog(identity!, "actions.scaffold_runtime", decision, input));
      return { type: "text" as const, text: `Access Denied: ${decision.reason}` };
    }

    try {
      const result = await fabric.route({
        source: "MCP_STREAMABLE",
        task: "actions.scaffold_runtime",
        payload: input
      });
      
      console.info(auditLog(identity!, "actions.scaffold_runtime", { allowed: true }, input));
      
      return {
        type: "text" as const,
        text: JSON.stringify(result.response, null, 2)
      };
    } catch (err) {
      return {
        type: "text" as const,
        text: `Error: ${String(err)}`
      };
    }
  });

  /**
   * dmn.evaluate
   *
   * Evaluate orchestration DMN model.
   * Requires: developer or admin role.
   */
  server.tool("dmn.evaluate", {
    description: "Evaluate DMN orchestration model",
    inputSchema: {
      type: "object" as const,
      properties: {
        context: {
          type: "object",
          description: "DMN input context"
        }
      },
      required: ["context"]
    }
  }, async (input: any, identity?: Identity) => {
    const decision = enforceRBAC(identity || { id: "unknown", role: "reader", source: "http-header", timestamp: Date.now() }, "dmn.evaluate");
    if (!decision.allowed) {
      console.warn(auditLog(identity!, "dmn.evaluate", decision, input));
      return { type: "text" as const, text: `Access Denied: ${decision.reason}` };
    }

    try {
      const result = await fabric.route({
        source: "MCP_STREAMABLE",
        task: "dmn.orchestrate",
        payload: input
      });
      
      return {
        type: "text" as const,
        text: JSON.stringify(result.response, null, 2)
      };
    } catch (err) {
      return {
        type: "text" as const,
        text: `Error: ${String(err)}`
      };
    }
  });

  /**
   * rag.query
   *
   * Query RAG vector store.
   * Requires: reader, developer, or admin role.
   */
  server.tool("rag.query", {
    description: "Query RAG vector store",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        topK: { type: "number", default: 5 }
      },
      required: ["query"]
    }
  }, async (input: any, identity?: Identity) => {
    const decision = enforceRBAC(identity || { id: "unknown", role: "reader", source: "http-header", timestamp: Date.now() }, "rag.query");
    if (!decision.allowed) {
      console.warn(auditLog(identity!, "rag.query", decision, input));
      return { type: "text" as const, text: `Access Denied: ${decision.reason}` };
    }

    try {
      const result = await fabric.route({
        source: "MCP_STREAMABLE",
        task: "rag.query",
        payload: input
      });
      
      return {
        type: "text" as const,
        text: JSON.stringify(result.response, null, 2)
      };
    } catch (err) {
      return {
        type: "text" as const,
        text: `Error: ${String(err)}`
      };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUEST MIDDLEWARE: Extract and validate identity before tool execution
  // ═══════════════════════════════════════════════════════════════════════════

  // Hook: intercept tool calls and attach identity context
  const originalExecute = server.execute;
  server.execute = async function(request: any) {
    // Extract identity from request headers or context
    // This would need to be passed through the transport layer
    // For now, use environment variables as fallback
    request.identity = {
      id: process.env.CI_GITHUB_ACTOR || process.env.SSH_GITHUB_LOGIN || "anonymous",
      role: (process.env.CI_ROLE || "reader") as any,
      source: process.env.CI_GITHUB_ACTOR ? "github-actions" : "ssh",
      timestamp: Date.now()
    };

    return originalExecute.call(this, request);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE HTTP UPGRADE HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  const upgrade = new StreamableHTTPUpgradeHandler({ server });

  return { server, upgrade };
}
