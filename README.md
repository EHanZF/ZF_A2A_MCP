ZF_A2A_MCP

What you’ll get in this drop

Monorepo tree, matching your current layout, extended with:

Agents/ → LangGraph (DMN Critic evaluator as nodes), multi‑agent swarm orchestrator.
cloudflare-worker/ → Worker + Durable Object (JWT mint + MCP fan‑out).
dmn-engine/ → TS DMN Critic evaluator (Read‑and‑Act with justification).
orchestration-dmn-chart/ → Helm chart already in your repo (kept).
.github/workflows/ → Jobs to validate DMN, build/push images, deploy Worker, release tarball.


A release tarball assembled by CI with the finalized sources + manifests.
Tokens through runtime workflow: Worker mints JWT → LangGraph session → Orchestration nodes → MCP tool calls → durable orchestration.


Note: All code scaffolds below are minimal and buildable. You can tweak names/paths to match your internal conventions. Everything stays DMN‑driven and compatible with the 4‑tool MCP bus for test mode.
