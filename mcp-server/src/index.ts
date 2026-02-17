import express from "express";
import bodyParser from "body-parser";
import { normalize } from "./skills/normalize_orchestration_context";
import { evaluate } from "./skills/dmn_evaluate_orchestration";
import { rag } from "./skills/rag_vector_query";
import { getStatus } from "./skills/core_get_status";

const app = express();
app.use(bodyParser.json());

app.post("/mcp", async (req, res) => {
  const { method, name, arguments: args } = req.body || {};
  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      result: { tools: [
        { name: "core:get_status" },
        { name: "normalize_orchestration_context" },
        { name: "dmn_evaluate_orchestration" },
        { name: "rag_vector_query" }
      ] }
    });
  }
  if (method === "tools/call") {
    switch (name) {
      case "core:get_status": return res.json({ jsonrpc: "2.0", result: getStatus() });
      case "normalize_orchestration_context": return res.json({ jsonrpc: "2.0", result: normalize(args) });
      case "dmn_evaluate_orchestration": return res.json({ jsonrpc: "2.0", result: evaluate(args) });
      case "rag_vector_query": return res.json({ jsonrpc: "2.0", result: await rag(args) });
    }
  }
  res.status(400).json({ jsonrpc: "2.0", error: { code: -32601, message: "Unknown method" } });
});

app.listen(8080, () => console.log("MCP test bus on :8080"));
