"""
실데이터 수집 트리거.

Render 무료 서버는 요청이 없으면 잠들기 때문에 서버 안의 스케줄러는 믿을 수 없다.
→ GitHub Actions 크론이 하루 4번 이 API를 호출한다 (.github/workflows/sync-flights.yml)
→ 수집은 1~2분 걸리므로 백그라운드로 돌리고 즉시 202를 돌려준다.
"""
import hmac

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, status

from app.core.config import settings
from app.db.database import SessionLocal
from app.services.flight_sync import get_last_result, run_sync

router = APIRouter()


def _check_token(token: str | None) -> None:
    expected = settings.FLIGHT_SYNC_TOKEN
    if not expected:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "FLIGHT_SYNC_TOKEN이 설정되지 않았습니다.")
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "수집 토큰이 올바르지 않습니다.")


def _run_in_background() -> None:
    try:
        run_sync(SessionLocal)
    except Exception:
        pass  # 결과·에러는 run_sync가 last_result와 로그에 남긴다


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def trigger_sync(background: BackgroundTasks, x_sync_token: str | None = Header(default=None)):
    _check_token(x_sync_token)
    if get_last_result().get("status") == "running":
        return {"accepted": False, "reason": "이미 수집 중입니다."}
    background.add_task(_run_in_background)
    return {"accepted": True}


@router.get("/status")
def sync_status(x_sync_token: str | None = Header(default=None)):
    _check_token(x_sync_token)
    return get_last_result()
