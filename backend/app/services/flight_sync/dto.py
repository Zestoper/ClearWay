"""
두 기관(한국공항공사 / 인천국제공항공사) 응답을 하나로 맞춘 '원본 운항 기록'.

한 레코드는 공항 하나 기준의 출발 또는 도착 기록이다.
- 출발 기록: 출발 시각만 안다 (도착 시각 없음)
- 도착 기록: 도착 시각만 안다 (출발 시각 없음)
두 기록을 편명으로 짝지어 하나의 항공편(Flight)으로 만드는 건 builder.py가 한다.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

Status = Literal["SCHEDULED", "BOARDING", "DEPARTED", "ARRIVED", "DELAYED", "CANCELLED", "DIVERTED", "UNKNOWN"]


@dataclass
class Movement:
    source: str                 # "KAC" | "ICN"
    io: Literal["O", "I"]       # O = 출발 기록 / I = 도착 기록
    flight_no: str
    airline: str
    origin: str                 # IATA
    dest: str                   # IATA
    scheduled: datetime         # 한국 공항 기준 시각(KST)
    estimated: Optional[datetime]
    status: Status
    status_raw: Optional[str] = None
