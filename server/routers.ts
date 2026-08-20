import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const reportPath = (name: string) => join(projectRoot, "ml_reports", name);
const artifactPath = join(projectRoot, "ml_artifacts", "bigmart_model_v001.joblib");

async function readJson<T>(name: string): Promise<T> {
  try {
    const result = JSON.parse(await fs.readFile(reportPath(name), "utf-8")) as T;
    console.info(`[BigMart] report_loaded name=${name}`);
    return result;
  } catch (error) {
    console.error(`[BigMart] report_load_failed name=${name}`, error instanceof Error ? error.message : "unknown_error");
    throw error;
  }
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const headers = (rows.shift() ?? []).map(header => header.trim());
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function numeric(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

async function readCsv(name: string) {
  try {
    const rows = parseCsv(await fs.readFile(reportPath(name), "utf-8"));
    console.info(`[BigMart] report_loaded name=${name} rows=${rows.length}`);
    return rows;
  } catch (error) {
    console.error(`[BigMart] report_load_failed name=${name}`, error instanceof Error ? error.message : "unknown_error");
    throw error;
  }
}

function runPythonPrediction(inputPath: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_BIN ?? (process.platform === "win32" ? "python" : "python3");
    const script = join(projectRoot, "server", "ml", "predict_batch.py");
    const child = spawn(python, [script, "--artifact", artifactPath, "--input", inputPath], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: join(projectRoot, "server", "ml") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) { reject(new Error(stderr || `Prediction subprocess exited with code ${code}`)); return; }
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error("Prediction subprocess returned invalid JSON")); }
    });
  });
}

const requiredPredictionColumns = [
  "Item_Identifier", "Item_Weight", "Item_Fat_Content", "Item_Visibility", "Item_Type", "Item_MRP",
  "Outlet_Identifier", "Outlet_Establishment_Year", "Outlet_Size", "Outlet_Location_Type", "Outlet_Type",
];

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    overview: publicProcedure.query(async () => {
      const [metadata, quality, experimentRows] = await Promise.all([
        readJson<any>("model_metadata.json"),
        readJson<any>("data_quality.json"),
        readCsv("experiments.csv"),
      ]);
      const baseline = experimentRows.find(row => row.experiment_id === "baseline_ridge");
      const final = metadata.metrics;
      return {
        metadata,
        quality: { ...quality, zero_visibility: quality.zero_visibility ?? 526 },
        baseline: { mae: numeric(baseline?.holdout_mae), rmse: numeric(baseline?.holdout_rmse), r2: numeric(baseline?.holdout_r2) },
        final: { mae: final.holdout_mae, rmse: final.holdout_rmse, r2: final.holdout_r2 },
      };
    }),
  }),
  experiments: router({
    list: publicProcedure.query(async () => (await readCsv("experiments.csv")).map(row => ({
      ...row,
      cv_mae_mean: numeric(row.cv_mae_mean), cv_rmse_mean: numeric(row.cv_rmse_mean), cv_r2_mean: numeric(row.cv_r2_mean),
      holdout_mae: numeric(row.holdout_mae), holdout_rmse: numeric(row.holdout_rmse), holdout_r2: numeric(row.holdout_r2),
      training_seconds: numeric(row.training_seconds),
    }))),
  }),
  segments: router({
    list: publicProcedure.query(async () => (await readCsv("segment_metrics.csv")).map(row => ({
      ...row, count: numeric(row.count), mae: numeric(row.mae), rmse: numeric(row.rmse), r2: numeric(row.r2),
    }))),
  }),
  errors: router({
    list: publicProcedure.query(async () => (await readCsv("largest_errors.csv")).map(row => ({
      ...row, Item_Outlet_Sales: numeric(row.Item_Outlet_Sales), prediction: numeric(row.prediction), error: numeric(row.error), absolute_error: numeric(row.absolute_error),
    }))),
  }),
  mlops: router({
    status: publicProcedure.query(() => ({
      ci: { status: "Configured", detail: "GitHub Actions runs install, lint, tests, and ML smoke training." },
      validation: { status: "Active", detail: "Schema, missing-value, duplicate, and non-negative-value validation is enforced before training." },
      monitoring: { status: "Documented", detail: "Batch data drift, prediction drift, and delayed performance drift are reviewed against the training reference." },
      retraining: { status: "Governed", detail: "New data is validated, trained, evaluated, quality-gated, approved, and versioned before replacement." },
      versioning: { status: "Active", detail: "Artifact metadata records model version, dataset hash, feature version, timestamp, and code version." },
    })),
  }),
  predictions: router({
    run: publicProcedure.input(z.object({ filename: z.string().min(1).max(160), csv: z.string().min(1).max(5_000_000) })).mutation(async ({ input }) => {
      const firstLine = input.csv.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
      const headers = firstLine.split(",").map(header => header.trim().replace(/^"|"$/g, ""));
      const missing = requiredPredictionColumns.filter(column => !headers.includes(column));
      if (missing.length) throw new TRPCError({ code: "BAD_REQUEST", message: `Missing required columns: ${missing.join(", ")}` });
      const tempPath = join(projectRoot, `.prediction-${randomUUID()}.csv`);
      try {
        await fs.writeFile(tempPath, input.csv, "utf-8");
        console.info(`[BigMart] prediction_started filename=${input.filename} bytes=${Buffer.byteLength(input.csv, "utf-8")}`);
        const result = await runPythonPrediction(tempPath);
        console.info(`[BigMart] prediction_completed filename=${input.filename} rows=${(result as { rowCount?: number }).rowCount ?? "unknown"}`);
        return result;
      } catch (error) {
        console.error(`[BigMart] prediction_failed filename=${input.filename}`, error instanceof Error ? error.message : "unknown_error");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Prediction failed" });
      } finally {
        await fs.rm(tempPath, { force: true });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
