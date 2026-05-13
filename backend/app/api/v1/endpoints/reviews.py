from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.db.database import get_db
from app.models.review import Review
from app.models.user import User
from app.api.v1.deps import get_optional_user, get_current_user

router = APIRouter()


class ReviewCreate(BaseModel):
    user_name: str
    route: Optional[str] = None
    rating: int
    text: str
    review_type: str = "general"
    booking_ref: Optional[str] = None
    plan_destination: Optional[str] = None


class ReviewUpdate(BaseModel):
    rating: int
    text: str


def _review_dict(r: Review) -> dict:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "user_name": r.user_name,
        "route": r.route,
        "rating": r.rating,
        "text": r.text,
        "review_type": r.review_type,
        "plan_destination": r.plan_destination,
        "booking_ref": r.booking_ref,
        "created_at": str(r.created_at),
    }


@router.get("")
def list_reviews(limit: int = 20, db: Session = Depends(get_db)):
    reviews = (
        db.query(Review)
        .filter(Review.is_visible == True)  # noqa
        .order_by(Review.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_review_dict(r) for r in reviews]


@router.get("/me")
def my_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reviews = (
        db.query(Review)
        .filter(Review.user_id == current_user.id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return [_review_dict(r) for r in reviews]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_review(
    body: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if not 1 <= body.rating <= 5:
        raise HTTPException(status_code=400, detail="평점은 1~5 사이어야 합니다.")
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="후기 내용을 입력해 주세요.")

    name = body.user_name.strip() or (current_user.name if current_user else "익명")
    review = Review(
        user_id=current_user.id if current_user else None,
        user_name=name,
        route=body.route,
        rating=body.rating,
        text=body.text,
        review_type=body.review_type,
        booking_ref=body.booking_ref,
        plan_destination=body.plan_destination,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return {"id": review.id, "message": "후기가 등록되었습니다."}


@router.put("/{review_id}")
def update_review(
    review_id: int,
    body: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="후기를 찾을 수 없습니다.")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
    if not 1 <= body.rating <= 5:
        raise HTTPException(status_code=400, detail="평점은 1~5 사이어야 합니다.")
    review.rating = body.rating
    review.text = body.text.strip()
    db.commit()
    db.refresh(review)
    return _review_dict(review)


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="후기를 찾을 수 없습니다.")
    if review.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    db.delete(review)
    db.commit()
