"""
CLEARWAY 항공 더미 데이터 시드
2026-05-04 ~ 2026-05-30 | 33개 노선 | 하루 30~40편
실행: python seed.py
"""
import random
from datetime import date, timedelta
from app.db.database import SessionLocal, create_tables
from app.models.flight import Flight
from app.models.user import User
from app.core.security import hash_password

create_tables()

# ── 노선 정의 ─────────────────────────────────────────────────────
# (목적지 도시, IATA, 공항명, 직항분_min, 직항분_max, 경유분추가, 경유도시, eco_min, eco_max, biz_ratio)
ROUTES = [
    # ── 국내 ──────────────────────────────────────────────────
    ("제주",         "CJU", "제주국제공항",          80,  90,  30, "없음",          45_000,  85_000, 2.0),
    ("부산",         "PUS", "김해국제공항",           55,  65,  25, "없음",          40_000,  75_000, 1.8),
    ("대구",         "TAE", "대구국제공항",           50,  60,  20, "없음",          38_000,  70_000, 1.8),
    ("광주",         "KWJ", "광주공항",               55,  65,  20, "없음",          38_000,  70_000, 1.8),
    # ── 일본 ──────────────────────────────────────────────────
    ("도쿄",         "NRT", "나리타국제공항",         130, 150, 90, "오사카",         80_000,  160_000, 3.2),
    ("도쿄",         "HND", "하네다공항",             125, 145, 85, "후쿠오카",       82_000,  162_000, 3.2),
    ("오사카",       "KIX", "간사이국제공항",         140, 165, 95, "나고야",         90_000,  175_000, 3.1),
    ("삿포로",       "CTS", "신치토세공항",           135, 158, 90, "도쿄",           88_000,  168_000, 3.0),
    ("후쿠오카",     "FUK", "후쿠오카공항",           100, 120, 70, "오사카",         70_000,  140_000, 3.0),
    ("나고야",       "NGO", "주부국제공항",           115, 135, 80, "오사카",         75_000,  148_000, 3.0),
    ("오키나와",     "OKA", "나하공항",               175, 200, 100,"도쿄",           95_000,  185_000, 3.1),
    # ── 중국 ──────────────────────────────────────────────────
    ("베이징",       "PEK", "수도국제공항",           130, 155, 110,"상하이",        118_000,  210_000, 3.2),
    ("상하이",       "PVG", "푸동국제공항",           128, 152, 105,"베이징",        115_000,  205_000, 3.1),
    ("광저우",       "CAN", "바이윈국제공항",         165, 188, 120,"상하이",        130_000,  220_000, 3.2),
    # ── 대만·홍콩 ─────────────────────────────────────────────
    ("타이베이",     "TPE", "타오위안국제공항",       155, 175, 110,"홍콩",          100_000,  180_000, 3.2),
    ("홍콩",         "HKG", "홍콩국제공항",           200, 225, 130,"타이베이",      130_000,  238_000, 3.4),
    # ── 동남아시아 ────────────────────────────────────────────
    ("방콕",         "BKK", "수완나품국제공항",       340, 385, 160,"홍콩",          180_000,  295_000, 3.3),
    ("호치민",       "SGN", "탄손낫국제공항",         295, 335, 140,"홍콩",          160_000,  268_000, 3.2),
    ("하노이",       "HAN", "노이바이국제공항",       285, 325, 135,"홍콩",          155_000,  258_000, 3.1),
    ("다낭",         "DAD", "다낭국제공항",           298, 330, 140,"호치민",        158_000,  260_000, 3.1),
    ("마닐라",       "MNL", "니노이아키노국제공항",   265, 295, 130,"홍콩",          140_000,  248_000, 3.2),
    ("싱가포르",     "SIN", "창이국제공항",           380, 415, 160,"홍콩",          220_000,  368_000, 3.3),
    ("쿠알라룸푸르", "KUL", "KLIA",                   375, 410, 155,"싱가포르",      200_000,  335_000, 3.3),
    ("발리",         "DPS", "응우라라이국제공항",     400, 445, 170,"싱가포르",      230_000,  395_000, 3.3),
    ("자카르타",     "CGK", "수카르노하타국제공항",   390, 430, 165,"싱가포르",      210_000,  360_000, 3.2),
    # ── 미주 ──────────────────────────────────────────────────
    ("뉴욕",         "JFK", "존 F. 케네디국제공항",   790, 835, 200,"도쿄",          680_000, 1_100_000, 3.1),
    ("로스앤젤레스", "LAX", "국제공항",               600, 645, 180,"도쿄",          550_000,  905_000, 3.1),
    ("샌프란시스코", "SFO", "국제공항",               590, 635, 178,"도쿄",          530_000,  890_000, 3.1),
    ("밴쿠버",       "YVR", "국제공항",               580, 625, 175,"도쿄",          520_000,  870_000, 3.0),
    # ── 유럽 ──────────────────────────────────────────────────
    ("파리",         "CDG", "샤를 드 골 공항",        680, 730, 190,"베이징",        560_000,  950_000, 3.2),
    ("런던",         "LHR", "히드로공항",             660, 715, 185,"베이징",        575_000,  975_000, 3.2),
    ("프랑크푸르트", "FRA", "국제공항",               665, 720, 188,"베이징",        555_000,  945_000, 3.1),
    # ── 오세아니아 ────────────────────────────────────────────
    ("시드니",       "SYD", "킹스포드스미스공항",     600, 645, 180,"싱가포르",      620_000,  990_000, 3.1),
    # ── 중동 ──────────────────────────────────────────────────
    ("두바이",       "DXB", "두바이국제공항",         520, 560, 170,"방콕",          380_000,  680_000, 3.2),
]

DEPART_SLOTS = [
    "05:10", "05:50", "06:20", "07:00", "07:40", "08:15", "08:50",
    "09:30", "10:05", "10:40", "11:15", "11:50", "12:25", "13:00",
    "13:35", "14:10", "14:45", "15:20", "16:00", "16:40", "17:15",
    "17:50", "18:25", "19:05", "19:40", "20:15", "20:55", "21:30",
    "22:05", "22:40", "23:10", "23:45",
]


def add_minutes(t: str, m: int) -> str:
    h, mn = map(int, t.split(":"))
    total = h * 60 + mn + m
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


def fmt_dur(m: int) -> str:
    return f"{m // 60}h {m % 60:02d}m"


db = SessionLocal()
try:
    print("기존 항공편 데이터 초기화 중...")
    from sqlalchemy import text
    db.execute(text("TRUNCATE TABLE bookings, flights RESTART IDENTITY CASCADE"))
    db.commit()
    print("✓ 초기화 완료")

    # 관리자 계정
    if not db.query(User).filter(User.email == "admin@clearway.com").first():
        db.add(User(
            name="관리자",
            email="admin@clearway.com",
            hashed_password=hash_password("admin1234"),
            is_admin=True,
            miles=0,
        ))
        db.commit()
        print("✓ 관리자 계정: admin@clearway.com / admin1234")

    counter = 1
    start = date(2026, 5, 4)
    end   = date(2026, 5, 30)
    total_added = 0
    day = start

    while day <= end:
        batch = []
        # 매일 모든 노선에서 1~2편씩 배치 (총 33~66편/일)
        for (to_city, to_code, to_airport, dur_min, dur_max,
             extra_min, via, eco_min, eco_max, biz_ratio) in ROUTES:

            # 직항 1편 (반드시)
            slot = random.choice(DEPART_SLOTS)
            dur = random.randint(dur_min, dur_max)
            eco = round(random.randint(eco_min, eco_max) / 1000) * 1000
            biz = round(eco * biz_ratio / 1000) * 1000
            batch.append(Flight(
                flight_no=f"CW{counter:05d}",
                from_city="서울", from_code="ICN", from_airport="인천국제공항",
                to_city=to_city, to_code=to_code, to_airport=to_airport,
                date=day,
                depart_time=slot,
                arrival_time=add_minutes(slot, dur),
                duration=fmt_dur(dur),
                economy_price=eco, business_price=biz,
                economy_seats=random.randint(80, 180),
                business_seats=random.randint(8, 28),
                is_cancelled=False,
                is_direct=True, via_city=None,
            ))
            counter += 1

            # 경유편 (국내 제외, 50% 확률)
            if to_code not in ("CJU", "PUS", "TAE", "KWJ") and random.random() < 0.5:
                slot2 = random.choice(DEPART_SLOTS)
                via_dur = dur + extra_min
                eco2 = round(random.randint(eco_min, int(eco_max * 0.88)) / 1000) * 1000
                biz2 = round(eco2 * biz_ratio / 1000) * 1000
                batch.append(Flight(
                    flight_no=f"CW{counter:05d}",
                    from_city="서울", from_code="ICN", from_airport="인천국제공항",
                    to_city=to_city, to_code=to_code, to_airport=to_airport,
                    date=day,
                    depart_time=slot2,
                    arrival_time=add_minutes(slot2, via_dur),
                    duration=fmt_dur(via_dur),
                    economy_price=eco2, business_price=biz2,
                    economy_seats=random.randint(60, 150),
                    business_seats=random.randint(6, 20),
                    is_cancelled=False,
                    is_direct=False, via_city=via,
                ))
                counter += 1

            # 귀국편 (목적지 → ICN) 직항 1편
            ret_slot = random.choice(DEPART_SLOTS)
            ret_dur = random.randint(dur_min, dur_max)
            ret_eco = round(random.randint(
                round(eco_min * 0.95), round(eco_max * 1.05)
            ) / 1000) * 1000
            ret_biz = round(ret_eco * biz_ratio / 1000) * 1000
            batch.append(Flight(
                flight_no=f"CW{counter:05d}",
                from_city=to_city, from_code=to_code, from_airport=to_airport,
                to_city="서울", to_code="ICN", to_airport="인천국제공항",
                date=day,
                depart_time=ret_slot,
                arrival_time=add_minutes(ret_slot, ret_dur),
                duration=fmt_dur(ret_dur),
                economy_price=ret_eco, business_price=ret_biz,
                economy_seats=random.randint(80, 180),
                business_seats=random.randint(8, 28),
                is_cancelled=False,
                is_direct=True, via_city=None,
            ))
            counter += 1

        for f in batch:
            db.add(f)
        db.commit()
        total_added += len(batch)
        print(f"  {day} – {len(batch):3d}편")
        day += timedelta(days=1)

    print(f"\n✓ 완료: {total_added}편 삽입 | {counter-1}번까지 생성")

finally:
    db.close()
