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

app = FastAPI()

# mount our forecasting router here
app.include_router(forecast_router)
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
        print(function_call)
        return {
            "response": await chatFunctionHelper(f'Successfully executed function "{function_call.name}" with args {dict(function_call.args)}', formatted_history),
            "function_call": {
                "name": function_call.name,
                "args": dict(function_call.args),
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
