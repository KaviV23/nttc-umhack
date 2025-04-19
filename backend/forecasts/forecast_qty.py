import os
import numpy as np
import pandas as pd
import polars as pl
from fastapi import APIRouter, Depends, HTTPException
from skimpy import clean_columns
from xgboost import XGBRegressor
from auth.dependencies import get_current_merchant
from models.merchant import Merchant

router = APIRouter()

@router.get(
    "/api/forecast_quantity",
    summary="Forecast per-item daily quantities for the next 30 days using XGBoost"
)
def forecast_quantity(merchant: Merchant = Depends(get_current_merchant)):
    merchant_id = merchant.merchant_id
    uri = os.getenv(
        "DATABASE_URI",
        "postgresql://postgres:nttc4@localhost:5432/postgres"
    )

    # 1) Load raw data (timestamp, item_id, quantity)
    query = (
        "SELECT order_time, item_id, quantity "
        f"FROM combined_order_view WHERE order_merchant_id = '{merchant_id}'"
    )
    try:
        df = pl.read_database_uri(uri=uri, query=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
    df = clean_columns(df)

    # 2) Derive pure date and aggregate per item
    df = df.with_columns([
        pl.col("order_time").dt.date().alias("order_date")
    ])
    daily = (
        df
        .group_by(["order_date", "item_id"] )
        .agg(pl.col("quantity").sum().alias("daily_quantity_sold"))
        .sort(["order_date", "item_id"] )
    )

    # 3) Feature engineering: date parts
    daily = daily.with_columns([
        pl.col("order_date").dt.weekday().alias("weekday"),
        pl.col("order_date").dt.month().alias("month"),
        pl.col("order_date").dt.day().alias("day"),
    ])

    # 4) Convert to pandas and index by date
    pdf = daily.to_pandas()
    pdf["order_date"] = pd.to_datetime(pdf["order_date"])
    pdf.set_index("order_date", inplace=True)

    # 5) Split by date into train/test (last 30 days for evaluation)
    all_dates = pdf.index.unique().sort_values()
    test_dates = all_dates[-30:]
    train = pdf.loc[~pdf.index.isin(test_dates)]
    test = pdf.loc[pdf.index.isin(test_dates)]

    X_train = train[["weekday", "month", "day", "item_id"]]
    y_train = train["daily_quantity_sold"]
    X_test = test[["weekday", "month", "day", "item_id"]]
    y_test = test["daily_quantity_sold"]

    # 6) Fit XGBoost regressor
    try:
        model = XGBRegressor(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model fitting failed: {e}")

    # 7) Historical evaluation: predict on test set
    preds_hist = model.predict(X_test)
    hist_df = test.copy()
    hist_df["predicted_quantity"] = np.round(preds_hist, 2)
    hist_df = hist_df.reset_index()
    hist_df.rename(columns={
        "daily_quantity_sold": "actual"
    }, inplace=True)

    # Pivot predicted and actual to wide format
    pivot_pred = hist_df.pivot(
        index="order_date", columns="item_id", values="predicted_quantity"
    )
    pivot_pred.columns = [f"item_{col}_pred" for col in pivot_pred.columns]

    pivot_actual = hist_df.pivot(
        index="order_date", columns="item_id", values="actual"
    )
    pivot_actual.columns = [f"item_{col}_actual" for col in pivot_actual.columns]

    hist_wide = pivot_pred.join(pivot_actual).sort_index()

    # 8) Future forecast: next 30 days for each item_id
    unique_items = pdf["item_id"].unique()
    # Get the last date from the dataset and ensure it's in the correct format
    last_date = pd.to_datetime(all_dates[-1]).date()
    future_dates = pd.date_range(
        start=last_date + pd.Timedelta(days=1),
        periods=30,
        freq="D"
    ).date  # Convert to date objects to avoid timezone issues
    
    # Create arrays with proper lengths
    num_dates = len(future_dates)
    num_items = len(unique_items)
    total_rows = num_dates * num_items
    

    # 9) Return JSON-friendly lists
    return {
        "merchant_id": merchant_id,
        "historical_evaluation": hist_wide.reset_index().to_dict(orient="records"),
    }
