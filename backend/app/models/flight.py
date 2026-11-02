from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, DateTime, Index
from sqlalchemy.orm import relationship
from app.db.base import Base

class Flight(Base):
    __tablename__ = "flights"
    __table_args__ = (
        # 검색 패턴: 출발지 + 도착지 + 날짜
        Index("ix_flights_route_date", "from_code", "to_code", "date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    # 실제 편명은 매일 반복되므로 (KE1234가 매일 운항) 편명 단독 유니크 제약은 두지 않는다.
    flight_no = Column(String(10), nullable=False, index=True)

    from_city = Column(String(50), nullable=False)
    from_code = Column(String(3), nullable=False)
    from_airport = Column(String(100), nullable=False)

    to_city = Column(String(50), nullable=False)
    to_code = Column(String(3), nullable=False)
    to_airport = Column(String(100), nullable=False)

    date = Column(Date, nullable=False)
    depart_time = Column(String(5), nullable=False)
    arrival_time = Column(String(5), nullable=False)
    duration = Column(String(10), nullable=False)

    economy_price = Column(Numeric(10, 2), nullable=False)
    business_price = Column(Numeric(10, 2), nullable=False)
    economy_seats = Column(Integer, default=120)
    business_seats = Column(Integer, default=20)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    is_direct = Column(Boolean, default=True, nullable=False)
    via_city = Column(String(50), nullable=True)

    # ── 실데이터 동기화 (app/services/flight_sync) ──
    # mock: 기존 시드 데이터 / KAC: 한국공항공사 / ICN: 인천국제공항공사
    source = Column(String(8), nullable=False, default="mock", server_default="mock")
    # '편명|운항일|출발|도착' — 같은 편을 다시 수집하면 이 키로 upsert
    sync_key = Column(String(40), unique=True, nullable=True)
    airline = Column(String(50), nullable=True)
    status = Column(String(16), nullable=True)            # SCHEDULED / DELAYED / CANCELLED ...
    depart_estimated = Column(String(5), nullable=True)   # 변경된 출발 시각 (지연 등)
    synced_at = Column(DateTime(timezone=True), nullable=True)
    # 운임 출처: estimated(노선 기준 산정) / live(SerpApi 구글 항공권 실시세)
    price_source = Column(String(10), nullable=False, default="estimated", server_default="estimated")
    price_updated_at = Column(DateTime(timezone=True), nullable=True)

    bookings = relationship("Booking", back_populates="flight")
