"""Groq 모델 폴백 체인.

Groq는 무료 한도를 계정 안에서 모델별로 따로 센다.
한 모델이 막히면(한도 초과 429 · 모델 폐기 404 · 요청 과대 413 · 서버 오류 5xx)
다음 모델로 넘어가고, 전부 막히면 마지막 응답을 그대로 돌려줘서
호출한 쪽이 기존처럼 상태 코드를 처리하거나 Cerebras로 폴백하게 한다.
"""
import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# 기본 순서: 정확도 높은 모델 → 가벼운 모델 → 다른 계열 모델
GROQ_MODELS = ("openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b")
GROQ_MODELS_LIGHT = ("openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b")

_NEXT_MODEL_STATUS = {404, 413, 429, 500, 502, 503, 504}


def groq_chat(api_key: str, payload: dict, timeout: float = 60.0, models: tuple = GROQ_MODELS) -> httpx.Response:
    last: httpx.Response | Exception | None = None
    for model in models:
        body = {k: v for k, v in payload.items() if k not in ("model", "reasoning_effort")}
        body["model"] = model
        if model.startswith("openai/gpt-oss"):
            body["reasoning_effort"] = "low"   # 추론형 모델 — 생각은 짧게
        elif model.startswith("qwen/"):
            body["reasoning_effort"] = "none"  # qwen 생각 모드 끔
        try:
            resp = httpx.post(GROQ_URL, headers={"Authorization": f"Bearer {api_key}"}, json=body, timeout=timeout)
        except httpx.TransportError as e:
            print(f"[Groq] {model} 연결 실패 — 다음 모델 시도: {e}")
            last = e
            continue
        if resp.status_code in _NEXT_MODEL_STATUS:
            print(f"[Groq] {model} {resp.status_code} — 다음 모델 시도")
            last = resp
            continue
        return resp
    if isinstance(last, httpx.Response):
        return last
    raise last or RuntimeError("Groq 호출 실패")
