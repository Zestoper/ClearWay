import { useState, useEffect } from 'react'
import './MyReservations.css'
import { fetchMyBookings, cancelBooking, lookupBooking, claimBooking } from '../../services/bookings'
import type { BookingRecord } from '../../services/bookings'
import { useToast } from '../common/ToastProvider'

interface Props {
  isLoggedIn: boolean
  onGoLogin: () => void
  onCancelSuccess?: () => void
  initialRef?: string
  initialLastName?: string
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  confirmed:  { text: '예약 확정',   cls: 'confirmed' },
  checked_in: { text: '체크인 완료', cls: 'checkin'   },
  completed:  { text: '탑승 완료',   cls: 'completed' },
  cancelled:  { text: '취소됨',      cls: 'completed' },
}

type Tab = 'all' | 'upcoming' | 'completed'

export default function MyReservations({ isLoggedIn, onGoLogin, onCancelSuccess, initialRef, initialLastName }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('all')
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<BookingRecord | null>(null)
  const [cancelTarget, setCancelTarget] = useState<BookingRecord | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelResult, setCancelResult] = useState<{ refundAmount: number; refundRate: number } | null>(null)

  // 비회원 조회
  const [guestRef, setGuestRef] = useState(initialRef ?? '')
  const [guestLastName, setGuestLastName] = useState(initialLastName ?? '')
  const [guestResult, setGuestResult] = useState<BookingRecord | null>(null)
  const [guestLoading, setGuestLoading] = useState(false)
  const [guestError, setGuestError] = useState('')

  // 회원: 비회원 예약 가져오기
  const [claimRef, setClaimRef] = useState(isLoggedIn ? (initialRef ?? '') : '')
  const [claimLastName, setClaimLastName] = useState(isLoggedIn ? (initialLastName ?? '') : '')
  const [claimLoading, setClaimLoading] = useState(false)
  const [claimMsg, setClaimMsg] = useState('')

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false)
      if (initialRef?.trim() && initialLastName?.trim()) {
        handleGuestLookup()
      }
      return
    }
    fetchMyBookings()
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setLoading(false))
  }, [isLoggedIn]) // eslint-disable-line

  async function handleGuestLookup() {
    if (!guestRef.trim() || !guestLastName.trim()) return
    setGuestLoading(true); setGuestError(''); setGuestResult(null)
    try {
      const r = await lookupBooking(guestRef.trim(), guestLastName.trim())
      setGuestResult(r)
    } catch {
      setGuestError('예약을 찾을 수 없습니다. 예약번호와 영문 성을 확인해주세요.')
    } finally { setGuestLoading(false) }
  }

  async function handleClaim() {
    if (!claimRef.trim() || !claimLastName.trim()) return
    setClaimLoading(true); setClaimMsg('')
    try {
      const r = await claimBooking(claimRef.trim(), claimLastName.trim())
      setBookings(prev => prev.some(b => b.booking_ref === r.booking_ref) ? prev : [r, ...prev])
      setClaimMsg('예약이 내 계정에 추가되었습니다.')
      setClaimRef(''); setClaimLastName('')
    } catch (e) {
      setClaimMsg(e instanceof Error ? e.message : '가져오기에 실패했습니다.')
    } finally { setClaimLoading(false) }
  }

  const filtered = bookings.filter(r => {
    if (tab === 'upcoming')  return r.status === 'confirmed' || r.status === 'checked_in'
    if (tab === 'completed') return r.status === 'completed' || r.status === 'cancelled'
    return true
  })

  if (!isLoggedIn) return (
    <main className="reservations-page">
      <div className="page-topbar"><div className="page-topbar-inner"><h1>내 예약</h1></div></div>
      <div className="reservations-body">
        {/* 비회원 조회 */}
        <div className="res-guest-box">
          <h3>비회원 예약 조회</h3>
          <p>예약번호와 영문 성(last name)을 입력하세요.</p>
          <div className="res-guest-form">
            <input className="res-guest-input" placeholder="예약번호 (예: CW1A2B3C)" value={guestRef} onChange={e => setGuestRef(e.target.value.toUpperCase())} />
            <input className="res-guest-input" placeholder="영문 성 (예: KIM)" value={guestLastName} onChange={e => setGuestLastName(e.target.value.toUpperCase())} />
            <button className="res-guest-btn" onClick={handleGuestLookup} disabled={guestLoading || !guestRef.trim() || !guestLastName.trim()}>
              {guestLoading ? '조회 중...' : '조회하기'}
            </button>
          </div>
          {guestError && <p className="res-guest-error">{guestError}</p>}
          {guestResult && (() => {
            const f = guestResult.flight
            const s = STATUS_LABEL[guestResult.status] ?? { text: guestResult.status, cls: 'confirmed' }
            return (
              <div className="res-card" style={{ marginTop: 16 }}>
                <div className="res-card-header">
                  <div className="res-brand"><div className="cw-badge-sm">CW</div><span className="res-flight-no">{f.flight_no}</span></div>
                  <span className={`status-badge ${s.cls}`}>{s.text}</span>
                </div>
                <div className="res-route">
                  <div className="res-point"><span className="res-time">{f.depart_time}</span><span className="res-code">{f.from_code}</span><span className="res-city">{f.from_city}</span></div>
                  <div className="res-line"><div className="res-track"><div className="res-dot"/><div className="res-dash"/><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/></svg><div className="res-dash"/><div className="res-dot"/></div><span className="res-date">{f.date}</span></div>
                  <div className="res-point right"><span className="res-time">{f.arrival_time}</span><span className="res-code">{f.to_code}</span><span className="res-city">{f.to_city}</span></div>
                </div>
                <div className="res-card-footer">
                  <div className="res-meta">
                    <span>예약번호 <strong>{guestResult.booking_ref}</strong></span>
                    <span>{guestResult.fare_class === 'economy' ? '일반석' : '비즈니스석'}</span>
                    <span>₩{Number(guestResult.price).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        <div className="res-guest-divider">
          <span>또는</span>
        </div>

        <div className="res-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <p>로그인하면 모든 예약을 한 곳에서 관리할 수 있습니다.</p>
          <button onClick={onGoLogin} style={{ marginTop: 12, padding: '8px 24px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>로그인하기</button>
        </div>
      </div>
    </main>
  )

  return (
    <main className="reservations-page">
      <div className="page-topbar">
        <div className="page-topbar-inner">
          <h1>내 예약</h1>
        </div>
      </div>

      <div className="reservations-body">
        <div className="res-tabs">
          {(['all', 'upcoming', 'completed'] as Tab[]).map(t => (
            <button key={t} className={`res-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'all' ? '전체' : t === 'upcoming' ? '예정' : '완료'}
              <span className="tab-count">
                {t === 'all' ? bookings.length
                  : t === 'upcoming' ? bookings.filter(r => r.status === 'confirmed' || r.status === 'checked_in').length
                  : bookings.filter(r => r.status === 'completed' || r.status === 'cancelled').length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '60px 0' }}>불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <div className="res-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>예약 내역이 없습니다.</p>
          </div>
        ) : (
          filtered.map(r => {
            const s = STATUS_LABEL[r.status] ?? { text: r.status, cls: 'confirmed' }
            const f = r.flight
            return (
              <div key={r.booking_ref} className="res-card">
                <div className="res-card-header">
                  <div className="res-brand">
                    <div className="cw-badge-sm">CW</div>
                    <span className="res-flight-no">{f.flight_no}</span>
                  </div>
                  <span className={`status-badge ${s.cls}`}>{s.text}</span>
                </div>

                <div className="res-route">
                  <div className="res-point">
                    <span className="res-time">{f.depart_time}</span>
                    <span className="res-code">{f.from_code}</span>
                    <span className="res-city">{f.from_city}</span>
                  </div>
                  <div className="res-line">
                    <div className="res-track">
                      <div className="res-dot" />
                      <div className="res-dash" />
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/>
                      </svg>
                      <div className="res-dash" />
                      <div className="res-dot" />
                    </div>
                    <span className="res-date">{f.date}</span>
                  </div>
                  <div className="res-point right">
                    <span className="res-time">{f.arrival_time}</span>
                    <span className="res-code">{f.to_code}</span>
                    <span className="res-city">{f.to_city}</span>
                  </div>
                </div>

                <div className="res-card-footer">
                  <div className="res-meta">
                    <span>예약번호 <strong>{r.booking_ref}</strong></span>
                    <span>{r.fare_class === 'economy' ? '일반석' : '비즈니스석'}</span>
                    <span>좌석 {r.seat_number ?? '-'}</span>
                    <span>₩{Number(r.price).toLocaleString()}</span>
                  </div>
                  <div className="res-actions">
                    <button className="res-btn secondary" onClick={() => setDetail(r)}>상세보기</button>
                    {(r.status === 'confirmed' || r.status === 'checked_in') && (
                      <button className="res-btn danger" onClick={() => setCancelTarget(r)}>예약 취소</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* 비회원 예약 가져오기 */}
        <div className="res-claim-box">
          <h4>비회원으로 예약한 내역 가져오기</h4>
          <p>예약번호와 영문 성을 입력하면 현재 계정에 연결됩니다.</p>
          <div className="res-guest-form">
            <input className="res-guest-input" placeholder="예약번호 (예: CW1A2B3C)" value={claimRef} onChange={e => setClaimRef(e.target.value.toUpperCase())} />
            <input className="res-guest-input" placeholder="영문 성 (예: KIM)" value={claimLastName} onChange={e => setClaimLastName(e.target.value.toUpperCase())} />
            <button className="res-guest-btn" onClick={handleClaim} disabled={claimLoading || !claimRef.trim() || !claimLastName.trim()}>
              {claimLoading ? '처리 중...' : '가져오기'}
            </button>
          </div>
          {claimMsg && <p className={`res-claim-msg ${claimMsg.includes('추가') ? 'ok' : 'err'}`}>{claimMsg}</p>}
        </div>
      </div>

      {/* 상세보기 모달 */}
      {detail && (() => {
        const f = detail.flight
        const s = STATUS_LABEL[detail.status] ?? { text: detail.status, cls: 'confirmed' }
        return (
          <div className="res-detail-overlay" onClick={() => setDetail(null)}>
            <div className="res-detail-modal" onClick={e => e.stopPropagation()}>
              <div className="rdm-header">
                <h2>예약 상세</h2>
                <button className="rdm-close" onClick={() => setDetail(null)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* 상태 + 편명 */}
              <div className="rdm-top">
                <div className="rdm-brand">
                  <div className="cw-badge-sm">CW</div>
                  <div>
                    <p className="rdm-flight-no">{f.flight_no}</p>
                    <p className="rdm-airline">CLEARWAY AIRLINES</p>
                  </div>
                </div>
                <span className={`status-badge ${s.cls}`}>{s.text}</span>
              </div>

              {/* 경로 */}
              <div className="rdm-route">
                <div className="rdm-point">
                  <span className="rdm-time">{f.depart_time}</span>
                  <span className="rdm-code">{f.from_code}</span>
                  <span className="rdm-city">{f.from_city}</span>
                  <span className="rdm-airport">{f.from_airport}</span>
                </div>
                <div className="rdm-mid">
                  <span className="rdm-duration">{f.duration}</span>
                  <div className="rdm-track">
                    <div className="res-dot" /><div className="res-dash" />
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width:16,height:16,color:'#1d4ed8',flexShrink:0}}>
                      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/>
                    </svg>
                    <div className="res-dash" /><div className="res-dot" />
                  </div>
                  <span className="rdm-direct">직항</span>
                </div>
                <div className="rdm-point right">
                  <span className="rdm-time">{f.arrival_time}</span>
                  <span className="rdm-code">{f.to_code}</span>
                  <span className="rdm-city">{f.to_city}</span>
                  <span className="rdm-airport">{f.to_airport}</span>
                </div>
              </div>

              {/* 정보 그리드 */}
              <div className="rdm-info-grid">
                {[
                  { label: '예약 번호', value: detail.booking_ref },
                  { label: '탑승 날짜', value: f.date },
                  { label: '좌석 등급', value: detail.fare_class === 'economy' ? '일반석' : '비즈니스석' },
                  { label: '좌석 번호', value: detail.seat_number ?? '-' },
                  { label: '승객명', value: detail.passenger_name_ko },
                  { label: '여권 번호', value: detail.passport_no },
                  { label: '연락처', value: detail.phone },
                  { label: '이메일', value: detail.email },
                ].map(({ label, value }) => (
                  <div key={label} className="rdm-info-row">
                    <span className="rdm-info-label">{label}</span>
                    <span className="rdm-info-value">{value}</span>
                  </div>
                ))}
              </div>

              {/* 요금 + 마일리지 */}
              <div className="rdm-price-row">
                <span>결제 금액</span>
                <strong>₩{Number(detail.price).toLocaleString()}</strong>
              </div>
              {detail.miles_earned > 0 && (
                <div className="rdm-miles-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/>
                  </svg>
                  <span>마일리지 +{detail.miles_earned.toLocaleString()} 마일 적립</span>
                </div>
              )}

                      <button className="rdm-close-btn" onClick={() => setDetail(null)}>닫기</button>
            </div>
          </div>
        )
      })()}

      {/* 예약 취소 모달 */}
      {cancelTarget && !cancelResult && (() => {
        const f = cancelTarget.flight
        const departDt = new Date(`${f.date}T${f.depart_time}`)
        const diffDays = (departDt.getTime() - Date.now()) / 86400000
        const rate = diffDays > 7 ? 100 : diffDays > 3 ? 90 : diffDays > 1 ? 70 : 0
        const refundAmt = Math.round(Number(cancelTarget.price) * rate / 100)
        return (
          <div className="res-detail-overlay" onClick={() => setCancelTarget(null)}>
            <div className="res-detail-modal" onClick={e => e.stopPropagation()}>
              <div className="rdm-header">
                <h2>예약 취소</h2>
                <button className="rdm-close" onClick={() => setCancelTarget(null)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="cancel-flight-info">
                <div className="cw-badge-sm">CW</div>
                <div>
                  <p className="rdm-flight-no">{f.flight_no}</p>
                  <p className="rdm-airline">{f.from_code} → {f.to_code} · {f.date} {f.depart_time}</p>
                </div>
              </div>

              <div className="cancel-refund-box">
                <div className="cancel-refund-row">
                  <span>결제 금액</span>
                  <strong>₩{Number(cancelTarget.price).toLocaleString()}</strong>
                </div>
                <div className="cancel-refund-row">
                  <span>환불율</span>
                  <strong className={rate === 100 ? 'green' : rate === 0 ? 'red' : 'orange'}>{rate}%</strong>
                </div>
                <div className="cancel-refund-row total">
                  <span>예상 환불금액</span>
                  <strong>₩{refundAmt.toLocaleString()}</strong>
                </div>
              </div>

              <div className="cancel-policy">
                <p>· 출발 7일 초과: 100% 환불</p>
                <p>· 출발 3~7일: 90% 환불</p>
                <p>· 출발 1~3일: 70% 환불</p>
                <p className="red">· 출발 1일 이내: 환불 불가</p>
              </div>

              {cancelLoading ? (
                <div className="rdm-close-btn" style={{textAlign:'center',cursor:'default'}}>처리 중...</div>
              ) : (
                <div style={{display:'flex',gap:10,marginTop:16}}>
                  <button className="rdm-close-btn" style={{flex:1}} onClick={() => setCancelTarget(null)}>돌아가기</button>
                  <button
                    className="cancel-confirm-btn"
                    style={{flex:1}}
                    onClick={async () => {
                      setCancelLoading(true)
                      try {
                        const res = await cancelBooking(cancelTarget.booking_ref)
                        setCancelResult({ refundAmount: res._refund_amount, refundRate: res._refund_rate * 100 })
                        setBookings(prev => prev.map(b => b.booking_ref === cancelTarget.booking_ref ? { ...b, status: 'cancelled' } : b))
                        onCancelSuccess?.()
                      } catch (e) {
                        toast(e instanceof Error ? e.message : '취소 실패', 'error')
                      } finally {
                        setCancelLoading(false)
                      }
                    }}
                  >취소 확정</button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* 취소 완료 모달 */}
      {cancelResult && (
        <div className="res-detail-overlay" onClick={() => { setCancelTarget(null); setCancelResult(null) }}>
          <div className="res-detail-modal" style={{textAlign:'center'}} onClick={e => e.stopPropagation()}>
            <div className="cancel-done-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{fontSize:20,fontWeight:800,margin:'0 0 8px'}}>취소가 완료되었습니다</h2>
            <p style={{color:'#6b7280',fontSize:14,marginBottom:24}}>환불 금액이 영업일 기준 3~5일 내 반환됩니다.</p>
            <div className="cancel-refund-box">
              <div className="cancel-refund-row">
                <span>환불율</span>
                <strong>{cancelResult.refundRate}%</strong>
              </div>
              <div className="cancel-refund-row total">
                <span>환불 금액</span>
                <strong>₩{cancelResult.refundAmount.toLocaleString()}</strong>
              </div>
            </div>
            <button className="rdm-close-btn" style={{marginTop:20}} onClick={() => { setCancelTarget(null); setCancelResult(null) }}>확인</button>
          </div>
        </div>
      )}
    </main>
  )
}
