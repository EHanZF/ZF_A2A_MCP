import json
from pathlib import Path
import wasmtime

DMN_JSON_PATH = Path("dmn/orchestration_decision_model.json")
WASM_PATH = Path("dmn/wasm/pkg/orchestration_dmn_wasm_bg.wasm")

def load_wasm_engine():
    engine = wasmtime.Engine()
    module = wasmtime.Module.from_file(engine, str(WASM_PATH))
    store = wasmtime.Store(engine)
    instance = wasmtime.Instance(store, module, [])
    return instance, store

INSTANCE, STORE = load_wasm_engine()
EVAL_FN = INSTANCE.get_export(STORE, "evaluate_orchestration_dmn")

def evaluate_orchestration(input_payload: dict):
    with DMN_JSON_PATH.open("r") as f:
        dmn_json = f.read()

    result_json = EVAL_FN(STORE, dmn_json, json.dumps(input_payload))
    return json.loads(result_json)
