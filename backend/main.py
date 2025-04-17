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

app = FastAPI()

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


# Endpoints
# Chatbot API
@app.post("/api/chat")
async def chat(reqBody: PromptRequest, merchant: Merchant = Depends(get_current_merchant)):

    # AI Agent Instructions
    geminiConf = types.GenerateContentConfig(
        system_instruction=open("./prompts/prompt3.txt", "r").read(),
    )

    geminiClient = genai.Client(api_key=GEMINI_API_KEY)
    geminiModel = "gemini-2.0-flash"

    geminiResponse = geminiClient.models.generate_content(
        model=geminiModel,
        config=geminiConf,
        contents=reqBody.message
    )

    return {
        "response": geminiResponse.text
    }

# Login API
@app.post("/api/login", response_model=Token)
def get_merchants(reqBody: LoginRequest, db: Session = Depends(get_db)):

    merchant = db.query(Merchant).filter(Merchant.merchant_id == reqBody.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    access_token = create_access_token(data={"sub": merchant.merchant_id})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/getCustomersByMerchant")
async def chat(merchant: Merchant = Depends(get_current_merchant), db: Session = Depends(get_db)):

    result = db.execute(text(get_customers_sql(merchant.merchant_id)))
    rows = result.fetchall()
    cols = result.keys()
    data = [dict(zip(cols, row)) for row in rows]

    return { "results": data }