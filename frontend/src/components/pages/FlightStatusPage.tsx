import { useState, useEffect, useCallback } from 'react'
import './FlightStatusPage.css'
import { api } from '../../services/api'

interface RawFlight {
  id: number
  flight_no: string
  from_city: string; from_code: string; from_airport: string
  to_city: string;   to_code: string;   to_airport: string
  date: string
  depart_time: string
  arrival_time: string
  duration: string
  is_direct: boolean
  via_city: string | null
  is_cancelled: boolean
  economy_seats: number
}

// 출발편 상태
type DepStatus = 'ontime' | 'boarding' | 'departed' | 'cancelled'
// 도착편 상태
type ArrStatus = 'scheduled' | 'in_flight' | 'arriving' | 'arrived' | 'cancelled'

const DEP_STATUS_META: Record<DepStatus, { label: string }> = {
  ontime:    { label: '정시 출발' },
  boarding:  { label: '탑승 중'   },
  departed:  { label: '출발 완료' },
  cancelled: { label: '결항'      },
}

const ARR_STATUS_META: Record<ArrStatus, { label: string }> = {
  scheduled: { label: '출발 전'   },
  in_flight: { label: '비행 중'   },
  arriving:  { label: '도착 예정' },
  arrived:   { label: '도착 완료' },
  cancelled: { label: '결항'      },
}

const DEP_FILTERS: Array<{ key: DepStatus | ''; label: string }> = [
  { key: '',          label: '전체'     },
  { key: 'ontime',    label: '정시 출발' },
  { key: 'boarding',  label: '탑승 중'  },
  { key: 'departed',  label: '출발 완료' },
  { key: 'cancelled', label: '결항'     },
]

const ARR_FILTERS: Array<{ key: ArrStatus | ''; label: string }> = [
  { key: '',          label: '전체'     },
  { key: 'scheduled', label: '출발 전'  },
  { key: 'in_flight', label: '비행 중'  },
  { key: 'arriving',  label: '도착 예정' },
  { key: 'arrived',   label: '도착 완료' },
  { key: 'cancelled', label: '결항'     },
]

const DOMESTIC = new Set(['CJU', 'PUS', 'TAE', 'KWJ', 'RSU', 'YNY', 'CJJ'])

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function computeDepStatus(depart: string, isCancelled: boolean, now: number): DepStatus {
  if (isCancelled) return 'cancelled'
  const dep = toMins(depart)
  if (now >= dep) return 'departed'
  if (now >= dep - 40) return 'boarding'
  return 'ontime'
}

function computeArrStatus(depart: string, arrival: string, isCancelled: boolean, now: number): ArrStatus {
  if (isCancelled) return 'cancelled'
  const dep = toMins(depart)
  const arr = toMins(arrival)
  if (now >= arr) return 'arrived'
  if (now >= arr - 30) return 'arriving'
  if (now >= dep) return 'in_flight'
  return 'scheduled'
}

function getDepGate(flight: RawFlight): string {
  if (flight.is_cancelled) return '—'
  if (DOMESTIC.has(flight.to_code)) return `T2-${((flight.id * 3) % 12) + 1}`
  return `A${((flight.id * 7 + 5) % 50) + 1}`
}

function getArrGate(flight: RawFlight): string {
  if (flight.is_cancelled) return '—'
  if (DOMESTIC.has(flight.from_code)) return `T2-${((flight.id * 5) % 10) + 1}`
  return `B${((flight.id * 11 + 3) % 40) + 1}`
}

function getNow() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function localDateStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function FlightStatusPage() {
  const [tab, setTab]       = useState<'dep' | 'arr'>('dep')
  const [depFilter, setDepFilter] = useState<DepStatus | ''>('')
  const [arrFilter, setArrFilter] = useState<ArrStatus | ''>('')
  const [flights, setFlights] = useState<RawFlight[]>([])
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0) // 매분 강제 리렌더

  // 렌더마다 항상 최신 현재 시각 계산 (stale state 방지)
  const now = getNow()

  const load = useCallback(async () => {
    try {
      const date = localDateStr()
      const all = await api.get<RawFlight[]>(`/flights?date=${date}&limit=500`)
      setFlights(all)
    } catch {
      // 오류 시 기존 데이터 유지
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const tickInterval  = setInterval(() => setTick(t => t + 1), 60_000)
    const reloadInterval = setInterval(load, 5 * 60_000)
    return () => { clearInterval(tickInterval); clearInterval(reloadInterval) }
  }, [load])

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
  const currentTime = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit',
  })

  const depFlights = flights.filter(f => f.from_code === 'ICN')
  const arrFlights = flights.filter(f => f.to_code === 'ICN')

  // 출발편 상태 계산
  const depWithStatus = depFlights.map(f => ({
    ...f,
    _status: computeDepStatus(f.depart_time, f.is_cancelled, now),
    _gate: getDepGate(f),
  }))

  // 도착편 상태 계산 — depart_time(출발 시각), arrival_time(인천 도착 시각) 기준
  const arrWithStatus = arrFlights.map(f => ({
    ...f,
    _status: computeArrStatus(f.depart_time, f.arrival_time, f.is_cancelled, now),
    _gate: getArrGate(f),
  }))

  const depFiltered = depWithStatus
    .filter(f => depFilter ? f._status === depFilter : true)
    .sort((a, b) => a.depart_time.localeCompare(b.depart_time))

  const arrFiltered = arrWithStatus
    .filter(f => arrFilter ? f._status === arrFilter : true)
    .sort((a, b) => a.arrival_time.localeCompare(b.arrival_time))

  // 헤더 요약 — 현재 탭 기준
  const depCounts = {
    ontime:   depWithStatus.filter(f => f._status === 'ontime').length,
    boarding: depWithStatus.filter(f => f._status === 'boarding').length,
    departed: depWithStatus.filter(f => f._status === 'departed').length,
    cancelled: depWithStatus.filter(f => f._status === 'cancelled').length,
  }
  const arrCounts = {
    scheduled: arrWithStatus.filter(f => f._status === 'scheduled').length,
    in_flight: arrWithStatus.filter(f => f._status === 'in_flight').length,
    arriving:  arrWithStatus.filter(f => f._status === 'arriving').length,
    arrived:   arrWithStatus.filter(f => f._status === 'arrived').length,
    cancelled: arrWithStatus.filter(f => f._status === 'cancelled').length,
  }

  return (
    <main className="fs-page">
      <div className="fs-hero">
        <div className="fs-hero-inner">
          <h1>항공편 현황</h1>
          <p>{today} · 현재 {currentTime} 기준 자동 업데이트</p>

          {tab === 'dep' ? (
            <div className="fs-summary">
              <div className="fs-summary-item"><span className="fs-summary-num">{depCounts.ontime}</span><span>정시</span></div>
              <div className="fs-summary-item boarding"><span className="fs-summary-num">{depCounts.boarding}</span><span>탑승 중</span></div>
              <div className="fs-summary-item departed"><span className="fs-summary-num">{depCounts.departed}</span><span>출발 완료</span></div>
              <div className="fs-summary-item cancelled"><span className="fs-summary-num">{depCounts.cancelled}</span><span>결항</span></div>
            </div>
          ) : (
            <div className="fs-summary">
              <div className="fs-summary-item scheduled"><span className="fs-summary-num">{arrCounts.scheduled}</span><span>출발 전</span></div>
              <div className="fs-summary-item in-flight"><span className="fs-summary-num">{arrCounts.in_flight}</span><span>비행 중</span></div>
              <div className="fs-summary-item arriving"><span className="fs-summary-num">{arrCounts.arriving}</span><span>도착 예정</span></div>
              <div className="fs-summary-item arrived"><span className="fs-summary-num">{arrCounts.arrived}</span><span>도착 완료</span></div>
              <div className="fs-summary-item cancelled"><span className="fs-summary-num">{arrCounts.cancelled}</span><span>결항</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="fs-body">
        <div className="fs-tabs">
          <button className={`fs-tab${tab === 'dep' ? ' active' : ''}`} onClick={() => setTab('dep')}>
            ✈ 출발편 <span className="fs-tab-count">{depFlights.length}</span>
          </button>
          <button className={`fs-tab${tab === 'arr' ? ' active' : ''}`} onClick={() => setTab('arr')}>
            🛬 도착편 <span className="fs-tab-count">{arrFlights.length}</span>
          </button>
        </div>

        {tab === 'dep' ? (
          <>
            <div className="fs-filters">
              {DEP_FILTERS.map(s => (
                <button key={s.key} className={`fs-filter${depFilter === s.key ? ' active' : ''}`}
                  onClick={() => setDepFilter(s.key)}>{s.label}</button>
              ))}
            </div>

            <div className="fs-table-wrap">
            <div className="fs-table">
              <div className="fs-table-head">
                <span>편명</span><span>목적지</span><span>출발</span><span>도착(현지)</span><span>상태</span><span>게이트</span>
              </div>
              {loading ? (
                <div className="fs-empty">불러오는 중...</div>
              ) : depFiltered.length === 0 ? (
                <div className="fs-empty">해당 조건의 항공편이 없습니다.</div>
              ) : depFiltered.map(f => (
                <div key={f.id} className={`fs-row${f._status === 'cancelled' ? ' cancelled' : ''}${f._status === 'departed' ? ' departed-row' : ''}`}>
                  <span className="fs-no">{f.flight_no}</span>
                  <span className="fs-dest">{f.to_city} <em>{f.to_code}</em></span>
                  <span className="fs-time">{f.depart_time}</span>
                  <span className="fs-time">{f.arrival_time}</span>
                  <span><span className={`fs-status fs-status--${f._status}`}>{DEP_STATUS_META[f._status].label}</span></span>
                  <span className="fs-gate">{f._gate}</span>
                </div>
              ))}
            </div>
            </div>
          </>
        ) : (
          <>
            <div className="fs-filters">
              {ARR_FILTERS.map(s => (
                <button key={s.key} className={`fs-filter${arrFilter === s.key ? ' active' : ''}`}
                  onClick={() => setArrFilter(s.key)}>{s.label}</button>
              ))}
            </div>

            <div className="fs-table-wrap">
            <div className="fs-table">
              <div className="fs-table-head">
                <span>편명</span><span>출발지</span><span>현지 출발</span><span>인천 도착</span><span>상태</span><span>게이트</span>
              </div>
              {loading ? (
                <div className="fs-empty">불러오는 중...</div>
              ) : arrFiltered.length === 0 ? (
                <div className="fs-empty">해당 조건의 항공편이 없습니다.</div>
              ) : arrFiltered.map(f => (
                <div key={f.id} className={`fs-row${f._status === 'cancelled' ? ' cancelled' : ''}${f._status === 'arrived' ? ' departed-row' : ''}`}>
                  <span className="fs-no">{f.flight_no}</span>
                  <span className="fs-dest">{f.from_city} <em>{f.from_code}</em></span>
                  <span className="fs-time">{f.depart_time}</span>
                  <span className="fs-time fs-arr-time">{f.arrival_time}</span>
                  <span><span className={`fs-status fs-status--${f._status}`}>{ARR_STATUS_META[f._status].label}</span></span>
                  <span className="fs-gate">{f._gate}</span>
                </div>
              ))}
            </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
