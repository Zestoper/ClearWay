"""두 어댑터가 같이 쓰는 파싱·호출 유틸."""
import logging
import time
from datetime import datetime
from typing import Any, Optional

import httpx

from .dto import Status

log = logging.getLogger(__name__)


def get_json(client: httpx.Client, url: str, params: dict, retries: int = 3) -> dict:
    """공공데이터포털은 가끔 일시적으로 실패하거나 JSON 대신 XML 에러를 준다 → 재시도 + 형식 검사."""
    last_err: str | None = None
    for attempt in range(1, retries + 1):
        try:
            res = client.get(url, params=params)
            res.raise_for_status()
            payload = res.json()
            check_result(payload)
            return payload
        except (httpx.HTTPError, ValueError, RuntimeError) as e:
            # httpx 에러 메시지에는 요청 URL 전체(= 인증키 포함)가 들어 있어 가린다
            last_err = _scrub(str(e), params.get("serviceKey"))
            log.warning("공공데이터 API 호출 실패 (%d/%d) %s: %s", attempt, retries, url.rsplit("/", 1)[-1], last_err)
            time.sleep(1.5 * attempt)
    raise RuntimeError(f"공공데이터 API 호출 실패: {last_err}")


def _scrub(text: str, secret: str | None) -> str:
    return text.replace(secret, "***") if secret else text


def check_result(payload: Any) -> None:
    if not isinstance(payload, dict) or "response" not in payload:
        raise RuntimeError(f"예상과 다른 응답 형식: {str(payload)[:300]}")
    header = payload["response"].get("header", {})
    code = str(header.get("resultCode", ""))
    if code not in ("00", "0"):
        raise RuntimeError(f"API 오류 resultCode={code} msg={header.get('resultMsg')}")


def extract_items(payload: dict) -> list[dict[str, Any]]:
    """
    item 리스트만 꺼낸다.
    - 결과가 1건이면 item이 리스트가 아니라 dict로 온다
    - 결과가 0건이면 items가 "" (빈 문자열)로 올 수 있다
    """
    body = payload.get("response", {}).get("body", {}) or {}
    items = body.get("items") or {}
    if isinstance(items, list):
        return items
    item = items.get("item", []) if isinstance(items, dict) else []
    return [item] if isinstance(item, dict) else list(item)


def total_count(payload: dict) -> int:
    body = payload.get("response", {}).get("body", {}) or {}
    try:
        return int(body.get("totalCount") or 0)
    except (TypeError, ValueError):
        return 0


def parse_dt(value: Optional[str]) -> Optional[datetime]:
    """'202611021650' (YYYYMMDDHHMM) -> datetime. 비어있거나 '-'면 None."""
    if not value:
        return None
    v = str(value).strip()
    if len(v) < 12 or not v[:12].isdigit():
        return None
    return datetime.strptime(v[:12], "%Y%m%d%H%M")


_STATUS_MAP: dict[str, Status] = {
    "출발": "DEPARTED",
    "도착": "ARRIVED",
    "착륙": "ARRIVED",
    "지연": "DELAYED",
    "결항": "CANCELLED",
    "회항": "DIVERTED",
    "탑승준비": "BOARDING",
    "탑승중": "BOARDING",
    "마감예정": "BOARDING",
    "탑승마감": "BOARDING",
}


def map_status(remark: Optional[str]) -> Status:
    if not remark or not str(remark).strip():
        return "SCHEDULED"
    return _STATUS_MAP.get(str(remark).strip(), "UNKNOWN")


def is_codeshare_slave(flight_no: str, master_flight_no: Optional[str]) -> bool:
    """
    코드쉐어 중복 제거 (실제 응답으로 확인).
    한국공항공사는 실제 운항편과 판매용 편명이 둘 다 codeshare=Y 로 온다.
      LJ6301 진에어  Y  master=LJ6301  → 실제 운항편 (남김)
      KE5153 대한항공 Y  master=LJ6301  → 판매용 편명 (제외)
    그래서 'Y면 제외'가 아니라 '마스터 편명이 있고 내 편명과 다르면 제외'로 판단한다.
    """
    return bool(master_flight_no) and str(master_flight_no).strip() != flight_no.strip()
