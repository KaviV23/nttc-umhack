import os
from pydantic import BaseModel
from fastapi import FastAPI
from dotenv import load_dotenv
from google import genai
from google.genai import types

app = FastAPI()

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Models
class PromptRequest(BaseModel): 
    message: str

# Function Declaration for AI
forecast_sales_by_merchant_


# Endpoints
@app.post("/api/chat")
async def chat(reqBody: PromptRequest):

    # AI Agent Tools - Functions available to AI
    tools = types.Tool(function_declarations=[forecast_sales_by_merchant])

    # AI Agent Instructions
    geminiConf = types.GenerateContentConfig(
        system_instruction=open("./prompts/prompt3.txt", "r").read(),
        tools=[tools]
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