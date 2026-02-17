ZF_A2A_MCP/
├─ README.md
├─ LICENSE
├─ .gitignore
├─ package.json
├─ pnpm-lock.yaml
├─ requirements.txt

├─ dmn/
│  ├─ OrchestrationDecisionModel.json          # your DMN JSON (as provided)
│  └─ schema.md

├─ mcp-server/
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ src/
│  │  ├─ index.ts                              # small MCP server exposing 4 tools (test-mode)
│  │  ├─ skills/
│  │  │  ├─ core_get_status.ts
│  │  │  ├─ normalize_orchestration_context.ts
│  │  │  ├─ dmn_evaluate_orchestration.ts
│  │  │  └─ rag_vector_query.ts
│  │  └─ utils/
│  │     ├─ logger.ts
│  │     └─ http.ts
│  └─ Dockerfile

├─ dmn-engine/
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ src/
│     ├─ dmnEvaluator.ts                       # Critic evaluator (Read & Act with justification)
│     └─ index.ts

├─ Agents/
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ workflows/
│  │  ├─ orchestration.graph.json              # LangGraph workflow spec (DMN Critic + actions)
│  │  └─ index.ts                              # Runner wiring LangGraph nodes
│  ├─ swarm/
│  │  ├─ registry.ts                           # agent registry & roles
│  │  ├─ swarmRouter.ts                        # orchestration over roles
│  │  └─ tokens.ts                             # JWT/session tokens passed across nodes
│  └─ utils/
│     ├─ mcpTransport.ts
│     └─ ragClient.ts

├─ cloudflare-worker/
│  ├─ wrangler.toml
│  └─ src/
│     ├─ index.ts                              # Worker entry: static + /onboard WS
│     ├─ onboarding-do.ts                      # Durable Object for WS + JWT mint
│     └─ jwt.ts

├─ orchestration-dmn-chart/                    # kept, the Helm chart lives here
│  ├─ Chart.yaml
│  ├─ values.yaml
│  └─ templates/
│     ├─ configmap-dmn.yaml
│     ├─ deployment.yaml
│     └─ service.yaml

├─ .github/
│  └─ workflows/
│     ├─ validate-dmn.yml
│     ├─ build-and-push.yml
│     ├─ deploy-worker.yml
│     └─ release-tarball.yml

└─ k8s/                                        # optional, if you keep plain manifests alongside Helm
   ├─ namespace.yaml
   └─ ingress.yaml
