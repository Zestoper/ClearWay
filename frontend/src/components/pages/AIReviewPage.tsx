import { useState, useEffect } from 'react'
import './ReviewPage.css'
import { api } from '../../services/api'
import type { User } from '../../services/auth'

interface Props {
  user: User | null
  onGoLogin: () => void
  onGoHome: () => void
  onGoNextrip: () => void
}

interface PlanSummary {
  id: number
  title: string
  destination: string
  arrival_date: string
  departure_date: string
  status: string
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

export default function AIReviewPage({ user, onGoLogin, onGoHome, onGoNextrip }: Props) {
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [aiRating, setAiRating] = useState(0)
  const [accuracyRating, setAccuracyRating] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    api.get<PlanSummary[]>('/nextrip/plans')
      .then(data => setPlans(data.filter(p => p.status === 'done')))
      .catch(() => {})
  }, [user])

  const selectedPlan = plans.find(p => p.id === selectedPlanId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (aiRating === 0) { setError('AI 일정 품질 평점을 선택해 주세요.'); return }
    if (!text.trim()) { setError('후기 내용을 입력해 주세요.'); return }
    const overallRating = Math.round((aiRating + (accuracyRating || aiRating)) / 2)
    setSubmitting(true)
    setError('')
    try {
      await api.post('/reviews', {
        user_name: user?.name ?? '익명',
        route: null,
        rating: overallRating,
        text: text.trim(),
        review_type: 'ai',
        booking_ref: null,
        plan_destination: selectedPlan?.destination ?? null,
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
      <div className="rv-topbar"><div className="rv-topbar-inner"><h1>AI 여행 후기</h1></div></div>
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
      <div className="rv-topbar"><div className="rv-topbar-inner"><h1>AI 여행 후기</h1></div></div>
      <div className="rv-body">
        <div className="rv-card rv-done-card">
          <div className="rv-done-icon" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>✦</div>
          <h2>AI 후기가 등록되었습니다!</h2>
          <p>NEXTRIP AI 서비스 개선에 큰 도움이 됩니다. 감사합니다!</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="rv-submit-btn" style={{ background: '#7c3aed' }} onClick={onGoNextrip}>새 여행 계획 만들기</button>
            <button className="rv-submit-btn rv-submit-outline" onClick={onGoHome}>홈으로 돌아가기</button>
          </div>
        </div>
      </div>
    </main>
  )

  return (
    <main className="rv-page">
      <div className="rv-topbar rv-topbar--ai">
        <div className="rv-topbar-inner">
          <button className="rv-back-btn" onClick={onGoHome}>← 홈으로</button>
          <h1>✦ NEXTRIP AI 후기 작성</h1>
        </div>
      </div>
      <div className="rv-body">
        {plans.length === 0 ? (
          <div className="rv-card" style={{ textAlign: 'center' }}>
            <div className="rv-empty-icon">✦</div>
            <h3 style={{ color: '#1e1b4b', marginBottom: 8 }}>아직 완성된 AI 여행 계획이 없습니다</h3>
            <p style={{ color: '#6b7280', marginBottom: 20 }}>NEXTRIP AI로 나만의 여행 계획을 만들어보세요!</p>
            <button className="rv-submit-btn" style={{ background: '#7c3aed' }} onClick={onGoNextrip}>AI 여행 계획 시작하기</button>
          </div>
        ) : (
          <div className="rv-card">
            <div className="rv-card-header rv-card-header--ai">
              <span className="rv-card-icon rv-ai-icon">✦</span>
              <div>
                <h2>NEXTRIP AI 이용 후기</h2>
                <p>AI가 만들어준 여행 계획이 얼마나 도움이 되었나요?</p>
              </div>
            </div>

            <form className="rv-form" onSubmit={handleSubmit}>
              <div className="rv-field">
                <label>여행 계획 선택 <em className="rv-optional">선택</em></label>
                <select value={selectedPlanId ?? ''} onChange={e => setSelectedPlanId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">선택 안함</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.destination} · {p.arrival_date} ~ {p.departure_date}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rv-field">
                <label>AI 일정 품질 <em className="rv-required">필수</em></label>
                <p className="rv-field-desc">추천 장소, 동선, 일정 구성의 완성도는 어떠셨나요?</p>
                <Stars value={aiRating} onChange={setAiRating} />
              </div>

              <div className="rv-field">
                <label>정보 정확도 <em className="rv-optional">선택</em></label>
                <p className="rv-field-desc">추천된 장소들이 실제로 운영 중이고 정확했나요?</p>
                <Stars value={accuracyRating} onChange={setAccuracyRating} />
              </div>

              <div className="rv-field">
                <label>상세 후기 <em className="rv-required">필수</em></label>
                <textarea
                  placeholder="AI가 만들어준 여행 계획이 어떠셨나요? 실제 여행에 도움이 되었는지, 개선했으면 하는 점 등을 자유롭게 남겨주세요."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={5}
                />
                <span className="rv-char-count">{text.length}자</span>
              </div>

              {error && <p className="rv-error">{error}</p>}

              <button type="submit" className="rv-submit-btn rv-submit-ai" disabled={submitting}>
                {submitting ? '등록 중...' : '✦ AI 후기 등록하기'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
