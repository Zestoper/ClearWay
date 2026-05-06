from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate, PasswordChange
from app.core.security import hash_password, verify_password
from app.api.v1.deps import get_current_user

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(body: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if body.email and body.email != current_user.email:
        if db.query(User).filter(User.email == body.email, User.id != current_user.id).first():
            raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
        current_user.email = body.email
    if body.name:
        current_user.name = body.name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(body: PasswordChange, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="새 비밀번호는 6자 이상이어야 합니다.")
    current_user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "비밀번호가 변경되었습니다."}


@router.get("/me/newsletter")
def get_newsletter_subscription(current_user: User = Depends(get_current_user)):
    return {"subscribed": bool(current_user.newsletter_subscribed)}


@router.put("/me/newsletter")
def update_newsletter_subscription(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.newsletter_subscribed = bool(body.get("subscribed", False))
    db.commit()
    return {"subscribed": bool(current_user.newsletter_subscribed)}


@router.get("/me/email-notifications")
def get_email_notifications(current_user: User = Depends(get_current_user)):
    return {"enabled": bool(current_user.email_notifications)}


@router.put("/me/email-notifications")
def update_email_notifications(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.email_notifications = bool(body.get("enabled", True))
    db.commit()
    return {"enabled": bool(current_user.email_notifications)}
