import os
from datetime import date, timedelta

import polars as pl
from skimpy import clean_columns
from fastapi import APIRouter, Depends, HTTPException, Query

from auth.dependencies import get_current_merchant
from models.merchant import Merchant

router = APIRouter()


@router.get(
    "/api/actual_quantities",
    summary="Get actual quantities sold per item for the past N days"
)
def get_actual_quantities(
    days: int = Query(30, ge=1, le=30),
    merchant: Merchant = Depends(get_current_merchant)
):
    merchant_id = merchant.merchant_id
    uri = os.getenv(
        "DATABASE_URI",
        "postgresql://postgres:nttc4@localhost:5432/postgres"
    )

    # 1) Load & clean all orders for this merchant
    base_q = (
        "SELECT order_time, item_name, quantity "
        f"FROM combined_order_view WHERE order_merchant_id = '{merchant_id}'"
    )
    try:
        df = pl.read_database_uri(uri=uri, query=base_q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
    df = clean_columns(df)

    # 2) Master list of items (to include zero-sales)
    all_items = df.select("item_name").unique().sort("item_name")

    # 3) Filter to the last `days` days
    cutoff = date.today() - timedelta(days=days)
    recent = (
        df
        .with_columns(pl.col("order_time").dt.date().alias("order_date"))
        .filter(pl.col("order_date") >= cutoff)
    )

    # 4) Sum quantity per item over that window
    sold = recent.group_by("item_name").agg(
        pl.col("quantity").sum().alias("total_quantity")
    )

    # 5) Left join so items with zero sales appear, then fill nulls
    full = (
        all_items
        .join(sold, on="item_name", how="left")
        .with_columns(pl.col("total_quantity").fill_null(0).cast(int))
    )

    # 6) Build markdown summary
    total_qty = int(full["total_quantity"].sum())
    lines = [
        f"Here are the actual quantities sold in the past {days} days:",
        ""
    ]
    for row in full.iter_rows(named=True):
        name = row["item_name"]
        qty  = row["total_quantity"]
        lines.append(f"* {name}: {qty} units")
    lines += [
        "",
        f"The quantities add up to {total_qty} units"
    ]
    summary = "\n".join(lines)
    print(summary)

    # 7) Build JSON list
    actual_quantities = [
        {"item_name": r["item_name"], "quantity": r["total_quantity"]}
        for r in full.iter_rows(named=True)
    ]

    return {
        "merchant_id": merchant_id,
        "days_retrieved": days,
        "summary": summary,
        "actual_quantities": actual_quantities
    }
