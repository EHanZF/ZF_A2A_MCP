/**
 * GitHub App Manifest Flow Handler
 * 
 * Implements the GitHub App manifest registration flow:
 * 1. User completes manifest registration on GitHub
 * 2. GitHub redirects back with a temporary code
 * 3. This handler exchanges the code for app credentials
 * 4. Credentials are stored in Kubernetes Secret for production use
 * 
 * Reference: https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
 */

import https from 'https';

export interface GitHubAppCredentials {
  appId: number;
  name: string;
  pem: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
}

export interface ManifestConversionResponse {
  id: number;
  name: string;
  url: string;
  html_url: string;
  owner: { login: string; id: number; avatar_url: string; type: string };
  description: string;
  external_url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  permissions: Record<string, string>;
  events: string[];
  installations_count: number;
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  pem: string;
}

/**
 * Exchange a manifest flow code for app credentials.
 * Makes a POST to GitHub's /app-manifests/{code}/conversions endpoint.
 */
export async function exchangeManifestCode(
  code: string
): Promise<GitHubAppCredentials> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({});

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/app-manifests/${code}/conversions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        Accept: 'application/vnd.github.v3+json',
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
          const response: ManifestConversionResponse = JSON.parse(data);
          resolve({
            appId: response.id,
            name: response.name,
            pem: response.pem,
            webhookSecret: response.webhook_secret,
            clientId: response.client_id,
            clientSecret: response.client_secret,
          });
        } catch (err) {
          reject(
            new Error(
              `Failed to parse GitHub API response: ${err instanceof Error ? err.message : String(err)}`
            )
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
 * Helper to validate that code is properly formatted (alphanumeric, reasonable length)
 */
export function validateManifestCode(code: string): boolean {
  // GitHub manifest codes are typically 20-40 chars of alphanumeric + underscore
  return /^[a-zA-Z0-9_-]{20,100}$/.test(code);
}
