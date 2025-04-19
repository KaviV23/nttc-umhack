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
    query = f"SELECT * FROM combined_order_view WHERE order_merchant_id = '{merchant_id}'"
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
        .group_by(["order_date", "item_id", "item_name"])
        .agg(pl.col("quantity").sum().alias("daily_quantity_sold"))
        .sort(["order_date", "item_id"])
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

    # Process the data to include item names
    output_data = []
    output_data_with_ids = []
    for date in hist_df["order_date"].unique():
        date_data = hist_df[hist_df["order_date"] == date]
        record = {"order_date": date}
        record_with_ids = {"order_date": date}
        
        for _, row in date_data.iterrows():
            item_id = str(row["item_id"])
            item_name = row["item_name"]
            # Format with item names
            record[f"{item_name}_pred"] = row["predicted_quantity"]
            record[f"{item_name}_actual"] = row["actual"]
            # Format with item IDs
            record_with_ids[f"item_{item_id}_pred"] = row["predicted_quantity"]
            record_with_ids[f"item_{item_id}_actual"] = row["actual"]
        
        output_data.append(record)
        output_data_with_ids.append(record_with_ids)

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

    # 9) Return JSON-friendly lists with both formats
    return {
        "merchant_id": merchant_id,
        "historical_evaluation": output_data,
        "graph_forecast_ids": output_data_with_ids
    }

def get_forecasted_quantities(forecast_data: dict, days: int) -> dict:
    """
    Get forecasted quantities for each item for a specific number of days.
    
    Args:
        forecast_data: Output dictionary from forecast_quantity function
        days: Number of days to get forecast for (1-30)
    
    Returns:
        Dictionary containing forecasted quantities per item
    """
    # Ensure days is an integer
    days = int(days)
    if days <= 0 or days > 30:
        raise ValueError("Days must be between 1 and 30")
    
    # Get the forecast data and limit to requested days
    forecast_days = forecast_data["historical_evaluation"][:days]
    
    # Calculate total quantities per item
    item_totals = {}
    for day in forecast_days:
        for key, value in day.items():
            if key.endswith("_pred"):
                item_name = key.replace("_pred", "")
                if item_name not in item_totals:
                    item_totals[item_name] = 0
                item_totals[item_name] += value
    
    return {
        "forecast_period_days": days,
        "total_quantities_per_item": {
            item_name: round(total, 2)
            for item_name, total in item_totals.items()
            if item_name != "order_date"  # Exclude the date field
        },
        "daily_breakdown": forecast_days
    }
