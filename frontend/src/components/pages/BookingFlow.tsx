import { useState, useEffect } from 'react'
import './BookingFlow.css'
import type { BookingFlight } from '../../types'
import { createBooking } from '../../services/bookings'
import type { User } from '../../services/auth'
import { api } from '../../services/api'
import { useToast } from '../common/ToastProvider'

interface Props {
  flight: BookingFlight
  user: User | null
  onGoReservations: () => void
  onGoHome: () => void
  onGoLogin: () => void
  onGoNextrip: () => void
}

interface PassengerInfo {
  lastNameEn: string; firstNameEn: string
  birth: string; nationality: string
  passportNo: string; passportExpiry: string
  email: string; phone: string
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

const STEPS = ['승객 정보', '좌석 선택', '결제', '예약 완료']
const COLS = ['A', 'B', 'C', '', 'D', 'E', 'F']

const EMERGENCY_ROWS = [15, 16]
const PREFERRED_ROWS_ECO = [1, 2, 3, 4, 5]
const PREFERRED_WINDOW_ROWS_ECO = [6, 7, 8, 9, 10]
const PREFERRED_ROWS_BIZ = [1, 2, 3]

type SeatType = 'standard' | 'preferred' | 'emergency'

function getSeatType(row: number, col: string, fareClass: string): SeatType {
  if (fareClass === 'economy') {
    if (EMERGENCY_ROWS.includes(row)) return 'emergency'
    if (PREFERRED_ROWS_ECO.includes(row)) return 'preferred'
    if (PREFERRED_WINDOW_ROWS_ECO.includes(row) && (col === 'A' || col === 'F')) return 'preferred'
  } else {
    if (PREFERRED_ROWS_BIZ.includes(row) && (col === 'A' || col === 'F')) return 'preferred'
  }
  return 'standard'
}

const SEAT_SURCHARGE: Record<SeatType, number> = {
  standard: 0,
  preferred: 15000,
  emergency: 10000,
}
const PAY_METHODS = [
  { id: 'card',  label: '신용 / 체크카드' },
  { id: 'kakao', label: '카카오페이'       },
  { id: 'naver', label: '네이버페이'       },
  { id: 'toss',  label: '토스페이'         },
]

function blankPassenger(email = ''): PassengerInfo {
  return {
    lastNameEn: '', firstNameEn: '',
    birth: '', nationality: '대한민국',
    passportNo: '', passportExpiry: '',
    email, phone: '',
  }
}

function getPassengerErrors(p: PassengerInfo): Record<string, string> {
  const e: Record<string, string> = {}
  if (!p.lastNameEn) e.lastNameEn = '성을 입력해 주세요.'
  else if (!/^[A-Z]+$/.test(p.lastNameEn)) e.lastNameEn = '영문 대문자만 입력 가능합니다.'
  if (!p.firstNameEn) e.firstNameEn = '이름을 입력해 주세요.'
  else if (!/^[A-Z]+$/.test(p.firstNameEn)) e.firstNameEn = '영문 대문자만 입력 가능합니다.'
  if (!p.birth) e.birth = '생년월일을 입력해 주세요.'
  if (!p.passportNo) e.passportNo = '여권 번호를 입력해 주세요.'
  else if (!/^[A-Z][0-9]{8}$/.test(p.passportNo)) e.passportNo = '형식이 올바르지 않습니다. (예: M12345678)'
  if (p.passportExpiry && new Date(p.passportExpiry) <= new Date()) e.passportExpiry = '만료된 여권입니다.'
  if (!p.email) e.email = '이메일을 입력해 주세요.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) e.email = '유효한 이메일 형식이 아닙니다.'
  if (!p.phone) e.phone = '연락처를 입력해 주세요.'
  else if (!/^01[0-9]-\d{3,4}-\d{4}$/.test(p.phone)) e.phone = '형식이 올바르지 않습니다. (예: 010-1234-5678)'
  return e
}

export default function BookingFlow({ flight, user, onGoReservations, onGoHome, onGoLogin, onGoNextrip }: Props) {
  const { toast } = useToast()
  const paxCount = flight.passengerCount ?? 1

  const [step, setStep] = useState(1)
  const [showGuestModal, setShowGuestModal] = useState(!user)
  const [continueAsGuest, setContinueAsGuest] = useState(false)

  const savedPax = (() => { try { return JSON.parse(localStorage.getItem('savedPassenger') ?? '') } catch { return null } })()
  const [passengers, setPassengers] = useState<PassengerInfo[]>(() =>
    Array.from({ length: paxCount }, (_, i) =>
      i === 0 && savedPax ? savedPax : blankPassenger(i === 0 ? (user?.email ?? '') : '')
    )
  )
  const [activePaxIdx, setActivePaxIdx] = useState(0)
  const [showLoadBanner, setShowLoadBanner] = useState(!!savedPax)
  const [touched, setTouched] = useState<Record<string, boolean>[]>(() => Array.from({ length: paxCount }, () => ({})))
  const [terms, setTerms] = useState({ transport: false, privacy: false, thirdParty: false, marketing: false })

  // Seats: [paxIdx] → seat string | null
  const [seats, setSeats] = useState<(string | null)[]>(() => Array(paxCount).fill(null))
  const [seatSurcharges, setSeatSurcharges] = useState<number[]>(() => Array(paxCount).fill(0))
  const [returnSeats, setReturnSeats] = useState<(string | null)[]>(() => Array(paxCount).fill(null))
  const [returnSeatSurcharges, setReturnSeatSurcharges] = useState<number[]>(() => Array(paxCount).fill(0))
  const [activeSeatPaxIdx, setActiveSeatPaxIdx] = useState(0)
  const [seatTab, setSeatTab] = useState<'outbound' | 'return'>('outbound')

  const [payMethod, setPayMethod] = useState('card')
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', holder: '' })
  const [payLoading, setPayLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [allBookingRefs, setAllBookingRefs] = useState<string[]>([])
  const [allReturnBookingRefs, setAllReturnBookingRefs] = useState<string[]>([])
  const [totalMilesEarned, setTotalMilesEarned] = useState(0)

  const totalRows = flight.fareClass === 'economy' ? 30 : 8
  const [occupied, setOccupied] = useState<string[]>([])
  const [returnOccupied, setReturnOccupied] = useState<string[]>([])

  useEffect(() => {
    api.get<{ occupied: string[] }>(`/flights/${flight.flightId}/seats?fare_class=${flight.fareClass}`)
      .then(r => setOccupied(r.occupied))
      .catch(() => setOccupied([]))
  }, [flight.flightId, flight.fareClass])

  useEffect(() => {
    if (!flight.returnFlight) return
    api.get<{ occupied: string[] }>(`/flights/${flight.returnFlight.flightId}/seats?fare_class=${flight.fareClass}`)
      .then(r => setReturnOccupied(r.occupied))
      .catch(() => setReturnOccupied([]))
  }, [flight.returnFlight, flight.fareClass])

  function updatePassenger(paxIdx: number, field: string, val: string) {
    setPassengers(prev => prev.map((p, i) => i === paxIdx ? { ...p, [field]: val } : p))
  }
  function touchField(paxIdx: number, field: string) {
    setTouched(prev => prev.map((t, i) => i === paxIdx ? { ...t, [field]: true } : t))
  }

  const allPaxErrors = passengers.map(p => getPassengerErrors(p))
  const requiredTerms = terms.transport && terms.privacy && terms.thirdParty
  const allTerms = requiredTerms && terms.marketing
  function toggleAllTerms() {
    const next = !allTerms
    setTerms({ transport: next, privacy: next, thirdParty: next, marketing: next })
  }

  const step1Valid = allPaxErrors.every(e => Object.keys(e).length === 0) && requiredTerms
  const step2Valid = seats.every(s => s !== null) && (flight.returnFlight ? returnSeats.every(s => s !== null) : true)

  const totalSeatSurcharge = seatSurcharges.reduce((a, b) => a + b, 0)
  const totalReturnSeatSurcharge = returnSeatSurcharges.reduce((a, b) => a + b, 0)
  const totalPrice = flight.price * paxCount + totalSeatSurcharge +
    (flight.returnFlight ? flight.returnFlight.price * paxCount + totalReturnSeatSurcharge : 0)

  async function handlePay() {
    if (payLoading) return
    setPayLoading(true)
    setApiError('')
    try {
      const refs: string[] = []
      const retRefs: string[] = []
      let milesSum = 0

      for (let i = 0; i < paxCount; i++) {
        const p = passengers[i]
        const paxPayload = {
          fare_class: flight.fareClass,
          passenger_name_ko: `${p.firstNameEn} ${p.lastNameEn}`,
          passenger_last_name_en: p.lastNameEn,
          passport_no: p.passportNo,
          email: p.email,
          phone: p.phone,
        }
        const result = await createBooking({
          flight_id: flight.flightId,
          seat_number: seats[i] ?? undefined,
          seat_surcharge: seatSurcharges[i],
          ...paxPayload,
        })
        refs.push(result.booking_ref)
        milesSum += result.miles_earned

        if (flight.returnFlight) {
          const ret = await createBooking({
            flight_id: flight.returnFlight.flightId,
            seat_number: returnSeats[i] ?? undefined,
            seat_surcharge: returnSeatSurcharges[i],
            ...paxPayload,
          })
          retRefs.push(ret.booking_ref)
          milesSum += ret.miles_earned
        }
      }

      localStorage.setItem('savedPassenger', JSON.stringify(passengers[0]))
      setAllBookingRefs(refs)
      setAllReturnBookingRefs(retRefs)
      setTotalMilesEarned(milesSum)
      toast('예약이 완료되었습니다!', 'success')
      setStep(4)
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : '결제 처리 중 오류가 발생했습니다.')
    } finally {
      setPayLoading(false)
    }
  }

  // ── 비회원 선택 모달 ──────────────────────────────────────────
  if (showGuestModal && !continueAsGuest) {
    return (
      <main className="bf-page">
        <div className="guest-modal-overlay">
          <div className="guest-modal">
            <div className="guest-modal-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h2 className="guest-modal-title">예약을 진행하시겠습니까?</h2>
            <p className="guest-modal-desc">로그인하면 마일리지 적립 및 예약 관리가 가능합니다.</p>
            <div className="guest-modal-btns">
              <button className="guest-btn-login" onClick={onGoLogin}>회원 로그인</button>
              <button className="guest-btn-continue" onClick={() => { setContinueAsGuest(true); setShowGuestModal(false) }}>비회원으로 예약</button>
            </div>
            <button className="guest-modal-back" onClick={onGoHome}>← 돌아가기</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="bf-page">
      {/* 상단 항공편 요약 */}
      <div className="bf-topbar">
        <div className="bf-topbar-inner">
          <div className="bf-flight-summary">
            <div className="cw-badge-sm">CW</div>
            <span className="bf-flight-no">{flight.flightNo}</span>
            <span className="bf-route">{flight.from.city} ({flight.from.code}) → {flight.to.city} ({flight.to.code})</span>
            {flight.to.country && <span className="bf-country-tag">{flight.to.country}</span>}
            <span className="bf-date">{flight.date}</span>
            <span className="bf-fare-tag">{flight.fareClass === 'economy' ? '일반석' : '비즈니스석'}</span>
            {paxCount > 1 && <span className="bf-fare-tag" style={{ background: '#059669' }}>{paxCount}명</span>}
          </div>
          <span className="bf-price">₩{totalPrice.toLocaleString()}</span>
        </div>
      </div>

      {/* 스테퍼 */}
      <div className="bf-stepper-wrap">
        <div className="bf-stepper">
          {STEPS.map((label, i) => {
            const num = i + 1
            const done = step > num
            const active = step === num
            return (
              <div key={i} className="bf-step-item">
                <div className={`bf-step-circle ${done ? 'done' : active ? 'active' : ''}`}>
                  {done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> : num}
                </div>
                <span className={`bf-step-label ${active ? 'active' : ''}`}>{label}</span>
                {i < STEPS.length - 1 && <div className={`bf-step-line ${done ? 'done' : ''}`} />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bf-content">

        {/* ── STEP 1: 승객 정보 ── */}
        {step === 1 && (
          <>
            <div className="booking-info-card">
              <div className="bi-route-row">
                <div className="bi-point">
                  <span className="bi-code">{flight.from.code}</span>
                  <span className="bi-city">{flight.from.city}</span>
                  {flight.from.country && <span className="bi-country">{flight.from.country}</span>}
                  <span className="bi-airport">{flight.from.airport}</span>
                </div>
                <div className="bi-center">
                  <span className="bi-duration">{flight.duration}</span>
                  <div className="bi-line">
                    <div className="bi-dot" /><div className="bi-dash" />
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/>
                    </svg>
                    <div className="bi-dash" /><div className="bi-dot" />
                  </div>
                  <span className="bi-direct">직항</span>
                </div>
                <div className="bi-point right">
                  <span className="bi-code">{flight.to.code}</span>
                  <span className="bi-city">{flight.to.city}</span>
                  {flight.to.country && <span className="bi-country">{flight.to.country}</span>}
                  <span className="bi-airport">{flight.to.airport}</span>
                </div>
              </div>
              <div className="bi-divider" />
              <div className="bi-details">
                <div className="bi-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/></svg>
                  <div><span>편명</span><strong>CLEARWAY {flight.flightNo}</strong></div>
                </div>
                <div className="bi-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <div><span>날짜 / 시간</span><strong>{flight.date} · {flight.departTime} → {flight.arrivalTime}</strong></div>
                </div>
                <div className="bi-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><path d="M8 7V5a2 2 0 0 0-4 0v2"/></svg>
                  <div><span>수하물</span><strong>위탁 {flight.fareClass === 'economy' ? '23kg × 1개' : '32kg × 2개'} · 기내 10kg</strong></div>
                </div>
                <div className="bi-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <div><span>좌석 등급</span><strong>{flight.fareClass === 'economy' ? '일반석 (Economy)' : '비즈니스석 (Business)'}</strong></div>
                </div>
              </div>
              {!user && (
                <div className="bi-guest-notice">⚠ 비회원 예약입니다. 마일리지가 적립되지 않습니다.</div>
              )}
            </div>

            {/* 승객 탭 */}
            {paxCount > 1 && (
              <div className="pax-tab-bar">
                {Array.from({ length: paxCount }, (_, i) => (
                  <button
                    key={i}
                    className={`pax-tab-btn ${activePaxIdx === i ? 'active' : ''} ${Object.keys(allPaxErrors[i]).length === 0 && (passengers[i].lastNameEn || passengers[i].firstNameEn) ? 'done' : ''}`}
                    onClick={() => setActivePaxIdx(i)}
                  >
                    승객 {i + 1}
                    {Object.keys(allPaxErrors[i]).length === 0 && passengers[i].lastNameEn && (
                      <span className="pax-tab-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="bf-card">
              <h2 className="bf-card-title">
                {paxCount > 1 ? `승객 ${activePaxIdx + 1} 정보 입력` : '승객 정보 입력'}
              </h2>
              <p className="bf-card-sub">여권에 기재된 영문 이름을 정확히 입력해 주세요.</p>
              {showLoadBanner && savedPax && activePaxIdx === 0 && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'10px 14px', marginBottom:'16px', fontSize:'13px', color:'#1d4ed8' }}>
                  <span>이전에 저장된 승객 정보가 있습니다.</span>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button type="button" style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:'7px', padding:'5px 12px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}
                      onClick={() => { setPassengers(prev => prev.map((p, i) => i === 0 ? savedPax : p)); setShowLoadBanner(false) }}>불러오기</button>
                    <button type="button" style={{ background:'none', color:'#64748b', border:'none', fontSize:'12px', cursor:'pointer' }}
                      onClick={() => setShowLoadBanner(false)}>✕</button>
                  </div>
                </div>
              )}
              <div className="bf-form-grid">
                {[
                  { key: 'lastNameEn',     label: '영문 성 (Last Name)',    placeholder: 'KIM',           type: 'text'  },
                  { key: 'firstNameEn',    label: '영문 이름 (First Name)',  placeholder: 'JUNYOUNG',      type: 'text'  },
                  { key: 'birth',          label: '생년월일',               placeholder: '',              type: 'date'  },
                  { key: 'passportNo',     label: '여권 번호',              placeholder: 'M12345678',     type: 'text'  },
                  { key: 'passportExpiry', label: '여권 만료일',            placeholder: '',              type: 'date'  },
                  { key: 'email',          label: '이메일',                 placeholder: 'example@email.com', type: 'email' },
                  { key: 'phone',          label: '연락처',                 placeholder: '010-1234-5678', type: 'tel'   },
                ].map(({ key, label, placeholder, type }) => {
                  const p = passengers[activePaxIdx]
                  const t = touched[activePaxIdx]
                  const errs = allPaxErrors[activePaxIdx]
                  return (
                    <div key={key} className={`bf-field ${key === 'email' || key === 'phone' ? 'full' : ''} ${t[key] && errs[key] ? 'error' : t[key] ? 'valid' : ''}`}>
                      <label>{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={p[key as keyof PassengerInfo]}
                        onChange={e => {
                          const val = key === 'phone' ? formatPhone(e.target.value)
                            : key.endsWith('En') || key === 'passportNo' ? e.target.value.toUpperCase()
                            : e.target.value
                          updatePassenger(activePaxIdx, key, val)
                        }}
                        onBlur={() => touchField(activePaxIdx, key)}
                      />
                      {t[key] && errs[key] && <span className="field-error">{errs[key]}</span>}
                    </div>
                  )
                })}
                <div className="bf-field">
                  <label>국적</label>
                  <select value={passengers[activePaxIdx].nationality} onChange={e => updatePassenger(activePaxIdx, 'nationality', e.target.value)}>
                    <option>대한민국</option><option>미국</option><option>일본</option><option>중국</option><option>기타</option>
                  </select>
                </div>
              </div>

              {activePaxIdx === paxCount - 1 && (
                <div className="terms-wrap">
                  <label className="terms-all">
                    <input type="checkbox" checked={allTerms} onChange={toggleAllTerms} />
                    <span>전체 동의</span>
                  </label>
                  <div className="terms-divider" />
                  {[
                    { key: 'transport',  label: '항공운송약관 동의',         required: true  },
                    { key: 'privacy',    label: '개인정보 수집 · 이용 동의',  required: true  },
                    { key: 'thirdParty', label: '개인정보 제3자 제공 동의',   required: true  },
                    { key: 'marketing',  label: '마케팅 정보 수신 동의',      required: false },
                  ].map(({ key, label, required }) => (
                    <div key={key} className="terms-row">
                      <label className="terms-item">
                        <input type="checkbox" checked={terms[key as keyof typeof terms]} onChange={e => setTerms(t => ({ ...t, [key]: e.target.checked }))} />
                        <span>{label}<em className={required ? 'required' : 'optional'}>{required ? '필수' : '선택'}</em></span>
                      </label>
                      <button className="terms-view-btn" type="button">보기</button>
                    </div>
                  ))}
                </div>
              )}

              {paxCount > 1 && activePaxIdx < paxCount - 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button
                    className="bf-nav-btn next"
                    disabled={Object.keys(allPaxErrors[activePaxIdx]).length > 0}
                    onClick={() => setActivePaxIdx(i => i + 1)}
                    style={{ width: 'auto', padding: '10px 24px' }}
                  >
                    다음 승객 →
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── STEP 2: 좌석 선택 ── */}
        {step === 2 && (
          <div className="bf-card">
            <h2 className="bf-card-title">좌석 선택</h2>

            {/* 승객 탭 */}
            {paxCount > 1 && (
              <div className="pax-tab-bar">
                {Array.from({ length: paxCount }, (_, i) => {
                  const hasSeat = seatTab === 'outbound' ? seats[i] !== null : returnSeats[i] !== null
                  return (
                    <button
                      key={i}
                      className={`pax-tab-btn ${activeSeatPaxIdx === i ? 'active' : ''} ${hasSeat ? 'done' : ''}`}
                      onClick={() => setActiveSeatPaxIdx(i)}
                    >
                      승객 {i + 1}
                      {hasSeat && <span className="pax-tab-check">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {flight.returnFlight ? (
              <>
                <div className="seat-substep-bar">
                  <div className={`seat-substep ${seats.every(s => s) ? 'done' : seatTab === 'outbound' ? 'active' : ''}`}>
                    <span className="seat-substep-num">{seats.every(s => s) ? '✓' : '1'}</span>
                    <div className="seat-substep-text">
                      <span className="seat-substep-label">가는편 좌석</span>
                      {seats.every(s => s) && <span className="seat-substep-val">{seats.join(', ')}</span>}
                    </div>
                  </div>
                  <div className={`seat-substep-line ${seats.every(s => s) ? 'done' : ''}`} />
                  <div className={`seat-substep ${returnSeats.every(s => s) ? 'done' : seats.every(s => s) && seatTab === 'return' ? 'active' : ''}`}>
                    <span className="seat-substep-num">{returnSeats.every(s => s) ? '✓' : '2'}</span>
                    <div className="seat-substep-text">
                      <span className="seat-substep-label">오는편 좌석</span>
                      {returnSeats.every(s => s) && <span className="seat-substep-val">{returnSeats.join(', ')}</span>}
                    </div>
                  </div>
                  <div className={`seat-substep-line ${returnSeats.every(s => s) ? 'done' : ''}`} />
                  <div className="seat-substep">
                    <span className="seat-substep-num">3</span>
                    <div className="seat-substep-text"><span className="seat-substep-label">결제</span></div>
                  </div>
                </div>

                <div className="seat-tab-toggle">
                  <button
                    className={seatTab === 'outbound' ? 'active' : ''}
                    onClick={() => setSeatTab('outbound')}
                  >
                    가는 편 {flight.from.city} → {flight.to.city}
                    {seats.some(s => s) && <span className="seat-tab-badge">{seats.filter(Boolean).join(', ')}</span>}
                  </button>
                  <button
                    className={seatTab === 'return' ? 'active' : ''}
                    onClick={() => setSeatTab('return')}
                  >
                    오는 편 {flight.to.city} → {flight.from.city}
                    {returnSeats.some(s => s) && <span className="seat-tab-badge">{returnSeats.filter(Boolean).join(', ')}</span>}
                  </button>
                </div>
              </>
            ) : (
              <p className="bf-card-sub">{flight.fareClass === 'economy' ? '일반석 (Economy)' : '비즈니스석 (Business)'} · {flight.from.code} → {flight.to.code}</p>
            )}

            {(() => {
              const isReturn = seatTab === 'return' && !!flight.returnFlight
              const baseOccupied = isReturn ? returnOccupied : occupied
              const curSeatsArr = isReturn ? returnSeats : seats
              const otherPaxSeats = curSeatsArr.filter((s, i) => i !== activeSeatPaxIdx && s !== null) as string[]
              const curOccupied = [...baseOccupied, ...otherPaxSeats]
              const curSeat = curSeatsArr[activeSeatPaxIdx]

              function handleSeatClick(seatId: string, type: SeatType) {
                const surcharge = SEAT_SURCHARGE[type]
                if (isReturn) {
                  const isDeselect = returnSeats[activeSeatPaxIdx] === seatId
                  setReturnSeats(prev => {
                    const next = [...prev]
                    next[activeSeatPaxIdx] = isDeselect ? null : seatId
                    return next
                  })
                  setReturnSeatSurcharges(prev => {
                    const next = [...prev]
                    next[activeSeatPaxIdx] = isDeselect ? 0 : surcharge
                    return next
                  })
                  if (!isDeselect && activeSeatPaxIdx < paxCount - 1) {
                    setTimeout(() => setActiveSeatPaxIdx(i => i + 1), 300)
                  }
                } else {
                  const isDeselect = seats[activeSeatPaxIdx] === seatId
                  setSeats(prev => {
                    const next = [...prev]
                    next[activeSeatPaxIdx] = isDeselect ? null : seatId
                    return next
                  })
                  setSeatSurcharges(prev => {
                    const next = [...prev]
                    next[activeSeatPaxIdx] = isDeselect ? 0 : surcharge
                    return next
                  })
                  if (!isDeselect && activeSeatPaxIdx < paxCount - 1) {
                    setTimeout(() => setActiveSeatPaxIdx(i => i + 1), 300)
                  } else if (!isDeselect && flight.returnFlight) {
                    setTimeout(() => { setSeatTab('return'); setActiveSeatPaxIdx(0) }, 350)
                  }
                }
              }

              const curSurcharge = isReturn ? returnSeatSurcharges[activeSeatPaxIdx] : seatSurcharges[activeSeatPaxIdx]

              return (
                <>
                  <div className="seat-legend">
                    <span><i className="leg available" />일반석 (+₩0)</span>
                    <span><i className="leg preferred" />선호좌석 (+₩15,000)</span>
                    <span><i className="leg emergency" />비상구 (+₩10,000)</span>
                    <span><i className="leg occupied" />사용 불가</span>
                    <span><i className="leg my-seat" />선택됨</span>
                  </div>
                  <div className="bf-seat-map">
                    <div className="seat-header-row">
                      {COLS.map((c, i) => <div key={i} className={`seat-hcell ${c === '' ? 'aisle' : ''}`}>{c}</div>)}
                    </div>
                    {Array.from({ length: totalRows }, (_, r) => (
                      <div key={r} className="seat-row">
                        <span className="seat-rnum">{r + 1}</span>
                        {COLS.map((col, ci) => {
                          if (col === '') return <div key={ci} className="seat-aisle" />
                          const seatId = `${r + 1}${col}`
                          const isOccupied = curOccupied.includes(seatId)
                          const isSelected = curSeat === seatId
                          const isOtherPax = otherPaxSeats.includes(seatId)
                          const sType = getSeatType(r + 1, col, flight.fareClass)
                          const baseClass = isOccupied ? 'occupied' : isSelected ? 'my-seat' : isOtherPax ? 'occupied' : `available ${sType}`
                          return (
                            <button
                              key={ci}
                              disabled={isOccupied}
                              className={`bf-seat ${baseClass}`}
                              title={isOtherPax ? '다른 승객이 선택한 좌석' : undefined}
                              onClick={() => handleSeatClick(seatId, sType)}
                            >
                              {r + 1}{col}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  {curSeat && (
                    <div className="seat-selected-notice">
                      {paxCount > 1 && <span>승객 {activeSeatPaxIdx + 1} · </span>}
                      선택된 좌석: <strong>{curSeat}</strong>
                      {curSurcharge > 0 && (
                        <span className="seat-surcharge-tag">
                          {getSeatType(parseInt(curSeat), curSeat.slice(-1), flight.fareClass) === 'preferred' ? '선호좌석' : '비상구'}
                          {' '}+₩{curSurcharge.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* ── STEP 3: 결제 ── */}
        {step === 3 && (
          <div className="bf-step3-layout">
            <div className="bf-card pay-card">
              <h2 className="bf-card-title">결제 수단</h2>
              <div className="pay-methods">
                {PAY_METHODS.map(m => (
                  <button key={m.id} className={`pay-method-btn ${payMethod === m.id ? 'active' : ''}`} onClick={() => setPayMethod(m.id)}>{m.label}</button>
                ))}
              </div>
              {payMethod === 'card' && (
                <>
                  <div className="credit-card-visual">
                    <div className="cc-top">
                      <div className="cc-chip" />
                      <span className="cc-brand">CLEARWAY CARD</span>
                    </div>
                    <p className="cc-number">{(card.number || '•••• •••• •••• ••••').replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19).padEnd(19, '•')}</p>
                    <div className="cc-bottom">
                      <div><span className="cc-label">CARD HOLDER</span><span className="cc-value">{card.holder || '이름 없음'}</span></div>
                      <div><span className="cc-label">EXPIRES</span><span className="cc-value">{card.expiry || 'MM/YY'}</span></div>
                    </div>
                  </div>
                  <div className="bf-form-grid">
                    <div className="bf-field full"><label>카드 번호</label><input placeholder="0000 0000 0000 0000" maxLength={16} value={card.number} onChange={e => setCard(c => ({ ...c, number: e.target.value.replace(/\D/g, '') }))} /></div>
                    <div className="bf-field"><label>유효 기간</label><input placeholder="MM/YY" maxLength={5} value={card.expiry} onChange={e => { let v = e.target.value.replace(/\D/g, ''); if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2, 4); setCard(c => ({ ...c, expiry: v })) }} /></div>
                    <div className="bf-field"><label>CVV</label><input placeholder="000" maxLength={3} type="password" value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '') }))} /></div>
                    <div className="bf-field full"><label>카드 소유자 이름</label><input placeholder="HONG GILDONG" value={card.holder} onChange={e => setCard(c => ({ ...c, holder: e.target.value.toUpperCase() }))} /></div>
                  </div>
                </>
              )}
              {payMethod !== 'card' && (
                <div className="pay-simple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  <p>{PAY_METHODS.find(m => m.id === payMethod)?.label}으로 결제합니다.</p>
                  <span>다음 단계에서 앱이 실행됩니다.</span>
                </div>
              )}
              {apiError && <p style={{ color: '#ef4444', marginTop: 12, fontSize: 14 }}>{apiError}</p>}
            </div>

            <div className="bf-card order-summary">
              <h3>주문 요약</h3>
              <div className="summary-flight">
                <div className="cw-badge-sm">CW</div>
                <div>
                  <p className="summary-flight-no">{flight.flightNo}{flight.returnFlight ? ' (가는 편)' : ''}</p>
                  <p className="summary-route">{flight.from.city} ({flight.from.code}) → {flight.to.city} ({flight.to.code})</p>
                </div>
              </div>
              <div className="summary-rows">
                <div className="summary-row"><span>날짜</span><strong>{flight.date}</strong></div>
                <div className="summary-row"><span>출발</span><strong>{flight.departTime}</strong></div>
                <div className="summary-row"><span>승객 수</span><strong>{paxCount}명</strong></div>
                {passengers.map((_, i) => (
                  <div key={i} className="summary-row"><span>승객 {i + 1} 좌석</span><strong>{seats[i] ?? '미선택'}</strong></div>
                ))}
              </div>

              {flight.returnFlight && (
                <>
                  <div className="summary-flight" style={{ marginTop: 10 }}>
                    <div className="cw-badge-sm">CW</div>
                    <div>
                      <p className="summary-flight-no">{flight.returnFlight.flightNo} (오는 편)</p>
                      <p className="summary-route">{flight.returnFlight.from.city} ({flight.returnFlight.from.code}) → {flight.returnFlight.to.city} ({flight.returnFlight.to.code})</p>
                    </div>
                  </div>
                  <div className="summary-rows">
                    <div className="summary-row"><span>날짜</span><strong>{flight.returnFlight.date}</strong></div>
                    <div className="summary-row"><span>출발</span><strong>{flight.returnFlight.departTime}</strong></div>
                    {passengers.map((_, i) => (
                      <div key={i} className="summary-row"><span>승객 {i + 1} 좌석</span><strong>{returnSeats[i] ?? '미선택'}</strong></div>
                    ))}
                  </div>
                </>
              )}

              <div className="summary-rows" style={{ marginTop: 8 }}>
                <div className="summary-row"><span>등급</span><strong>{flight.fareClass === 'economy' ? '일반석' : '비즈니스석'}</strong></div>
                <div className="summary-row"><span>항공권 ({paxCount}명)</span><strong>₩{(flight.price * paxCount + (flight.returnFlight?.price ?? 0) * paxCount).toLocaleString()}</strong></div>
                {totalSeatSurcharge > 0 && <div className="summary-row"><span>좌석 추가금 (가는편)</span><strong>+₩{totalSeatSurcharge.toLocaleString()}</strong></div>}
                {totalReturnSeatSurcharge > 0 && <div className="summary-row"><span>좌석 추가금 (오는편)</span><strong>+₩{totalReturnSeatSurcharge.toLocaleString()}</strong></div>}
                {user && <div className="summary-row miles"><span>예상 마일리지</span><strong>+{Math.round(totalPrice * (flight.fareClass === 'economy' ? 0.04 : 0.08)).toLocaleString()}마일</strong></div>}
              </div>
              <div className="summary-total">
                <span>최종 결제금액</span>
                <strong>₩{totalPrice.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: 예약 완료 ── */}
        {step === 4 && (
          <div className="bf-card confirm-card">
            <div className="confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2>예약이 완료되었습니다!</h2>
            <p className="confirm-sub">예약 확인 이메일이 발송됩니다.</p>

            {allBookingRefs.map((ref, i) => (
              <div key={i} className="booking-ref-box" style={i > 0 ? { marginTop: 8 } : {}}>
                <span className="ref-label">
                  {paxCount > 1 ? `승객 ${i + 1} ` : ''}
                  {flight.returnFlight ? '가는 편 예약번호' : '예약 번호'}
                </span>
                <span className="ref-value">{ref}</span>
              </div>
            ))}
            {flight.returnFlight && allReturnBookingRefs.map((ref, i) => (
              <div key={i} className="booking-ref-box" style={{ marginTop: 8 }}>
                <span className="ref-label">{paxCount > 1 ? `승객 ${i + 1} ` : ''}오는 편 예약번호</span>
                <span className="ref-value">{ref}</span>
              </div>
            ))}

            {user && totalMilesEarned > 0 && (
              <div className="miles-earned-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/></svg>
                <span>마일리지 <strong>+{totalMilesEarned.toLocaleString()}</strong> 마일 적립!</span>
              </div>
            )}
            <div className="confirm-summary">
              <div className="confirm-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/></svg><span>{flight.flightNo} · {flight.from.code} → {flight.to.code}</span></div>
              <div className="confirm-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>{flight.date} · {flight.departTime} 출발</span></div>
              <div className="confirm-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>{paxCount}명 · {passengers.map(p => `${p.lastNameEn} ${p.firstNameEn}`).join(', ')}</span></div>
              <div className="confirm-row price"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>₩{totalPrice.toLocaleString()} 결제 완료</span></div>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn secondary" onClick={onGoHome}>홈으로</button>
              <button className="confirm-btn primary" onClick={onGoReservations}>내 예약 확인</button>
            </div>

            <button className="nextrip-ad-banner" onClick={onGoNextrip}>
              <div className="nextrip-ad-glow" />
              <div className="nextrip-ad-left">
                <span className="nextrip-ad-label">✦ NEXTRIP</span>
                <p className="nextrip-ad-title">여행 일정, 이제 AI가 대신 짜드립니다</p>
                <p className="nextrip-ad-desc">
                  목적지·기간·취향만 알려주면 숙소·식당·코스까지<br />
                  나만을 위한 여행 플랜을 세세하게 완성해 드려요.
                </p>
                <span className="nextrip-ad-cta">내 맞춤 여행 시작하기 →</span>
              </div>
              <div className="nextrip-ad-right">
                <div className="nextrip-ad-card">
                  <span className="nextrip-ad-card-day">DAY 1</span>
                  <span className="nextrip-ad-card-item">✈ 도착 · 공항 픽업</span>
                  <span className="nextrip-ad-card-item">🏨 호텔 체크인</span>
                  <span className="nextrip-ad-card-item">🍜 현지 맛집 디너</span>
                </div>
                <div className="nextrip-ad-card nextrip-ad-card-2">
                  <span className="nextrip-ad-card-day">DAY 2</span>
                  <span className="nextrip-ad-card-item">🗺 시내 관광 코스</span>
                  <span className="nextrip-ad-card-item">🎭 문화 체험</span>
                  <span className="nextrip-ad-card-item">🌅 야경 스팟</span>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* 이전 / 다음 네비 */}
        {step < 4 && (
          <div className="bf-nav">
            {step > 1
              ? <button className="bf-nav-btn prev" onClick={() => setStep(s => s - 1)}>← 이전</button>
              : <div />
            }
            <button
              className="bf-nav-btn next"
              disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : payLoading}
              onClick={step === 3 ? handlePay : () => setStep(s => s + 1)}
            >
              {step === 3 ? (payLoading ? '처리 중...' : '결제 완료') : '다음 →'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
