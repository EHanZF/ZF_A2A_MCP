import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  host: process.env.PG_HOST || "vector-bus-pg",
  user: process.env.PG_USER || "vector",
  password: process.env.PG_PASSWORD || "vectorpass",
  database: process.env.PG_DB || "vectordb"
});

export async function init() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      vec VECTOR(64),
      text TEXT,
      meta JSONB
    );
  `);
}

export async function upsert(id: string, vec: number[], text?: string, meta?: any) {
  await pool.query(
    `INSERT INTO embeddings (id, vec, text, meta)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       vec = excluded.vec,
       text = excluded.text,
       meta = excluded.meta`,
    [id, vec, text, meta]
  );
}

export async function query(vec: number[], k: number) {
  const result = await pool.query(
    `SELECT id, text, meta,
            (vec <#> $1::vector) * -1 AS score
       FROM embeddings
       ORDER BY vec <#> $1::vector
       LIMIT $2`,
    [vec, k]
  );
  return result.rows;
}
