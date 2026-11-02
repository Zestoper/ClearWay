"""
SerpApi Google Flights 호출.

- 구글 항공권 검색 결과의 실제 판매 시세를 편명별로 받는다
- 무료 플랜: 월 250회 → 호출부(service.py)에서 캐싱과 월 예산으로 아껴 쓴다
- 포트폴리오 데모용 시세 참고 목적. 상용 서비스라면 GDS·항공사 운임 계약이 필요하다
"""
import logging

import httpx

log = logging.getLogger(__name__)

URL = "https://serpapi.com/search.json"


def normalize_flight_no(value: str) -> str:
    """'7C 167' → '7C167' (공공 API 편명 형식과 맞춘다)"""
    return "".join(str(value).split()).upper()


def fetch_nonstop_prices(api_key: str, origin: str, dest: str, date_iso: str, timeout: float = 15) -> dict[str, int]:
    """
    편도·직항 일반석 시세를 {편명: 원화 가격}으로 돌려준다.
    같은 편명이 여러 번 나오면 최저가를 쓴다.
    """
    params = {
        "engine": "google_flights",
        "departure_id": origin,
        "arrival_id": dest,
        "outbound_date": date_iso,
        "type": "2",          # 편도
        "stops": "1",         # 직항만
        "travel_class": "1",  # 일반석
        "currency": "KRW",
        "hl": "ko",
        "gl": "kr",
        "api_key": api_key,
    }
    try:
        res = httpx.get(URL, params=params, timeout=timeout)
        payload = res.json()
    except (httpx.HTTPError, ValueError) as e:
        # httpx 에러 메시지에는 URL(= api_key 포함)이 들어 있으므로 가린다
        raise RuntimeError(str(e).replace(api_key, "***")) from None

    if res.status_code >= 400 or payload.get("error"):
        raise RuntimeError(f"SerpApi 오류 {res.status_code}: {str(payload.get('error', ''))[:200]}")

    prices: dict[str, int] = {}
    for group in ("best_flights", "other_flights"):
        for item in payload.get(group) or []:
            legs = item.get("flights") or []
            price = item.get("price")
            # 직항(구간 1개)이고 가격이 있는 것만
            if len(legs) != 1 or not isinstance(price, (int, float)):
                continue
            no = normalize_flight_no(legs[0].get("flight_number", ""))
            if not no:
                continue
            prices[no] = min(int(price), prices.get(no, int(price)))
    return prices
