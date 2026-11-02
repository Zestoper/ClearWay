from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime, timedelta
from sqlalchemy import or_
from app.db.database import get_db
from app.models.flight import Flight
from app.models.booking import Booking, BookingStatus
from app.schemas.flight import FlightOut
from app.services.flight_sync.builder import KST, WINDOW_DAYS, today_kst

router = APIRouter()

@router.get("", response_model=list[FlightOut])
def list_flights(
    from_code: Optional[str] = Query(None),
    to_code: Optional[str] = Query(None),
    date: Optional[date] = Query(None),
    limit: int = Query(default=300, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    # 실데이터(공공 API) 항공편만 판매한다. 범위는 수집 가능한 오늘 ~ D+6 (한국 시간)
    today = today_kst()
    last_day = today + timedelta(days=WINDOW_DAYS)
    if date and not (today <= date <= last_day):
        return []

    q = db.query(Flight).filter(
        Flight.source != "mock",
        Flight.is_cancelled.is_(False),
        Flight.date >= today,
        Flight.date <= last_day,
        # 오늘 편은 아직 출발 전인 것만 (시각은 'HH:MM' 문자열이라 문자열 비교로 충분)
        or_(Flight.date > today, Flight.depart_time > datetime.now(KST).strftime("%H:%M")),
    )
    if from_code:
        q = q.filter(Flight.from_code == from_code.upper())
    if to_code:
        q = q.filter(Flight.to_code == to_code.upper())
    if date:
        q = q.filter(Flight.date == date)
    return q.order_by(Flight.date, Flight.depart_time).offset(offset).limit(limit).all()

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
