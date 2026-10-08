"""LightGBM training pipeline for MedPredict demand forecasting."""

import json
from datetime import datetime
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT_DIR / "data" / "synthetic" / "demand_history.csv"
ARTIFACTS_DIR = ROOT_DIR / "backend" / "ml" / "artifacts"


def build_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Generate lag, rolling, calendar, and operational features.

    Strictly avoids lookahead bias: rolling features are shifted by 1.
    """
    df = df.sort_values(["hospital_id", "medicine_id", "date"]).copy()
    g = df.groupby(["hospital_id", "medicine_id"], group_keys=False)

    # 1. Lag features
    for lag in [1, 2, 3, 7, 14, 28]:
        df[f"lag_{lag}"] = g["quantity_consumed"].shift(lag)

    # 2. Rolling features (shifted by 1 so future is not seen)
    for w in [7, 14, 28]:
        df[f"rolling_mean_{w}"] = g["quantity_consumed"].transform(
            lambda s: s.shift(1).rolling(w).mean()
        )
        df[f"rolling_std_{w}"] = g["quantity_consumed"].transform(
            lambda s: s.shift(1).rolling(w).std()
        )

    # 3. Calendar features
    df["date"] = pd.to_datetime(df["date"])
    df["day_of_week"] = df["date"].dt.dayofweek
    df["day_of_month"] = df["date"].dt.day
    df["month"] = df["date"].dt.month
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    # Target: 1-step-ahead next day consumption
    df["target"] = g["quantity_consumed"].shift(-1)

    # Categories
    df["hospital_id"] = df["hospital_id"].astype("category")
    df["medicine_id"] = df["medicine_id"].astype("category")

    features = (
        [c for c in df.columns if c.startswith("lag_") or c.startswith("rolling_")]
        + [
            "day_of_week",
            "day_of_month",
            "month",
            "week_of_year",
            "is_weekend",
            "patient_load",
            "emergency_cases",
            "outbreak_signal",
            "hospital_id",
            "medicine_id",
        ]
    )

    df_clean = df.dropna(subset=features + ["target"]).copy()
    return df_clean, features


def train_and_evaluate(data_path: Path = DATA_PATH) -> dict:
    print(f"Loading demand history from {data_path}...")
    raw_df = pd.read_csv(data_path)
    df, features = build_features(raw_df)

    # Chronological 70% / 15% / 15% split
    unique_dates = np.sort(df["date"].unique())
    n_dates = len(unique_dates)
    c1 = unique_dates[int(0.70 * n_dates)]
    c2 = unique_dates[int(0.85 * n_dates)]

    print(
        f"Chronological split: Train (< {pd.to_datetime(c1).strftime('%Y-%m-%d')}) | "
        f"Val ({pd.to_datetime(c1).strftime('%Y-%m-%d')} to {pd.to_datetime(c2).strftime('%Y-%m-%d')}) | "
        f"Test (>= {pd.to_datetime(c2).strftime('%Y-%m-%d')})"
    )

    train_df = df[df["date"] < c1]
    val_df = df[(df["date"] >= c1) & (df["date"] < c2)]
    test_df = df[df["date"] >= c2]

    print(
        f"Train size: {len(train_df)} | Val size: {len(val_df)} | Test size: {len(test_df)}"
    )

    model = lgb.LGBMRegressor(
        objective="regression",
        n_estimators=1000,
        learning_rate=0.03,
        num_leaves=31,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=0.1,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        train_df[features],
        train_df["target"],
        eval_set=[(val_df[features], val_df["target"])],
        callbacks=[lgb.early_stopping(stopping_rounds=80, verbose=False)],
    )

    # Predictions
    y_test = test_df["target"].values
    y_pred_lgb = model.predict(test_df[features])
    y_pred_base = test_df["rolling_mean_7"].values

    def compute_metrics(y_true, y_pred):
        mae = float(mean_absolute_error(y_true, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        wape = float(np.sum(np.abs(y_true - y_pred)) / np.sum(np.abs(y_true)))
        return {"mae": round(mae, 4), "rmse": round(rmse, 4), "wape": round(wape, 4)}

    lgb_metrics = compute_metrics(y_test, y_pred_lgb)
    base_metrics = compute_metrics(y_test, y_pred_base)

    print("\n================ EVALUATION ON TEST SET ================")
    print(
        f"LightGBM:        MAE={lgb_metrics['mae']:.4f} | RMSE={lgb_metrics['rmse']:.4f} | WAPE={lgb_metrics['wape']:.4f} ({lgb_metrics['wape']*100:.2f}%)"
    )
    print(
        f"7-day Baseline:  MAE={base_metrics['mae']:.4f} | RMSE={base_metrics['rmse']:.4f} | WAPE={base_metrics['wape']:.4f} ({base_metrics['wape']*100:.2f}%)"
    )
    print("========================================================\n")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Save model text
    booster = model.booster_
    model_file = ARTIFACTS_DIR / "demand_lightgbm.txt"
    booster.save_model(str(model_file))
    print(f"Saved model to {model_file}")

    # 2. Save feature importance
    importance = {
        feat: int(imp)
        for feat, imp in zip(features, booster.feature_importance(importance_type="gain"))
    }
    sorted_importance = dict(
        sorted(importance.items(), key=lambda x: x[1], reverse=True)
    )
    imp_file = ARTIFACTS_DIR / "feature_importance.json"
    with open(imp_file, "w") as f:
        json.dump(sorted_importance, f, indent=2)

    # 3. Save metrics
    metrics_payload = {
        "model": "LightGBM",
        "model_version": "1.0.0",
        "trained_at": datetime.utcnow().isoformat(),
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "features": features,
        "lightgbm": lgb_metrics,
        "baseline_7day_ma": base_metrics,
        "evaluation_split": "15% chronological out-of-time test set",
    }
    metrics_file = ARTIFACTS_DIR / "metrics.json"
    with open(metrics_file, "w") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"Saved metrics to {metrics_file}")

    return metrics_payload


if __name__ == "__main__":
    train_and_evaluate()
