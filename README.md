--- a/README.md
+++ b/README.md
@@
 ## Documentation
+
+- **[Agents.md](./How Agents use this repo as a vector store and RAG surface.

# 🚀 ZF_A2A_MCP Monorepo
### Multi-Agent MCP System for DMN-Driven Orchestration, Vector Flow Management, and EPB Technical Reasoning

This monorepo contains the complete MCP-based orchestration framework for Agents, DMN microservices, vector management, Helm deployments, CI/CD workflows, and the runtime environment for Agent CDYP7.

---

## 📦 Repository Structure (Mermaid Diagram)

```mermaid
flowchart TD

    subgraph Root["ZF_A2A_MCP Monorepo"]
        direction TB

        subgraph Agents["Agents/"]
            direction TB
            A1["CDYP7 (Primary Orchestrator)"]
            A2["TSL_ZF_EPB (Tech Specialist Leader)"]
            A3["FuzzingSubAgent"]
            A4["DMN Critic"]
            A5["Safety Auditor"]
            A6["Synthesizer Agent"]
        end

        subgraph MCPServer["mcp-server/"]
            direction TB
            M1["index.ts"]
            M2["Tool Bus Dispatcher"]
            M3["RBAC + Agent Identity"]
            M4["Tool Manifest Exporter"]
        end

        subgraph VectorBus["vector-bus/"]
            direction TB
            V1["store.ts"]
            V2["Embedding Schema Validation"]
            V3["Vector GC / Dedupe / Epoch Compaction"]
            V4["Mesh Token Flow"]
        end

        subgraph DMNGateway["services/dmn-gateway/"]
            direction TB
            D1["app.py"]
            D2["dmn_runtime.py"]
            D3["mcp_dmn_wrapper.py"]
            D4["fuzzing_agent.py"]
            D5["vector_mesh.py"]
            D6["Dockerfile"]
            D7["requirements.txt"]
        end

        subgraph Helm["helm/orchestration-dmn-chart/"]
            H1["Chart.yaml"]
            H2["values.yaml"]
            H3["dmn-gateway-deployment.yaml"]
            H4["dmn-gateway-service.yaml"]
            H5["dmn-gateway-ingress.yaml (TLS)"]
            H6["dmn-gateway-hpa.yaml"]
        end

        subgraph Workflows[".github/workflows/"]
            W1["model-stack-ci.yml"]
            W2["DMN Gateway Build/Push"]
            W3["Helm Lint/Test"]
        end

        subgraph State["state/runtime/"]
            S1["system_state.json"]
            S2["tensor_map.json"]
            S3["checkpoint ticks"]
            S4["Agent Role Bindings"]
        end

        subgraph Docs["docs/"]
            O1["Onboarding Guide"]
            O2["Architecture Overview"]
            O3["ESOW Ingestion Notes"]
            O4["Delta Rules"]
        end
    end

    Agents --> MCPServer
    MCPServer --> VectorBus
    MCPServer --> DMNGateway
    DMNGateway --> State
    VectorBus --> State
    Helm --> DMNGateway
    Workflows --> Helm
    Docs --> Agents

