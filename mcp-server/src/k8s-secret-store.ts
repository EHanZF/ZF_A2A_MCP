/**
 * Kubernetes Secret Management for GitHub App Credentials
 * 
 * Stores GitHub App credentials (PEM, webhook secret, client secret) in a Kubernetes Secret.
 * This follows security best practices by keeping sensitive data in K8s Secret objects.
 * 
 * Reference: https://kubernetes.io/docs/concepts/configuration/secret/
 */

import { execSync } from 'child_process';

export interface KubernetesSecret {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string };
  type: string;
  data: Record<string, string>;
}

/**
 * Store GitHub App credentials in a Kubernetes Secret.
 * Uses kubectl to create/update the secret with base64-encoded values.
 */
export async function storeGitHubAppSecret(
  appId: number,
  webhookSecret: string,
  pem: string,
  clientSecret: string,
  namespace: string = 'zf-mcp-prod'
): Promise<void> {
  const secretName = 'github-app-prod-secret';

  // Create kubectl secret from literal values
  // kubectl will base64-encode the values automatically
  const command = `kubectl create secret generic ${secretName} \
    --from-literal=app-id=${appId} \
    --from-literal=webhook-secret=${webhookSecret} \
    --from-literal=client-secret=${clientSecret} \
    --from-file=pem=<(echo "${pem.replace(/"/g, '\\"')}") \
    --namespace=${namespace} \
    --dry-run=client -o yaml | kubectl apply -f -`;

  try {
    execSync(command, { shell: '/bin/bash', stdio: 'pipe' });
    console.log(
      `✓ Stored GitHub App credentials in K8s Secret: ${secretName} (namespace: ${namespace})`
    );
  } catch (err) {
    throw new Error(
      `Failed to store secret in Kubernetes: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Alternative: Create a Secret manifest YAML (can be applied with kubectl apply)
 * Useful if direct kubectl access is not available.
 */
export function createSecretManifest(
  appId: number,
  webhookSecret: string,
  pem: string,
  clientSecret: string,
  namespace: string = 'zf-mcp-prod'
): KubernetesSecret {
  const secret: KubernetesSecret = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: 'github-app-prod-secret',
      namespace,
    },
    type: 'Opaque',
    data: {
      'app-id': Buffer.from(String(appId)).toString('base64'),
      'webhook-secret': Buffer.from(webhookSecret).toString('base64'),
      'client-secret': Buffer.from(clientSecret).toString('base64'),
      pem: Buffer.from(pem).toString('base64'),
    },
  };
  return secret;
}

/**
 * Retrieve GitHub App secret from Kubernetes.
 * Returns decoded values for use by the server.
 */
export async function retrieveGitHubAppSecret(
  namespace: string = 'zf-mcp-prod'
): Promise<{
  appId: number;
  webhookSecret: string;
  pem: string;
  clientSecret: string;
}> {
  try {
    const command = `kubectl get secret github-app-prod-secret -n ${namespace} -o json`;
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    const secret = JSON.parse(output);

    return {
      appId: parseInt(
        Buffer.from(secret.data['app-id'], 'base64').toString('utf8'),
        10
      ),
      webhookSecret: Buffer.from(secret.data['webhook-secret'], 'base64').toString('utf8'),
      pem: Buffer.from(secret.data.pem, 'base64').toString('utf8'),
      clientSecret: Buffer.from(secret.data['client-secret'], 'base64').toString('utf8'),
    };
  } catch (err) {
    throw new Error(
      `Failed to retrieve GitHub App secret from Kubernetes: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
