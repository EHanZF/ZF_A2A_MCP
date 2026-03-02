/**
 * GitHub App Manifest Flow Express Routes
 * 
 * Routes for:
 * - POST /github/app/installed - Receive manifest flow callback with code
 * - POST /github/webhook - Receive GitHub webhook events
 */

import { Router, Request, Response } from 'express';
import {
  exchangeManifestCode,
  validateManifestCode,
  GitHubAppCredentials,
} from './github-app-manifest';
import {
  storeGitHubAppSecret,
  retrieveGitHubAppSecret,
} from './k8s-secret-store';
import crypto from 'crypto';

export const githubAppRouter = Router();

// Store for in-memory caching of credentials during this server session
let cachedCredentials: GitHubAppCredentials | null = null;
let credentialsExpiryTime: number = 0;

/**
 * POST /github/app/installed
 * Callback endpoint for GitHub App manifest flow.
 * Receives `code` parameter and exchanges it for app credentials.
 * 
 * Query params:
 *   - code: Temporary code from GitHub (expires in 1 hour)
 *   - installation_id: (optional) If provided by GitHub
 */
githubAppRouter.post('/github/app/installed', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid code parameter' });
    }

    if (!validateManifestCode(code)) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    console.log(`[GitHub App] Exchanging manifest code: ${code.substring(0, 10)}...`);

    // Exchange code for credentials
    const credentials = await exchangeManifestCode(code);
    console.log(`[GitHub App] ✓ Received credentials for app: ${credentials.name} (ID: ${credentials.appId})`);

    // Store in Kubernetes Secret
    await storeGitHubAppSecret(
      credentials.appId,
      credentials.webhookSecret,
      credentials.pem,
      credentials.clientSecret
    );
    console.log(`[GitHub App] ✓ Stored credentials in Kubernetes Secret`);

    // Cache credentials in memory for this session
    cachedCredentials = credentials;
    credentialsExpiryTime = Date.now() + 24 * 60 * 60 * 1000; // Cache for 24 hours

    res.status(200).json({
      success: true,
      message: `GitHub App '${credentials.name}' registered successfully`,
      appId: credentials.appId,
      clientId: credentials.clientId,
      // Don't send sensitive data back in response
    });
  } catch (err) {
    console.error(
      `[GitHub App] Error during manifest exchange: ${err instanceof Error ? err.message : String(err)}`
    );
    res.status(500).json({
      error: 'Failed to register GitHub App',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * POST /github/webhook
 * Receive GitHub webhook events.
 * Validates webhook signature using the stored webhook secret.
 * 
 * Headers:
 *   - X-Hub-Signature-256: HMAC SHA256 signature for validation
 *   - X-GitHub-Event: Event type (push, pull_request, etc.)
 */
githubAppRouter.post('/github/webhook', async (req: Request, res: Response) => {
  try {
    // Get webhook secret (from cache or Kubernetes)
    let webhookSecret = cachedCredentials?.webhookSecret;

    if (!webhookSecret || Date.now() > credentialsExpiryTime) {
      const retrieved = await retrieveGitHubAppSecret();
      webhookSecret = retrieved.webhookSecret;
      cachedCredentials = retrieved;
      credentialsExpiryTime = Date.now() + 24 * 60 * 60 * 1000;
    }

    // Validate signature
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      console.warn('[GitHub Webhook] Received webhook without signature');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const body = JSON.stringify(req.body);
    const expectedSignature =
      'sha256=' +
      crypto
        .createHmac('sha256', webhookSecret!)
        .update(body)
        .digest('hex');

    if (!crypto.timingSafeEqual(signature, expectedSignature)) {
      console.warn('[GitHub Webhook] Signature validation failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const eventType = req.headers['x-github-event'] as string;
    console.log(`[GitHub Webhook] ✓ Received event: ${eventType}`);

    // Handle specific event types
    switch (eventType) {
      case 'push':
        handlePushEvent(req.body);
        break;
      case 'pull_request':
        handlePullRequestEvent(req.body);
        break;
      case 'deployment':
        handleDeploymentEvent(req.body);
        break;
      default:
        console.log(`[GitHub Webhook] Unhandled event type: ${eventType}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error(
      `[GitHub Webhook] Error processing webhook: ${err instanceof Error ? err.message : String(err)}`
    );
    res.status(500).json({
      error: 'Failed to process webhook',
    });
  }
});

/**
 * Handle GitHub push events (e.g., commits to main branch).
 * Could trigger deployment workflows.
 */
function handlePushEvent(payload: any): void {
  const { repository, ref, commits } = payload;
  console.log(
    `[Push Event] ${repository.full_name} @ ${ref}: ${commits.length} commit(s)`
  );
  // TODO: Trigger deployment or other CI workflows
}

/**
 * Handle GitHub pull_request events.
 * Could trigger PR checks or notifications.
 */
function handlePullRequestEvent(payload: any): void {
  const { action, pull_request } = payload;
  console.log(
    `[PR Event] Action: ${action}, PR: #${pull_request.number} (${pull_request.title})`
  );
  // TODO: Handle PR-specific workflows
}

/**
 * Handle GitHub deployment events.
 * Could update deployment status or trigger post-deployment checks.
 */
function handleDeploymentEvent(payload: any): void {
  const { action, deployment } = payload;
  console.log(
    `[Deployment Event] Action: ${action}, Deployment: ${deployment.description}`
  );
  // TODO: Handle deployment workflows
}

/**
 * GET /github/app/status
 * Check if GitHub App credentials are currently available.
 */
githubAppRouter.get('/github/app/status', async (req: Request, res: Response) => {
  try {
    let credentials = cachedCredentials;

    if (!credentials || Date.now() > credentialsExpiryTime) {
      try {
        credentials = await retrieveGitHubAppSecret();
      } catch {
        return res.status(503).json({
          status: 'unconfigured',
          message: 'GitHub App has not been registered yet',
        });
      }
    }

    res.status(200).json({
      status: 'configured',
      appId: credentials.appId,
      // Don't expose secrets in response
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to check app status',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default githubAppRouter;
