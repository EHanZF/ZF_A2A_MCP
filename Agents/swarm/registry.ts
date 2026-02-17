/**
 * ZF A2A MCP – Multi-Agent Registry
 *
 * This file declares ALL Agents in the system, grouped by domain.
 * Each Agent is MCP-compliant and addressable by the orchestration layer.
 *
 * The registry powers:
 * - Cloudflare Worker → Durable Object multiplexing
 * - LangGraph multi-agent routing
 * - A2A bus fan-out
 * - RAG-assisted tool dispatch
 * - Orchestration plan execution
 * - CI/CD model verification (ZK-proof gating)
 */

export type AgentRole =
  | "orchestration-agent"
  | "decision-agent"
  | "coding-agent"
  | "review-agent"
  | "rag-agent"
  | "vector-bus-agent"
  | "worker-gateway-agent"
  | "durable-object-agent"
  | "ci-agent"
  | "zk-verifier-agent"
  | "simulation-agent"
  | "telemetry-agent"
  | "mcp-client";

export interface AgentSpec {
  id: string;
  role: AgentRole;
  description: string;
  capabilities: string[];
  transport: "mcp" | "a2a" | "http" | "ws";
  endpoint?: string;
  internal?: boolean;
}

/**
 * CANONICAL AGENT REGISTRY
 *
 * All agents inside the system are declared here. The orchestrator reads this list
 * to decide which agent should execute which action.
 *
 * To add new agents, append them here and ensure their MCP skill / http endpoint exists.
 */

export const Agents: AgentSpec[] = [

  // ───────────────────────────────────────────────
  // 1. MCP ORCHESTRATION AGENT (DMN Critic Model)
  // ───────────────────────────────────────────────
  {
    id: "CDYP71",
    role: "orchestration-agent",
    description: "Primary DMN Critic Orchestration Agent (A2A core executor).",
    capabilities: [
      "dmn.evaluate",
      "dmn.critic",
      "normalize.context",
      "rag.query",
      "plan.dispatch",
      "mcp.call"
    ],
    transport: "mcp",
    endpoint: "http://localhost:8080/mcp"
  },

  // ───────────────────────────────────────────────
  // 2. DECISION AGENT (DMN Inspector / DRD Visualizer)
  // ───────────────────────────────────────────────
  {
    id: "DEC001",
    role: "decision-agent",
    description: "Decision Inspector – provides DRD and DMN rule introspection.",
    capabilities: [
      "dmn.inspect",
      "dmn.get_rules",
      "dmn.get_inputs",
      "dmn.get_outputs",
      "dmn.validate"
    ],
    transport: "mcp",
    endpoint: "http://localhost:8080/mcp"
  },

  // ───────────────────────────────────────────────
  // 3. GITHUB ACTIONS REVIEW AGENT
  // ───────────────────────────────────────────────
  {
    id: "REVIEWER001",
    role: "review-agent",
    description: "Analyzes GitHub Actions workflow files for security and correctness.",
    capabilities: [
      "actions.review",
      "actions.lint",
      "security.scan"
    ],
    transport: "mcp",
    endpoint: "http://localhost:8080/mcp"
  },

  // ───────────────────────────────────────────────
  // 4. VECTOR BUS AGENT (LLM Embeddings / Upsert / Query)
  // ───────────────────────────────────────────────
  {
    id: "VEC001",
    role: "vector-bus-agent",
    description: "Vector Bus client providing embeddings, upserts, and nearest-neighbor search.",
    capabilities: [
      "vector.embed",
      "vector.upsert",
      "vector.query",
      "vector.dot"
    ],
    transport: "http",
    endpoint: process.env.VECTOR_BUS_URL || "http://localhost:8088/v1"
  },

  // ───────────────────────────────────────────────
  // 5. RAG SERVICE AGENT
  // ───────────────────────────────────────────────
  {
    id: "RAG001",
    role: "rag-agent",
    description: "Text chunking + retrieval-augmented generation support.",
    capabilities: [
      "rag.ingest",
      "rag.query",
      "rag.similarity"
    ],
    transport: "http",
    endpoint: "http://localhost:8000"
  },

  // ───────────────────────────────────────────────
  // 6. CLOUDFLARE WORKER GATEWAY AGENT
  // ───────────────────────────────────────────────
  {
    id: "CFW001",
    role: "worker-gateway-agent",
    description: "Cloudflare Worker Gateway handling WS onboarding + JWT mint.",
    capabilities: [
      "ws.onboard",
      "jwt.issue",
      "mcp.forward",
      "task.route"
    ],
    transport: "ws",
    endpoint: "wss://your-worker.example.com/onboard"
  },

  // ───────────────────────────────────────────────
  // 7. DURABLE OBJECT AGENT
  // ───────────────────────────────────────────────
  {
    id: "DO001",
    role: "durable-object-agent",
    description: "Stateful coordination layer for WS sessions, MCP calls, and fan-out.",
    capabilities: [
      "session.manage",
      "broadcast",
      "mcp.proxy"
    ],
    transport: "ws",
    endpoint: "wss://your-worker.example.com/onboard"
  },

  // ───────────────────────────────────────────────
  // 8. CI PIPELINE AGENT (lint, build, test)
  // ───────────────────────────────────────────────
  {
    id: "CI001",
    role: "ci-agent",
    description: "CI Orchestrator – runs tests, builds, security scans, release gating.",
    capabilities: [
      "ci.run_tests",
      "ci.build",
      "ci.lint",
      "ci.release-gate"
    ],
    transport: "mcp",
    endpoint: "http://localhost:8080/mcp",
    internal: true
  },

  // ───────────────────────────────────────────────
  // 9. ZERO-KNOWLEDGE PROOF VERIFIER AGENT
  // ───────────────────────────────────────────────
  {
    id: "ZK001",
    role: "zk-verifier-agent",
    description: "Runs ZK proof verification for onboarding + release model gating.",
    capabilities: [
      "zk.verify",
      "zk.proof_check",
      "zk.release_gate"
    ],
    transport: "mcp",
    endpoint: "http://localhost:8080/mcp"
  },

  // ───────────────────────────────────────────────
  // 10. WHAM SIMULATION AGENT (3D / WASM Runtime)
  // ───────────────────────────────────────────────
  {
    id: "SIM001",
    role: "simulation-agent",
    description: "WASM WHAM engine used for multi-agent physics and 3D scene updates.",
    capabilities: [
      "wham.step",
      "wham.bind",
      "wham.render"
    ],
    transport: "http",
    endpoint: "http://localhost:7000"
  },

  // ───────────────────────────────────────────────
  // 11. TELEMETRY AGENT
  // ───────────────────────────────────────────────
  {
    id: "TEL001",
    role: "telemetry-agent",
    description: "Collects logs, events, metrics, and propagates them to RAG / Vector Bus.",
    capabilities: [
      "telemetry.collect",
      "telemetry.push",
      "telemetry.summarize"
    ],
    transport: "http",
    endpoint: "http://localhost:9090"
  },

  // ───────────────────────────────────────────────
  // 12. BASELINE MCP CLIENT AGENT
  // ───────────────────────────────────────────────
  {
    id: "CLI001",
    role: "mcp-client",
    description: "Generic MCP client shim for simple tool invocations.",
    capabilities: ["mcp.call"],
    transport: "mcp",
    endpoint: "http://localhost:8080/mcp"
  }
];

/**
 * Lookup utility
 */
export function getAgentById(id: string): AgentSpec | undefined {
  return Agents.find(a => a.id === id);
}

export function getAgentsByRole(role: AgentRole): AgentSpec[] {
  return Agents.filter(a => a.role === role);
}

export function allAgents(): AgentSpec[] {
  return [...Agents];
}
