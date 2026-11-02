from sqlalchemy import Column, Date, DateTime, Integer, String, UniqueConstraint
from app.db.base import Base


class FareLookup(Base):
    """
    실시세(SerpApi Google Flights) 조회 기록.

    - 같은 노선·날짜를 캐시 시간 안에 다시 조회하지 않기 위한 기록
    - 이번 달 사용량(무료 월 250회)을 세기 위한 기록
    """
    __tablename__ = "fare_lookups"
    __table_args__ = (UniqueConstraint("from_code", "to_code", "date", name="uq_fare_lookup_route_date"),)

    id = Column(Integer, primary_key=True)
    from_code = Column(String(3), nullable=False)
    to_code = Column(String(3), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(16), nullable=False)       # ok / empty / error
    matched = Column(Integer, nullable=False, default=0)  # 우리 항공편과 매칭된 수
    calls = Column(Integer, nullable=False, default=0)    # 누적 API 호출 수 (월 사용량 집계용)
    fetched_at = Column(DateTime(timezone=True), nullable=False)
    message = Column(String(300), nullable=True)
