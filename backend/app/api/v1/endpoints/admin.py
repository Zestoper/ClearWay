from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, datetime, timedelta, time
from pydantic import BaseModel
from app.db.database import get_db
from app.models.flight import Flight
from app.models.booking import Booking
from app.models.user import User
from app.schemas.flight import FlightOut
from app.schemas.booking import BookingOut
from app.api.v1.deps import get_admin_user
from app.core.config import settings


def _send_newsletter_emails(subject: str, html_content: str, emails: list) -> int:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD or not emails:
        return 0
    sent = 0
    from_addr = settings.SMTP_FROM_EMAIL or settings.SMTP_USER

    def _make_msg(to_email: str) -> MIMEMultipart:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"CLEARWAY <{from_addr}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html", "utf-8"))
        return msg

    try:
        # 포트 465: SSL 직접 연결 (네이버), 그 외: STARTTLS (Gmail 등)
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                for email in emails:
                    try:
                        server.sendmail(from_addr, email, _make_msg(email).as_string())
                        sent += 1
                    except Exception:
                        pass
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                for email in emails:
                    try:
                        server.sendmail(from_addr, email, _make_msg(email).as_string())
                        sent += 1
                    except Exception:
                        pass
    except Exception:
        pass
    return sent

router = APIRouter()


class FlightCreate(BaseModel):
    flight_no: str
    from_city: str = "서울"
    from_code: str = "ICN"
    from_airport: str = "인천국제공항"
    to_city: str
    to_code: str
    to_airport: str
    date: date
    depart_time: str
    arrival_time: str
    duration: str
    economy_price: float
    business_price: float
    economy_seats: int = 120
    business_seats: int = 20


class FlightUpdate(BaseModel):
    economy_price: Optional[float] = None
    business_price: Optional[float] = None
    economy_seats: Optional[int] = None
    business_seats: Optional[int] = None
    depart_time: Optional[str] = None
    arrival_time: Optional[str] = None
    duration: Optional[str] = None
    is_cancelled: Optional[bool] = None


@router.get("/stats")
def admin_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    total_flights = db.query(Flight).count()
    total_bookings = db.query(Booking).count()
    total_users = db.query(User).filter(User.is_admin == False).count()  # noqa
    revenue_rows = (
        db.query(Booking.price)
        .filter(Booking.status.in_(["confirmed", "checked_in", "completed"]))
        .all()
    )
    revenue = sum(float(r[0]) for r in revenue_rows)
    today_bookings = db.query(Booking).count()
    return {
        "total_flights": total_flights,
        "total_bookings": total_bookings,
        "total_users": total_users,
        "total_revenue": revenue,
        "today_bookings": today_bookings,
    }


@router.get("/flights", response_model=list[FlightOut])
def admin_list_flights(
    to_code: Optional[str] = None,
    flight_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    q = db.query(Flight)
    if to_code:
        q = q.filter(Flight.to_code == to_code.upper())
    if flight_date:
        q = q.filter(Flight.date == flight_date)
    return q.order_by(Flight.date, Flight.depart_time).limit(200).all()


@router.post("/flights", response_model=FlightOut, status_code=status.HTTP_201_CREATED)
def admin_create_flight(
    body: FlightCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    if db.query(Flight).filter(Flight.flight_no == body.flight_no).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 편명입니다.")
    flight = Flight(**body.model_dump())
    db.add(flight)
    db.commit()
    db.refresh(flight)
    return flight


@router.put("/flights/{flight_id}", response_model=FlightOut)
def admin_update_flight(
    flight_id: int,
    body: FlightUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="항공편을 찾을 수 없습니다.")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(flight, field, val)
    db.commit()
    db.refresh(flight)
    return flight


@router.delete("/flights/{flight_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_flight(
    flight_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="항공편을 찾을 수 없습니다.")
    db.delete(flight)
    db.commit()


@router.get("/members")
def admin_list_members(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    users = db.query(User).filter(User.is_admin == False).order_by(User.created_at.desc()).all()  # noqa
    result = []
    for u in users:
        booking_count = db.query(Booking).filter(Booking.user_id == u.id).count()
        total_spent = sum(float(b.price) for b in db.query(Booking).filter(
            Booking.user_id == u.id,
            Booking.status.in_(["confirmed", "checked_in", "completed"])
        ).all())
        result.append({
            "id": u.id, "name": u.name, "email": u.email,
            "tier": u.tier, "miles": u.miles,
            "created_at": str(u.created_at),
            "booking_count": booking_count, "total_spent": total_spent,
        })
    return result


@router.get("/bookings")
def admin_list_bookings(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    bookings = db.query(Booking).order_by(Booking.created_at.desc()).limit(200).all()
    return [BookingOut.model_validate(b).model_dump() for b in bookings]


@router.get("/revenue-stats")
def admin_revenue_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    today = date.today()

    # Daily: last 30 days
    daily = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        rev = db.query(func.sum(Booking.price)).filter(
            Booking.created_at >= datetime.combine(d, time(0, 0)),
            Booking.created_at < datetime.combine(d + timedelta(days=1), time(0, 0)),
            Booking.status.in_(["confirmed", "checked_in", "completed"])
        ).scalar() or 0
        daily.append({"date": str(d), "revenue": float(rev)})

    # Weekly: last 12 weeks
    weekly = []
    for i in range(11, -1, -1):
        start = today - timedelta(weeks=i + 1)
        end = today - timedelta(weeks=i)
        rev = db.query(func.sum(Booking.price)).filter(
            Booking.created_at >= datetime.combine(start, time(0, 0)),
            Booking.created_at < datetime.combine(end, time(0, 0)),
            Booking.status.in_(["confirmed", "checked_in", "completed"])
        ).scalar() or 0
        weekly.append({"week_start": str(start), "revenue": float(rev)})

    # Monthly: last 12 months
    monthly = []
    for i in range(11, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1)
        rev = db.query(func.sum(Booking.price)).filter(
            Booking.created_at >= datetime.combine(month_start, time(0, 0)),
            Booking.created_at < datetime.combine(month_end, time(0, 0)),
            Booking.status.in_(["confirmed", "checked_in", "completed"])
        ).scalar() or 0
        monthly.append({"month": month_start.strftime("%Y-%m"), "revenue": float(rev)})

    return {"daily": daily, "weekly": weekly, "monthly": monthly}


@router.get("/newsletter")
def list_newsletters(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    from app.models.newsletter import NewsletterLog
    return db.query(NewsletterLog).order_by(NewsletterLog.created_at.desc()).limit(50).all()


@router.get("/newsletter/subscribers")
def list_subscribers(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    users = (
        db.query(User)
        .filter(User.is_admin == False)  # noqa
        .order_by(User.created_at.desc())
        .all()
    )
    return [
        {"id": u.id, "name": u.name, "email": u.email, "tier": u.tier, "created_at": str(u.created_at)}
        for u in users
    ]


@router.post("/newsletter")
def send_newsletter(
    body: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    import threading
    from app.models.newsletter import NewsletterLog
    subject = body.get("subject", "").strip()
    content = body.get("content", "").strip()
    tier = body.get("recipient_tier") or None
    if not subject or not content:
        raise HTTPException(status_code=400, detail="제목과 내용을 입력해 주세요.")

    q = db.query(User).filter(User.is_admin == False, User.newsletter_subscribed == True, User.email_notifications == True)  # noqa
    if tier:
        mile_ranges = {"BLUE": (0, 49999), "RED": (50000, 199999), "RAINBOW": (200000, None)}
        rng = mile_ranges.get(tier)
        if rng:
            q = q.filter(User.miles >= rng[0])
            if rng[1] is not None:
                q = q.filter(User.miles <= rng[1])

    user_emails = [u.email for u in q.all() if u.email]
    sent_count = len(user_emails)

    log = NewsletterLog(
        subject=subject,
        content=content,
        recipient_tier=tier,
        sent_count=sent_count,
        sent_by_id=admin_user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    threading.Thread(
        target=_send_newsletter_emails,
        args=(subject, content, user_emails),
        daemon=True,
    ).start()

    return {
        "id": log.id,
        "subject": log.subject,
        "recipient_tier": log.recipient_tier,
        "sent_count": log.sent_count,
        "created_at": str(log.created_at),
    }


@router.get("/popular-routes")
def admin_popular_routes(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    rows = (
        db.query(
            Flight.from_code, Flight.to_code, Flight.from_city, Flight.to_city,
            func.count(Booking.id).label("count")
        )
        .join(Booking, Booking.flight_id == Flight.id)
        .group_by(Flight.from_code, Flight.to_code, Flight.from_city, Flight.to_city)
        .order_by(func.count(Booking.id).desc())
        .limit(10)
        .all()
    )
    return [
        {"from_code": r.from_code, "to_code": r.to_code,
         "from_city": r.from_city, "to_city": r.to_city, "count": r.count}
        for r in rows
    ]
