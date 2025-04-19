# main.py
import os
from fastapi import Depends, FastAPI, HTTPException
from dotenv import load_dotenv
from google import genai
from google.genai import types
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth.auth import create_access_token
from auth.dependencies import get_current_merchant
from db.dependencies import get_db
from models.merchant import Merchant
from schemas.merchant import Token
from schemas.request_bodies import LoginRequest, PromptRequest
from sql_scripts.get_customers_sql import get_customers_sql
from ai.tools import show_customers_function
from forecast import router as forecast_router

app = FastAPI()

# mount our forecasting router here
app.include_router(forecast_router)

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


@app.post("/api/chat")
async def chat(
    reqBody: PromptRequest,
    merchant: Merchant = Depends(get_current_merchant)
):
    geminiTools = types.Tool(function_declarations=[show_customers_function])
    geminiConf = types.GenerateContentConfig(
        system_instruction=open("./ai/prompts/prompt3.txt").read(),
        tools=[geminiTools]
    )
    client = genai.Client(api_key=GEMINI_API_KEY)
    resp = client.models.generate_content(
        model="gemini-2.0-flash",
        config=geminiConf,
        contents=reqBody.message
    )
    candidate = resp.candidates[0].content.parts[0]
    if candidate.function_call:
        return {
            "response": "Alright, here are your customers!",
            "function_call": {
                "name": candidate.function_call.name,
                "args": candidate.function_call.args,
            }
        }
    return {"response": resp.text}


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
