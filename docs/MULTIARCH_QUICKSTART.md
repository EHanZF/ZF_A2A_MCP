# Multi-Arch Support Setup Checklist

## ✅ What Was Implemented

### 1. **Enhanced Skill** (`Agents/skills/actions/buildAndPush.ts`)
- ✅ Multi-platform build support (`platforms: string[]`)
- ✅ Automatic `qemu/binfmt` bootstrap via `tonistiigi/binfmt` container
- ✅ Persistent `docker buildx` builder management
- ✅ Manifest list digest extraction (for CI/CD tracking)
- ✅ Proper cleanup and error handling
- ✅ Registry login support (GHCR, Docker Hub, ECR, custom)

### 2. **Testing Setup**
- ✅ Local registry example (port 5000)
- ✅ Example multi-arch Dockerfile (`examples/multiarch/Dockerfile`)
- ✅ MCP input template (`.mcp/build.input.local.json`)

### 3. **VS Code Integration**
- ✅ Tasks for build, registry start/stop, testing
- ✅ Debug configuration with runLocal helper
- ✅ Local skill runner (`Agents/swarm/runLocal.ts`)

### 4. **Routing**
- ✅ `actions.build_and_push` task in routing fabric
- ✅ Maps to CI001 agent

### 5. **Documentation**
- ✅ Complete guide (`docs/MULTIARCH_BUILD_GUIDE.md`)
- ✅ This checklist

---

## 🚀 Get Started in 5 Minutes

### Step 1: Start Local Registry (1 minute)

**Option A — VS Code Task:**
```
Terminal → Run Task… → Docker: start local registry
```

**Option B — Command Line:**
```bash
docker run -d --name reg -p 5000:5000 registry:2
```

### Step 2: Build Multi-Arch Image (2 minutes)

**Option A — VS Code Task:**
```
Terminal → Run Task… → MCP: build_and_push (local registry)
```

**Option B — Command Line:**
```bash
mcp run actions.build_and_push --input @.mcp/build.input.local.json
```

Expected output includes:
```
✓ Buildx builder 'agent-builder' created
✓ qemu/binfmt installed for arm64, amd64
✓ Building platforms: linux/amd64, linux/arm64
✓ Image pushed to localhost:5000/agentic-demo:sha-localdev
✓ Manifest digest: sha256:abc123...
```

### Step 3: Verify (1 minute)

**Option A — Inspect Manifest:**
```bash
docker buildx imagetools inspect localhost:5000/agentic-demo:sha-localdev
```

Should show both `linux/amd64` and `linux/arm64` manifests.

**Option B — Test Pull & Run:**
```bash
# AMD64
docker run --rm --platform=linux/amd64 localhost:5000/agentic-demo:sha-localdev

# ARM64
docker run --rm --platform=linux/arm64 localhost:5000/agentic-demo:sha-localdev
```

Both should execute successfully!

### Step 4: Stop Registry (1 minute)

```
Terminal → Run Task… → Docker: stop local registry
```

---

## 📝 What Each File Does

| File | Purpose | Key Changes |
|------|---------|-------------|
| `Agents/skills/actions/buildAndPush.ts` | Multi-arch build skill | New: `platforms`, `emulate`, `builderName` |
| `.mcp/build.input.local.json` | Example input | Pre-configured for local registry testing |
| `examples/multiarch/Dockerfile` | Test image | Architecture-aware (shows uname -m) |
| `.vscode/tasks.json` | Build tasks | 6 tasks for registry + testing |
| `.vscode/launch.json` | Debug config | Debug skill with F5 |
| `Agents/swarm/runLocal.ts` | Local runner | Invoke skill for debugging |
| `Agents/swarm/routingFabric.ts` | Routing | Added `actions.build_and_push` case |
| `docs/MULTIARCH_BUILD_GUIDE.md` | Full documentation | Workflows, troubleshooting, architecture |

---

## 🎯 Common Commands

### Build & Push to Local Registry
```bash
mcp run actions.build_and_push --input @.mcp/build.input.local.json
```

### Build & Push to GHCR
```bash
export GITHUB_ACTOR="your-username"
export GITHUB_TOKEN="ghp_..."

mcp run actions.build_and_push --input '{
  "context": "examples/multiarch",
  "image": "ghcr.io/your-org/your-repo/agentic-demo",
  "platforms": ["linux/amd64", "linux/arm64"],
  "autoTag": { "sha": "'$(git rev-parse --short HEAD)'" },
  "push": true
}'
```

### Dry-Run (Build Locally, Don't Push)
```bash
mcp run actions.build_and_push --input '{
  "context": "examples/multiarch",
  "image": "myapp",
  "platforms": ["linux/amd64", "linux/arm64"],
  "push": false,
  "dryRun": true
}'
```

### Debug with Breakpoints
1. Add breakpoint in `Agents/skills/actions/buildAndPush.ts`
2. Press **F5** (or **Run → Start Debugging**)
3. Step through code
4. Check **Debug Console** for output

---

## 🔧 Troubleshooting

### Issue: "http: server gave HTTP response to HTTPS client"

**Fix (Linux):** Add to `/etc/docker/daemon.json`:
```json
{ "insecure-registries": ["localhost:5000"] }
```

Restart Docker: `sudo systemctl restart docker`

### Issue: binfmt Installation Fails

**Workaround:** Set `"emulate": false` in input to skip emulation (builds native arch only).

### Issue: Slow Build Times

**Optimization:** Add cache registry:
```json
{
  "cache": {
    "to": "type=registry,ref=localhost:5000/cache:latest"
  }
}
```

### Issue: Docker Command Not Found

Ensure Docker is installed and running:
```bash
docker version  # Should show client + server versions
```

---

## 📚 Quick Links

- **Full Guide:** [`docs/MULTIARCH_BUILD_GUIDE.md`](./MULTIARCH_BUILD_GUIDE.md)
- **Skill Source:** [`Agents/skills/actions/buildAndPush.ts`](../Agents/skills/actions/buildAndPush.ts)
- **Input Template:** [`.mcp/build.input.local.json`](./.mcp/build.input.local.json)

---

## ✨ Next Steps

1. **Test locally** (Step 1-3 above) — 5 minutes
2. **Read full guide** if you need production registry setup
3. **Integrate into CI/CD** — Use in GitHub Actions, GitLab CI, etc.
4. **Monitor digests** — Track manifest digests in deployment automation

---

## 🎓 Did You Know?

- **Manifest List Digest:** Uniquely identifies the entire multi-arch image across platforms
- **QEMU Emulation:** Makes it possible to build ARM64 on x86_64 hosts
- **BuildKit Caching:** Speeds up incremental builds significantly
- **Signature/SBOM:** Optional (provenance=true/sbom=true) for supply chain security

Enjoy multi-arch builds! 🚀

