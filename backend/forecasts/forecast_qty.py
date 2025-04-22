# forecasts/forecast_qty.py
import os
import re # Import regex for cleaning names
import numpy as np
import pandas as pd
import polars as pl
from fastapi import APIRouter, Depends, HTTPException
from skimpy import clean_columns
from xgboost import XGBRegressor # Using XGBoost

from auth.dependencies import get_current_merchant
from models.merchant import Merchant

router = APIRouter()

# Helper to clean item names for use in dictionary keys/column headers
def sanitize_key_name(name: str) -> str:
    s = re.sub(r'\W+', '_', name)
    s = s.strip('_')
    if s and s[0].isdigit(): s = '_' + s
    return s if s else "unknown_item"

@router.get(
    "/api/forecast_quantity",
    # Updated summary to reflect the specific period
    summary="Forecast per-item daily quantities for Dec 2023 using XGBoost (trained up to Nov 2023)"
)
def forecast_quantity(merchant: Merchant = Depends(get_current_merchant)):
    merchant_id = merchant.merchant_id
    uri = os.getenv(
        "DATABASE_URI",
        "postgresql://postgres:nttc4@localhost:5432/postgres"
    )
    forecast_steps = 30 # Predict the 30 days of December

    # Define the cutoff date for training data
    cutoff_date = pd.Timestamp('2023-11-30')

    # 1) Load raw data including item_name
    query = f"""
    SELECT order_time, item_id, item_name, quantity
    FROM combined_order_view
    WHERE order_merchant_id = '{merchant_id}'
      AND order_time < '{cutoff_date + pd.Timedelta(days=1)}' -- Load data up to cutoff
    ORDER BY order_time
    """
    try:
        df = pl.read_database_uri(uri=uri, query=query)
        if df.height == 0:
             raise HTTPException(status_code=404, detail=f"No order data found before {cutoff_date.strftime('%Y-%m-%d')} for merchant {merchant_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

    df = clean_columns(df).drop_nulls(subset=["order_time", "item_id", "item_name", "quantity"])
    if df.height == 0:
        raise HTTPException(status_code=404, detail=f"No valid order data after cleaning for merchant {merchant_id}")

    # 2) Aggregate daily quantity per item
    df = df.with_columns(pl.col("order_time").dt.date().alias("order_date"))
    daily = (
        df
        .group_by(["order_date", "item_id", "item_name"])
        .agg(pl.col("quantity").sum().alias("daily_quantity_sold"))
        .sort(["order_date", "item_id"])
    )
    if daily.height == 0:
        raise HTTPException(status_code=404, detail=f"No aggregated daily data for merchant {merchant_id}")

    # 3) Feature engineering: date parts
    daily = daily.with_columns([
        pl.col("order_date").dt.weekday().alias("weekday"),
        pl.col("order_date").dt.month().alias("month"),
        pl.col("order_date").dt.day().alias("day"),
        pl.col("order_date").dt.year().alias("year"),
        pl.col("order_date").dt.ordinal_day().alias("day_of_year")
    ])

    # 4) Convert to pandas
    pdf = daily.to_pandas()
    pdf["order_date"] = pd.to_datetime(pdf["order_date"])

    # --- Create item_id to name mapping from the loaded data ---
    item_id_to_name_map = pdf[['item_id', 'item_name']].drop_duplicates().set_index('item_id')['item_name'].to_dict()
    # --- Get unique items *present in the training period* ---
    unique_items_in_train_period = pdf["item_id"].unique().tolist()

    # 5) --- SPLIT DATA: Train up to cutoff_date ---
    pdf_train = pdf[pdf['order_date'] <= cutoff_date].copy()
    pdf_train.set_index("order_date", inplace=True) # Set index for training data

    if pdf_train.empty:
         raise HTTPException(status_code=404, detail=f"No training data available up to {cutoff_date.strftime('%Y-%m-%d')}.")

    # Create features (X) and target (y) for training
    pdf_train['item_id'] = pdf_train['item_id'].astype('category')
    feature_names = ["weekday", "month", "day", "year", "day_of_year", "item_id"]
    X_train = pdf_train[feature_names]
    y_train = pdf_train["daily_quantity_sold"]

    if X_train.empty or y_train.empty:
        raise HTTPException(status_code=404, detail="Not enough data points in the training period.")

    # 6) Fit XGBoost regressor (Removed early stopping as no validation set is used here)
    try:
        print(f"Fitting XGBoost model on data up to {cutoff_date.strftime('%Y-%m-%d')} ({len(y_train)} points)...")
        model = XGBRegressor(n_estimators=100,
                             random_state=42,
                             enable_categorical=True,
                             objective='reg:squarederror'
                             )
        model.fit(X_train, y_train)
        print("Model fitting complete.")
    except Exception as e:
        print(f"Error during XGBoost model fitting: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=f"Model fitting failed: {e}")

    # --- Step 7: PREPARE DATA FOR DECEMBER 2023 PREDICTION ---
    # Generate dates for December 2023
    future_dates_dt = pd.date_range(
        start=cutoff_date + pd.Timedelta(days=1), # Start from Dec 1st
        periods=forecast_steps, # Should be 30 for Dec
        freq="D"
    )
    print(f"Generating features for prediction period: {future_dates_dt.min().strftime('%Y-%m-%d')} to {future_dates_dt.max().strftime('%Y-%m-%d')}")

    # Create future DataFrame shell using items known during training
    future_index = pd.MultiIndex.from_product([future_dates_dt, unique_items_in_train_period], names=['order_date', 'item_id'])
    future_df = pd.DataFrame(index=future_index).reset_index()

    # Add date features
    future_df["weekday"] = future_df["order_date"].dt.weekday + 1
    future_df["month"] = future_df["order_date"].dt.month
    future_df["day"] = future_df["order_date"].dt.day
    future_df["year"] = future_df["order_date"].dt.year
    future_df["day_of_year"] = future_df["order_date"].dt.dayofyear

    # Ensure correct column order and types for prediction
    # Use categories learned from the training data
    future_df['item_id'] = pd.Categorical(future_df['item_id'], categories=X_train['item_id'].cat.categories)
    X_predict = future_df[feature_names] # Features for December

    # --- Step 8: PREDICT DECEMBER 2023 QUANTITIES ---
    try:
        print(f"Predicting for {len(X_predict)} December date/item combinations...")
        future_preds = model.predict(X_predict)
        future_preds_processed = np.maximum(0, np.round(future_preds)).astype(int)
        future_df["predicted_quantity"] = future_preds_processed
        print("Prediction for December complete.")
    except Exception as e:
        print(f"Error during XGBoost prediction for December: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    # --- Step 9: FORMAT DECEMBER FORECAST OUTPUT (using item names) ---
    december_forecast_output = []
    grouped_future = future_df.groupby('order_date')

    for date, group in grouped_future:
        record = {"order_date": date.strftime('%Y-%m-%d')}
        for _, row in group.iterrows():
            item_id = row["item_id"]
            item_name = item_id_to_name_map.get(item_id, f"UnknownID_{item_id}")
            safe_name = sanitize_key_name(item_name)
            record[f"{safe_name}_pred"] = row["predicted_quantity"]
        december_forecast_output.append(record)

    # --- Step 10: Return JSON ---
    # Return only the December forecast as requested
    return {
        "merchant_id": merchant_id,
        "forecast_period": f"{future_dates_dt.min().strftime('%Y-%m-%d')} to {future_dates_dt.max().strftime('%Y-%m-%d')}",
        # Use a clear key name like "december_forecast_by_name" or similar
        "future_forecast_by_name": december_forecast_output,
    }

# --- Helper function to process forecast data (remains the same) ---
def get_forecasted_quantities(forecast_data: dict, days: int) -> dict:
    """
    Get forecasted quantities for each item for a specific number of future days.

    Args:
        forecast_data: Output dictionary from forecast_quantity function.
                       Expects a "future_forecast_by_name" key (or similar).
        days: Number of future days to get forecast for (1-30).

    Returns:
        Dictionary containing forecasted quantities per item for the period.
    """
    days = int(days)
    # Use the number of days available in the forecast (should be 30)
    available_forecast_days = len(forecast_data.get("future_forecast_by_name", []))
    if days <= 0 or days > available_forecast_days:
        raise ValueError(f"Days must be between 1 and {available_forecast_days}")

    forecast_key = "future_forecast_by_name" # Match the key returned by the main function
    if forecast_key not in forecast_data:
         raise KeyError(f"Forecast data is missing the required '{forecast_key}' key.")

    # Limit to the requested number of future days
    forecast_days_data = forecast_data[forecast_key][:days]
    if not forecast_days_data:
        return {
            "forecast_period_days": days,
            "total_quantities_per_item": {},
            "daily_breakdown": []
        }

    item_totals = {}
    for day_record in forecast_days_data:
        for key, value in day_record.items():
            if key.endswith("_pred"):
                item_name_key = key[:-5]
                item_totals[item_name_key] = item_totals.get(item_name_key, 0) + int(value)

    formatted_totals = {
        item_key: total
        for item_key, total in item_totals.items()
    }

    return {
        "forecast_period_days": days,
        "total_quantities_per_item": formatted_totals,
        "daily_breakdown": forecast_days_data
    }