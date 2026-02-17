export type Role = "orchestration-agent" | "decision-agent" | "coding-agent" | "mcp-client";
export interface Agent { id: string; role: Role; capabilities: string[]; }

export const agents: Agent[] = [
  { id: "CDYP71", role: "orchestration-agent", capabilities: ["dmn.evaluate","rag.query","dispatch"] },
  { id: "DEC001", role: "decision-agent",      capabilities: ["dmn.inspect"] },
  { id: "CLI001", role: "mcp-client",          capabilities: ["http.mcp"] }
];
``
