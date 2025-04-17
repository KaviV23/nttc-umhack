from pydantic import BaseModel

class PromptRequest(BaseModel): 
    message: str

class LoginRequest(BaseModel):
    merchant_id: str
    password: str