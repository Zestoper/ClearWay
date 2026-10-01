from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import api_router
from app.db.database import create_tables

import logging
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 예전에는 모듈을 불러오는 순간 테이블 생성(DB 접속)을 해서 DB가 잠깐만 안 돼도 서버 자체가 뜨지 않았다.
    # 이제 서버 시작 단계에서 시도하고, 실패해도 서버는 띄운 채 로그만 남긴다 (/health 등은 정상 응답).
    try:
        create_tables()
    except Exception as e:
        logger.error("DB 테이블 생성/연결 실패 — DB 설정을 확인하세요: %r", e)
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.ALLOW_ALL_ORIGINS else settings.ALLOWED_ORIGINS,
    allow_credentials=not settings.ALLOW_ALL_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok"}
