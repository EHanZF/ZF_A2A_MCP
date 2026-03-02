#!/usr/bin/env node

/**
 * scripts/mcp-invoke.js
 *
 * GitHub Actions client for invoking MCP tools on a local MCP server.
 *
 * Usage:
 *   node mcp-invoke.js --tool "actions.build_and_push" --input '{"image": "..."}'
 *
 * Requires:
 *   - MCP server running on localhost:7337
 *   - @modelcontextprotocol/sdk installed
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("tool", {
      description: "MCP tool name to invoke",
      type: "string",
      required: true
    })
    .option("input", {
      description: "Tool input as JSON",
      type: "string",
      default: "{}"
    })
    .option("server-url", {
      description: "MCP server URL",
      type: "string",
      default: "http://localhost:7337/mcp/stream"
    })
    .option("timeout", {
      description: "Request timeout (ms)",
      type: "number",
      default: 30000
    })
    .parse();

  const toolName = argv.tool;
  const input = JSON.parse(argv.input);
  const serverUrl = argv["server-url"];
  const timeout = argv.timeout;

  console.log(`[MCP Client] Connecting to ${serverUrl}`);
  console.log(`[MCP Client] Tool: ${toolName}`);
  console.log(`[MCP Client] Input: ${JSON.stringify(input, null, 2)}`);

  try {
    // Create client with Streamable HTTP transport
    const client = new Client({
      name: "github-actions",
      version: "1.0.0"
    });

    const transport = new StreamableHTTPClientTransport(serverUrl);
    
    // Connect and invoke tool
    console.log(`[MCP Client] Connecting...`);
    await client.connect(transport);

    console.log(`[MCP Client] Invoking tool: ${toolName}`);
    const result = await client.callTool(toolName, input);

    console.log(`[MCP Client] Result:`, JSON.stringify(result, null, 2));

    // Format output for GitHub Actions
    const output = {
      success: true,
      tool: toolName,
      result: result.content && result.content[0] 
        ? JSON.parse(result.content[0].text || "{}")
        : result
    };

    console.log(JSON.stringify(output, null, 2));

    await client.close();
    process.exit(0);
  } catch (err) {
    console.error(`[MCP Client] Error:`, err);
    
    const output = {
      success: false,
      tool: toolName,
      error: String(err)
    };

    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }
}

main();
