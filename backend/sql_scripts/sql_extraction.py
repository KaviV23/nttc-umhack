# --- START OF FILE sql_extraction.py ---

# Added Depends
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import List 
from datetime import datetime, timedelta
import pandas as pd
from sqlalchemy import create_engine, text
import os

# Added Merchant model and dependency function
from models.merchant import Merchant
from auth.dependencies import get_current_merchant

# Define router
router = APIRouter()

# Database connection parameters - you can use environment variables in production
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "nttc4") # Make sure this is secure in prod

# Response models (Unchanged)
class ItemQuantity(BaseModel):
    item_name: str
    total_quantity: int
    total_sales: float

class QuantitiesResponse(BaseModel):
    days: int
    start_date: str
    end_date: str
    items: List[ItemQuantity]

def get_db_connection():
    """Create and return a SQLAlchemy engine"""
    conn_string = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    try:
        engine = create_engine(conn_string)
        with engine.connect() as connection:
            pass
        return engine
    except Exception as e:
        print(f"Error connecting to database: {e}")
        raise

# Modified to accept merchant_id
def query_item_quantities(days: int, merchant_id: str):
    """
    Query item quantities for a specific merchant for the specified
    number of past days, relative to a fixed end date (Dec 31, 2023)
    for testing purposes.

    Args:
        days (int): Number of past days to query (relative to fixed end date)
        merchant_id (str): The ID of the merchant to filter by.

    Returns:
        DataFrame: Item quantities and sales
        str: Start date string of the query range
        str: End date string of the query range
    """
    # Validate days parameter
    if not 1 <= days <= 365:
        raise ValueError("Days parameter must be between 1 and 365 for this test setup")

    # --- TEST MODE DATE CALCULATION (Unchanged) ---
    fixed_end_date_str = "2023-12-31"
    end_date = datetime.strptime(fixed_end_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
    start_date = end_date - timedelta(days=(days - 1))
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    start_date_param = start_date
    end_date_param = end_date
    # --- END OF TEST MODE DATE CALCULATION ---

    engine = get_db_connection()

    # --- SQL Query MODIFIED ---
    # Added WHERE clause for order_merchant_id
    # Assumes 'order_merchant_id' is the correct column in combined_order_view
    # to link sales to the merchant handling the order.
    quantity_query = text("""
    SELECT
        item_id,
        item_name,
        SUM(quantity)::INTEGER as total_quantity,
        SUM(item_price * quantity)::FLOAT as total_sales
    FROM
        combined_order_view
    WHERE
        order_merchant_id = :merchant_id -- Filter by merchant ID
        AND order_time >= :start_date
        AND order_time <= :end_date
    GROUP BY
        item_id, item_name
    HAVING
        SUM(quantity) > 0
    ORDER BY
        total_quantity DESC
    """)

    try:
        print(f"Querying quantities for merchant {merchant_id} from {start_date_param} to {end_date_param}")
        # --- Params MODIFIED ---
        # Added merchant_id to the parameters dictionary
        quantity_df = pd.read_sql_query(
            quantity_query,
            engine,
            params={
                "merchant_id": merchant_id, # Pass merchant_id to query
                "start_date": start_date_param,
                "end_date": end_date_param
             }
        )

        if not quantity_df.empty:
            quantity_df['total_quantity'] = quantity_df['total_quantity'].astype(int)
            quantity_df['total_sales'] = quantity_df['total_sales'].astype(float)
        else:
             quantity_df = pd.DataFrame(columns=['item_id', 'item_name', 'total_quantity', 'total_sales'])
             print(f"No quantity data found for merchant {merchant_id} in the specified period.")


        return quantity_df, start_date_param.strftime("%Y-%m-%d"), end_date_param.strftime("%Y-%m-%d")

    except Exception as e:
        print(f"Error querying quantities for merchant {merchant_id}: {e}")
        raise Exception(f"Database query failed for merchant {merchant_id}: {e}")

# --- Endpoint MODIFIED ---
@router.get(
    "/api/actual_quantities",
    # Updated summary
    summary="Get actual quantities sold FOR CURRENT MERCHANT for N days ending Dec 31, 2023 (Test Mode)",
    response_model=QuantitiesResponse
)
# Added merchant dependency
async def get_actual_quantities_endpoint(
    days: int = Query(..., ge=1, le=365, description="Number of past days (ending 2023-12-31) to retrieve data for"),
    merchant: Merchant = Depends(get_current_merchant) # Get current merchant
):
    """
    (Test Mode) Get actual historical quantities sold for the **currently authenticated merchant**
    for a specific period ending **December 31, 2023**.

    Parameters:
    - days: Number of past days ending 2023-12-31 (must be between 1 and 365)

    Returns:
    - Dictionary with days, date range (relative to 2023-12-31), and list of items with quantities
      filtered for the current merchant.
    """
    try:
        # --- Call MODIFIED ---
        # Pass merchant.merchant_id to the query function
        quantity_df, start_date_str, end_date_str = query_item_quantities(
            days=days,
            merchant_id=merchant.merchant_id # Pass the authenticated merchant's ID
        )

        items_list = [
            ItemQuantity(
                item_name=row['item_name'],
                total_quantity=int(row['total_quantity']),
                total_sales=float(row['total_sales'])
            )
            for _, row in quantity_df.iterrows()
        ]

        response = QuantitiesResponse(
            days=days,
            start_date=start_date_str,
            end_date=end_date_str,
            items=items_list
        )
        return response

    except ValueError as e:
        # Error from query_item_quantities (e.g., invalid days)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Catch database or other errors from query_item_quantities
        print(f"Error in /api/actual_quantities endpoint for merchant {merchant.merchant_id}: {e}")
        # Avoid exposing detailed internal errors to the client
        raise HTTPException(status_code=500, detail="Internal server error processing request.")

# --- END OF FILE sql_extraction.py ---