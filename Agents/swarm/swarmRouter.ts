import { runOrchestration } from "../workflows";
import { agents } from "./registry";
import { mcpCall } from "../utils/mcpTransport";

export async function routeTask(payload: any) {
  // orchestrator role owns the pipeline
  const orchestrator = agents.find(a => a.role === "orchestration-agent");
  if (!orchestrator) throw new Error("No orchestration-agent registered");

  const out = await runOrchestration(payload);

  // dispatch plan/action to A2A or MCP tool
  await mcpCall("core:dispatch_orchestration", { plan: out.plan, action: out.action, critic: out.critic });
  return out;
  if (task.type === "review-actions")
  return mcpCall("review_github_actions", {});

}
