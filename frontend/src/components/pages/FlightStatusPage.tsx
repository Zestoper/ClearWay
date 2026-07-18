import { useState, useEffect, useCallback } from 'react'
import './FlightStatusPage.css'
import { api } from '../../services/api'
import DatePicker from '../common/DatePicker'
import { FROM_AIRPORTS, DOMESTIC, INTL_REGIONS } from '../common/SearchBar'

interface StatusFlight {
  flight_no: string | null
  airline: string | null
  status: string | null
  is_cancelled: boolean
  is_codeshare: boolean
  other_code: string | null
  other_city: string | null
  scheduled_local: string | null
  revised_local: string | null
  actual_local: string | null
  terminal: string | null
  gate: string | null
}

interface StatusResponse {
  date: string
  airport_code: string
  departures: StatusFlight[]
  arrivals: StatusFlight[]
}

const AIRPORT_OPTIONS: Array<{ code: string; label: string; group: string }> = [
  ...FROM_AIRPORTS.map(a => ({ code: a.code, label: `${a.city} · ${a.name}`, group: '출발' })),
  ...DOMESTIC.map(a => ({ code: a.code, label: `${a.city} · ${a.name}`, group: '국내' })),
  ...INTL_REGIONS.flatMap(({ region, airports }) =>
    airports.map(a => ({ code: a.code, label: `${a.city} · ${a.name}`, group: region }))
  ),
]

const STATUS_LABELS: Record<string, string> = {
  Unknown: '정보 없음',
  Expected: '출발 예정',
  Scheduled: '출발 예정',
  EnRoute: '비행 중',
  CheckIn: '체크인 중',
  Boarding: '탑승 중',
  GateClosed: '탑승 마감',
  Departed: '출발 완료',
  Delayed: '지연',
  Approaching: '도착 예정',
  Landed: '착륙',
  Arrived: '도착 완료',
  Canceled: '결항',
  Cancelled: '결항',
  Diverted: '회항',
}

const STATUS_CSS: Record<string, string> = {
  Expected: 'scheduled',
  Scheduled: 'scheduled',
  CheckIn: 'ontime',
  Boarding: 'boarding',
  GateClosed: 'boarding',
  Departed: 'departed',
  EnRoute: 'in_flight',
  Approaching: 'arriving',
  Landed: 'arrived',
  Arrived: 'arrived',
  Delayed: 'delayed',
  Diverted: 'delayed',
}

function statusLabel(f: StatusFlight): string {
  if (f.is_cancelled) return '결항'
  if (!f.status) return '정보 없음'
  return STATUS_LABELS[f.status] ?? f.status
}

function statusCss(f: StatusFlight): string {
  if (f.is_cancelled) return 'cancelled'
  if (!f.status) return 'scheduled'
  return STATUS_CSS[f.status] ?? 'scheduled'
}

function fmtTime(iso: string | null): string {
  if (!iso) return '-'
  const t = iso.split('T')[1]
  return t ? t.slice(0, 5) : '-'
}

function movementTime(f: StatusFlight): { label: string; changed: boolean } {
  if (f.actual_local) return { label: fmtTime(f.actual_local), changed: false }
  if (f.revised_local && f.revised_local !== f.scheduled_local) {
    return { label: fmtTime(f.revised_local), changed: true }
  }
  return { label: '-', changed: false }
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FlightStatusPage() {
  const [airportCode, setAirportCode] = useState('ICN')
  const [date, setDate] = useState(todayStr)
  const [tab, setTab] = useState<'dep' | 'arr'>('dep')
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hideCodeshare, setHideCodeshare] = useState(true)

  const load = useCallback(async (code: string, d: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<StatusResponse>(`/flight-status?code=${code}&date=${d}`)
      setData(res)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '운항 현황을 불러오지 못했습니다.'
      setError(msg)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(airportCode, date)
  }, [load, airportCode, date])

  useEffect(() => {
    const interval = setInterval(() => load(airportCode, date), 5 * 60_000)
    return () => clearInterval(interval)
  }, [load, airportCode, date])

  const airportLabel = AIRPORT_OPTIONS.find(a => a.code === airportCode)?.label ?? airportCode

  const applyCodeshareFilter = (list: StatusFlight[]) =>
    hideCodeshare ? list.filter(f => !f.is_codeshare) : list

  const departures = applyCodeshareFilter(data?.departures ?? [])
  const arrivals = applyCodeshareFilter(data?.arrivals ?? [])

  const counts = {
    dep: departures.length,
    arr: arrivals.length,
    cancelled: (tab === 'dep' ? departures : arrivals).filter(f => f.is_cancelled).length,
    delayed: (tab === 'dep' ? departures : arrivals).filter(f => statusCss(f) === 'delayed').length,
  }

  const rows = [...(tab === 'dep' ? departures : arrivals)].sort((a, b) =>
    (a.scheduled_local ?? '').localeCompare(b.scheduled_local ?? '')
  )

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    load(airportCode, date)
  }

  return (
    <main className="fs-page">
      <div className="fs-hero">
        <div className="fs-hero-inner">
          <h1>운항 현황</h1>
          <p>실시간 데이터 · AeroDataBox 제공</p>

          <form className="fs-search-form" onSubmit={handleSearch}>
            <select
              className="fs-search-select"
              value={airportCode}
              onChange={e => setAirportCode(e.target.value)}
            >
              {['출발', '국내', ...INTL_REGIONS.map(r => r.region)].map(group => (
                <optgroup key={group} label={group}>
                  {AIRPORT_OPTIONS.filter(a => a.group === group).map(a => (
                    <option key={a.code} value={a.code}>{a.code} · {a.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="fs-search-date">
              <DatePicker value={date} onChange={setDate} />
            </div>
            <button type="submit" className="fs-search-btn" disabled={loading}>조회</button>
          </form>

          <div className="fs-summary">
            <div className="fs-summary-item"><span className="fs-summary-num">{tab === 'dep' ? counts.dep : counts.arr}</span><span>전체</span></div>
            <div className="fs-summary-item"><span className="fs-summary-num">{counts.delayed}</span><span>지연</span></div>
            <div className="fs-summary-item cancelled"><span className="fs-summary-num">{counts.cancelled}</span><span>결항</span></div>
          </div>
        </div>
      </div>

      <div className="fs-body">
        <div className="fs-tabs">
          <button className={`fs-tab${tab === 'dep' ? ' active' : ''}`} onClick={() => setTab('dep')}>
            ✈ 출발편 <span className="fs-tab-count">{departures.length}</span>
          </button>
          <button className={`fs-tab${tab === 'arr' ? ' active' : ''}`} onClick={() => setTab('arr')}>
            🛬 도착편 <span className="fs-tab-count">{arrivals.length}</span>
          </button>
        </div>

        <div className="fs-airport-row">
          <p className="fs-airport-label">{airportCode} · {airportLabel} · {date}</p>
          <label className="fs-codeshare-toggle">
            <input
              type="checkbox"
              checked={hideCodeshare}
              onChange={e => setHideCodeshare(e.target.checked)}
            />
            코드셰어 편 숨기기
          </label>
        </div>

        <div className="fs-table-wrap">
          <div className="fs-table">
            <div className="fs-table-head">
              <span>편명</span>
              <span>{tab === 'dep' ? '목적지' : '출발지'}</span>
              <span>예정</span>
              <span>변경/실제</span>
              <span>상태</span>
              <span>터미널/게이트</span>
            </div>
            {loading ? (
              <div className="fs-empty">불러오는 중...</div>
            ) : error ? (
              <div className="fs-empty fs-error">{error}</div>
            ) : rows.length === 0 ? (
              <div className="fs-empty">해당 조건의 항공편이 없습니다.</div>
            ) : rows.map((f, i) => {
              const mv = movementTime(f)
              const gateInfo = [f.terminal, f.gate].filter(Boolean).join(' / ') || '정보 없음'
              return (
                <div key={`${f.flight_no}-${i}`} className={`fs-row${f.is_cancelled ? ' cancelled' : ''}`}>
                  <span className="fs-no">{f.flight_no ?? '-'}<br /><em className="fs-airline">{f.airline}</em></span>
                  <span className="fs-dest">{f.other_city ?? '-'} <em>{f.other_code ?? ''}</em></span>
                  <span className="fs-time">{fmtTime(f.scheduled_local)}</span>
                  <span className={`fs-time${mv.changed ? ' fs-arr-time' : ''}`}>{mv.label}</span>
                  <span><span className={`fs-status fs-status--${statusCss(f)}`}>{statusLabel(f)}</span></span>
                  <span className="fs-gate">{gateInfo}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
