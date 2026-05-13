from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.db.database import Base


class Notice(Base):
    __tablename__ = "notices"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(30), nullable=False)  # promotion/event/membership/notice
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    badge = Column(String(50), nullable=True)  # e.g. "HOT", "NEW", "D-7"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
