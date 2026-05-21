import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from app.db.database import get_db
from app.models.trip_plan import TripPlan
from app.models.user import User
from app.api.v1.deps import get_current_user, get_optional_user
from app.core.config import settings

router = APIRouter()

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class FoodRestrictions(BaseModel):
    cant_eat: str = ""
    allergy: str = ""
    prefer: str = ""

class TripPlanCreate(BaseModel):
    destination: str
    destination_en: str
    arrival_date: str
    arrival_time: str
    departure_date: str
    departure_time: str
    hotel_location: str
    travel_style: str        # relaxed / normal / tight
    travel_types: List[str]  # food, activity, nature, shopping, history, night
    food_restrictions: FoodRestrictions
    transport: str           # walk / transit / rental
    budget: str              # budget / normal / premium
    companion: str           # solo / friends / couple / family
    booking_ref: Optional[str] = None
    total_budget_krw: Optional[int] = None  # 1인 총 예산 (원)

class PlanItemUpdate(BaseModel):
    time: Optional[str] = None
    duration_min: Optional[int] = None
    notes: Optional[str] = None

# ── Helpers ───────────────────────────────────────────────────────────────────

STYLE_DESC = {
    "relaxed": "여유로운 (하루 3~4개, 12:00 이후 시작, 카페·휴식 포함)",
    "normal":  "일반 (하루 5~6개, 10:00 시작)",
    "tight":   "타이트 (하루 7~9개, 08:00 시작, 동선 최소화)",
}
TRANSPORT_DESC = {"walk": "도보", "transit": "대중교통", "rental": "렌트카"}
BUDGET_DESC = {"budget": "저예산 (로컬 식당, 무료 명소 우선)", "normal": "일반 예산", "premium": "프리미엄 (미슐랭, 고급 체험)"}
COMPANION_DESC = {"solo": "혼자", "friends": "친구와", "couple": "연인과", "family": "가족과 (아이 포함 가능)"}
TYPE_DESC = {
    "food": "맛집", "activity": "액티비티/체험", "nature": "자연/힐링",
    "shopping": "쇼핑", "history": "역사/유적", "night": "야경/나이트라이프",
}

SYSTEM_PROMPT = """You are an expert Korean travel planner. Create detailed, realistic travel itineraries in Korean.
Rules: only real places (findable on Google Maps), optimize routes by clustering nearby locations, include meals every day, match schedule density to travel style exactly, ratings must be realistic Google Maps scores (4.0-4.9).
Respond with valid JSON only — no markdown, no explanation."""

def build_user_prompt(data: TripPlanCreate) -> str:
    types_str = ", ".join(TYPE_DESC.get(t, t) for t in data.travel_types) or "자유"
    food_info = []
    if data.food_restrictions.cant_eat: food_info.append(f"못먹음:{data.food_restrictions.cant_eat}")
    if data.food_restrictions.allergy:  food_info.append(f"알레르기:{data.food_restrictions.allergy}")
    if data.food_restrictions.prefer:   food_info.append(f"선호:{data.food_restrictions.prefer}")
    food_str = "/".join(food_info) if food_info else "없음"

    style_count = {"relaxed": "하루 3~4개 일정만, 첫일정 12:00 이후", "normal": "하루 5~6개 일정, 첫일정 10:00", "tight": "하루 7~9개 일정, 첫일정 08:00"}
    count_rule = style_count.get(data.travel_style, "하루 5~6개 일정, 첫일정 10:00")

    budget_constraint = ""
    if data.total_budget_krw and data.total_budget_krw > 0:
        budget_constraint = f"\nBUDGET CONSTRAINT: total_estimated_cost for the whole trip must not exceed ₩{data.total_budget_krw:,}. Distribute daily_estimated_cost proportionally across days."

    return f"""Create a Korean travel itinerary as JSON.

Destination:{data.destination}({data.destination_en}) | Arrive:{data.arrival_date} {data.arrival_time} | Depart:{data.departure_date} {data.departure_time}
Hotel:{data.hotel_location} | Style:{STYLE_DESC.get(data.travel_style)} | Types:{types_str} | Food:{food_str}
Transport:{TRANSPORT_DESC.get(data.transport)} | Budget:{BUDGET_DESC.get(data.budget)} | With:{COMPANION_DESC.get(data.companion)}{budget_constraint}

Rules: {count_rule}. MEAL RULE: place a restaurant/cafe item every 6 hours without exception (e.g. 08:00 breakfast, 13:00 lunch, 19:00 dinner — never skip more than 6h without eating). Cluster nearby places. Start day1 after arrival. End last day 2h before departure.
Places: restaurants Google Maps 4.2+, attractions 4.3+. Real famous places only. All text in Korean except place_name_en and maps_query.
Cost rules: estimated_cost = entry fee + average spend per person in KRW (use 0 for free places like parks/temples with no fee). distance_from_prev = walking/driving distance in km between this place and previous one (e.g. "1.2km", use "0km" for first item of day). Compute daily_estimated_cost as sum of items in that day. Compute total_estimated_cost as sum of all days.

Output compact JSON (keep reason under 80 Korean chars, tip optional):
{{"summary":"...","total_estimated_cost":350000,"highlights":["...","...","..."],"days":[{{"day":1,"date":"YYYY-MM-DD","title":"...","daily_estimated_cost":120000,"items":[{{"id":"d1_1","time":"HH:MM","period":"morning|afternoon|evening|night","place_name":"장소명","place_name_en":"Name","category":"restaurant|attraction|cafe|shopping|activity|accommodation","rating":4.5,"duration_min":60,"distance_from_prev":"1.2km","travel_time_min":10,"reason":"한줄추천이유","tip":"팁","estimated_cost":15000,"lat":0.0,"lng":0.0,"maps_query":"query"}}]}}]}}"""

def build_title(name: str, destination: str) -> str:
    return f"{name}님의 {destination} 여행"

def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()

_SIMPLE_SYSTEM = "You are a helpful JSON assistant. Respond with valid JSON only — no markdown, no explanation. All text values in the JSON must be written in Korean (한국어) only — never use Japanese, Chinese, or any other language."

def _call_groq(prompt: str, system: str = SYSTEM_PROMPT) -> str:
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY가 설정되지 않았습니다.\nhttps://console.groq.com 에서 무료 API 키를 발급받아 .env에 추가하세요.")
    resp = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": prompt},
            ],
            "temperature": 0.7,
            "max_tokens": 8000,
            "response_format": {"type": "json_object"},
        },
        timeout=120.0,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]

def _call_gemini(prompt: str, system: str = SYSTEM_PROMPT) -> str:
    if not settings.GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY가 설정되지 않았습니다.\nhttps://aistudio.google.com 에서 무료 API 키를 발급받아 .env에 추가하세요.")
    full_prompt = f"{system}\n\n{prompt}"
    resp = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GOOGLE_API_KEY}",
        json={
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "maxOutputTokens": 32768},
        },
        timeout=120.0,
    )
    resp.raise_for_status()
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]

def _call_anthropic(prompt: str, system: str = SYSTEM_PROMPT) -> str:
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY가 설정되지 않았습니다.")
    import anthropic as ant
    client = ant.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=16000,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text

def _call_ai(prompt: str, system: str = SYSTEM_PROMPT) -> str:
    provider = settings.AI_PROVIDER.lower()
    if provider == "groq":
        return _call_groq(prompt, system)
    elif provider == "gemini":
        return _call_gemini(prompt, system)
    elif provider == "anthropic":
        return _call_anthropic(prompt, system)
    else:
        raise ValueError(f"알 수 없는 AI_PROVIDER: {provider} (groq / gemini / anthropic 중 선택)")

def generate_plan_sync(plan_id: int, data_dict: dict):
    from app.db.database import SessionLocal
    db = SessionLocal()
    try:
        plan = db.query(TripPlan).filter(TripPlan.id == plan_id).first()
        if not plan:
            return

        plan.status = "generating"
        db.commit()

        create_data = TripPlanCreate(**data_dict)
        prompt = build_user_prompt(create_data)

        raw = _call_ai(prompt)
        plan_data = json.loads(_strip_fences(raw))

        plan.plan_data = plan_data
        plan.status = "done"
        db.commit()

    except json.JSONDecodeError as e:
        plan = db.query(TripPlan).filter(TripPlan.id == plan_id).first()
        if plan:
            plan.status = "error"
            plan.error_msg = f"AI 응답 파싱 오류: {str(e)}"
            db.commit()
    except Exception as e:
        plan = db.query(TripPlan).filter(TripPlan.id == plan_id).first()
        if plan:
            plan.status = "error"
            plan.error_msg = str(e)
            db.commit()
    finally:
        db.close()

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/plans", status_code=201)
def create_plan(
    body: TripPlanCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    user_name = current_user.name if current_user else "여행자"
    plan = TripPlan(
        user_id=current_user.id if current_user else None,
        title=build_title(user_name, body.destination),
        destination=body.destination,
        destination_en=body.destination_en,
        arrival_date=body.arrival_date,
        arrival_time=body.arrival_time,
        departure_date=body.departure_date,
        departure_time=body.departure_time,
        hotel_location=body.hotel_location,
        travel_style=body.travel_style,
        travel_types=body.travel_types,
        food_restrictions=body.food_restrictions.model_dump(),
        transport=body.transport,
        budget=body.budget,
        companion=body.companion,
        booking_ref=body.booking_ref,
        status="pending",
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    data_dict = body.model_dump()
    data_dict["food_restrictions"] = body.food_restrictions.model_dump()
    background_tasks.add_task(generate_plan_sync, plan.id, data_dict)

    return {"id": plan.id, "title": plan.title, "status": plan.status}


@router.get("/plans")
def list_plans(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if not current_user:
        return []
    plans = db.query(TripPlan).filter(TripPlan.user_id == current_user.id).order_by(TripPlan.created_at.desc()).all()
    return [
        {
            "id": p.id, "title": p.title, "destination": p.destination,
            "destination_en": p.destination_en, "arrival_date": p.arrival_date,
            "departure_date": p.departure_date, "status": p.status,
            "booking_ref": p.booking_ref, "companion": p.companion,
            "travel_style": p.travel_style, "created_at": str(p.created_at),
        }
        for p in plans
    ]


@router.get("/plans/{plan_id}")
def get_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    plan = db.query(TripPlan).filter(TripPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="여행 계획을 찾을 수 없습니다.")
    if plan.user_id and (not current_user or plan.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    return {
        "id": plan.id, "title": plan.title, "destination": plan.destination,
        "destination_en": plan.destination_en, "arrival_date": plan.arrival_date,
        "arrival_time": plan.arrival_time, "departure_date": plan.departure_date,
        "departure_time": plan.departure_time, "hotel_location": plan.hotel_location,
        "travel_style": plan.travel_style, "travel_types": plan.travel_types,
        "food_restrictions": plan.food_restrictions, "transport": plan.transport,
        "budget": plan.budget, "companion": plan.companion, "booking_ref": plan.booking_ref,
        "status": plan.status, "plan_data": plan.plan_data, "error_msg": plan.error_msg,
        "created_at": str(plan.created_at),
    }


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(TripPlan).filter(TripPlan.id == plan_id, TripPlan.user_id == current_user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="여행 계획을 찾을 수 없습니다.")
    db.delete(plan)
    db.commit()


class PackingRequest(BaseModel):
    destination: str
    days: int
    companion: str
    travel_types: List[str]
    budget: str

class RecommendRequest(BaseModel):
    duration: int
    budget: str
    vibes: List[str]

@router.post("/packing-list")
def get_packing_list(body: PackingRequest):
    companion_kr = COMPANION_DESC.get(body.companion, body.companion)
    types_kr = ", ".join(TYPE_DESC.get(t, t) for t in body.travel_types) or "자유"
    budget_kr = BUDGET_DESC.get(body.budget, body.budget)
    prompt = f"""다음 여행자를 위한 여행 짐 리스트를 작성하세요.
여행지: {body.destination}, 기간: {body.days}일, 동행: {companion_kr}, 관심사: {types_kr}, 예산: {budget_kr}

중요: 모든 텍스트(name, items 안의 모든 값)는 반드시 한국어로만 작성하세요. 일본어·영어·중국어 사용 절대 금지.

아래 JSON 형식으로만 응답하세요:
{{"categories": [{{"name": "카테고리명", "icon": "이모지", "items": ["아이템1", "아이템2"]}}]}}

카테고리는 반드시: 의류/신발, 세면도구, 의약품/상비약, 전자기기, 여행서류, 기타 — 6개.
각 카테고리 5~8개 아이템. 여행지·동행·관심사에 맞게 맞춤화. 아이템 이름은 한국어로만."""
    try:
        raw = _call_ai(prompt, system=_SIMPLE_SYSTEM)
        return json.loads(_strip_fences(raw))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommend")
def recommend_destination(body: RecommendRequest):
    budget_kr = {"budget": "저예산(1인당 하루 5만원 이하)", "normal": "일반(1인당 하루 10~15만원)", "premium": "프리미엄(1인당 하루 20만원 이상)"}.get(body.budget, body.budget)
    vibes_kr = ", ".join(body.vibes) if body.vibes else "자유여행"
    prompt = f"""한국(인천공항)에서 출발하는 여행자에게 여행지 3곳을 추천해주세요.
기간: {body.duration}일, 예산: {budget_kr}, 선호 테마: {vibes_kr}

반드시 아래 JSON 형식으로만 응답하세요 (est_budget_per_day는 반드시 정수):
{{"destinations": [{{"city": "한국어도시명", "city_en": "English City", "country": "나라명", "code": "IATA공항코드3자리", "emoji": "이모지", "reason": "30자 이내 추천이유", "highlight": "대표 매력 한 줄", "est_budget_per_day": 80000}}]}}

실제 IATA 공항코드 사용. 예: 도쿄=NRT, 방콕=BKK, 파리=CDG, 오사카=KIX, 싱가포르=SIN."""
    try:
        raw = _call_ai(prompt, system=_SIMPLE_SYSTEM)
        return json.loads(_strip_fences(raw))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _call_flight_rec_ai(prompt: str) -> str:
    """항공편 추천용: 가벼운 모델 우선 시도, 실패시 기본 모델."""
    provider = settings.AI_PROVIDER.lower()
    if provider == "groq":
        for model in ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]:
            try:
                resp = httpx.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": _SIMPLE_SYSTEM},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 1000,
                        "response_format": {"type": "json_object"},
                    },
                    timeout=60.0,
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
            except Exception:
                continue
        raise ValueError("Groq API 호출 실패 (rate limit 또는 오류)")
    return _call_ai(prompt, _SIMPLE_SYSTEM)


class FlightRecommendRequest(BaseModel):
    query: str

@router.post("/flight-recommend")
def ai_flight_recommend(body: FlightRecommendRequest, db: Session = Depends(get_db)):
    from app.models.flight import Flight as FlightModel
    from datetime import date as date_type
    today = date_type.today()
    from sqlalchemy import func
    # 목적지별 최저 economy_price subquery
    subq = (
        db.query(
            FlightModel.to_code,
            func.min(FlightModel.economy_price).label("min_price"),
        )
        .filter(
            FlightModel.date >= today,
            FlightModel.is_cancelled == False,
            FlightModel.from_code == "ICN",
            FlightModel.economy_seats > 0,
        )
        .group_by(FlightModel.to_code)
        .subquery()
    )
    flights = (
        db.query(FlightModel)
        .join(subq, (FlightModel.to_code == subq.c.to_code) & (FlightModel.economy_price == subq.c.min_price))
        .filter(
            FlightModel.date >= today,
            FlightModel.is_cancelled == False,
            FlightModel.from_code == "ICN",
            FlightModel.economy_seats > 0,
        )
        .order_by(FlightModel.economy_price)
        .all()
    )
    # 같은 to_code+price 중복 제거 (동일 가격 여러 편 있을 수 있음)
    seen: set = set()
    compact_flights_list = []
    for f in flights:
        if f.to_code not in seen:
            seen.add(f.to_code)
            compact_flights_list.append(f)
    compact_flights = sorted(compact_flights_list, key=lambda f: int(f.economy_price))

    if not compact_flights:
        raise HTTPException(status_code=404, detail="예약 가능한 항공편이 없습니다.")

    _REGION_MAP: dict[str, str] = {
        "GMP":"국내","PUS":"국내","CJU":"국내","TAE":"국내","KWJ":"국내","CJJ":"국내","RSU":"국내","YNY":"국내",
        "NRT":"일본","HND":"일본","KIX":"일본","FUK":"일본","OKA":"일본","NGO":"일본","CTS":"일본",
        "PEK":"중국","PVG":"중국","CAN":"중국","CTU":"중국","XIY":"중국",
        "TPE":"대만","HKG":"홍콩",
        "BKK":"동남아","DMK":"동남아","SIN":"동남아","MNL":"동남아","KUL":"동남아",
        "HAN":"동남아","SGN":"동남아","DAD":"동남아","DPS":"동남아","CGK":"동남아",
        "LAX":"미주","JFK":"미주","SFO":"미주","YVR":"미주","YYZ":"미주",
        "LHR":"유럽","CDG":"유럽","FRA":"유럽","AMS":"유럽","FCO":"유럽","MAD":"유럽","BCN":"유럽",
        "SYD":"오세아니아","MEL":"오세아니아","AKL":"오세아니아",
        "DXB":"중동","DOH":"중동",
    }
    _REGION_KEYWORDS: list[tuple[str, str]] = [
        ("동남아", "동남아"), ("일본", "일본"), ("중국", "중국"),
        ("유럽", "유럽"), ("미주", "미주"), ("미국", "미주"),
        ("국내", "국내"), ("오세아니아", "오세아니아"),
        ("대만", "대만"), ("홍콩", "홍콩"), ("중동", "중동"),
    ]

    # 쿼리에서 지역 키워드 감지 → 해당 지역만 AI에 전달
    q_lower = body.query
    matched_region = next((r for kw, r in _REGION_KEYWORDS if kw in q_lower), None)
    filtered_for_ai = (
        [f for f in compact_flights if _REGION_MAP.get(f.to_code) == matched_region]
        if matched_region else compact_flights
    )
    if not filtered_for_ai:
        filtered_for_ai = compact_flights  # fallback

    flight_list = [
        {
            "id": f.id,
            "to_city": f.to_city,
            "to_code": f.to_code,
            "date": str(f.date),
            "duration": f.duration,
            "economy_price": int(f.economy_price),
            "is_direct": f.is_direct,
        }
        for f in filtered_for_ai
    ]

    prompt = f"""사용자 요청: "{body.query}"

예약 가능한 항공편 목록 (인천 출발{f' — {matched_region} 지역만' if matched_region else ''}):
{json.dumps(flight_list, ensure_ascii=False)}

위 목록에서 사용자 요청에 가장 잘 맞는 항공편을 1~3개 추천하세요.
- economy_price 기준으로 예산 판단 (예: 30만원 = 300000)
- 목록에 없는 id는 절대 사용 금지
- 추천 이유는 한국어 2문장 이내

JSON:
{{"message": "한줄 추천 멘트", "recommendations": [{{"flight_id": 숫자, "reason": "추천 이유"}}]}}"""

    try:
        raw = _call_flight_rec_ai(prompt)
        data = json.loads(_strip_fences(raw))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    valid_ids = {f.id for f in filtered_for_ai}
    flight_map = {f.id: f for f in filtered_for_ai}
    result = []
    for r in data.get("recommendations", []):
        fid = r.get("flight_id")
        if fid not in valid_ids:
            continue
        f = flight_map[fid]
        result.append({
            "flight_id": f.id,
            "flight_no": f.flight_no,
            "from_city": f.from_city,
            "from_code": f.from_code,
            "to_city": f.to_city,
            "to_code": f.to_code,
            "date": str(f.date),
            "depart_time": f.depart_time,
            "arrival_time": f.arrival_time,
            "duration": f.duration,
            "economy_price": int(f.economy_price),
            "business_price": int(f.business_price),
            "is_direct": f.is_direct,
            "reason": r.get("reason", ""),
        })

    result.sort(key=lambda x: x["economy_price"])
    return {"message": data.get("message", ""), "flights": result}


@router.patch("/plans/{plan_id}/items/{item_id}")
def update_plan_item(
    plan_id: int,
    item_id: str,
    body: PlanItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(TripPlan).filter(TripPlan.id == plan_id, TripPlan.user_id == current_user.id).first()
    if not plan or not plan.plan_data:
        raise HTTPException(status_code=404, detail="계획을 찾을 수 없습니다.")

    updated = False
    for day in plan.plan_data.get("days", []):
        for item in day.get("items", []):
            if item.get("id") == item_id:
                if body.time is not None: item["time"] = body.time
                if body.duration_min is not None: item["duration_min"] = body.duration_min
                if body.notes is not None: item["notes"] = body.notes
                updated = True
    if not updated:
        raise HTTPException(status_code=404, detail="일정 항목을 찾을 수 없습니다.")

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(plan, "plan_data")
    db.commit()
    return {"ok": True}


# ── 일정 항목 삭제 ─────────────────────────────────────────────────────────────

@router.delete("/plans/{plan_id}/items/{item_id}", status_code=204)
def delete_plan_item(
    plan_id: int,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(TripPlan).filter(TripPlan.id == plan_id, TripPlan.user_id == current_user.id).first()
    if not plan or not plan.plan_data:
        raise HTTPException(status_code=404, detail="계획을 찾을 수 없습니다.")

    removed = False
    for day in plan.plan_data.get("days", []):
        before = len(day.get("items", []))
        day["items"] = [it for it in day.get("items", []) if it.get("id") != item_id]
        if len(day["items"]) < before:
            removed = True
            day["daily_estimated_cost"] = sum((it.get("estimated_cost") or 0) for it in day["items"])

    if not removed:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")

    plan.plan_data["total_estimated_cost"] = sum(
        (day.get("daily_estimated_cost") or 0) for day in plan.plan_data.get("days", [])
    )

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(plan, "plan_data")
    db.commit()


# ── 일정 항목 AI 교체 ─────────────────────────────────────────────────────────

class ReplaceItemRequest(BaseModel):
    hint: Optional[str] = None

@router.post("/plans/{plan_id}/items/{item_id}/replace")
def replace_plan_item(
    plan_id: int,
    item_id: str,
    body: ReplaceItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(TripPlan).filter(TripPlan.id == plan_id, TripPlan.user_id == current_user.id).first()
    if not plan or not plan.plan_data:
        raise HTTPException(status_code=404, detail="계획을 찾을 수 없습니다.")

    current_item = None
    day_info: dict = {}
    for day in plan.plan_data.get("days", []):
        for item in day.get("items", []):
            if item.get("id") == item_id:
                current_item = dict(item)
                day_info = {"date": day.get("date", ""), "title": day.get("title", "")}
                break

    if not current_item:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")

    hint_line = f'\n사용자 요청: "{body.hint}"' if body.hint else ""
    types_str = ", ".join(TYPE_DESC.get(t, t) for t in (plan.travel_types or []))

    prompt = f"""Replace one travel itinerary item with a different place. Return a single JSON object only.

Destination: {plan.destination} ({plan.destination_en})
Date: {day_info.get('date')} / {day_info.get('title')}
Budget: {BUDGET_DESC.get(plan.budget, plan.budget)}
Companion: {COMPANION_DESC.get(plan.companion, plan.companion)}
Travel interests: {types_str}{hint_line}

Current item to replace:
{json.dumps(current_item, ensure_ascii=False)}

Rules:
- Keep exactly: id="{item_id}", time="{current_item.get('time')}", period="{current_item.get('period')}"
- Must be a DIFFERENT place from "{current_item.get('place_name')}"
- Real place on Google Maps, rating 4.2+
- All text in Korean except place_name_en and maps_query
- Keep reason under 80 Korean chars

Return only this JSON (no arrays, no extra wrapper):
{{"id":"{item_id}","time":"{current_item.get('time')}","period":"{current_item.get('period')}","place_name":"장소명","place_name_en":"Name","category":"restaurant","rating":4.5,"duration_min":60,"distance_from_prev":"1.0km","travel_time_min":10,"reason":"추천이유","estimated_cost":15000,"lat":0.0,"lng":0.0,"maps_query":"검색어"}}"""

    try:
        raw = _call_ai(prompt, system=_SIMPLE_SYSTEM)
        new_item = json.loads(_strip_fences(raw))
        new_item["id"] = item_id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 교체 실패: {str(e)}")

    from sqlalchemy.orm.attributes import flag_modified
    for day in plan.plan_data.get("days", []):
        for i, item in enumerate(day.get("items", [])):
            if item.get("id") == item_id:
                day["items"][i] = new_item
                day["daily_estimated_cost"] = sum((it.get("estimated_cost") or 0) for it in day["items"])
                break

    plan.plan_data["total_estimated_cost"] = sum(
        (day.get("daily_estimated_cost") or 0) for day in plan.plan_data.get("days", [])
    )

    flag_modified(plan, "plan_data")
    db.commit()
    return new_item
