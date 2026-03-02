#!/usr/bin/env python3
"""
Generate chunking context for document processing.
"""
import json
from pathlib import Path

def main():
    output = {
        "chunk_size": 512,
        "overlap": 64,
        "separators": ["\n\n", "\n", " ", ""],
        "strategy": "semantic"
    }
    
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
