#!/usr/bin/env pwsh

# MCP Integration Commit & Push - Easy Reference
# Run from workspace root directory

# Stage all changes
git add -A

# Commit with comprehensive message
git commit -m "feat: Implement complete GitHub Actions + MCP integration with RBAC, SSH CA, and VS Code extension" `
  -m "This commit delivers production-ready integration:

FEATURES:
- RBAC Enforcement Layer (adk/security/rbac.ts)
  * Identity extraction from GitHub OIDC tokens, env vars, HTTP headers
  * Role-based access (admin, developer, ci-agent, reader)
  * Tool-level fine-grained permissions
  * Audit logging

- Identity & Authentication (mcp-server/src/)
  * identityExtractor.ts: Express middleware
  * streamableServer.ts: Official MCP SDK Streamable HTTP transport
  * github-app-auth.ts: GitHub OIDC JWT validation
  * bootstrapMCPServer.ts: Dual-transport support

- GitHub Actions CI/CD (.github/workflows/)
  * ci-mcp-build-and-push.yml: Production workflow with OIDC
  * RBAC-gated MCP tool invocation
  * Multi-arch Docker builds (amd64, arm64)
  * PR comments with results

- VS Code Extension (vscode-mcp-extension/)
  * Auto-connect to local MCP server
  * Scaffold Agent, Create Tool, Edit RBAC, Generate Workflow
  * Tree views: tools and agents
  * Workflow generation with SSH CA

- Agent Scaffolding (Agents/skills/actions/scaffoldAgent.ts)
  * Auto-generates agent boilerplate
  * Kubernetes ConfigMap with RBAC
  * GitHub Actions CI/CD workflows
  * Optional SSH CA integration

- Agent-to-Agent Protocol (adk/a2a_protocol.ts)
  * PE-OPS-PKT-V1 handshake
  * HMAC-SHA256 signatures
  * RASIC boundary enforcement
  * W3C trace context

SECURITY:
✅ RBAC on all MCP tools
✅ GitHub OIDC JWT validation (no stored secrets)
✅ Org-level SSH CA integration
✅ RASIC boundary enforcement
✅ Audit logging

FILES: 11 new, comprehensive documentation"

# Push to main
git push origin main
