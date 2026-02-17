import { evaluateOrchestrationWithCritic } from "@dmn-engine/dmnEvaluator";
import graph from "./orchestration.graph.json" assert { type: "json" };
import { mcpCall } from "../utils/mcpTransport";
import { queryRAG } from "../utils/ragClient";

export async function runOrchestration(input: any) {
  // Node: normalize tool (call MCP normalize)
  const normalized = await mcpCall("normalize_orchestration_context", input);

  // Node: DMN Critic evaluator (in-process)
  const { result: dmn_result, critic } = evaluateOrchestrationWithCritic(normalized);

  // Node: RAG
  const rag_support = await queryRAG(`route:${dmn_result.route} policy:${dmn_result.policy} capacity:${dmn_result.capacity}`, 5);

  // Node: decide (compile)
  const plan = dmn_result.plan;
  const action = dmn_result.action;

  // Node: dispatch (MCP or A2A call)
  const dispatch_status = await mcpCall("core:dispatch_orchestration", { plan, action, critic, rag_support });

  return { dmn_result, critic, rag_support, plan, action, dispatch_status };
}
