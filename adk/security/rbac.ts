/**
 * adk/security/rbac.ts
 *
 * Comprehensive RBAC enforcement layer for MCP Server.
 * Validates identity, maps to roles, and gates tool invocations.
 *
 * Identity sources (in priority order):
 * 1. HTTP headers (X-Agent-Id, X-GitHub-Actor, X-Agent-Role, Authorization)
 * 2. Environment variables (CI_GITHUB_ACTOR, CI_ROLE, ACTIONS_ID_TOKEN)
 * 3. Request context (user principal from JWT)
 */

export type AgentRole = "admin" | "developer" | "ci-agent" | "reader";
export type IdentitySource = "github-actions" | "vscode" | "ssh" | "http-header" | "env-var";

export interface Identity {
  id: string;
  role: AgentRole;
  source: IdentitySource;
  orgBoundary?: string;      // e.g., "BrakeControls"
  timestamp: number;         // when identity was established
  tokenExpiry?: number;      // for OIDC tokens
}

export interface RBACPolicy {
  roles: Record<AgentRole, {
    allow: string[];         // tool names, e.g., ["actions.build_and_push"]
    deny?: string[];
    orgBoundary?: string[];  // allowed orgs
  }>;
}

const DEFAULT_RBAC_POLICY: RBACPolicy = {
  roles: {
    admin: {
      allow: [
        "actions.build_and_push",
        "actions.scaffold_runtime",
        "dmn.evaluate",
        "dmn.critic",
        "iam.policy.write",
        "secrets.write"
      ]
    },
    developer: {
      allow: [
        "actions.build_and_push",
        "actions.scaffold_runtime",
        "dmn.evaluate",
        "rag.query",
        "vector.embed",
        "vector.query"
      ]
    },
    "ci-agent": {
      allow: [
        "actions.build_and_push",
        "ci.run_tests",
        "ci.build",
        "ci.lint",
        "ci.release_gate",
        "zk.verify"
      ]
    },
    reader: {
      allow: [
        "dmn.get_rules",
        "rag.query",
        "vector.query"
      ]
    }
  }
};

/**
 * Extract identity from HTTP headers, falling back to environment variables.
 *
 * HTTP Headers (priority):
 *   X-Agent-Id: agent identifier
 *   X-Agent-Role: admin | developer | ci-agent | reader
 *   X-GitHub-Actor: GitHub username
 *   X-Org-Boundary: org identifier for RASIC
 *   Authorization: Bearer token (JWT validation optional)
 *
 * Environment Variables (fallback):
 *   CI_GITHUB_ACTOR: GitHub Actions actor
 *   CI_ROLE: role (developer | ci-agent)
 *   ACTIONS_ID_TOKEN: GitHub OIDC JWT
 *   SSH_GITHUB_LOGIN: SSH user identity
 */
export function extractIdentity(
  headers?: Record<string, string>,
  env?: NodeJS.ProcessEnv
): Identity {
  const now = Date.now();
  const headerLower = headers ? Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  ) : {};

  // Try HTTP headers first
  if (headerLower["x-agent-id"]) {
    const id = headerLower["x-agent-id"];
    const role = (headerLower["x-agent-role"] || "developer") as AgentRole;
    return {
      id,
      role,
      source: "http-header",
      orgBoundary: headerLower["x-org-boundary"],
      timestamp: now
    };
  }

  // Fall back to environment variables (GitHub Actions context)
  if (env?.CI_GITHUB_ACTOR) {
    const id = env.CI_GITHUB_ACTOR;
    const role = (env.CI_ROLE || "developer") as AgentRole;
    return {
      id,
      role,
      source: "github-actions",
      orgBoundary: env.CI_ORG_BOUNDARY,
      timestamp: now
    };
  }

  // SSH user from environment
  if (env?.SSH_GITHUB_LOGIN) {
    const id = env.SSH_GITHUB_LOGIN;
    return {
      id,
      role: "developer",
      source: "ssh",
      timestamp: now
    };
  }

  // Default: unknown developer
  return {
    id: "anonymous",
    role: "reader",
    source: "http-header",
    timestamp: now
  };
}

/**
 * Enforce RBAC: check if identity is allowed to invoke a tool.
 *
 * Returns: { allowed: boolean; reason?: string }
 */
export function enforceRBAC(
  identity: Identity,
  toolName: string,
  policy: RBACPolicy = DEFAULT_RBAC_POLICY
): { allowed: boolean; reason?: string } {
  const rolePolicy = policy.roles[identity.role];

  if (!rolePolicy) {
    return { allowed: false, reason: `Unknown role: ${identity.role}` };
  }

  // Check explicit deny list first
  if (rolePolicy.deny?.includes(toolName)) {
    return { allowed: false, reason: `Tool ${toolName} is explicitly denied for role ${identity.role}` };
  }

  // Check allow list
  if (!rolePolicy.allow.includes(toolName)) {
    return { allowed: false, reason: `Tool ${toolName} not in allow list for role ${identity.role}` };
  }

  // Check org boundary if specified in policy
  if (rolePolicy.orgBoundary && identity.orgBoundary) {
    if (!rolePolicy.orgBoundary.includes(identity.orgBoundary)) {
      return {
        allowed: false,
        reason: `Org boundary ${identity.orgBoundary} not in allowed list for role ${identity.role}`
      };
    }
  }

  return { allowed: true };
}

/**
 * Validate OIDC JWT token (GitHub Actions).
 *
 * This is optional—for prod, use a JWT library like `jsonwebtoken`.
 * For MVP, we'll extract basic claims without signature verification.
 */
export function validateGitHubOIDCToken(
  token: string
): { valid: boolean; claims?: Record<string, any>; error?: string } {
  try {
    // Simple base64 decode (in production, validate signature against GitHub's public key)
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, error: "Invalid token format" };

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

    // Check exp claim
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return { valid: false, error: "Token expired" };
    }

    // Check iss (must be GitHub)
    if (payload.iss !== "https://token.actions.githubusercontent.com") {
      return { valid: false, error: "Invalid issuer" };
    }

    return { valid: true, claims: payload };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

/**
 * Extract OIDC JWT from Authorization header or environment.
 */
export function extractOIDCToken(
  headers?: Record<string, string>,
  env?: NodeJS.ProcessEnv
): string | null {
  // Check Authorization header
  const authHeader = headers?.Authorization || headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check environment variable (GitHub Actions)
  return env?.ACTIONS_ID_TOKEN || null;
}

/**
 * Build audit log entry for RBAC decision.
 */
export function auditLog(
  identity: Identity,
  toolName: string,
  decision: { allowed: boolean; reason?: string },
  input?: any
): Record<string, any> {
  return {
    timestamp: new Date().toISOString(),
    identity: {
      id: identity.id,
      role: identity.role,
      source: identity.source,
      orgBoundary: identity.orgBoundary
    },
    tool: toolName,
    decision: decision.allowed ? "ALLOW" : "DENY",
    reason: decision.reason,
    inputSummary: input ? `${JSON.stringify(input).slice(0, 200)}...` : undefined
  };
}
