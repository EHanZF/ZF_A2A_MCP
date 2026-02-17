export const toolMapping = [
  {
    name: "dmn.orchestrate",
    description: "Run the DMN Critic Orchestration Pipeline."
  },
  {
    name: "actions.review",
    description: "Review GitHub Actions workflows using REVIEWER001."
  },
  {
    name: "vector.embed",
    description: "Embed text using Vector Bus agent."
  },
  {
    name: "vector.upsert",
    description: "Upsert embedding vectors into the Vector Bus."
  },
  {
    name: "vector.query",
    description: "Query nearest vectors in Vector Bus."
  },
  {
    name: "rag.query",
    description: "Query RAG service for similar documents."
  },
  {
    name: "simulation.step",
    description: "Run a WHAM simulation step."
  },
  {
    name: "zk.verify",
    description: "Verify Zero-Knowledge proofs for release gating."
  },
  {
    name: "ci.release_gate",
    description: "Run CI checks and gate releases."
  }
];
