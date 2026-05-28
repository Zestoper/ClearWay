# ✈️ CLEARWAY — 항공권 예약 플랫폼

> AI 리뷰 분석과 실시간 채팅 상담을 갖춘 풀스택 항공권 예약 서비스

---

## 목차

- [프로젝트 한눈에 보기](#-프로젝트-한눈에-보기)
- [CLEARWAY 소개](#-clearway-소개)
- [핵심 기능](#-핵심-기능)
- [기술 스펙](#-기술-스펙)
- [개발 구조](#-개발-구조)
- [트러블슈팅](#-트러블슈팅)
- [프로젝트 결과](#-프로젝트-결과)

---

## 📌 프로젝트 한눈에 보기

| 항목 | 내용 |
|------|------|
| 서비스명 | CLEARWAY · 클리어웨이 |
| 한 줄 소개 | AI 기반 리뷰 분석과 실시간 상담을 제공하는 항공권 예약 플랫폼 |
| 핵심 스택 | Python · FastAPI · PostgreSQL · React 19 · TypeScript · Vite |
| 배포 | Render (Backend + Frontend Static) · Docker · Nginx |

### 서비스 키워드

- ✈️ **항공권 검색 & 예약**
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
| 1 | **항공권 검색 & 예약** | 출발지·도착지·날짜 기반 항공편 검색 및 좌석 예약 |
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

## 🧩 기술 스펙

### 기술 스택

| 영역 | 사용 기술 | 역할 |
|------|----------|------|
| Frontend | React 19 · TypeScript · Vite | SPA UI, 예약 흐름, 반응형 레이아웃 |
| Backend | FastAPI · SQLAlchemy · Uvicorn | REST API, 비즈니스 로직, JWT 인증 |
| Database | PostgreSQL | 사용자·항공편·예약·채팅 데이터 저장 |
| AI | Groq (기본) / Gemini / Anthropic | 리뷰 요약·분석, 챗봇 응답 생성 |
| Infra | Docker Compose · Nginx | 컨테이너 오케스트레이션, 리버스 프록시 |
| Deploy | Render | 백엔드(Web Service) + 프론트엔드(Static Site) |

### 시스템 아키텍처

```
Client (Browser)
      │
      ▼
  Nginx (Port 80)
  ├── /api/*  →  FastAPI Backend (Port 8000)
  │               ├── Auth (JWT / OAuth)
  │               ├── Flights & Bookings
  │               ├── Reviews (AI 연동)
  │               ├── Chat (고객센터)
  │               ├── Nextrip (가격 분석)
  │               └── Admin
  └── /*      →  React Frontend (Port 3000)

                       │
                  PostgreSQL DB
```

---

## 👨‍💻 개발 구조

<details>
<summary>📁 파일 구조 펼치기</summary>

```
CLEARWAY/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
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
| GET | `/api/v1/flights` | 항공편 목록 조회 |
| POST | `/api/v1/bookings` | 예약 생성 |
| GET | `/api/v1/bookings/me` | 내 예약 목록 |
| POST | `/api/v1/chat` | 채팅 메시지 전송 |
| GET | `/api/v1/reviews` | 리뷰 목록 조회 |
| GET | `/api/v1/nextrip` | NEXTRIP 가격 정보 |
| GET | `/api/v1/admin/popular-routes` | 인기 노선 조회 (관리자) |

---

## 🚀 시작하기

### 사전 요구 사항

- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### Docker로 실행 (권장)

```bash
git clone https://github.com/Zestoper/CLEARWAY.git
cd CLEARWAY

# 환경변수 설정
cp backend/.env.example backend/.env
# backend/.env 파일 열어 값 입력

docker-compose up --build
```

브라우저에서 [http://localhost](http://localhost) 접속

### 로컬 개발 환경

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
DATABASE_URL=postgresql://user:password@localhost:5432/clearway
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# AI 제공자 선택 (groq | gemini | anthropic)
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
ALLOW_ALL_ORIGINS=false
```

> API 문서: 서버 실행 후 [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧯 트러블슈팅

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

---

## 🚀 프로젝트 결과

### 기대 효과

- **예약 편의성**: 검색·예약·체크인을 한 플랫폼에서 처리해 사용자 이탈 최소화
- **가격 최적화**: NEXTRIP 트렌드 분석으로 사용자가 최적 시점에 예약 가능
- **AI 활용**: 리뷰 요약과 챗봇 상담으로 의사결정 시간 단축
- **확장성**: AI 제공자를 환경변수 하나로 교체 가능한 유연한 구조

### 개선 방향

- AI 리뷰 분석 정확도 고도화
- WebSocket 기반 실시간 채팅 확장
- Render 배포 → 안정적인 클라우드 인프라로 이전

---

## 라이선스

MIT License
