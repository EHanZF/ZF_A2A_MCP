/**
 * Connects Copilot → MCP → Agents through the RoutingFabric.
 */

import { RoutingFabric } from "../swarm/routingFabric.js";

export class CopilotBridge {
  fabric = new RoutingFabric();

  async handleCopilotRequest(req: any) {
    const { tool, input } = req;

    const route = await this.fabric.route({
      source: "COPILOT",
      task: tool,
      payload: input
    });

    return route.response;
  }
}
