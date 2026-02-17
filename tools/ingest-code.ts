#!/usr/bin/env node
/**
 * Codebase ingestion: chunks files, computes embeddings (deterministic by default),
 * optionally calls /embed for LLM API embeddings, and upserts into the Vector Bus.
 *
 * Usage:
 *  VECTOR_BUS_URL=https://vector.example.com/v1 VECTOR_BUS_BEARER=... tsx tools/ingest-code.ts
 * Optional:
 *  USE_REMOTE_EMBED=1 OPENAI_API_KEY=...     # if your Vector Bus fronts a remote embedder
 */

import { promises as fs } from "fs";
import * as path from "path";
import { VectorBusClient } from "../vector-bus-sdk/src/client.js";

const ROOT = process.env.INGEST_ROOT || process.cwd();
const VECTOR_BUS_URL = process.env.VECTOR_BUS_URL || "http://localhost:8088/v1";
const VECTOR_BUS_BEARER = process.env.VECTOR_BUS_BEARER;
const USE_REMOTE_EMBED = !!process.env.USE_REMOTE_EMBED;
const NAMESPACE = process.env.NAMESPACE || "repo";

const INCLUDE = /\.(md|txt|ts|tsx|js|jsx|json|yaml|yml|py|rs|go|java|kt|c|cpp|h|cs|swift|toml|ini|sh|ps1|Dockerfile|makefile)$/i;
const EXCLUDE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".idea", ".vscode"]);

type Chunk = { id: string; text: string; file: string; idx: number };

function* chunkText(text: string, max = 1200, overlap = 100): Generator<string> {
  let i = 0; while (i < text.length) {
    const end = Math.min(text.length, i + max);
    yield text.slice(i, end);
    i = end - overlap;
    if (i < 0) i = 0;
    if (i >= text.length) break;
  }
}

// Deterministic "pseudo-embedding": fast, reproducible without external model.
function deterministicEmbedding(text: string, dim = 64): number[] {
  let h = 2166136261 >>> 0; // FNV-like
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  const vec: number[] = [];
  for (let i = 0; i < dim; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    vec.push(((h & 0xffff) / 65535) * 2 - 1);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      await walk(path.join(dir, e.name), out);
    } else {
      const p = path.join(dir, e.name);
      if (INCLUDE.test(e.name) || INCLUDE.test(p)) out.push(p);
    }
  }
  return out;
}

async function main() {
  const client = new VectorBusClient(VECTOR_BUS_URL, VECTOR_BUS_BEARER);
  if (!(await client.healthz())) { console.error("Vector Bus not healthy"); process.exit(2); }

  const files = await walk(ROOT);
  const chunks: Chunk[] = [];
  for (const f of files) {
    const raw = await fs.readFile(f, "utf8").catch(() => "");
    if (!raw) continue;
    let idx = 0;
    for (const piece of chunkText(raw)) {
      chunks.push({ id: `${path.relative(ROOT, f)}:${idx}`, text: piece, file: f, idx });
      idx++;
    }
  }

  // Embeddings
  let records: { id: string; vector: number[]; text?: string; meta?: Record<string, unknown> }[] = [];

  if (USE_REMOTE_EMBED) {
    // Ask Vector Bus to embed server-side (e.g., LLM API). Texts batched for efficiency.
    const batch = 32;
    for (let i = 0; i < chunks.length; i += batch) {
      const part = chunks.slice(i, i + batch);
      const { dim, embeddings } = await client.embed({ texts: part.map(c => c.text), dim: 768, model: "auto" });
      embeddings.forEach((e, j) => { records.push({ id: part[j].id, vector: e.vector, text: e.text, meta: { file: part[j].file, idx: part[j].idx, dim } }); });
    }
  } else {
    // Deterministic local embedding
    for (const c of chunks) {
      const v = deterministicEmbedding(c.text, 64);
      records.push({ id: c.id, vector: v, text: c.text, meta: { file: c.file, idx: c.idx, dim: 64, mode: "deterministic" } });
    }
  }

  // Upsert vectors
  const batch = 128;
  let upserted = 0;
  for (let i = 0; i < records.length; i += batch) {
    const seg = records.slice(i, i + batch);
    const { upserted: u } = await client.upsertVectors({ namespace: NAMESPACE, items: seg });
    upserted += u;
  }

  console.log(JSON.stringify({ files: files.length, chunks: chunks.length, upserted }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
