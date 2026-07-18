import time
import httpx
from datetime import date as date_type
from fastapi import APIRouter, HTTPException, Query
from app.core.config import settings

router = APIRouter()

AERODATABOX_HOST = "aerodatabox.p.rapidapi.com"
CACHE_TTL_SECONDS = 180
_CACHE: dict[tuple, tuple[float, dict]] = {}

CANCEL_KEYWORDS = ("cancel",)


def _headers() -> dict:
    if not settings.AERODATABOX_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="AERODATABOX_API_KEY가 설정되지 않았습니다. https://rapidapi.com/aedbx-aedbx/api/aerodatabox 에서 무료 API 키를 발급받아 .env에 추가하세요.",
        )
    return {
        "X-RapidAPI-Key": settings.AERODATABOX_API_KEY,
        "X-RapidAPI-Host": AERODATABOX_HOST,
    }


def _fetch_window(code_type: str, code: str, from_local: str, to_local: str) -> dict:
    url = f"https://{AERODATABOX_HOST}/flights/airports/{code_type}/{code}/{from_local}/{to_local}"
    try:
        resp = httpx.get(
            url,
            headers=_headers(),
            params={
                "direction": "Both",
                "withLeg": "true",
                "withCancelled": "true",
                "withCodeshared": "true",
                "withCargo": "false",
                "withPrivate": "false",
            },
            timeout=20.0,
        )
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"운항 현황 조회 중 네트워크 오류가 발생했습니다: {e}")

    if resp.status_code in (401, 403):
        raise HTTPException(
            status_code=502,
            detail="AeroDataBox API 인증에 실패했습니다. RapidAPI에서 AeroDataBox 구독 상태와 키를 확인하세요.",
        )
    if resp.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="AeroDataBox 무료 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.",
        )
    if resp.status_code == 404:
        return {"departures": [], "arrivals": []}
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"AeroDataBox 응답 오류 ({resp.status_code}): {resp.text[:200]}")

    return resp.json()


def _time_block(block: dict | None) -> dict | None:
    if not block:
        return None
    return {
        "scheduled_local": (block.get("scheduledTime") or {}).get("local"),
        "revised_local": (block.get("revisedTime") or {}).get("local"),
        "actual_local": (block.get("runwayTime") or {}).get("local"),
        "terminal": block.get("terminal"),
        "gate": block.get("gate"),
    }


def _is_cancelled(status: str | None) -> bool:
    if not status:
        return False
    low = status.lower()
    return any(kw in low for kw in CANCEL_KEYWORDS)


def _normalize(item: dict, direction: str) -> dict:
    movement = item.get(direction) or {}
    other_direction = "arrival" if direction == "departure" else "departure"
    other_movement = item.get(other_direction) or {}
    airport = movement.get("airport") or {}
    other_airport = other_movement.get("airport") or {}
    times = _time_block(movement) or {}
    status = item.get("status")

    return {
        "flight_no": item.get("number"),
        "airline": (item.get("airline") or {}).get("name"),
        "status": status,
        "is_cancelled": _is_cancelled(status),
        "is_codeshare": item.get("codeshareStatus") not in (None, "IsOperator", "Unknown"),
        # 이 항공편이 조회 대상 공항을 오갈 때, 반대편 공항 정보
        "other_code": other_airport.get("iata") or other_airport.get("icao"),
        "other_city": other_airport.get("municipalityName") or other_airport.get("name"),
        "scheduled_local": times.get("scheduled_local"),
        "revised_local": times.get("revised_local"),
        "actual_local": times.get("actual_local"),
        "terminal": times.get("terminal"),
        "gate": times.get("gate"),
    }


def _dedupe(items: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    result = []
    for it in items:
        key = (it.get("flight_no"), it.get("scheduled_local"))
        if key in seen:
            continue
        seen.add(key)
        result.append(it)
    return result


@router.get("")
def get_airport_status(
    code: str = Query(default="ICN"),
    code_type: str = Query(default="iata", pattern="^(iata|icao)$"),
    date: date_type = Query(default_factory=date_type.today),
):
    code = code.upper()
    cache_key = (code_type, code, str(date))
    cached = _CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    windows = [
        (f"{date}T00:00", f"{date}T11:59"),
        (f"{date}T12:00", f"{date}T23:59"),
    ]

    raw_departures: list[dict] = []
    raw_arrivals: list[dict] = []
    for from_local, to_local in windows:
        chunk = _fetch_window(code_type, code, from_local, to_local)
        raw_departures.extend(chunk.get("departures") or [])
        raw_arrivals.extend(chunk.get("arrivals") or [])

    result = {
        "date": str(date),
        "airport_code": code,
        "departures": _dedupe([_normalize(f, "departure") for f in raw_departures]),
        "arrivals": _dedupe([_normalize(f, "arrival") for f in raw_arrivals]),
    }

    _CACHE[cache_key] = (now, result)
    return result
