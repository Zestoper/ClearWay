import { useState, useEffect } from 'react'
import './ReviewPage.css'
import { api } from '../../services/api'
import type { User } from '../../services/auth'

interface Props {
  user: User | null
  onGoLogin: () => void
  onGoHome: () => void
}

interface MyBooking {
  booking_ref: string
  status: string
  flight: { flight_no: string; from_city: string; from_code: string; to_city: string; to_code: string; date: string }
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="rv-stars-row">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          className={`rv-star ${n <= (hover || value) ? 'filled' : ''}`}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange?.(n)}
        >★</button>
      ))}
      <span className="rv-stars-label">
        {value === 1 ? '매우 불만족' : value === 2 ? '불만족' : value === 3 ? '보통' : value === 4 ? '만족' : value === 5 ? '매우 만족' : ''}
      </span>
    </div>
  )
}

export default function ReviewPage({ user, onGoLogin, onGoHome }: Props) {
  const [bookings, setBookings] = useState<MyBooking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [selectedRef, setSelectedRef] = useState('')
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    api.get<MyBooking[]>('/bookings/me')
      .then(data => {
        setBookings(data.filter(b => b.status !== 'cancelled'))
        setLoadingBookings(false)
      })
      .catch(() => setLoadingBookings(false))
  }, [user])

  const selectedBooking = bookings.find(b => b.booking_ref === selectedRef)
  const route = selectedBooking
    ? `${selectedBooking.flight.from_city} → ${selectedBooking.flight.to_city}`
    : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRef) { setError('후기를 작성할 항공편을 선택해 주세요.'); return }
    if (rating === 0) { setError('평점을 선택해 주세요.'); return }
    if (!text.trim()) { setError('후기 내용을 입력해 주세요.'); return }
    setSubmitting(true)
    setError('')
    try {
      await api.post('/reviews', {
        user_name: user?.name ?? '익명',
        route: route || null,
        rating,
        text: text.trim(),
        review_type: 'general',
        booking_ref: selectedRef,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return (
    <main className="rv-page">
      <div className="rv-topbar"><div className="rv-topbar-inner"><h1>후기 작성</h1></div></div>
      <div className="rv-body">
        <div className="rv-card" style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>로그인 후 후기를 작성할 수 있습니다.</p>
          <button className="rv-submit-btn" onClick={onGoLogin}>로그인하기</button>
        </div>
      </div>
    </main>
  )

  if (done) return (
    <main className="rv-page">
      <div className="rv-topbar"><div className="rv-topbar-inner"><h1>후기 작성</h1></div></div>
      <div className="rv-body">
        <div className="rv-card rv-done-card">
          <div className="rv-done-icon">✓</div>
          <h2>후기가 등록되었습니다!</h2>
          <p>소중한 의견 감사합니다. 더 나은 서비스를 위해 노력하겠습니다.</p>
          <button className="rv-submit-btn" onClick={onGoHome}>홈으로 돌아가기</button>
        </div>
      </div>
    </main>
  )

  return (
    <main className="rv-page">
      <div className="rv-topbar">
        <div className="rv-topbar-inner">
          <button className="rv-back-btn" onClick={onGoHome}>← 홈으로</button>
          <h1>이용 후기 작성</h1>
        </div>
      </div>
      <div className="rv-body">
        <div className="rv-card">
          <div className="rv-card-header">
            <span className="rv-card-icon">✈️</span>
            <div>
              <h2>항공편 후기 작성</h2>
              <p>탑승하신 항공편을 선택하고 후기를 남겨주세요.</p>
            </div>
          </div>

          {!loadingBookings && bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>✈️</p>
              <p style={{ fontWeight: 700, marginBottom: 8 }}>탑승 내역이 없습니다</p>
              <p style={{ fontSize: 14, marginBottom: 24 }}>CLEARWAY를 이용하신 후 후기를 남겨주세요.</p>
              <button className="rv-submit-btn" style={{ width: 'auto', padding: '10px 28px' }} onClick={onGoHome}>항공편 예약하러 가기</button>
            </div>
          ) : (
            <form className="rv-form" onSubmit={handleSubmit}>
              <div className="rv-field">
                <label>항공편 선택 <em className="rv-required">필수</em></label>
                <select value={selectedRef} onChange={e => { setSelectedRef(e.target.value); setError('') }}>
                  <option value="">탑승 항공편을 선택하세요</option>
                  {bookings.map(b => (
                    <option key={b.booking_ref} value={b.booking_ref}>
                      {b.booking_ref} · {b.flight.from_city} → {b.flight.to_city} ({b.flight.date})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBooking && (
                <div className="rv-flight-summary">
                  <span className="rv-flight-badge">{selectedBooking.flight.flight_no}</span>
                  <span className="rv-flight-route">{selectedBooking.flight.from_city} ({selectedBooking.flight.from_code}) → {selectedBooking.flight.to_city} ({selectedBooking.flight.to_code})</span>
                  <span className="rv-flight-date">{selectedBooking.flight.date}</span>
                </div>
              )}

              <div className="rv-field">
                <label>평점 <em className="rv-required">필수</em></label>
                <Stars value={rating} onChange={setRating} />
              </div>

              <div className="rv-field">
                <label>후기 내용 <em className="rv-required">필수</em></label>
                <textarea
                  placeholder="탑승 경험, 서비스, 좌석, 기내식 등 솔직한 후기를 남겨주세요. (최소 10자)"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={5}
                  minLength={10}
                />
                <span className="rv-char-count">{text.length}자</span>
              </div>

              {error && <p className="rv-error">{error}</p>}

              <button type="submit" className="rv-submit-btn" disabled={submitting || !selectedRef}>
                {submitting ? '등록 중...' : '후기 등록하기'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
