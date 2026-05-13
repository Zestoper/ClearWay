import { useState, useEffect, useCallback } from 'react'
import './Nextrip.css'
import { api } from '../../services/api'
import type { User } from '../../services/auth'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props { user: User | null; onGoLogin: () => void }
type NextripView = 'home' | 'survey' | 'generating' | 'plan'

interface PlanSummary {
  id: number; title: string; destination: string; destination_en: string
  arrival_date: string; departure_date: string; status: string
  booking_ref: string | null; companion: string; travel_style: string; created_at: string
}

interface PlanItem {
  id: string; time: string; period: string; place_name: string; place_name_en: string
  category: string; rating: number | null; duration_min: number
  distance_from_prev: string; travel_time_min: number
  reason: string; tip?: string; lat: number; lng: number; maps_query: string
  notes?: string; estimated_cost?: number
}

interface PlanDay { day: number; date: string; title: string; items: PlanItem[]; daily_estimated_cost?: number }

interface PlanDetail {
  id: number; title: string; destination: string; destination_en: string
  arrival_date: string; arrival_time: string; departure_date: string; departure_time: string
  hotel_location: string; travel_style: string; travel_types: string[]
  food_restrictions: { cant_eat: string; allergy: string; prefer: string }
  transport: string; budget: string; companion: string; status: string
  error_msg: string | null
  plan_data: { summary: string; highlights: string[]; days: PlanDay[]; total_estimated_cost?: number } | null
}

interface BookingRecord {
  booking_ref: string; status: string; fare_class: string
  flight: {
    flight_no: string
    from_city: string; from_code: string
    to_city: string;   to_code: string; to_airport: string
    date: string; depart_time: string; arrival_time: string
  }
}

interface SurveyForm {
  destination: string; destination_en: string
  arrival_date: string; arrival_time: string
  departure_date: string; departure_time: string
  hotel_location: string
  travel_style: string
  travel_types: string[]
  food_cant_eat: string; food_allergy: string; food_prefer: string
  transport: string; budget: string; companion: string
  booking_ref: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DESTINATIONS = [
  { city: '도쿄', city_en: 'Tokyo', code: 'NRT', emoji: '🗼' },
  { city: '오사카', city_en: 'Osaka', code: 'KIX', emoji: '🏯' },
  { city: '후쿠오카', city_en: 'Fukuoka', code: 'FUK', emoji: '⛩️' },
  { city: '방콕', city_en: 'Bangkok', code: 'BKK', emoji: '🛕' },
  { city: '싱가포르', city_en: 'Singapore', code: 'SIN', emoji: '🌴' },
  { city: '파리', city_en: 'Paris', code: 'CDG', emoji: '🗼' },
  { city: '뉴욕', city_en: 'New York', code: 'JFK', emoji: '🗽' },
]

const CITY_EN: Record<string, string> = {
  '도쿄': 'Tokyo', '오사카': 'Osaka', '삿포로': 'Sapporo', '후쿠오카': 'Fukuoka',
  '나고야': 'Nagoya', '오키나와': 'Okinawa', '방콕': 'Bangkok', '싱가포르': 'Singapore',
  '파리': 'Paris', '뉴욕': 'New York', '로스앤젤레스': 'Los Angeles',
  '샌프란시스코': 'San Francisco', '밴쿠버': 'Vancouver', '두바이': 'Dubai',
  '홍콩': 'Hong Kong', '타이베이': 'Taipei', '베이징': 'Beijing', '상하이': 'Shanghai',
  '광저우': 'Guangzhou', '호치민': 'Ho Chi Minh City', '하노이': 'Hanoi',
  '마닐라': 'Manila', '쿠알라룸푸르': 'Kuala Lumpur', '발리': 'Bali',
  '자카르타': 'Jakarta', '런던': 'London', '프랑크푸르트': 'Frankfurt', '시드니': 'Sydney',
}

const TRAVEL_TYPES = [
  { id: 'food',     label: '🍜 맛집' },
  { id: 'activity', label: '🎯 액티비티' },
  { id: 'nature',   label: '🌿 자연/힐링' },
  { id: 'shopping', label: '🛍 쇼핑' },
  { id: 'history',  label: '🏛 역사/유적' },
  { id: 'night',    label: '🌃 야경' },
]

const CAT_META: Record<string, { color: string; bg: string; icon: string }> = {
  restaurant:    { color: '#ea580c', bg: '#fff7ed', icon: '🍽' },
  cafe:          { color: '#7c3aed', bg: '#f5f3ff', icon: '☕' },
  attraction:    { color: '#1d4ed8', bg: '#eff6ff', icon: '📍' },
  transport:     { color: '#4b5563', bg: '#f9fafb', icon: '🚇' },
  accommodation: { color: '#059669', bg: '#f0fdf4', icon: '🏨' },
  shopping:      { color: '#db2777', bg: '#fdf2f8', icon: '🛍' },
  activity:      { color: '#dc2626', bg: '#fef2f2', icon: '⚡' },
}

const STYLE_LABEL: Record<string, string> = { relaxed: '여유로운', normal: '일반', tight: '타이트한' }
const COMPANION_LABEL: Record<string, string> = { solo: '혼자', friends: '친구', couple: '연인', family: '가족' }

const BLANK_FORM: SurveyForm = {
  destination: '', destination_en: '',
  arrival_date: '', arrival_time: '14:00',
  departure_date: '', departure_time: '10:00',
  hotel_location: '',
  travel_style: '',
  travel_types: [],
  food_cant_eat: '', food_allergy: '', food_prefer: '',
  transport: '', budget: '', companion: '',
  booking_ref: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span className="nx-stars">
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
      <span className="nx-rating-num">{rating.toFixed(1)}</span>
    </span>
  )
}

function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Nextrip({ user, onGoLogin }: Props) {
  const [view, setView] = useState<NextripView>('home')
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [activePlanId, setActivePlanId] = useState<number | null>(null)
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null)
  const [surveyStep, setSurveyStep] = useState(1)
  const [form, setForm] = useState<SurveyForm>(BLANK_FORM)
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [genStatus, setGenStatus] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // 짐 리스트
  const [packingOpen, setPackingOpen] = useState(false)
  const [packingData, setPackingData] = useState<{ categories: { name: string; icon: string; items: string[] }[] } | null>(null)
  const [packingLoading, setPackingLoading] = useState(false)

  const loadPlans = useCallback(() => {
    if (user) api.get<PlanSummary[]>('/nextrip/plans').then(setPlans).catch(() => {})
  }, [user])

  useEffect(() => {
    loadPlans()
    if (user) api.get<BookingRecord[]>('/bookings/me').then(b => setBookings(b.filter(x => x.status !== 'cancelled'))).catch(() => {})
  }, [user, loadPlans])

  // Poll plan status while generating
  useEffect(() => {
    if (view !== 'generating' || !activePlanId) return
    const messages = [
      '여행지 정보를 수집하고 있습니다...',
      '최적의 동선을 계산하고 있습니다...',
      'AI가 맞춤 일정을 생성하고 있습니다...',
      '맛집과 관광지를 선별하고 있습니다...',
    ]
    let idx = 0
    setGenStatus([messages[0]])
    const msgTimer = setInterval(() => {
      idx = (idx + 1) % messages.length
      setGenStatus(prev => [...prev.slice(-2), messages[idx]])
    }, 3000)

    const pollTimer = setInterval(async () => {
      try {
        const detail = await api.get<PlanDetail>(`/nextrip/plans/${activePlanId}`)
        if (detail.status === 'done') {
          setPlanDetail(detail)
          loadPlans()
          setView('plan')
          clearInterval(pollTimer)
          clearInterval(msgTimer)
        } else if (detail.status === 'error') {
          alert(`일정 생성 실패: ${detail.error_msg}`)
          setView('home')
          clearInterval(pollTimer)
          clearInterval(msgTimer)
        }
      } catch {}
    }, 2500)

    return () => { clearInterval(pollTimer); clearInterval(msgTimer) }
  }, [view, activePlanId, loadPlans])

  function startSurvey(prefill?: Partial<SurveyForm>) {
    setForm({ ...BLANK_FORM, ...prefill })
    setSurveyStep(1)
    setView('survey')
  }

  async function openPlan(id: number) {
    setActivePlanId(id)
    try {
      const detail = await api.get<PlanDetail>(`/nextrip/plans/${id}`)
      setPlanDetail(detail)
      setView('plan')
    } catch { alert('계획을 불러오지 못했습니다.') }
  }

  async function loadPackingList(detail: PlanDetail) {
    if (packingLoading) return
    setPackingOpen(true)
    if (packingData) return
    setPackingLoading(true)
    try {
      const arrival = new Date(detail.arrival_date)
      const depart = new Date(detail.departure_date)
      const days = Math.max(1, Math.round((depart.getTime() - arrival.getTime()) / 86400000))
      const data = await api.post<{ categories: { name: string; icon: string; items: string[] }[] }>('/nextrip/packing-list', {
        destination: detail.destination,
        days,
        companion: detail.companion,
        travel_types: detail.travel_types,
        budget: detail.budget,
      })
      setPackingData(data)
    } catch {
      alert('짐 리스트 생성에 실패했습니다.')
      setPackingOpen(false)
    } finally {
      setPackingLoading(false)
    }
  }

  async function deletePlan(id: number) {
    if (!confirm('이 여행 계획을 삭제하시겠습니까?')) return
    try {
      await api.delete(`/nextrip/plans/${id}`)
      setPlans(p => p.filter(x => x.id !== id))
    } catch {}
  }

  async function submitSurvey() {
    setSubmitting(true)
    try {
      const body = {
        destination: form.destination,
        destination_en: form.destination_en,
        arrival_date: form.arrival_date,
        arrival_time: form.arrival_time,
        departure_date: form.departure_date,
        departure_time: form.departure_time,
        hotel_location: form.hotel_location,
        travel_style: form.travel_style,
        travel_types: form.travel_types,
        food_restrictions: { cant_eat: form.food_cant_eat, allergy: form.food_allergy, prefer: form.food_prefer },
        transport: form.transport,
        budget: form.budget,
        companion: form.companion,
        booking_ref: form.booking_ref || null,
      }
      const res = await api.post<{ id: number }>('/nextrip/plans', body)
      setActivePlanId(res.id)
      setView('generating')
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function saveItemEdit(planId: number, itemId: string) {
    try {
      await api.patch(`/nextrip/plans/${planId}/items/${itemId}`, { time: editTime, notes: editNotes || undefined })
      setPlanDetail(prev => {
        if (!prev?.plan_data) return prev
        const days = prev.plan_data.days.map(d => ({
          ...d,
          items: d.items.map(it => it.id === itemId ? { ...it, time: editTime, notes: editNotes } : it),
        }))
        return { ...prev, plan_data: { ...prev.plan_data, days } }
      })
      setEditItemId(null)
    } catch { alert('저장에 실패했습니다.') }
  }

  // 선택한 여행지에 해당하는 예약만 필터링 (도시명 기준, 복수 공항 포함)
  const matchedBookings = bookings.filter(b => b.flight.to_city === form.destination)

  // ── View: HOME ──────────────────────────────────────────────────────────────
  if (view === 'home') return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-hero-inner">
          <span className="nx-hero-badge">✦ NEXTRIP AI</span>
          <h1>AI가 설계하는<br />나만의 완벽한 여행</h1>
          <p>목적지·기간·취향만 알려주세요.<br />AI가 동선 최적화된 세세한 일정을 완성해 드립니다.</p>
          <div className="nx-price-callout">
            <div className="nx-price-main">
              <span className="nx-price-label">AI 여행 계획 1회</span>
              <span className="nx-price-amount">₩3,900</span>
            </div>
            <ul className="nx-price-perks">
              <li>⏱ 직접 짜면 3~5시간 → AI는 <strong>30초</strong></li>
              <li>✓ 커피 한 잔 값으로 완성하는 완벽한 여행</li>
              <li>✓ 맛집·관광지·동선 모두 AI가 최적화</li>
            </ul>
          </div>
          <div className="nx-hero-actions">
            <button className="nx-btn-primary" onClick={() => user ? startSurvey() : onGoLogin()}>
              ✦ 여행 계획 시작하기 — ₩3,900
            </button>
          </div>
        </div>
        <div className="nx-hero-cards-demo">
          <div className="nx-demo-card">
            <span className="nx-demo-day">DAY 1</span>
            <div className="nx-demo-item">🗼 <span>아사쿠사 센소지</span><small>4.7★</small></div>
            <div className="nx-demo-item">🍜 <span>이치란 라멘</span><small>4.3★</small></div>
            <div className="nx-demo-item">🌃 <span>시부야 스크램블</span><small>4.8★</small></div>
          </div>
          <div className="nx-demo-card nx-demo-card-2">
            <span className="nx-demo-day">DAY 2</span>
            <div className="nx-demo-item">🏯 <span>메이지 신궁</span><small>4.5★</small></div>
            <div className="nx-demo-item">🛍 <span>하라주쿠 타케시타</span><small>4.2★</small></div>
            <div className="nx-demo-item">🍣 <span>츠키지 수산시장</span><small>4.6★</small></div>
          </div>
        </div>
      </section>

      <div className="nx-body">
        {/* 내 여행 계획 */}
        {user ? (
          <section className="nx-section">
            <div className="nx-section-head">
              <div>
                <h2>내 여행 계획</h2>
                <p>{plans.length}개의 여행 계획</p>
              </div>
              <button className="nx-btn-outline" onClick={() => startSurvey()}>+ 새 여행 추가</button>
            </div>
            {plans.length === 0 ? (
              <div className="nx-empty">
                <div className="nx-empty-icon">✈</div>
                <p>아직 여행 계획이 없습니다.</p>
                <button className="nx-btn-primary sm" onClick={() => startSurvey()}>첫 번째 여행 계획 만들기</button>
              </div>
            ) : (
              <div className="nx-plan-grid">
                {plans.map(p => (
                  <div key={p.id} className={`nx-plan-card ${p.status}`}>
                    <div className="nx-plan-card-top">
                      <span className={`nx-plan-status ${p.status}`}>
                        {p.status === 'done' ? '완료' : p.status === 'generating' ? '생성 중' : p.status === 'error' ? '오류' : '대기'}
                      </span>
                      <button className="nx-plan-del" onClick={() => deletePlan(p.id)}>×</button>
                    </div>
                    <h3 className="nx-plan-title">{p.title}</h3>
                    <p className="nx-plan-dates">{p.arrival_date} ~ {p.departure_date}</p>
                    <p className="nx-plan-meta">{COMPANION_LABEL[p.companion]} · {STYLE_LABEL[p.travel_style]} 여행</p>
                    {p.status === 'done' && (
                      <button className="nx-plan-view-btn" onClick={() => openPlan(p.id)}>일정 보기 →</button>
                    )}
                    {p.status === 'generating' && (
                      <p className="nx-plan-wait">AI가 일정을 생성하고 있습니다...</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="nx-section">
            <div className="nx-login-prompt">
              <div className="nx-login-icon">✦</div>
              <h3>로그인하고 나만의 AI 여행 계획을 시작하세요</h3>
              <p>예약된 항공권과 연동하여 맞춤 여행 일정을 생성합니다.</p>
              <button className="nx-btn-primary" onClick={onGoLogin}>로그인하기</button>
            </div>
          </section>
        )}

        {/* 예약된 항공권 */}
        {user && bookings.length > 0 && (
          <section className="nx-section">
            <div className="nx-section-head">
              <div>
                <h2>예약된 항공권</h2>
                <p>여행 계획과 연동할 수 있습니다</p>
              </div>
            </div>
            <div className="nx-booking-grid">
              {bookings.slice(0, 4).map(b => (
                <div key={b.booking_ref} className="nx-booking-card">
                  <div className="nx-booking-header">
                    <span className="nx-booking-code">{b.flight.to_code}</span>
                    <span className="nx-booking-ref">{b.booking_ref}</span>
                  </div>
                  <h3 className="nx-booking-dest">{b.flight.to_city}</h3>
                  <p className="nx-booking-info">{b.flight.flight_no} · {b.flight.date}</p>
                  <p className="nx-booking-info">{b.flight.depart_time} 출발 · {b.fare_class === 'economy' ? '이코노미' : '비즈니스'}</p>
                  <button
                    className="nx-booking-plan-btn"
                    onClick={() => startSurvey({
                      destination: b.flight.to_city,
                      destination_en: CITY_EN[b.flight.to_city] ?? b.flight.to_city,
                      arrival_date: b.flight.date,
                      arrival_time: b.flight.arrival_time,
                      booking_ref: b.booking_ref,
                    })}
                  >✦ AI 여행 계획 만들기</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 기능 소개 */}
        <section className="nx-features">
          {[
            { icon: '🤖', title: 'AI 맞춤 일정', desc: '여행 스타일과 취향을 분석해 최적의 일정을 생성합니다' },
            { icon: '🗺', title: '동선 최적화', desc: '이동 시간을 최소화하고 근처 명소를 묶어 효율적으로 짜드립니다' },
            { icon: '⭐', title: '검증된 장소', desc: '평점 4.0+ 이상의 신뢰할 수 있는 맛집과 관광지만 추천합니다' },
            { icon: '✏️', title: '자유로운 수정', desc: '생성된 일정을 언제든 직접 수정하고 저장할 수 있습니다' },
          ].map((f, i) => (
            <div key={i} className="nx-feature-card">
              <span className="nx-feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </section>

        {/* 가격 강조 배너 */}
        <section className="nx-pricing-banner">
          <div className="nx-pricing-banner-inner">
            <div className="nx-pricing-left">
              <p className="nx-pricing-eyebrow">딱 한 가지 요금제</p>
              <p className="nx-pricing-big">단 <strong>₩3,900</strong>으로</p>
              <p className="nx-pricing-sub">여행 일정 짜는 수고를 AI에게 맡기세요</p>
            </div>
            <div className="nx-pricing-compare">
              <div className="nx-compare-item cross">
                <span>혼자 일정 짜기</span>
                <span className="nx-compare-val">3~5시간 소요</span>
              </div>
              <div className="nx-compare-item cross">
                <span>여행사 플래닝</span>
                <span className="nx-compare-val">수십만 원 + 며칠</span>
              </div>
              <div className="nx-compare-item check">
                <span>NEXTRIP AI</span>
                <span className="nx-compare-val highlight">30초 · ₩3,900</span>
              </div>
            </div>
            <div className="nx-time-savings">
              <span className="nx-time-savings-label">절약 시간</span>
              <span className="nx-time-savings-num">최대 5시간</span>
            </div>
            <button className="nx-pricing-cta" onClick={() => user ? startSurvey() : onGoLogin()}>
              지금 바로 시작하기 →
            </button>
          </div>
        </section>
      </div>
    </main>
  )

  // ── View: SURVEY ────────────────────────────────────────────────────────────
  if (view === 'survey') {
    const totalSteps = 8
    const set = (k: keyof SurveyForm, v: string | string[]) => setForm(f => ({ ...f, [k]: v }))
    const toggleType = (id: string) => set('travel_types',
      form.travel_types.includes(id) ? form.travel_types.filter(t => t !== id) : [...form.travel_types, id])

    const canNext = () => {
      if (surveyStep === 1) return !!(form.destination && form.destination_en)
      if (surveyStep === 2) return !!(form.arrival_date && form.departure_date && form.arrival_time && form.departure_time)
      if (surveyStep === 3) return !!form.hotel_location
      if (surveyStep === 4) return !!form.travel_style
      if (surveyStep === 5) return form.travel_types.length > 0
      if (surveyStep === 6) return true
      if (surveyStep === 7) return !!(form.transport && form.budget)
      if (surveyStep === 8) return !!form.companion
      return true
    }

    return (
      <main className="nx-page">
        <div className="nx-survey-wrap">
          {/* Header */}
          <div className="nx-survey-header">
            <button className="nx-survey-back" onClick={() => surveyStep === 1 ? setView('home') : setSurveyStep(s => s - 1)}>
              ← {surveyStep === 1 ? '홈으로' : '이전'}
            </button>
            <div className="nx-survey-progress-wrap">
              <div className="nx-survey-progress" style={{ width: `${(surveyStep / totalSteps) * 100}%` }} />
            </div>
            <span className="nx-survey-step-count">{surveyStep} / {totalSteps}</span>
          </div>

          <div className="nx-survey-body">
            {/* STEP 1: 여행지 */}
            {surveyStep === 1 && (
              <div className="nx-survey-step">
                <span className="nx-step-label">STEP 1</span>
                <h2>어디로 떠나실 건가요?</h2>
                <div className="nx-dest-grid">
                  {DESTINATIONS.map(d => (
                    <button
                      key={d.code}
                      className={`nx-dest-btn ${form.destination === d.city ? 'selected' : ''}`}
                      onClick={() => { set('destination', d.city); set('destination_en', d.city_en) }}
                    >
                      <span className="nx-dest-emoji">{d.emoji}</span>
                      <span className="nx-dest-city">{d.city}</span>
                      <span className="nx-dest-en">{d.city_en}</span>
                    </button>
                  ))}
                </div>
                <div className="nx-custom-dest">
                  <p>목록에 없다면 직접 입력해 주세요</p>
                  <div className="nx-custom-inputs">
                    <input
                      className="nx-input" placeholder="한국어 (예: 발리)"
                      value={!DESTINATIONS.find(d => d.city === form.destination) ? form.destination : ''}
                      onChange={e => { set('destination', e.target.value); set('destination_en', '') }}
                    />
                    <input
                      className="nx-input" placeholder="English (e.g. Bali)"
                      value={!DESTINATIONS.find(d => d.city_en === form.destination_en) ? form.destination_en : ''}
                      onChange={e => set('destination_en', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: 기간 */}
            {surveyStep === 2 && (
              <div className="nx-survey-step">
                <span className="nx-step-label">STEP 2</span>
                <h2>여행 기간을 알려주세요</h2>

                {/* 예약에서 가져오기 */}
                {matchedBookings.length > 0 && (
                  <div className="nx-booking-pick">
                    <p className="nx-booking-pick-label">✈ {form.destination} 예약 항공편에서 가져오기</p>
                    <div className="nx-booking-pick-list">
                      {matchedBookings.map(b => {
                        const returnFlight = bookings.find(rb =>
                          rb.flight.from_code === b.flight.to_code &&
                          rb.flight.to_code === b.flight.from_code &&
                          rb.flight.date >= b.flight.date
                        )
                        const isSelected = form.booking_ref === b.booking_ref
                        return (
                          <button
                            key={b.booking_ref}
                            className={`nx-booking-pick-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => setForm(f => ({
                              ...f,
                              booking_ref: b.booking_ref,
                              destination: f.destination || b.flight.to_city,
                              destination_en: f.destination_en || (CITY_EN[b.flight.to_city] ?? b.flight.to_city),
                              arrival_date: b.flight.date,
                              arrival_time: b.flight.arrival_time,
                              departure_date: returnFlight?.flight.date ?? f.departure_date,
                              departure_time: returnFlight?.flight.depart_time ?? f.departure_time,
                            }))}
                          >
                            <div className="nx-bpc-route">
                              <span className="nx-bpc-code">{b.flight.from_code}</span>
                              <span className="nx-bpc-arrow">→</span>
                              <span className="nx-bpc-code">{b.flight.to_code}</span>
                            </div>
                            <div className="nx-bpc-info">
                              <span>{b.flight.date}</span>
                              <span>도착 {b.flight.arrival_time}</span>
                            </div>
                            {returnFlight && (
                              <div className="nx-bpc-return">
                                <span>↩ 귀국 {returnFlight.flight.date} {returnFlight.flight.depart_time}</span>
                              </div>
                            )}
                            <span className="nx-bpc-ref">{b.booking_ref}</span>
                            {isSelected && <span className="nx-bpc-check">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="nx-date-grid">
                  <div className="nx-form-group">
                    <label>도착 날짜</label>
                    <input type="date" className="nx-input" value={form.arrival_date} onChange={e => set('arrival_date', e.target.value)} />
                  </div>
                  <div className="nx-form-group">
                    <label>도착 시간</label>
                    <input type="time" className="nx-input" value={form.arrival_time} onChange={e => set('arrival_time', e.target.value)} />
                  </div>
                  <div className="nx-form-group">
                    <label>귀국 날짜</label>
                    <input type="date" className="nx-input" value={form.departure_date} onChange={e => set('departure_date', e.target.value)} min={form.arrival_date} />
                    {form.arrival_date && !form.departure_date && (
                      <p className="nx-date-hint">편도 예약이라면 귀국 날짜를 직접 입력해 주세요</p>
                    )}
                  </div>
                  <div className="nx-form-group">
                    <label>귀국 시간</label>
                    <input type="time" className="nx-input" value={form.departure_time} onChange={e => set('departure_time', e.target.value)} />
                  </div>
                </div>
                {form.arrival_date && form.departure_date && (
                  <div className="nx-duration-badge">
                    총 {Math.max(1, Math.ceil((new Date(form.departure_date).getTime() - new Date(form.arrival_date).getTime()) / 86400000) + 1)}일 여행
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: 숙소 위치 */}
            {surveyStep === 3 && (
              <div className="nx-survey-step">
                <span className="nx-step-label">STEP 3</span>
                <h2>숙소는 어디에 있나요?</h2>
                <p className="nx-step-desc">숙소 위치를 기반으로 동선을 최적화합니다.</p>
                <input
                  className="nx-input lg"
                  placeholder={`예: ${form.destination || '도쿄'} 신주쿠 근처`}
                  value={form.hotel_location}
                  onChange={e => set('hotel_location', e.target.value)}
                />
                <div className="nx-hotel-examples">
                  {[`${form.destination || '도쿄'} 시내 중심`, `${form.destination || '도쿄'} 공항 근처`, `${form.destination || '도쿄'} 관광지 인근`].map(ex => (
                    <button key={ex} className="nx-example-chip" onClick={() => set('hotel_location', ex)}>{ex}</button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: 여행 스타일 */}
            {surveyStep === 4 && (
              <div className="nx-survey-step">
                <span className="nx-step-label">STEP 4</span>
                <h2>어떤 스타일로 여행하고 싶으세요?</h2>
                <div className="nx-style-cards">
                  {[
                    { id: 'relaxed', label: '여유로운 여행', icon: '🌿', desc: '하루 3~4개 일정, 충분한 휴식과 자유 시간' },
                    { id: 'normal',  label: '일반 여행',     icon: '⚖️', desc: '하루 5~6개 일정, 균형 잡힌 관광과 여유' },
                    { id: 'tight',   label: '타이트한 여행', icon: '⚡', desc: '하루 7~9개 일정, 최대한 많은 곳 방문' },
                  ].map(s => (
                    <button key={s.id} className={`nx-style-card ${form.travel_style === s.id ? 'selected' : ''}`} onClick={() => set('travel_style', s.id)}>
                      <span className="nx-style-icon">{s.icon}</span>
                      <strong>{s.label}</strong>
                      <p>{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: 선호 유형 */}
            {surveyStep === 5 && (
              <div className="nx-survey-step">
                <span className="nx-step-label">STEP 5</span>
                <h2>어떤 여행을 원하세요?</h2>
                <p className="nx-step-desc">복수 선택 가능합니다</p>
                <div className="nx-type-grid">
                  {TRAVEL_TYPES.map(t => (
                    <button
                      key={t.id}
                      className={`nx-type-btn ${form.travel_types.includes(t.id) ? 'selected' : ''}`}
                      onClick={() => toggleType(t.id)}
                    >{t.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 6: 음식 */}
            {surveyStep === 6 && (
              <div className="nx-survey-step">
                <span className="nx-step-label">STEP 6</span>
                <h2>음식 선호를 알려주세요</h2>
                <p className="nx-step-desc">없으면 건너뛰셔도 됩니다</p>
                <div className="nx-food-groups">
                  <div className="nx-form-group">
                    <label>못 먹는 음식</label>
                    <input className="nx-input" placeholder="예: 고수, 새우" value={form.food_cant_eat} onChange={e => set('food_cant_eat', e.target.value)} />
                  </div>
                  <div className="nx-form-group">
                    <label>알레르기</label>
                    <input className="nx-input" placeholder="예: 견과류, 조개류" value={form.food_allergy} onChange={e => set('food_allergy', e.target.value)} />
                  </div>
                  <div className="nx-form-group">
                    <label>선호 음식</label>
                    <input className="nx-input" placeholder="예: 라멘, 스시, 길거리음식" value={form.food_prefer} onChange={e => set('food_prefer', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: 이동수단 + 예산 */}
            {surveyStep === 7 && (
              <div className="nx-survey-step">
                <span className="nx-step-label">STEP 7</span>
                <h2>이동수단과 예산을 선택해 주세요</h2>
                <div className="nx-choice-section">
                  <h3>이동 수단</h3>
                  <div className="nx-choice-row">
                    {[{ id: 'walk', label: '🚶 도보' }, { id: 'transit', label: '🚇 대중교통' }, { id: 'rental', label: '🚗 렌트카' }].map(t => (
                      <button key={t.id} className={`nx-choice-btn ${form.transport === t.id ? 'selected' : ''}`} onClick={() => set('transport', t.id)}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <div className="nx-choice-section">
                  <h3>예산 수준</h3>
                  <div className="nx-choice-row">
                    {[{ id: 'budget', label: '💰 저예산', sub: '로컬 맛집·무료 명소 위주' }, { id: 'normal', label: '💳 일반', sub: '적당한 가격대 균형' }, { id: 'premium', label: '💎 프리미엄', sub: '미슐랭·고급 체험 우선' }].map(b => (
                      <button key={b.id} className={`nx-choice-btn wide ${form.budget === b.id ? 'selected' : ''}`} onClick={() => set('budget', b.id)}>
                        <strong>{b.label}</strong><small>{b.sub}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 8: 동반 유형 */}
            {surveyStep === 8 && (
              <div className="nx-survey-step">
                <span className="nx-step-label">STEP 8</span>
                <h2>누구와 함께 가시나요?</h2>
                <div className="nx-companion-grid">
                  {[
                    { id: 'solo',    label: '혼자', icon: '🧳' },
                    { id: 'friends', label: '친구와',  icon: '👫' },
                    { id: 'couple',  label: '연인과', icon: '💑' },
                    { id: 'family',  label: '가족과', icon: '👨‍👩‍👧' },
                  ].map(c => (
                    <button key={c.id} className={`nx-companion-btn ${form.companion === c.id ? 'selected' : ''}`} onClick={() => set('companion', c.id)}>
                      <span className="nx-companion-icon">{c.icon}</span>
                      <strong>{c.label}</strong>
                    </button>
                  ))}
                </div>

                {/* Summary */}
                {form.destination && (
                  <div className="nx-survey-summary">
                    <h4>선택 요약</h4>
                    <div className="nx-summary-grid">
                      <span>📍 {form.destination}</span>
                      <span>📅 {form.arrival_date} ~ {form.departure_date}</span>
                      <span>🏨 {form.hotel_location}</span>
                      <span>🎯 {form.travel_types.map(t => TRAVEL_TYPES.find(x => x.id === t)?.label).join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="nx-survey-nav">
            {surveyStep < totalSteps ? (
              <button className="nx-btn-primary full" disabled={!canNext()} onClick={() => setSurveyStep(s => s + 1)}>
                다음 →
              </button>
            ) : (
              <button className="nx-btn-primary full" disabled={!canNext() || submitting} onClick={submitSurvey}>
                {submitting ? 'AI 일정 생성 중...' : '✦ AI 여행 계획 생성하기'}
              </button>
            )}
          </div>
        </div>
      </main>
    )
  }

  // ── View: GENERATING ────────────────────────────────────────────────────────
  if (view === 'generating') return (
    <main className="nx-page nx-generating">
      <div className="nx-gen-inner">
        <div className="nx-gen-orb" />
        <div className="nx-gen-icon">✦</div>
        <h2>AI가 여행 일정을 만들고 있습니다</h2>
        <p>{form.destination}의 최고 장소들을 엄선하고<br />최적의 동선으로 일정을 설계하는 중입니다.</p>
        <div className="nx-gen-log">
          {genStatus.map((msg, i) => (
            <div key={i} className="nx-gen-log-item">
              <span className="nx-gen-dot" />
              {msg}
            </div>
          ))}
        </div>
        <div className="nx-gen-bar-wrap">
          <div className="nx-gen-bar" />
        </div>
        <p className="nx-gen-note">보통 30초~1분 정도 소요됩니다</p>
      </div>
    </main>
  )

  // ── View: PLAN ──────────────────────────────────────────────────────────────
  if (view === 'plan' && planDetail) {
    const days = planDetail.plan_data?.days ?? []
    const highlights = planDetail.plan_data?.highlights ?? []
    const summary = planDetail.plan_data?.summary ?? ''

    function handleShare() {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
      alert('링크가 복사되었습니다!')
    }

    return (
      <main className="nx-page">
        {/* Sticky plan header */}
        <div className="nx-plan-topbar" id="no-print">
          <button className="nx-plan-back" onClick={() => { setView('home'); loadPlans() }}>← 내 여행</button>
          <div className="nx-plan-topbar-center">
            <span className="nx-plan-topbar-dest">{planDetail.destination}</span>
            <span className="nx-plan-topbar-dates">{planDetail.arrival_date} ~ {planDetail.departure_date}</span>
          </div>
          <div className="nx-plan-topbar-actions">
            <button className="nx-plan-action-btn packing" onClick={() => { setPackingData(null); loadPackingList(planDetail) }}>🎒 짐 리스트</button>
            <button className="nx-plan-action-btn" onClick={handleShare}>🔗 공유</button>
            <button className="nx-plan-action-btn" onClick={() => window.print()}>🖨 인쇄</button>
          </div>
        </div>

        {/* Print header */}
        <div className="nx-print-header">
          <h1>{planDetail.title}</h1>
          <p>{planDetail.arrival_date} ~ {planDetail.departure_date} · {COMPANION_LABEL[planDetail.companion]} · {STYLE_LABEL[planDetail.travel_style]} 여행</p>
        </div>

        <div className="nx-plan-body">
          {/* Summary card */}
          <div className="nx-summary-card">
            <div className="nx-summary-left">
              <h1 className="nx-plan-heading">{planDetail.title}</h1>
              <p className="nx-plan-summary-text">{summary}</p>
              <div className="nx-plan-badges">
                <span className="nx-badge">{planDetail.arrival_date} ~ {planDetail.departure_date}</span>
                <span className="nx-badge">{COMPANION_LABEL[planDetail.companion]}</span>
                <span className="nx-badge">{STYLE_LABEL[planDetail.travel_style]} 여행</span>
                <span className="nx-badge">{planDetail.budget === 'budget' ? '저예산' : planDetail.budget === 'premium' ? '프리미엄' : '일반 예산'}</span>
              </div>
            </div>
            {highlights.length > 0 && (
              <div className="nx-summary-highlights">
                <h4>✦ 핵심 포인트</h4>
                {highlights.map((h, i) => <p key={i}>• {h}</p>)}
                {planDetail.plan_data?.total_estimated_cost != null && (
                  <div className="nx-total-cost">
                    <span>💰 예상 총 경비</span>
                    <strong>₩{planDetail.plan_data.total_estimated_cost.toLocaleString()}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Day-by-day plan */}
          {days.map(day => (
            <div key={day.day} className="nx-day-section">
              <div className="nx-day-header">
                <div className="nx-day-badge">DAY {day.day}</div>
                <div>
                  <h2 className="nx-day-title">{day.title}</h2>
                  <span className="nx-day-date">{day.date}</span>
                </div>
                {day.daily_estimated_cost != null && (
                  <div className="nx-day-cost">💰 일 예산 ₩{day.daily_estimated_cost.toLocaleString()}</div>
                )}
              </div>

              <div className="nx-timeline">
                {day.items.map((item, idx) => {
                  const meta = CAT_META[item.category] ?? CAT_META['attraction']
                  const isEditing = editItemId === item.id

                  return (
                    <div key={item.id} className="nx-tl-row">
                      {/* Time column */}
                      <div className="nx-tl-time">
                        <span className="nx-tl-time-badge">{item.time}</span>
                        {idx < day.items.length - 1 && (
                          <div className="nx-tl-connector">
                            {item.travel_time_min > 0 && (
                              <span className="nx-tl-travel">{item.travel_time_min}분</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Item card */}
                      <div className="nx-tl-card" style={{ borderLeftColor: meta.color }}>
                        <div className="nx-tl-card-top">
                          <span className="nx-tl-cat-badge" style={{ background: meta.bg, color: meta.color }}>
                            {meta.icon} {item.category === 'restaurant' ? '식당' : item.category === 'cafe' ? '카페' : item.category === 'attraction' ? '관광지' : item.category === 'transport' ? '이동' : item.category === 'accommodation' ? '숙소' : item.category === 'shopping' ? '쇼핑' : '액티비티'}
                          </span>
                          <Stars rating={item.rating} />
                          <button
                            className="nx-edit-btn no-print"
                            onClick={() => { setEditItemId(item.id); setEditTime(item.time); setEditNotes(item.notes ?? '') }}
                          >✏</button>
                        </div>

                        {isEditing ? (
                          <div className="nx-edit-form">
                            <div className="nx-edit-row">
                              <label>시간</label>
                              <input type="time" className="nx-input sm" value={editTime} onChange={e => setEditTime(e.target.value)} />
                            </div>
                            <div className="nx-edit-row">
                              <label>메모</label>
                              <input className="nx-input" placeholder="메모 추가..." value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                            </div>
                            <div className="nx-edit-actions">
                              <button className="nx-btn-primary sm" onClick={() => saveItemEdit(planDetail.id, item.id)}>저장</button>
                              <button className="nx-btn-ghost sm" onClick={() => setEditItemId(null)}>취소</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="nx-tl-place">{item.place_name}</h3>
                            {item.place_name_en && <p className="nx-tl-place-en">{item.place_name_en}</p>}
                            <p className="nx-tl-reason">{item.reason}</p>
                            {item.tip && <p className="nx-tl-tip">💡 {item.tip}</p>}
                            {item.notes && <p className="nx-tl-notes">📝 {item.notes}</p>}
                            <div className="nx-tl-meta">
                              <span>⏱ {item.duration_min}분</span>
                              {item.distance_from_prev && item.distance_from_prev !== '0km' && (
                                <span>📏 {item.distance_from_prev}</span>
                              )}
                              {item.estimated_cost != null && (
                                <span className="nx-cost-badge">
                                  {item.estimated_cost === 0 ? '🆓 무료' : `💰 ₩${item.estimated_cost.toLocaleString()}`}
                                </span>
                              )}
                              <a
                                href={mapsUrl(item.maps_query)}
                                target="_blank"
                                rel="noreferrer"
                                className="nx-maps-btn no-print"
                              >🗺 지도 보기</a>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 짐 리스트 모달 */}
        {packingOpen && (
          <div className="packing-overlay" onClick={() => setPackingOpen(false)}>
            <div className="packing-modal" onClick={e => e.stopPropagation()}>
              <div className="packing-modal-head">
                <h2>🎒 AI 짐 리스트</h2>
                <p>{planDetail.destination} · {planDetail.companion === 'solo' ? '혼자' : planDetail.companion === 'couple' ? '연인과' : planDetail.companion === 'family' ? '가족과' : '친구와'}</p>
                <button className="packing-close" onClick={() => setPackingOpen(false)}>✕</button>
              </div>
              {packingLoading ? (
                <div className="packing-loading">
                  <div className="packing-spinner" />
                  <p>AI가 짐 리스트를 생성하고 있습니다...</p>
                </div>
              ) : packingData ? (
                <div className="packing-categories">
                  {packingData.categories.map((cat, i) => (
                    <div key={i} className="packing-cat">
                      <h4>{cat.icon} {cat.name}</h4>
                      <ul>
                        {cat.items.map((item, j) => (
                          <li key={j}><span className="packing-check">☐</span> {item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    )
  }

  return null
}
