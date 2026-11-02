"""
한국공항공사_실시간 항공기 운항정보 조회_GW
- 대상: 김포·김해·제주 등 14개 공항 (인천 제외)
- 개발계정 5,000건/일

실제 호출로 확인한 동작 (공식 가이드와 다른 부분)
- searchday 파라미터를 넣으면 0건 → 날짜 필터 없이 D-3~D+6 전체를 받고 코드에서 거른다
- numOfRows=500 은 정상 응답이 오지 않음 → 100건씩 페이징
"""
import logging
import math
from concurrent.futures import ThreadPoolExecutor

import httpx

from .common import extract_items, get_json, is_codeshare_slave, map_status, parse_dt, total_count
from .dto import Movement

log = logging.getLogger(__name__)

BASE = "https://apis.data.go.kr/B551178/flight-status"
PAGE_SIZE = 100
MAX_PAGES = 150   # 안전장치: 혹시 totalCount가 이상하게 와도 트래픽을 다 쓰지 않도록
WORKERS = 6       # 순차 호출 시 수집 1회 약 8분 → 동시 호출로 단축


class KacClient:
    def __init__(self, service_key: str, client: httpx.Client):
        self.key = service_key
        self.http = client
        self.calls = 0

    def _page(self, operation: str, page: int) -> dict:
        payload = get_json(self.http, f"{BASE}/{operation}", {
            "serviceKey": self.key, "type": "json",
            "pageNo": page, "numOfRows": PAGE_SIZE,
        })
        self.calls += 1
        return payload

    def _fetch_all(self, operation: str) -> list[dict]:
        first = self._page(operation, 1)
        items = extract_items(first)
        pages = min(math.ceil(total_count(first) / PAGE_SIZE), MAX_PAGES)
        if pages > 1:
            with ThreadPoolExecutor(max_workers=WORKERS) as pool:
                for payload in pool.map(lambda p: self._page(operation, p), range(2, pages + 1)):
                    items.extend(extract_items(payload))
        return items

    def _to_movement(self, it: dict, io: str) -> Movement | None:
        flight_no = (it.get("flightid") or "").strip()
        sched = parse_dt(it.get("scheduledatetime"))
        if not flight_no or not sched:
            return None
        if is_codeshare_slave(flight_no, it.get("masterflightid")):
            return None
        # 같은 API인데 출발/도착 응답의 도착공항 코드 필드명이 다르다
        dest = it.get("arrvAirportCode") or it.get("arrAirportCode") or ""
        origin = it.get("depAirportCode") or ""
        if not origin or not dest:
            return None
        return Movement(
            source="KAC", io=io, flight_no=flight_no,
            airline=(it.get("airline") or "").strip(),
            origin=origin.upper(), dest=dest.upper(),
            scheduled=sched, estimated=parse_dt(it.get("estimateddatetime")),
            status=map_status(it.get("rmkKor")), status_raw=it.get("rmkKor"),
        )

    def collect(self) -> tuple[list[Movement], list[Movement]]:
        deps = [m for it in self._fetch_all("depart") if (m := self._to_movement(it, "O"))]
        arrs = [m for it in self._fetch_all("arrival") if (m := self._to_movement(it, "I"))]
        log.info("[KAC] 출발 %d / 도착 %d (호출 %d회)", len(deps), len(arrs), self.calls)
        return deps, arrs
