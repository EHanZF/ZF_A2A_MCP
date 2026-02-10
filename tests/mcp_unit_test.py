import yaml
import json
import sys
from pathlib import Path


class MCPTestFailure(Exception):
    """Custom exception for clear test failure reporting."""
    pass


def load_yaml(path: Path):
    if not path.exists():
        raise MCPTestFailure(f"YAML file not found: {path}")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception as e:
        raise MCPTestFailure(f"Failed to parse YAML: {e}")


def compute_tool_vector(tools_section):
    """
    Deterministically recompute the tool vector based on names in `tools:`.
    """
    vec = {}
    for tool in tools_section:
        name = tool.get("name")
        if not name:
            raise MCPTestFailure("Tool entry missing required 'name' field.")
        vec[name] = 1
    return vec


def assert_equal(a, b, label):
    if a != b:
        raise MCPTestFailure(
            f"[FAIL] {label} mismatch:\nExpected: {json.dumps(b, indent=2)}\nGot:      {json.dumps(a, indent=2)}"
        )


def validate_agent_tools(agents, canonical_vector):
    for agent in agents:
        agent_id = agent.get("id")
        allowed = agent.get("allowed_tools", [])
        allowed_set = set(allowed)
        canonical_set = set(canonical_vector.keys())

        if allowed_set != canonical_set:
            raise MCPTestFailure(
                f"[FAIL] Agent '{agent_id}' allowed_tools mismatch.\n"
                f"Expected: {sorted(canonical_set)}\n"
                f"Got:      {sorted(allowed_set)}"
            )


def print_pass(msg):
    print(f"\033[92m✔ {msg}\033[0m")  # green


def print_fail(msg):
    print(f"\033[91m✘ {msg}\033[0m")  # red


def run_mcp_unit_test(config_path: str):
    config_path = Path(config_path)

    print("=== MCP UNIT TEST RUNNER ===")
    print(f"Loading config: {config_path}")

    data = load_yaml(config_path)

    # ---- Validate required sections -----------------------------------------
    for section in ["tools", "capabilities", "a2a"]:
        if section not in data:
            raise MCPTestFailure(f"Missing required section: '{section}'")

    tools = data["tools"]
    capabilities = data["capabilities"]
    a2a = data["a2a"]

    # ---- Recompute tool vector ----------------------------------------------
    recomputed_vector = compute_tool_vector(tools)

    expected_cap_vector = capabilities.get("tool_vector")
    expected_a2a_vector = a2a.get("canonical_tool_vector")

    print("Validating tool vectors...")

    assert_equal(recomputed_vector, expected_cap_vector, "capabilities.tool_vector")
    assert_equal(recomputed_vector, expected_a2a_vector, "a2a.canonical_tool_vector")

    print_pass("Tool vector validation passed.")

    # ---- Validate A2A agent configurations -----------------------------------
    agents = a2a.get("agents", [])
    if not agents:
        raise MCPTestFailure("a2a.agents is empty or missing.")

    validate_agent_tools(agents, expected_a2a_vector)

    print_pass("A2A agent tool alignment passed.")

    # ---- Final PASS ----------------------------------------------------------
    print_pass("All MCP Unit Tests Passed Successfully!")
    return True


# ------------------------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python mcp_unit_test.py path/to/a2a-mcp.yaml")
        sys.exit(1)

    try:
        run_mcp_unit_test(sys.argv[1])
    except MCPTestFailure as e:
        print_fail(str(e))
        sys.exit(1)
    except Exception as e:
        print_fail(f"Unexpected error: {e}")
        sys.exit(1)
