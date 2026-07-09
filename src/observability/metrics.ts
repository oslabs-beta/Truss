import { metrics } from "@opentelemetry/api";
import {
  ConsoleMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";

let meterProvider: MeterProvider | null = null;

export function initTelemetry(): void {
  if (process.env.TRUSS_OTEL_CONSOLE !== "1") {
    return;
  }

  const exporter = new ConsoleMetricExporter();

  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 1000,
  });

  meterProvider = new MeterProvider({
    readers: [reader],
  });

  metrics.setGlobalMeterProvider(meterProvider);
}

export async function shutdownTelemetry(): Promise<void> {
  if (!meterProvider) {
    return;
  }

  await meterProvider.shutdown();
  meterProvider = null;
}

export function recordAnalysisMetrics(input: {
  durationMs: number;
  checkedFiles: number;
  dependencyEdges: number;
  violations: number;
  diagnostics: number;
}): void {
  const meter = metrics.getMeter("truss");

  const duration = meter.createHistogram("truss.analysis.duration_ms", {
    description: "Duration of a Truss analysis run in milliseconds",
    unit: "ms",
  });

  const filesScanned = meter.createCounter("truss.files.scanned", {
    description: "Number of source files scanned during analysis",
  });

  const dependencyEdges = meter.createCounter("truss.dependency_edges.count", {
    description: "Number of dependency edges detected during analysis",
  });

  const violations = meter.createCounter("truss.violations.count", {
    description: "Number of unsuppressed architecture violations detected",
  });

  const diagnostics = meter.createCounter("truss.diagnostics.count", {
    description: "Number of diagnostics produced during analysis",
  });

  duration.record(input.durationMs);
  filesScanned.add(input.checkedFiles);
  dependencyEdges.add(input.dependencyEdges);
  violations.add(input.violations);
  diagnostics.add(input.diagnostics);
}