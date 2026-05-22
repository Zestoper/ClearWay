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

type Status = 'ontime' | 'boarding' | 'departed' | 'cancelled'

const STATUS_META: Record<Status, { label: string }> = {
  ontime:    { label: '정시 출발' },
  boarding:  { label: '탑승 중'   },
  departed:  { label: '출발 완료' },
  cancelled: { label: '결항'      },
}

const STATUS_FILTERS: Array<{ key: Status | ''; label: string }> = [
  { key: '',          label: '전체'     },
  { key: 'ontime',    label: '정시 출발' },
  { key: 'boarding',  label: '탑승 중'  },
  { key: 'departed',  label: '출발 완료' },
  { key: 'cancelled', label: '결항'     },
]

const DOMESTIC = new Set(['CJU', 'PUS', 'TAE', 'KWJ', 'RSU', 'YNY', 'CJJ'])

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function computeStatus(departTime: string, isCancelled: boolean, nowMins: number): Status {
  if (isCancelled) return 'cancelled'
  const dep = toMins(departTime)
  if (nowMins >= dep) return 'departed'
  if (nowMins >= dep - 40) return 'boarding'
  return 'ontime'
}

function getGate(flight: RawFlight): string {
  if (flight.is_cancelled) return '—'
  const destCode = flight.to_code === 'ICN' ? flight.from_code : flight.to_code
  if (DOMESTIC.has(destCode)) {
    return `T2-${((flight.id * 3) % 12) + 1}`
  }
  return `A${((flight.id * 7 + 5) % 50) + 1}`
}

function nowMins(): number {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function FlightStatusPage() {
  const [tab, setTab]       = useState<'dep' | 'arr'>('dep')
  const [filter, setFilter] = useState<Status | ''>('')
  const [flights, setFlights] = useState<RawFlight[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(nowMins())

  const load = useCallback(async () => {
    try {
      const date = todayStr()
      const [dep, arr] = await Promise.all([
        api.get<RawFlight[]>(`/flights?from_code=ICN&date=${date}&limit=300`),
        api.get<RawFlight[]>(`/flights?to_code=ICN&date=${date}&limit=300`),
      ])
      setFlights([...dep, ...arr])
    } catch {
      // 오류 시 기존 데이터 유지
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // 매분 상태 갱신
    const tick = setInterval(() => setNow(nowMins()), 60_000)
    // 5분마다 서버 재조회
    const reload = setInterval(load, 5 * 60_000)
    return () => { clearInterval(tick); clearInterval(reload) }
  }, [load])

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  const currentTime = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit',
  })

  const depFlights = flights.filter(f => f.from_code === 'ICN')
  const arrFlights = flights.filter(f => f.to_code === 'ICN')
  const activeList = tab === 'dep' ? depFlights : arrFlights

  const withStatus = activeList.map(f => ({
    ...f,
    _status: computeStatus(f.depart_time, f.is_cancelled, now) as Status,
    _gate: getGate(f),
  }))

  const filtered = withStatus
    .filter(f => filter ? f._status === filter : true)
    .sort((a, b) => a.depart_time.localeCompare(b.depart_time))

  const counts = {
    ontime:   withStatus.filter(f => f._status === 'ontime').length,
    boarding: withStatus.filter(f => f._status === 'boarding').length,
    departed: withStatus.filter(f => f._status === 'departed').length,
    cancelled: withStatus.filter(f => f._status === 'cancelled').length,
  }

  return (
    <main className="fs-page">
      <div className="fs-hero">
        <div className="fs-hero-inner">
          <h1>항공편 현황</h1>
          <p>{today} · 현재 {currentTime} 기준 자동 업데이트</p>
          <div className="fs-summary">
            <div className="fs-summary-item"><span className="fs-summary-num">{counts.ontime}</span><span>정시</span></div>
            <div className="fs-summary-item boarding"><span className="fs-summary-num">{counts.boarding}</span><span>탑승 중</span></div>
            <div className="fs-summary-item departed"><span className="fs-summary-num">{counts.departed}</span><span>출발 완료</span></div>
            <div className="fs-summary-item cancelled"><span className="fs-summary-num">{counts.cancelled}</span><span>결항</span></div>
          </div>
        </div>
      </div>

      <div className="fs-body">
        <div className="fs-tabs">
          <button className={`fs-tab${tab === 'dep' ? ' active' : ''}`} onClick={() => { setTab('dep'); setFilter('') }}>
            ✈ 출발편 <span className="fs-tab-count">{depFlights.length}</span>
          </button>
          <button className={`fs-tab${tab === 'arr' ? ' active' : ''}`} onClick={() => { setTab('arr'); setFilter('') }}>
            🛬 도착편 <span className="fs-tab-count">{arrFlights.length}</span>
          </button>
        </div>

        <div className="fs-filters">
          {STATUS_FILTERS.map(s => (
            <button
              key={s.key}
              className={`fs-filter${filter === s.key ? ' active' : ''}`}
              onClick={() => setFilter(s.key)}
            >{s.label}</button>
          ))}
        </div>

        <div className="fs-table">
          <div className="fs-table-head">
            <span>편명</span>
            <span>{tab === 'dep' ? '목적지' : '출발지'}</span>
            <span>출발</span>
            <span>도착(현지)</span>
            <span>상태</span>
            <span>게이트</span>
          </div>

          {loading ? (
            <div className="fs-empty">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="fs-empty">해당 조건의 항공편이 없습니다.</div>
          ) : (
            filtered.map(f => (
              <div key={f.id} className={`fs-row${f._status === 'cancelled' ? ' cancelled' : ''}${f._status === 'departed' ? ' departed-row' : ''}`}>
                <span className="fs-no">{f.flight_no}</span>
                <span className="fs-dest">
                  {tab === 'dep'
                    ? <>{f.to_city} <em>{f.to_code}</em></>
                    : <>{f.from_city} <em>{f.from_code}</em></>
                  }
                </span>
                <span className="fs-time">{f.depart_time}</span>
                <span className="fs-time">{f.arrival_time}</span>
                <span>
                  <span className={`fs-status fs-status--${f._status}`}>
                    {STATUS_META[f._status].label}
                  </span>
                </span>
                <span className="fs-gate">{f._gate}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
