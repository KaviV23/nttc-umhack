from sqlalchemy import Column, Integer, String
from db.database import Base

class Merchant(Base):
    __tablename__ = "merchants"

    merchant_id = Column(Integer, primary_key=True, index=True)
    merchant_name= Column(String, unique=False, index=True)