export interface EmbedRequest { texts: string[]; dim?: number; model?: string; }
export interface EmbedResponse { dim: number; embeddings: { text: string; vector: number[] }[]; }

export interface VectorUpsertItem { id: string; vector: number[]; text?: string; meta?: Record<string, unknown>; }
export interface VectorUpsertRequest { namespace?: string; items: VectorUpsertItem[]; }
export interface VectorUpsertResponse { upserted: number; }

export interface VectorQueryRequest { namespace?: string; vector: number[]; topK?: number; includeText?: boolean; }
export interface VectorQueryMatch { id: string; score: number; text?: string; meta?: Record<string, unknown>; }
export interface VectorQueryResponse { matches: VectorQueryMatch[]; }

export interface DotRequest { query: number[]; vectors: { id: string; vector: number[] }[]; }
export interface DotResponse { scores: { id: string; score: number }[]; }
