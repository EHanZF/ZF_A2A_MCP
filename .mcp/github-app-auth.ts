/**
 * .mcp/github-app-auth.ts
 *
 * GitHub OpenID Connect (OIDC) token validation and JWT claims extraction.
 *
 * Verifies that ACTIONS_ID_TOKEN is issued by GitHub and contains valid claims.
 * Uses GitHub's public keys to validate signatures (no runtime secrets needed).
 *
 * Reference: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
 */

import { createPublicKey, verify } from "crypto";
import fetch from "node-fetch";

const GITHUB_OIDC_KEY_URL = "https://token.actions.githubusercontent.com/.well-known/jwks";

/**
 * JWT claims for GitHub Actions OIDC token.
 */
export interface GitHubOIDCClaims {
  sub: string;              // "repo:owner/repo:ref:refs/heads/main" or similar
  iss: string;              // "https://token.actions.githubusercontent.com"
  aud: string;              // audience (e.g., "mcp-server")
  repository: string;       // owner/repo
  repository_owner: string; // org/user
  actor: string;            // GitHub username
  ref: string;              // full ref (refs/heads/main)
  ref_type: "branch" | "tag";
  environment?: string;
  job_workflow_ref: string;
  sha: string;
  run_number: number;
  run_id: number;
  iat: number;              // issued at
  exp: number;              // expiration
}

interface JWK {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface JWKSet {
  keys: JWK[];
}

let cachedJWKS: JWKSet | null = null;
let cachedAt = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

/**
 * Fetch GitHub's public JWK set (cached).
 */
async function getGitHubJWKS(): Promise<JWKSet> {
  const now = Date.now();
  if (cachedJWKS && now - cachedAt < CACHE_TTL) {
    return cachedJWKS;
  }

  console.log("[GitHub Auth] Fetching JWK set from", GITHUB_OIDC_KEY_URL);
  const response = await fetch(GITHUB_OIDC_KEY_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub JWKS: ${response.status}`);
  }

  cachedJWKS = await response.json() as JWKSet;
  cachedAt = now;
  return cachedJWKS;
}

/**
 * Find JWK by key ID (kid).
 */
function findJWK(jwks: JWKSet, kid: string): JWK | null {
  return jwks.keys.find(k => k.kid === kid) || null;
}

/**
 * Convert JWK to PEM-encoded public key.
 */
function jwkToPublicKey(jwk: JWK): string {
  const key = createPublicKey({
    key: {
      kty: jwk.kty,
      n: Buffer.from(jwk.n, "base64"),
      e: Buffer.from(jwk.e, "base64")
    },
    format: "jwk"
  });

  return key.export({ type: "spki", format: "pem" }) as string;
}

/**
 * Decode JWT without verification (for debugging).
 */
export function decodeJWT(token: string): { header: any; claims: any; signature: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(Buffer.from(parts[0], "base64").toString());
    const claims = JSON.parse(Buffer.from(parts[1], "base64").toString());
    const signature = parts[2];

    return { header, claims, signature };
  } catch (err) {
    console.error("[GitHub Auth] Failed to decode JWT:", err);
    return null;
  }
}

/**
 * Validate GitHub OIDC token and extract claims.
 *
 * This is the main entry point. It:
 * 1. Decodes the JWT
 * 2. Verifies the signature using GitHub's public key
 * 3. Checks exp, iss, aud claims
 * 4. Returns validated claims or error
 */
export async function validateGitHubOIDCToken(
  token: string,
  expectedAudience?: string
): Promise<{ valid: boolean; claims?: GitHubOIDCClaims; error?: string }> {
  try {
    const decoded = decodeJWT(token);
    if (!decoded) {
      return { valid: false, error: "Invalid JWT format" };
    }

    const { header, claims } = decoded;

    // Verify issuer
    if (claims.iss !== "https://token.actions.githubusercontent.com") {
      return { valid: false, error: `Invalid issuer: ${claims.iss}` };
    }

    // Verify audience
    if (expectedAudience && claims.aud !== expectedAudience) {
      return { valid: false, error: `Invalid audience: expected ${expectedAudience}, got ${claims.aud}` };
    }

    // Verify expiration
    if (claims.exp * 1000 < Date.now()) {
      return { valid: false, error: "Token expired" };
    }

    // Verify issued-at time (not in the future)
    if (claims.iat * 1000 > Date.now() + 60000) { // 60s skew tolerance
      return { valid: false, error: "Token issued in the future" };
    }

    // Fetch GitHub's public keys
    const jwks = await getGitHubJWKS();
    const jwk = findJWK(jwks, header.kid);
    if (!jwk) {
      return { valid: false, error: `Key not found: ${header.kid}` };
    }

    // Verify signature
    const publicKey = jwkToPublicKey(jwk);
    const valid = verify(
      "sha256",
      Buffer.from(`${decoded.signature.split(".")[0]}.${decoded.signature.split(".")[1]}`),
      publicKey,
      Buffer.from(decoded.signature.split(".")[2], "base64")
    );

    if (!valid) {
      return { valid: false, error: "Signature verification failed" };
    }

    console.log("[GitHub Auth] Token validated successfully");
    console.log(`[GitHub Auth] Actor: ${claims.actor}, Repo: ${claims.repository}, Ref: ${claims.ref}`);

    return {
      valid: true,
      claims: claims as GitHubOIDCClaims
    };
  } catch (err) {
    console.error("[GitHub Auth] Validation error:", err);
    return { valid: false, error: String(err) };
  }
}

/**
 * Extract identity context from GitHub OIDC token.
 *
 * Converts OIDC claims to RBAC identity.
 */
export function extractIdentityFromOIDC(claims: GitHubOIDCClaims): {
  id: string;
  role: string;
  orgBoundary: string;
  source: "github-actions";
} {
  return {
    id: claims.actor,
    role: "developer", // Default to developer; can be elevated by org policy
    orgBoundary: claims.repository_owner,
    source: "github-actions"
  };
}

/**
 * Middleware factory: validate GitHub OIDC token from Authorization header or env var.
 *
 * Attaches validated claims to request.mcpGitHubClaims.
 */
export function gitHubOIDCMiddleware(expectedAudience?: string) {
  return async (req: any, res: any, next: any) => {
    try {
      // Try Authorization header first
      const authHeader = req.headers.authorization || req.headers.Authorization;
      let token: string | null = null;

      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      } else if (process.env.ACTIONS_ID_TOKEN) {
        // Fall back to environment variable (GitHub Actions context)
        token = process.env.ACTIONS_ID_TOKEN;
      }

      if (token) {
        const validation = await validateGitHubOIDCToken(token, expectedAudience);
        if (validation.valid && validation.claims) {
          req.mcpGitHubClaims = validation.claims;
          req.mcpGitHubIdentity = extractIdentityFromOIDC(validation.claims);
          console.log(`[GitHub Auth] Request from actor: ${validation.claims.actor}`);
        } else {
          console.warn(`[GitHub Auth] Token validation failed: ${validation.error}`);
          // Continue without token (rely on other auth methods)
        }
      }

      next();
    } catch (err) {
      console.error("[GitHub Auth] Middleware error:", err);
      next();
    }
  };
}

/**
 * Test helper: generate a mock GitHub OIDC token (for local dev).
 *
 * WARNING: This is for testing only. Do NOT use in production.
 */
export function generateMockGitHubOIDCToken(actor: string, repo: string): string {
  const header = {
    alg: "RS256",
    kid: "mock-key",
    type: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "https://token.actions.githubusercontent.com",
    aud: "mcp-server",
    sub: `repo:${repo}:ref:refs/heads/main`,
    repository: repo,
    repository_owner: repo.split("/")[0],
    actor,
    ref: "refs/heads/main",
    ref_type: "branch",
    job_workflow_ref: `${repo}/.github/workflows/test.yml@main`,
    sha: "0000000000000000000000000000000000000000",
    run_number: 1,
    run_id: 1,
    iat: now,
    exp: now + 3600
  };

  return [
    Buffer.from(JSON.stringify(header)).toString("base64"),
    Buffer.from(JSON.stringify(claims)).toString("base64"),
    "mock-signature"
  ].join(".");
}
