#!/usr/bin/env node

/**
 * test-fuzz-locally.js
 *
 * Local simulation of the branch.fuzz_and_test workflow.
 * Allows developers to test fuzz logic before pushing to GitHub Actions.
 *
 * Usage:
 *   node test-fuzz-locally.js [--branch feature/xyz] [--no-commit]
 */

import { fuzzBranchDiffs } from "./Agents/ci-agent/fuzzBranchDiffs.js";
import { Command } from "commander";
import chalk from "chalk";

const program = new Command();

program
  .name("test-fuzz-locally")
  .description("Locally simulate branch fuzz testing before GHA execution")
  .option("--branch <name>", "Branch to fuzz (default: current)")
  .option("--base <name>", "Base branch to compare against (default: main)")
  .option("--no-commit", "Skip commit/PR creation")
  .option("--verbose", "Verbose output")
  .parse(process.argv);

const options = program.opts();

async function main() {
  console.log(chalk.bold.blue("\n🧪 Starting Local Fuzz Test Simulation\n"));

  try {
    const result = await fuzzBranchDiffs({
      branch: options.branch,
      baseBranch: options.base || "main",
      generateTests: true,
      autoCommit: !options.noCommit,
    });

    // Display results in a formatted manner
    console.log(chalk.bold.cyan(`\n📊 Fuzz Test Results\n`));
    console.log(chalk.gray(`Branch: ${result.branch}`));
    console.log(chalk.gray(`Base: ${result.baseBranch}\n`));

    console.log(chalk.bold(`Diff Summary:`));
    console.log(`  Files Changed: ${result.diffSummary.filesChanged}`);
    console.log(`  Insertions: +${result.diffSummary.insertions}`);
    console.log(`  Deletions: -${result.diffSummary.deletions}`);

    if (options.verbose && result.diffSummary.changedFiles.length > 0) {
      console.log(chalk.gray(`  Changed files:`));
      result.diffSummary.changedFiles.forEach((f) => {
        console.log(chalk.gray(`    - ${f}`));
      });
    }

    console.log(chalk.bold(`\n🧬 Fuzz Tests Generated:`));
    console.log(`  ${result.fuzzTestsGenerated} new test files created`);

    console.log(chalk.bold(`\n✅ Test Results:`));
    console.log(
      `  Passed: ${chalk.green(result.testResults.passed)} ✓`
    );
    console.log(
      `  Failed: ${chalk.red(result.testResults.failed)} ✗`
    );
    console.log(
      `  Skipped: ${chalk.yellow(result.testResults.skipped)} ⏭️`
    );
    console.log(`  Coverage: ${chalk.cyan(result.testResults.coverage.toFixed(2))}%`);

    console.log(chalk.bold(`\n🔍 Workflow Validation:`));
    console.log(`  Issues: ${result.workflowValidation.issues}`);
    if (result.workflowValidation.warnings.length > 0) {
      result.workflowValidation.warnings.forEach((w) => {
        console.log(chalk.yellow(`  ⚠️  ${w}`));
      });
    }

    console.log(chalk.bold(`\n📝 PR Status: ${chalk.cyan(result.prStatus)}`));
    if (result.prUrl) {
      console.log(`  URL: ${chalk.underline(result.prUrl)}`);
    }

    // Summary and recommendations
    console.log(chalk.bold.cyan(`\n📋 Summary\n`));

    const allPassed = result.testResults.failed === 0;
    const noWorkflowIssues = result.workflowValidation.issues === 0;
    const readyForPR = allPassed && noWorkflowIssues;

    if (readyForPR) {
      console.log(
        chalk.green(
          "✅ All checks passed! This branch is ready for merge."
        )
      );
    } else {
      console.log(chalk.yellow("⚠️  Review the issues above before merging:"));
      if (!allPassed) {
        console.log(
          chalk.red(
            `   - ${result.testResults.failed} test(s) failed`
          )
        );
      }
      if (!noWorkflowIssues) {
        console.log(
          chalk.red(
            `   - ${result.workflowValidation.issues} workflow issue(s) detected`
          )
        );
      }
    }

    if (!options.noCommit && readyForPR) {
      console.log(chalk.green("\n✅ PR has been created/updated on GitHub"));
    } else if (!options.noCommit) {
      console.log(chalk.yellow("\n⚠️  PR creation skipped (--no-commit or tests failed)"));
    }

    console.log(chalk.gray("\nℹ️  Run with --verbose for detailed file listings\n"));
    process.exit(readyForPR ? 0 : 1);
  } catch (error) {
    console.error(chalk.red(`\n❌ Fuzz test failed:\n`), error.message);
    process.exit(1);
  }
}

main();
