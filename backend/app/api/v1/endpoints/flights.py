from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional
from datetime import date
from app.db.database import get_db
from app.models.flight import Flight
from app.models.booking import Booking, BookingStatus
from app.schemas.flight import FlightOut

router = APIRouter()


@router.get("", response_model=list[FlightOut])
def list_flights(
    from_code: Optional[str] = Query(None),
    to_code: Optional[str] = Query(None),
    date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Flight)
    if from_code:
        q = q.filter(Flight.from_code == from_code.upper())
    if to_code:
        q = q.filter(Flight.to_code == to_code.upper())
    if date:
        q = q.filter(Flight.date == date)
    return q.all()


@router.get("/{flight_id}", response_model=FlightOut)
def get_flight(flight_id: int, db: Session = Depends(get_db)):
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="항공편을 찾을 수 없습니다.")
    return flight


@router.get("/{flight_id}/seats")
def get_occupied_seats(flight_id: int, fare_class: str = Query(...), db: Session = Depends(get_db)):
    seats = (
        db.query(Booking.seat_number)
        .filter(
            Booking.flight_id == flight_id,
            Booking.fare_class == fare_class,
            Booking.seat_number.isnot(None),
            Booking.status != BookingStatus.cancelled,
        )
        .all()
    )
    return {"occupied": [s.seat_number for s in seats]}
