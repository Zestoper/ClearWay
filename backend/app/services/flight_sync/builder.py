"""
출발·도착 기록(Movement)을 예약 가능한 항공편 행(flights 테이블)으로 바꾼다.

규칙
1) 한국 공항 출발 기록이 기준이다 (출발 시각이 실제 값)
   - 도착지도 한국 공항이면: 같은 편명의 도착 기록을 찾아 '실제 도착 예정 시각'을 쓴다
   - 도착지가 해외면: 평균 비행시간 + 현지 시차로 도착 시각을 추정한다
2) 해외 → 한국 입국편은 출발 기록이 없으니 한국 도착 기록으로 만든다
   - 출발 시각은 '도착 시각 - 평균 비행시간 + 현지 시차'로 추정한다
3) 기준표(reference.py)에 없는 노선은 만들지 않는다
4) 오늘 ~ D+6 (한국 시간) 출발편만 남긴다
"""
import hashlib
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .dto import Movement
from .reference import Route, is_korean, place_of, route_of

KST = ZoneInfo("Asia/Seoul")
WINDOW_DAYS = 6
MAX_PAIR_GAP = timedelta(hours=6)      # 국내선 출발-도착 기록을 짝지을 때 허용 간격


@dataclass
class BuildStats:
    built: int = 0
    real_arrival: int = 0                # 도착 시각이 실제 기록으로 채워진 편
    skipped_no_route: int = 0
    skipped_out_of_window: int = 0
    unknown_routes: dict[str, int] = field(default_factory=dict)


def today_kst() -> date:
    return datetime.now(KST).date()


def _hhmm(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def _fmt_duration(minutes: int) -> str:
    minutes = max(minutes, 0)
    return f"{minutes // 60}h {minutes % 60:02d}m"


def _stable_int(key: str) -> int:
    return int(hashlib.md5(key.encode()).hexdigest()[:8], 16)


def _fares(key: str, route: Route) -> tuple[int, int]:
    """같은 편은 수집할 때마다 같은 가격이 나오도록 키 기반으로 고정."""
    span = route.eco_max - route.eco_min
    eco = route.eco_min + (_stable_int(key) % (span + 1))
    eco = round(eco / 1000) * 1000
    biz = round(eco * route.biz_ratio / 1000) * 1000
    return eco, biz


def _seats(key: str) -> tuple[int, int]:
    n = _stable_int(key + "#seats")
    return 120 + n % 61, 12 + (n // 61) % 13


def _row(
    *, m: Movement, origin: str, dest: str, route: Route,
    dep_local: datetime, arr_local: datetime, duration_min: int,
    dep_estimated: datetime | None, now: datetime,
) -> dict:
    o, d = place_of(origin), place_of(dest)
    flight_date = dep_local.date()
    key = f"{m.flight_no}|{flight_date:%Y%m%d}|{origin}|{dest}"
    eco, biz = _fares(key, route)
    eco_seats, biz_seats = _seats(key)
    return {
        "sync_key": key,
        "source": m.source,
        "flight_no": m.flight_no[:10],
        "airline": (m.airline or None) and m.airline[:50],
        "from_city": o.city, "from_code": origin, "from_airport": o.airport,
        "to_city": d.city, "to_code": dest, "to_airport": d.airport,
        "date": flight_date,
        "depart_time": _hhmm(dep_local),
        "arrival_time": _hhmm(arr_local),
        "duration": _fmt_duration(duration_min),
        "economy_price": eco, "business_price": biz,
        "economy_seats": eco_seats, "business_seats": biz_seats,
        "is_cancelled": m.status == "CANCELLED",
        "is_direct": True, "via_city": None,
        "status": m.status,
        "depart_estimated": _hhmm(dep_estimated) if dep_estimated else None,
        "synced_at": now,
    }


def build_rows(deps: list[Movement], arrs: list[Movement], today: date | None = None) -> tuple[list[dict], BuildStats]:
    today = today or today_kst()
    last_day = today + timedelta(days=WINDOW_DAYS)
    now = datetime.now(KST)
    stats = BuildStats()
    rows: dict[str, dict] = {}

    def keep(row: dict) -> None:
        if not (today <= row["date"] <= last_day):
            stats.skipped_out_of_window += 1
            return
        rows.setdefault(row["sync_key"], row)

    def no_route(origin: str, dest: str) -> None:
        stats.skipped_no_route += 1
        foreign = dest if is_korean(origin) else origin
        stats.unknown_routes[foreign] = stats.unknown_routes.get(foreign, 0) + 1

    # 도착 기록 인덱스: (편명, 출발, 도착) → 도착 기록들
    arr_index: dict[tuple[str, str, str], list[Movement]] = defaultdict(list)
    for a in arrs:
        arr_index[(a.flight_no, a.origin, a.dest)].append(a)

    # 1) 한국 공항 출발편
    for m in deps:
        route = route_of(m.origin, m.dest)
        if not route or not place_of(m.origin) or not place_of(m.dest):
            no_route(m.origin, m.dest)
            continue

        dep_kst = m.scheduled
        if is_korean(m.dest):
            pair = next(
                (a for a in arr_index.get((m.flight_no, m.origin, m.dest), [])
                 if timedelta(0) < a.scheduled - dep_kst <= MAX_PAIR_GAP),
                None,
            )
            if pair:
                arr_kst = pair.scheduled
                stats.real_arrival += 1
            else:
                arr_kst = dep_kst + timedelta(minutes=route.duration_min)
            arr_local = arr_kst
        else:
            arr_kst = dep_kst + timedelta(minutes=route.duration_min)
            arr_local = arr_kst + timedelta(minutes=place_of(m.dest).tz_min)

        keep(_row(
            m=m, origin=m.origin, dest=m.dest, route=route,
            dep_local=dep_kst, arr_local=arr_local,
            duration_min=int((arr_kst - dep_kst).total_seconds() // 60),
            dep_estimated=m.estimated if m.estimated and m.estimated != m.scheduled else None,
            now=now,
        ))

    # 2) 해외 → 한국 입국편 (국내 출발편은 1)에서 이미 처리)
    for a in arrs:
        if is_korean(a.origin):
            continue
        route = route_of(a.origin, a.dest)
        if not route or not place_of(a.origin) or not place_of(a.dest):
            no_route(a.origin, a.dest)
            continue
        arr_kst = a.scheduled
        dep_kst = arr_kst - timedelta(minutes=route.duration_min)
        dep_local = dep_kst + timedelta(minutes=place_of(a.origin).tz_min)
        keep(_row(
            m=a, origin=a.origin, dest=a.dest, route=route,
            dep_local=dep_local, arr_local=arr_kst,
            duration_min=route.duration_min, dep_estimated=None, now=now,
        ))

    stats.built = len(rows)
    return list(rows.values()), stats
