import {
  EmbedRequest, EmbedResponse,
  VectorUpsertRequest, VectorUpsertResponse,
  VectorQueryRequest, VectorQueryResponse,
  DotRequest, DotResponse
} from "./types.js";

export class VectorBusClient {
  constructor(private baseUrl: string, private bearer?: string) {}
  private h() { const h: Record<string, string> = { "content-type": "application/json" };
                if (this.bearer) h.authorization = `Bearer ${this.bearer}`; return h; }

  async healthz(): Promise<boolean> {
    const r = await fetch(`${this.baseUrl}/healthz`, { method: "GET" });
    return r.ok;
  }
  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const r = await fetch(`${this.baseUrl}/embed`, { method: "POST", headers: this.h(), body: JSON.stringify(req) });
    if (!r.ok) throw new Error(`embed failed: ${r.status}`); return r.json();
  }
  async upsertVectors(req: VectorUpsertRequest): Promise<VectorUpsertResponse> {
    const r = await fetch(`${this.baseUrl}/vectors`, { method: "POST", headers: this.h(), body: JSON.stringify(req) });
    if (!r.ok) throw new Error(`upsert failed: ${r.status}`); return r.json();
  }
  async query(req: VectorQueryRequest): Promise<VectorQueryResponse> {
    const r = await fetch(`${this.baseUrl}/query`, { method: "POST", headers: this.h(), body: JSON.stringify(req) });
    if (!r.ok) throw new Error(`query failed: ${r.status}`); return r.json();
  }
  async dot(req: DotRequest): Promise<DotResponse> {
    const r = await fetch(`${this.baseUrl}/dot`, { method: "POST", headers: this.h(), body: JSON.stringify(req) });
    if (!r.ok) throw new Error(`dot failed: ${r.status}`); return r.json();
  }
}
