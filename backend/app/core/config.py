from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    PROJECT_NAME: str = "CLEARWAY"
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/clearway"
    SECRET_KEY: str = "clearway-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"]
    ALLOW_ALL_ORIGINS: bool = False
    FRONTEND_URL: str = "http://localhost:5173"
    AI_PROVIDER: str = "groq"          # groq | gemini | anthropic
    GROQ_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    SMTP_HOST: str = "smtp.naver.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
