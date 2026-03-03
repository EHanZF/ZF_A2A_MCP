import fetch from "node-fetch";
import WebSocket from "ws";
import readlineSync from "readline-sync";

const MCP_HOST = process.env.MCP_HOST || "https://your.domain";
const API_KEY = process.env.MCP_API_KEY;

if (!API_KEY) {
  console.error("Missing MCP_API_KEY env variable.");
  process.exit(1);
}

async function handshake() {
  const res = await fetch(`${MCP_HOST}/api/agents/handshake`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      agent_id: "local-coding-agent",
      capabilities: ["chat", "codegen"],
      metadata: { client: "npm-local-agent" }
    })
  });

  if (!res.ok) {
    throw new Error("Handshake failed: " + res.status);
  }

  return res.json();
}

(async () => {
  const { session_id, ws_url } = await handshake();
  const ws = new WebSocket(`${MCP_HOST}${ws_url}`);

  ws.on("open", () => {
    console.log("Connected to MCP Server.\n");
  });

  ws.on("message", (msg) => {
    console.log("MCP:", msg.toString());
  });

  while (true) {
    const input = readlineSync.question("> ");

    ws.send(JSON.stringify({
      type: "message",
      role: "user",
      content: input
    }));
  }
})();
