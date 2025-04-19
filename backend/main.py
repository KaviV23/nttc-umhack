# main.py
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
from forecasts.forecast_qty import router as forecast_qty_router
from forecasts.forecast_sales import router as forecast_sales_router, forecast_orders, calculate_total_sales

app = FastAPI()

# mount our forecasting router here
app.include_router(forecast_sales_router)
app.include_router(forecast_qty_router)

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
