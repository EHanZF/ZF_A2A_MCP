flowchart TD
  subgraph User[Human + Orchestrator Agent]
    UQ[User Query / Task]
    UO[Plan / Orchestrate]
  end

  subgraph MCP[MCP Resource Layer]
    R1[Resource: ToolsMadeInZF]
    R2[Resource: ToolsEngineering]
    R3[Resource: Software Release Level Reference]
    R4[Resource: EPB PSM Training/Mentoring - ADBY5]
    R5[Resource: ADBY5 New Hire Tool & Info]
    R6[Resource: Key User Integrity Knowledge Store]
    R7[Resource: GenerativeAI Use Cases @ ZF]
    R8[Resource: Employee Onboarding]
    R9[Resource: Agent Onboarding]
  end

  subgraph Ingest[Ingestion Pipeline]
    D1[list.get_delta]
    G1[list.get_items]
    T1[transform.normalize_text]
    A1[attachments.extract_text]
    C1[chunk.apply_strategy]
    E1[embed.generate_vectors]
    X1[index.upsert_chunks]
    S1[security.apply_acls]
    K1[graph.link_semantics]
    H1[anchors.repo_link]
    P1[bus.publish_delta]
  end

  subgraph Vector[Vector + Index]
    V1["(Azure Cognitive Search: zf-lists)"]
    V2["(Embeddings Store)"]
  end

  subgraph Repo[Root GitHub Repo]
    RG["README + Mermaid (Architecture)"]
    RI[IaC Modules / Pipelines]
    RC[Commit Log / PRs]
  end

  subgraph Retrieval[Query + Reason]
    Q1[index.query_topk]
    Q2[security.filter_by_identity]
    Q3[grounding.synthesize_context]
  end

  UQ --> UO --> Q1

  R1-.->D1
  R2-.->D1
  R3-.->D1
  R4-.->D1
  R5-.->D1
  R6-.->D1
  R7-.->D1
  R8-.->D1
  R9-.->D1

  D1 --> G1 --> T1 --> A1 --> C1 --> E1 --> X1
  X1 --> S1 --> K1 --> H1 --> P1

  E1 --> V2
  X1 --> V1

  RG --- H1
  RI --- H1
  RC --- P1

  Q1 --> Q2 --> Q3 --> UO
  V1 --> Q1
  V2 --> Q1
