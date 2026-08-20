from __future__ import annotations

from sklearn.dummy import DummyRegressor
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge


def model_factory(name: str, seed: int = 42, params: dict | None = None):
    params = dict(params or {})
    if name == "dummy":
        return DummyRegressor(strategy="mean")
    if name == "ridge":
        return Ridge(alpha=params.pop("alpha", 10.0), **params)
    if name == "random_forest":
        return RandomForestRegressor(random_state=seed, **({"n_estimators": 180, "max_depth": 10, "min_samples_leaf": 3, "n_jobs": -1} | params))
    if name == "hist_gradient_boosting":
        return HistGradientBoostingRegressor(random_state=seed, **({"max_iter": 250, "learning_rate": 0.05, "max_leaf_nodes": 31, "l2_regularization": 0.1} | params))
    if name == "xgboost":
        try:
            from xgboost import XGBRegressor
        except ImportError as exc:
            raise ImportError("xgboost is optional; install the xgboost extra to run this candidate") from exc
        return XGBRegressor(objective="reg:squarederror", random_state=seed, n_jobs=-1, **({"n_estimators": 250, "learning_rate": 0.04, "max_depth": 4, "subsample": 0.85, "colsample_bytree": 0.85} | params))
    raise ValueError(f"Unknown model: {name}")
