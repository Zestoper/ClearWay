"""
검색 시점에 실시세를 붙이는 서비스.

흐름
1) 사용자가 출발지·도착지·날짜로 검색
2) 같은 노선·날짜를 캐시 시간(기본 12시간) 안에 조회한 적이 있으면 → 호출하지 않음
3) 이번 달 사용량이 예산(기본 230회 / 무료 250회)에 닿았으면 → 호출하지 않음
4) 호출해서 편명이 일치하는 항공편의 일반석 가격을 DB에 저장 (price_source='live')
   → 검색 화면과 실제 결제 금액이 같은 값을 쓴다
5) 매칭 안 된 편 / 호출 실패 / 예산 소진 → 기존 노선 기준 산정가 그대로 (폴백)

검색 자체가 실패하면 안 되므로 이 함수 안의 오류는 전부 삼키고 기록만 남긴다.
"""
import logging
import threading
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fare_lookup import FareLookup
from app.models.flight import Flight
from app.services.flight_sync.builder import KST
from app.services.flight_sync.reference import route_of

from .serpapi import fetch_nonstop_prices

log = logging.getLogger(__name__)
_lock = threading.Lock()   # 같은 순간 여러 요청이 같은 노선을 중복 호출하지 않도록


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def calls_this_month(db: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(KST)
    total = (
        db.query(func.coalesce(func.sum(FareLookup.calls), 0))
        .filter(FareLookup.fetched_at >= _month_start(now))
        .scalar()
    )
    return int(total or 0)


def _fresh(lookup: FareLookup | None, now: datetime) -> bool:
    if not lookup:
        return False
    fetched = lookup.fetched_at
    if fetched.tzinfo is None:            # SQLite는 tz 정보를 잃는다
        fetched = fetched.replace(tzinfo=KST)
    # 실패한 조회는 1시간 뒤 재시도 / 정상 조회는 캐시 시간 동안 재사용
    hours = 1 if lookup.status == "error" else settings.FARE_CACHE_HOURS
    return now - fetched < timedelta(hours=hours)


def apply_live_fares(db: Session, origin: str, dest: str, day: date) -> str:
    """결과 상태 문자열을 돌려준다 (로그·디버깅용). 예외를 밖으로 던지지 않는다."""
    if not settings.SERPAPI_KEY:
        return "disabled"
    if not route_of(origin, dest):
        return "no_route"

    with _lock:
        try:
            now = datetime.now(KST)
            lookup = db.query(FareLookup).filter_by(from_code=origin, to_code=dest, date=day).first()
            if _fresh(lookup, now):
                return "cached"
            if calls_this_month(db, now) >= settings.SERPAPI_MONTHLY_BUDGET:
                return "budget_exhausted"

            flights = (
                db.query(Flight)
                .filter(Flight.source != "mock", Flight.from_code == origin,
                        Flight.to_code == dest, Flight.date == day)
                .all()
            )
            if not flights:
                return "no_flights"     # 판매할 편이 없으면 호출하지 않는다

            try:
                prices = fetch_nonstop_prices(settings.SERPAPI_KEY, origin, dest, day.isoformat())
                status, message = ("ok" if prices else "empty"), None
            except RuntimeError as e:
                prices, status, message = {}, "error", str(e)[:300]
                log.warning("실시세 조회 실패 %s→%s %s: %s", origin, dest, day, message)

            route = route_of(origin, dest)
            matched_prices = [prices[f.flight_no] for f in flights if f.flight_no in prices]
            # 실시세가 없는 편(신생 항공사 등)은 같은 노선·같은 날 실시세 중앙값으로 맞춘다.
            # 기준표 산정가를 그대로 두면 실제보다 훨씬 싸게 보여 가격순 정렬 맨 위로 올라가기 때문
            median = sorted(matched_prices)[len(matched_prices) // 2] if matched_prices else None
            matched = 0
            for f in flights:
                live = prices.get(f.flight_no)
                if live is not None:
                    f.economy_price = live
                    f.price_source = "live"
                    matched += 1
                elif median is not None:
                    f.economy_price = round(median / 1000) * 1000
                    f.price_source = "estimated"
                else:
                    continue
                # 비즈니스는 실시세를 따로 조회하면 호출 수가 두 배 → 일반석 가격 × 노선 배수로 산정
                f.business_price = round(float(f.economy_price) * route.biz_ratio / 1000) * 1000
                f.price_updated_at = now

            if not lookup:
                lookup = FareLookup(from_code=origin, to_code=dest, date=day, calls=0)
                db.add(lookup)
            lookup.status, lookup.matched, lookup.message = status, matched, message
            lookup.calls = (lookup.calls or 0) + 1
            lookup.fetched_at = now
            db.commit()
            log.info("실시세 %s→%s %s: %s / 응답 %d편 / 매칭 %d편", origin, dest, day, status, len(prices), matched)
            return status
        except Exception:  # noqa: BLE001 — 실시세 실패가 검색을 막으면 안 된다
            db.rollback()
            log.exception("실시세 적용 중 오류")
            return "error"
