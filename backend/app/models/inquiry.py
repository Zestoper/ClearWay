from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.database import Base


class FAQ(Base):
    __tablename__ = "faqs"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False)  # booking/checkin/refund/baggage/miles/etc
    question = Column(String(300), nullable=False)
    answer = Column(Text, nullable=False)
    order_num = Column(Integer, default=0)


class Inquiry(Base):
    __tablename__ = "inquiries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    subject = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String(20), default="pending")  # pending/answered
    answer = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    answered_at = Column(DateTime, nullable=True)
