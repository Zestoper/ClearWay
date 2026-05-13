from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.database import get_db
from app.models.notice import Notice
from app.api.v1.deps import get_admin_user
from app.models.user import User

router = APIRouter()


class NoticeCreate(BaseModel):
    category: str
    title: str
    content: str
    badge: Optional[str] = None
    is_active: bool = True


class NoticeUpdate(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    badge: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
def list_notices(category: Optional[str] = None, show_all: bool = False, db: Session = Depends(get_db)):
    q = db.query(Notice)
    if not show_all:
        q = q.filter(Notice.is_active == True)  # noqa
    if category:
        q = q.filter(Notice.category == category)
    return q.order_by(Notice.created_at.desc()).all()


@router.get("/{notice_id}")
def get_notice(notice_id: int, db: Session = Depends(get_db)):
    n = db.query(Notice).filter(Notice.id == notice_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    return n


@router.post("", status_code=status.HTTP_201_CREATED)
def create_notice(
    body: NoticeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    n = Notice(**body.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@router.put("/{notice_id}")
def update_notice(
    notice_id: int,
    body: NoticeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    n = db.query(Notice).filter(Notice.id == notice_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(n, field, val)
    db.commit()
    db.refresh(n)
    return n


@router.delete("/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    n = db.query(Notice).filter(Notice.id == notice_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    db.delete(n)
    db.commit()
