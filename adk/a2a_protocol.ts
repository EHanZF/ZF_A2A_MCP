/**
 * adk/a2a_protocol.ts
 *
 * Agent-to-Agent (A2A) Protocol: PE-OPS-PKT-V1
 *
 * Defines handshake, header preservation, RASIC boundaries, and
 * cryptographic signatures for multi-agent orchestration.
 *
 * Protocol flow:
 * 1. Client agent sends request with headers: X-Agent-Id, X-Agent-Role, X-Org-Boundary
 * 2. Server validates headers and RBAC policy
 * 3. Server routes to target agent or tool
 * 4. Response preserves original headers for audit trail
 */

export interface A2AHeader {
  "X-Agent-Id": string;           // Initiating agent (e.g., "CDYP71")
  "X-Agent-Role": string;         // Role (orchestration-agent, ci-agent, etc.)
  "X-Org-Boundary": string;       // RASIC org boundary (e.g., "BrakeControls")
  "X-Request-Id": string;         // Idempotency/tracing
  "X-Timestamp": string;          // RFC3339 timestamp
  "X-Signature"?: string;         // Optional: HMAC-SHA256 signature
  "X-Protocol-Version": string;   // "PE-OPS-PKT-V1"
  "X-Trace-Parent"?: string;      // W3C trace context
}

export interface A2ARequest {
  headers: A2AHeader;
  task: string;                   // Semantic task name
  payload: any;                   // Tool input
  priority?: "high" | "normal" | "low";
}

export interface A2AResponse {
  headers: A2AHeader;             // Echo original headers
  status: "success" | "error" | "deferred";
  result?: any;
  error?: { code: string; message: string };
  metadata?: {
    executionTimeMs: number;
    agentExecuted: string;
    organizationBoundary: string;
  };
}

/**
 * Validates A2A headers for correctness and presence.
 */
export function validateA2AHeaders(headers: Record<string, string>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const required = ["X-Agent-Id", "X-Agent-Role", "X-Org-Boundary", "X-Request-Id", "X-Timestamp", "X-Protocol-Version"];

  for (const field of required) {
    if (!headers[field] && !headers[field.toLowerCase()]) {
      errors.push(`Missing required header: ${field}`);
    }
  }

  // Validate protocol version
  const version = headers["X-Protocol-Version"] || headers["x-protocol-version"];
  if (version && !version.startsWith("PE-OPS-PKT")) {
    errors.push(`Unsupported protocol version: ${version}`);
  }

  // Validate timestamp (must be within 5 minutes)
  const timestamp = headers["X-Timestamp"] || headers["x-timestamp"];
  if (timestamp) {
    const tTime = new Date(timestamp).getTime();
    const now = Date.now();
    const diff = Math.abs(now - tTime);
    if (diff > 5 * 60 * 1000) {
      errors.push(`Timestamp skew: ${diff}ms (max 5 minutes)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate A2A headers for outbound request.
 */
export function generateA2AHeaders(
  agentId: string,
  role: string,
  orgBoundary: string,
  requestId?: string,
  signature?: string
): A2AHeader {
  return {
    "X-Agent-Id": agentId,
    "X-Agent-Role": role,
    "X-Org-Boundary": orgBoundary,
    "X-Request-Id": requestId || generateRequestId(),
    "X-Timestamp": new Date().toISOString(),
    "X-Protocol-Version": "PE-OPS-PKT-V1",
    "X-Signature": signature
  };
}

/**
 * Generate unique request ID for tracing.
 */
export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Sign A2A request (HMAC-SHA256).
 * 
 * Signature covers: agent-id + org-boundary + request-id + timestamp + payload-hash
 */
export function signA2ARequest(
  headers: A2AHeader,
  payload: any,
  secret: string
): string {
  const crypto = require("crypto");
  
  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  const message = [
    headers["X-Agent-Id"],
    headers["X-Org-Boundary"],
    headers["X-Request-Id"],
    headers["X-Timestamp"],
    payloadHash
  ].join("|");

  return crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("base64");
}

/**
 * Verify A2A request signature.
 */
export function verifyA2ASignature(
  headers: A2AHeader,
  payload: any,
  secret: string
): boolean {
  const expected = signA2ARequest(headers, payload, secret);
  const actual = headers["X-Signature"] || "";
  return expected === actual;
}

/**
 * Enforce RASIC boundary in A2A routing.
 * 
 * Returns whether communication is allowed between org boundaries.
 */
export function enforceRASICBoundary(
  sourceOrg: string,
  targetOrg: string,
  allowedPairs?: string[][]
): boolean {
  if (sourceOrg === targetOrg) return true;

  if (allowedPairs) {
    return allowedPairs.some(
      ([src, tgt]) => src === sourceOrg && tgt === targetOrg
    );
  }

  // Default: deny cross-org unless explicitly allowed
  return false;
}

/**
 * Build A2A response with header echo and metadata.
 */
export function buildA2AResponse(
  originHeaders: A2AHeader,
  status: "success" | "error" | "deferred",
  result?: any,
  error?: { code: string; message: string },
  executionTimeMs?: number
): A2AResponse {
  return {
    headers: originHeaders,
    status,
    result,
    error,
    metadata: {
      executionTimeMs: executionTimeMs || 0,
      agentExecuted: originHeaders["X-Agent-Id"],
      organizationBoundary: originHeaders["X-Org-Boundary"]
    }
  };
}

/**
 * Extract A2A context from Express request or raw headers.
 */
export function extractA2AContext(
  headers: Record<string, string>
): { valid: boolean; context?: A2AHeader; errors?: string[] } {
  // Normalize headers (case-insensitive)
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toUpperCase(), v])
  );

  const validation = validateA2AHeaders(normalized);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  const context: A2AHeader = {
    "X-Agent-Id": normalized["X-AGENT-ID"],
    "X-Agent-Role": normalized["X-AGENT-ROLE"],
    "X-Org-Boundary": normalized["X-ORG-BOUNDARY"],
    "X-Request-Id": normalized["X-REQUEST-ID"],
    "X-Timestamp": normalized["X-TIMESTAMP"],
    "X-Protocol-Version": normalized["X-PROTOCOL-VERSION"],
    "X-Signature": normalized["X-SIGNATURE"],
    "X-Trace-Parent": normalized["X-TRACE-PARENT"]
  };

  return { valid: true, context };
}
