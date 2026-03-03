CREATE TABLE IF NOT EXISTS mcp_sessions (
  session_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  capabilities JSONB NOT NULL,
  metadata JSONB NOT NULL,
  tool_contracts JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  ws_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_active
  ON mcp_sessions (expires_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS mcp_ws_channels (
  connection_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES mcp_sessions(session_id) ON DELETE CASCADE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
