export class OnboardingDO {
  constructor(private state: DurableObjectState, private env: any) {}
  async fetch(req: Request) {
    // Simple WS echo skeleton for future session coordination
    if (req.headers.get("Upgrade") !== "websocket") return new Response("upgrade required", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as WebSocket[];
    server.accept();
    server.addEventListener("message", (ev: MessageEvent) => {
      try { const msg = JSON.parse(ev.data as string);
            if (msg.type === "ping") server.send(JSON.stringify({ type: "pong", t: Date.now() }));
      } catch { server.send(JSON.stringify({ type: "error" })); }
    });
    return new Response(null, { status: 101, webSocket: client });
  }
}
