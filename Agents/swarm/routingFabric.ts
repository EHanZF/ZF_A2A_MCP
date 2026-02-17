/**
 * routingFabric.ts
 *
 * Core routing layer for:
 *  - Multi-Agent orchestration (A2A Bus)
 *  - MCP call dispatch
 *  - Copilot API → MCP tool mapping
 *  - Cloudflare Worker / Durable Object session routing
 */

import { Agents, getAgentById, getAgentsByRole } from "./registry.js";
import { mcpCall } from "../utils/mcpTransport.js";
import { VectorBusClient } from "@zf/vector-bus-sdk";
import { runOrchestration } from "../workflows/index.js";

export interface RoutingEnvelope {
  source: string;              // agent id
  targetRole?: string;         // explicit role override
  task: string;                // semantic task name
  payload: any;                // arbitrary data
  token?: string;              // JWT from Worker
}

export interface RoutingResult {
  agent: string;
  response: any;
}

export class RoutingFabric {
  vector: VectorBusClient;

  constructor() {
    this.vector = new VectorBusClient(
      process.env.VECTOR_BUS_URL || "http://localhost:8088/v1",
      process.env.JWT
    );
  }

  /**
   * Select agent by role; fallback to orchestration agent if unspecified
   */
  private resolveAgent(input: RoutingEnvelope) {
    if (input.targetRole) {
      const selected = getAgentsByRole(input.targetRole);
      if (selected.length === 0) throw new Error(`No agents found for role: ${input.targetRole}`);
      return selected[0];
    }

    // default orchestration flow
    return getAgentsByRole("orchestration-agent")[0];
  }

  /**
   * Handle incoming task routing from:
   *  - Copilot API
   *  - Cloudflare Worker sessions
   *  - A2A Bus
   */
  async route(env: RoutingEnvelope): Promise<RoutingResult> {
    const agent = this.resolveAgent(env);

    switch (env.task) {

      // ─────────────────────────────────────────────
      // DMN Orchestration pipeline
      // ─────────────────────────────────────────────
      case "dmn.orchestrate": {
        const out = await runOrchestration(env.payload);
        return { agent: agent.id, response: out };
      }

      // ─────────────────────────────────────────────
      // GitHub Actions Reviewer
      // ─────────────────────────────────────────────
      case "actions.review": {
        const reviewAgent = getAgentsByRole("review-agent")[0];
        const out = await mcpCall("review_github_actions", env.payload || {});
        return { agent: reviewAgent.id, response: out };
      }

      // ─────────────────────────────────────────────
      // Vector Bus / RAG
      // ─────────────────────────────────────────────
      case "vector.embed":
        return {
          agent: "VEC001",
          response: await this.vector.embed(env.payload)
        };

      case "vector.upsert":
        return {
          agent: "VEC001",
          response: await this.vector.upsertVectors(env.payload)
        };

      case "vector.query":
        return {
          agent: "VEC001",
          response: await this.vector.query(env.payload)
        };

      case "rag.query": {
        const out = await mcpCall("rag_vector_query", env.payload);
        return { agent: "RAG001", response: out };
      }

      // ─────────────────────────────────────────────
      // Simulation (WHAM 3D)
      // ─────────────────────────────────────────────
      case "simulation.step": {
        const out = await fetch("http://localhost:7000/step", {
          method: "POST",
          body: JSON.stringify(env.payload),
          headers: { "content-type": "application/json" }
        }).then(r => r.json());
        return { agent: "SIM001", response: out };
      }

      // ─────────────────────────────────────────────
      // Zero‑Knowledge Proof Verification
      // ─────────────────────────────────────────────
      case "zk.verify": {
        const verifyAgent = getAgentsByRole("zk-verifier-agent")[0];
        const out = await mcpCall("zk_verify_proof", env.payload);
        return { agent: verifyAgent.id, response: out };
      }

      // ─────────────────────────────────────────────
      // CI / Release gating
      // ─────────────────────────────────────────────
      case "ci.release_gate": {
        const ciAgent = getAgentsByRole("ci-agent")[0];
        const out = await mcpCall("ci_run_release_checks", env.payload);
        return { agent: ciAgent.id, response: out };
      }

      default:
        throw new Error(`Unknown routing task: ${env.task}`);
    }
  }
}
