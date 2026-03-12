```mermaid
flowchart TB

%% ============================
%% BADGE LEGEND
%% ============================
subgraph Legend[Badge Legend]
    B_STATUS["CI Status"]
    B_COVERAGE["Test Coverage"]
    B_SECURITY["Security Scan"]
end

click B_STATUS "https://github.com/EHanZF/ZF_A2A_MCP/actions/workflows/validate-dmn.yml" "Open CI Workflow"
click B_COVERAGE "https://github.com/EHanZF/ZF_A2A_MCP/actions" "Open Coverage Workflow"
click B_SECURITY "https://github.com/EHanZF/ZF_A2A_MCP/security" "Open Security Page"

%% ============================
%% ARCHITECTURE DIAGRAM
%% ============================
subgraph User[User Layer]
    UQ[User Query]
    UO[Orchestrator]
end

subgraph MCP[MCP Resources]
    R1[ToolsMadeInZF]
    R2[ToolsEngineering]
    R3[ReleaseRef]
    R4[EPB_PSM_Training]
    R5[ADBY5_Onboarding]
    R6[Integrity_Knowledge]
    R7[GenAI_UseCases]
    R8[Employee_Onboarding]
    R9[Agent_Onboarding]
end

subgraph Ingest[Ingestion]
    D1[delta]
    G1[get_items]
    T1[normalize_text]
    A1[extract_text]
    C1[chunk]
    E1[embed]
    X1[upsert]
    S1[apply_acls]
    K1[link_semantics]
    H1[repo_link]
    P1[publish]
end

subgraph Vector[Vector & Index]
    V1[SearchIndex]
    V2[EmbeddingStore]
end

subgraph Repo[Repo]
    RG[README]
    RI[IaC]
    RC[Commits]
end

subgraph Retrieval[Retrieval]
    Q1[query_topk]
    Q2[filter_identity]
    Q3[synthesize]
end

%% ============================
%% FLOWS
%% ============================
UQ --> UO --> Q1
R1 -.-> D1
R2 -.-> D1
R3 -.-> D1
R4 -.-> D1
R5 -.-> D1
R6 -.-> D1
R7 -.-> D1
R8 -.-> D1
R9 -.-> D1
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

%% ============================
%% OPTIONAL CLICKABLES FOR REPO NODES
%% ============================
click RG "https://github.com/EHanZF/ZF_A2A_MCP" "Open Repo Root"
click RC "https://github.com/EHanZF/ZF_A2A_MCP/commits/main" "Commit History"
click RI "https://github.com/EHanZF/ZF_A2A_MCP/tree/main/infra" "Infrastructure Files"
