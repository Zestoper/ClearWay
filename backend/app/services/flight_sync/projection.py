"""
실시간 API 범위(D+0 ~ D+6) 밖 날짜의 '예정편'을 만든다.

왜 이렇게 하나
- 공공 API는 7일치만 준다. 그런데 항공사 정기편은 시즌(하계 3월 말~10월 말 / 동계 그 외) 동안
  요일 단위로 똑같이 반복된다 → 최근 7일 실제 편 = 요일별 운항 패턴
- 그래서 D+7 이후는 같은 요일의 실제 편을 그대로 옮겨 '예정 스케줄'로 판매한다 (source = SCHED)

설계
- 1년치를 미리 만들면 약 60만 행 → 사용자가 검색한 노선·날짜만 그때 만든다 (지연 생성)
- sync_key 형식이 실데이터와 같다 → 그 날짜가 7일 안으로 들어오면 실데이터 수집이 같은 행을 덮어쓴다
  (예약은 그 행을 그대로 가리키므로 유지되고 시각·상태만 실제 값으로 바뀐다)
- 끝까지 실데이터에 나오지 않은 예정편은 운항 변경으로 판매 중지한다 (mark_unconfirmed)
"""
import logging
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.flight import Flight

from .builder import BOOKABLE_DAYS, KST, REAL_WINDOW_DAYS, _fares, _seats, today_kst
from .reference import route_of

log = logging.getLogger(__name__)

SOURCE = "SCHED"
REAL_SOURCES = ("KAC", "ICN")
UNCONFIRMED = "SCHEDULE_CHANGED"
# 실데이터가 확실히 다 들어와 있는 범위. D+6은 기관·수집 시각에 따라 덜 들어올 수 있어 하루 여유를 둔다
CONFIRM_DAYS = REAL_WINDOW_DAYS - 1


def is_projected_day(day: date, today: date | None = None) -> bool:
    today = today or today_kst()
    return today + timedelta(days=REAL_WINDOW_DAYS) < day <= today + timedelta(days=BOOKABLE_DAYS)


def ensure_projected(db: Session, origin: str, dest: str, day: date, today: date | None = None) -> int:
    """검색한 노선·날짜의 예정편을 만든다. 새로 만든 편 수를 돌려준다 (이미 있으면 0)."""
    today = today or today_kst()
    if not is_projected_day(day, today):
        return 0
    route = route_of(origin, dest)
    if not route:
        return 0

    real = (
        db.query(Flight)
        .filter(Flight.source.in_(REAL_SOURCES), Flight.from_code == origin, Flight.to_code == dest,
                Flight.date >= today, Flight.date <= today + timedelta(days=REAL_WINDOW_DAYS))
        .all()
    )
    templates = [f for f in real if f.date.weekday() == day.weekday()]
    if not templates:
        return 0

    existing = {
        k for (k,) in db.query(Flight.sync_key)
        .filter(Flight.from_code == origin, Flight.to_code == dest, Flight.date == day).all()
    }
    now = datetime.now(KST)
    created = 0
    for t in templates:
        key = f"{t.flight_no}|{day:%Y%m%d}|{origin}|{dest}"
        if key in existing:
            continue
        existing.add(key)
        eco, biz = _fares(key, route)
        eco_seats, biz_seats = _seats(key)
        db.add(Flight(
            sync_key=key, source=SOURCE, flight_no=t.flight_no, airline=t.airline,
            from_city=t.from_city, from_code=origin, from_airport=t.from_airport,
            to_city=t.to_city, to_code=dest, to_airport=t.to_airport,
            date=day, depart_time=t.depart_time, arrival_time=t.arrival_time, duration=t.duration,
            economy_price=eco, business_price=biz, economy_seats=eco_seats, business_seats=biz_seats,
            # 템플릿 날짜에 하루 결항했다고 1년 내내 결항으로 복사하지 않는다
            is_cancelled=False, is_direct=True, via_city=None,
            status="SCHEDULED", depart_estimated=None, synced_at=now,
        ))
        created += 1
    if created:
        try:
            db.commit()
        except Exception:  # noqa: BLE001 — 동시에 같은 검색이 들어와 sync_key가 겹친 경우
            db.rollback()
            log.warning("예정편 생성 충돌 %s→%s %s (다른 요청이 먼저 만듦)", origin, dest, day)
            return 0
        log.info("예정편 생성 %s→%s %s: %d편", origin, dest, day, created)
    return created


def mark_unconfirmed(db: Session, today: date | None = None) -> int:
    """실데이터 범위로 들어왔는데도 실데이터에 없는 예정편 → 판매 중지 (운항 변경).
    실데이터 수집이 성공했을 때만 호출해야 한다 (수집 실패를 운항 변경으로 오해하지 않도록)."""
    today = today or today_kst()
    n = (
        db.query(Flight)
        .filter(Flight.source == SOURCE, Flight.is_cancelled.is_(False),
                Flight.date >= today, Flight.date <= today + timedelta(days=CONFIRM_DAYS))
        .update({Flight.is_cancelled: True, Flight.status: UNCONFIRMED}, synchronize_session=False)
    )
    db.commit()
    return n
