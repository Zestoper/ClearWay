from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import enum


class BookingStatus(str, enum.Enum):
    confirmed = "confirmed"
    checked_in = "checked_in"
    completed = "completed"
    cancelled = "cancelled"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_ref = Column(String(12), unique=True, nullable=False, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable = 비회원 예약 허용
    flight_id = Column(Integer, ForeignKey("flights.id"), nullable=False)

    fare_class = Column(Enum("economy", "business"), nullable=False)
    seat_number = Column(String(4), nullable=True)

    passenger_name_ko = Column(String(50), nullable=False)
    passenger_last_name_en = Column(String(50), nullable=False)
    passport_no = Column(String(20), nullable=False)
    email = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)

    price = Column(Numeric(10, 2), nullable=False)
    miles_earned = Column(Integer, default=0, nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.confirmed)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="bookings", foreign_keys=[user_id])
    flight = relationship("Flight", back_populates="bookings")
