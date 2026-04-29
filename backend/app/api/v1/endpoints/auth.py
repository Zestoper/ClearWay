import threading
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut, Token
from app.core.security import hash_password, verify_password, create_access_token
from app.api.v1.deps import get_current_user

router = APIRouter()


def _send_welcome_email(name: str, email: str) -> None:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from app.core.config import settings

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return

    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px">
      <h2 style="color:#1d4ed8;margin:0 0 8px">안녕하세요, {name}님!</h2>
      <p style="color:#374151;line-height:1.7;margin:0 0 16px">
        CLEARWAY 회원가입을 환영합니다.<br>
        앞으로 특가 항공권, 이벤트, 서비스 소식을 이메일로 보내드리겠습니다.
      </p>
      <a href="http://localhost:5173" style="display:inline-block;padding:12px 28px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">CLEARWAY 바로가기</a>
      <p style="margin-top:24px;font-size:12px;color:#9ca3af">본 메일은 회원가입 시 자동으로 발송됩니다.</p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "CLEARWAY에 오신 것을 환영합니다!"
    msg["From"] = f"CLEARWAY <{settings.SMTP_FROM_EMAIL or settings.SMTP_USER}>"
    msg["To"] = email
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as srv:
                srv.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                srv.sendmail(msg["From"], email, msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as srv:
                srv.ehlo(); srv.starttls()
                srv.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                srv.sendmail(msg["From"], email, msg.as_string())
    except Exception:
        pass


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(body: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        newsletter_subscribed=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    threading.Thread(target=_send_welcome_email, args=(user.name, user.email), daemon=True).start()
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
