import { useState, useEffect } from 'react'
import './Home.css'
import { api } from '../../services/api'

interface ReviewItem {
  id: number
  user_name: string
  route: string | null
  rating: number
  text: string
  review_type: string
  plan_destination: string | null
  created_at: string
}

interface Props {
  onGoNextrip?: () => void
  onGoBooking?: (code: string) => void
  onGoNotice?: () => void
  onGoReview?: () => void
  onGoAIReview?: () => void
  onGoReviews?: () => void
}

const HERO_SLIDES = [
  {
    badge: '🔥 하계 시즌 특가',
    title: '지금 예약하면\n최대 40% 할인',
    sub: '6월~8월 출발 전 노선 한정 특가 · 수량 한정',
    cta: '특가 항공권 보기',
    altCta: 'AI 일정도 함께',
    action: 'booking' as const,
    bg: 'linear-gradient(135deg, #0c1445 0%, #1d4ed8 55%, #0ea5e9 100%)',
    tagColor: '#60a5fa',
  },
  {
    badge: '✦ NEXTRIP AI',
    title: 'AI가 완성하는\n나만의 완벽한 여행',
    sub: '목적지와 기간만 알려주면 동선 최적화 일정 자동 완성',
    cta: 'AI 여행 계획 시작하기',
    altCta: '항공권 먼저 예약',
    action: 'nextrip' as const,
    bg: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #4f46e5 100%)',
    tagColor: '#a78bfa',
  },
  {
    badge: '🎁 신규 회원 혜택',
    title: '가입 즉시\n마일리지 1,000점 증정',
    sub: '첫 예약에 바로 사용 가능 · 유효기간 3년',
    cta: '항공권 예약하기',
    altCta: 'AI 일정 체험',
    action: 'booking' as const,
    bg: 'linear-gradient(135deg, #052e16 0%, #065f46 55%, #10b981 100%)',
    tagColor: '#6ee7b7',
  },
]

const DESTINATIONS = [
  { code: 'NRT', city: '도쿄',     country: '일본',     emoji: '🗼', price: '189,000', tag: '인기 1위',    g1: '#1e3a8a', g2: '#2563eb' },
  { code: 'KIX', city: '오사카',   country: '일본',     emoji: '🏯', price: '169,000', tag: '맛집 천국',   g1: '#4c1d95', g2: '#7c3aed' },
  { code: 'BKK', city: '방콕',     country: '태국',     emoji: '🛕', price: '229,000', tag: '가성비 최고', g1: '#064e3b', g2: '#047857' },
  { code: 'SIN', city: '싱가포르', country: '싱가포르', emoji: '🌴', price: '319,000', tag: '럭셔리 여행', g1: '#0c4a6e', g2: '#0369a1' },
  { code: 'CDG', city: '파리',     country: '프랑스',   emoji: '🥐', price: '689,000', tag: '로맨틱 여행', g1: '#3b0764', g2: '#7e22ce' },
  { code: 'DAD', city: '다낭',     country: '베트남',   emoji: '🏖️', price: '239,000', tag: '해변 휴양',   g1: '#042f2e', g2: '#0d9488' },
]

const TRENDING = [
  { rank: 1, label: '서울 → 도쿄',     code: 'NRT', diff: '+3', hot: true  },
  { rank: 2, label: '서울 → 오사카',   code: 'KIX', diff: '→',  hot: false },
  { rank: 3, label: '서울 → 후쿠오카', code: 'FUK', diff: '+5', hot: true  },
  { rank: 4, label: '서울 → 방콕',     code: 'BKK', diff: '-1', hot: false },
  { rank: 5, label: '서울 → 싱가포르', code: 'SIN', diff: '+2', hot: false },
  { rank: 6, label: '서울 → 파리',     code: 'CDG', diff: '+1', hot: false },
]

interface NoticeItem {
  id: number
  category: string
  title: string
  content: string
  badge: string | null
  created_at: string
}

function badgeStyle(badge: string | null): { icon: string; color: string } {
  switch (badge?.toUpperCase()) {
    case 'HOT':  return { icon: '🎫', color: '#ef4444' }
    case 'NEW':  return { icon: '⭐', color: '#7c3aed' }
    case 'SALE': return { icon: '💺', color: '#0891b2' }
    default:     return { icon: '✈️', color: '#1d4ed8' }
  }
}

const STATIC_REVIEWS = [
  { name: '김지원', rating: 5, date: '2025.04', route: '서울 → 도쿄',     text: '예약부터 탑승까지 모든 과정이 너무 편했어요. NEXTRIP으로 일정까지 완성해서 완벽한 여행이었습니다!' },
  { name: '박민준', rating: 5, date: '2025.03', route: '서울 → 후쿠오카', text: '실시간 좌석 선택이 직관적이고 AI 여행 계획이 진짜 유용해요. 다음에도 꼭 이용할 것 같습니다.' },
  { name: '이수현', rating: 4, date: '2025.03', route: '서울 → 싱가포르', text: '비즈니스석 프로모션으로 저렴하게 다녀왔어요. 간편 체크인도 정말 편리했습니다.' },
]

const BENEFITS = [
  { icon: '🔒', title: '안전한 결제',      desc: '카카오페이·네이버페이·토스 간편 결제 지원',         bg: '#dcfce7' },
  { icon: '✈️', title: '실시간 좌석 확인', desc: '잔여 좌석 실시간 업데이트, 원하는 자리 바로 선택', bg: '#dbeafe' },
  { icon: '🎁', title: '마일리지 적립',    desc: '예약마다 마일리지 적립, 다음 여행에 사용 가능',    bg: '#fef9c3' },
  { icon: '📱', title: '온라인 체크인',    desc: '공항 방문 전 모바일로 체크인 완료',                bg: '#fce7f3' },
]

const FAQS = [
  { q: '예약 후 취소/환불은 어떻게 하나요?', a: '마이페이지 → 예약 내역에서 취소 신청이 가능합니다. 출발 72시간 전까지 무료 취소이며, 이후에는 항공사 정책에 따라 위약금이 발생할 수 있습니다.' },
  { q: '좌석 업그레이드가 가능한가요?', a: '출발 48시간 전까지 마이페이지에서 좌석 변경이 가능합니다. 마일리지 또는 추가 결제로 이코노미에서 비즈니스로 업그레이드할 수 있습니다.' },
  { q: 'NEXTRIP AI 여행 계획 비용은 얼마인가요?', a: '1회 이용 요금은 ₩3,900입니다. 커피 한 잔 가격으로 AI가 동선 최적화 된 맞춤 일정을 완성해 드립니다.' },
  { q: '마일리지는 어떻게 사용하나요?', a: '적립된 마일리지는 항공권 결제 시 1점 = 1원으로 사용 가능합니다. 마일리지 유효기간은 적립일로부터 3년입니다.' },
  { q: '유아/소아 동반 시 할인이 있나요?', a: '만 2세 미만 유아는 성인 운임의 10%, 만 12세 미만 소아는 성인 운임의 75%가 적용됩니다.' },
]

function Stars({ n }: { n: number }) {
  return (
    <span className="stars">
      {'★★★★★'.split('').map((s, i) => (
        <span key={i} style={{ color: i < n ? '#fbbf24' : '#e2e8f0' }}>{s}</span>
      ))}
    </span>
  )
}

export default function Home({ onGoNextrip, onGoBooking, onGoNotice, onGoReview, onGoAIReview, onGoReviews }: Props) {
  const [heroIdx, setHeroIdx] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>(
    STATIC_REVIEWS.map((r, i) => ({
      id: i, user_name: r.name, route: r.route, rating: r.rating, text: r.text,
      review_type: 'general', plan_destination: null, created_at: r.date,
    }))
  )
  const [eventItems, setEventItems] = useState<NoticeItem[]>([])

  useEffect(() => {
    api.get<ReviewItem[]>('/reviews').then(data => { if (data.length > 0) setReviews(data) }).catch(() => {})
    api.get<NoticeItem[]>('/notices?category=event').then(data => setEventItems(data.slice(0, 3))).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [])

  const slide = HERO_SLIDES[heroIdx]
  const heroDest = DESTINATIONS[heroIdx % DESTINATIONS.length]

  function handleCta(action: 'booking' | 'nextrip') {
    if (action === 'nextrip') onGoNextrip?.()
    else onGoBooking?.('')
  }

  return (
    <main className="home-page">

      {/* 1. Hero */}
      <section className="hero-section" style={{ background: slide.bg }}>
        <div className="hero-inner">
          <div className="hero-content">
            <span
              className="hero-badge"
              style={{ color: slide.tagColor, borderColor: `${slide.tagColor}50`, background: `${slide.tagColor}18` }}
            >
              {slide.badge}
            </span>
            <h1 className="hero-title">{slide.title}</h1>
            <p className="hero-sub">{slide.sub}</p>
            <div className="hero-btns">
              <button className="hero-btn-primary" onClick={() => handleCta(slide.action)}>
                {slide.cta}
              </button>
              <button className="hero-btn-ghost" onClick={() => handleCta(slide.action === 'booking' ? 'nextrip' : 'booking')}>
                {slide.altCta}
              </button>
            </div>
          </div>
          <div className="hero-right">
            <div className="hero-card">
              <div className="hero-card-label">
                <span>✈️</span>
                <span>ICN → {heroDest.code}</span>
              </div>
              <div className="hero-card-emoji">{heroDest.emoji}</div>
              <div className="hero-card-city">{heroDest.city}</div>
              <div className="hero-card-price">₩{heroDest.price}<em>원~</em></div>
            </div>
          </div>
        </div>
        <div className="hero-dots">
          {HERO_SLIDES.map((_, i) => (
            <button key={i} className={`hero-dot${i === heroIdx ? ' active' : ''}`} onClick={() => setHeroIdx(i)} />
          ))}
        </div>
      </section>

      {/* 2. 서비스 강점 — 왜 CLEARWAY? */}
      <section className="hp-section hp-section--gray">
        <div className="hp-inner">
          <div className="benefit-grid">
            {BENEFITS.map((b, i) => (
              <div key={i} className="benefit-card">
                <div className="benefit-icon" style={{ background: b.bg }}>{b.icon}</div>
                <div className="benefit-text">
                  <h4 className="benefit-title">{b.title}</h4>
                  <p className="benefit-desc">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 인기 여행지 */}
      <section className="hp-section">
        <div className="hp-inner">
          <div className="hp-head">
            <div>
              <h2 className="hp-title">인기 여행지</h2>
              <p className="hp-sub">지금 가장 많이 찾는 여행지</p>
            </div>
          </div>
          <div className="dest-grid">
            {DESTINATIONS.map(d => (
              <div
                key={d.code}
                className="dest-card"
                style={{ background: `linear-gradient(145deg, ${d.g1} 0%, ${d.g2} 100%)` }}
              >
                <div className="dest-bg-emoji">{d.emoji}</div>
                <div className="dest-info">
                  <span className="dest-tag">{d.tag}</span>
                  <h3 className="dest-city">{d.city}</h3>
                  <p className="dest-country">{d.country}</p>
                  <p className="dest-price">₩{d.price}원~</p>
                </div>
                <div className="dest-actions">
                  <button className="dest-btn-book" onClick={() => onGoBooking?.(d.code)}>항공권 예약</button>
                  <button className="dest-btn-ai" onClick={onGoNextrip}>AI 일정</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. 이벤트 & 인기 검색 */}
      <section className="hp-section">
        <div className="hp-inner">
          <div className="split-grid">

            {/* 이벤트 */}
            <div>
              <div className="hp-head" style={{ marginBottom: 20 }}>
                <div>
                  <h2 className="hp-title">이벤트 & 혜택</h2>
                  <p className="hp-sub">놓치면 아쉬운 특가와 프로모션</p>
                </div>
                <button className="more-btn" onClick={onGoNotice}>전체보기 →</button>
              </div>
              {eventItems.length > 0 ? (
                <div className="event-grid" style={{ gridTemplateColumns: '1fr' }}>
                  {eventItems.slice(0, 2).map((e) => {
                    const { icon, color } = badgeStyle(e.badge)
                    return (
                      <div key={e.id} className="event-card" style={{ '--accent': color } as React.CSSProperties}>
                        <div className="event-top">
                          <span className="event-icon">{icon}</span>
                          {e.badge && <span className="event-badge">{e.badge}</span>}
                        </div>
                        <h3 className="event-title">{e.title}</h3>
                        <p className="event-desc">{e.content}</p>
                        <button className="event-link" onClick={onGoNotice}>자세히 보기 →</button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="split-card" style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0' }}>
                  진행 중인 이벤트가 없습니다
                </div>
              )}
            </div>

            {/* 실시간 인기 검색 */}
            <div className="split-card">
              <div className="split-head">
                <h2 className="hp-title">🔥 실시간 인기 검색</h2>
                <span className="live-badge">LIVE</span>
              </div>
              <ul className="trending-list">
                {TRENDING.map(t => (
                  <li key={t.rank} className="trending-row" onClick={() => onGoBooking?.(t.code)}>
                    <span className={`t-rank${t.rank <= 3 ? ' top' : ''}`}>{t.rank}</span>
                    <span className="t-label">{t.label}</span>
                    <span className={`t-diff ${t.diff.startsWith('+') ? 'up' : t.diff === '→' ? 'same' : 'down'}`}>{t.diff}</span>
                    {t.hot && <span className="t-hot">HOT</span>}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* 6. 이용 후기 */}
      <section className="hp-section hp-section--gray">
        <div className="hp-inner">
          <div className="hp-head">
            <div>
              <h2 className="hp-title">이용 고객 후기</h2>
              <p className="hp-sub">실제 이용 고객들의 생생한 후기</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="more-btn" onClick={onGoReview}>후기 작성 →</button>
              <button className="more-btn" style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' }} onClick={onGoAIReview}>AI 후기 →</button>
              <button className="more-btn" style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }} onClick={onGoReviews}>전체보기 →</button>
            </div>
          </div>
          <div className="review-grid">
            {reviews.slice(0, 3).map((r, i) => (
              <div key={r.id ?? i} className="review-card">
                <div className="review-header">
                  <span className="review-avatar">{r.review_type === 'ai' ? '🤖' : '👤'}</span>
                  <div>
                    <p className="review-name">{r.user_name}</p>
                    <p className="review-meta">
                      {r.route ?? r.plan_destination ?? ''} · {r.created_at?.slice(0, 7) ?? ''}
                    </p>
                  </div>
                  <Stars n={r.rating} />
                </div>
                <p className="review-text">"{r.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="hp-section">
        <div className="hp-inner faq-inner">
          <div className="hp-head center">
            <h2 className="hp-title">자주 묻는 질문</h2>
            <p className="hp-sub">궁금한 점을 빠르게 해결하세요</p>
          </div>
          <div className="faq-list">
            {FAQS.map((f, i) => (
              <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{f.q}</span>
                  <svg className="faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {openFaq === i && <p className="faq-a">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  )
}
