import { useState } from 'react'
import './FlightStatusPage.css'

const CITY: Record<string, string> = {
  ICN: '인천', NRT: '도쿄', KIX: '오사카', FUK: '후쿠오카',
  BKK: '방콕', SIN: '싱가포르', CDG: '파리',
}

type Status = 'ontime' | 'boarding' | 'departed' | 'delayed' | 'cancelled'

const STATUS_META: Record<Status, { label: string }> = {
  ontime:    { label: '정시 출발' },
  boarding:  { label: '탑승 중'   },
  departed:  { label: '출발 완료' },
  delayed:   { label: '지연'      },
  cancelled: { label: '결항'      },
}

const FLIGHTS: { no: string; from: string; to: string; dep: string; arr: string; status: Status; gate: string }[] = [
  { no: 'CW101', from: 'ICN', to: 'NRT', dep: '08:30', arr: '10:55', status: 'departed',  gate: 'A21' },
  { no: 'CW201', from: 'ICN', to: 'KIX', dep: '09:45', arr: '12:00', status: 'departed',  gate: 'A33' },
  { no: 'CW301', from: 'ICN', to: 'FUK', dep: '11:00', arr: '12:45', status: 'boarding',  gate: 'A18' },
  { no: 'CW401', from: 'ICN', to: 'BKK', dep: '12:30', arr: '17:00', status: 'ontime',    gate: 'A42' },
  { no: 'CW501', from: 'ICN', to: 'SIN', dep: '14:00', arr: '19:30', status: 'ontime',    gate: 'A51' },
  { no: 'CW601', from: 'ICN', to: 'CDG', dep: '15:30', arr: '22:00', status: 'cancelled', gate: '—'   },
  { no: 'CW103', from: 'ICN', to: 'NRT', dep: '17:30', arr: '19:55', status: 'ontime',    gate: 'A22' },
  { no: 'CW203', from: 'ICN', to: 'KIX', dep: '18:00', arr: '20:15', status: 'delayed',   gate: 'A35' },
  { no: 'CW102', from: 'NRT', to: 'ICN', dep: '09:00', arr: '11:20', status: 'departed',  gate: 'B12' },
  { no: 'CW202', from: 'KIX', to: 'ICN', dep: '10:30', arr: '12:50', status: 'delayed',   gate: 'B05' },
  { no: 'CW302', from: 'FUK', to: 'ICN', dep: '13:30', arr: '15:15', status: 'boarding',  gate: 'B08' },
  { no: 'CW402', from: 'BKK', to: 'ICN', dep: '18:00', arr: '02:30', status: 'ontime',    gate: 'B22' },
  { no: 'CW502', from: 'SIN', to: 'ICN', dep: '21:00', arr: '05:30', status: 'ontime',    gate: 'B31' },
]

const STATUS_FILTERS: Array<{ key: Status | ''; label: string }> = [
  { key: '',          label: '전체'     },
  { key: 'ontime',    label: '정시 출발' },
  { key: 'boarding',  label: '탑승 중'  },
  { key: 'departed',  label: '출발 완료' },
  { key: 'delayed',   label: '지연'     },
  { key: 'cancelled', label: '결항'     },
]

export default function FlightStatusPage() {
  const [tab, setTab]       = useState<'dep' | 'arr'>('dep')
  const [filter, setFilter] = useState<Status | ''>('')

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  const list = FLIGHTS
    .filter(f => tab === 'dep' ? f.from === 'ICN' : f.to === 'ICN')
    .filter(f => filter ? f.status === filter : true)
    .sort((a, b) => a.dep.localeCompare(b.dep))

  const counts = {
    ontime:    FLIGHTS.filter(f => f.status === 'ontime').length,
    boarding:  FLIGHTS.filter(f => f.status === 'boarding').length,
    delayed:   FLIGHTS.filter(f => f.status === 'delayed').length,
    cancelled: FLIGHTS.filter(f => f.status === 'cancelled').length,
  }

  return (
    <main className="fs-page">
      <div className="fs-hero">
        <div className="fs-hero-inner">
          <h1>항공편 현황</h1>
          <p>{today} 기준 · 실시간 업데이트</p>
          <div className="fs-summary">
            <div className="fs-summary-item"><span className="fs-summary-num">{counts.ontime}</span><span>정시</span></div>
            <div className="fs-summary-item boarding"><span className="fs-summary-num">{counts.boarding}</span><span>탑승 중</span></div>
            <div className="fs-summary-item delayed"><span className="fs-summary-num">{counts.delayed}</span><span>지연</span></div>
            <div className="fs-summary-item cancelled"><span className="fs-summary-num">{counts.cancelled}</span><span>결항</span></div>
          </div>
        </div>
      </div>

      <div className="fs-body">
        <div className="fs-tabs">
          <button className={`fs-tab${tab === 'dep' ? ' active' : ''}`} onClick={() => setTab('dep')}>
            ✈ 출발편
          </button>
          <button className={`fs-tab${tab === 'arr' ? ' active' : ''}`} onClick={() => setTab('arr')}>
            🛬 도착편
          </button>
        </div>

        <div className="fs-filters">
          {STATUS_FILTERS.map(s => (
            <button
              key={s.key}
              className={`fs-filter${filter === s.key ? ' active' : ''}`}
              onClick={() => setFilter(s.key)}
            >
              {s.label}
            </button>
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

          {list.length === 0 ? (
            <div className="fs-empty">해당 조건의 항공편이 없습니다.</div>
          ) : (
            list.map(f => (
              <div key={f.no} className={`fs-row${f.status === 'cancelled' ? ' cancelled' : ''}`}>
                <span className="fs-no">{f.no}</span>
                <span className="fs-dest">
                  {tab === 'dep'
                    ? <>{CITY[f.to]} <em>{f.to}</em></>
                    : <>{CITY[f.from]} <em>{f.from}</em></>
                  }
                </span>
                <span className="fs-time">{f.dep}</span>
                <span className="fs-time">{f.arr}</span>
                <span><span className={`fs-status fs-status--${f.status}`}>{STATUS_META[f.status].label}</span></span>
                <span className="fs-gate">{f.gate}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
