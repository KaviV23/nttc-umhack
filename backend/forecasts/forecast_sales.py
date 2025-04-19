# forecast.py
import os

import numpy as np
import pandas as pd
import polars as pl
from fastapi import APIRouter, Depends, HTTPException
from skimpy import clean_columns
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX

from auth.dependencies import get_current_merchant
from models.merchant import Merchant

router = APIRouter()


def label_deviation(pct: float) -> str:
    if pct >= 10:
        return "Much Better than Expected"
    if 0 < pct < 10:
        return "Better than Expected"
    if pct == 0:
        return "As Expected"
    if -10 < pct < 0:
        return "Worse than Expected"
    return "Much Worse than Expected"


@router.get(
    "/api/forecast_sales",
    summary="Run full preprocessing + 30‑day ARIMA/SARIMA forecast and historical evaluation"
)
def forecast_orders(merchant: Merchant = Depends(get_current_merchant)):
    merchant_id = merchant.merchant_id
    uri = os.getenv(
        "DATABASE_URI",
        "postgresql://postgres:nttc4@localhost:5432/postgres"
    )

    # 1) Load & clean
    try:
        df = pl.read_database_uri(
            uri=uri,
            query=(
                "SELECT * FROM combined_order_view "
                f"WHERE order_merchant_id = '{merchant_id}'"
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
    df = clean_columns(df)

    # 2) Feature engineering
    df = df.with_columns([
        pl.col("order_time").dt.date().alias("order_date"),
        pl.col("order_time").dt.hour().alias("order_hour"),
        pl.col("order_time").dt.weekday().alias("order_weekday"),
        (pl.col("driver_arrival_time") - pl.col("order_time"))\
            .alias("time_to_arrive"),
        (pl.col("driver_pickup_time") - pl.col("driver_arrival_time"))\
            .alias("wait_to_pickup"),
        (pl.col("delivery_time") - pl.col("driver_pickup_time"))\
            .alias("delivery_duration"),
    ])

    # 3) Daily aggregation
    daily = df.group_by("order_date").agg([
        pl.col("order_id").n_unique().alias("total_orders"),
        pl.col("order_value").sum().alias("total_revenue"),
        pl.col("quantity").sum().alias("total_items"),
    ]).sort("order_date")

    # 4) Winsorize + log1p
    cols = ["total_orders", "total_revenue", "total_items"]
    low_q, high_q = 0.03, 0.97
    for c in cols:
        low = daily.select(pl.col(c).quantile(low_q)).item()
        high = daily.select(pl.col(c).quantile(high_q)).item()
        daily = daily.with_columns(
            pl.col(c).clip(low, high).alias(f"{c}_winsor")
        ).with_columns(
            pl.col(f"{c}_winsor").log1p().alias(f"{c}_log1p")
        )

    # 5) Min‑Max normalize
    log_cols = [f"{c}_log1p" for c in cols]
    for c in log_cols:
        mn = daily.select(pl.col(c).min()).item()
        mx = daily.select(pl.col(c).max()).item()
        daily = daily.with_columns(
            ((pl.col(c) - mn) / (mx - mn)).alias(f"{c}_norm")
        )

    # 6) Prepare series & split
    pdf = (
        daily
        .select(["order_date", "total_revenue"])
        .to_pandas()
        .set_index("order_date")
    )
    train, test = pdf.iloc[:-30], pdf.iloc[-30:]

    # 7) Fit SARIMA (weekly seasonality)
    try:
        sarima = SARIMAX(
            train["total_revenue"],
            order=(1, 1, 1),
            seasonal_order=(1, 1, 1, 7),
            enforce_stationarity=False,
            enforce_invertibility=False
        )
        fit = sarima.fit(disp=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model failure: {e}")

    # 8) Historical eval on last 30 days
    pred = fit.get_prediction(
        start=len(train),
        end=len(train) + len(test) - 1
    )
    hist = pred.summary_frame().reset_index().rename(
        columns={"index": "forecast_date", "mean": "forecasted_revenue"}
    )
    actual = (
        test
        .reset_index()
        .rename(columns={
            "order_date": "forecast_date",
            "total_revenue": "total_revenue"
        })
    )

    eval_df = hist.merge(actual, on="forecast_date")
    eval_df["deviation_pct"] = (
        (eval_df["forecasted_revenue"] - eval_df["total_revenue"])
        / eval_df["total_revenue"]
    ) * 100
    eval_df["label"] = eval_df["deviation_pct"].apply(label_deviation)
    for col in ["forecasted_revenue", "total_revenue", "deviation_pct"]:
        eval_df[col] = eval_df[col].round(2)

    # 9) Future 30‑day forecast
    fut = fit.forecast(steps=30)
    idx = pd.date_range(
        start=train.index[-1] + pd.Timedelta(days=1),
        periods=30, freq="D"
    )
    fut_df = pd.DataFrame({
        "forecast_date": idx,
        "forecasted_revenue": np.round(fut.values, 2)
    })

    return {
        "merchant_id": merchant_id,
        "historical_evaluation": eval_df.to_dict(orient="records"),
        "future_forecast": fut_df.to_dict(orient="records"),
    }

def calculate_total_sales(forecast_data: dict, days: int) -> dict:
    """
    Calculate total sales from forecast_orders output for a specific number of days.
    
    Args:
        forecast_data: Output dictionary from forecast_orders function
        days: Number of days to calculate total for (1-30)
    
    Returns:
        Dictionary containing total sales and daily breakdown
    """
    # Ensure days is an integer
    days = int(days)
    if days <= 0 or days > 30:
        raise ValueError("Days must be between 1 and 30")
    
    # Get the forecast data and limit to requested days
    forecast_days = forecast_data["future_forecast"][:days]
    
    # Rename forecast_date to order_date
    for day in forecast_days:
        day["order_date"] = day.pop("forecast_date")
    
    # Calculate total sales
    total_sales = sum(day["forecasted_revenue"] for day in forecast_days)
    
    return {
        "forecast_period_days": days,
        "total_forecasted_sales": round(total_sales, 2),
        "daily_breakdown": forecast_days
    }
