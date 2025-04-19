# --- START OF FILE sql_extraction.py ---

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Any
# psycopg2 is not directly used if using sqlalchemy engine + pandas, but good to have if needed elsewhere
# import psycopg2
from datetime import datetime, timedelta
import pandas as pd
from sqlalchemy import create_engine, text # Import text for parameter binding
import os

# Define router
router = APIRouter()

# Database connection parameters - you can use environment variables in production
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "nttc4") # Make sure this is secure in prod

# Response models
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
    # Ensure password is treated correctly if it contains special characters
    # from urllib.parse import quote_plus
    # password = quote_plus(DB_PASSWORD)
    # conn_string = f"postgresql://{DB_USER}:{password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    # Simpler version if password is simple:
    conn_string = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    try:
        engine = create_engine(conn_string)
        # Test connection - optional but good practice
        with engine.connect() as connection:
            # print("Database connection successful.") # Can comment out for cleaner logs
            pass
        return engine
    except Exception as e:
        print(f"Error connecting to database: {e}")
        raise # Re-raise the exception to be caught higher up

def query_item_quantities(days: int):
    """
    Query item quantities for the specified number of past days,
    relative to a fixed end date (Dec 31, 2023) for testing purposes.

    Args:
        days (int): Number of past days to query (relative to fixed end date)

    Returns:
        DataFrame: Item quantities and sales
        str: Start date string of the query range
        str: End date string of the query range
    """
    # Validate days parameter
    if not 1 <= days <= 365: # Allow up to a year for testing within 2023
        # Raise specific error if needed, or adjust range as required
        # Original was 1-30, updated for testing flexibility
        raise ValueError("Days parameter must be between 1 and 365 for this test setup")

    # --- MODIFICATION FOR TESTING WITH 2023 DATA ---
    # Use a fixed end date relevant to the dataset
    fixed_end_date_str = "2023-12-31"
    # Parse the fixed date string and set time to end of day for inclusive query
    end_date = datetime.strptime(fixed_end_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)

    # Calculate the start date based on the fixed end date
    start_date = end_date - timedelta(days=(days - 1)) # Subtract days-1 to make range inclusive
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0) # Start from beginning of the day

    # Use the calculated start_date and the fixed end_date for the query parameters
    start_date_param = start_date
    end_date_param = end_date
    # --- END OF MODIFICATION ---

    # Connect to the database
    engine = get_db_connection() # engine handles connection pooling

    # Query for item quantities - USE 'quantity' FROM THE VIEW
    # Use text() for parameter binding with SQLAlchemy core/pandas
    # Using <= end_date since end_date is set to 23:59:59
    quantity_query = text("""
    SELECT
        item_id,
        item_name,
        SUM(quantity)::INTEGER as total_quantity, -- Cast sum to INTEGER in SQL
        SUM(item_price * quantity)::FLOAT as total_sales -- Cast sum to FLOAT in SQL
    FROM
        combined_order_view
    WHERE
        order_time >= :start_date AND order_time <= :end_date -- Use named parameters
    GROUP BY
        item_id, item_name
    HAVING
        SUM(quantity) > 0 -- Optional: Only include items that were actually sold
    ORDER BY
        total_quantity DESC
    """)

    try:
        # Execute quantity query using pandas with parameters
        quantity_df = pd.read_sql_query(
            quantity_query,
            engine,
            params={
                "start_date": start_date_param,
                "end_date": end_date_param
             }
        )

        # Type casting might not be needed if done in SQL, but doesn't hurt
        if not quantity_df.empty:
            quantity_df['total_quantity'] = quantity_df['total_quantity'].astype(int)
            quantity_df['total_sales'] = quantity_df['total_sales'].astype(float)
        else:
            # Ensure DataFrame has correct columns even if empty, prevents errors later
             quantity_df = pd.DataFrame(columns=['item_id', 'item_name', 'total_quantity', 'total_sales'])


        # Return the calculated date range strings based on the query parameters
        return quantity_df, start_date_param.strftime("%Y-%m-%d"), end_date_param.strftime("%Y-%m-%d")

    except Exception as e:
        # Log the error for debugging
        print(f"Error querying database: {e}")
        # Raise a more specific or generic exception as needed
        raise Exception(f"Database query failed: {e}")
    # No finally needed here as pandas/sqlalchemy context manage the connection

@router.get(
    "/api/actual_quantities",
    summary="Get actual quantities sold per item for N days ending Dec 31, 2023 (Test Mode)",
    response_model=QuantitiesResponse
)
async def get_actual_quantities_endpoint(days: int = Query(..., ge=1, le=365, description="Number of past days (ending 2023-12-31) to retrieve data for")):
    """
    (Test Mode) Get actual historical quantities sold for each food item
    for a specific period ending **December 31, 2023**.

    Parameters:
    - days: Number of past days ending 2023-12-31 (must be between 1 and 365)

    Returns:
    - Dictionary with days, date range (relative to 2023-12-31), and list of items with quantities
    """
    try:
        # Query the database using the internal function (now uses fixed end date)
        quantity_df, start_date_str, end_date_str = query_item_quantities(days)

        # Convert DataFrame to list of Pydantic models
        items_list = [
            ItemQuantity(
                item_name=row['item_name'],
                # Ensure types match Pydantic model
                total_quantity=int(row['total_quantity']),
                total_sales=float(row['total_sales'])
            )
            for _, row in quantity_df.iterrows()
        ]

        # Create the response using the dates returned by the query function
        response = QuantitiesResponse(
            days=days,
            start_date=start_date_str,
            end_date=end_date_str,
            items=items_list
        )

        return response

    except ValueError as e: # Catch validation error from query_item_quantities
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e: # Catch database or other errors
        # Log the full error internally for debugging
        print(f"Error in /api/actual_quantities endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error processing request.")

# --- END OF FILE sql_extraction.py --- --- END OF FILE sql_extraction.py ---