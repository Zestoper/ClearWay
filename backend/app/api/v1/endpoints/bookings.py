import random
import string
from datetime import datetime, date, time
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import get_db
from app.models.booking import Booking, BookingStatus
from app.models.flight import Flight
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingOut
from app.api.v1.deps import get_current_user, get_optional_user

router = APIRouter()


def _gen_ref() -> str:
    return "CW" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def _calc_miles(price: float, fare_class: str) -> int:
    rate = random.uniform(0.03, 0.05) if fare_class == "economy" else random.uniform(0.07, 0.10)
    return round(price * rate)


@router.get("/lookup", response_model=BookingOut)
def lookup_booking(
    booking_ref: str = Query(...),
    last_name: str = Query(...),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(
        Booking.booking_ref == booking_ref.upper(),
        Booking.passenger_last_name_en == last_name.upper(),
        Booking.user_id == None,  # 회원 계정에 연결된 예약은 비회원 조회 불가
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다. 예약번호와 성을 확인하거나, 이미 회원 계정에 연결된 예약입니다.")
    return booking


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    body: BookingCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    # 좌석 선점을 위한 FOR UPDATE 락
    flight = db.query(Flight).with_for_update().filter(Flight.id == body.flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="항공편을 찾을 수 없습니다.")
    if flight.is_cancelled:
        raise HTTPException(status_code=400, detail="운항이 중단된 항공편입니다.")

    if body.fare_class == "economy":
        if flight.economy_seats <= 0:
            raise HTTPException(status_code=400, detail="이코노미 좌석이 매진되었습니다.")
        flight.economy_seats -= 1
        price = float(flight.economy_price)
    else:
        if flight.business_seats <= 0:
            raise HTTPException(status_code=400, detail="비즈니스 좌석이 매진되었습니다.")
        flight.business_seats -= 1
        price = float(flight.business_price)

    price += float(body.seat_surcharge)

    ref = _gen_ref()
    while db.query(Booking).filter(Booking.booking_ref == ref).first():
        ref = _gen_ref()

    miles = _calc_miles(price, body.fare_class)

    booking = Booking(
        booking_ref=ref,
        user_id=current_user.id if current_user else None,
        flight_id=flight.id,
        fare_class=body.fare_class,
        seat_number=body.seat_number,
        passenger_name_ko=body.passenger_name_ko,
        passenger_last_name_en=body.passenger_last_name_en,
        passport_no=body.passport_no,
        email=body.email,
        phone=body.phone,
        price=price,
        miles_earned=miles,
    )
    db.add(booking)

    if current_user:
        current_user.miles = (current_user.miles or 0) + miles

    db.commit()
    db.refresh(booking)
    return booking


@router.post("/claim", response_model=BookingOut)
def claim_booking(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """비회원 예약을 현재 로그인한 회원 계정에 연결"""
    booking_ref = (body.get("booking_ref") or "").upper()
    last_name = (body.get("last_name") or "").upper()
    if not booking_ref or not last_name:
        raise HTTPException(status_code=400, detail="예약번호와 성을 입력해주세요.")
    booking = db.query(Booking).filter(
        Booking.booking_ref == booking_ref,
        Booking.passenger_last_name_en == last_name,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다. 예약번호와 성을 확인해주세요.")
    if booking.user_id is not None and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="이미 다른 계정에 연결된 예약입니다.")
    booking.user_id = current_user.id
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/me", response_model=list[BookingOut])
def my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Booking)
        .filter(Booking.user_id == current_user.id)
        .order_by(Booking.created_at.desc())
        .all()
    )


@router.get("/{booking_ref}", response_model=BookingOut)
def get_booking(
    booking_ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(
        Booking.booking_ref == booking_ref,
        Booking.user_id == current_user.id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다.")
    return booking


@router.post("/public/{booking_ref}/checkin", response_model=BookingOut)
def public_checkin(
    booking_ref: str,
    last_name: str = Query(...),
    db: Session = Depends(get_db),
):
    """비회원 체크인 – booking_ref + last_name 검증 (회원 연결 예약 불가)"""
    booking = db.query(Booking).filter(
        Booking.booking_ref == booking_ref.upper(),
        Booking.passenger_last_name_en == last_name.upper(),
        Booking.user_id == None,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다. 회원 계정에 연결된 예약은 로그인 후 체크인하세요.")
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(status_code=400, detail="이미 체크인되었거나 체크인할 수 없는 상태입니다.")

    _validate_checkin_time(booking)
    booking.status = BookingStatus.checked_in
    db.commit()
    db.refresh(booking)
    return booking


@router.post("/{booking_ref}/checkin", response_model=BookingOut)
def checkin(
    booking_ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(
        Booking.booking_ref == booking_ref,
        Booking.user_id == current_user.id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다.")
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(status_code=400, detail="이미 체크인되었거나 체크인할 수 없는 상태입니다.")

    _validate_checkin_time(booking)
    booking.status = BookingStatus.checked_in
    db.commit()
    db.refresh(booking)
    return booking


@router.post("/{booking_ref}/cancel")
def cancel_booking(
    booking_ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(
        Booking.booking_ref == booking_ref,
        Booking.user_id == current_user.id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다.")
    if booking.status not in (BookingStatus.confirmed, BookingStatus.checked_in):
        raise HTTPException(status_code=400, detail="취소할 수 없는 상태입니다.")

    # 환불율 계산
    flight = booking.flight
    depart_h, depart_m = map(int, flight.depart_time.split(":"))
    depart_dt = datetime.combine(flight.date, time(depart_h, depart_m))
    diff_days = (depart_dt - datetime.now()).total_seconds() / 86400
    if diff_days > 7:
        refund_rate = 1.0
    elif diff_days > 3:
        refund_rate = 0.9
    elif diff_days > 1:
        refund_rate = 0.7
    else:
        refund_rate = 0.0

    refund_amount = round(float(booking.price) * refund_rate)

    # 좌석 복구
    if booking.fare_class == "economy":
        flight.economy_seats += 1
    else:
        flight.business_seats += 1

    # 마일리지 차감
    if current_user and booking.miles_earned:
        current_user.miles = max(0, (current_user.miles or 0) - booking.miles_earned)
        booking.miles_earned = 0

    booking.status = BookingStatus.cancelled
    db.commit()
    db.refresh(booking)
    return {**BookingOut.model_validate(booking).model_dump(), "_refund_amount": refund_amount, "_refund_rate": refund_rate}


def _validate_checkin_time(booking: Booking):
    """출발 48시간 전 ~ 1시간 전까지 체크인 가능"""
    flight = booking.flight
    depart_h, depart_m = map(int, flight.depart_time.split(":"))
    depart_dt = datetime.combine(flight.date, time(depart_h, depart_m))
    now = datetime.now()
    diff_hours = (depart_dt - now).total_seconds() / 3600
    if diff_hours > 48:
        raise HTTPException(status_code=400, detail="체크인은 출발 48시간 전부터 가능합니다.")
    if diff_hours < 1:
        raise HTTPException(status_code=400, detail="출발 1시간 전 이후에는 체크인이 불가합니다.")
