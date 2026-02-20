from __future__ import annotations
from typing import List, Tuple
import math
import random

def _dot(a: List[float], b: List[float]) -> float:
    return sum(x*y for x, y in zip(a, b))

def _norm(a: List[float]) -> float:
    return math.sqrt(sum(x*x for x in a))

def _cosine(a: List[float], b: List[float]) -> float:
    na, nb = _norm(a), _norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return _dot(a, b) / (na * nb)

class FuzzingSubAgent:
    """
    Cleans up 'loose' vectors (low norm or low cohesion),
    perturbs edge cases, and consumes leftover 'tokens' via synthetic hashing ticks.
    """
    def __init__(self, seed: int = 71):
        self.rng = random.Random(seed)

    def clean_loose_vectors(self, vectors: List[List[float]], cosine_threshold: float = 0.12) -> List[List[float]]:
        """Remove vectors with extremely low norm or low mean similarity to neighborhood."""
        if not vectors:
            return vectors

        norms = [_norm(v) for v in vectors]
        # Remove near-zero vectors
        keep = [i for i, n in enumerate(norms) if n > 1e-6]
        vs = [vectors[i] for i in keep]

        if len(vs) < 3:
            return vs

        # Compute mean cosine to neighbors (cheap pass)
        means = []
        for i, v in enumerate(vs):
            neighborhood = [j for j in range(len(vs)) if j != i]
            cosines = [_cosine(v, vs[j]) for j in neighborhood]
            means.append(sum(cosines) / max(1, len(cosines)))

        filtered = [v for (v, m) in zip(vs, means) if m >= cosine_threshold]
        return filtered

    def perturb_vectors(self, vectors: List[List[float]], scale: float = 0.01) -> List[List[float]]:
        """Small random perturbation to test robustness."""
        out = []
        for v in vectors:
            out.append([x + self.rng.uniform(-scale, scale) for x in v])
        return out

    def consume_leftover_tokens(self, vectors: List[List[float]]) -> List[str]:
        """
        Consume 'leftover tokens' by hashing vector triads (cosine tick).
        The returned strings serve as synthetic token drains.
        """
        toks = []
        for i in range(0, max(0, len(vectors) - 2), 3):
            tri = vectors[i:i+3]
            # tick: use signed magnitude + cosine to seed token
            cos12 = _cosine(tri[0], tri[1])
            cos23 = _cosine(tri[1], tri[2])
            seed_val = int((cos12 + cos23) * 1000000)  # synthetic tick
            self.rng.seed(seed_val)
            toks.append(f"TOK-{abs(seed_val)%10_000:04d}-{self.rng.randint(100,999)}")
        return toks
