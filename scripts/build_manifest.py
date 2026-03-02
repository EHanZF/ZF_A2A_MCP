#!/usr/bin/env python3
"""
Build manifest for deployment.
"""
import json
import sys

def main():
    manifest = {
        "version": "1.0.0",
        "components": [
            {"name": "mcp-server", "type": "container"},
            {"name": "agent-orchestrator", "type": "agent"},
            {"name": "wasm-engine", "type": "wasm"}
        ]
    }
    
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    main()
