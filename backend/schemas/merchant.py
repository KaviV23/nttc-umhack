from pydantic import BaseModel

class Merchant(BaseModel):
    merchant_id: str
    merchant_name: str

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    merchant_id: str