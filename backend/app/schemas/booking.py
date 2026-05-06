from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from app.schemas.flight import FlightOut


class BookingCreate(BaseModel):
    flight_id: int
    fare_class: str
    seat_number: str | None = None
    seat_surcharge: int = 0
    passenger_name_ko: str
    passenger_last_name_en: str
    passport_no: str
    email: str
    phone: str


class BookingOut(BaseModel):
    booking_ref: str
    fare_class: str
    seat_number: str | None
    passenger_name_ko: str
    passenger_last_name_en: str
    passport_no: str
    email: str
    phone: str
    price: Decimal
    miles_earned: int
    status: str
    created_at: datetime
    flight: FlightOut

    model_config = {"from_attributes": True}
