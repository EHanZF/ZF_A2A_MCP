"""
MCP Orchestration Server
Exposes generate_orchestration_dmn() tool.
"""

import json
from pathlib import Path

DMN_PATH = Path("dmn/orchestration_decision_model.json")

def generate_orchestration_dmn(format: str):
    if format != "json":
        return {"error": "Unsupported format"}

    with open(DMN_PATH, "r") as f:
        data = json.load(f)

    return data


TOOLS = {
    "generate_orchestration_dmn": generate_orchestration_dmn
}
