import { describe, it, expect } from "vitest";
import { cat5_system_release_process } from "../cat5_system_release_process";
import { Cat5ReleaseGateInput } from "../../../../types/cat5_system_release";

describe("cat5_system_release_process", () => {

  it("produces PASS for perfect evidence", async () => {
    const input: Cat5ReleaseGateInput = {
      program: "C121",
      workflow: "C121",
      airgap: "C121_BIN",
      release_id: "C121_S004_CAT5",

      tsr_verdict: "PASS",
      tsr_id: "TSR_001",

      dvr_status: "APPROVED",

      open_defects_summary: { critical: 0, major: 0, minor: 0 },

      safety_coverage: "CONFIRMED",
      requirements_coverage: "CONFIRMED"
    };

    const out = await cat5_system_release_process(input);

    expect(out.verdict).toBe("PASS");
    expect(out.cat5_decision.decision).toBe("ALLOW");
  });


  it("fails on critical defects", async () => {
    const input: Cat5ReleaseGateInput = {
      program: "C121",
      workflow: "C121",
      airgap: "C121_BIN",
      release_id: "C121_S004_CAT5",

      tsr_verdict: "PASS",
      tsr_id: "TSR_001",

      dvr_status: "APPROVED",

      open_defects_summary: { critical: 1, major: 0, minor: 0 },

      safety_coverage: "CONFIRMED",
      requirements_coverage: "CONFIRMED"
    };

    const out = await cat5_system_release_process(input);

    expect(out.verdict).toBe("FAIL");
    expect(out.cat5_decision.decision).toBe("BLOCK");
  });


  it("flags PASS_WITH_CONDITIONS for minor defects", async () => {
    const input: Cat5ReleaseGateInput = {
      program: "C121",
      workflow: "C121",
      airgap: "C121_BIN",
      release_id: "C121_S004_CAT5",

      tsr_verdict: "PASS",
      tsr_id: "TSR_001",

      dvr_status: "APPROVED",

      open_defects_summary: { critical: 0, major: 0, minor: 2 },

      safety_coverage: "CONFIRMED",
      requirements_coverage: "CONFIRMED"
    };

    const out = await cat5_system_release_process(input);

    expect(out.verdict).toBe("PASS_WITH_CONDITIONS");
    expect(out.cat5_decision.decision).toBe("ALLOW_WITH_CONDITIONS");
  });


  it("fails on TSR FAIL", async () => {
    const input: Cat5ReleaseGateInput = {
      program: "P768",
      workflow: "P768",
      airgap: "P768_BIN",
      release_id: "P768_S100_CAT5",

      tsr_verdict: "FAIL",
      tsr_id: "TSR_999",

      dvr_status: "APPROVED",

      open_defects_summary: { critical: 0, major: 0, minor: 0 },

      safety_coverage: "CONFIRMED",
      requirements_coverage: "CONFIRMED"
    };

    const out = await cat5_system_release_process(input);

    expect(out.verdict).toBe("FAIL");
  });


  it("detects context mismatch", async () => {
    const input: Cat5ReleaseGateInput = {
      program: "C121",
      workflow: "C121",
      airgap: "P768_BIN", // WRONG for program C121
      release_id: "C121_S004_CAT5",

      tsr_verdict: "PASS",
      tsr_id: "TSR_001",

      dvr_status: "APPROVED",

      open_defects_summary: { critical: 0, major: 0, minor: 0 },

      safety_coverage: "CONFIRMED",
      requirements_coverage: "CONFIRMED"
    };

    const out = await cat5_system_release_process(input);

    expect(out.verdict).toBe("FAIL");
    expect(out.detected_context_mismatch).toBe(true);
  });

});
