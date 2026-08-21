# Contributing to BigMart Sales Intelligence

Thank you for contributing. This repository values reproducibility, honest evaluation, and focused product changes over cosmetic metric improvements.

## Development flow

Create a focused branch, install the JavaScript and ML dependencies, and run the local dashboard before changing behavior. Keep frontend changes in `client/`, typed backend contracts in `server/`, and artifact-compatible Python changes in `server/ml/`.

Before opening a pull request, run:

```bash
pnpm check
pnpm test
pnpm run build
```

If a change modifies the model artifact, feature logic, or reports, include the exact command used to regenerate the artifact and explain how the dataset identity and evaluation boundary were preserved.

## Pull requests

Pull requests should describe the user-visible change, the files affected, validation performed, and any known limitations. Do not commit secrets, local `.env` files, transient prediction CSVs, Python caches, or generated build directories. Do not use target-derived features that cross the holdout boundary.

For interface changes, include a short note on desktop and mobile behavior. For model changes, report MAE, RMSE, and R² on both cross-validation and the untouched holdout when applicable.
