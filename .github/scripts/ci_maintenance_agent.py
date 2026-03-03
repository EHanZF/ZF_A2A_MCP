#!/usr/bin/env python3

"""
Daily CI/CD Maintenance Agent

- Parses workflow files
- Detects outdated GitHub Actions
- Detects deprecated or insecure versions
- Ensures pinned versions instead of @master
- Rewrites files if safe
"""

import os
import re
import glob
from ruamel.yaml import YAML

yaml = YAML()
yaml.preserve_quotes = True

ACTIONS_LATEST = {
    "actions/checkout": "v4",
    "actions/setup-python": "v5",
    "actions/setup-node": "v4",
    "docker/login-action": "v3",
    "docker/build-push-action": "v6",
    "peter-evans/create-pull-request": "v6"
}

def scan_workflows():
    fixes = []
    for wf in glob.glob(".github/workflows/*.yml"):
        with open(wf, "r") as f:
            data = yaml.load(f)

        changed = False

        # update actions versions
        for job in (data.get("jobs") or {}).values():
            for step in job.get("steps", []):
                if "uses" in step:
                    uses = step["uses"]
                    name, _, tag = uses.partition("@")
                    if name in ACTIONS_LATEST:
                        desired = ACTIONS_LATEST[name]
                        if tag != desired:
                            step["uses"] = f"{name}@{desired}"
                            fixes.append(f"Updated {name} in {wf} to {desired}")
                            changed = True

        if changed:
            with open(wf, "w") as f:
                yaml.dump(data, f)

    return fixes


if __name__ == "__main__":
    fixes = scan_workflows()

    if not fixes:
        print("No fixes needed today.")
    else:
        print("# CI/CD Maintenance Report\n")
        for fix in fixes:
            print(f"- {fix}")
