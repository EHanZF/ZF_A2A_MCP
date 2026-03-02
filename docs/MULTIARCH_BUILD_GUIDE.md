# Multi-Arch Build & Push with Local Registry Testing

## Overview

The enhanced `actions.build_and_push` skill now provides **first-class multi-architecture support** with:

- ✅ Automatic `docker buildx` setup with persistent builder
- ✅ `qemu/binfmt` emulation bootstrap (for cross-arch builds on single-arch hosts)
- ✅ Multi-platform image building (`linux/amd64`, `linux/arm64`, etc.)
- ✅ Manifest list digest tracking
- ✅ Local registry testing flow (port 5000)
- ✅ VS Code integration (`tasks.json` + `launch.json`)

---

## Quick Start

### 1. Start a Local Registry

```bash
docker run -d --name reg -p 5000:5000 registry:2
```

Or use the VS Code task: **Terminal → Run Task… → Docker: start local registry**

### 2. Build & Push to Local Registry

```bash
mcp run actions.build_and_push --input @.mcp/build.input.local.json
```

Or use the VS Code task: **Terminal → Run Task… → MCP: build_and_push (local registry)**

Expected output:
```
✓ buildx builder 'agent-builder' created/ready
✓ binfmt emulation installed for arm64, amd64
✓ Building image for: linux/amd64, linux/arm64
✓ Manifest list created and pushed
✓ Digest: sha256:abc123...
```

### 3. Verify Multi-Arch Manifest

```bash
docker buildx imagetools inspect localhost:5000/agentic-demo:sha-localdev
```

Output:
```
Name:      localhost:5000/agentic-demo:sha-localdev
MediaType: application/vnd.docker.distribution.manifest.list.v2+json
Digest:    sha256:abc123...

Manifests:
  linux/amd64  sha256:def456...
  linux/arm64  sha256:ghi789...
```

### 4. Test Pull & Run Each Platform

```bash
# Test AMD64
docker run --rm --platform=linux/amd64 localhost:5000/agentic-demo:sha-localdev

# Test ARM64
docker run --rm --platform=linux/arm64 localhost:5000/agentic-demo:sha-localdev
```

Thanks to `qemu/binfmt`, both should run successfully even on a single-arch host, showing:
- AMD64: `built_for=hello from x86_64` / `runtime=x86_64`
- ARM64: `built_for=hello from aarch64` / `runtime=aarch64`

---

## Skill Input Schema

### New Parameters (Multi-Arch)

```typescript
type BuildAndPushInput = {
  // ... existing fields ...

  platforms?: string[];                // NEW: target architectures
  emulate?: boolean;                   // NEW: auto-install qemu/binfmt (default: true)
  binfmtPlatforms?: string[];          // NEW: which emulators to install
  builderName?: string;                // NEW: buildx builder name (default: "agent-builder")
};
```

### Example Input

**File:** `.mcp/build.input.local.json`

```json
{
  "context": "examples/multiarch",
  "dockerfile": "examples/multiarch/Dockerfile",
  "image": "localhost:5000/agentic-demo",
  "autoTag": {
    "sha": "localdev1234567"
  },
  "platforms": [
    "linux/amd64",
    "linux/arm64"
  ],
  "emulate": true,
  "provenance": false,
  "sbom": false,
  "push": true
}
```

---

## VS Code Integration

### Tasks (`tasks.json`)

All tasks available via **Terminal → Run Task…**:

| Task | Purpose |
|------|---------|
| **MCP: build_and_push (local registry)** | Build & push multi-arch image to `localhost:5000` |
| **Docker: start local registry** | Start registry:2 on port 5000 |
| **Docker: stop local registry** | Stop and remove registry container |
| **Docker: inspect multi-arch manifest** | Show manifest list and digest details |
| **Docker: test AMD64 image** | Pull & run AMD64 variant |
| **Docker: test ARM64 image** | Pull & run ARM64 variant |

### Debug Configuration (`launch.json`)

**Debug: build_and_push skill (Node.js)**

1. Set breakpoints in `Agents/skills/actions/buildAndPush.ts`
2. Press **F5** or **Run → Start Debugging**
3. Debugger pauses at breakpoints

Requires compilation first:
```bash
npm run build
```

---

## Common Workflows

### Workflow A: Local Development → Test → Push to GHCR

```bash
# 1. Local development
npm run dev

# 2. Test multi-arch build locally
node scripts/test-multiarch-build.sh

# 3. Run via VS Code Task
# Terminal → Run Task → MCP: build_and_push (local registry)

# 4. Inspect manifests
docker buildx imagetools inspect localhost:5000/agentic-demo:sha-...

# 5. Test pull/run
docker run --rm --platform=linux/arm64 localhost:5000/agentic-demo:sha-...

# 6. When ready, push to GHCR
export GITHUB_ACTOR="your-username"
export GITHUB_TOKEN="ghp_..."
mcp run actions.build_and_push --input @.mcp/build.input.ghcr.json
```

### Workflow B: GitHub Actions (Automated)

Push a branch that triggers `.github/workflows/build-and-push.yml`:

```yaml
- name: Build & Push (Multi-Arch)
  run: |
    node -e "import('./Agents/swarm/routingFabric.js').then(m => new m.RoutingFabric().route({
      source: 'GHA',
      task: 'actions.build_and_push',
      payload: {
        image: 'ghcr.io/your-org/your-app',
        platforms: ['linux/amd64', 'linux/arm64'],
        push: true
      }
    }))"
```

### Workflow C: Debug a Failed Build

1. Update `.mcp/build.input.local.json` with your failing scenario
2. Press **F5** to start debug session
3. Step through `handleBuildAndPush()` to see where it fails
4. Check Docker daemon logs if needed:
   ```bash
   docker logs agent-builder  # buildx builder container
   ```

---

## Troubleshooting

### Issue: "http: server gave HTTP response to HTTPS client"

**Cause:** Docker treats `localhost:5000` as requiring HTTPS.

**Fix (Linux):** Add to `/etc/docker/daemon.json`:
```json
{
  "insecure-registries": [
    "127.0.0.1:5000",
    "localhost:5000"
  ]
}
```

Then restart Docker:
```bash
sudo systemctl restart docker
# or
sudo service docker restart
```

### Issue: binfmt Installation Permission Denied

**Cause:** `tonistiigi/binfmt:qemu-*` container needs `--privileged`.

**Fix:** Ensure Docker daemon is running with sufficient privileges:
- Docker Desktop (macOS/Windows): Usually works by default
- Docker Engine (Linux): Run as user in docker group, or use `sudo`

If it fails, builds may still succeed for native architecture only.

### Issue: Manifest List Digest Not Found

**Cause:** Push didn't complete or metadata extraction failed.

**Workaround:** Manually inspect:
```bash
docker buildx imagetools inspect localhost:5000/agentic-demo:sha-localdev
```

Look for `Digest:` line showing the manifest list SHA256.

### Issue: ARM64 Image Doesn't Run on AMD64 Host

**Cause:** `qemu/binfmt` not installed or buildx using wrong builder.

**Fix:**
```bash
# Verify binfmt is loaded
docker run --rm tonistiigi/binfmt --status
# Should show: enabled for arm64, amd64 (among others)

# Force rebuild with emulation
mcp run actions.build_and_push --input @.mcp/build.input.local.json
```

---

## Performance Tips

### Use Build Cache

Add to input JSON:
```json
{
  "cache": {
    "from": "type=registry,ref=localhost:5000/agentic-demo-cache:main",
    "to": "type=registry,ref=localhost:5000/agentic-demo-cache:main,mode=max"
  }
}
```

Subsequent builds reuse layers, much faster.

### Skip Provenance/SBOM for Local Testing

```json
{
  "provenance": false,
  "sbom": false
}
```

Both add overhead; disable for dev builds.

### Increase Timeouts for Slow Hosts

```json
{
  "timeouts": {
    "perStepMs": 1200000,
    "totalMs": 3600000
  }
}
```

Gives 20 min per step, 60 min total (default: 15 min / 60 min).

---

## Testing Strategy

### Test 1: Verify Binfmt

```bash
docker run --rm --privileged tonistiigi/binfmt --status
# Should list all available emulators
```

### Test 2: Single-Arch Build

```bash
mcp run actions.build_and_push --input '{
  "context": "examples/multiarch",
  "image": "localhost:5000/test:single",
  "platforms": ["linux/amd64"],
  "push": false
}'
```

Should build locally without pushing.

### Test 3: Multi-Arch Build

```bash
mcp run actions.build_and_push --input @.mcp/build.input.local.json
```

Should create manifest list with both amd64 and arm64.

### Test 4: Pull Each Platform

```bash
docker run --rm --platform=linux/amd64 localhost:5000/agentic-demo:sha-localdev
docker run --rm --platform=linux/arm64 localhost:5000/agentic-demo:sha-localdev
```

Both should execute successfully.

---

## Architecture Details

### What Happens When You Build Multi-Arch

1. **Validate Docker & Buildx**: Ensure Docker daemon is running and buildx available
2. **Login**: Authenticate to registry if `registry` credentials provided
3. **Setup Binfmt** (if `emulate: true`):
   - Runs `docker run --privileged tonistiigi/binfmt --install arm64,amd64`
   - Enables kernel emulation for foreign architectures
4. **Ensure Buildx Builder**:
   - Creates/reuses named builder (`agent-builder` by default)
   - Uses `docker-container` driver for full feature support
5. **Compute Tags**: Apply `autoTag` logic (sha, branch, semver)
6. **Build Multi-Arch**:
   - Runs `docker buildx build --platform linux/amd64,linux/arm64 ...`
   - BuildKit manages native vs. emulated builds
   - Pushes all layers to registry
7. **Extract Digest**:
   - Reads metadata file or inspects manifest list
   - Returns digest for CI/CD tracking

### Why Emulation Matters

- **Without emulation**: Can only build for current CPU architecture (x86_64 on your laptop)
- **With emulation**: Can build ARM64 on x86_64, and vice versa, via QEMU
- **Limitation**: Emulated builds are slower (runs ARM instructions in QEMU translator)
- **Solution**: Use native builders when possible (e.g., GitHub Actions on `ubuntu-latest` for AMD64)

---

## File Reference

| File | Purpose |
|------|---------|
| `Agents/skills/actions/buildAndPush.ts` | Multi-arch skill implementation |
| `.mcp/build.input.local.json` | Example input for local registry |
| `examples/multiarch/Dockerfile` | Test Dockerfile (architecture-aware output) |
| `.vscode/tasks.json` | VS Code tasks for build, registry, testing |
| `.vscode/launch.json` | Debug configuration for skill |
| `Agents/swarm/runLocal.ts` | Local skill runner (for debugging) |
| `Agents/swarm/routingFabric.ts` | Routing entry for `actions.build_and_push` |

---

## Next Steps

1. ✅ **Test locally** — Run VS Code task `MCP: build_and_push (local registry)`
2. ✅ **Inspect manifest** — Verify both platforms in list
3. ✅ **Pull & run** — Test each platform container
4. ✅ **Debug** — Set breakpoints and press F5 if needed
5. ✅ **Deploy** — Push to production registry (GHCR, Docker Hub, ECR, etc.)

