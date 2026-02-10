# Canonical ZF A2A MCP configuration for the Tool Bus
# This file is meant to be identical for all agents participating in A2A.
# It is designed to be reproducible and deterministic.

version: "1.0.0"

server:
  id: "tool-bus-mcp"
  name: "Canonical Tool Bus MCP Server"
  description: "Deterministic MCP tool bus for multi-agent alignment and A2A handshakes."
  # Adjust to your actual server entrypoint in the GitHub repo:
  runtime:
    language: "python"
    command: "python"
    args:
      - "-m"
      - "tool_bus_mcp_server"    # e.g., module in the repo
  repository:
    type: "github"
    url: "https://github.com/<org>/<repo>"   # <-- put your repo here
    branch: "main"
    # Optional: pin to a commit for determinism
    # commit: "<full_commit_sha>"

capabilities:
  # Normalized capability vector — must match for all agents
  tool_vector:
    get_status: 1
    run_local_task: 1
    query_public_dataset: 1
    generate_report: 1

tools:
  - name: "get_status"
    description: "Return the current health, version, and uptime info for the tool bus."
    input_schema:
      type: "object"
      additionalProperties: false
      properties:
        verbose:
          type: "boolean"
          description: "If true, include extended diagnostic details."
      required: []
    output_schema:
      type: "object"
      additionalProperties: false
      properties:
        status:
          type: "string"
          enum: ["ok", "degraded", "error"]
        version:
          type: "string"
        uptime_seconds:
          type: "number"
        details:
          type: "object"
          additionalProperties: true
      required: ["status", "version", "uptime_seconds"]

  - name: "run_local_task"
    description: "Execute a deterministic local task on the tool bus host."
    input_schema:
      type: "object"
      additionalProperties: false
      properties:
        task_id:
          type: "string"
          description: "Stable identifier for the task to run."
        parameters:
          type: "object"
          description: "Task-specific parameters."
          additionalProperties: true
      required: ["task_id"]
    output_schema:
      type: "object"
      additionalProperties: false
      properties:
        task_id:
          type: "string"
        status:
          type: "string"
          enum: ["queued", "running", "completed", "failed"]
        result:
          type: ["object", "null"]
          additionalProperties: true
        error:
          type: ["string", "null"]
      required: ["task_id", "status"]

  - name: "query_public_dataset"
    description: "Run a deterministic query against a local public dataset snapshot."
    input_schema:
      type: "object"
      additionalProperties: false
