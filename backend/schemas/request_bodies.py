from typing import List, Literal, Dict, Any
from pydantic import BaseModel

class HistoryMessage(BaseModel):
    sender: Literal['user', 'bot'] # Use Literal for specific values
    text: str

class PromptRequest(BaseModel): 
    message: str
    history: List[HistoryMessage]

class LoginRequest(BaseModel):
    merchant_id: str
    password: str

class InsightRequest(BaseModel):
    chart_title: str
    chart_data: List[Dict[str, Any]]