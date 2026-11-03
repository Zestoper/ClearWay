from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime, timedelta
from sqlalchemy import or_
from app.db.database import get_db
from app.models.flight import Flight
from app.models.booking import Booking, BookingStatus
from app.schemas.flight import FlightOut
from app.services.flight_sync.builder import BOOKABLE_DAYS, KST, REAL_WINDOW_DAYS, today_kst
from app.services.flight_sync.projection import ensure_projected
from app.services.fares import apply_live_fares

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
    # 판매 범위: 오늘 ~ 1년 뒤 (한국 시간)
    # - D+0 ~ D+6: 공공 API 실데이터 / D+7 이후: 같은 요일 실제 편으로 만든 예정 스케줄 (projection.py)
    # 날짜 없이 조회하면 실데이터 범위만 보여준다 (예정편은 노선·날짜 검색 때만 만들어진다)
    today = today_kst()
    last_day = today + timedelta(days=BOOKABLE_DAYS if date else REAL_WINDOW_DAYS)
    if date and not (today <= date <= last_day):
        return []

    if from_code and to_code and date:
        ensure_projected(db, from_code.upper(), to_code.upper(), date, today)
        # 실시세를 먼저 반영 (캐시·월 예산 안에서만 호출 / 실패 시 산정가 유지)
        apply_live_fares(db, from_code.upper(), to_code.upper(), date)

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
