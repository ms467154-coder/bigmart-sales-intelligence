from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

FAT_MAP = {"LF": "Low Fat", "low fat": "Low Fat", "Low Fat": "Low Fat", "reg": "Regular", "Regular": "Regular"}


class BigMartFeatureEngineer(BaseEstimator, TransformerMixin):
    """Deterministic, leakage-safe feature transformer.

    Learned item weights are fitted only on the training frame. Missing outlet sizes
    are resolved deterministically from outlet identity, then outlet type/location,
    then an explicit Unknown category.
    """

    def fit(self, X: pd.DataFrame, y=None):
        frame = X.copy()
        self.global_weight_ = float(frame["Item_Weight"].median())
        self.item_weight_ = frame.groupby("Item_Identifier")["Item_Weight"].median().dropna().to_dict()
        self.type_weight_ = frame.groupby("Item_Type")["Item_Weight"].median().dropna().to_dict()
        known = frame.dropna(subset=["Outlet_Size"])
        self.outlet_size_by_id_ = known.groupby("Outlet_Identifier")["Outlet_Size"].agg(lambda s: s.mode().iat[0]).to_dict()
        self.outlet_size_by_type_location_ = known.groupby(["Outlet_Type", "Outlet_Location_Type"])["Outlet_Size"].agg(lambda s: s.mode().iat[0]).to_dict()
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        frame = X.copy()
        frame["Item_Fat_Content"] = frame["Item_Fat_Content"].map(FAT_MAP).fillna(frame["Item_Fat_Content"])
        weights = frame["Item_Weight"].copy()
        weights = weights.fillna(frame["Item_Identifier"].map(self.item_weight_))
        weights = weights.fillna(frame["Item_Type"].map(self.type_weight_))
        frame["Item_Weight"] = weights.fillna(self.global_weight_)
        def size(row):
            if pd.notna(row["Outlet_Size"]):
                return row["Outlet_Size"]
            by_id = self.outlet_size_by_id_.get(row["Outlet_Identifier"])
            if by_id:
                return by_id
            return self.outlet_size_by_type_location_.get((row["Outlet_Type"], row["Outlet_Location_Type"]), "Unknown")
        frame["Outlet_Size"] = frame.apply(size, axis=1)
        frame["Item_ID_Prefix"] = frame["Item_Identifier"].astype(str).str[:2]
        frame["Item_ID_Number"] = pd.to_numeric(frame["Item_Identifier"].astype(str).str[2:], errors="coerce").fillna(0)
        frame["Outlet_Age"] = 2013 - frame["Outlet_Establishment_Year"]
        frame["Item_Visibility_Is_Zero"] = (frame["Item_Visibility"] == 0).astype(int)
        frame["Item_Visibility_Log"] = np.log1p((frame["Item_Visibility"] + 1e-6).clip(lower=1e-6))
        frame["Item_MRP_Band"] = pd.cut(frame["Item_MRP"], bins=[-float("inf"), 70, 140, 210, float("inf")], labels=["low", "medium", "high", "premium"]).astype(str)
        frame["MRP_x_Outlet_Type"] = frame["Item_MRP_Band"].astype(str) + "__" + frame["Outlet_Type"].astype(str)
        frame["MRP_x_Item_Type"] = frame["Item_MRP_Band"].astype(str) + "__" + frame["Item_Type"].astype(str)
        return frame

    def fit_transform(self, X: pd.DataFrame, y=None, **fit_params):
        return self.fit(X, y).transform(X)
