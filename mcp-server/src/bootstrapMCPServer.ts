/**
 * Bootstraps the MCP Server, registers tools,
 * and exposes them via HTTP for Copilot API clients.
 */

import express from "express";
import bodyParser from "body-parser";
import { RoutingFabric } from "../../Agents/swarm/routingFabric.js";
import { toolMapping } from "./toolMapping.js";

export async function bootstrapMCPServer(port = 8080) {
  const app = express();
  const fabric = new RoutingFabric();

  app.use(bodyParser.json());

  // MCP tool discovery
  app.post("/mcp", async (req, res) => {
    const { method, name, arguments: args } = req.body || {};

    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        result: { tools: toolMapping }
      });
    }

    if (method === "tools/call") {
      const route = await fabric.route({
        source: "MCP",
        task: name,
        payload: args
      });

      return res.json({ jsonrpc: "2.0", result: route.response });
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32601, message: "Unknown MCP method" }
    });
  });

  app.listen(port, () => {
    console.log(`[MCP] Server ready on port ${port}`);
  });
}
