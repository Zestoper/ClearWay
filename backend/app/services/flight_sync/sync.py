"""
수집 → 변환 → DB upsert 를 한 번에 실행한다.

트래픽 (하루 4회 기준)
- 인천:     출발 1 + 도착 1 = 2회/수집 → 8회/일 (한도 500)
- 공항공사: 출발·도착 전체를 100건씩 → 약 160회/수집 → 약 640회/일 (한도 5,000)
사용자가 아무리 검색해도 외부 API 호출은 늘지 않는다 (검색은 DB만 조회).
"""
import logging
import threading
import time
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.flight import Flight

from .builder import KST, build_rows
from .incheon import IncheonClient
from .kac import KacClient

log = logging.getLogger(__name__)
# httpx는 INFO 레벨에서 요청 URL 전체를 찍는데 URL에 serviceKey가 들어 있다 → 서버 로그에 키가 남지 않도록 차단
logging.getLogger("httpx").setLevel(logging.WARNING)

_lock = threading.Lock()
last_result: dict = {"status": "never"}

# 재수집 때 갱신하는 컬럼 (운임·좌석은 예약에 영향을 주니 처음 값 유지)
_UPDATE_COLS = ("airline", "depart_time", "arrival_time", "duration", "status",
                "is_cancelled", "depart_estimated", "synced_at")
_CHUNK = 500


def _insert_fn(db: Session):
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:  # 로컬 검증용 SQLite
        from sqlalchemy.dialects.sqlite import insert
    return insert


def upsert_rows(db: Session, rows: list[dict]) -> int:
    insert = _insert_fn(db)
    for i in range(0, len(rows), _CHUNK):
        stmt = insert(Flight).values(rows[i:i + _CHUNK])
        stmt = stmt.on_conflict_do_update(
            index_elements=["sync_key"],
            set_={c: stmt.excluded[c] for c in _UPDATE_COLS},
        )
        db.execute(stmt)
    db.commit()
    return len(rows)


def collect_movements(service_key: str):
    """한쪽 기관이 실패해도 다른 쪽 데이터로 계속 진행한다."""
    deps, arrs, errors, calls = [], [], {}, {}
    with httpx.Client(timeout=60) as client:
        for name, cls in (("KAC", KacClient), ("ICN", IncheonClient)):
            api = cls(service_key, client)
            try:
                d, a = api.collect()
                deps += d
                arrs += a
            except Exception as e:  # noqa: BLE001 — 한쪽 장애가 전체 수집을 막지 않도록
                log.exception("[%s] 수집 실패", name)
                errors[name] = str(e)[:300]
            calls[name] = api.calls
    return deps, arrs, errors, calls


def get_last_result() -> dict:
    return dict(last_result)


def run_sync(session_factory) -> dict:
    global last_result
    if not settings.DATA_GO_KR_SERVICE_KEY:
        raise RuntimeError("DATA_GO_KR_SERVICE_KEY가 설정되지 않았습니다.")
    if not _lock.acquire(blocking=False):
        return {"status": "already_running"}

    started = time.monotonic()
    last_result = {"status": "running", "started_at": datetime.now(KST).isoformat()}
    try:
        deps, arrs, errors, calls = collect_movements(settings.DATA_GO_KR_SERVICE_KEY)
        rows, stats = build_rows(deps, arrs)
        with session_factory() as db:
            upserted = upsert_rows(db, rows) if rows else 0

        top_unknown = sorted(stats.unknown_routes.items(), key=lambda x: -x[1])[:10]
        last_result = {
            "status": "partial" if errors else "ok",
            "finished_at": datetime.now(KST).isoformat(),
            "seconds": round(time.monotonic() - started, 1),
            "api_calls": calls,
            "movements": {"departures": len(deps), "arrivals": len(arrs)},
            "flights_upserted": upserted,
            "real_arrival_times": stats.real_arrival,
            "skipped_no_route": stats.skipped_no_route,
            "skipped_out_of_window": stats.skipped_out_of_window,
            "top_unknown_routes": top_unknown,
            "errors": errors,
        }
        log.info("항공편 동기화 완료: %s", last_result)
        return last_result
    except Exception as e:
        last_result = {"status": "failed", "error": str(e)[:300],
                       "finished_at": datetime.now(KST).isoformat()}
        log.exception("항공편 동기화 실패")
        raise
    finally:
        _lock.release()
