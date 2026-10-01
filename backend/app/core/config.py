from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "CLEARWAY"
    DATABASE_URL: str = "postgresql://localhost:5432/clearway"  # 비밀번호는 .env에만 둔다
    SECRET_KEY: str = ""  # 반드시 .env / 배포 환경변수로 설정 (코드에 기본값을 두면 누구나 토큰을 위조할 수 있다)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"]
    ALLOW_ALL_ORIGINS: bool = False
    FRONTEND_URL: str = "http://localhost:5173"
    AI_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
    CEREBRAS_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    SMTP_HOST: str = "smtp.naver.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    AERODATABOX_API_KEY: str = ""

    class Config:
        env_file = ".env"

settings = Settings()

if not settings.SECRET_KEY:
    # 환경변수가 빠져도 '알려진 키'로 돌지 않도록 임시 랜덤 키를 만든다.
    # (서버가 재시작되면 기존 로그인 토큰은 무효가 되므로 실제 운영에서는 꼭 SECRET_KEY를 설정할 것)
    import logging, secrets
    settings.SECRET_KEY = secrets.token_urlsafe(48)
    logging.getLogger(__name__).warning("SECRET_KEY가 설정되지 않아 임시 랜덤 키를 사용합니다. .env 또는 배포 환경변수에 SECRET_KEY를 설정하세요.")
