from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base

class TripPlan(Base):
    __tablename__ = "trip_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(300))
    destination = Column(String(100))
    destination_en = Column(String(100))
    arrival_date = Column(String(20))
    arrival_time = Column(String(10))
    departure_date = Column(String(20))
    departure_time = Column(String(10))
    hotel_location = Column(String(500))
    travel_style = Column(String(20))
    travel_types = Column(JSON)
    food_restrictions = Column(JSON)
    transport = Column(String(20))
    budget = Column(String(20))
    companion = Column(String(20))
    booking_ref = Column(String(20), nullable=True)
    status = Column(String(20), default="pending")
    plan_data = Column(JSON, nullable=True)
    error_msg = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
