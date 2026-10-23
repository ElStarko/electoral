from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import VALID_ROLES, create_access_token, get_current_user, hash_password, verify_password
from database import get_db_session
from models import User
from schemas import Token, UserCreate, UserLogin, UserPublic

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic)
def register(user: UserCreate, db: Session = Depends(get_db_session)):
    if user.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")

    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = User(
        fullName=user.full_name,
        email=user.email,
        password=hash_password(user.password),
        role=user.role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"full_name": db_user.fullName, "email": db_user.email, "role": db_user.role}


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db_session)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": user.email, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.fullName,
    }


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)):
    return {"full_name": current_user.fullName, "email": current_user.email, "role": current_user.role}
