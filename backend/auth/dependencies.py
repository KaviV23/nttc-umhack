from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from db.dependencies import get_db
from models.merchant import Merchant
from schemas.merchant import TokenData
from auth.auth import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_merchant_by_merchant_id(db: Session, merchant_id: str):
    return db.query(Merchant).filter(Merchant.merchant_id == merchant_id).first()

async def get_current_merchant(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        merchant_id = payload.get("sub")
        if merchant_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    merchant = get_merchant_by_merchant_id(db, merchant_id)
    if merchant is None:
        raise credentials_exception
    return merchant
