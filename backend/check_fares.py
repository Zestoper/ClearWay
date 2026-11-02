"""
실시세 연동 확인 스크립트 (SerpApi 1회 사용).

    cd backend
    python3 check_fares.py GMP CJU            # 내일 김포→제주
    python3 check_fares.py ICN NRT 2026-11-05

DB는 바꾸지 않는다. 구글 시세 편명과 우리 DB 항공편이 몇 편 매칭되는지만 보여준다.
"""
import sys
from datetime import date, timedelta

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.flight import Flight
from app.services.fares.serpapi import fetch_nonstop_prices

origin, dest = sys.argv[1].upper(), sys.argv[2].upper()
day = date.fromisoformat(sys.argv[3]) if len(sys.argv) > 3 else date.today() + timedelta(days=1)

prices = fetch_nonstop_prices(settings.SERPAPI_KEY, origin, dest, day.isoformat())
print(f"{origin}→{dest} {day} | 구글 직항 시세 {len(prices)}편")

with SessionLocal() as db:
    ours = (db.query(Flight)
            .filter(Flight.source != "mock", Flight.from_code == origin, Flight.to_code == dest, Flight.date == day)
            .order_by(Flight.depart_time).all())
print(f"우리 DB 항공편 {len(ours)}편 / 매칭 {sum(1 for f in ours if f.flight_no in prices)}편\n")
for f in ours[:15]:
    live = prices.get(f.flight_no)
    mark = f"실시세 ₩{live:,}" if live else "매칭 없음"
    print(f"  {f.depart_time} {f.flight_no:8} {f.airline or '':8} 산정가 ₩{int(f.economy_price):,} → {mark}")
live = [prices[f.flight_no] for f in ours if f.flight_no in prices]
if live:
    print(f"\n매칭 안 된 편에 적용될 산정가(실시세 중앙값): ₩{round(sorted(live)[len(live)//2] / 1000) * 1000:,}")
only_google = sorted(set(prices) - {f.flight_no for f in ours})
if only_google:
    print(f"\n구글에만 있는 편명: {only_google[:10]}")
