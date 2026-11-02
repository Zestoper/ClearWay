"""
인천국제공항공사_여객편 주간 운항 현황
- 범위: D+0 ~ D+6 / 개발계정 500건/일 ← 한국공항공사보다 10배 적다

실제 호출로 확인한 동작
- 페이징 없음: 한 번 호출에 7일치 전체(약 8,000편)가 온다 → 수집 1회 = 출발 1 + 도착 1
- codeshare 값은 "Master" / "Slave" (Slave가 절반 이상)
- 출발 응답에는 출발공항 / 도착 응답에는 도착공항 필드가 없다 → ICN으로 채움
- airport / airportCode 는 '상대 공항' (출발이면 목적지 / 도착이면 출발지)
"""
import logging

import httpx

from .common import extract_items, get_json, is_codeshare_slave, map_status, parse_dt
from .dto import Movement

log = logging.getLogger(__name__)

BASE = "https://apis.data.go.kr/B551177/StatusOfPassengerFlightsDSOdp"
ICN = "ICN"


class IncheonClient:
    def __init__(self, service_key: str, client: httpx.Client):
        self.key = service_key
        self.http = client
        self.calls = 0

    def _fetch(self, operation: str) -> list[dict]:
        payload = get_json(self.http, f"{BASE}/{operation}", {"serviceKey": self.key, "type": "json"})
        self.calls += 1
        return extract_items(payload)

    def _to_movement(self, it: dict, io: str) -> Movement | None:
        flight_no = (it.get("flightId") or "").strip()
        sched = parse_dt(it.get("scheduleDateTime"))
        other = (it.get("airportCode") or "").strip().upper()
        if not flight_no or not sched or not other:
            return None
        if it.get("codeshare") == "Slave":
            return None
        if is_codeshare_slave(flight_no, it.get("masterflightid") or it.get("masterflightId")):
            return None
        departing = io == "O"
        return Movement(
            source="ICN", io=io, flight_no=flight_no,
            airline=(it.get("airline") or "").strip(),
            origin=ICN if departing else other,
            dest=other if departing else ICN,
            scheduled=sched, estimated=parse_dt(it.get("estimatedDateTime")),
            status=map_status(it.get("remark")), status_raw=it.get("remark"),
        )

    def collect(self) -> tuple[list[Movement], list[Movement]]:
        deps = [m for it in self._fetch("getPassengerDeparturesDSOdp") if (m := self._to_movement(it, "O"))]
        arrs = [m for it in self._fetch("getPassengerArrivalsDSOdp") if (m := self._to_movement(it, "I"))]
        log.info("[ICN] 출발 %d / 도착 %d (호출 %d회)", len(deps), len(arrs), self.calls)
        return deps, arrs
