/**
 * GitHub App JWT Token Generation
 * 
 * Generates short-lived JWT tokens for GitHub App authentication.
 * These tokens are then exchanged for installation access tokens.
 * 
 * JWT Structure:
 * - Header: { alg: "RS256", typ: "JWT" }
 * - Payload: { iss: appId, iat: now-60, exp: now+600 }
 * - Signature: RS256 signed with private key
 * 
 * Reference: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 */

import crypto from 'crypto';

export interface JWTPayload {
  iss: number; // App ID
  iat: number; // Issued at time
  exp: number; // Expiration time
}

/**
 * Generate a JWT for GitHub App authentication.
 * 
 * @param appId - GitHub App ID
 * @param privateKeyPem - Private key (PEM format) from GitHub App
 * @param expirationSeconds - Token lifetime in seconds (max 600, default 300)
 * @returns Signed JWT token string
 */
export function generateGitHubAppJWT(
  appId: number,
  privateKeyPem: string,
  expirationSeconds: number = 300
): string {
  if (expirationSeconds > 600) {
    throw new Error('JWT expiration must not exceed 600 seconds (10 minutes)');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    iss: appId,
    iat: now - 60, // Issued 60 seconds in the past to account for clock skew
    exp: now + expirationSeconds,
  };

  // Create JWT manually (or use jsonwebtoken library)
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
  ).toString('base64url');

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${payloadEncoded}`)
    .sign(privateKeyPem);

  const signatureEncoded = Buffer.from(signature).toString('base64url');

  return `${header}.${payloadEncoded}.${signatureEncoded}`;
}

/**
 * Exchange a JWT for an installation access token.
 * Makes a POST to /app/installations/{installationId}/access_tokens
 */
export async function exchangeJWTForInstallationToken(
  jwt: string,
  installationId: number
): Promise<{
  token: string;
  expiresAt: string;
  permissions: Record<string, string>;
}> {
  const https = await import('https');

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      repositories: [], // Empty = all repositories
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/app/installations/${installationId}/access_tokens`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${jwt}`,
        'User-Agent': 'MCP-Server',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 201) {
          reject(
            new Error(
              `GitHub API error (${res.statusCode}): ${data}`
            )
          );
          return;
        }

        try {
          const response = JSON.parse(data);
          resolve({
            token: response.token,
            expiresAt: response.expires_at,
            permissions: response.permissions,
          });
        } catch (err) {
          reject(
            new Error(`Failed to parse GitHub API response: ${err instanceof Error ? err.message : String(err)}`)
          );
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`HTTP request failed: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Generate JWT and exchange for installation access token in one call.
 */
export async function getInstallationAccessToken(
  appId: number,
  privateKeyPem: string,
  installationId: number
): Promise<string> {
  const jwt = generateGitHubAppJWT(appId, privateKeyPem);
  const { token } = await exchangeJWTForInstallationToken(jwt, installationId);
  return token;
}

/**
 * Helper to call GitHub API with installation access token.
 * Makes authenticated requests on behalf of the GitHub App.
 */
export async function callGitHubAPI(
  endpoint: string,
  method: string,
  accessToken: string,
  body?: Record<string, any>
): Promise<any> {
  const https = await import('https');

  const bodyString = body ? JSON.stringify(body) : '';

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString),
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${accessToken}`,
        'User-Agent': 'MCP-Server',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err instanceof Error ? err.message : String(err)}`));
          }
        } else {
          reject(
            new Error(`GitHub API error (${res.statusCode}): ${data}`)
          );
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`HTTP request failed: ${err.message}`));
    });

    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}
