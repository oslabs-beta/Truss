#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const commander_1 = require("commander");
const engine_1 = require("../src/core/engine");
const reporter_1 = require("../src/core/reporter");
const types_1 = require("../src/core/types");
const dotRenderer_1 = require("../src/graph/dotRenderer");
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
    .option("--format <format>", 'Output format: human|json', "human")
    .option("--show-suppressed", "Print suppressed violations in full detail (human only)", false)
    .action(async (options) => {
    const format = options.format;
    try {
        const repoRoot = path.resolve(options.repo);
        const configPath = options.config;
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (format === "json") {
            console.log((0, reporter_1.renderJsonError)(`Internal error: ${message}`, types_1.ExitCode.INTERNAL_ERROR));
        }
        else {
            console.error("Truss: Internal error");
            console.error(message);
        }
        process.exitCode = types_1.ExitCode.INTERNAL_ERROR;
    }
});
program
    .command("init")
    .description("Create a starter truss.yml in the current project")
    .option("--force", "Overwrite existing truss.yml", false)
    .action(async (options) => {
    try {
        const repoRoot = process.cwd();
        const configPath = path.join(repoRoot, "truss.yml");
        if (fs.existsSync(configPath) && !options.force) {
            console.error("Truss: Configuration error");
            console.error('truss.yml already exists. Use "truss-lint init --force" to overwrite it.');
            process.exitCode = types_1.ExitCode.CONFIG_ERROR;
            return;
        }
        const starterConfig = `version: "1"

layers:
  app:
    - "**/*.ts"
    - "**/*.tsx"
    - "**/*.js"
    - "**/*.jsx"

rules: []
`;
        fs.writeFileSync(configPath, starterConfig, "utf8");
        console.log("Truss: Created truss.yml");
        console.log('Run "truss-lint check" to analyze your project.');
        process.exitCode = types_1.ExitCode.OK;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Truss: Internal error");
        console.error(message);
        process.exitCode = types_1.ExitCode.INTERNAL_ERROR;
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
            process.exitCode = types_1.ExitCode.CONFIG_ERROR;
            return;
        }
        const { config, graph, } = (0, engine_1.runAnalysis)({
            repoRoot,
            configPath,
        });
        const result = await (0, engine_1.runCheck)({
            repoRoot,
            configPath,
            format: "human",
            showSuppressed: false,
        });
        const violations = "report" in result
            ? result.report.unsuppressed.flatMap((v) => v.edge.importKind === "internal"
                ? [
                    {
                        from: v.edge.fromFile,
                        to: v.edge.toFile,
                    },
                ]
                : [])
            : [];
        const dot = (0, dotRenderer_1.renderGraphAsDot)(graph, config.layers, violations);
        process.stdout.write(`${dot}\n`);
        process.exitCode = types_1.ExitCode.OK;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Truss: Internal error");
        console.error(message);
        process.exitCode = types_1.ExitCode.INTERNAL_ERROR;
    }
});
program.parse(process.argv);
