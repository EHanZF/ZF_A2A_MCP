from __future__ import annotations
import json
import os
from typing import Dict, Any

class SystemState:
    def __init__(self, data: Dict[str, Any]):
        self.data = data

    @classmethod
    def load(cls, path: str) -> "SystemState":
        if not os.path.exists(path):
            return cls({"ticks": 0, "events": []})
        with open(path, "r") as f:
            return cls(json.load(f))

    def save(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(self.data, f, indent=2)

    def tick(self, typ: str, payload: Dict[str, Any]):
        self.data["ticks"] = int(self.data.get("ticks", 0)) + 1
        ev = {"type": typ, "payload": payload}
        self.data.setdefault("events", []).append(ev)
        # compact the log for context window efficiency
        if len(self.data["events"]) > 1000:
            self.data["events"] = self.data["events"][-200:]
