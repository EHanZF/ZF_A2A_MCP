# Flux GitOps + Kustomize Overlays + Flagger Setup Guide

This guide walks through setting up Flux, environment-specific Kustomize overlays, and Flagger progressive delivery for the ZF A2A MCP stack.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Flux Installation](#flux-installation)
3. [Git Repository Configuration](#git-repository-configuration)
4. [Deploy Base Manifests](#deploy-base-manifests)
5. [Environment-Specific Deployments](#environment-specific-deployments)
6. [Flagger Installation & Configuration](#flagger-installation--configuration)
7. [GitHub App Manifest Flow Setup](#github-app-manifest-flow-setup)
8. [Verification & Troubleshooting](#verification--troubleshooting)

---

## Prerequisites

**Hardware:**
- Kubernetes cluster (1.25+) with:
  - NGINX Ingress Controller (for Flagger traffic shifting)
  - cert-manager (for TLS)
  - Prometheus (for Flagger metrics analysis)

**CLI Tools:**
- `flux` (Flux CLI v2)
- `kubectl`
- `helm`
- `yq` (for YAML patching)

**GitHub:**
- Repository with write access
- Personal Access Token (PAT) or GitHub App for Flux authentication

---

## Flux Installation

### 1.1 Install Flux CLI

**macOS:**
```bash
brew install fluxcd/tap/flux
```

**Linux:**
```bash
curl -s https://fluxcd.io/install.sh | sudo bash
```

**Verify installation:**
```bash
flux --version
```

### 1.2 Bootstrap Flux in Your Cluster

Flux bootstrap initializes the `flux-system` namespace and creates a Git source for this repository.

**Option A: Using GitHub Personal Access Token**

```bash
export GITHUB_TOKEN=<your-pat>
export GITHUB_USER=<your-username>

flux bootstrap github \
  --owner=$GITHUB_USER \
  --repo=ZF_A2A_MCP \
  --personal \
  --path=environments \
  --namespace=flux-system \
  --token-auth
```

**Option B: Using SSH Key (Recommended for Production)**

Generate SSH key and add to GitHub:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/flux-key -N ""
```

Add `~/.ssh/flux-key.pub` to GitHub Settings → Deploy Keys (allow write access).

Then bootstrap:
```bash
flux bootstrap github \
  --owner=$GITHUB_USER \
  --repo=ZF_A2A_MCP \
  --ssh-hostname=github.com \
  --ssh-key-file=~/.ssh/flux-key \
  --path=environments \
  --namespace=flux-system
```

**What bootstrapping does:**
- Creates `flux-system` namespace
- Installs Flux controllers (Helm, Kustomize, Notification, etc.)
- Creates a `GitRepository` source pointing to this repo
- Creates initial Kustomization objects
- Commits bootstrap changes to `flux-system` directory in Git

Verify bootstrap succeeded:
```bash
flux check
kubectl -n flux-system get pods
```

---

## Git Repository Configuration

### 2.1 Create GitRepository Source (if not auto-created)

This is typically done by bootstrap, but can be created manually:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: platform-config
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/EHanZF/ZF_A2A_MCP.git
  ref:
    branch: main
  secretRef:
    name: flux-system  # (if using HTTPS auth)
```

Apply:
```bash
kubectl apply -f - <<EOF
<YAML above>
EOF
```

### 2.2 Directory Layout

Flux expects this repository structure:

```
environments/
├─ base/                          # Shared manifests
│  ├─ helmrelease-mcp-server.yaml
│  ├─ helmrelease-orchestrator.yaml
│  ├─ canary-base.yaml
│  └─ kustomization.yaml
├─ dev/                           # Dev environment overlay
│  ├─ kustomization.yaml
│  ├─ patch-mcp-values.yaml
│  ├─ patch-orch-values.yaml
│  └─ canary-mcp.yaml
├─ staging/                       # Staging environment overlay
│  ├─ kustomization.yaml
│  ├─ patch-mcp-values.yaml
│  ├─ patch-orch-values.yaml
│  └─ canary-mcp.yaml
└─ prod/                          # Production environment overlay
   ├─ kustomization.yaml
   ├─ patch-mcp-values.yaml
   ├─ patch-orch-values.yaml
   └─ canary-mcp.yaml
```

---

## Deploy Base Manifests

### 3.1 Verify Base Kustomization

After bootstrap, check that base manifests are being reconciled:

```bash
kubectl get kustomizations -n flux-system
# Should see: mcp-base
```

Check status:
```bash
flux get kustomization mcp-base
```

### 3.2 Monitor Reconciliation

Watch Flux reconcile the base manifests:

```bash
flux logs --follow -l kustomize.toolkit.fluxcd.io/name=mcp-base
```

---

## Environment-Specific Deployments

### 4.1 Deploy Dev Environment

Dev environment is typically deployed to `zf-mcp-dev` namespace.

**Manual trigger (optional):**
```bash
flux reconcile kustomization mcp-dev --with-source
```

**Monitor:**
```bash
flux get kustomization mcp-dev
flux logs --follow -l kustomize.toolkit.fluxcd.io/name=mcp-dev
```

**Check deployed resources:**
```bash
kubectl get all -n zf-mcp-dev
kubectl get helmreleases -n zf-mcp-dev
kubectl get canaries -n zf-mcp-dev
```

### 4.2 Deploy Staging & Production

Similar process for staging and prod:

```bash
# Staging
flux reconcile kustomization mcp-staging --with-source
kubectl get all -n zf-mcp-staging

# Production
flux reconcile kustomization mcp-prod --with-source
kubectl get all -n zf-mcp-prod
```

### 4.3 Update Image Digests

The CI pipeline (`.github/workflows/build-and-push.yml`) automatically updates env overlays with new multi-arch image digests. This triggers Flux to reconcile and deploy new versions.

Monitor digest updates:
```bash
git log --oneline --all | grep "pin digest"
```

---

## Flagger Installation & Configuration

### 5.1 Install Flagger with NGINX Provider

**Option A: Using Helm (Quick)**

```bash
helm repo add flagger https://flagger.app
helm repo update

# Install Flagger CRDs
kubectl apply -f https://raw.githubusercontent.com/fluxcd/flagger/main/artifacts/flagger/crd.yaml

# Install Flagger with NGINX provider
helm upgrade -i flagger flagger/flagger \
  --namespace ingress-nginx \
  --set prometheus.install=true \
  --set meshProvider=nginx \
  --wait
```

**Option B: Using Flux (GitOps)**

Create a HelmRelease in `flux-system`:

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: flagger
  namespace: flux-system
spec:
  interval: 5m
  chart:
    spec:
      chart: flagger
      version: ">=1.30.0"
      sourceRef:
        kind: HelmRepository
        name: flagger
        namespace: flux-system
  values:
    prometheus:
      install: true
    meshProvider: nginx
    serviceAccount:
      create: true
```

Then add HelmRepository source:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: HelmRepository
metadata:
  name: flagger
  namespace: flux-system
spec:
  interval: 60m
  url: https://flagger.app
```

### 5.2 Verify Flagger Installation

```bash
kubectl get pods -n ingress-nginx | grep flagger
kubectl get crd canaries.flagger.app
```

### 5.3 Configure Prometheus for Metrics

Flagger reads metrics from Prometheus to evaluate SLOs. Ensure:

1. **Prometheus is running:**
   ```bash
   kubectl get pods -n monitoring -l app=prometheus
   ```

2. **NGINX controller exports metrics:**
   ```bash
   kubectl get svc -n ingress-nginx | grep prometheus
   ```

3. **Flagger configmap has correct Prometheus URL:**
   ```bash
   kubectl get configmap -n ingress-nginx flagger-prometheus-config -o yaml
   ```

   Should contain:
   ```yaml
   prometheus_url: http://prometheus.monitoring:9090
   ```

---

## GitHub App Manifest Flow Setup

### 6.1 Create Production GitHub App

**Step 1: Prepare App Manifest**

Save as `github-app/prod-manifest.json`:

```json
{
  "name": "MCP-Prod-Automation",
  "url": "https://mcp.example.com",
  "hook_attributes": {
    "url": "https://mcp.example.com/github/webhook"
  },
  "redirect_url": "https://mcp.example.com/github/app/installed",
  "callback_urls": ["https://mcp.example.com/github/oauth/callback"],
  "public": false,
  "default_permissions": {
    "metadata": "read",
    "contents": "read",
    "actions": "read",
    "deployments": "write",
    "checks": "write"
  },
  "default_events": [
    "push",
    "pull_request",
    "check_suite",
    "check_run",
    "deployment",
    "deployment_status"
  ]
}
```

**Step 2: Register App on GitHub**

1. Navigate to: `https://github.com/organizations/<ORG>/settings/apps/new`
2. Upload or paste the manifest JSON
3. GitHub will validate and redirect to your `redirect_url` with a `code` parameter

**Step 3: Exchange Code for Credentials**

The redirect URL should point to your mcp-server's `/github/app/installed` endpoint. This endpoint:
1. Receives the `code`
2. Exchanges it for app credentials (App ID, PEM private key, webhook secret)
3. Stores credentials in Kubernetes Secret (`github-app-prod-secret`)

Example request:
```bash
# This happens automatically when GitHub redirects
https://mcp.example.com/github/app/installed?code=<code>&installation_id=<id>
```

### 6.2 Integrate GitHub App Routes in mcp-server

In your Express server's main file:

```typescript
import githubAppRouter from './github-app-routes';

app.use(githubAppRouter);
```

This exposes:
- `POST /github/app/installed` - Manifest flow callback
- `POST /github/webhook` - Webhook event receiver
- `GET /github/app/status` - Check if app is configured

### 6.3 Use JWT Tokens for API Calls

For authenticated calls to GitHub API (e.g., post deployment status):

```typescript
import { getInstallationAccessToken, callGitHubAPI } from './github-app-jwt';

const token = await getInstallationAccessToken(
  appId,
  privateKeyPem,
  installationId
);

// Use token to make API call
const response = await callGitHubAPI(
  `/repos/EHanZF/ZF_A2A_MCP/deployments/12345/statuses`,
  'POST',
  token,
  {
    state: 'success',
    description: 'Deployment complete',
    target_url: 'https://mcp.example.com/deployments/12345'
  }
);
```

---

## Verification & Troubleshooting

### 8.1 Verify Flux Status

```bash
# Check overall Flux health
flux check

# List all Kustomizations
kubectl get kustomizations -A

# List all HelmReleases
kubectl get helmreleases -A

# List all Canaries
kubectl get canaries -A
```

### 8.2 Monitor Reconciliation

```bash
# Watch Flux logs
flux logs --all --follow

# Watch specific kustomization
flux logs -l kustomize.toolkit.fluxcd.io/name=mcp-dev --follow

# Watch specific HelmRelease
flux logs -l helm.toolkit.fluxcd.io/name=mcp-server --follow
```

### 8.3 Check Deployment Status

```bash
# Check pods in each env
kubectl get pods -n zf-mcp-dev
kubectl get pods -n zf-mcp-staging
kubectl get pods -n zf-mcp-prod

# Check HelmRelease status
kubectl describe hr mcp-server -n zf-mcp-dev

# Check Canary status
kubectl describe canary mcp-server -n zf-mcp-dev
kubectl logs -n ingress-nginx -l app=flagger --tail=50
```

### 8.4 Verify Image Digest Updates

CI workflow automatically commits digest updates. Check:

```bash
# See recent diagnosis commits
git log --oneline --all | head -20

# View latest patch file
cat environments/prod/patch-mcp-values.yaml

# Should show a sha256 digest, not TO_BE_PATCHED_BY_CI
```

### 8.5 Common Issues

**Issue: Kustomization shows "not found"**
```bash
# Check if base depends on missing source
flux get kustomization mcp-base --verbose

# Ensure GitRepository is configured
kubectl get gitrepository -n flux-system
flux get source git platform-config
```

**Issue: HelmRelease fails to deploy**
```bash
# Check HelmRelease status
kubectl describe hr mcp-server -n zf-mcp-dev

# Check Helm chart source
flux get source helm

# Check chart availability
helm search repo mcp-stack
```

**Issue: Canary stuck in analysis**
```bash
# Check Prometheus connectivity
kubectl logs -n ingress-nginx -l app=flagger | grep prometheus

# Verify NGINX controller is exporting metrics
curl -s http://<nginx-controller-ip>:10254/metrics | grep nginx
```

---

## Next Steps

1. **Custom Domain Configuration:** Update `*.example.com` placeholders with real domains
2. **Sealed Secrets:** Protect sensitive data (GitHub App PEM) using Sealed Secrets
3. **Notifications:** Add Slack/Teams notifications for Flux events via Notification objects
4. **Multi-Cluster:** Expand to additional clusters using Flux multi-tenancy
5. **Load Testing:** Integrate Flagger load tester for canary validation

---

## References

- [Flux Documentation](https://fluxcd.io/docs/)
- [Flagger Documentation](https://docs.flagger.app/)
- [Kustomize Overlays](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
- [GitHub App Manifest Flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)
