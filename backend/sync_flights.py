"""
실데이터 수집을 직접 실행하는 스크립트 (로컬 검증·수동 실행용).

    cd backend
    # 운영 DB를 건드리지 않고 임시 SQLite로 검증
    DATABASE_URL=sqlite:///./sync_test.db python sync_flights.py

    # .env 의 DATABASE_URL 로 실제 동기화 (마이그레이션 먼저 적용할 것)
    python sync_flights.py
"""
import json
import logging

from app.db.database import SessionLocal, engine, create_tables
from app.services.flight_sync import run_sync

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # URL에 인증키가 포함되므로 출력하지 않음

if __name__ == "__main__":
    print(f"대상 DB: {engine.url.drivername}://{engine.url.host or engine.url.database}")
    if engine.dialect.name == "sqlite":
        create_tables()   # 임시 DB는 테이블부터 만든다
    result = run_sync(SessionLocal)
    print(json.dumps(result, ensure_ascii=False, indent=2))
