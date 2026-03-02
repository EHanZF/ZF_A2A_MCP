/**
 * Bootstraps the MCP Server with:
 *  - Streamable HTTP transport (official MCP SDK)
 *  - RBAC enforcement middleware
 *  - Backwards-compatible JSON-RPC endpoints
 *  - Multi-transport support (HTTP, WebSocket)
 */

import express from "express";
import bodyParser from "body-parser";
import http from "http";
import { WebSocketServer } from "ws";
import { RoutingFabric } from "../../Agents/swarm/routingFabric.js";
import { toolMapping } from "./toolMapping.js";
import { rbacMiddleware, extractIdentityFromRequest } from "./identityExtractor.js";
import { enforceRBAC, auditLog } from "../../adk/security/rbac.js";
import { createStreamableServer } from "./streamableServer.js";

export async function bootstrapMCPServer(port = 8080) {
  const app = express();
  const httpServer = http.createServer(app);
  const fabric = new RoutingFabric();

  app.use(bodyParser.json());

  // ═════════════════════════════════════════════════════════════════
  // RBAC MIDDLEWARE: Apply to all endpoints
  // ═════════════════════════════════════════════════════════════════
  app.use(rbacMiddleware());

  // ═════════════════════════════════════════════════════════════════
  // STREAMABLE HTTP TRANSPORT (Official MCP SDK)
  // ═════════════════════════════════════════════════════════════════
  // This endpoint supports bidirectional communication over HTTP/WebSocket
  app.post("/mcp/stream", async (req, res) => {
    try {
      const { server, upgrade } = await createStreamableServer();
      const upgradedHandler = upgrade.handler(req, res);
      if (upgradedHandler) {
        await upgradedHandler;
      }
    } catch (err) {
      console.error("[MCP Stream] Error:", err);
      res.status(500).json({ error: "Stream initialization failed" });
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // BACKWARDS-COMPATIBLE JSON-RPC ENDPOINT
  // ═════════════════════════════════════════════════════════════════
  // Maintains compatibility with existing clients
  app.post("/mcp", async (req, res) => {
    const { method, name, arguments: args } = req.body || {};
    const identity = (req as any).mcpIdentity;

    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        result: { tools: toolMapping }
      });
    }

    if (method === "tools/call") {
      // RBAC gate: check if identity can invoke this tool
      const decision = enforceRBAC(identity, name);
      if (!decision.allowed) {
        console.warn(auditLog(identity, name, decision, args));
        return res.status(403).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: `Access Denied: ${decision.reason}`
          }
        });
      }

      try {
        const route = await fabric.route({
          source: "MCP_JSONRPC",
          task: name,
          payload: args
        });

        console.info(auditLog(identity, name, { allowed: true }, args));
        return res.json({ jsonrpc: "2.0", result: route.response });
      } catch (err) {
        console.error(`[MCP] Tool ${name} failed:`, err);
        return res.json({
          jsonrpc: "2.0",
          error: { code: -32603, message: String(err) }
        });
      }
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32601, message: "Unknown MCP method" }
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // WEBSOCKET UPGRADE (for Streamable HTTP over WebSocket)
  // ═════════════════════════════════════════════════════════════════
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", async (req, socket, head) => {
    if (req.url === "/mcp/stream") {
      try {
        const { server, upgrade } = await createStreamableServer();
        wss.handleUpgrade(req, socket, head, (ws) => {
          console.log("[WebSocket] Client connected to /mcp/stream");
          // MCP Streamable HTTP will handle the WebSocket
        });
      } catch (err) {
        console.error("[WebSocket] Upgrade failed:", err);
        socket.destroy();
      }
    } else {
      socket.destroy();
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // HEALTH CHECK & INFO ENDPOINTS
  // ═════════════════════════════════════════════════════════════════
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      transports: ["json-rpc", "streamable-http", "websocket"]
    });
  });

  app.get("/info", (req, res) => {
    res.json({
      name: "zf-a2a-mcp",
      version: "1.0.0",
      endpoints: [
        { path: "/mcp", method: "POST", description: "JSON-RPC MCP endpoint (legacy)" },
        { path: "/mcp/stream", method: "POST/WebSocket", description: "Streamable HTTP MCP endpoint (official SDK)" },
        { path: "/health", method: "GET" },
        { path: "/info", method: "GET" }
      ],
      tools: toolMapping
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // START SERVER
  // ═════════════════════════════════════════════════════════════════
  httpServer.listen(port, () => {
    console.log(`[MCP] Server ready on http://localhost:${port}`);
    console.log(`[MCP]   - JSON-RPC (legacy): POST http://localhost:${port}/mcp`);
    console.log(`[MCP]   - Streamable HTTP: POST/WS http://localhost:${port}/mcp/stream`);
    console.log(`[MCP]   - Health: GET http://localhost:${port}/health`);
  });

  return httpServer;
}
