from typing import Any, Dict, List, Literal
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

class InsightsRequest(BaseModel):
    chart_title: str
    chart_data: List[Dict[str, Any]]
