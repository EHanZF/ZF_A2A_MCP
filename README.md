```mermaid
flowchart TB

%% ============================
%% BADGE LEGEND
%% ============================
subgraph Legend["Legend / Status"]
    B_STATUS["coverage: 84%"]
    B_LINT["lint: clean"]
    B_BUILD["build: passing"]
end

click B_STATUS "https://github.com/EHanZF/ZF_A2A_MCP/actions" "Open Coverage Workflow"
click B_LINT "https://github.com/EHanZF/ZF_A2A_MCP/actions" "Open Linting"
click B_BUILD "https://github.com/EHanZF/ZF_A2A_MCP/actions" "Open Build Status"

%% ============================
%% RESOURCES (docs/resources)
%% ============================
subgraph Resources["Resources (docs/resources)"]
    R1["R1 · ToolsMadeInZF"]
    R2["R2 · ToolsEngineering"]
    R3["R3 · Software Release Level Ref"]
    R4["R4 · EPB PSM Training (CDYP71)"]
    R5["R5 · ADBY5 New Hire Tool & Info"]
    R6["R6 · Key User Integrity Store"]
    R7["R7 · GenAI Use Cases @ ZF"]
    R8["R8 · Employee Onboarding"]
    R9["R9 · Agent Onboarding"]
end

%% ============================
%% CLICKABLE LINKS FOR R1–R9
%% ============================
click R1 "docs/resources/r1-tools-made-in-zf.md" "Open R1"
click R2 "docs/resources/r2-tools-engineering.md" "Open R2"
click R3 "docs/resources/r3-software-release-level-reference.md" "Open R3"
click R4 "docs/resources/r4-epb-psm-training-mentoring-cdyp71.md" "Open R4"
click R5 "docs/resources/r5-adby5-new-hire-tool-and-info.md" "Open R5"
click R6 "docs/resources/r6-key-user-integrity-knowledge-store.md" "Open R6"
click R7 "docs/resources/r7-generativeai-use-cases-at-zf.md" "Open R7"
click R8 "docs/resources/r8-employee-onboarding.md" "Open R8"
click R9 "docs/resources/r9-agent-onboarding.md" "Open R9"

%% ============================
%% FLOW BETWEEN RESOURCES
%% ============================
R1 --> R2
R2 --> R3
R3 --> R4
R3 --> R6
R4 --> R5
R6 --> R7
R8 --> R9
