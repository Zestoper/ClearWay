import { useState, useEffect } from 'react'
import './FlightBooking.css'
import { FlightSkeleton } from '../common/Skeleton'
import type { BookingFlight, SearchParams } from '../../types'
import { fetchFlights } from '../../services/flights'
import type { Flight } from '../../services/flights'
import type { User } from '../../services/auth'
import { api } from '../../services/api'
import { useToast } from '../common/ToastProvider'

type SortKey = 'price' | 'departure' | 'duration'
type SortDir = 'asc' | 'desc'
type FareClass = 'economy' | 'business'
type DirectFilter = 'all' | 'direct' | 'connecting'

const COUNTRY_GROUPS: { label: string; codes: string[] }[] = [
  { label: '국내', codes: ['GMP', 'PUS', 'CJU', 'TAE', 'KWJ', 'CJJ', 'RSU', 'YNY'] },
  { label: '일본', codes: ['NRT', 'HND', 'KIX', 'FUK', 'OKA', 'NGO', 'CTS'] },
  { label: '중국', codes: ['PEK', 'PVG', 'CAN', 'CTU', 'XIY'] },
  { label: '동남아', codes: ['BKK', 'DMK', 'SIN', 'MNL', 'KUL', 'HAN', 'SGN', 'DAD', 'DPS', 'CGK'] },
  { label: '미주', codes: ['LAX', 'JFK', 'SFO', 'YVR', 'YYZ'] },
  { label: '유럽', codes: ['LHR', 'CDG', 'FRA', 'AMS', 'FCO', 'MAD', 'BCN'] },
  { label: '오세아니아', codes: ['SYD', 'MEL', 'AKL'] },
  { label: '중동/기타', codes: ['DXB', 'DOH', 'NBO'] },
]

const COUNTRY_MAP: Record<string, string> = {
  ICN: '대한민국', GMP: '대한민국', PUS: '대한민국', CJU: '대한민국',
  NRT: '일본', HND: '일본', KIX: '일본', FUK: '일본', OKA: '일본', NGO: '일본', CTS: '일본',
  PEK: '중국', PVG: '중국', CAN: '중국', CTU: '중국', XIY: '중국',
  TPE: '대만', HKG: '홍콩',
  BKK: '태국', DMK: '태국',
  SIN: '싱가포르',
  MNL: '필리핀', CEB: '필리핀',
  KUL: '말레이시아',
  HAN: '베트남', SGN: '베트남', DAD: '베트남',
  DPS: '인도네시아', CGK: '인도네시아',
  LAX: '미국', JFK: '미국', SFO: '미국', ORD: '미국', SEA: '미국',
  YVR: '캐나다', YYZ: '캐나다',
  LHR: '영국',
  CDG: '프랑스',
  FRA: '독일',
  AMS: '네덜란드',
  FCO: '이탈리아',
  MAD: '스페인', BCN: '스페인',
  SYD: '호주', MEL: '호주',
  AKL: '뉴질랜드',
  DXB: '아랍에미리트',
  DOH: '카타르',
  NBO: '케냐',
}

function countryOf(code: string): string {
  return COUNTRY_MAP[code] ?? ''
}

const FLAG_MAP: Record<string, string> = {
  ICN: '🇰🇷', GMP: '🇰🇷', PUS: '🇰🇷', CJU: '🇰🇷',
  NRT: '🇯🇵', HND: '🇯🇵', KIX: '🇯🇵', FUK: '🇯🇵', OKA: '🇯🇵', NGO: '🇯🇵', CTS: '🇯🇵',
  PEK: '🇨🇳', PVG: '🇨🇳', CAN: '🇨🇳', CTU: '🇨🇳', XIY: '🇨🇳',
  TPE: '🇹🇼', HKG: '🇭🇰',
  BKK: '🇹🇭', DMK: '🇹🇭',
  SIN: '🇸🇬',
  MNL: '🇵🇭', CEB: '🇵🇭',
  KUL: '🇲🇾',
  HAN: '🇻🇳', SGN: '🇻🇳', DAD: '🇻🇳',
  DPS: '🇮🇩', CGK: '🇮🇩',
  LAX: '🇺🇸', JFK: '🇺🇸', SFO: '🇺🇸', ORD: '🇺🇸', SEA: '🇺🇸',
  YVR: '🇨🇦', YYZ: '🇨🇦',
  LHR: '🇬🇧',
  CDG: '🇫🇷',
  FRA: '🇩🇪',
  AMS: '🇳🇱',
  FCO: '🇮🇹',
  MAD: '🇪🇸', BCN: '🇪🇸',
  SYD: '🇦🇺', MEL: '🇦🇺',
  AKL: '🇳🇿',
  DXB: '🇦🇪',
  DOH: '🇶🇦',
  NBO: '🇰🇪',
}

function flagOf(code: string): string {
  return FLAG_MAP[code] ?? '✈️'
}

interface Props {
  onBook: (flight: BookingFlight) => void
  searchParams?: SearchParams | null
  user?: User | null
  onGoLogin?: () => void
}

export default function FlightBooking({ onBook, searchParams, user: _user, onGoLogin: _onGoLogin }: Props) {
  const { toast } = useToast()
  const [isRoundtrip, setIsRoundtrip] = useState(searchParams?.tripType === 'roundtrip')

  // Outbound flights
  const [flights, setFlights] = useState<Flight[]>([])
  const [loading, setLoading] = useState(true)

  // Return flights (roundtrip)
  const [bookingStep, setBookingStep] = useState<'outbound' | 'return'>('outbound')
  const [outboundFlight, setOutboundFlight] = useState<Flight | null>(null)
  const [returnFlights, setReturnFlights] = useState<Flight[]>([])
  const [returnLoading, setReturnLoading] = useState(false)
  const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null)

  // 날짜 (로컬 — topbar에서 직접 수정 가능)
  const [localDate, setLocalDate] = useState(searchParams?.date ?? '')
  const [localReturnDate, setLocalReturnDate] = useState(searchParams?.returnDate ?? '')

  // Filters & sort
  const [sortBy, setSortBy] = useState<SortKey>('departure')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [fareClass, setFareClass] = useState<FareClass>('economy')
  const [timeFilter, setTimeFilter] = useState<string[]>([])
  const [countryFilter, setCountryFilter] = useState<string>('')
  const [directFilter, setDirectFilter] = useState<DirectFilter>('all')
  const [destFilter, setDestFilter] = useState<string>('')
  const [destModalOpen, setDestModalOpen] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // AI 여행지 추천
  interface RecDest { city: string; city_en: string; country: string; code: string; emoji: string; reason: string; highlight: string; est_budget_per_day: number }
  const [recOpen, setRecOpen] = useState(false)
  const [recDuration, setRecDuration] = useState(5)
  const [recBudget, setRecBudget] = useState('normal')
  const [recVibes, setRecVibes] = useState<string[]>([])
  const [recLoading, setRecLoading] = useState(false)
  const [recResults, setRecResults] = useState<RecDest[] | null>(null)
  const [recFlightDest, setRecFlightDest] = useState<RecDest | null>(null)

  // AI 항공편 추천
  interface FlightRec { flight_id: number; flight_no: string; from_city: string; from_code: string; to_city: string; to_code: string; date: string; depart_time: string; arrival_time: string; duration: string; economy_price: number; business_price: number; is_direct: boolean; reason: string }
  const [flightRecOpen, setFlightRecOpen] = useState(false)
  const [flightRecQuery, setFlightRecQuery] = useState('')
  const [flightRecLoading, setFlightRecLoading] = useState(false)
  const [flightRecMsg, setFlightRecMsg] = useState('')
  const [flightRecResults, setFlightRecResults] = useState<FlightRec[] | null>(null)

  async function fetchFlightRecommend() {
    if (!flightRecQuery.trim() || flightRecLoading) return
    setFlightRecLoading(true)
    setFlightRecResults(null)
    setFlightRecMsg('')
    try {
      const data = await api.post<{ message: string; flights: FlightRec[] }>('/nextrip/flight-recommend', { query: flightRecQuery.trim() })
      setFlightRecMsg(data.message)
      setFlightRecResults(data.flights)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('429') || msg.includes('Too Many')) {
        toast('AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 'warning')
      } else {
        toast('추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error')
      }
    } finally {
      setFlightRecLoading(false)
    }
  }

  async function fetchRecommend() {
    if (recLoading) return
    setRecLoading(true)
    setRecResults(null)
    try {
      const data = await api.post<{ destinations: RecDest[] }>('/nextrip/recommend', {
        duration: recDuration,
        budget: recBudget,
        vibes: recVibes,
      })
      setRecResults(data.destinations)
    } catch {
      toast('추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error')
    } finally {
      setRecLoading(false)
    }
  }

  function applyRecommend(code: string) {
    setDestFilter(code)
    setRecOpen(false)
    setRecResults(null)
    setRecFlightDest(null)
  }

  const recDestFlights = recFlightDest
    ? applyFilters(flights.filter(f => f.to_code === recFlightDest.code))
    : []

  // searchParams가 바뀌면 로컬 날짜도 동기화
  useEffect(() => {
    setLocalDate(searchParams?.date ?? '')
    setLocalReturnDate(searchParams?.returnDate ?? '')
    setIsRoundtrip(searchParams?.tripType === 'roundtrip')
  }, [searchParams])

  // 날짜(로컬) 또는 searchParams 변경 시 항공편 재조회
  useEffect(() => {
    setLoading(true)
    setBookingStep('outbound')
    setOutboundFlight(null)
    setSelectedId(null)
    setSelectedReturnId(null)
    fetchFlights(searchParams ? { ...searchParams, date: localDate || searchParams.date } : { date: localDate } as never)
      .then(setFlights)
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDate, searchParams])

  function toggleTripType() {
    setIsRoundtrip(prev => {
      if (prev) {
        // 왕복 → 편도: 오는편 상태 초기화
        setBookingStep('outbound')
        setOutboundFlight(null)
        setSelectedReturnId(null)
        setReturnFlights([])
      }
      return !prev
    })
  }

  function fetchReturn(outbound: Flight) {
    setReturnLoading(true)
    fetchFlights({
      from_code: outbound.to_code,
      to_code: outbound.from_code,
      date: localReturnDate || searchParams?.returnDate,
    })
      .then(setReturnFlights)
      .finally(() => setReturnLoading(false))
  }

  function toggleTime(t: string) {
    setTimeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function inTimeRange(time: string) {
    if (timeFilter.length === 0) return true
    const h = parseInt(time.split(':')[0])
    return timeFilter.some(t => {
      if (t === 'dawn')      return h >= 0  && h < 6
      if (t === 'morning')   return h >= 6  && h < 12
      if (t === 'afternoon') return h >= 12 && h < 18
      if (t === 'evening')   return h >= 18 && h < 24
      return true
    })
  }

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('asc') }
  }

  const price = (f: Flight) => fareClass === 'economy' ? Number(f.economy_price) : Number(f.business_price)
  const seats = (f: Flight) => fareClass === 'economy' ? f.economy_seats : f.business_seats

  const countryGroup = COUNTRY_GROUPS.find(g => g.label === countryFilter)

  const uniqueDests = [...new Map(
    flights.map(f => [f.to_code, { code: f.to_code, city: f.to_city }])
  ).values()].sort((a, b) => a.city.localeCompare(b.city, 'ko'))

  function setCountryFilterAndReset(val: string) {
    setCountryFilter(val)
    setDestFilter('')
  }

  function applyFilters(list: Flight[]) {
    return list
      .filter(f => inTimeRange(f.depart_time))
      .filter(f => !countryGroup || countryGroup.codes.includes(f.to_code))
      .filter(f => !destFilter || f.to_code === destFilter)
      .filter(f => directFilter === 'all' ? true : directFilter === 'direct' ? f.is_direct : !f.is_direct)
      .sort((a, b) => {
        let cmp = 0
        if (sortBy === 'price')     cmp = price(a) - price(b)
        if (sortBy === 'departure') cmp = a.depart_time.localeCompare(b.depart_time)
        if (sortBy === 'duration')  cmp = a.duration.localeCompare(b.duration)
        return sortDir === 'asc' ? cmp : -cmp
      })
  }

  const activeList = bookingStep === 'return' ? returnFlights : flights
  const filtered = applyFilters(activeList)

  const TIME_FILTERS = [
    { key: 'dawn',      label: '새벽', sub: '00 – 06시' },
    { key: 'morning',   label: '오전', sub: '06 – 12시' },
    { key: 'afternoon', label: '오후', sub: '12 – 18시' },
    { key: 'evening',   label: '저녁', sub: '18 – 24시' },
  ]

  function goToReturnStep(f: Flight) {
    setOutboundFlight(f)
    setSelectedId(f.id)
    setBookingStep('return')
    setSelectedReturnId(null)
    fetchReturn(f)
  }

  function handleBook() {
    const f = outboundFlight ?? flights.find(fl => fl.id === selectedId)
    if (!f) return
    const farePrice = price(f)

    if (isRoundtrip && selectedReturnId) {
      const rf = returnFlights.find(fl => fl.id === selectedReturnId)!
      const retPrice = price(rf)
      onBook({
        flightId: f.id,
        flightNo: f.flight_no,
        from: { city: f.from_city, code: f.from_code, airport: f.from_airport, country: countryOf(f.from_code) },
        to:   { city: f.to_city,   code: f.to_code,   airport: f.to_airport,   country: countryOf(f.to_code)   },
        date: f.date,
        departTime: f.depart_time,
        arrivalTime: f.arrival_time,
        duration: f.duration,
        fareClass,
        price: farePrice,
        passengerCount: searchParams?.passengerCount ?? 1,
        returnFlight: {
          flightId: rf.id,
          flightNo: rf.flight_no,
          from: { city: rf.from_city, code: rf.from_code, airport: rf.from_airport, country: countryOf(rf.from_code) },
          to:   { city: rf.to_city,   code: rf.to_code,   airport: rf.to_airport,   country: countryOf(rf.to_code)   },
          date: rf.date,
          departTime: rf.depart_time,
          arrivalTime: rf.arrival_time,
          duration: rf.duration,
          price: retPrice,
        },
      })
    } else {
      onBook({
        flightId: f.id,
        flightNo: f.flight_no,
        from: { city: f.from_city, code: f.from_code, airport: f.from_airport, country: countryOf(f.from_code) },
        to:   { city: f.to_city,   code: f.to_code,   airport: f.to_airport,   country: countryOf(f.to_code)   },
        date: f.date,
        departTime: f.depart_time,
        arrivalTime: f.arrival_time,
        duration: f.duration,
        fareClass,
        price: farePrice,
        passengerCount: searchParams?.passengerCount ?? 1,
      })
    }
  }

  const stepLabel = isRoundtrip
    ? (bookingStep === 'outbound' ? '① 가는 편 선택' : '② 오는 편 선택')
    : null

  return (
    <main className="booking-page">

      {/* 상단 경로 바 */}
      <div className="booking-topbar">
        <div className="booking-topbar-inner">
          <div className="booking-route">
            <span className="route-city">{searchParams?.from_code ?? 'ICN'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <span className="route-city">{searchParams?.to_code ?? '전체'}</span>
            <span className="route-meta">
              {localDate || searchParams?.date || ''}
              {isRoundtrip && localReturnDate ? ` ~ ${localReturnDate}` : ''}
              {' · '}{isRoundtrip ? '왕복' : '편도'}
            </span>
          </div>
          {isRoundtrip && bookingStep === 'return' && (
            <button className="route-back-btn" onClick={() => { setBookingStep('outbound'); setSelectedReturnId(null) }}>
              ← 가는 편 다시 선택
            </button>
          )}
        </div>
      </div>

      <div className="booking-body">

        {/* 필터 */}
        <aside className="filter-panel">
          <h3 className="filter-title">필터</h3>

          {/* 날짜 */}
          <div className="filter-section">
            <h4>출발일</h4>
            <input
              type="date"
              className="filter-date-input"
              value={localDate}
              onChange={e => setLocalDate(e.target.value)}
            />
          </div>

          {isRoundtrip && (
            <div className="filter-section">
              <h4>귀국일</h4>
              <input
                type="date"
                className="filter-date-input"
                value={localReturnDate}
                min={localDate}
                onChange={e => setLocalReturnDate(e.target.value)}
              />
            </div>
          )}

          {bookingStep === 'outbound' && (
            <>
              <div className="filter-section">
                <h4>여행지</h4>
                <button className="dest-modal-trigger" onClick={() => { setModalSearch(''); setDestModalOpen(true) }}>
                  {destFilter
                    ? <><span className="dest-modal-trigger-code">{destFilter}</span><span className="dest-modal-trigger-city">{uniqueDests.find(d => d.code === destFilter)?.city}</span></>
                    : <span className="dest-modal-trigger-placeholder">전체 여행지</span>
                  }
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                {destFilter && (
                  <button className="dest-modal-clear" onClick={() => setDestFilter('')}>✕ 선택 해제</button>
                )}
              </div>
            </>
          )}

          <div className="filter-section">
            <h4>여정 유형</h4>
            <div className="fare-toggle">
              <button
                className={!isRoundtrip ? 'active' : ''}
                onClick={toggleTripType}
                disabled={isRoundtrip && !!outboundFlight}
                title={isRoundtrip && !!outboundFlight ? '오는편 선택 후 변경 가능합니다' : ''}
              >편도</button>
              <button className={isRoundtrip ? 'active' : ''} onClick={toggleTripType}>왕복</button>
            </div>
            {isRoundtrip && !!outboundFlight && !selectedReturnId && (
              <p className="roundtrip-required-notice">✈ 왕복 예약 — 오는편도 선택해주세요</p>
            )}
          </div>

          <div className="filter-section">
            <h4>좌석 등급</h4>
            <div className="fare-toggle">
              <button className={fareClass === 'economy' ? 'active' : ''} onClick={() => setFareClass('economy')}>일반석</button>
              <button className={fareClass === 'business' ? 'active' : ''} onClick={() => setFareClass('business')}>비즈니스석</button>
            </div>
          </div>

          <div className="filter-section">
            <h4>경유 여부</h4>
            <div className="fare-toggle">
              <button className={directFilter === 'all'        ? 'active' : ''} onClick={() => setDirectFilter('all')}>전체</button>
              <button className={directFilter === 'direct'     ? 'active' : ''} onClick={() => setDirectFilter('direct')}>직항</button>
              <button className={directFilter === 'connecting' ? 'active' : ''} onClick={() => setDirectFilter('connecting')}>경유</button>
            </div>
          </div>

          <div className="filter-section">
            <h4>출발 시간대</h4>
            {TIME_FILTERS.map(({ key, label, sub }) => (
              <label key={key} className="filter-checkbox">
                <input type="checkbox" checked={timeFilter.includes(key)} onChange={() => toggleTime(key)} />
                <span>{label} <em>{sub}</em></span>
              </label>
            ))}
          </div>

          {bookingStep === 'outbound' && (
            <div className="filter-section">
              <h4>지역</h4>
              <div className="country-filter-list">
                <button className={`country-filter-btn ${countryFilter === '' ? 'active' : ''}`} onClick={() => setCountryFilterAndReset('')}>전체</button>
                {COUNTRY_GROUPS.map(g => (
                  <button
                    key={g.label}
                    className={`country-filter-btn ${countryFilter === g.label ? 'active' : ''}`}
                    onClick={() => setCountryFilterAndReset(g.label)}
                  >{g.label}</button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* 결과 */}
        <section className="flight-results">

          {stepLabel && (
            <div className="roundtrip-step-banner">
              <span>{stepLabel}</span>
              {bookingStep === 'return' && outboundFlight && (
                <span className="roundtrip-outbound-summary">
                  가는 편: {outboundFlight.flight_no} · {outboundFlight.depart_time} · ₩{price(outboundFlight).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* ── AI 배너 ── */}
          {bookingStep === 'outbound' && (
            <div className="rec-banner">
              <span>어디로 갈지 모르겠다면?</span>
              <button className="rec-banner-btn" onClick={() => { setRecResults(null); setRecOpen(true) }}>
                🤖 AI 여행지 추천받기
              </button>
              <button className="rec-banner-btn flight-rec-btn" onClick={() => { setFlightRecResults(null); setFlightRecQuery(''); setFlightRecOpen(true) }}>
                ✈️ AI 항공편 추천
              </button>
            </div>
          )}

          {/* ── 여행지 칩 필터 바 ── */}
          {bookingStep === 'outbound' && uniqueDests.length > 0 && (
            <div className="dest-chip-bar">
              <button
                className={`dest-chip ${destFilter === '' ? 'active' : ''}`}
                onClick={() => setDestFilter('')}
              >
                전체
              </button>
              {uniqueDests.map(d => (
                <button
                  key={d.code}
                  className={`dest-chip ${destFilter === d.code ? 'active' : ''}`}
                  onClick={() => setDestFilter(prev => prev === d.code ? '' : d.code)}
                >
                  <span className="dest-chip-flag">{flagOf(d.code)}</span>
                  {d.city}
                  <span className="dest-chip-code">{d.code}</span>
                </button>
              ))}
            </div>
          )}

          <div className="sort-bar">
            <span className="result-count">
              총 <strong>{filtered.length}편</strong> 운항
            </span>
            <div className="sort-options">
              {(['departure', 'price', 'duration'] as SortKey[]).map(key => (
                <button
                  key={key}
                  className={`sort-btn ${sortBy === key ? 'active' : ''}`}
                  onClick={() => toggleSort(key)}
                >
                  {key === 'departure' ? '출발시간' : key === 'price' ? '가격' : '소요시간'}
                  {sortBy === key && <span className="sort-arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
                </button>
              ))}
            </div>
          </div>

          {(loading || returnLoading) && <FlightSkeleton />}

          {filtered.map(flight => {
            const farePrice = price(flight)
            const fareSeats = seats(flight)
            const isSelected = bookingStep === 'outbound'
              ? selectedId === flight.id
              : selectedReturnId === flight.id
            const lowSeat = fareSeats <= 10

            return (
              <div key={flight.id} className={`flight-card ${isSelected ? 'selected' : ''}`}>

                <div className="flight-brand">
                  <div className="cw-badge">CW</div>
                  <div>
                    <p className="brand-name">CLEARWAY</p>
                    <p className="flight-no">{flight.flight_no}</p>
                  </div>
                </div>

                <div className="flight-route">
                  <div className="route-point">
                    <span className="flight-time">{flight.depart_time}</span>
                    <span className="flight-city">{flight.from_code}</span>
                    <span className="flight-airport"><span className="flight-flag">{flagOf(flight.from_code)}</span>{flight.from_airport}</span>
                  </div>

                  <div className="route-line">
                    <span className="route-duration">{flight.duration}</span>
                    <div className="route-track">
                      <div className="route-dot" />
                      <div className="route-dash" />
                      <svg className="route-plane" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/>
                      </svg>
                      <div className="route-dash" />
                      <div className="route-dot" />
                    </div>
                    <span className={`route-direct ${!flight.is_direct ? 'via' : ''}`}>
                      {flight.is_direct ? '직항' : `경유 ${flight.via_city}`}
                    </span>
                  </div>

                  <div className="route-point right">
                    <span className="flight-time">{flight.arrival_time}</span>
                    <span className="flight-city">{flight.to_code}</span>
                    <span className="flight-airport">{flight.to_airport}<span className="flight-flag">{flagOf(flight.to_code)}</span></span>
                  </div>
                </div>

                <div className="flight-price-wrap">
                  {lowSeat && <span className="seats-left">잔여 {fareSeats}석</span>}
                  <p className="fare-class-label">{fareClass === 'economy' ? '일반석' : '비즈니스석'}</p>
                  <p className="flight-price">₩{farePrice.toLocaleString()}</p>
                  <p className="price-note">성인 1인 · 세금 포함</p>
                  <button
                    className={`select-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (bookingStep === 'outbound') {
                        if (isRoundtrip) {
                          goToReturnStep(flight)
                        } else {
                          setSelectedId(isSelected ? null : flight.id)
                        }
                      } else {
                        setSelectedReturnId(isSelected ? null : flight.id)
                      }
                    }}
                  >
                    {isSelected ? '선택됨 ✓' : (isRoundtrip && bookingStep === 'outbound' ? '이 편 선택' : '선택')}
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      </div>

      {/* 하단 예약 진행 바 — 편도 또는 왕복 오는편 선택 후 */}
      {(() => {
        if (isRoundtrip) {
          if (bookingStep === 'return' && selectedReturnId && outboundFlight) {
            const rf = returnFlights.find(fl => fl.id === selectedReturnId)!
            const retPrice = price(rf)
            const total = price(outboundFlight) + retPrice
            return (
              <div className="booking-bar">
                <div className="booking-bar-inner">
                  <div className="booking-bar-info roundtrip">
                    <div>
                      <p className="bb-flight-no">왕복 예약</p>
                      <p className="bb-route">
                        {outboundFlight.from_code} → {outboundFlight.to_code} ({outboundFlight.depart_time}) &nbsp;+&nbsp;
                        {rf.from_code} → {rf.to_code} ({rf.depart_time})
                      </p>
                    </div>
                    <span className="bb-fare-tag">{fareClass === 'economy' ? '일반석' : '비즈니스석'}</span>
                  </div>
                  <div className="booking-bar-right">
                    <span className="bb-price">₩{total.toLocaleString()}</span>
                    <button className="bb-btn" onClick={handleBook}>예약 진행 →</button>
                  </div>
                </div>
              </div>
            )
          }
          return null
        }

        if (!selectedId) return null
        const f = flights.find(fl => fl.id === selectedId)!
        if (!f) return null
        return (
          <div className="booking-bar">
            <div className="booking-bar-inner">
              <div className="booking-bar-info">
                <div className="cw-badge" style={{ width: 36, height: 36, fontSize: 11 }}>CW</div>
                <div>
                  <p className="bb-flight-no">{f.flight_no}</p>
                  <p className="bb-route">{f.from_code} ({f.depart_time}) → {f.to_code} ({f.arrival_time})</p>
                </div>
                <span className="bb-fare-tag">{fareClass === 'economy' ? '일반석' : '비즈니스석'}</span>
              </div>
              <div className="booking-bar-right">
                <span className="bb-price">₩{price(f).toLocaleString()}</span>
                <button className="bb-btn" onClick={handleBook}>예약 진행 →</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── 여행지 선택 모달 ── */}
      {destModalOpen && (() => {
        const modalDests = uniqueDests.filter(d => {
          const matchRegion = !countryFilter || (COUNTRY_GROUPS.find(g => g.label === countryFilter)?.codes.includes(d.code) ?? false)
          const matchSearch = !modalSearch || d.city.includes(modalSearch) || d.code.includes(modalSearch.toUpperCase())
          return matchRegion && matchSearch
        })
        const groupedDests = COUNTRY_GROUPS.map(g => ({
          ...g,
          items: modalDests.filter(d => g.codes.includes(d.code)),
        })).filter(g => g.items.length > 0)

        return (
          <div className="dest-modal-overlay" onClick={() => setDestModalOpen(false)}>
            <div className="dest-modal" onClick={e => e.stopPropagation()}>
              <div className="dest-modal-header">
                <h3>여행지 선택</h3>
                <button className="dest-modal-close" onClick={() => setDestModalOpen(false)}>✕</button>
              </div>
              <div className="dest-modal-search-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input
                  className="dest-modal-search"
                  placeholder="도시명 또는 코드 검색 (예: 도쿄, NRT)"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  autoFocus
                />
                {modalSearch && <button className="dest-modal-search-clear" onClick={() => setModalSearch('')}>✕</button>}
              </div>
              <div className="dest-modal-body">
                {destFilter && (
                  <button className="dest-modal-reset" onClick={() => { setDestFilter(''); setDestModalOpen(false) }}>
                    ✕ 선택 해제 — 전체 보기
                  </button>
                )}
                {groupedDests.length === 0 ? (
                  <p className="dest-modal-empty">검색 결과가 없습니다.</p>
                ) : (
                  groupedDests.map(g => (
                    <div key={g.label} className="dest-modal-group">
                      <p className="dest-modal-group-label">{g.label}</p>
                      <div className="dest-modal-grid">
                        {g.items.map(d => (
                          <button
                            key={d.code}
                            className={`dest-modal-item ${destFilter === d.code ? 'active' : ''}`}
                            onClick={() => { setDestFilter(d.code); setDestModalOpen(false) }}
                          >
                            <span className="dest-modal-flag">{flagOf(d.code)}</span>
                            <span className="dest-modal-city">{d.city}</span>
                            <span className="dest-modal-code">{d.code}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── AI 항공편 추천 모달 ── */}
      {flightRecOpen && (
        <div className="rec-overlay" onClick={() => setFlightRecOpen(false)}>
          <div className="rec-modal" onClick={e => e.stopPropagation()}>
            <div className="rec-modal-head">
              <h2>✈️ AI 항공편 추천</h2>
              <button className="rec-close" onClick={() => setFlightRecOpen(false)}>✕</button>
            </div>

            {!flightRecResults ? (
              <div className="rec-form">
                <p className="flight-rec-desc">원하는 여행을 자유롭게 말해보세요.<br />예산, 기간, 여행지 취향을 알려주시면 항공편을 추천해드립니다.</p>
                <div className="flight-rec-examples">
                  {['예산 30만원, 3박4일 추천해줘', '동남아로 저렴한 직항 있어?', '연인이랑 5일 이상 여행 가고 싶어'].map(ex => (
                    <button key={ex} className="flight-rec-example" onClick={() => setFlightRecQuery(ex)}>{ex}</button>
                  ))}
                </div>
                <textarea
                  className="flight-rec-input"
                  placeholder="예) 예산 30만원, 3박4일로 어디가 좋아요?"
                  value={flightRecQuery}
                  onChange={e => setFlightRecQuery(e.target.value)}
                  rows={3}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); fetchFlightRecommend() } }}
                />
                <button className="rec-submit" onClick={fetchFlightRecommend} disabled={flightRecLoading || !flightRecQuery.trim()}>
                  {flightRecLoading ? 'AI가 추천 중...' : '✨ 추천받기'}
                </button>
              </div>
            ) : (
              <div className="rec-results">
                {flightRecMsg && <p className="rec-results-title">{flightRecMsg}</p>}
                {flightRecResults.length === 0 ? (
                  <p className="flight-rec-empty">조건에 맞는 항공편을 찾지 못했습니다.<br />다른 조건으로 다시 시도해 보세요.</p>
                ) : flightRecResults.map((r, i) => (
                  <div key={i} className="flight-rec-card">
                    <div className="flight-rec-card-top">
                      <span className="flight-rec-badge">#{i + 1} 추천</span>
                      <span className="flight-rec-no">{r.flight_no}</span>
                      <span className={`flight-rec-direct ${r.is_direct ? '' : 'via'}`}>{r.is_direct ? '직항' : '경유'}</span>
                    </div>
                    <div className="flight-rec-route">
                      <div className="flight-rec-point">
                        <strong>{r.depart_time}</strong>
                        <span>{r.from_code}</span>
                      </div>
                      <div className="flight-rec-arrow">
                        <span>{r.duration}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </div>
                      <div className="flight-rec-point right">
                        <strong>{r.arrival_time}</strong>
                        <span>{r.to_code} {r.to_city}</span>
                      </div>
                    </div>
                    <div className="flight-rec-info">
                      <span className="flight-rec-date">{r.date}</span>
                      <span className="flight-rec-price">₩{r.economy_price.toLocaleString()}</span>
                    </div>
                    <p className="flight-rec-reason">💬 {r.reason}</p>
                    <button className="rec-apply" onClick={() => { setDestFilter(r.to_code); setFlightRecOpen(false) }}>
                      이 항공편 보기
                    </button>
                  </div>
                ))}
                <button className="rec-retry" onClick={() => setFlightRecResults(null)}>← 다시 입력</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AI 여행지 추천 모달 ── */}
      {recOpen && (
        <div className="rec-overlay" onClick={() => { setRecOpen(false); setRecFlightDest(null) }}>
          <div className="rec-modal" onClick={e => e.stopPropagation()}>
            <div className="rec-modal-head">
              <h2>🤖 AI 여행지 추천</h2>
              <button className="rec-close" onClick={() => { setRecOpen(false); setRecFlightDest(null) }}>✕</button>
            </div>

            {!recResults ? (
              <div className="rec-form">
                <div className="rec-field">
                  <label>여행 기간</label>
                  <div className="rec-chips">
                    {[3, 5, 7, 10, 14].map(d => (
                      <button key={d} className={`rec-chip ${recDuration === d ? 'active' : ''}`} onClick={() => setRecDuration(d)}>{d}일</button>
                    ))}
                  </div>
                </div>
                <div className="rec-field">
                  <label>예산 수준</label>
                  <div className="rec-chips">
                    {[['budget', '💰 저예산'], ['normal', '💳 일반'], ['premium', '💎 프리미엄']].map(([v, l]) => (
                      <button key={v} className={`rec-chip ${recBudget === v ? 'active' : ''}`} onClick={() => setRecBudget(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="rec-field">
                  <label>여행 테마 <span>(복수 선택)</span></label>
                  <div className="rec-chips">
                    {[['자연/힐링','🌿'],['맛집탐방','🍜'],['문화/역사','🏛'],['액티비티','🎯'],['해변/휴양','🏖'],['쇼핑','🛍'],['야경','🌃']].map(([v, e]) => (
                      <button
                        key={v}
                        className={`rec-chip ${recVibes.includes(v) ? 'active' : ''}`}
                        onClick={() => setRecVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                      >{e} {v}</button>
                    ))}
                  </div>
                </div>
                <button className="rec-submit" onClick={fetchRecommend} disabled={recLoading}>
                  {recLoading ? 'AI가 추천 중...' : '✨ 추천받기'}
                </button>
              </div>
            ) : recFlightDest ? (
              <div className="rec-results">
                <button className="rec-retry" onClick={() => setRecFlightDest(null)}>← 다른 여행지 보기</button>
                <div className="rec-dest-header">
                  <span className="rec-dest-emoji">{recFlightDest.emoji}</span>
                  <div>
                    <p className="rec-dest-name">{recFlightDest.city} <span className="rec-card-country">{recFlightDest.country}</span></p>
                    <p className="rec-card-highlight">✦ {recFlightDest.highlight}</p>
                  </div>
                </div>
                {recDestFlights.length === 0 ? (
                  <p className="flight-rec-empty">이 목적지 운항 편이 없습니다.<br />날짜를 변경해 보세요.</p>
                ) : (
                  recDestFlights.map((f, i) => (
                    <div key={f.id} className="flight-rec-card">
                      <div className="flight-rec-card-top">
                        <span className="flight-rec-badge">#{i + 1}</span>
                        <span className="flight-rec-no">{f.flight_no}</span>
                        <span className={`flight-rec-direct ${f.is_direct ? '' : 'via'}`}>{f.is_direct ? '직항' : `경유 ${f.via_city}`}</span>
                      </div>
                      <div className="flight-rec-route">
                        <div className="flight-rec-point">
                          <strong>{f.depart_time}</strong>
                          <span>{f.from_code}</span>
                        </div>
                        <div className="flight-rec-arrow">
                          <span>{f.duration}</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                        <div className="flight-rec-point right">
                          <strong>{f.arrival_time}</strong>
                          <span>{f.to_code} {f.to_city}</span>
                        </div>
                      </div>
                      <div className="flight-rec-info">
                        <span className="flight-rec-date">{f.date}</span>
                        <span className="flight-rec-price">₩{(fareClass === 'economy' ? Number(f.economy_price) : Number(f.business_price)).toLocaleString()}</span>
                      </div>
                      <button className="rec-apply" onClick={() => {
                        setSelectedId(f.id)
                        setDestFilter(f.to_code)
                        setRecOpen(false)
                        setRecResults(null)
                        setRecFlightDest(null)
                      }}>이 항공편 선택</button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="rec-results">
                <p className="rec-results-title">AI 추천 여행지 TOP 3</p>
                {recResults.map((r, i) => (
                  <div key={i} className="rec-card">
                    <div className="rec-card-left">
                      <span className="rec-emoji">{r.emoji}</span>
                      <div>
                        <div className="rec-card-city">{r.city} <span className="rec-card-country">{r.country}</span></div>
                        <div className="rec-card-reason">{r.reason}</div>
                        <div className="rec-card-highlight">✦ {r.highlight}</div>
                      </div>
                    </div>
                    <div className="rec-card-right">
                      <div className="rec-budget">₩{r.est_budget_per_day?.toLocaleString()}<span>/일</span></div>
                      <button className="rec-apply" onClick={() => setRecFlightDest(r)}>항공권 보기</button>
                    </div>
                  </div>
                ))}
                <button className="rec-retry" onClick={() => setRecResults(null)}>← 다시 선택</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
