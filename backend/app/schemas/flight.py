from pydantic import BaseModel
from datetime import date
from decimal import Decimal


class FlightOut(BaseModel):
    id: int
    flight_no: str
    from_city: str
    from_code: str
    from_airport: str
    to_city: str
    to_code: str
    to_airport: str
    date: date
    depart_time: str
    arrival_time: str
    duration: str
    economy_price: Decimal
    business_price: Decimal
    economy_seats: int
    business_seats: int
    is_cancelled: bool
    is_direct: bool = True
    via_city: str | None = None

    model_config = {"from_attributes": True}
