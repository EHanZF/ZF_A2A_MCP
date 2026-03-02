import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type BuildAndPushInput = {
  context?: string;
  dockerfile?: string;
  image: string;
  tags?: string[];
  autoTag?: { sha?: string; branch?: string; semver?: string };
  platforms?: string[];                // e.g., ["linux/amd64","linux/arm64"]
  emulate?: boolean;                   // NEW: install qemu/binfmt for foreign arch builds (default: true)
  binfmtPlatforms?: string[];          // NEW: which emulators to install (default: ["arm64","amd64"])
  builderName?: string;                // NEW: buildx builder name (default: "agent-builder")
  buildArgs?: Record<string, string>;
  labels?: Record<string, string>;
  provenance?: boolean;
  sbom?: boolean;
  cache?: { from?: string; to?: string };
  push?: boolean;
  registry?: {
    server?: string;
    username?: string;
    password?: string;
    provider?: "ghcr" | "dockerhub" | "ecr" | "gcr" | "acr" | "other";
    ecr?: { region?: string; accountId?: string; roleArn?: string };
  };
  timeouts?: { totalMs?: number; perStepMs?: number };
  dryRun?: boolean;
};

type BuildAndPushOutput = {
  status: "success" | "failed";
  image: string;
  tags: string[];
  digest: string | null;               // manifest list digest for multi-arch
  platforms: string[];
  metadata: Record<string, string>;
  timings: { start: string; end: string; durationMs: number };
  logsRef: string | null;
  notes: string | null;
  error?: { message: string; step: "login" | "build" | "push" | "finalize"; stderr?: string };
};

function nowISO() { return new Date().toISOString(); }

function sanitizeRefPart(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 128);
}

async function sh(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; redact?: string[] } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const killTimer = opts.timeoutMs
      ? setTimeout(() => {
          try { child.kill("SIGKILL"); } catch {}
        }, opts.timeoutMs)
      : null;

    child.stdout.on("data", (d) => { stdout += d.toString(); process.stdout.write(d); });
    child.stderr.on("data", (d) => {
      let chunk = d.toString();
      for (const secret of opts.redact || []) if (secret) chunk = chunk.split(secret).join("***");
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (killTimer) clearTimeout(killTimer);
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

async function ensureDockerAvailable() {
  const res = await sh("docker", ["version", "--format", "{{.Server.Version}}"]);
  if (res.code !== 0) throw new Error(`Docker not available: ${res.stderr || res.stdout}`);
}

async function hasBuildx(): Promise<boolean> {
  const res = await sh("docker", ["buildx", "version"]);
  return res.code === 0;
}

async function ensureBinfmt(platforms: string[], emulate: boolean, timeoutMs: number) {
  if (!emulate) return;

  // If any target platform likely needs emulation, set up binfmt via tonistiigi/binfmt.
  // This is safe to run multiple times; it's a no-op if already installed.
  const wants = new Set(
    platforms
      .map(p => p.split("/")[1])
      .filter(a => a === "arm64" || a === "arm" || a === "amd64")
  );

  if (wants.size === 0) return;

  // On Docker Desktop macOS/Windows, emulation is typically preconfigured.
  // Running this is still fine; if daemon is rootless or lacks privileges, it may fail harmlessly.
  const argList = Array.from(wants);
  const installArg = argList.length ? argList.join(",") : "arm64,amd64";

  await sh("docker", ["run", "--privileged", "--rm", "tonistiigi/binfmt", "--install", installArg], {
    timeoutMs,
  }).catch(() => {
    // Non-fatal; if binfmt is already present or not permitted, buildx may still succeed for native targets.
  });
}

async function ensureBuildxBuilder(builderName: string, timeoutMs: number) {
  // Check if builder exists
  const ls = await sh("docker", ["buildx", "ls"], { timeoutMs });
  const exists = ls.code === 0 && ls.stdout.includes(builderName);

  if (!exists) {
    await sh("docker", ["buildx", "create", "--use", "--name", builderName, "--driver", "docker-container"], {
      timeoutMs,
    }).catch(() => { /* may already exist or driver not available; ignore */ });
  } else {
    await sh("docker", ["buildx", "use", builderName], { timeoutMs });
  }

  // Warm up buildx to avoid first-call latency
  await sh("docker", ["buildx", "inspect", builderName], { timeoutMs }).catch(() => {});
}

function computeTags(image: string, input: BuildAndPushInput): string[] {
  const tags = new Set<string>(input.tags || []);
  const auto = input.autoTag || {};
  if (auto.sha) tags.add(`sha-${sanitizeRefPart(auto.sha.slice(0, 7))}`);
  if (auto.branch) tags.add(sanitizeRefPart(auto.branch));
  if (auto.semver) {
    tags.add(auto.semver);
    if (!/-/.test(auto.semver) && /^\d+\.\d+\.\d+$/.test(auto.semver)) tags.add("latest");
  }
  if (tags.size === 0) tags.add("latest");
  return Array.from(tags).map((t) => `${image}:${t}`);
}

function defaultOciLabels(input: BuildAndPushInput): Record<string, string> {
  const now = nowISO();
  const rev = input.autoTag?.sha || process.env.GITHUB_SHA || "";
  const repo = process.env.GITHUB_REPOSITORY || "";
  return {
    "org.opencontainers.image.created": now,
    "org.opencontainers.image.revision": rev,
    "org.opencontainers.image.source": repo ? `https://github.com/${repo}` : "",
  };
}

async function dockerLogin(input: BuildAndPushInput) {
  const reg = input.registry || {};
  if ((reg.provider === "ghcr" || (!reg.server && process.env.GITHUB_SERVER_URL)) && !reg.username && !reg.password) {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.CR_PAT;
    const actor = process.env.GITHUB_ACTOR;
    if (token && actor) {
      const res2 = await sh("docker", ["login", "ghcr.io", "-u", actor, "-p", token], {
        redact: [token],
        env: process.env,
        timeoutMs: 60_000,
      });
      if (res2.code !== 0) throw new Error(`GHCR login failed: ${res2.stderr}`);
      return;
    }
  }
  if (reg.server && reg.username && reg.password) {
    const res = await sh("docker", ["login", reg.server, "-u", reg.username, "-p", reg.password], {
      redact: [reg.password],
      env: process.env,
      timeoutMs: 60_000,
    });
    if (res.code !== 0) throw new Error(`Registry login failed: ${res.stderr}`);
  }
}

export async function handleBuildAndPush(payload: BuildAndPushInput): Promise<BuildAndPushOutput> {
  const start = Date.now();
  const startISO = nowISO();

  const context = payload.context || ".";
  const dockerfile = payload.dockerfile || "Dockerfile";
  const image = payload.image;
  const push = payload.push !== false;
  const platforms = payload.platforms?.length ? payload.platforms : ["linux/amd64", "linux/arm64"];
  const emulate = payload.emulate !== false; // default true
  const builderName = payload.builderName || "agent-builder";
  const perStepTimeout = payload.timeouts?.perStepMs ?? 15 * 60 * 1000;
  const totalTimeout = payload.timeouts?.totalMs ?? 60 * 60 * 1000;

  if (!image) {
    return {
      status: "failed",
      image: "",
      tags: [],
      digest: null,
      platforms: [],
      metadata: {},
      timings: { start: startISO, end: nowISO(), durationMs: Date.now() - start },
      logsRef: null,
      notes: null,
      error: { message: "Input 'image' is required", step: "finalize" },
    };
  }

  const fullTags = computeTags(image, payload);
  const labels = { ...defaultOciLabels(payload), ...(payload.labels || {}) };

  try {
    await ensureDockerAvailable();

    if (payload.dryRun) {
      return {
        status: "success",
        image,
        tags: fullTags,
        digest: null,
        platforms,
        metadata: labels,
        timings: { start: startISO, end: nowISO(), durationMs: Date.now() - start },
        logsRef: null,
        notes: "Dry-run: no build executed",
      };
    }

    await dockerLogin(payload);

    const buildxOK = await hasBuildx();
    const useBuildx = buildxOK || platforms.length > 1;

    // Multi-arch: ensure binfmt + buildx
    if (useBuildx) {
      await ensureBinfmt(platforms, emulate, perStepTimeout);
      await ensureBuildxBuilder(builderName, perStepTimeout);
    }

    // Capture metadata (digest, etc.)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "buildx-"));
    const metadataPath = path.join(tmpDir, "metadata.json");

    const buildArgPairs: string[] = [];
    for (const [k, v] of Object.entries(payload.buildArgs || {})) buildArgPairs.push("--build-arg", `${k}=${v}`);

    const labelArgPairs: string[] = [];
    for (const [k, v] of Object.entries(labels)) if (v) labelArgPairs.push("--label", `${k}=${v}`);

    let digest: string | null = null;

    if (useBuildx) {
      const args = [
        "buildx", "build",
        "--builder", builderName,
        "--progress", "plain",
        "--file", dockerfile,
        ...fullTags.flatMap((t) => ["--tag", t]),
        ...labelArgPairs,
        ...buildArgPairs,
        "--platform", platforms.join(","),
        ...(payload.cache?.from ? ["--cache-from", payload.cache.from] : []),
        ...(payload.cache?.to ? ["--cache-to", payload.cache.to] : []),
        ...(payload.provenance ? ["--provenance=true"] : ["--provenance=false"]),
        ...(payload.sbom ? ["--sbom=true"] : []),
        ...(push ? ["--push"] : ["--load"]),
        "--metadata-file", metadataPath,
        context,
      ];

      const res = await sh("docker", args, { timeoutMs: totalTimeout });
      if (res.code !== 0) {
        return {
          status: "failed",
          image,
          tags: fullTags,
          digest: null,
          platforms,
          metadata: labels,
          timings: { start: startISO, end: nowISO(), durationMs: Date.now() - start },
          logsRef: metadataPath,
          notes: null,
          error: { message: "Buildx build failed", step: "build", stderr: res.stderr || res.stdout },
        };
      }

      // Prefer digest from metadata file
      if (fs.existsSync(metadataPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
          digest =
            meta?.containerimage?.digest ||
            meta?.["containerimage.digest"] ||
            meta?.result?.digest ||
            null;
        } catch { /* ignore parse errors */ }
      }

      // Fallback: inspect manifest list digest
      if (!digest && push) {
        const inspect = await sh("docker", ["buildx", "imagetools", "inspect", fullTags[0]], { timeoutMs: perStepTimeout });
        if (inspect.code === 0) {
          const m = inspect.stdout.match(/Digest:\s*(sha256:[a-f0-9]+)/i);
          if (m) digest = m[1];
        }
      }
    } else {
      // Single-arch classic build
      const buildRes = await sh("docker",
        ["build", "-f", dockerfile,
          ...Object.entries(labels).flatMap(([k, v]) => ["--label", `${k}=${v}`]),
          ...Object.entries(payload.buildArgs || {}).flatMap(([k, v]) => ["--build-arg", `${k}=${v}`]),
          "-t", fullTags[0],
          context
        ],
        { timeoutMs: totalTimeout }
      );
      if (buildRes.code !== 0) {
        return {
          status: "failed",
          image,
          tags: fullTags,
          digest: null,
          platforms,
          metadata: labels,
          timings: { start: startISO, end: nowISO(), durationMs: Date.now() - start },
          logsRef: null,
          notes: null,
          error: { message: "Docker build failed", step: "build", stderr: buildRes.stderr || buildRes.stdout },
        };
      }

      if (push) {
        for (const t of fullTags) {
          const pr = await sh("docker", ["push", t], { timeoutMs: perStepTimeout });
          if (pr.code !== 0) {
            return {
              status: "failed",
              image,
              tags: fullTags,
              digest: null,
              platforms,
              metadata: labels,
              timings: { start: startISO, end: nowISO(), durationMs: Date.now() - start },
              logsRef: null,
              notes: null,
              error: { message: `Push failed for ${t}`, step: "push", stderr: pr.stderr || pr.stdout },
            };
          }
        }
        const inspect = await sh("docker", ["inspect", "--format", "{{index .RepoDigests 0}}", fullTags[0]], { timeoutMs: perStepTimeout });
        if (inspect.code === 0) {
          const d = inspect.stdout.trim();
          const m = d.match(/@(?<dgst>sha256:[a-f0-9]+)/);
          if (m?.groups?.dgst) digest = m.groups.dgst;
        }
      }
    }

    return {
      status: "success",
      image,
      tags: fullTags,
      digest: digest || null,
      platforms,
      metadata: labels,
      timings: { start: startISO, end: nowISO(), durationMs: Date.now() - start },
      logsRef: null,
      notes: push ? null : "Image built locally (not pushed)",
    };
  } catch (err: any) {
    return {
      status: "failed",
      image,
      tags: [],
      digest: null,
      platforms,
      metadata: {},
      timings: { start: startISO, end: nowISO(), durationMs: Date.now() - start },
      logsRef: null,
      notes: null,
      error: { message: err?.message || String(err), step: "finalize" },
    };
  }
}

export default handleBuildAndPush;
