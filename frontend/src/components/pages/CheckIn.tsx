import { useState, useEffect } from 'react'
import './CheckIn.css'
import { lookupBooking, doCheckin, publicCheckin } from '../../services/bookings'
import type { BookingRecord } from '../../services/bookings'

interface Props {
  isLoggedIn: boolean
  onGoLogin: () => void
  initialRef?: string
  initialLastName?: string
}

export default function CheckIn({ isLoggedIn, onGoLogin, initialRef, initialLastName }: Props) {
  const [bookingRef, setBookingRef] = useState(initialRef ?? '')
  const [lastName, setLastName] = useState(initialLastName ?? '')
  const [booking, setBooking] = useState<BookingRecord | null>(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [done, setDone] = useState(false)
  const [checkinLoading, setCheckinLoading] = useState(false)

  async function doLookup(ref: string, ln: string) {
    if (!ref.trim() || !ln.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      const result = await lookupBooking(ref.trim(), ln.trim())
      setBooking(result)
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : '예약을 찾을 수 없습니다.')
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (initialRef?.trim() && initialLastName?.trim()) {
      doLookup(initialRef, initialLastName)
    }
  }, []) // eslint-disable-line

  async function handleSearch(e: { preventDefault(): void }) {
    e.preventDefault()
    doLookup(bookingRef, lastName)
  }

  async function handleCheckin() {
    if (!booking) return
    setCheckinLoading(true)
    try {
      if (isLoggedIn) {
        await doCheckin(booking.booking_ref)
      } else {
        await publicCheckin(booking.booking_ref, lastName.trim())
      }
      setDone(true)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '체크인에 실패했습니다.')
    } finally {
      setCheckinLoading(false)
    }
  }

  const f = booking?.flight

  return (
    <main className="checkin-page">
      <div className="page-topbar">
        <div className="page-topbar-inner"><h1>온라인 체크인</h1></div>
      </div>

      <div className="checkin-body">
        {!done ? (
          <>
            <div className="checkin-search-card">
              <div className="checkin-search-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <div>
                  <h2>예약 조회</h2>
                  <p>예약 번호와 영문 성(Last Name)을 입력해 주세요.</p>
                </div>
              </div>
              <form className="checkin-form" onSubmit={handleSearch}>
                <div className="checkin-form-row">
                  <div className="checkin-field">
                    <label>예약 번호</label>
                    <input type="text" placeholder="예) CWABCD12"
                      value={bookingRef} onChange={e => setBookingRef(e.target.value)} />
                  </div>
                  <div className="checkin-field">
                    <label>영문 성 (Last Name)</label>
                    <input type="text" placeholder="예) KIM"
                      value={lastName} onChange={e => setLastName(e.target.value)} />
                  </div>
                  <button type="submit" className="checkin-search-btn" disabled={searching}>
                    {searching ? '조회 중...' : '조회하기'}
                  </button>
                </div>
                {searchError && <p className="checkin-error">{searchError}</p>}
              </form>
              {!isLoggedIn && (
                <p style={{ marginTop: 12, fontSize: 13, color: '#94a3b8' }}>
                  <button onClick={onGoLogin} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer', padding: 0 }}>로그인</button>하면 마일리지 적립 및 예약 관리가 가능합니다.
                </p>
              )}
            </div>

            {booking && f && (
              <>
                <div className="checkin-flight-card">
                  <div className="checkin-flight-header">
                    <div className="cw-badge-sm">CW</div>
                    <div>
                      <p className="checkin-brand">CLEARWAY</p>
                      <p className="checkin-flight-no">{f.flight_no}</p>
                    </div>
                    <div className="checkin-passenger-info">
                      <p className="checkin-passenger-name">{booking.passenger_name_ko}</p>
                      <p className="checkin-seat-class">{booking.fare_class === 'economy' ? '일반석' : '비즈니스석'}</p>
                    </div>
                  </div>
                  <div className="checkin-route">
                    <div className="res-point">
                      <span className="res-time">{f.depart_time}</span>
                      <span className="res-code">{f.from_code}</span>
                      <span className="res-city">{f.from_airport}</span>
                    </div>
                    <div className="res-line">
                      <div className="res-track">
                        <div className="res-dot" /><div className="res-dash" />
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16, color: '#1d4ed8', flexShrink: 0 }}>
                          <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/>
                        </svg>
                        <div className="res-dash" /><div className="res-dot" />
                      </div>
                      <span className="res-date">{f.date} · {f.duration}</span>
                    </div>
                    <div className="res-point right">
                      <span className="res-time">{f.arrival_time}</span>
                      <span className="res-code">{f.to_code}</span>
                      <span className="res-city">{f.to_airport}</span>
                    </div>
                  </div>
                </div>

                <div className="seat-selection-card">
                  <div className="checkin-seat-confirm-info">
                    <div className="checkin-seat-badge">
                      <span className="checkin-seat-label">예약 좌석</span>
                      <span className="checkin-seat-num">{booking.seat_number ?? '미배정'}</span>
                    </div>
                    <div className="checkin-seat-meta">
                      <p>{booking.fare_class === 'economy' ? '일반석 (Economy)' : '비즈니스석 (Business)'}</p>
                      <p>예약 번호 <strong>{booking.booking_ref}</strong></p>
                    </div>
                  </div>
                  <div className="seat-confirm-row">
                    <button className="checkin-confirm-btn" disabled={checkinLoading} onClick={handleCheckin}>
                      {checkinLoading ? '처리 중...' : '체크인 완료'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        ) : booking && f && (
          <div className="boarding-pass">
            <div className="boarding-pass-header">
              <div className="bp-brand"><div className="cw-badge-sm">CW</div><span>CLEARWAY</span></div>
              <span className="bp-title">탑승권</span>
            </div>
            <div className="bp-route">
              <div className="bp-point">
                <span className="bp-code">{f.from_code}</span>
                <span className="bp-city">{f.from_city}</span>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <div className="bp-point">
                <span className="bp-code">{f.to_code}</span>
                <span className="bp-city">{f.to_city}</span>
              </div>
            </div>
            <div className="bp-details">
              <div className="bp-item"><span>편명</span><strong>{f.flight_no}</strong></div>
              <div className="bp-item"><span>날짜</span><strong>{f.date}</strong></div>
              <div className="bp-item"><span>출발</span><strong>{f.depart_time}</strong></div>
              <div className="bp-item"><span>좌석</span><strong>{booking.seat_number ?? '미배정'}</strong></div>
              <div className="bp-item"><span>승객</span><strong>{booking.passenger_name_ko}</strong></div>
              <div className="bp-item"><span>등급</span><strong>{booking.fare_class === 'economy' ? '일반석' : '비즈니스석'}</strong></div>
            </div>
            <div className="bp-barcode">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="bp-bar" style={{ width: Math.random() > 0.5 ? 3 : 2, background: '#0f172a' }} />
              ))}
            </div>
            <p className="bp-note">탑승 30분 전까지 게이트로 이동해 주세요.</p>
          </div>
        )}
      </div>
    </main>
  )
}
