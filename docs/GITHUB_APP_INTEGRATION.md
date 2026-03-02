# GitHub App Integration Guide

This guide explains how to integrate GitHub App manifest flow and JWT authentication into the mcp-server.

## Overview

The GitHub App integration provides:

1. **Manifest Flow Registration:** Secure, short-lived app credential exchange
2. **JWT Token Generation:** Production-grade authentication with GitHub API
3. **Webhook Route Handler:** Receive and process GitHub events
4. **Kubernetes Secret Storage:** Secure credential persistence

## Architecture

```
GitHub (User Registration)
    ↓
[Manifest Redirect Code]
    ↓
mcp-server: POST /github/app/installed
    ↓
[Exchange code for credentials via GitHub API]
    ↓
Create Kubernetes Secret
    ↓
GitHub Events → POST /github/webhook
    ↓
[Validate signature, process event]
```

## Setting Up

### 1. Install Dependencies

Ensure your `mcp-server/package.json` includes:

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "crypto": "builtin",
    "https": "builtin"
  }
}
```

### 2. Add Routes to Express Server

In your main server file (e.g., `mcp-server/src/index.ts`):

```typescript
import express from 'express';
import githubAppRouter from './github-app-routes';

const app = express();

// Middleware
app.use(express.json());

// Mount GitHub App routes
app.use(githubAppRouter);

// Other routes...
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[MCP Server] Listening on port ${PORT}`);
  console.log(`[GitHub App] Routes available:`);
  console.log(`  - POST /github/app/installed (manifest flow callback)`);
  console.log(`  - POST /github/webhook (webhook receiver)`);
  console.log(`  - GET /github/app/status (status check)`);
});
```

### 3. Environment Variables

Ensure your Kubernetes deployment sets up required environment variables:

```yaml
env:
  - name: KUBECONFIG
    value: /home/node/.kube/config  # For kubectl access
  - name: GITHUB_APP_NAMESPACE
    value: zf-mcp-prod
```

If mcp-server runs in-cluster, KUBECONFIG is typically auto-configured.

### 4. RBAC Permissions

Give the mcp-server service account permission to create/read Secrets:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: github-app-secret-manager
  namespace: zf-mcp-prod
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "create", "update", "patch"]
    resourceNames: ["github-app-prod-secret"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: github-app-secret-manager
  namespace: zf-mcp-prod
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: github-app-secret-manager
subjects:
  - kind: ServiceAccount
    name: mcp-server  # Your service account name
    namespace: zf-mcp-prod
```

## GitHub App Registration

### Step 1: Create Manifest

Create `github-app/prod-manifest.json`:

```json
{
  "name": "MCP-Prod-Automation",
  "url": "https://mcp.example.com",
  "hook_attributes": {
    "url": "https://mcp.example.com/github/webhook"
  },
  "redirect_url": "https://mcp.example.com/github/app/installed",
  "public": false,
  "default_permissions": {
    "metadata": "read",
    "contents": "read",
    "actions": "read",
    "deployments": "write",
    "checks": "write"
  },
  "default_events": ["push", "pull_request", "deployment", "check_run"]
}
```

### Step 2: Register on GitHub

1. Go to: `https://github.com/organizations/<ORG>/settings/apps/new`
2. Upload manifest JSON
3. GitHub will validate and redirect to `redirect_url?code=<code>`

### Step 3: Endpoint Receives Code

Your `/github/app/installed` endpoint automatically:
1. Receives the `code`
2. Exchanges it for credentials
3. Stores in Kubernetes Secret

Check status:
```bash
curl https://mcp.example.com/github/app/status
# Response:
# {
#   "status": "configured",
#   "appId": 123456
# }
```

## Using JWT Tokens

For authenticated API calls to GitHub (e.g., posting deployment status):

```typescript
import {
  getInstallationAccessToken,
  callGitHubAPI,
} from './github-app-jwt';
import { retrieveGitHubAppSecret } from './k8s-secret-store';

// Get credentials from Kubernetes Secret
const credentials = await retrieveGitHubAppSecret();

// Get short-lived installation access token
const token = await getInstallationAccessToken(
  credentials.appId,
  credentials.pem,
  installationId  // From webhook payload
);

// Use token to call GitHub API
const response = await callGitHubAPI(
  `/repos/EHanZF/ZF_A2A_MCP/deployments/12345/statuses`,
  'POST',
  token,
  {
    state: 'success',
    description: 'Deployment successful',
    target_url: 'https://mcp.example.com/deployments/12345',
    auto_inactive: false,
  }
);

console.log('Deployment status posted:', response);
```

## Webhook Validation

The `POST /github/webhook` endpoint automatically:

1. **Validates Signature:** Ensures request came from GitHub using HMAC
2. **Validates Timestamp:** Checks webhook isn't replayed
3. **Routes Events:** Dispatches to appropriate handler

Handlers are provided for:
- `push` - Code commits
- `pull_request` - PR events
- `deployment` - Deployment webhooks
- `check_run` - CI/CD check results

Add custom handlers:

```typescript
// In github-app-routes.ts, add to switch statement:
case 'workflow_run':
  handleWorkflowRunEvent(req.body);
  break;
```

## Security Considerations

1. **Private Key Storage:** PEM key is stored in Kubernetes Secret (at-rest, RBAC-protected)
2. **Token Expiry:** Installation tokens expire in 1 hour (GitHub default)
3. **JWT Lifetime:** Manual JWTs expire in 10 minutes max
4. **Webhook Signature:** All webhooks validated with HMAC-SHA256
5. **Rate Limiting:** GitHub App has higher rate limits than personal tokens

## Troubleshooting

**Check if app is registered:**
```bash
curl https://mcp.example.com/github/app/status
```

**View stored credentials:**
```bash
kubectl get secret github-app-prod-secret -n zf-mcp-prod -o yaml
# Note: data values are base64 encoded
```

**Check recent webhook events:**
```bash
kubectl logs -n zf-mcp-prod deployment/mcp-server | grep "GitHub"
```

**Test webhook locally:**
```bash
curl -X POST https://mcp.example.com/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -H "X-Hub-Signature-256: sha256=dummy" \
  -d '{"zen":"Design for failure"}'
```

## Files Reference

| File | Purpose |
|------|---------|
| `mcp-server/src/github-app-manifest.ts` | Manifest flow & credential exchange |
| `mcp-server/src/github-app-jwt.ts` | JWT generation & API calls |
| `mcp-server/src/k8s-secret-store.ts` | Kubernetes Secret integration |
| `mcp-server/src/github-app-routes.ts` | Express route handlers |
| `github-app/prod-manifest.json` | App configuration manifest |

---

For more context, see [FLUX_GITOPS_SETUP.md](./FLUX_GITOPS_SETUP.md).
