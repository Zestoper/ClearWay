import { useState, useEffect } from 'react'
import './NoticeEventPage.css'
import { api } from '../../services/api'

interface Notice {
  id: number
  category: string
  title: string
  content: string
  badge: string | null
  created_at: string
}

const CATEGORY_TABS = [
  { id: '', label: '전체' },
  { id: 'notice', label: '공지사항' },
  { id: 'event', label: '이벤트' },
  { id: 'promotion', label: '프로모션' },
  { id: 'membership', label: '멤버십 혜택' },
]

const BADGE_COLOR: Record<string, { bg: string; color: string }> = {
  NEW:  { bg: '#fee2e2', color: '#dc2626' },
  HOT:  { bg: '#fef3c7', color: '#d97706' },
  이벤트: { bg: '#dbeafe', color: '#1d4ed8' },
  공지: { bg: '#f3f4f6', color: '#374151' },
  혜택: { bg: '#d1fae5', color: '#065f46' },
}

export default function NoticeEventPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Notice | null>(null)

  useEffect(() => {
    setLoading(true)
    const url = category ? `/notices?category=${encodeURIComponent(category)}` : '/notices'
    api.get<Notice[]>(url)
      .then(setNotices)
      .catch(() => setNotices([]))
      .finally(() => setLoading(false))
  }, [category])

  function formatDate(dt: string) {
    return dt?.slice(0, 10).replace(/-/g, '.')
  }

  const badgeStyle = (badge: string | null) => {
    if (!badge) return {}
    const s = BADGE_COLOR[badge]
    return s ? { background: s.bg, color: s.color } : { background: '#eff6ff', color: '#1d4ed8' }
  }

  return (
    <main className="notice-page">
      <div className="notice-hero">
        <div className="notice-hero-inner">
          <h1>공지 &amp; 이벤트</h1>
          <p>클리어웨이의 최신 소식과 이벤트를 확인하세요.</p>
        </div>
      </div>

      <div className="notice-body">
        <div className="notice-tabs">
          {CATEGORY_TABS.map(t => (
            <button
              key={t.id}
              className={`notice-tab ${category === t.id ? 'active' : ''}`}
              onClick={() => setCategory(t.id)}
            >{t.label}</button>
          ))}
        </div>

        {loading ? (
          <p className="notice-loading">불러오는 중...</p>
        ) : notices.length === 0 ? (
          <p className="notice-empty">등록된 공지가 없습니다.</p>
        ) : (
          <div className="notice-grid">
            {notices.map(n => (
              <button key={n.id} className="notice-card" onClick={() => setSelected(n)}>
                <div className="notice-card-top">
                  {n.badge && (
                    <span className="notice-badge" style={badgeStyle(n.badge)}>{n.badge}</span>
                  )}
                  <span className="notice-category-tag">{CATEGORY_TABS.find(t => t.id === n.category)?.label ?? n.category}</span>
                </div>
                <h3 className="notice-card-title">{n.title}</h3>
                <p className="notice-card-preview">{n.content.slice(0, 80)}{n.content.length > 80 ? '...' : ''}</p>
                <span className="notice-card-date">{formatDate(n.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="notice-modal-overlay" onClick={() => setSelected(null)}>
          <div className="notice-modal" onClick={e => e.stopPropagation()}>
            <button className="notice-modal-close" onClick={() => setSelected(null)}>✕</button>
            <div className="notice-modal-top">
              {selected.badge && (
                <span className="notice-badge" style={badgeStyle(selected.badge)}>{selected.badge}</span>
              )}
              <span className="notice-category-tag">{CATEGORY_TABS.find(t => t.id === selected.category)?.label ?? selected.category}</span>
            </div>
            <h2 className="notice-modal-title">{selected.title}</h2>
            <p className="notice-modal-date">{formatDate(selected.created_at)}</p>
            <div className="notice-modal-divider" />
            <div className="notice-modal-content">{selected.content}</div>
          </div>
        </div>
      )}
    </main>
  )
}
