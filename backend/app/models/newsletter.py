from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class NewsletterLog(Base):
    __tablename__ = "newsletter_logs"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    recipient_tier = Column(String(20), nullable=True)   # None = 전체
    sent_count = Column(Integer, default=0, nullable=False)
    sent_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
