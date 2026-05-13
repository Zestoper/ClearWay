from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    guest_name = Column(String(100), nullable=True)
    guest_email = Column(String(200), nullable=True)
    category = Column(String(50), nullable=False, default="기타")
    status = Column(String(20), nullable=False, default="open")
    admin_unread = Column(Integer, default=0, nullable=False)
    user_unread = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    messages = relationship("ChatMessage", back_populates="room", order_by="ChatMessage.created_at")
    user = relationship("User", foreign_keys=[user_id])


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("chat_rooms.id"), nullable=False)
    sender = Column(String(20), nullable=False)   # "user" | "admin"
    content = Column(Text, nullable=False)
    msg_type = Column(String(20), nullable=False, default="text")  # "text" | "image"
    created_at = Column(DateTime, server_default=func.now())

    room = relationship("ChatRoom", back_populates="messages")
