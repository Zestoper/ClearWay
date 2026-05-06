from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base


class Flight(Base):
    __tablename__ = "flights"

    id = Column(Integer, primary_key=True, index=True)
    flight_no = Column(String(10), unique=True, nullable=False)

    from_city = Column(String(50), nullable=False)
    from_code = Column(String(3), nullable=False)
    from_airport = Column(String(100), nullable=False)

    to_city = Column(String(50), nullable=False)
    to_code = Column(String(3), nullable=False)
    to_airport = Column(String(100), nullable=False)

    date = Column(Date, nullable=False)
    depart_time = Column(String(5), nullable=False)
    arrival_time = Column(String(5), nullable=False)
    duration = Column(String(10), nullable=False)

    economy_price = Column(Numeric(10, 2), nullable=False)
    business_price = Column(Numeric(10, 2), nullable=False)
    economy_seats = Column(Integer, default=120)
    business_seats = Column(Integer, default=20)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    is_direct = Column(Boolean, default=True, nullable=False)
    via_city = Column(String(50), nullable=True)

    bookings = relationship("Booking", back_populates="flight")
