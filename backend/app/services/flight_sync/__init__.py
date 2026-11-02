"""
공공데이터포털 실시간 운항 데이터를 flights 테이블로 동기화.

- kac.py      한국공항공사 (김포·김해·제주 등 14개 공항)
- incheon.py  인천국제공항공사
- builder.py  출발·도착 기록 → 예약 가능한 항공편 행
- reference.py 공공 API에 없는 운임·비행시간·시차 기준표
- sync.py     수집 → 변환 → upsert
"""
from .sync import get_last_result, run_sync

__all__ = ["run_sync", "get_last_result"]
