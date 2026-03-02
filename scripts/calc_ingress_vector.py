#!/usr/bin/env python3
"""
Calculate ingress vector for particle physics simulation.
"""
import sys
from pathlib import Path

def main():
    if len(sys.argv) < 2:
        print("Usage: calc_ingress_vector.py <output_file>")
        sys.exit(1)
    
    output_file = sys.argv[1]
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    
    # Generate dummy ingress vector
    vector = [0.5, 0.3, 0.2]
    
    with open(output_file, 'w') as f:
        f.write('\n'.join(str(v) for v in vector))
    
    print(f"✓ Generated ingress vector: {output_file}")

if __name__ == "__main__":
    main()
