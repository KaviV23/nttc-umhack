import json
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
from schemas.request_bodies import InsightRequest, LoginRequest, PromptRequest, HistoryMessage
from sql_scripts.get_customers_sql import get_customers_sql
from ai.tools import gemini_function_declarations # Assuming gemini_function_declarations is correctly defined elsewhere
# Make sure these imports are correct for your project structure
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
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY environment variable not set.")
    # Consider raising an error or exiting if the key is essential

# --- Functions ---
# Format chat history
def format_history_for_gemini(history: Optional[List[HistoryMessage]]) -> List[Dict[str, Any]]:
    if not history:
        return []

    gemini_history: List[Dict[str, Any]] = []
    for msg in history:
        role = 'user' if msg.sender == 'user' else 'model'
        # Ensure text is not None or empty before adding
        if msg.text and msg.text.strip():
            message_dict = {
                'role': role,
                'parts': [{'text': msg.text.strip()}] # Ensure text is stripped
            }
            gemini_history.append(message_dict)
        elif msg.sender == 'model' and msg.function_call: # Include model function calls if needed
             # TODO: Decide how to represent function calls in history if necessary
             # Example (adjust based on Gemini's expected format):
             # message_dict = {
             #     'role': role,
             #     'parts': [{'function_call': msg.function_call}]
             # }
             # gemini_history.append(message_dict)
             pass # Currently ignoring function calls in history formatting


    return gemini_history

# LLM function - for carrying through with Chatbot function calling
async def chatFunctionHelper(prompt: str, chat_history: List[Dict[str, Any]]):
    """Generates a conversational response based on a function call result or prompt."""
    if not GEMINI_API_KEY:
        print("Error in chatFunctionHelper: Gemini API Key not configured.")
        return "Error: AI service is not configured." # Return error message

    try:
        # Use a model suitable for generating text responses based on function outcomes
        # Consider using a slightly cheaper/faster model if appropriate
        helperModel = genai.GenerativeModel(
            model_name="gemini-1.5-flash-latest", # Or "gemini-pro" / "gemini-1.0-pro"
            # Tools are usually not needed for the helper, unless it needs to call functions itself
            # tools=gemini_function_declarations,
            system_instruction=open("./ai/prompts/chatbot_helper.txt", "r").read() # Use a dedicated helper prompt
        )

        # Start chat with the *original* history to maintain context
        chat_session = helperModel.start_chat(history=chat_history)

        print(f"Chat Helper Prompt: {prompt}")
        # Send the specific prompt about the function result
        geminiResponse = await chat_session.send_message_async(prompt)
        print(f"Chat Helper Response Raw: {geminiResponse}") # Log raw response

        response_text = ""
        if geminiResponse.candidates:
             candidate = geminiResponse.candidates[0]
             if candidate.content and candidate.content.parts:
                 response_text = candidate.content.parts[0].text.strip()

        if not response_text:
             # Handle blocked or empty responses from the helper
             block_reason = getattr(geminiResponse, 'prompt_feedback', {}).get('block_reason', 'None')
             finish_reason = getattr(geminiResponse.candidates[0], 'finish_reason', 'UNKNOWN') if geminiResponse.candidates else 'NO_CANDIDATES'
             print(f"Warning: Chat helper generated empty/blocked response. Reason: {block_reason}, Finish Reason: {finish_reason}")
             # Fallback response
             response_text = f"Okay, I've processed that request. ({prompt})" # Simple fallback

        return response_text

    except Exception as e:
        print(f"Error during chatFunctionHelper execution: {type(e).__name__} - {e}")
        # import traceback
        # print(traceback.format_exc())
        # Return a user-friendly error message
        return f"Sorry, I had trouble formulating a response for that action ({prompt})."


# --- Endpoints ---
# Chatbot API
@app.post("/api/chat")
async def chat(reqBody: PromptRequest, merchant: Merchant = Depends(get_current_merchant)):

    if not GEMINI_API_KEY:
        print("Error in /api/chat: Gemini API Key not configured.")
        raise HTTPException(status_code=503, detail="AI service is not configured.")

    try:
        geminiModel = genai.GenerativeModel(
            model_name="gemini-1.5-flash-latest", # Using a potentially more capable model
            tools=gemini_function_declarations,
            system_instruction=open("./ai/prompts/prompt3.txt", "r").read()
        )
    except Exception as e:
        print(f"Error initializing Gemini Model: {e}")
        raise HTTPException(status_code=500, detail="AI service initialization failed.")


    formatted_history = format_history_for_gemini(reqBody.history)

    chat_session = geminiModel.start_chat(history=formatted_history)

    try:
        print(f"Sending to Gemini: '{reqBody.message}' with history length {len(formatted_history)}")
        geminiResponse = await chat_session.send_message_async(
            reqBody.message,
        )
        print("Received response from Gemini.")
        # print(f"Gemini Raw Response: {geminiResponse}") # Optional: Log raw for deep debug

        # --- Process Response ---
        function_call_part = None
        response_text = ""

        if geminiResponse.candidates:
            candidate = geminiResponse.candidates[0]
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if part.function_call:
                        function_call_part = part
                        # A function call might exist alongside text, capture text too
                    if hasattr(part, 'text') and part.text:
                        response_text += part.text # Concatenate text parts if multiple exist

            # Check for finish reason (safety, etc.)
            finish_reason = getattr(candidate, 'finish_reason', None)
            if finish_reason and finish_reason != 1: # 1 = STOP (OK)
                print(f"Warning: Gemini response finish reason was {finish_reason}.")
                # Check safety ratings if available and configured
                safety_ratings = getattr(candidate, 'safety_ratings', [])
                # Add your safety check logic here if needed
                # Example: if any(rating.probability > 3 for rating in safety_ratings):
                #    raise HTTPException(status_code=400, detail="Response blocked due to safety concerns.")


        # --- Handle Function Call OR Text Response ---
        if function_call_part and function_call_part.function_call:
            function_call = function_call_part.function_call
            function_name = function_call.name
            # Ensure args is a dictionary, handle potential non-existence gracefully
            function_args = dict(function_call.args) if function_call.args else {}
            print(f"Function call detected: {function_name} with args: {function_args}")

            # --- Match Function Name ---
            match function_name:
                # Specialized functions - handle custom logic & response formatting
                case "calculate_total_sales":
                    try:
                        days_arg = int(function_args.get("days", 7)) # Default to 7 days
                        if not 1 <= days_arg <= 30: # Use validation from declaration
                             raise ValueError("Days must be between 1 and 30.")
                        forecast_data = forecast_orders(merchant)
                        total_sales = calculate_total_sales(forecast_data, days=days_arg)
                        # Use helper for conversational response
                        helper_prompt = (f"The total forecasted sales for the next {days_arg} days "
                                         f"are approximately ${total_sales['total_forecasted_sales']:.2f}. "
                                         f"Briefly confirm this calculation.")
                        return {
                            "response": await chatFunctionHelper(helper_prompt, formatted_history),
                            "function_call": { "name": function_name, "args": function_args },
                            "data": total_sales
                        }
                    except (ValueError, KeyError, Exception) as e:
                         print(f"Error during '{function_name}': {e}")
                         return {
                             "response": f"Sorry, I couldn't calculate total sales. Error: {e}",
                             "function_call": { "name": function_name, "args": function_args },
                             "data": None
                         }

                case "get_forecasted_quantities":
                    try:
                        days_arg = int(function_args.get("days", 7)) # Default to 7 days
                        if not 1 <= days_arg <= 30: # Use validation from declaration
                             raise ValueError("Days must be between 1 and 30.")
                        forecast_data = forecast_quantity(merchant)
                        quantities = get_forecasted_quantities(forecast_data, days=days_arg)
                        # Format quantities directly for the response text
                        quantities_text = f"Okay, here are the forecasted quantities for the next {days_arg} days:\n\n"
                        if quantities["total_quantities_per_item"]:
                             quantities_text += "\n".join([
                                f"* {item_name}: {int(round(qty))} units"
                                for item_name, qty in quantities["total_quantities_per_item"].items()
                             ])
                        else:
                            quantities_text += "No specific item forecasts available for this period."

                        return {
                            "response": quantities_text, # Direct text response
                            "function_call": { "name": function_name, "args": function_args },
                            "data": quantities
                        }
                    except (ValueError, KeyError, Exception) as e:
                         print(f"Error during '{function_name}': {e}")
                         return {
                             "response": f"Sorry, I couldn't get forecasted quantities. Error: {e}",
                             "function_call": { "name": function_name, "args": function_args },
                             "data": None
                         }

                case "get_actual_quantities":
                    try:
                        days_arg = int(function_args.get("days", 7)) # Default to 7 days
                        # Use validation range from sql_extraction.py (e.g., 1-365)
                        if not 1 <= days_arg <= 365:
                             raise ValueError("Days parameter must be between 1 and 365.")

                        print(f"Executing query_item_quantities(days={days_arg}, merchant_id={merchant.merchant_id})")
                        quantity_df, start_date, end_date = query_item_quantities(
                            days=days_arg, merchant_id=merchant.merchant_id
                        )
                        print(f"Received {len(quantity_df)} items for range {start_date} to {end_date}")

                        # Format quantities directly for the response text
                        quantities_text = (f"Alright, here are the actual quantities sold "
                                           f"over the past {days_arg} days ({start_date} to {end_date}):\n")
                        if not quantity_df.empty:
                            quantities_text += "\n".join([
                                f"* {row['item_name']}: {int(row['total_quantity'])} units (Sales: ${row['total_sales']:.2f})"
                                for _, row in quantity_df.iterrows()
                            ])
                        else:
                            quantities_text += "No sales data found for this period."

                        # Prepare structured data payload
                        items_list = [
                             ItemQuantity(item_name=row['item_name'], total_quantity=int(row['total_quantity']), total_sales=float(row['total_sales'])).dict()
                             for _, row in quantity_df.iterrows()
                        ]
                        data_payload = QuantitiesResponse(
                             days=days_arg, start_date=start_date, end_date=end_date, items=items_list
                         ).dict()

                        return {
                            "response": quantities_text, # Direct text response
                            "function_call": { "name": function_name, "args": function_args },
                            "data": data_payload
                        }
                    except (ValueError, Exception) as e:
                         print(f"Error during '{function_name}' execution: {type(e).__name__} - {e}")
                         return {
                             "response": f"Sorry, I couldn't get the actual quantities due to an error: {e}",
                             "function_call": { "name": function_name, "args": function_args },
                             "data": None
                         }

                # ============================================================
                # ====== START: MODIFIED SECTION FOR send_emails FUNCTION ======
                # ============================================================
                case "send_emails":
                    # Simple acknowledgement using the helper function
                    # The helper function should contain logic to give an appropriate response
                    # based on context (e.g., previous question about sending emails)
                    # This block now just triggers the helper.
                    should_send = function_args.get("send", False) # Still useful to extract arg for logging/helper context potentially
                    if not isinstance(should_send, bool):
                        print(f"Warning: 'send' argument for send_emails was not a boolean: {should_send}. Defaulting to False.")
                        should_send = False

                    # Generic prompt for the helper - it needs context from history to respond well
                    helper_prompt = f"The user responded regarding the request to send emails (function '{function_name}' triggered with args {function_args}). Please formulate an appropriate acknowledgement."

                    return {
                        "response": await chatFunctionHelper(helper_prompt, formatted_history),
                        "function_call": {
                            "name": function_name,
                            "args": {"send": should_send}, # Echo the arg back
                        }
                    }
                # ============================================================
                # ====== END: MODIFIED SECTION FOR send_emails FUNCTION ========
                # ============================================================

                case "show_customers":
                     # This function primarily triggers frontend navigation.
                     # Generate a response using the helper and add the follow-up question.
                     days_ago = function_args.get("daysAgo")
                     prompt_detail = f"with customers who last ordered more than {days_ago} days ago" if days_ago else "with the customer list"
                     helper_prompt = (f"Acknowledge the request to show customers has been processed ({prompt_detail}). "
                                      f"Then, ask the user if they would like to prepare emails for these customers.")

                     return {
                         "response": await chatFunctionHelper(helper_prompt, formatted_history),
                         "function_call": {
                             "name": function_name,
                             "args": function_args, # Pass args like daysAgo
                         }
                         # No 'data' needed if frontend handles fetching via navigation
                     }


                # Fallback for any other function calls defined in tools but not handled above
                case _:
                     print(f"Warning: Unhandled function call detected: {function_name}")
                     # Use helper for a generic "I did something" response
                     helper_prompt = f"Acknowledge that an action related to '{function_name}' with arguments {function_args} was triggered, but provide no specific details."
                     return {
                         "response": await chatFunctionHelper(helper_prompt, formatted_history),
                         "function_call": { # Still useful to return the call info
                             "name": function_name,
                             "args": function_args,
                         }
                     }
            # --- End Match ---

        # --- Handle cases WITHOUT function calls (Pure Text Response) ---
        else:
             print("No function call detected, returning text response.")
             # Ensure response_text has content, handle potential blocking
             if not response_text.strip():
                  # Check prompt feedback if available
                  block_reason = getattr(geminiResponse, 'prompt_feedback', {}).get('block_reason', 'None')
                  if block_reason != 'None':
                     print(f"Warning: Gemini response blocked. Reason: {block_reason}")
                     response_text = "I'm sorry, I cannot provide a response to that due to safety guidelines."
                  # Check finish reason if no block reason
                  elif geminiResponse.candidates and getattr(geminiResponse.candidates[0], 'finish_reason', 1) != 1:
                      finish_reason = getattr(geminiResponse.candidates[0], 'finish_reason', 'UNKNOWN')
                      print(f"Warning: Gemini response finished unexpectedly. Reason: {finish_reason}")
                      response_text = "I encountered an issue generating a complete response. Could you please try rephrasing?"
                  else:
                     print("Warning: Gemini response was empty.")
                     response_text = "I received your message, but I don't have a specific response for that right now."

             return {"response": response_text.strip()} # Return only the text response

    except Exception as e:
        print(f"Error during Gemini API call or response processing: {type(e).__name__} - {e}")
        # import traceback
        # print(traceback.format_exc()) # Detailed traceback for server logs
        # Return a generic error to the client
        raise HTTPException(status_code=500, detail=f"An error occurred while processing your chat request.")


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

# --- NEW ENDPOINT FOR CHART INSIGHTS ---
@app.post("/api/generate_insights")
async def generate_insights(
    reqBody: InsightRequest, # Use the existing schema
    merchant: Merchant = Depends(get_current_merchant) # Require authentication
):
    """
    Generates AI-powered insights based on provided chart data.
    """
    # 1. Configuration Check
    if not GEMINI_API_KEY:
         print("Error: Gemini API Key not configured for /api/generate_insights.")
         raise HTTPException(status_code=500, detail="AI service is not configured.")

    # 2. Validate Input Data (Basic Check)
    if not reqBody.chart_data:
        print(f"Warning: Empty chart_data received for '{reqBody.chart_title}' from merchant {merchant.merchant_id}.")
        # Return a specific message instead of calling LLM with no data
        return {"insight": "No data provided for analysis."}
        # Or raise HTTPException(status_code=400, detail="chart_data cannot be empty.")

    # 3. Initialize Gemini Model (Simpler config for direct generation)
    try:
        # Use a model suitable for text generation/analysis.
        # No tools or complex system prompt needed here usually.
        insightModel = genai.GenerativeModel(model_name="gemini-1.5-flash-latest") # Or "gemini-pro"
    except Exception as e:
        print(f"Error creating Gemini Model for insights: {e}")
        raise HTTPException(status_code=500, detail="AI service initialization failed.")

    # 4. Construct the Prompt
    try:
        # Convert chart data to a pretty-printed JSON string for the prompt
        data_string = json.dumps(reqBody.chart_data, indent=2)

        # Limit data string length if necessary to avoid exceeding token limits
        max_data_length = 4000 # Example limit, adjust as needed
        if len(data_string) > max_data_length:
            data_string = data_string[:max_data_length] + "\n... (data truncated)"
            print(f"Warning: Chart data for '{reqBody.chart_title}' truncated for prompt.")

        # Craft the prompt
        prompt = f"""Analyze the following data for the chart titled "{reqBody.chart_title}" displayed on a business dashboard for merchant ID '{merchant.merchant_id}'.

Provide 2-3 concise bullet points summarizing the most important insights, trends, or anomalies found in the data. Focus on information that would be actionable or noteworthy for the business owner.

Data:
{data_string}

Insights:
"""
        print(f"--- Generating Insight Prompt for: {reqBody.chart_title} ---")
        # print(prompt) # Uncomment to debug the exact prompt being sent
        print("--- End Prompt ---")

    except Exception as e:
        print(f"Error formatting data for prompt: {e}")
        raise HTTPException(status_code=500, detail="Error processing chart data for AI analysis.")


    # 5. Call Gemini API
    try:
        print(f"Sending insight generation request to Gemini for '{reqBody.chart_title}'...")
        # Use generate_content_async for a single-turn request
        geminiResponse = await insightModel.generate_content_async(prompt)
        print(f"Received insight response from Gemini for '{reqBody.chart_title}'.")

        # 6. Process Response
        generated_text = ""
        # Safer access and check for blocked content
        if geminiResponse.candidates:
            candidate = geminiResponse.candidates[0]
            if candidate.content and candidate.content.parts:
                generated_text = candidate.content.parts[0].text.strip()
            # Check for finish reason (e.g., safety block)
            finish_reason = getattr(candidate, 'finish_reason', None)
            if finish_reason and finish_reason != 1: # 1 is typically "STOP" (successful completion)
                 print(f"Warning: Gemini response finish reason for '{reqBody.chart_title}' was {finish_reason}.")
                 # Check safety ratings if available
                 safety_ratings = getattr(candidate, 'safety_ratings', [])
                 if any(rating.probability > 3 for rating in safety_ratings): # Example: Check if probability > MEDIUM
                     raise HTTPException(status_code=400, detail="Insight generation blocked due to safety concerns.")

        if not generated_text:
             print(f"Warning: Empty insight generated for '{reqBody.chart_title}'. Response: {geminiResponse}")
             # Check prompt feedback for block reason
             block_reason = getattr(geminiResponse, 'prompt_feedback', {}).get('block_reason', 'None')
             if block_reason != 'None':
                  detail_msg = f"Insight generation failed or was blocked (Reason: {block_reason})."
                  raise HTTPException(status_code=503, detail=detail_msg)
             else:
                  raise HTTPException(status_code=503, detail="AI failed to generate an insight from the provided data.")


        print(f"Generated Insight:\n{generated_text}")
        return {"insight": generated_text}

    except HTTPException as http_exc:
         # Re-raise HTTP exceptions to be handled by FastAPI
         raise http_exc
    except Exception as e:
        print(f"Error during Gemini insight generation for '{reqBody.chart_title}': {type(e).__name__} - {e}")
        # Provide a generic error to the client
        raise HTTPException(status_code=503, detail=f"AI service communication error during insight generation: {getattr(e, 'message', str(e))}")
