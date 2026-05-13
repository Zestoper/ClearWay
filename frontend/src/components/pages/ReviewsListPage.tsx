import { useState, useEffect } from 'react'
import './ReviewPage.css'
import './ReviewsListPage.css'
import { api } from '../../services/api'

interface Props {
  onGoHome: () => void
  onGoWrite: () => void
}

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

const PAGE_SIZE = 10

function Stars({ value }: { value: number }) {
  return (
    <span className="rl-stars">
      {[1,2,3,4,5].map(n => (
        <span key={n} className={n <= value ? 'rl-star filled' : 'rl-star'}>★</span>
      ))}
    </span>
  )
}

export default function ReviewsListPage({ onGoHome, onGoWrite }: Props) {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'general' | 'ai'>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    api.get<ReviewItem[]>('/reviews?limit=200')
      .then(data => { setReviews(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = reviews.filter(r => filter === 'all' ? true : r.review_type === filter)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const avgRating = filtered.length
    ? (filtered.reduce((s, r) => s + r.rating, 0) / filtered.length).toFixed(1)
    : '—'

  function handleFilter(f: typeof filter) {
    setFilter(f)
    setPage(1)
  }

  return (
    <main className="rv-page">
      <div className="rv-topbar">
        <div className="rv-topbar-inner" style={{ maxWidth: 900 }}>
          <button className="rv-back-btn" onClick={onGoHome}>← 홈으로</button>
          <h1>이용 후기</h1>
        </div>
      </div>

      <div className="rl-body">
        {/* 요약 */}
        <div className="rl-summary">
          <div className="rl-summary-item">
            <span className="rl-summary-num">{filtered.length}</span>
            <span className="rl-summary-label">총 후기</span>
          </div>
          <div className="rl-summary-divider" />
          <div className="rl-summary-item">
            <span className="rl-summary-num">{avgRating}</span>
            <span className="rl-summary-label">평균 평점</span>
          </div>
          <div className="rl-summary-divider" />
          <div className="rl-summary-item">
            <span className="rl-summary-num">{reviews.filter(r => r.review_type === 'ai').length}</span>
            <span className="rl-summary-label">AI 후기</span>
          </div>
          <button className="rl-write-btn" onClick={onGoWrite}>후기 작성</button>
        </div>

        {/* 필터 */}
        <div className="rl-filter-bar">
          {(['all', 'general', 'ai'] as const).map(f => (
            <button
              key={f}
              className={`rl-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => handleFilter(f)}
            >
              {f === 'all' ? '전체' : f === 'general' ? '항공편 후기' : 'AI 여행 후기'}
              <span className="rl-filter-count">
                {f === 'all' ? reviews.length : reviews.filter(r => r.review_type === f).length}
              </span>
            </button>
          ))}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="rl-loading">후기를 불러오는 중...</div>
        ) : paginated.length === 0 ? (
          <div className="rl-empty">
            <p>아직 후기가 없습니다.</p>
            <button className="rl-write-btn" onClick={onGoWrite}>첫 후기 작성하기</button>
          </div>
        ) : (
          <div className="rl-list">
            {paginated.map(r => (
              <div key={r.id} className="rl-card">
                <div className="rl-card-top">
                  <span className="rl-avatar">{r.review_type === 'ai' ? '🤖' : '👤'}</span>
                  <div className="rl-card-meta">
                    <span className="rl-user">{r.user_name}</span>
                    {r.review_type === 'ai'
                      ? <span className="rl-type-badge ai">AI 여행 후기</span>
                      : <span className="rl-type-badge general">항공편 후기</span>
                    }
                  </div>
                  <div className="rl-card-right">
                    <Stars value={r.rating} />
                    <span className="rl-date">{r.created_at.slice(0, 10)}</span>
                  </div>
                </div>
                {(r.route || r.plan_destination) && (
                  <p className="rl-route">
                    {r.review_type === 'ai' ? `✈ ${r.plan_destination}` : `✈ ${r.route}`}
                  </p>
                )}
                <p className="rl-text">{r.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="rl-pagination">
            <button className="rl-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 이전</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`rl-page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="rl-page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>다음 →</button>
          </div>
        )}
      </div>
    </main>
  )
}
