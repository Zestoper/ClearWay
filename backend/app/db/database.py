from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.db.base import Base

connect_args = {}
if "neon.tech" in settings.DATABASE_URL:
    connect_args = {"sslmode": "require"}

# Neon은 쉬고 있으면 연결을 끊는다. 끊긴 연결을 그대로 쓰면 첫 요청이 500으로 실패하고
# (에러 응답에는 CORS 헤더가 없어서 브라우저에는 CORS 오류로 보인다)
# → 쓰기 전에 연결을 확인하고(pre_ping) 5분 지난 연결은 새로 만든다(recycle).
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    import app.models
    Base.metadata.create_all(bind=engine)
