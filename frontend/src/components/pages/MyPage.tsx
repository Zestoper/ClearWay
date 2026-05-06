import { useState, useEffect } from 'react'
import './MyPage.css'
import type { User } from '../../services/auth'
import { fetchMyBookings } from '../../services/bookings'
import type { BookingRecord } from '../../services/bookings'
import { api } from '../../services/api'
import { useToast } from '../common/ToastProvider'

interface Props {
  user: User | null
  onGoLogin: () => void
  onUpdateUser?: (u: User) => void
}

type ModalId = 'reservations' | 'profile' | 'password' | 'membership' | 'history' | 'notifications' | 'alerts' | 'my-reviews'

const QUICK_LINKS: { icon: React.ReactNode; label: string; sub: string; modal: ModalId }[] = [
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    label: '내 예약 내역', sub: '예약 조회 및 변경', modal: 'reservations',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    label: '개인정보 수정', sub: '이름, 연락처, 이메일', modal: 'profile',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    label: '비밀번호 변경', sub: '보안 설정', modal: 'password',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    label: '멤버십 혜택', sub: '등급별 혜택 안내', modal: 'membership',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    label: '이용 내역', sub: '마일리지 적립/사용', modal: 'history',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    label: '알림 설정', sub: '푸시, 이메일 수신 설정', modal: 'notifications',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    label: '가격 알림', sub: '목표 가격 달성 시 알림', modal: 'alerts',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    label: '내 후기 관리', sub: '작성한 후기 수정·삭제', modal: 'my-reviews',
  },
]

const TIER_NEXT: Record<string, { next: string; target: number }> = {
  BLUE:    { next: 'RED',     target: 50000  },
  RED:     { next: 'RAINBOW', target: 200000 },
  RAINBOW: { next: 'RAINBOW', target: 200000 },
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  confirmed:  { text: '예약 확정',   cls: 'confirmed'  },
  checked_in: { text: '체크인 완료', cls: 'checkin'    },
  completed:  { text: '탑승 완료',   cls: 'completed'  },
  cancelled:  { text: '취소됨',      cls: 'cancelled'  },
}

const TIER_BENEFITS = [
  {
    tier: 'BLUE', color: '#1d4ed8', bg: '#eff6ff',
    benefits: ['마일리지 적립 3~5%', '기내 Wi-Fi 할인 10%', '온라인 체크인', '기본 고객센터 지원'],
  },
  {
    tier: 'RED', color: '#dc2626', bg: '#fff1f2',
    benefits: ['마일리지 적립 5~8%', '기내 Wi-Fi 무료', '공항 라운지 할인 50%', '좌석 업그레이드 우선권', '수하물 우선 처리'],
  },
  {
    tier: 'RAINBOW', color: '#7c3aed', bg: '#f5f3ff',
    benefits: ['마일리지 적립 7~10%', '기내 Wi-Fi 무료', '공항 라운지 무료 (동반 1인)', '좌석 업그레이드 연 2회', '전용 고객센터', '우선 탑승'],
  },
]

function EyeIcon({ show }: { show: boolean }) {
  return show
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}

export default function MyPage({ user, onGoLogin, onUpdateUser }: Props) {
  const [flightCount, setFlightCount] = useState(0)
  const [activeModal, setActiveModal] = useState<ModalId | null>(null)
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [bookingsLoaded, setBookingsLoaded] = useState(false)
  const [emailNoti, setEmailNoti] = useState(true)
  const [emailNotiSaving, setEmailNotiSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!user) return
    fetchMyBookings()
      .then(b => { setBookings(b); setBookingsLoaded(true); setFlightCount(b.filter(x => x.status === 'completed' || x.status === 'checked_in').length) })
      .catch(() => setBookingsLoaded(true))
    api.get<{ enabled: boolean }>('/users/me/email-notifications')
      .then(r => setEmailNoti(r.enabled))
      .catch(() => {})
  }, [user])

  async function toggleEmailNoti() {
    if (emailNotiSaving) return
    setEmailNotiSaving(true)
    try {
      const next = !emailNoti
      await api.put<{ enabled: boolean }>('/users/me/email-notifications', { enabled: next })
      setEmailNoti(next)
      toast(next ? '이메일 알림이 켜졌습니다.' : '이메일 알림이 꺼졌습니다.', 'info')
    } catch {
      toast('변경에 실패했습니다.', 'error')
    } finally {
      setEmailNotiSaving(false)
    }
  }

  function openModal(id: ModalId) {
    if (!bookingsLoaded && (id === 'reservations' || id === 'history')) {
      fetchMyBookings().then(b => { setBookings(b); setBookingsLoaded(true) }).catch(() => setBookingsLoaded(true))
    }
    setActiveModal(id)
  }
  function closeModal() { setActiveModal(null) }

  if (!user) return (
    <main className="mypage">
      <div className="page-topbar"><div className="page-topbar-inner"><h1>마이페이지</h1></div></div>
      <div className="mypage-body">
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>
          <p style={{ marginBottom: 16 }}>로그인이 필요합니다.</p>
          <button onClick={onGoLogin} style={{ padding: '10px 28px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>로그인하기</button>
        </div>
      </div>
    </main>
  )

  const miles = user.miles ?? 0
  const tier = user.tier ?? 'BLUE'
  const tierInfo = TIER_NEXT[tier] ?? TIER_NEXT.BLUE
  const milesLeft = Math.max(0, tierInfo.target - miles)
  const milesPercent = tier === 'RAINBOW' ? 100 : Math.min(100, Math.round((miles / tierInfo.target) * 100))
  const initial = user.name.charAt(0)
  const joinDate = new Date(user.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')

  return (
    <main className="mypage">
      <div className="page-topbar"><div className="page-topbar-inner"><h1>마이페이지</h1></div></div>

      <div className="mypage-body">
        <div className="profile-card">
          <div className="profile-avatar">{initial}</div>
          <div className="profile-info">
            <h2 className="profile-name">{user.name}</h2>
            <p className="profile-email">{user.email}</p>
            <span className={`tier-badge tier-badge--${tier.toLowerCase()}`}>{tier} 회원</span>
          </div>
          <div className="profile-join"><span>가입일 {joinDate}</span></div>
        </div>

        <div className="stats-row">
          <div className="stat-card miles">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/></svg>
            <p className="stat-value">{miles.toLocaleString()}</p>
            <p className="stat-label">누적 마일리지</p>
          </div>
          <div className="stat-card flights">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <p className="stat-value">{flightCount}</p>
            <p className="stat-label">탑승 횟수</p>
          </div>
          <div className="stat-card next-tier">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            {tier === 'RAINBOW' ? (
              <><p className="stat-value rainbow-text">MAX</p><p className="stat-label">최고 등급 달성!</p></>
            ) : (
              <><p className="stat-value">{milesLeft.toLocaleString()}</p><p className="stat-label">{tierInfo.next} 등급까지</p></>
            )}
            <div className="tier-progress-bar">
              <div className={`tier-progress-fill ${tier === 'RAINBOW' ? 'rainbow-fill' : ''}`} style={{ width: `${milesPercent}%` }} />
            </div>
            <p className="tier-progress-text">{milesPercent}%</p>
          </div>
        </div>

        <div className="quicklinks-grid">
          {QUICK_LINKS.map((link, i) => (
            <button key={i} className="quicklink-card" onClick={() => openModal(link.modal)}>
              <div className="quicklink-icon">{link.icon}</div>
              <div className="quicklink-text">
                <p className="quicklink-label">{link.label}</p>
                <p className="quicklink-sub">{link.sub}</p>
              </div>
              <svg className="quicklink-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
          <button
            className={`quicklink-card nl-sub-card ${emailNoti ? 'nl-sub-card--on' : ''}`}
            onClick={toggleEmailNoti}
            disabled={emailNotiSaving}
          >
            <div className="quicklink-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div className="quicklink-text">
              <p className="quicklink-label">이메일 알림</p>
              <p className="quicklink-sub">{emailNoti ? '수신 중 · 탭하여 끄기' : '꺼짐 · 탭하여 켜기'}</p>
            </div>
            <div className={`nl-toggle ${emailNoti ? 'nl-toggle--on' : ''}`}>
              <div className="nl-toggle-thumb" />
            </div>
          </button>
        </div>
      </div>

      {/* ── 내 예약 내역 모달 ── */}
      {activeModal === 'reservations' && (
        <div className="mp-modal-overlay" onClick={closeModal}>
          <div className="mp-modal" onClick={e => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h2>내 예약 내역</h2>
              <button className="mp-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="mp-modal-body">
              {bookings.length === 0 ? (
                <p className="mp-empty">예약 내역이 없습니다.</p>
              ) : bookings.map(b => {
                const s = STATUS_LABEL[b.status] ?? { text: b.status, cls: 'completed' }
                return (
                  <div key={b.booking_ref} className="mp-booking-card">
                    <div className="mp-booking-top">
                      <span className="mp-booking-ref">{b.booking_ref}</span>
                      <span className={`mp-status ${s.cls}`}>{s.text}</span>
                    </div>
                    <div className="mp-booking-route">
                      <strong>{b.flight.from_code}</strong>
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width:14,height:14,color:'#1d4ed8'}}><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z"/></svg>
                      <strong>{b.flight.to_code}</strong>
                      <span className="mp-booking-meta">{b.flight.date} · {b.flight.flight_no}</span>
                    </div>
                    <div className="mp-booking-price">₩{Number(b.price).toLocaleString()} · {b.fare_class === 'economy' ? '일반석' : '비즈니스석'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 개인정보 수정 모달 ── */}
      {activeModal === 'profile' && <ProfileModal user={user} onClose={closeModal} onUpdateUser={onUpdateUser} />}

      {/* ── 비밀번호 변경 모달 ── */}
      {activeModal === 'password' && <PasswordModal onClose={closeModal} />}

      {/* ── 멤버십 혜택 모달 ── */}
      {activeModal === 'membership' && (
        <div className="mp-modal-overlay" onClick={closeModal}>
          <div className="mp-modal" onClick={e => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h2>멤버십 혜택</h2>
              <button className="mp-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="mp-modal-body">
              <p className="mp-modal-desc">현재 등급: <strong className={`mp-tier-text mp-tier-text--${tier.toLowerCase()}`}>{tier} 회원</strong></p>
              {TIER_BENEFITS.map(t => (
                <div key={t.tier} className={`mp-tier-card ${t.tier === tier ? 'active' : ''}`} style={t.tier === tier ? { background: t.bg, borderColor: t.color } : {}}>
                  <div className="mp-tier-header">
                    <span className="mp-tier-name" style={{ color: t.color }}>{t.tier}</span>
                    {t.tier === tier && <span className="mp-tier-current-badge">현재 등급</span>}
                    <span className="mp-tier-req">{t.tier === 'BLUE' ? '기본' : t.tier === 'RED' ? '5만 마일 달성' : '20만 마일 달성'}</span>
                  </div>
                  <ul className="mp-tier-benefits">
                    {t.benefits.map((b, i) => <li key={i}>✓ {b}</li>)}
                  </ul>
                </div>
              ))}
              {tier !== 'RAINBOW' && (
                <div className="mp-tier-progress-box">
                  <p>{tierInfo.next} 등급까지 <strong>{milesLeft.toLocaleString()} 마일</strong> 남았습니다</p>
                  <div className="mp-progress-bar"><div className="mp-progress-fill" style={{ width: `${milesPercent}%` }} /></div>
                  <p className="mp-progress-sub">{miles.toLocaleString()} / {tierInfo.target.toLocaleString()} 마일 ({milesPercent}%)</p>
                </div>
              )}
            </div>
            <div className="mp-modal-footer"><button className="mp-btn-close" onClick={closeModal}>닫기</button></div>
          </div>
        </div>
      )}

      {/* ── 이용 내역 모달 ── */}
      {activeModal === 'history' && (
        <div className="mp-modal-overlay" onClick={closeModal}>
          <div className="mp-modal" onClick={e => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h2>이용 내역</h2>
              <button className="mp-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="mp-modal-body">
              {bookings.length === 0 ? (
                <p className="mp-empty">이용 내역이 없습니다.</p>
              ) : (
                <>
                  <div className="mp-history-summary">
                    <div><span>총 결제금액</span><strong>₩{bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + Number(b.price), 0).toLocaleString()}</strong></div>
                    <div><span>총 마일리지</span><strong>{bookings.reduce((s, b) => s + (b.miles_earned ?? 0), 0).toLocaleString()} 마일</strong></div>
                  </div>
                  <div className="mp-timeline">
                    {bookings.map(b => (
                      <div key={b.booking_ref} className="mp-timeline-item">
                        <div className="mp-timeline-dot" />
                        <div className="mp-timeline-content">
                          <p className="mp-timeline-date">{b.flight.date}</p>
                          <p className="mp-timeline-route">{b.flight.from_code} → {b.flight.to_code} <span>{b.flight.flight_no}</span></p>
                          <div className="mp-timeline-bottom">
                            <span>₩{Number(b.price).toLocaleString()}</span>
                            {b.miles_earned > 0 && <span className="mp-miles-tag">+{b.miles_earned.toLocaleString()} 마일</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 알림 설정 모달 ── */}
      {activeModal === 'notifications' && <NotificationsModal onClose={closeModal} />}

      {/* ── 가격 알림 모달 ── */}
      {activeModal === 'alerts' && <PriceAlertsModal onClose={closeModal} />}

      {/* ── 내 후기 관리 모달 ── */}
      {activeModal === 'my-reviews' && <MyReviewsModal user={user} onClose={closeModal} />}
    </main>
  )
}

/* ── 개인정보 수정 모달 컴포넌트 ── */
function ProfileModal({ user, onClose, onUpdateUser }: { user: User; onClose: () => void; onUpdateUser?: (u: User) => void }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSave() {
    if (!name.trim() || !email.trim()) return
    setSaving(true)
    try {
      const updated = await api.put<User>('/users/me', { name, email })
      onUpdateUser?.(updated)
      setMsg('저장되었습니다.')
    } catch {
      setMsg('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mp-modal-overlay" onClick={onClose}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-modal-header">
          <h2>개인정보 수정</h2>
          <button className="mp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body">
          <div className="mp-form-group">
            <label>이름</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" />
          </div>
          <div className="mp-form-group">
            <label>이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" />
          </div>
          <div className="mp-form-group">
            <label>연락처</label>
            <input type="tel" placeholder="010-0000-0000" />
            <span className="mp-form-hint">연락처 변경 시 고객센터로 문의해 주세요.</span>
          </div>
          {msg && <p className={`mp-msg ${msg.includes('실패') ? 'error' : 'success'}`}>{msg}</p>}
        </div>
        <div className="mp-modal-footer">
          <button className="mp-btn-close" onClick={onClose}>취소</button>
          <button className="mp-btn-primary" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── 비밀번호 변경 모달 컴포넌트 ── */
function PasswordModal({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const valid = cur.length >= 1 && next.length >= 8 && next === confirm

  async function handleChange() {
    if (!valid) return
    setSaving(true)
    try {
      await api.put('/users/me/password', { current_password: cur, new_password: next })
      setMsg('비밀번호가 변경되었습니다.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mp-modal-overlay" onClick={onClose}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-modal-header">
          <h2>비밀번호 변경</h2>
          <button className="mp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body">
          {[
            { label: '현재 비밀번호', val: cur, set: setCur, show: showCur, toggle: () => setShowCur(v => !v) },
            { label: '새 비밀번호', val: next, set: setNext, show: showNext, toggle: () => setShowNext(v => !v) },
            { label: '새 비밀번호 확인', val: confirm, set: setConfirm, show: showConf, toggle: () => setShowConf(v => !v) },
          ].map(({ label, val, set, show, toggle }) => (
            <div key={label} className="mp-form-group">
              <label>{label}</label>
              <div className="mp-input-wrap">
                <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)} placeholder="••••••••" />
                <button type="button" className="mp-eye-btn" onClick={toggle}><EyeIcon show={show} /></button>
              </div>
            </div>
          ))}
          {next.length > 0 && next.length < 8 && <p className="mp-msg error">비밀번호는 최소 8자 이상이어야 합니다.</p>}
          {confirm.length > 0 && next !== confirm && <p className="mp-msg error">비밀번호가 일치하지 않습니다.</p>}
          {msg && <p className={`mp-msg ${msg.includes('실패') || msg.includes('오류') ? 'error' : 'success'}`}>{msg}</p>}
        </div>
        <div className="mp-modal-footer">
          <button className="mp-btn-close" onClick={onClose}>취소</button>
          <button className="mp-btn-primary" disabled={!valid || saving} onClick={handleChange}>{saving ? '변경 중...' : '변경하기'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── 알림 설정 모달 컴포넌트 ── */
type PriceAlert = { id: string; from: string; to: string; targetPrice: number; currentPrice: number; active: boolean }


const ALERT_AIRPORTS: { region: string; airports: { code: string; label: string }[] }[] = [
  { region: '출발지', airports: [{ code: 'ICN', label: '서울 (ICN) 인천국제공항' }] },
  { region: '일본', airports: [
    { code: 'NRT', label: '도쿄 (NRT) 나리타국제공항' },
    { code: 'HND', label: '도쿄 (HND) 하네다공항' },
    { code: 'KIX', label: '오사카 (KIX) 간사이국제공항' },
    { code: 'FUK', label: '후쿠오카 (FUK) 후쿠오카공항' },
    { code: 'CTS', label: '삿포로 (CTS) 신치토세공항' },
  ]},
  { region: '중국·대만·홍콩', airports: [
    { code: 'PEK', label: '베이징 (PEK) 수도국제공항' },
    { code: 'PVG', label: '상하이 (PVG) 푸동국제공항' },
    { code: 'CAN', label: '광저우 (CAN) 바이윈국제공항' },
    { code: 'TPE', label: '타이베이 (TPE) 타오위안국제공항' },
    { code: 'HKG', label: '홍콩 (HKG) 홍콩국제공항' },
  ]},
  { region: '동남아시아', airports: [
    { code: 'BKK', label: '방콕 (BKK) 수완나품국제공항' },
    { code: 'DMK', label: '방콕 (DMK) 돈므앙공항' },
    { code: 'SGN', label: '호치민 (SGN) 탄손낫국제공항' },
    { code: 'HAN', label: '하노이 (HAN) 노이바이국제공항' },
    { code: 'DAD', label: '다낭 (DAD) 다낭국제공항' },
    { code: 'MNL', label: '마닐라 (MNL) 니노이아키노국제공항' },
    { code: 'CEB', label: '세부 (CEB) 막탄세부국제공항' },
    { code: 'SIN', label: '싱가포르 (SIN) 창이국제공항' },
    { code: 'KUL', label: '쿠알라룸푸르 (KUL) KLIA' },
  ]},
  { region: '미주', airports: [
    { code: 'JFK', label: '뉴욕 (JFK) 케네디국제공항' },
    { code: 'LAX', label: '로스앤젤레스 (LAX) 국제공항' },
    { code: 'SFO', label: '샌프란시스코 (SFO) 국제공항' },
    { code: 'ORD', label: '시카고 (ORD) 오헤어국제공항' },
    { code: 'SEA', label: '시애틀 (SEA) 터코마국제공항' },
  ]},
  { region: '유럽', airports: [
    { code: 'LHR', label: '런던 (LHR) 히드로공항' },
    { code: 'CDG', label: '파리 (CDG) 샤를 드 골 공항' },
    { code: 'FRA', label: '프랑크푸르트 (FRA) 국제공항' },
    { code: 'FCO', label: '로마 (FCO) 피우미치노공항' },
  ]},
  { region: '오세아니아', airports: [
    { code: 'SYD', label: '시드니 (SYD) 킹스포드스미스공항' },
    { code: 'MEL', label: '멜버른 (MEL) 국제공항' },
  ]},
]

const ALL_AIRPORT_CODES = ALERT_AIRPORTS.flatMap(g => g.airports.map(a => a.code))
function airportLabel(code: string) {
  for (const g of ALERT_AIRPORTS) {
    const found = g.airports.find(a => a.code === code)
    if (found) return found.label
  }
  return code
}

async function fetchMinPrice(from: string, to: string): Promise<number | null> {
  try {
    const flights = await api.get<{ economy_price: number }[]>(`/flights?from_code=${from}&to_code=${to}`)
    if (!flights.length) return null
    return Math.min(...flights.map(f => Number(f.economy_price)))
  } catch { return null }
}

function PriceAlertsModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    try { return JSON.parse(localStorage.getItem('priceAlerts') ?? '[]') } catch { return [] }
  })
  const [from, setFrom]       = useState('ICN')
  const [to, setTo]           = useState(ALL_AIRPORT_CODES.find(c => c !== 'ICN') ?? '')
  const [target, setTarget]   = useState('')
  const [preview, setPreview] = useState<number | null>(null)
  const [fetching, setFetching] = useState(false)

  // 노선 선택 시 실제 최저가 미리보기
  useEffect(() => {
    if (!from || !to) return
    setPreview(null)
    setFetching(true)
    fetchMinPrice(from, to).then(p => { setPreview(p); setFetching(false) })
  }, [from, to])

  // 모달 열릴 때 기존 알림 가격 일괄 갱신
  useEffect(() => {
    if (!alerts.length) return
    Promise.all(alerts.map(a =>
      fetchMinPrice(a.from, a.to).then(p => p !== null ? { ...a, currentPrice: p } : a)
    )).then(updated => {
      setAlerts(updated)
      localStorage.setItem('priceAlerts', JSON.stringify(updated))
      updated.filter(a => a.active && a.currentPrice <= a.targetPrice).forEach(a => {
        toast(`${airportLabel(a.from).split('(')[0].trim()} → ${airportLabel(a.to).split('(')[0].trim()} 목표가 달성! 현재 ₩${a.currentPrice.toLocaleString()}`, 'success')
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persist(next: PriceAlert[]) {
    setAlerts(next)
    localStorage.setItem('priceAlerts', JSON.stringify(next))
  }

  function addAlert() {
    if (!to || !target || preview === null) return
    const newAlert: PriceAlert = { id: Date.now().toString(), from, to, targetPrice: Number(target), currentPrice: preview, active: true }
    persist([...alerts, newAlert])
    const fromLabel = airportLabel(from).split('(')[0].trim()
    const toLabel   = airportLabel(to).split('(')[0].trim()
    if (preview <= Number(target)) {
      toast(`${fromLabel} → ${toLabel} 이미 목표가 이하! 현재 ₩${preview.toLocaleString()}`, 'success')
    } else {
      toast(`${fromLabel} → ${toLabel} 가격 알림 등록 완료`, 'info')
    }
    setTarget('')
  }

  function remove(id: string) { persist(alerts.filter(a => a.id !== id)) }
  function toggle(id: string) { persist(alerts.map(a => a.id === id ? { ...a, active: !a.active } : a)) }

  return (
    <div className="mp-modal-overlay" onClick={onClose}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-modal-header">
          <h2>가격 알림</h2>
          <button className="mp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body">
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
            목표 가격 이하이면 모달 열릴 때 알림을 받습니다.
            {fetching && <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: 12 }}>현재가 조회 중...</span>}
            {!fetching && preview !== null && <span style={{ marginLeft: 8, color: '#1d4ed8', fontWeight: 700, fontSize: 12 }}>현재 최저가 ₩{preview.toLocaleString()}</span>}
            {!fetching && preview === null && from && to && <span style={{ marginLeft: 8, color: '#f59e0b', fontSize: 12 }}>해당 노선 항공편 없음</span>}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, letterSpacing: '0.04em' }}>출발</p>
              <select value={from} onChange={e => setFrom(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', color: '#0f172a', cursor: 'pointer' }}>
                {ALERT_AIRPORTS.map(g => (
                  <optgroup key={g.region} label={g.region}>
                    {g.airports.map(a => (
                      <option key={a.code} value={a.code}>{a.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, letterSpacing: '0.04em' }}>도착</p>
              <select value={to} onChange={e => setTo(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', color: '#0f172a', cursor: 'pointer' }}>
                {ALERT_AIRPORTS.map(g => (
                  <optgroup key={g.region} label={g.region}>
                    {g.airports.filter(a => a.code !== from).map(a => (
                      <option key={a.code} value={a.code}>{a.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, letterSpacing: '0.04em' }}>목표가 (₩)</p>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="예: 90000"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={addAlert} disabled={fetching || preview === null || !target}
                style={{ padding: '8px 20px', background: fetching || preview === null || !target ? '#94a3b8' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: fetching || preview === null || !target ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {fetching ? '조회 중' : '추가'}
              </button>
            </div>
          </div>
          {alerts.length === 0 ? (
            <p className="mp-empty">등록된 가격 알림이 없습니다.</p>
          ) : alerts.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{airportLabel(a.from).split('(')[0].trim()} → {airportLabel(a.to).split('(')[0].trim()}</p>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  현재가 ₩{a.currentPrice.toLocaleString()} · 목표가 <span style={{ color: a.currentPrice <= a.targetPrice ? '#16a34a' : '#dc2626', fontWeight: 700 }}>₩{a.targetPrice.toLocaleString()}</span>
                </p>
                {a.currentPrice <= a.targetPrice && <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>목표가 달성!</p>}
              </div>
              <button onClick={() => toggle(a.id)}
                style={{ padding: '4px 10px', background: a.active ? '#dcfce7' : '#f1f5f9', color: a.active ? '#16a34a' : '#64748b', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {a.active ? '활성' : '비활성'}
              </button>
              <button onClick={() => remove(a.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          ))}
        </div>
        <div className="mp-modal-footer"><button className="mp-btn-close" onClick={onClose}>닫기</button></div>
      </div>
    </div>
  )
}

function NotificationsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState({
    booking:    true,
    checkin:    true,
    promo:      false,
    membership: false,
    email:      true,
    sms:        false,
  })
  const [saved, setSaved] = useState(false)

  function toggle(key: keyof typeof settings) {
    setSettings(s => ({ ...s, [key]: !s[key] }))
    setSaved(false)
  }

  const ITEMS: { key: keyof typeof settings; label: string; sub: string }[] = [
    { key: 'booking',    label: '예약 확인 알림',    sub: '예약 완료, 변경, 취소 시 알림' },
    { key: 'checkin',    label: '체크인 알림',        sub: '출발 48시간 전 체크인 안내' },
    { key: 'promo',      label: '특가 항공권 알림',   sub: '할인 프로모션 및 이벤트 안내' },
    { key: 'membership', label: '멤버십 혜택 안내',   sub: '등급 변경 및 혜택 알림' },
    { key: 'email',      label: '이메일 수신 동의',   sub: '서비스 안내 이메일' },
    { key: 'sms',        label: 'SMS 수신 동의',      sub: '문자 메시지 알림' },
  ]

  return (
    <div className="mp-modal-overlay" onClick={onClose}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-modal-header">
          <h2>알림 설정</h2>
          <button className="mp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body">
          {ITEMS.map(({ key, label, sub }) => (
            <div key={key} className="mp-noti-row">
              <div>
                <p className="mp-noti-label">{label}</p>
                <p className="mp-noti-sub">{sub}</p>
              </div>
              <button
                className={`mp-toggle ${settings[key] ? 'on' : 'off'}`}
                onClick={() => toggle(key)}
                aria-checked={settings[key]}
                role="switch"
              >
                <span className="mp-toggle-thumb" />
              </button>
            </div>
          ))}
          {saved && <p className="mp-msg success">저장되었습니다.</p>}
        </div>
        <div className="mp-modal-footer">
          <button className="mp-btn-close" onClick={onClose}>취소</button>
          <button className="mp-btn-primary" onClick={() => setSaved(true)}>저장</button>
        </div>
      </div>
    </div>
  )
}

/* ── 내 후기 관리 모달 컴포넌트 ── */
interface MyReview {
  id: number
  user_name: string
  route: string | null
  rating: number
  text: string
  review_type: string
  plan_destination: string | null
  created_at: string
}

function MyReviewStars({ value }: { value: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ color: n <= value ? '#fbbf24' : '#d1d5db', fontSize: 14 }}>★</span>
      ))}
    </span>
  )
}

function MyReviewsModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { toast } = useToast()
  const [reviews, setReviews] = useState<MyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRating, setEditRating] = useState(0)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<MyReview[]>('/reviews/me')
      .then(data => { setReviews(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  function startEdit(r: MyReview) {
    setEditingId(r.id)
    setEditRating(r.rating)
    setEditText(r.text)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditRating(0)
    setEditText('')
  }

  async function saveEdit(id: number) {
    if (!editText.trim() || editRating === 0) return
    setSaving(true)
    try {
      const updated = await api.put<MyReview>(`/reviews/${id}`, { rating: editRating, text: editText.trim() })
      setReviews(prev => prev.map(r => r.id === id ? updated : r))
      cancelEdit()
      toast('후기가 수정되었습니다.', 'success')
    } catch {
      toast('수정에 실패했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteReview(id: number) {
    if (!confirm('후기를 삭제하시겠습니까?')) return
    try {
      await api.delete(`/reviews/${id}`)
      setReviews(prev => prev.filter(r => r.id !== id))
      toast('후기가 삭제되었습니다.', 'info')
    } catch {
      toast('삭제에 실패했습니다.', 'error')
    }
  }

  const STAR_LABELS = ['', '매우 불만족', '불만족', '보통', '만족', '매우 만족']

  return (
    <div className="mp-modal-overlay" onClick={onClose}>
      <div className="mp-modal mp-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="mp-modal-header">
          <h2>내 후기 관리</h2>
          <button className="mp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body">
          {loading ? (
            <p className="mp-empty">불러오는 중...</p>
          ) : reviews.length === 0 ? (
            <p className="mp-empty">작성한 후기가 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reviews.map(r => (
                <div key={r.id} className="myr-card">
                  {editingId === r.id ? (
                    <div className="myr-edit-form">
                      <div className="myr-edit-stars">
                        {[1,2,3,4,5].map(n => (
                          <button key={n} type="button" className={`myr-star-btn ${n <= editRating ? 'on' : ''}`} onClick={() => setEditRating(n)}>★</button>
                        ))}
                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>{STAR_LABELS[editRating]}</span>
                      </div>
                      <textarea
                        className="myr-edit-textarea"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={4}
                      />
                      <div className="myr-edit-actions">
                        <button className="myr-btn-cancel" onClick={cancelEdit}>취소</button>
                        <button className="myr-btn-save" onClick={() => saveEdit(r.id)} disabled={saving || !editText.trim() || editRating === 0}>
                          {saving ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="myr-card-top">
                        <span className={`myr-type ${r.review_type === 'ai' ? 'ai' : 'general'}`}>
                          {r.review_type === 'ai' ? 'AI 여행 후기' : '항공편 후기'}
                        </span>
                        <MyReviewStars value={r.rating} />
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{r.created_at.slice(0, 10)}</span>
                      </div>
                      {(r.route || r.plan_destination) && (
                        <p className="myr-route">✈ {r.review_type === 'ai' ? r.plan_destination : r.route}</p>
                      )}
                      <p className="myr-text">{r.text}</p>
                      <div className="myr-actions">
                        <button className="myr-btn-edit" onClick={() => startEdit(r)}>수정</button>
                        <button className="myr-btn-delete" onClick={() => deleteReview(r.id)}>삭제</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mp-modal-footer">
          <button className="mp-btn-close" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
