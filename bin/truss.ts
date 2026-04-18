#!/usr/bin/env node
import * as path from "node:path";
import { Command } from "commander";
import { runCheck, runAnalysis } from "../src/core/engine";
import {
  renderHumanReport,
  renderJsonError,
  renderJsonReport,
} from "../src/core/reporter";
import { ExitCode } from "../src/core/types";
import { renderGraphAsDot } from "../src/graph/dotRenderer";

const program = new Command();

program
  .name("truss")
  .description("Truss: configuration-driven architectural boundary checks")
  .version("0.1.0");

program
  .command("check")
  .description("Check repository for architectural violations")
  .option("-c, --config <path>", "Path to truss.yml", "truss.yml")
  .option("--repo <path>", "Repo root", ".")
  .option("--format <format>", 'Output format: human|json', "human")
  .option(
    "--show-suppressed",
    "Print suppressed violations in full detail (human only)",
    false
  )
  .action(async (options) => {
    const format = options.format;

    try {
      const repoRoot = path.resolve(options.repo);
      const configPath = options.config;

      if (format !== "human" && format !== "json") {
        const msg = `Invalid --format value "${format}". Expected "human" or "json".`;
        console.error("Truss: Configuration error");
        console.error(msg);
        process.exitCode = ExitCode.CONFIG_ERROR;
        return;
      }

      if (format === "json" && options.showSuppressed) {
        const msg = "--show-suppressed can only be used with --format human.";
        console.log(renderJsonError(msg, ExitCode.CONFIG_ERROR));
        process.exitCode = ExitCode.CONFIG_ERROR;
        return;
      }

      const result = await runCheck({
        repoRoot,
        configPath,
        format,
        showSuppressed: Boolean(options.showSuppressed),
      });

      if ("error" in result) {
        if (format === "json") {
          console.log(renderJsonError(result.error, result.exitCode));
        } else {
          const label =
            result.exitCode === ExitCode.CONFIG_ERROR
              ? "Truss: Configuration error"
              : "Truss: Internal error";
          console.error(label);
          console.error(result.error);
        }
      } else if (format === "json") {
        console.log(renderJsonReport(result.report, result.exitCode));
      } else {
        console.log(
          renderHumanReport(result.report, {
            showSuppressed: Boolean(options.showSuppressed),
          })
        );
      }

      process.exitCode = result.exitCode;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (format === "json") {
        console.log(
          renderJsonError(`Internal error: ${message}`, ExitCode.INTERNAL_ERROR)
        );
      } else {
        console.error("Truss: Internal error");
        console.error(message);
      }
      process.exitCode = ExitCode.INTERNAL_ERROR;
    }
  });

program
  .command("graph")
  .description("Render the repository dependency graph as DOT")
  .option("-c, --config <path>", "Path to truss.yml", "truss.yml")
  .option("--repo <path>", "Repo root", ".")
  .option("--format <format>", 'Output format: dot', "dot")
  .action(async (options) => {
    const format = options.format;

    try {
      const repoRoot = path.resolve(options.repo);
      const configPath = options.config;

      if (format !== "dot") {
        const msg = `Invalid --format value "${format}". Expected "dot".`;
        console.error("Truss: Configuration error");
        console.error(msg);
        process.exitCode = ExitCode.CONFIG_ERROR;
        return;
      }

      const {
  config,
  graph,
} = runAnalysis({
  repoRoot,
  configPath,
});

      const result = await runCheck({
  repoRoot,
  configPath,
  format: "human",
  showSuppressed: false,
});

const violations =
  "report" in result
    ? result.report.unsuppressed.flatMap((v) =>
        v.edge.importKind === "internal"
          ? [
              {
                from: v.edge.fromFile,
                to: v.edge.toFile,
              },
            ]
          : []
      )
    : [];

const dot = renderGraphAsDot(graph, config.layers, violations);

      process.stdout.write(`${dot}\n`);
      process.exitCode = ExitCode.OK;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Truss: Internal error");
      console.error(message);
      process.exitCode = ExitCode.INTERNAL_ERROR;
    }
  });

program.parse(process.argv);
