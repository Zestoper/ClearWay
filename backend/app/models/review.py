from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.db.base import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(50), nullable=False)
    route = Column(String(100), nullable=True)
    rating = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    review_type = Column(String(20), default="general")
    booking_ref = Column(String(10), nullable=True)
    plan_destination = Column(String(100), nullable=True)
    is_visible = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
