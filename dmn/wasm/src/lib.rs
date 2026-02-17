use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

// -----------------------------
// DMN STRUCTURES
// -----------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct DMNModel {
    #[serde(rename = "dmn-model")]
    pub dmn_model: Value
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DMNInput {
    pub systemStatus: String,
    pub requestType: String,
    pub skillCategory: String,
    pub securityLevel: String,
    pub agentLoad: String,
    pub contextComplexity: String
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DMNResult {
    pub route: String,
    pub policy: String,
    pub capacity: String,
    pub plan: String,
    pub action: String
}

// -----------------------------
// EXPORTS
// -----------------------------

#[wasm_bindgen]
pub fn evaluate_orchestration_dmn(dmn_json: &str, input_json: &str) -> String {
    let model: DMNModel = serde_json::from_str(dmn_json).unwrap();
    let input: DMNInput = serde_json::from_str(input_json).unwrap();

    let decisions = model.dmn_model["decisions"].as_array().unwrap();

    let mut route = "reject".to_string();
    let mut policy = "deny".to_string();
    let mut capacity = "heavy".to_string();
    let mut plan = "deny".to_string();
    let mut action = "stop".to_string();

    // -----------------------------
    // REQUEST ROUTING
    // -----------------------------
    for d in decisions {
        if d["id"] == "dec-requestRouting" {
            for rule in d["rules"].as_array().unwrap() {
                let sys = rule[0].as_str().unwrap();
                let req = rule[1].as_str().unwrap();

                if (sys == input.systemStatus || sys == "-")
                    && (req == input.requestType || req == "-")
                {
                    route = rule[2].as_str().unwrap().to_string();
                    break;
                }
            }
        }
    }

    // -----------------------------
    // SKILL POLICY
    // -----------------------------
    for d in decisions {
        if d["id"] == "dec-skillPolicy" {
            for rule in d["rules"].as_array().unwrap() {
                let category = rule[0].as_str().unwrap();
                let sec = rule[1].as_str().unwrap();

                if (category == input.skillCategory || category == "-")
                    && (sec == input.securityLevel || sec == "-")
                {
                    policy = rule[2].as_str().unwrap().to_string();
                    break;
                }
            }
        }
    }

    // -----------------------------
    // AGENT CAPACITY
    // -----------------------------
    for d in decisions {
        if d["id"] == "dec-agentCapacity" {
            for rule in d["rules"].as_array().unwrap() {
                let load = rule[0].as_str().unwrap();
                let ctx = rule[1].as_str().unwrap();

                if (load == input.agentLoad || load == "-")
                    && (ctx == input.contextComplexity || ctx == "-")
                {
                    capacity = rule[2].as_str().unwrap().to_string();
                    break;
                }
            }
        }
    }

    // -----------------------------
    // ORCHESTRATION PLAN
    // -----------------------------
    for d in decisions {
        if d["id"] == "dec-orchestrationPlan" {
            for rule in d["rules"].as_array().unwrap() {
                let r = rule[0].as_str().unwrap();
                let p = rule[1].as_str().unwrap();
                let c = rule[2].as_str().unwrap();

                if (r == route || r == "-")
                    && (p == policy || p == "-")
                    && (c == capacity || c == "-")
                {
                    plan = rule[3].as_str().unwrap().to_string();
                    action = rule[4].as_str().unwrap().to_string();
                    break;
                }
            }
        }
    }

    serde_json::json!(DMNResult {
        route,
        policy,
        capacity,
        plan,
        action
    }).to_string()
}
