#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("node:path");
const commander_1 = require("commander");
const configLoader_1 = require("../src/config/configLoader");
const errors_1 = require("../src/utils/errors");
const engine_1 = require("../src/core/engine");
const reporter_1 = require("../src/core/reporter");
const types_1 = require("../src/core/types");
const program = new commander_1.Command();
program
    .name("truss")
    .description("Truss: configuration-driven architectural boundary checks")
    .version("0.1.0");
program
    .command("check")
    .description("Check repository for architectural violations")
    .option("-c, --config <path>", "Path to truss.yml", "truss.yml")
    .option("--repo <path>", "Repo root", ".")
    .option("--format <format>", "Output format: human|json", "human")
    .option("--show-suppressed", "Print suppressed violations in full detail (human only)", false)
    .action(async (options) => {
    const repoRoot = path.resolve(options.repo);
    const configPath = options.config;
    const format = options.format;
    if (format !== "human" && format !== "json") {
        const msg = `Invalid --format value "${format}". Expected "human" or "json".`;
        console.error("Truss: Configuration error");
        console.error(msg);
        process.exitCode = types_1.ExitCode.CONFIG_ERROR;
        return;
    }
    if (format === "json" && options.showSuppressed) {
        const msg = "--show-suppressed can only be used with --format human.";
        console.log((0, reporter_1.renderJsonError)(msg, types_1.ExitCode.CONFIG_ERROR));
        process.exitCode = types_1.ExitCode.CONFIG_ERROR;
        return;
    }
    // Preflight config errors so users get a clear exit=2 message.
    try {
        (0, configLoader_1.loadTrussConfig)(path.resolve(repoRoot, configPath), configPath);
    }
    catch (e) {
        const msg = e instanceof errors_1.ConfigError
            ? e.message
            : `Failed to load config: ${e.message}`;
        if (format === "json") {
            console.log((0, reporter_1.renderJsonError)(msg, types_1.ExitCode.CONFIG_ERROR));
        }
        else {
            console.error("Truss: Configuration error");
            console.error(msg);
        }
        process.exitCode = types_1.ExitCode.CONFIG_ERROR;
        return;
    }
    const result = await (0, engine_1.runCheck)({
        repoRoot,
        configPath,
        format,
        showSuppressed: Boolean(options.showSuppressed),
    });
    if ("error" in result) {
        if (format === "json") {
            console.log((0, reporter_1.renderJsonError)(result.error, result.exitCode));
        }
        else {
            const label = result.exitCode === types_1.ExitCode.CONFIG_ERROR
                ? "Truss: Configuration error"
                : "Truss: Internal error";
            console.error(label);
            console.error(result.error);
        }
    }
    else if (format === "json") {
        console.log((0, reporter_1.renderJsonReport)(result.report, result.exitCode));
    }
    else {
        console.log((0, reporter_1.renderHumanReport)(result.report, {
            showSuppressed: Boolean(options.showSuppressed),
        }));
    }
    process.exitCode = result.exitCode;
});
program.parse(process.argv);
