import yaml
import json
import sys
from pathlib import Path


class MCPTestFailure(Exception):
    """Custom exception for clear test failure reporting."""
    pass


def load_yaml(path: Path):
    """
    Load the YAML file at the given path.
    Raises MCPTestFailure if missing or invalid.
    """
    if not path.exists():
        raise MCPTestFailure(f"YAML file not found: {path}")

    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception as e:
        raise MCPTestFailure(f"Failed to parse YAML at {path}: {e}")


def compute_tool_vector(tools_section):
    """
    Builds a canonical {tool_name: 1} vector from the tools[] list.
    Deterministic ordering enforced by sorted keys for consistency.
    """
    vector = {}
    for tool in tools_section:
        name = tool.get("name")
        if not name:
            raise MCPTestFailure("A tool entry is missing the required 'name' field.")
        vector[name] = 1
    return dict(sorted(vector.items()))


def assert_equal(actual, expected, message):
    """
    Deterministic equality checker.
    """
    if actual != expected:
        raise MCPTestFailure(
            f"[FAIL] {message}\n"
            f"Expected:\n{json.dumps(expected, indent=2)}\n\n"
            f"Got:\n{json.dumps(actual, indent=2)}"
        )


def validate_agent_tools(agents, canonical_vector):
    """
    Each agent must have allowed_tools identical to the canonical vector keys.
    """
    canonical_set = set(canonical_vector.keys())

    for agent in agents:
        agent_id = agent.get("id", "<missing id>")
        allowed = agent.get("allowed_tools", [])
        allowed_set = set(allowed)

        if allowed_set != canonical_set:
            raise MCPTestFailure(
                f"[FAIL] Agent '{agent_id}' allowed_tools do not match canonical tool vector.\n"
                f"Expected: {sorted(canonical_set)}\n"
                f"Got:      {sorted(allowed_set)}"
            )


def print_pass(msg):
    print(f"\033[92m✔ {msg}\033[0m")  # green


def print_fail(msg):
    print(f"\033[91m✘ {msg}\033[0m")  # red


def run_mcp_unit_test(config_path_str: str):
    """
    Run the deterministic MCP unit test suite.
    """
    config_path = Path(config_path_str)

    print("=== MCP UNIT TEST RUNNER ===")
    print(f"Loading config: {config_path}")

    # ----------------------------------------------------------------------
    # 1. Load and validate the YAML
    # ----------------------------------------------------------------------
    data = load_yaml(config_path)

    required_sections = ["tools", "capabilities", "a2a"]
    for sec in required_sections:
        if sec not in data:
            raise MCPTestFailure(f"Missing required section in YAML: '{sec}'")

    tools = data["tools"]
    capabilities = data["capabilities"]
    a2a = data["a2a"]

    # ----------------------------------------------------------------------
    # 2. Compute canonical tool_vector from the tools[] list
    # ----------------------------------------------------------------------
    recomputed_vector = compute_tool_vector(tools)

    expected_cap_vector = capabilities.get("tool_vector")
    expected_a2a_vector = a2a.get("canonical_tool_vector")

    print("Validating tool vectors...")

    assert_equal(
        recomputed_vector,
        expected_cap_vector,
        "Mismatch in capabilities.tool_vector"
    )
    assert_equal(
        recomputed_vector,
        expected_a2a_vector,
        "Mismatch in a2a.canonical_tool_vector"
    )

    print_pass("Tool vector validation passed")

    # ----------------------------------------------------------------------
    # 3. Validate A2A agent configurations
    # ----------------------------------------------------------------------
    agents = a2a.get("agents", [])
    if not agents:
        raise MCPTestFailure("a2a.agents list is empty or missing.")

    validate_agent_tools(agents, expected_a2a_vector)

    print_pass("A2A agent tool alignment passed")

    # ----------------------------------------------------------------------
    # 4. Final success
    # ----------------------------------------------------------------------
    print_pass("All MCP Unit Tests Passed Successfully!")
    return True


# --------------------------------------------------------------------------
# Script Entry Point
# --------------------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(
            "Usage: python tests/mcp_unit_test.py path/to/a2a-mcp.yaml",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        run_mcp_unit_test(sys.argv[1])
    except MCPTestFailure as e:
        print_fail(str(e))
        sys.exit(1)
    except Exception as e:
        print_fail(f"Unexpected error: {e}")
        sys.exit(1)
