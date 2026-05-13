from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import httpx
from app.db.database import get_db
from app.models.inquiry import FAQ, Inquiry
from app.api.v1.deps import get_admin_user, get_optional_user
from app.models.user import User
from app.core.config import settings

router = APIRouter()


@router.get("/faqs")
def list_faqs(category: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(FAQ)
    if category:
        q = q.filter(FAQ.category == category)
    return q.order_by(FAQ.category, FAQ.order_num).all()


@router.post("/inquiries", status_code=status.HTTP_201_CREATED)
def create_inquiry(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    inq = Inquiry(
        user_id=current_user.id if current_user else None,
        name=body.get("name", ""),
        email=body.get("email", ""),
        category=body.get("category", "기타"),
        subject=body.get("subject", ""),
        content=body.get("content", ""),
    )
    db.add(inq)
    db.commit()
    db.refresh(inq)
    return inq


@router.get("/inquiries/me")
def my_inquiries(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if not current_user:
        return []
    return (
        db.query(Inquiry)
        .filter(Inquiry.user_id == current_user.id)
        .order_by(Inquiry.created_at.desc())
        .all()
    )


@router.get("/inquiries")
def admin_list_inquiries(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return db.query(Inquiry).order_by(Inquiry.created_at.desc()).all()


@router.put("/inquiries/{inq_id}/answer")
def answer_inquiry(
    inq_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    inq = db.query(Inquiry).filter(Inquiry.id == inq_id).first()
    if not inq:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    inq.answer = body.get("answer", "")
    inq.status = "answered"
    inq.answered_at = datetime.now()
    db.commit()
    db.refresh(inq)
    return inq


_CS_SYSTEM = """당신은 CLEARWAY 항공사의 AI 고객상담원입니다. 친절하고 간결하게 한국어로 답변하세요.
- CLEARWAY는 인천국제공항(ICN) 허브 항공사입니다.
- 무료취소: 출발 72시간 전까지. 이후 위약금 발생.
- 수하물: 이코노미 20kg, 비즈니스 30kg 무료. 초과 1kg당 15,000원.
- 마일리지: 예약마다 적립, 1점=1원, 유효기간 3년.
- 온라인 체크인: 출발 24시간~1시간 전 가능.
- 정확히 알 수 없는 정보는 "더 자세한 안내는 '1:1 채팅 상담' 탭에서 상담사와 직접 대화해 보세요."라고 안내하세요. 절대 '고객센터에 문의하세요'라는 표현은 사용하지 마세요.
- 200자 이내로 핵심만 답변하세요."""


class AIChatMsg(BaseModel):
    role: str
    content: str

class AIChatRequest(BaseModel):
    messages: List[AIChatMsg]


@router.post("/ai-chat")
def ai_chat(body: AIChatRequest):
    msgs = [{"role": m.role, "content": m.content} for m in body.messages]
    provider = settings.AI_PROVIDER.lower()

    if provider == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY 미설정")
        import anthropic as ant
        client = ant.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        result = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=_CS_SYSTEM,
            messages=msgs,
        )
        return {"reply": result.content[0].text}

    elif provider == "groq":
        if not settings.GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY 미설정")
        resp = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "system", "content": _CS_SYSTEM}] + msgs, "max_tokens": 400},
            timeout=30.0,
        )
        resp.raise_for_status()
        return {"reply": resp.json()["choices"][0]["message"]["content"]}

    elif provider == "gemini":
        if not settings.GOOGLE_API_KEY:
            raise HTTPException(status_code=500, detail="GOOGLE_API_KEY 미설정")
        contents = [{"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]} for m in msgs]
        resp = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GOOGLE_API_KEY}",
            json={"contents": contents, "systemInstruction": {"parts": [{"text": _CS_SYSTEM}]}},
            timeout=30.0,
        )
        resp.raise_for_status()
        return {"reply": resp.json()["candidates"][0]["content"]["parts"][0]["text"]}

    else:
        raise HTTPException(status_code=500, detail=f"알 수 없는 AI_PROVIDER: {provider}")
