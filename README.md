# ✈️ CLEARWAY — 항공권 예약 플랫폼

> 공공데이터 실제 운항 스케줄과 구글 항공권 시세로 동작하는 풀스택 항공권 예약 서비스

**서비스**: https://clear-way-drab.vercel.app
> 백엔드는 Render 무료 플랜이라 처음 접속 시 서버가 깨어나는 데 최대 1분 정도 걸립니다.

---

## 목차

- [프로젝트 한눈에 보기](#-프로젝트-한눈에-보기)
- [CLEARWAY 소개](#-clearway-소개)
- [핵심 기능](#-핵심-기능)
- [실데이터 항공편](#-실데이터-항공편)
- [기술 스펙](#-기술-스펙)
- [개발 구조](#-개발-구조)
- [트러블슈팅](#-트러블슈팅)
- [프로젝트 결과](#-프로젝트-결과)

---

## 📌 프로젝트 한눈에 보기

| 항목 | 내용 |
|------|------|
| 서비스명 | CLEARWAY · 클리어웨이 |
| 한 줄 소개 | 실제 운항 스케줄 기반 항공권 검색·예약과 AI 리뷰 분석·실시간 상담을 제공하는 플랫폼 |
| 핵심 스택 | Python · FastAPI · PostgreSQL · React 19 · TypeScript · Vite |
| 배포 | Vercel (Frontend) · Render (Backend) · Neon (PostgreSQL) |
| 데이터 | 한국공항공사·인천국제공항공사 운항 API (스케줄) · SerpApi Google Flights (운임 시세) |

### 서비스 키워드

- ✈️ **항공권 검색 & 예약** — 공공데이터 실제 운항 스케줄 약 11,500편 (오늘~6일 후)
- 💸 **실시세 운임** — 구글 항공권 시세를 편명 단위로 매칭
- 🧳 **온라인 체크인**
- 📊 **NEXTRIP — 가격 트렌드 분석**
- 🤖 **AI 리뷰 분석** (Groq / Gemini / Anthropic)
- 💬 **실시간 채팅 상담**
- 📋 **내 예약 관리**
- 🔔 **공지 & 이벤트**
- 🛡️ **관리자 대시보드**

---

## ✈️ CLEARWAY 소개

> **CLEARWAY는 여행의 시작부터 끝까지를 한 곳에서 관리할 수 있는 항공권 예약 플랫폼입니다.**  
> "어느 항공편을, 얼마에, 언제 예약하면 좋을지"를 AI와 데이터 기반으로 안내합니다.

### 왜 만들었나요?

- 기존 항공 예약 서비스는 검색·결제·체크인이 각각 분리되어 있어 사용자 경험이 단절됨
- 가격 변동 추이를 직관적으로 보여주는 서비스가 부족해 최적 예약 시점을 놓치기 쉬움
- AI를 활용한 리뷰 요약과 실시간 상담으로 의사결정을 빠르게 돕는 서비스 필요

### 핵심 타겟

- 항공권 가격 변동에 민감한 여행 계획자
- 체크인·예약 확인을 한 곳에서 처리하고 싶은 출장·여행객
- AI 기반 리뷰 요약으로 항공사 선택을 빠르게 하고 싶은 사용자

---

## 🛠️ 핵심 기능

| # | 기능 | 설명 |
|---|------|------|
| 1 | **항공권 검색 & 예약** | 인천·김포·김해·제주 출발 실제 운항편 검색 및 좌석 예약 (실시세 / 산정가 배지 표시) |
| 2 | **온라인 체크인** | 예약 완료 후 웹에서 바로 체크인 처리 |
| 3 | **NEXTRIP** | 가격 트렌드 분석으로 최적 예약 시점 안내 |
| 4 | **AI 리뷰 분석** | Groq / Gemini / Anthropic 기반 리뷰 요약 및 분석 |
| 5 | **실시간 채팅** | 고객 문의 채팅 위젯 (ChatWidget) |
| 6 | **내 예약 관리** | 예약 이력 조회·수정·취소 |
| 7 | **가격 알림** | 목표 가격 등록 시 달성 여부 즉시 확인, 이메일 알림 수신 설정 가능 |
| 8 | **공지 & 이벤트** | 항공사 공지사항 및 프로모션 안내 |
| 9 | **관리자 대시보드** | 항공편·예약·사용자·인기 노선 통합 관리 |

### 화면 흐름도

```
Home (메인)
├── 항공편 검색
│   └── BookingFlow (예약 진행)
│       └── CheckIn (온라인 체크인)
├── NEXTRIP (가격 분석)
├── FlightStatus (운항 현황)
├── ReviewPage (리뷰 작성·조회)
│   └── AIReviewPage (AI 리뷰 분석)
├── NoticeEventPage (공지·이벤트)
├── CustomerService (고객센터)
│   └── ChatWidget (실시간 채팅)
├── Login → MyPage
│   └── MyReservations (내 예약)
└── AdminPage (관리자)
```

---

## ✈️ 실데이터 항공편

> 면접에서 "실제 데이터가 아니라 아쉽다"는 피드백을 받고 목업 항공편을 공공데이터 실제 운항 스케줄로 교체했습니다.

### 어디까지 실제 데이터인가

| 항목 | 출처 | 비고 |
|------|------|------|
| 편명 · 항공사 · 출발 시각 · 지연 · 결항 | **실제** — 한국공항공사 / 인천국제공항공사 운항 API | 오늘 ~ 6일 후 / 하루 4회 갱신 |
| 국내선 도착 시각 | **실제** — 같은 편명의 도착 기록과 매칭 | |
| 일반석 운임 | **실시세** — SerpApi Google Flights 편명 매칭 | 매칭 안 되면 같은 노선 실시세 중앙값으로 산정 |
| 국제선 해외 공항 시각 | 추정 — 노선별 평균 비행시간 + 현지 시차 | |
| 비즈니스석 운임 | 산정 — 일반석 운임 × 노선 배수 | |
| 잔여 좌석 | CLEARWAY 자체 판매 좌석 | 항공사 실재고는 GDS 계약 필요 |

화면에는 운임마다 `실시세` / `산정가` 배지를 붙여 어떤 값이 실제인지 구분합니다.

### 수집 흐름

```
GitHub Actions (하루 4회 cron)
   │  ① Render 서버 깨우기 (/health)  ② POST /api/v1/admin/flight-sync (토큰 인증)
   ▼
FastAPI 백그라운드 수집
   ├── 한국공항공사 API  (14개 공항 / 100건씩 6개 동시 호출 / 약 160회)
   └── 인천국제공항공사 API (한 번에 7일치 / 2회)
   ▼
출발·도착 기록 → 편명으로 짝짓기 → 코드쉐어 중복 제거 → 노선 기준표로 시차·운임 보정
   ▼
PostgreSQL upsert (sync_key = 편명|운항일|출발|도착)

사용자 검색 (출발지·도착지·날짜)
   └── 같은 노선·날짜를 12시간 안에 조회한 적 없으면 SerpApi 1회 호출 → 일반석 실시세 DB 반영
```

### 운영 수치

| 지표 | 값 |
|------|------|
| 예약 가능 항공편 | 약 11,500편 (7일) |
| 수집 시간 | 470초 → **114초** (동시 호출) |
| 공공 API 호출 | 수집 1회 약 162회 (일 한도 5,000 / 500 이내) |
| 실시세 매칭률 | 김포→제주 테스트 기준 구글 시세 72편 중 71편 매칭 |
| SerpApi 사용량 | 월 230회 예산 (무료 250회) / 노선·날짜별 12시간 캐싱 |

---

## 🧩 기술 스펙

### 기술 스택

| 영역 | 사용 기술 | 역할 |
|------|----------|------|
| Frontend | React 19 · TypeScript · Vite | SPA UI, 예약 흐름, 반응형 레이아웃 |
| Backend | FastAPI · SQLAlchemy · Uvicorn | REST API, 비즈니스 로직, JWT 인증 |
| Database | PostgreSQL (Neon) | 사용자·항공편·예약·채팅 데이터 저장 (서버리스 PostgreSQL) |
| AI | Groq (기본) / Gemini / Anthropic | 리뷰 요약·분석, 챗봇 응답 생성 |
| 외부 데이터 | 공공데이터포털 운항 API · SerpApi Google Flights | 실제 운항 스케줄 / 일반석 실시세 |
| Scheduler | GitHub Actions (cron) | Render 무료 서버가 잠들어도 하루 4회 수집 트리거 |
| Deploy | Vercel · Render · Neon | 프론트엔드 / 백엔드 / 서버리스 PostgreSQL |

### 시스템 아키텍처

```
Client (Browser)
   │
   ├── React SPA ─────────────── Vercel (정적 호스팅)
   │
   └── /api/v1/*  ───────────── FastAPI Backend (Render)
                                  ├── Auth (JWT / OAuth)
                                  ├── Flights & Bookings  ← 실시세 운임 반영 (SerpApi)
                                  ├── Flight Sync          ← 공공데이터 운항 API 수집
                                  ├── Reviews (AI 연동)
                                  ├── Chat (고객센터)
                                  ├── Nextrip (가격 분석)
                                  └── Admin
                                          │
                                 PostgreSQL (Neon Serverless DB)

GitHub Actions (cron 하루 4회) ──▶ POST /api/v1/admin/flight-sync
```

---

## 👨‍💻 개발 구조

<details>
<summary>📁 파일 구조 펼치기</summary>

```
CLEARWAY/
├── .github/workflows/
│   └── sync-flights.yml           # 하루 4회 실데이터 수집 트리거
├── render.yaml                    # Render 백엔드 배포 설정
├── backend/
│   ├── requirements.txt
│   ├── alembic/
│   └── app/
│       ├── main.py
│       ├── core/
│       │   └── config.py          # 환경변수 설정
│       ├── db/
│       │   └── database.py        # DB 연결
│       ├── models/                # SQLAlchemy 모델
│       │   ├── user.py
│       │   ├── flight.py
│       │   ├── booking.py
│       │   ├── review.py
│       │   ├── chat.py
│       │   └── ...
│       ├── schemas/               # Pydantic 스키마
│       ├── api/v1/
│       │   └── endpoints/
│       │       ├── auth.py
│       │       ├── flights.py
│       │       ├── bookings.py
│       │       ├── reviews.py
│       │       ├── chat.py
│       │       ├── nextrip.py
│       │       └── admin.py
│       └── services/              # 비즈니스 로직
│           ├── flight_sync/       # 공공데이터 운항 수집 (kac · incheon · builder · reference · sync)
│           └── fares/             # SerpApi 실시세 (캐싱 · 월 예산 · 산정가 폴백)
└── frontend/
    └── src/
        ├── components/
        │   ├── pages/
        │   │   ├── Home.tsx
        │   │   ├── FlightBooking.tsx
        │   │   ├── BookingFlow.tsx
        │   │   ├── CheckIn.tsx
        │   │   ├── Nextrip.tsx
        │   │   ├── AIReviewPage.tsx
        │   │   ├── ChatWidget.tsx
        │   │   ├── MyReservations.tsx
        │   │   ├── AdminPage.tsx
        │   │   └── ...
        │   └── layout/
        │       └── Header.tsx
        ├── services/              # API 호출 함수
        ├── store/                 # 전역 상태 관리
        └── types/                 # TypeScript 타입
```

</details>

### 주요 API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/auth/register` | 회원가입 |
| POST | `/api/v1/auth/login` | 로그인 (JWT 발급) |
| GET | `/api/v1/flights` | 항공편 검색 (실데이터 오늘~6일 후 / 노선·날짜 지정 시 실시세 반영) |
| POST | `/api/v1/admin/flight-sync` | 실데이터 수집 시작 (`X-Sync-Token` 헤더) |
| GET | `/api/v1/admin/flight-sync/status` | 마지막 수집 결과 |
| POST | `/api/v1/bookings` | 예약 생성 |
| GET | `/api/v1/bookings/me` | 내 예약 목록 |
| POST | `/api/v1/chat` | 채팅 메시지 전송 |
| GET | `/api/v1/reviews` | 리뷰 목록 조회 |
| GET | `/api/v1/nextrip` | NEXTRIP 가격 정보 |
| GET | `/api/v1/admin/popular-routes` | 인기 노선 조회 (관리자) |

---

## 🚀 시작하기

### 사전 요구 사항

- Node.js 20+
- Python 3.11+

### 로컬 개발 환경

```bash
git clone https://github.com/Zestoper/CLEARWAY.git
cd CLEARWAY
cp backend/.env.example backend/.env   # 값 입력
```

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install && npm run dev
```

### 환경 변수 (`backend/.env`)

```env
# Neon PostgreSQL (프로덕션)
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# AI 제공자 선택 (groq | gemini | anthropic)
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
ALLOW_ALL_ORIGINS=false
FRONTEND_URL=https://your-frontend.vercel.app

# 실데이터 항공편 — 공공데이터포털 일반 인증키
#   (한국공항공사_실시간 항공기 운항정보 조회_GW / 인천국제공항공사_여객편 주간 운항 현황)
DATA_GO_KR_SERVICE_KEY=
# 수집 API 보호 토큰 (GitHub Actions secret 과 같은 값)
FLIGHT_SYNC_TOKEN=
# 일반석 실시세 (비워두면 산정가만 사용)
SERPAPI_KEY=
```

**실데이터 수집 (처음 한 번)**
```bash
cd backend
python migrate_real_flights.py --apply              # flights 테이블 컬럼 추가 (기존 데이터 유지)
DATABASE_URL=sqlite:///./sync_test.db python sync_flights.py   # 운영 DB 대신 임시 DB로 먼저 확인
python sync_flights.py                               # 실제 DB 수집
```

> API 문서: 서버 실행 후 [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧯 트러블슈팅

<details>
<summary>📡 공공데이터 API가 공식 가이드와 다르게 동작</summary>

- **문제 1**: 가이드대로 `searchday`(조회일) 파라미터를 넣으면 결과가 **0건**
- **문제 2**: `numOfRows=500`으로 요청하면 정상 응답(JSON)이 오지 않음
- **확인 방법**: 가이드를 믿지 않고 실제 응답을 직접 찍어봄 → 날짜 필터 없이 부르면 D-3 ~ D+6 전체가 옴
- **해결**: 날짜 필터 없이 전체를 100건씩 받고 **코드에서 오늘 ~ 6일 후만 거름**
- **교훈**: 외부 API는 문서보다 실제 응답을 먼저 확인

</details>

<details>
<summary>🔁 코드쉐어 편명 중복 — 같은 비행기가 두 번 검색됨</summary>

- **문제**: 한 비행기를 여러 항공사가 판매하면 편명이 따로 내려와 검색 결과가 중복 (인천 데이터는 절반 이상이 판매용 편명)
- **함정**: 한국공항공사는 실제 운항편과 판매용 편명이 **둘 다** `codeshare=Y`로 옴 → Y를 전부 빼면 실제 운항편까지 사라짐
- **해결**: `마스터 편명이 있고 내 편명과 다르면 제외` (인천은 `Slave` 값으로 제외)

</details>

<details>
<summary>⏱️ 수집 470초 → 114초</summary>

- **문제**: 한국공항공사 데이터를 100건씩 160번 **순서대로** 불러 수집 1회에 약 8분
- **해결**: 첫 페이지로 전체 건수를 확인한 뒤 나머지 페이지를 **6개씩 동시 호출** (ThreadPoolExecutor)
- **결과**: 470초 → 114초 / GitHub Actions 대기 시간 안에 안정적으로 완료

</details>

<details>
<summary>🔑 서버 로그에 공공데이터 인증키 노출</summary>

- **문제**: httpx가 INFO 로그로 요청 URL 전체를 찍는데 URL에 `serviceKey`가 포함됨 → 배포 서버 로그에 키가 남음
- **해결**: httpx 요청 로그 레벨을 WARNING으로 올리고 에러 메시지 안의 키도 `***`로 치환

</details>

<details>
<summary>💸 무료 월 250회로 실시세 운영하기</summary>

- **문제**: 검색할 때마다 SerpApi를 부르면 무료 한도가 금방 소진
- **해결**
  - 노선·날짜별 조회 기록을 DB에 남겨 **12시간 캐싱**
  - 월 230회 **예산**에 닿으면 호출 중단
  - 판매할 편이 없는 노선은 호출하지 않음
  - 호출 실패 시 기존 가격 유지 후 1시간 뒤 재시도 (**산정가 폴백**)
- **실시세를 DB에 저장한 이유**: 화면에만 덮어쓰면 결제 시 다른 가격이 청구됨 → 검색 가격 = 결제 가격 보장

</details>

<details>
<summary>📉 산정가가 실제보다 싸서 가격순 정렬 맨 위로</summary>

- **문제**: 노선 기준표 산정가(김포→제주 5~8만 원)가 실시세(10~17만 원)보다 훨씬 낮아 실시세가 없는 편이 가장 싸게 보임
- **해결**: 실시세가 없는 편은 **같은 노선·같은 날 실시세 중앙값**으로 산정 + 국내선 기준표 범위 보정

</details>

<details>
<summary>📱 모바일 반응형 — 헤더·컴포넌트 겹침 현상</summary>

- **문제**: 모바일 환경에서 고정 헤더가 콘텐츠 영역과 겹쳐 버튼과 텍스트가 가려짐
- **원인**: `position: fixed` 헤더에 맞는 `padding-top` 보정값 미적용
- **해결**: 각 페이지의 최상위 컨테이너에 헤더 높이만큼 `padding-top` 추가, 가로 스크롤 유발 요소에 `overflow-x: hidden` 적용
- **개선 사항**: 헤더 높이를 CSS 변수로 관리해 일괄 적용

</details>

<details>
<summary>🧩 NEXTRIP 가격 배너 CSS Cascade 버그</summary>

- **문제**: NEXTRIP 가격 배너가 모바일에서 레이아웃이 깨지고 텍스트가 잘림
- **원인**: 미디어 쿼리 적용 순서 문제로 모바일 스타일이 데스크탑 스타일에 덮어씌워짐
- **해결**: CSS 파일 내 규칙 순서 재배치 (일반 → 모바일 미디어 쿼리 순), 가격 텍스트를 별도 줄로 분리해 우측 정렬 처리
- **교훈**: CSS cascade 순서는 명시도(specificity)만큼이나 선언 위치도 중요

</details>

<details>
<summary>📋 내 예약 탭 레이아웃 & 관리자 인기 노선 미로딩</summary>

- **문제 1**: 내 예약 탭이 전체 너비를 차지하지 않아 빈 공간 발생
- **문제 2**: 관리자 페이지에서 인기 노선 데이터가 첫 진입 시 자동으로 로드되지 않음
- **해결 1**: 탭 컨테이너에 `width: 100%` 명시 및 flex 레이아웃 보정
- **해결 2**: 컴포넌트 마운트 시 `useEffect`에서 인기 노선 API를 즉시 호출하도록 수정

</details>

<details>
<summary>✈️ 항공편 검색 상단 바 내용 잘림</summary>

- **문제**: 모바일에서 예약 상단 바의 가격이 잘려 보이지 않음
- **원인**: 상단 바에 고정 높이(`height: 60px`)가 지정되어 내용이 넘칠 때 clip 처리됨
- **해결**: 고정 높이 제거 후 `min-height`로 전환, 가격 정보를 아래 줄 우측 정렬로 분리

</details>

<details>
<summary>🗄️ Supabase → Neon 데이터베이스 마이그레이션</summary>

- **원인**: Supabase 무료 플랜 프로젝트 수 초과(3개 제한)로 기존 DB 접근 불가
- **해결**: Neon 서버리스 PostgreSQL로 전환 — SQLAlchemy `DATABASE_URL`만 교체하면 되는 구조 덕분에 코드 변경 최소화
- **적용 사항**: `database.py`에 Neon SSL 자동 감지 로직 추가 (`connect_args={"sslmode": "require"}`)
- **교훈**: 특정 DB 플랫폼 SDK에 의존하지 않고 표준 SQLAlchemy로 구현해 두면 DB 교체 비용이 거의 없음

</details>

---

## 🚀 프로젝트 결과

### 기대 효과

- **예약 편의성**: 검색·예약·체크인을 한 플랫폼에서 처리해 사용자 이탈 최소화
- **가격 최적화**: NEXTRIP 트렌드 분석으로 사용자가 최적 시점에 예약 가능
- **AI 활용**: 리뷰 요약과 챗봇 상담으로 의사결정 시간 단축
- **실데이터**: 목업 대신 실제 운항 스케줄과 구글 항공권 시세로 동작
- **확장성**: AI 제공자를 환경변수 하나로 교체 가능한 유연한 구조

### 개선 방향

- AI 리뷰 분석 정확도 고도화
- WebSocket 기반 실시간 채팅 확장
- 항공편 가격 알림 고도화 (목표가 달성 시 Push / 이메일 알림)
- 기준표에 없는 노선(상하이 훙차오·선전·치앙마이 등) 확대
- 실시세를 비즈니스석까지 확장 (현재는 일반석 × 노선 배수)

---

## 라이선스

MIT License
