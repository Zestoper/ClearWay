import { useState, useRef, useEffect } from 'react'
import './DatePicker.css'

interface Props {
  value: string        // YYYY-MM-DD
  onChange: (v: string) => void
  minDate?: string
  showPrices?: boolean
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function toYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function parseYMD(s: string) {
  const [y,m,d] = s.split('-').map(Number)
  return new Date(y, m-1, d)
}

function mockPrice(dateStr: string): number {
  let h = 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  const bases = [89000, 119000, 149000, 179000, 99000, 139000, 109000]
  return bases[h % bases.length]
}

function fmtPrice(n: number) {
  if (n >= 100000) return `${Math.round(n / 1000)}k`
  return `${Math.round(n / 1000)}k`
}

export default function DatePicker({ value, onChange, minDate, showPrices }: Props) {
  const [open, setOpen] = useState(false)
  const today = toYMD(new Date())
  const min = minDate ?? today

  const [viewYear, setViewYear] = useState(() => {
    const d = value ? parseYMD(value) : new Date()
    return d.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? parseYMD(value) : new Date()
    return d.getMonth()
  })

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function getDays() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(firstDay).fill(null)
    for (let i = 1; i <= daysInMonth; i++) cells.push(i)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  function selectDay(day: number) {
    const s = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    if (s < min) return
    onChange(s)
    setOpen(false)
  }

  function cellClass(day: number | null) {
    if (!day) return 'dp-cell empty'
    const s = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const isDisabled = s < min
    const isToday = s === today
    const isSelected = s === value
    const col = new Date(viewYear, viewMonth, day).getDay()
    const isSun = col === 0
    const isSat = col === 6
    return [
      'dp-cell',
      isDisabled ? 'disabled' : '',
      isToday && !isSelected ? 'today' : '',
      isSelected ? 'selected' : '',
      isSun && !isSelected && !isDisabled ? 'sunday' : '',
      isSat && !isSelected && !isDisabled ? 'saturday' : '',
    ].filter(Boolean).join(' ')
  }

  const displayDate = value
    ? (() => {
        const d = parseYMD(value)
        const weekday = DAYS[d.getDay()]
        return `${d.getMonth()+1}월 ${d.getDate()}일 (${weekday})`
      })()
    : '날짜 선택'

  return (
    <div className="dp-wrap" ref={ref}>
      <button
        type="button"
        className={`dp-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className={value ? '' : 'placeholder'}>{displayDate}</span>
      </button>

      {open && (
        <div className="dp-popup">
          <div className="dp-header">
            <button type="button" className="dp-nav" onClick={prevMonth}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="dp-title">{viewYear}년 {MONTHS[viewMonth]}</span>
            <button type="button" className="dp-nav" onClick={nextMonth}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          <div className="dp-grid">
            {DAYS.map((d, i) => (
              <div key={d} className={`dp-dow ${i===0?'sun':i===6?'sat':''}`}>{d}</div>
            ))}
            {getDays().map((day, i) => {
              const dateStr = day ? `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : ''
              const disabled = !day || dateStr < min
              const price = showPrices && day && !disabled ? mockPrice(dateStr) : null
              return (
                <button
                  key={i}
                  type="button"
                  className={`${cellClass(day)}${showPrices ? ' has-price' : ''}`}
                  onClick={() => day && selectDay(day)}
                  disabled={disabled}
                >
                  <span className="dp-day-num">{day ?? ''}</span>
                  {price !== null && <span className="dp-price">{fmtPrice(price)}</span>}
                </button>
              )
            })}
          </div>

          <div className="dp-footer">
            <button type="button" className="dp-today-btn" onClick={() => { const t = today; onChange(t); const d = parseYMD(t); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setOpen(false) }}>오늘</button>
          </div>
        </div>
      )}
    </div>
  )
}
