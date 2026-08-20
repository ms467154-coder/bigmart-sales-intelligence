from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import joblib
import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    artifact = joblib.load(args.artifact)
    estimator = artifact["estimator"]
    metadata = artifact["metadata"]
    frame = pd.read_csv(args.input)
    predictions = estimator.predict(frame)
    preview = frame.head(50).copy()
    preview["prediction"] = predictions[: len(preview)]
    print(json.dumps({
        "rowCount": int(len(frame)),
        "preview": preview.to_dict(orient="records"),
        "predictionSummary": {
            "mean": float(predictions.mean()),
            "median": float(pd.Series(predictions).median()),
            "minimum": float(predictions.min()),
            "maximum": float(predictions.max()),
        },
        "modelVersion": metadata.get("model_version", "unknown"),
    }, default=str))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        raise
