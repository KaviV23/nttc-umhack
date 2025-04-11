from typing import Union

from fastapi import FastAPI
from pydantic import BaseModel
import requests
import json
import os
from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

class Prompt(BaseModel):
    message: str

@app.post("/api/chat")
def create_chat(prompt: Prompt):
    openAIUrl = os.getenv("OPENAI_API_URL")

    headers = {
        'Content-Type': 'application/json'
    }

    messages = [
        {"role": "system", "content": """You are a business data assistant for a food merchant. 
         You will be speaking to the user in first person.
         """},
        {"role": "user", "content": prompt.message}
    ]

    body = json.dumps({
        "model": "TheBloke/TinyLlama-1.1B-Chat-v0.3-AWQ",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1000,
        "stop": ["<|im_end|>"]
    })

    response = requests.request("POST", openAIUrl, headers=headers, data=body)

    resDict = response.json()
    print(resDict)
    return {"response": resDict["choices"][0]["message"]["content"]}