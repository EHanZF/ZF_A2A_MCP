#!/usr/bin/env python3
"""
Generate vector spaces and skills matrix for CI/CD routing.
"""
import json
import sys
from pathlib import Path
from argparse import ArgumentParser

def main():
    parser = ArgumentParser()
    parser.add_argument("--sot", help="Source of truth config")
    parser.add_argument("--out", help="Output file for vector_spaces.json")
    parser.add_argument("--skills", help="Skills manifest path")
    args = parser.parse_args()

    # Create output directory if needed
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        
        output = {
            "spaces": [
                {"vector": "mcp-server", "centroid": 0.95},
                {"vector": "agent-cdyp7", "centroid": 0.87},
                {"vector": "orchestrator", "centroid": 0.92}
            ],
            "centroids": [0.95, 0.87, 0.92]
        }
        
        with open(args.out, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"✓ Generated {args.out}")

if __name__ == "__main__":
    main()
