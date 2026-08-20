from __future__ import annotations

import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler

from .features import BigMartFeatureEngineer


NUMERIC_COLUMNS = [
    "Item_Weight", "Item_Visibility", "Item_MRP", "Outlet_Establishment_Year",
    "Item_ID_Number", "Outlet_Age", "Item_Visibility_Is_Zero", "Item_Visibility_Log",
]
CATEGORICAL_COLUMNS = [
    "Item_Fat_Content", "Item_Type", "Outlet_Identifier", "Outlet_Size",
    "Outlet_Location_Type", "Outlet_Type", "Item_ID_Prefix", "Item_MRP_Band",
    "MRP_x_Outlet_Type", "MRP_x_Item_Type",
]
DROP_COLUMNS = ["Item_Identifier", "Item_Outlet_Sales"]
BASE_NUMERIC_COLUMNS = ["Item_Weight", "Item_Visibility", "Item_MRP", "Outlet_Establishment_Year"]
BASE_CATEGORICAL_COLUMNS = ["Item_Fat_Content", "Item_Type", "Outlet_Identifier", "Outlet_Size", "Outlet_Location_Type", "Outlet_Type"]


def make_preprocessor(improved: bool = True) -> Pipeline:
    if not improved:
        numeric = Pipeline([("imputer", SimpleImputer(strategy="mean")), ("scaler", RobustScaler())])
        categorical = Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))])
        return Pipeline([
            ("columns", ColumnTransformer([
                ("numeric", numeric, BASE_NUMERIC_COLUMNS),
                ("categorical", categorical, BASE_CATEGORICAL_COLUMNS),
            ], remainder="drop")),
        ])
    numeric = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", RobustScaler()),
    ])
    categorical = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    transformer = ColumnTransformer([
        ("numeric", numeric, NUMERIC_COLUMNS),
        ("categorical", categorical, CATEGORICAL_COLUMNS),
    ], remainder="drop")
    return Pipeline([
        ("features", BigMartFeatureEngineer()),
        ("drop_columns", ColumnDropper(DROP_COLUMNS)),
        ("columns", transformer),
    ])


class ColumnDropper(BaseEstimator, TransformerMixin):
    def __init__(self, columns):
        self.columns = columns

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        return X.drop(columns=[c for c in self.columns if c in X.columns])
