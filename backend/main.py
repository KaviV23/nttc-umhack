# main.py
import os
from fastapi import Depends, FastAPI, HTTPException
from dotenv import load_dotenv
# Assuming previous import issues were resolved or these are not needed for the dict approach:
# from google import genai
# from google.genai import types
# from google.genai.types import Content, Part # Removed Part
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
# Correct imports from sql_extraction needed for the case block
from sql_scripts.sql_extraction import router as sql_extraction_router, query_item_quantities, ItemQuantity, QuantitiesResponse

app = FastAPI()

# mount our forecasting router here
app.include_router(forecast_sales_router)
app.include_router(forecast_qty_router)
app.include_router(sql_extraction_router) # Ensure sql_extraction_router is defined via import

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Configure client - handle potential errors
try:
    genai.configure(api_key=GEMINI_API_KEY)
except Exception as e:
    print(f"Error configuring Gemini: {e}")
    # Consider how to handle this, maybe raise exception or log warning

# --- Functions ---
# Format chat history (Using Dicts)
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

    # Ensure Gemini is configured
    if not GEMINI_API_KEY:
         raise HTTPException(status_code=500, detail="Gemini API Key not configured.")

    try:
        geminiModel = genai.GenerativeModel(
            # Consider using a more recent/stable model if available e.g., gemini-1.5-flash-latest
            model_name="gemini-1.5-flash-latest",
            tools=gemini_function_declarations,
            system_instruction=open("./ai/prompts/prompt3.txt", "r").read()
        )
    except FileNotFoundError:
         print("Error: System prompt file './ai/prompts/prompt3.txt' not found.")
         raise HTTPException(status_code=500, detail="AI configuration error: System prompt missing.")
    except Exception as e:
        print(f"Error creating Gemini Model: {e}")
        raise HTTPException(status_code=500, detail="AI service initialization failed.")

    formatted_history = format_history_for_gemini(reqBody.history)

    try:
        chat_session = geminiModel.start_chat(history=formatted_history)

        print(f"Sending message to Gemini: {reqBody.message}")
        geminiResponse = await chat_session.send_message_async(
            reqBody.message,
        )
        print("Received initial response from Gemini.")

        # Safer access to response parts
        candidate = geminiResponse.candidates[0] if geminiResponse.candidates else None
        part = candidate.content.parts[0] if candidate and candidate.content and candidate.content.parts else None

    except Exception as e:
        print(f"Error during Gemini communication: {e}")
        raise HTTPException(status_code=503, detail=f"AI service communication error: {getattr(e, 'message', str(e))}")


    # Check for function call
    if part and part.function_call:
        function_call = part.function_call
        function_name = function_call.name
        function_args = dict(function_call.args) if function_call.args else {}
        print(f"Gemini requested function: {function_name}, Args: {function_args}")

        # Dictionary of functions that expect standard response (Using old helper)
        standard_functions = {
            "send_emails": True,
            "show_customers": True
        }

        match function_name:
            # Specialized functions - handle custom logic
            case "calculate_total_sales":
                # Keep original logic for now, assumes chatFunctionHelper exists
                # TODO: Refactor to use the dictionary-based function response flow if desired
                try:
                    forecast_data = forecast_orders(merchant)
                    total_sales = calculate_total_sales(forecast_data, days=int(function_args.get("days", 7))) # Ensure days is int
                    return {
                        "response": await chatFunctionHelper(
                            f'Total forecasted sales for {function_args.get("days", 7)} days: ${total_sales["total_forecasted_sales"]}',
                            formatted_history
                        ),
                        "function_call": {"name": function_name, "args": function_args},
                        "data": total_sales
                    }
                except Exception as e:
                     print(f"Error in calculate_total_sales: {e}")
                     # Inform user via helper (original pattern)
                     return {"response": await chatFunctionHelper(f"Sorry, I couldn't calculate total sales due to an error: {e}", formatted_history)}


            case "get_forecasted_quantities":
                # Keep original logic for now, assumes chatFunctionHelper exists
                # TODO: Refactor to use the dictionary-based function response flow if desired
                try:
                    days_arg = int(function_args.get("days", 7))
                    forecast_data = forecast_quantity(merchant)
                    quantities = get_forecasted_quantities(forecast_data, days=days_arg)
                    items = quantities.get("total_quantities_per_item", {})
                    quantities_text = f"Here are the forecasted quantities for the next {days_arg} days:\n"
                    if items:
                        quantities_text += "\n".join([f"* {item_name}: {int(round(qty))} units" for item_name, qty in items.items()])
                    else:
                        quantities_text += "No forecasted quantities available."

                    # Return directly (original pattern)
                    return {
                        "response": quantities_text,
                        "function_call": {"name": function_name, "args": function_args},
                        "data": quantities
                    }
                except Exception as e:
                     print(f"Error in get_forecasted_quantities: {e}")
                     # Inform user directly (original pattern)
                     return {"response": f"Sorry, I couldn't get forecast quantities due to an error: {e}"}


            # --- Modified Case using Dictionary Payloads ---
            case "get_actual_quantities":
                function_handler_result = None # Initialize result variable
                api_response = None # Initialize final API response
                try:
                    # 1. Extract and validate 'days' argument
                    days_arg = int(function_args.get("days", 7))
                    # Use validation range from sql_extraction.py (1-365)
                    if not 1 <= days_arg <= 365:
                        raise ValueError("Days parameter must be between 1 and 365 for this test setup")

                    # 2. Call the core logic function, passing the merchant_id
                    print(f"Executing query_item_quantities(days={days_arg}, merchant_id={merchant.merchant_id})")
                    quantity_df, start_date, end_date = query_item_quantities(
                        days=days_arg,
                        merchant_id=merchant.merchant_id # Pass the required merchant ID
                    )
                    print(f"Received {len(quantity_df)} items for range {start_date} to {end_date}")

                    # 3. Format text summary using actual dates
                    quantities_text = (f"Actual quantities sold for merchant {merchant.merchant_id} "
                                       f"over {days_arg} days (from {start_date} to {end_date}):\n")
                    if not quantity_df.empty:
                        quantities_text += "\n".join([
                            f"* {row['item_name']}: {int(row['total_quantity'])} units (Sales: ${row['total_sales']:.2f})"
                            for _, row in quantity_df.iterrows()
                        ])
                    else:
                        quantities_text += "No sales data found for this merchant in this period."

                    # 4. Prepare structured data payload
                    items_list = [
                         ItemQuantity(item_name=row['item_name'], total_quantity=int(row['total_quantity']), total_sales=float(row['total_sales'])).dict()
                         for _, row in quantity_df.iterrows()
                    ]
                    data_payload = QuantitiesResponse(
                         days=days_arg, start_date=start_date, end_date=end_date, items=items_list
                     ).dict()

                    # 5. Bundle results for Gemini FunctionResponse payload
                    function_handler_result = {
                         "summary": quantities_text, # For Gemini to potentially use
                         "data": data_payload      # Primarily for frontend display
                    }

                    # --- Now, send this result back to Gemini using DICTIONARY payload ---
                    print(f"Sending function response (dict) back to Gemini for: {function_name}")
                    function_response_payload = {          # <--- Create dict payload
                        "function_response": {
                            "name": function_name,
                            "response": function_handler_result # Send the dict containing summary/data
                        }
                    }
                    geminiResponse = await chat_session.send_message_async(function_response_payload) # Send the dict
                    print("Received final response from Gemini after function execution.")

                    # Prepare final response structure
                    api_response = {
                        "response": geminiResponse.text, # Gemini's final text incorporating the summary
                        "function_call": {"name": function_name, "args": function_args}, # Echo call
                        "data": function_handler_result.get("data") # The structured data
                    }

                except (ValueError, Exception) as e:
                    # Handle errors during function execution or data processing
                    print(f"Error during '{function_name}' execution: {type(e).__name__} - {e}")

                    # --- Inform Gemini about the error using DICTIONARY payload ---
                    error_response_payload = {             # <--- Create error dict payload
                        "function_response": {
                            "name": function_name,
                            "response": {"error": f"Failed to get actual quantities: {e}"}
                        }
                    }
                    try:
                        print("Sending error response (dict) back to Gemini...")
                        geminiResponse = await chat_session.send_message_async(error_response_payload) # Send the dict
                        error_text = geminiResponse.text
                        print(f"Gemini response to error: {error_text}")
                    except Exception as gemini_err:
                         print(f"Error sending error details back to Gemini: {gemini_err}")
                         error_text = f"Failed to execute function '{function_name}' due to: {e}. Could not get AI explanation."

                    # Prepare error response for frontend
                    api_response = {"response": error_text, "function_call": {"name": function_name, "args": function_args}, "data": None}

                # Return the final response (success or error) for this case
                return api_response
            # --- End Modified Case ---

            # Standard response for functions in dictionary (Original Pattern)
            case _ if function_name in standard_functions:
                # Keep original logic for now, assumes chatFunctionHelper exists
                try:
                     # TODO: Implement actual logic for standard functions if needed
                     return {
                         "response": await chatFunctionHelper(
                             f'Request acknowledged for function "{function_name}" with args {function_args}. (Implementation Pending)',
                             formatted_history
                         ),
                         "function_call": {
                             "name": function_name,
                             "args": function_args,
                         }
                         # No 'data' field specified in original
                     }
                except Exception as e:
                     print(f"Error in standard function {function_name}: {e}")
                     return {"response": await chatFunctionHelper(f"Sorry, encountered an error processing {function_name}: {e}", formatted_history)}

            # Default case if function name doesn't match
            case _:
                  print(f"Warning: Unhandled function call name: {function_name}")
                  # Inform Gemini using dict payload
                  unknown_func_payload = {
                        "function_response": {
                            "name": function_name,
                            "response": {"error": f"Function '{function_name}' is not recognized or handled by the system."}
                        }
                  }
                  try:
                        geminiResponse = await chat_session.send_message_async(unknown_func_payload)
                        unhandled_text = geminiResponse.text
                  except Exception as gemini_err:
                         print(f"Error sending unhandled function details back to Gemini: {gemini_err}")
                         unhandled_text = f"Function '{function_name}' was called but is not handled."
                  return {"response": unhandled_text}

    # --- If no function call, return direct text response ---
    elif part and part.text:
        return {"response": part.text}
    else:
        # Handle empty/blocked response
        print("Warning: Gemini response did not contain text or function call.")
        return {"response": "Sorry, I received an unexpected response from the AI. Please try again."}


# LLM function - Keep for other cases until refactored
async def chatFunctionHelper(prompt: str, chat_history: List[Dict[str, Any]]):
    # Ensure helper uses compatible model/config if kept
    try:
        helperModel = genai.GenerativeModel(
            model_name="gemini-1.5-flash-latest", # Match main model if possible
            # Tools might not be needed here if it just processes text
            # tools=gemini_function_declarations,
            system_instruction=open("./ai/prompts/chatbot_helper.txt", "r").read()
        )
        helper_session = helperModel.start_chat(history=chat_history) # Use passed history
        print(f"Helper sending prompt: {prompt}")
        geminiResponse = await helper_session.send_message_async(prompt)
        return geminiResponse.text
    except FileNotFoundError:
         print("Error: Chatbot helper prompt file missing.")
         return "Error: AI helper configuration missing."
    except Exception as e:
        print(f"Error in chatFunctionHelper: {e}")
        return f"Sorry, an error occurred in the AI helper: {e}"


# Login API (Unchanged from original)
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


# Get Customers API (Unchanged from original)
@app.get("/api/getCustomersByMerchant")
async def get_customers(
    merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    try:
        # Assuming get_customers_sql(merchant.merchant_id) returns a valid SQL string
        sql_query = get_customers_sql(merchant.merchant_id)
        if not isinstance(sql_query, str) or not sql_query.strip():
             raise ValueError("Generated customer query is invalid.")
        result = db.execute(text(sql_query))
        rows = result.fetchall()
        cols = result.keys()
        data = [dict(zip(cols, row)) for row in rows]
        return {"results": data}
    except Exception as e:
         print(f"Error in get_customers: {e}")
         raise HTTPException(status_code=500, detail="Failed to retrieve customer data.")