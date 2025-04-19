import os
from fastapi import Depends, FastAPI, HTTPException
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.types import Content, Part
import google.generativeai as genai
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional

from auth.auth import create_access_token
from auth.dependencies import get_current_merchant
from db.dependencies import get_db
from models.merchant import Merchant
from schemas.merchant import Token
from schemas.request_bodies import LoginRequest, PromptRequest, HistoryMessage
from sql_scripts.get_customers_sql import get_customers_sql
from ai.tools import gemini_function_declarations
from forecasts.forecast_qty import router as forecast_qty_router, forecast_quantity, get_forecasted_quantities
from forecasts.forecast_sales import router as forecast_sales_router, forecast_orders, calculate_total_sales
from sql_scripts.sql_extraction import router as sql_extraction_router, query_item_quantities, ItemQuantity, QuantitiesResponse
from sql_scripts.sql_extract_monthly_sales import router as monthly_sales_router

app = FastAPI()

# mount our forecasting router here
app.include_router(forecast_sales_router)
app.include_router(forecast_qty_router)
app.include_router(sql_extraction_router)
app.include_router(monthly_sales_router)

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
geminiClient = genai.configure(api_key=GEMINI_API_KEY)

# --- Functions ---
# Format chat history
def format_history_for_gemini(history: Optional[List[HistoryMessage]]) -> List[Dict[str, Any]]:
    if not history:
        return []

    gemini_history: List[Dict[str, Any]] = []
    for msg in history:
        role = 'user' if msg.sender == 'user' else 'model'
        if msg.text and msg.text.strip():
            message_dict = {
                'role': role,
                'parts': [{'text': msg.text}]
            }
            gemini_history.append(message_dict)

    return gemini_history


# --- Endpoints ---
# Chatbot API
@app.post("/api/chat")
async def chat(reqBody: PromptRequest, merchant: Merchant = Depends(get_current_merchant)):

    geminiModel = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        tools=gemini_function_declarations,
        system_instruction=open("./ai/prompts/prompt3.txt", "r").read()
    )

    formatted_history = format_history_for_gemini(reqBody.history)

    chat_session = geminiModel.start_chat(history=formatted_history)

    geminiResponse = await chat_session.send_message_async( 
        reqBody.message,
    )

    if geminiResponse.candidates[0].content.parts[0].function_call:
        function_call = geminiResponse.candidates[0].content.parts[0].function_call
        function_name = function_call.name
        function_args = dict(function_call.args)
        
        # Dictionary of functions that expect standard response
        standard_functions = {
            "send_emails": True,
            "show_customers": True
        }
        
        match function_name:
            # Specialized functions - handle custom logic
            case "calculate_total_sales":
                # Get forecast data first
                forecast_data = forecast_orders(merchant)
                # Calculate total sales
                total_sales = calculate_total_sales(forecast_data, days=function_args["days"])
                return {
                    "response": await chatFunctionHelper(
                        f'Total forecasted sales for {function_args["days"]} days: ${total_sales["total_forecasted_sales"]}',
                        formatted_history
                    ),
                    "function_call": {
                        "name": function_name,
                        "args": function_args,
                    },
                    "data": total_sales
                }
            
            case "get_forecasted_quantities":
                # Get forecast data first
                forecast_data = forecast_quantity(merchant)
                # Get forecasted quantities
                quantities = get_forecasted_quantities(forecast_data, days=function_args["days"])
                
                # Format the quantities into a readable string
                quantities_text = f"Here are the forecasted quantities for the next {int(function_args['days'])} days:\n\n" + "\n".join([
                    f"* {item_name}: {int(round(qty))} units"
                    for item_name, qty in quantities["total_quantities_per_item"].items()
                ])
                
                return {
                    "response": quantities_text,
                    "function_call": {
                        "name": function_name,
                        "args": function_args,
                    },
                    "data": quantities
                }

            case "get_actual_quantities":
                try:
                    # 1. Extract and validate 'days' argument
                    days_arg = int(function_args.get("days", 7))
                    # Use validation range from sql_extraction.py (1-365)
                    if not 1 <= days_arg <= 365:
                        raise ValueError("Days parameter must be between 1 and 365 for this test setup")

                    # 2. Call the core logic function, passing the merchant_id
                    print(f"Executing query_item_quantities(days={days_arg}, merchant_id={merchant.merchant_id})")
                    # Ensure query_item_quantities is imported from sql_scripts.sql_extraction
                    quantity_df, start_date, end_date = query_item_quantities(
                        days=days_arg,
                        merchant_id=merchant.merchant_id # Pass the required merchant ID
                    )
                    print(f"Received {len(quantity_df)} items for range {start_date} to {end_date}")

                    # 3. Format the quantities into a readable string for the 'response' field
                    quantities_text = (f"Here are the actual quantities sold for merchant {merchant.merchant_id} "
                                       f"over {days_arg} days (from {start_date} to {end_date}):\n")
                    if not quantity_df.empty:
                        quantities_text += "\n".join([
                            # Use columns directly from the DataFrame
                            f"* {row['item_name']}: {int(row['total_quantity'])} units (Sales: ${row['total_sales']:.2f})"
                            for _, row in quantity_df.iterrows()
                        ])
                    else:
                        quantities_text += "No sales data found for this merchant in this period."

                    # 4. Prepare structured data payload for the 'data' field
                    # Ensure ItemQuantity and QuantitiesResponse are imported
                    items_list = [
                         ItemQuantity(item_name=row['item_name'], total_quantity=int(row['total_quantity']), total_sales=float(row['total_sales'])).dict()
                         for _, row in quantity_df.iterrows()
                    ]
                    data_payload = QuantitiesResponse(
                         days=days_arg, start_date=start_date, end_date=end_date, items=items_list
                     ).dict()

                    # 5. Return directly in the desired structure
                    return {
                        "response": quantities_text, # The user-facing text summary
                        "function_call": { # Echoing the function call
                            "name": function_name,
                            "args": function_args,
                        },
                        "data": data_payload # The structured data
                    }

                except (ValueError, Exception) as e:
                    # Handle errors during function execution or data processing
                    print(f"Error during '{function_name}' execution: {type(e).__name__} - {e}")
                    error_text = f"Sorry, I couldn't get the actual quantities due to an error: {e}"
                    # Return error response directly
                    return {
                        "response": error_text,
                        "function_call": { # Still useful to echo the call
                            "name": function_name,
                            "args": function_args,
                        },
                        "data": None
                    }
            
            # Standard response for functions in dictionary
            case _ if function_name in standard_functions:
                return {
                    "response": await chatFunctionHelper(
                        f'Successfully executed function "{function_name}" with args {function_args}',
                        formatted_history
                    ),
                    "function_call": {
                        "name": function_name,
                        "args": function_args,
                    }
                }
    else:
        return {
            "response": geminiResponse.text,
        }

# LLM function - for carrying through with Chatbot function calling
async def chatFunctionHelper(prompt: str, chat_history: List[Dict[str, Any]]):
    geminiModel = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        tools=gemini_function_declarations,
        system_instruction=open("./ai/prompts/chatbot_helper.txt", "r").read()
    )

    chat_session = geminiModel.start_chat(history=chat_history)

    print(prompt)
    geminiResponse = await chat_session.send_message_async( 
        prompt
    )

    return geminiResponse.text


# Login API
@app.post("/api/login", response_model=Token)
def login(reqBody: LoginRequest, db: Session = Depends(get_db)):
    merchant = (
        db.query(Merchant)
          .filter(Merchant.merchant_id == reqBody.merchant_id)
          .first()
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    token = create_access_token(data={"sub": merchant.merchant_id})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/getCustomersByMerchant")
async def get_customers(
    merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    result = db.execute(text(get_customers_sql(merchant.merchant_id)))
    rows = result.fetchall()
    cols = result.keys()
    data = [dict(zip(cols, row)) for row in rows]
    return {"results": data}