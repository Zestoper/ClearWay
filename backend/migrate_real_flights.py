"""
flights 테이블을 실데이터 동기화용으로 확장하는 마이그레이션 (PostgreSQL).
여러 번 실행해도 안전하다 (IF NOT EXISTS / IF EXISTS).

실행:
    cd backend
    python migrate_real_flights.py            # 적용할 SQL만 출력 (DB 변경 없음)
    python migrate_real_flights.py --apply    # 실제 적용

기존 데이터는 지우지 않는다.
- 기존 시드 항공편은 source='mock' 으로 표시된다 (예약 이력이 참조하고 있으므로 보존)
- 검색 API는 mock 항공편을 더 이상 보여주지 않는다
"""
import sys

from sqlalchemy import text

from app.db.database import engine

STATEMENTS = [
    "ALTER TABLE flights ADD COLUMN IF NOT EXISTS source VARCHAR(8) NOT NULL DEFAULT 'mock'",
    "ALTER TABLE flights ADD COLUMN IF NOT EXISTS sync_key VARCHAR(40)",
    "ALTER TABLE flights ADD COLUMN IF NOT EXISTS airline VARCHAR(50)",
    "ALTER TABLE flights ADD COLUMN IF NOT EXISTS status VARCHAR(16)",
    "ALTER TABLE flights ADD COLUMN IF NOT EXISTS depart_estimated VARCHAR(5)",
    "ALTER TABLE flights ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ",
    # 실제 편명은 매일 반복 → 편명 단독 유니크 해제
    "ALTER TABLE flights DROP CONSTRAINT IF EXISTS flights_flight_no_key",
    "CREATE INDEX IF NOT EXISTS ix_flights_flight_no ON flights (flight_no)",
    "CREATE UNIQUE INDEX IF NOT EXISTS flights_sync_key_key ON flights (sync_key)",
    "CREATE INDEX IF NOT EXISTS ix_flights_route_date ON flights (from_code, to_code, date)",
    # 실시세 운임
    "ALTER TABLE flights ADD COLUMN IF NOT EXISTS price_source VARCHAR(10) NOT NULL DEFAULT 'estimated'",
    "ALTER TABLE flights ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMPTZ",
    # fare_lookups 테이블은 서버 시작 시 create_all 로 자동 생성된다
]


def main() -> None:
    apply = "--apply" in sys.argv
    host = engine.url.host or engine.url.database
    print(f"대상 DB: {engine.url.drivername}://{host}")
    for sql in STATEMENTS:
        print(("  실행: " if apply else "  (미적용) ") + sql)
    if not apply:
        print("\n확인 후 --apply 를 붙여서 다시 실행하세요.")
        return
    with engine.begin() as conn:
        for sql in STATEMENTS:
            conn.execute(text(sql))
    print("\n완료")


if __name__ == "__main__":
    main()
