from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

from dmn_runtime import DMNRuntime
from mcp_dmn_wrapper import MCPDMNWrapper
from fuzzing_agent import FuzzingSubAgent
from state import SystemState

app = FastAPI(title="DMN Gateway & Fuzzing Service")

wrapper = MCPDMNWrapper()
fuzzer = FuzzingSubAgent()
system_state = SystemState.load("./state/runtime/system_state.json")

class EvaluateIn(BaseModel):
    dmn_xml: str
    inputs: Dict[str, Any]

class ReverseMapIn(BaseModel):
    dmn_xml: str
    inference_map_id: str
    source_checkpoint: Optional[str] = None

class GateIn(BaseModel):
    dmn_xml: str
    release_context: Dict[str, Any]
    vector_payload: Optional[List[str]] = None

class FuzzIn(BaseModel):
    vectors: List[List[float]]
    mode: str = "scrub"  # scrub|perturb
    cosine_threshold: float = 0.12
    consume_tokens: bool = True

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.get("/state")
def get_state():
    return system_state.data

@app.post("/dmn/evaluate")
def dmn_evaluate(body: EvaluateIn):
    try:
        return wrapper.evaluate(body.dmn_xml, body.inputs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/dmn/reverse_map")
def dmn_reverse_map(body: ReverseMapIn):
    try:
        return wrapper.reverse_map(body.dmn_xml, body.inference_map_id, body.source_checkpoint)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/gate")
def gate_release(body: GateIn):
    try:
        result = wrapper.gate_release(
            dmn_xml=body.dmn_xml,
            release_context=body.release_context,
            vector_payload=body.vector_payload
        )
        # Side-effect: update system state snapshot and tick counter
        system_state.tick("gate_release", result)
        system_state.save("./state/runtime/system_state.json")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/fuzzer/run")
def run_fuzz(body: FuzzIn):
    try:
        cleaned = fuzzer.clean_loose_vectors(
            vectors=body.vectors,
            cosine_threshold=body.cosine_threshold
        )
        if body.mode == "perturb":
            cleaned = fuzzer.perturb_vectors(cleaned)

        if body.consume_tokens:
            consumption = fuzzer.consume_leftover_tokens(cleaned)
        else:
            consumption = []

        # tick the system state with a “cosine phase” mark
        system_state.tick("fuzz_phase", {
            "consumed": len(consumption),
            "vectors": len(cleaned)
        })
        system_state.save("./state/runtime/system_state.json")

        return {
            "vectors": cleaned,
            "consumed_tokens": consumption
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
``
