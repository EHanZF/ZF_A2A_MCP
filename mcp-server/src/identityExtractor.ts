/**
 * mcp-server/src/identityExtractor.ts
 *
 * Extracts and validates HTTP request identity context.
 * Integrates with adk/security/rbac.ts for enforcement.
 */

import type { Request } from "express";
import { extractIdentity, validateGitHubOIDCToken, extractOIDCToken } from "../../adk/security/rbac.js";
import type { Identity } from "../../adk/security/rbac.js";

/**
 * Extract identity from Express request (headers + env).
 * 
 * Called before each MCP tool invocation to establish caller context.
 */
export function extractIdentityFromRequest(req: Request): Identity {
  const headerDict = req.headers as Record<string, string>;
  return extractIdentity(headerDict, process.env);
}

/**
 * Enrich identity with OIDC JWT validation (GitHub Actions).
 * 
 * If Authorization header contains JWT, validates and merges claims.
 */
export function enrichIdentityWithOIDC(
  identity: Identity,
  req: Request
): { identity: Identity; claims?: Record<string, any> } {
  const token = extractOIDCToken(req.headers as Record<string, string>, process.env);
  
  if (!token) {
    return { identity };
  }

  const tokenValidation = validateGitHubOIDCToken(token);
  if (!tokenValidation.valid) {
    console.warn(`[RBAC] OIDC token validation failed: ${tokenValidation.error}`);
    return { identity };
  }

  // If OIDC claims are valid, optionally use them to override identity
  if (tokenValidation.claims) {
    const claims = tokenValidation.claims;
    
    // GitHub Actions context: extract actor from JWT sub claim
    if (claims.sub && claims.sub.startsWith("repo:")) {
      // Format: "repo:owner/repo:ref:refs/heads/main"
      // Extract actor if present in actor claim
      const actor = claims.actor || claims.sub;
      
      identity = {
        ...identity,
        id: actor,
        source: "github-actions",
        tokenExpiry: claims.exp ? claims.exp * 1000 : undefined
      };
    }
  }

  return { identity, claims: tokenValidation.claims };
}

/**
 * Log identity context for debugging/auditing.
 */
export function logIdentityContext(identity: Identity, context: string = ""): void {
  console.log(`[Identity] ${context}`, {
    id: identity.id,
    role: identity.role,
    source: identity.source,
    orgBoundary: identity.orgBoundary,
    timestampMs: identity.timestamp
  });
}

/**
 * Middleware factory: enforces RBAC on all MCP tool calls.
 * 
 * Usage:
 *   app.post("/mcp", rbacMiddleware(), handleMCPCall);
 */
export function rbacMiddleware() {
  return (req: any, res: any, next: any) => {
    try {
      const identity = extractIdentityFromRequest(req);
      const enriched = enrichIdentityWithOIDC(identity, req);
      
      // Attach to request context
      req.mcpIdentity = enriched.identity;
      req.mcpOIDCClaims = enriched.claims;
      
      logIdentityContext(enriched.identity, `RBAC Middleware`);
      next();
    } catch (err) {
      console.error(`[RBAC] Identity extraction failed:`, err);
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid request - identity extraction failed" }
      });
    }
  };
}
