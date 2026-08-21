# BigMart Sales Intelligence

> A polished ML control room for retail sales forecasting, model evaluation, batch inference, and lightweight MLOps governance.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827)](https://react.dev/) [![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/) [![Tests](https://img.shields.io/badge/tests-4%20passing-2E8B57)](#quality-gates) [![License](https://img.shields.io/badge/license-MIT-111827)](LICENSE)

BigMart Sales Intelligence turns a reproducible retail regression workflow into an evidence-led dashboard. The application presents the trained Ridge artifact, reports experiment results, exposes segment-level performance, supports offline batch prediction through a Python subprocess, and documents the model lifecycle without pretending to provide real-time serving or production latency monitoring.

**Live dashboard:** [bigmartsale-adoemf6i.manus.space](https://bigmartsale-adoemf6i.manus.space)

## Product surface

| Area | What it provides |
| --- | --- |
| Overview | Artifact-backed **R²**, **MAE**, and **RMSE** cards, baseline-versus-final comparison, data quality summary, and model provenance. |
| Experiment tracker | Sortable `experiments.csv` registry for all five model candidates across cross-validation and holdout metrics. |
| Segment performance | MAE, RMSE, and R² bar charts for `Outlet_Type`, `Outlet_Location_Type`, `Outlet_Size`, and `Item_Type`. |
| Batch prediction | CSV upload validated against the feature schema and scored by the serialized Ridge pipeline through a Python subprocess. |
| Error analysis | Largest prediction errors with item/outlet context and a signed residual distribution. |
| MLOps status | Drift strategy, retraining policy, artifact versioning, validation gates, and CI/CD status. |

## Current model snapshot

The dashboard reads the committed artifact metadata rather than duplicating metrics in frontend code. The current holdout snapshot is:

| Metric | Final Ridge pipeline |
| --- | ---: |
| R² | 0.5968 |
| MAE | 719.81 |
| RMSE | 1,046.86 |

The source dataset contains **8,523 rows**. The reported quality summary includes **17.17% missing `Item_Weight`**, **28.28% missing `Outlet_Size`**, and **526 zero-visibility records**. The project preserves the dataset SHA-256 in the artifact metadata and displays it in both the data quality and model provenance panels.

## Architecture

```text
                 ┌───────────────────────────┐
                 │ React + Tailwind dashboard │
                 │ metrics · charts · tables  │
                 └─────────────┬─────────────┘
                               │ tRPC
                 ┌─────────────▼─────────────┐
                 │ Express + tRPC procedures  │
                 │ reports · validation · log │
                 └───────┬─────────────┬──────┘
                         │             │
              ┌──────────▼──────┐  ┌───▼────────────────┐
              │ Versioned CSV / │  │ Python subprocess  │
              │ JSON reports     │  │ Ridge artifact     │
              └─────────────────┘  └────────────────────┘
```

The frontend is a React 19 application using the provided tRPC client and reusable shadcn/ui primitives. The server exposes typed procedures for report access and batch prediction. The prediction procedure writes a size-capped temporary CSV, validates required columns, invokes `server/ml/predict_batch.py`, returns a preview and summary, logs lifecycle events without logging row contents, and removes the temporary file in a `finally` block.

## Repository layout

```text
client/                  React dashboard and design system
server/                  tRPC procedures, auth, tests, and Python bridge
server/ml/               Artifact-compatible Python modules and subprocess entrypoint
ml_artifacts/            Versioned serialized model artifact
ml_reports/              Metrics, segment, error, quality, and metadata reports
requirements-ml.txt      Reproducible Python runtime dependencies
Dockerfile               Node + Python production image for batch inference
configs/                 Project configuration when present
todo.md                  Implementation and validation history
```

## Local development

### Prerequisites

Use Node.js 22+, pnpm 10+, and Python 3.11 or newer. Install the JavaScript dependencies with:

```bash
pnpm install
```

Install the ML runtime used by the batch subprocess:

```bash
python3 -m pip install -r requirements-ml.txt
```

Start the development server:

```bash
pnpm dev
```

The dashboard is then available from the local preview URL printed by the project runtime.

### Quality gates

Run the same checks used before delivery:

```bash
pnpm check
pnpm test
pnpm run build
```

The test suite covers the existing authentication contract, dashboard metric/data-quality contracts, invalid batch schema rejection, and a successful end-to-end Ridge artifact invocation through the Python subprocess. The production build compiles both the Vite frontend and the Express server bundle.

## Batch prediction contract

Upload a CSV containing the trained feature columns below. The target column is not required for inference.

```text
Item_Identifier
Item_Weight
Item_Fat_Content
Item_Visibility
Item_Type
Item_MRP
Outlet_Identifier
Outlet_Establishment_Year
Outlet_Size
Outlet_Location_Type
Outlet_Type
```

The backend enforces a 5 MB input limit and returns the row count, model version, prediction summary, and a first-50-row preview. The runtime uses the artifact in `ml_artifacts/bigmart_model_v001.joblib`; it does not retrain from uploaded data.

## MLOps approach

This repository uses a deliberately proportionate operating model. Data validation checks schema, missingness, duplicates, and invalid numeric values before training. Candidate experiments are stored in a registry, artifacts carry dataset and feature identity, and promotion requires evaluation against the existing reference. Monitoring is designed for batch workflows: data drift, prediction drift, and delayed performance drift are reviewed against the training reference. Retraining is a governed action, not an automatic response to one noisy batch.

The root `Dockerfile` installs Node and Python in the same production image so the requested subprocess-backed inference path remains available after deployment. The container runs the standard `pnpm run build` and starts with `node dist/index.js`; no secret values are committed to the repository.

## Design direction

The interface follows a warm editorial control-room system: cream paper surfaces, ink-black typography, muted cranberry signal accents, a high-contrast serif for narrative headings, and a mono pairing for metrics, artifact IDs, tables, and provenance. The visual hierarchy is intentionally calm so model evidence remains easier to scan than decorative chrome.

## Responsible interpretation

An R² above 0.80 is not asserted because it could only be reached here through target leakage or unavailable historical drivers. The dashboard reports the measured artifact performance and keeps the validation boundary visible. Stronger future performance should come from legitimate feature additions such as historical sales, time, promotions, inventory, pricing changes, or additional outlet context.

## License

This project is released under the MIT License. See [LICENSE](LICENSE).
