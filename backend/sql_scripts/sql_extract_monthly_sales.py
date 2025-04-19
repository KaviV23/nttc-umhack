# --- START OF FILE sql_extract_monthly_sales.py ---

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from datetime import datetime
import pandas as pd
from sqlalchemy import create_engine, text
import os

# Added Merchant model and dependency function
from models.merchant import Merchant
from auth.dependencies import get_current_merchant

# Define router
router = APIRouter()

# Database connection parameters (reuse or centralize in production)
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "nttc4") # Secure in production

# --- Response Models ---
class MonthlySalePoint(BaseModel):
    """Represents total sales for a single month."""
    month: str  # Format: YYYY-MM
    total_sales: float

class MonthlySalesResponse(BaseModel):
    """Response containing a list of monthly sales data points."""
    merchant_id: str
    monthly_sales: List[MonthlySalePoint]

# --- Database Connection (copied for simplicity, consider centralizing) ---
def get_db_connection():
    """Create and return a SQLAlchemy engine"""
    conn_string = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    try:
        engine = create_engine(conn_string)
        with engine.connect() as connection:
            pass # Test connection
        return engine
    except Exception as e:
        print(f"Error connecting to database: {e}")
        raise # Re-raise for endpoint error handling

# --- Query Logic ---
def query_monthly_sales(merchant_id: str):
    """
    Query and aggregate monthly sales for a specific merchant.

    Args:
        merchant_id (str): The ID of the merchant to filter by.

    Returns:
        DataFrame: Monthly aggregated sales (month, total_sales)
    """
    engine = get_db_connection()

    # --- SQL Query ---
    # This query aggregates sales per month for the given merchant.
    # It assumes 'order_value' represents the total value for each *unique* order.
    # If 'combined_order_view' has multiple rows per order_id (e.g., one per item),
    # summing 'order_value' directly will inflate sales. This CTE handles that.
    monthly_sales_query = text("""
    WITH MonthlyUniqueOrders AS (
        -- Select distinct orders and their values per month to avoid double counting
        SELECT DISTINCT
            order_id,
            order_value,
            TO_CHAR(order_time, 'YYYY-MM') as sale_month
        FROM combined_order_view
        WHERE order_merchant_id = :merchant_id -- Filter by the specific merchant
          -- Optional: Add date range filter if needed, e.g., for only 2023
          -- AND order_time >= '2023-01-01' AND order_time < '2024-01-01'
    )
    -- Sum the unique order values for each month
    SELECT
        sale_month as month,
        SUM(order_value)::FLOAT as total_sales
    FROM MonthlyUniqueOrders
    GROUP BY sale_month
    ORDER BY sale_month ASC; -- Order chronologically for the graph
    """)

    try:
        print(f"Querying monthly sales for merchant {merchant_id}")
        sales_df = pd.read_sql_query(
            monthly_sales_query,
            engine,
            params={"merchant_id": merchant_id}
        )

        if sales_df.empty:
             print(f"No monthly sales data found for merchant {merchant_id}.")
             # Return empty dataframe with correct columns for consistent processing
             sales_df = pd.DataFrame(columns=['month', 'total_sales'])
        else:
             # Ensure correct types
             sales_df['total_sales'] = sales_df['total_sales'].astype(float)

        return sales_df

    except Exception as e:
        print(f"Error querying monthly sales for merchant {merchant_id}: {e}")
        # Propagate error to be handled by the endpoint
        raise Exception(f"Database query failed for monthly sales: {e}")

# --- API Endpoint ---
@router.get(
    "/api/monthly_sales",
    summary="Get aggregated monthly sales trend FOR CURRENT MERCHANT",
    response_model=MonthlySalesResponse
)
async def get_monthly_sales_endpoint(
    merchant: Merchant = Depends(get_current_merchant) # Get current merchant
):
    """
    Retrieves the total sales aggregated by month for the
    currently authenticated merchant. Suitable for plotting trends.
    """
    try:
        # Call the query function with the authenticated merchant's ID
        sales_df = query_monthly_sales(merchant_id=merchant.merchant_id)

        # Convert DataFrame rows to list of Pydantic models
        monthly_sales_list = [
            MonthlySalePoint(
                month=row['month'],
                total_sales=float(row['total_sales']) # Ensure float
            )
            for _, row in sales_df.iterrows()
        ]

        # Create and return the final response object
        response = MonthlySalesResponse(
            merchant_id=merchant.merchant_id,
            monthly_sales=monthly_sales_list
        )
        return response

    except Exception as e:
        # Catch database or other errors from query_monthly_sales
        print(f"Error in /api/monthly_sales endpoint for merchant {merchant.merchant_id}: {e}")
        # Return a generic server error response
        raise HTTPException(status_code=500, detail="Internal server error retrieving monthly sales data.")

# --- END OF FILE sql_extract_monthly_sales.py ---