"""
ICN <-> 도쿄(NRT/HND) 실제 스케줄 기반 시드 — 가는 날 / 오는 날만
AeroDataBox 실시간 API로 실제 출발 시각을 가져와 depart_time에 채워 넣는다.
편명(flight_no)은 DB의 전역 유니크 제약 때문에 기존 CW##### 형식을 유지한다.
기존 데이터는 건드리지 않고 이 두 날짜의 ICN<->NRT/HND 편만 추가(INSERT)한다.
왕복 검색에는 가는 날(ICN->도쿄)과 오는 날(도쿄->ICN)만 있으면 되므로
전체 기간을 매일 돌지 않고 이 두 날짜만 호출해 API 쿼터를 아낀다.
실행: python seed_tokyo_real.py
"""
import time
import random
from datetime import date
from sqlalchemy import text

from app.db.database import SessionLocal, create_tables
from app.models.flight import Flight
from app.api.v1.endpoints import flight_status as fs

create_tables()

TOKYO_AIRPORTS = {
    "NRT": {"city": "도쿄", "airport": "나리타국제공항", "dur_min": 130, "dur_max": 150, "eco_min": 80_000, "eco_max": 160_000, "biz_ratio": 3.2},
    "HND": {"city": "도쿄", "airport": "하네다공항",     "dur_min": 125, "dur_max": 145, "eco_min": 82_000, "eco_max": 162_000, "biz_ratio": 3.2},
}

OUTBOUND_DATE = date(2026, 7, 18)  # ICN -> 도쿄
RETURN_DATE = date(2026, 7, 25)    # 도쿄 -> ICN
SEED_DATES = sorted({OUTBOUND_DATE, RETURN_DATE})

MAX_RETRIES = 4


def add_minutes(t: str, m: int) -> str:
    h, mn = map(int, t.split(":"))
    total = h * 60 + mn + m
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


def fmt_dur(m: int) -> str:
    return f"{m // 60}h {m % 60:02d}m"


def fetch_with_retry(code: str, day: date):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fs.get_airport_status(code=code, code_type="iata", date=day)
        except Exception as e:
            wait = 8 * attempt
            print(f"    ! {code} {day} 조회 실패({e}) — {wait}초 후 재시도 ({attempt}/{MAX_RETRIES})")
            time.sleep(wait)
    print(f"    ! {code} {day} 최종 실패 — 건너뜀")
    return None


def real_local_time(scheduled_local: str | None) -> str | None:
    if not scheduled_local:
        return None
    t = scheduled_local.split("T")[-1].split(" ")[-1]
    return t[:5]


def already_seeded(db, day: date, from_code: str, to_code: str) -> bool:
    return db.execute(
        text("SELECT 1 FROM flights WHERE date = :d AND from_code = :f AND to_code = :t LIMIT 1"),
        {"d": day, "f": from_code, "t": to_code},
    ).first() is not None


db = SessionLocal()
try:
    row = db.execute(text("SELECT MAX(CAST(SUBSTRING(flight_no, 3) AS INTEGER)) FROM flights")).fetchone()
    counter = (row[0] or 0) + 1
    print(f"기존 최대 번호: CW{counter-1:05d} → CW{counter:05d}부터 시작\n")
finally:
    db.close()

total_added = 0

for day in SEED_DATES:
    print(f"=== {day} ===")
    need_outbound = day == OUTBOUND_DATE
    need_return = day == RETURN_DATE
    db = SessionLocal()
    try:
        # 출발편: ICN -> NRT/HND (ICN 기준 실제 출발 시각) — 가는 날에만 필요
        icn_data = None
        if need_outbound:
            if already_seeded(db, day, "ICN", "NRT") and already_seeded(db, day, "ICN", "HND"):
                print("  ICN -> 도쿄 이미 시드됨 — 건너뜀")
            else:
                icn_data = fetch_with_retry("ICN", day)
        if icn_data:
            outbound = [f for f in icn_data["departures"] if f["other_code"] in TOKYO_AIRPORTS and not f["is_cancelled"] and not f["is_codeshare"]]
            for f in outbound:
                depart = real_local_time(f["scheduled_local"])
                if not depart:
                    continue
                cfg = TOKYO_AIRPORTS[f["other_code"]]
                dur = random.randint(cfg["dur_min"], cfg["dur_max"])
                eco = round(random.randint(cfg["eco_min"], cfg["eco_max"]) / 1000) * 1000
                biz = round(eco * cfg["biz_ratio"] / 1000) * 1000
                db.add(Flight(
                    flight_no=f"CW{counter:05d}",
                    from_city="서울", from_code="ICN", from_airport="인천국제공항",
                    to_city=cfg["city"], to_code=f["other_code"], to_airport=cfg["airport"],
                    date=day,
                    depart_time=depart,
                    arrival_time=add_minutes(depart, dur),
                    duration=fmt_dur(dur),
                    economy_price=eco, business_price=biz,
                    economy_seats=random.randint(80, 180),
                    business_seats=random.randint(8, 28),
                    is_cancelled=False, is_direct=True, via_city=None,
                ))
                counter += 1
                total_added += 1
            print(f"  ICN -> 도쿄 실제 출발 {len(outbound)}편 반영")
            time.sleep(2)

        # 귀국편: NRT/HND -> ICN (각 공항 기준 실제 출발 시각) — 오는 날에만 필요
        for code, cfg in (TOKYO_AIRPORTS.items() if need_return else []):
            if already_seeded(db, day, code, "ICN"):
                print(f"  {code} -> ICN 이미 시드됨 — 건너뜀")
                continue
            tokyo_data = fetch_with_retry(code, day)
            if not tokyo_data:
                continue
            inbound = [f for f in tokyo_data["departures"] if f["other_code"] == "ICN" and not f["is_cancelled"] and not f["is_codeshare"]]
            for f in inbound:
                depart = real_local_time(f["scheduled_local"])
                if not depart:
                    continue
                dur = random.randint(cfg["dur_min"], cfg["dur_max"])
                eco = round(random.randint(round(cfg["eco_min"] * 0.95), round(cfg["eco_max"] * 1.05)) / 1000) * 1000
                biz = round(eco * cfg["biz_ratio"] / 1000) * 1000
                db.add(Flight(
                    flight_no=f"CW{counter:05d}",
                    from_city=cfg["city"], from_code=code, from_airport=cfg["airport"],
                    to_city="서울", to_code="ICN", to_airport="인천국제공항",
                    date=day,
                    depart_time=depart,
                    arrival_time=add_minutes(depart, dur),
                    duration=fmt_dur(dur),
                    economy_price=eco, business_price=biz,
                    economy_seats=random.randint(80, 180),
                    business_seats=random.randint(8, 28),
                    is_cancelled=False, is_direct=True, via_city=None,
                ))
                counter += 1
                total_added += 1
            print(f"  {code} -> ICN 실제 출발 {len(inbound)}편 반영")
            time.sleep(2)

        db.commit()
    finally:
        db.close()

print(f"\n완료: 총 {total_added}편 추가 | 마지막 번호 CW{counter-1:05d}")
