#!/usr/bin/env python3
"""
Generate target index for vector space routing.
"""
import json
from pathlib import Path

def main():
    config_dir = Path("config")
    config_dir.mkdir(exist_ok=True)
    
    output = {
        "vector_spaces": [
            "mcp-server",
            "agent-cdyp7", 
            "orchestrator"
        ],
        "targets": {
            "mcp-server": {"type": "container", "image": "ghcr.io/zf/mcp-server:latest"},
            "agent-cdyp7": {"type": "agent", "role": "coordinator"},
            "orchestrator": {"type": "service", "port": 3000}
        }
    }
    
    with open(config_dir / "target_index.json", 'w') as f:
        json.dump(output, f, indent=2)
    
    print("✓ Generated config/target_index.json")

if __name__ == "__main__":
    main()
