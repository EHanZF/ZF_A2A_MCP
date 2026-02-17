import { createJWT } from "./jwt";

export { OnboardingDO } from "./onboarding-do";

export default {
  async fetch(req: Request, env: any) {
    const url = new URL(req.url);

    // Issue short-lived token for Vector Bus (edge sign-in)
    if (url.pathname === "/token" && req.method === "POST") {
      const now = Math.floor(Date.now() / 1000);
      const secret = env.CF_JWT_SECRET || "dev-secret";
      const token = await createJWT({ sub: "edge-client", iat: now, exp: now + Number(env.JWT_TTL_SECONDS ?? "600") }, secret);
      return new Response(JSON.stringify({ token }), {
        headers: { "content-type": "application/json",
                   "access-control-allow-origin": "*" } // dev-only CORS
      });
    }

    // WebSocket onboarding to Durable Object
    if (url.pathname === "/onboard" && req.headers.get("Upgrade") === "websocket") {
      const id = env.ONBOARDING_DO.idFromName("global");
      return env.ONBOARDING_DO.get(id).fetch(req);
    }

    return new Response("ok", { status: 200 });
  }
};
