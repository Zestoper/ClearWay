import { useState, useEffect, useRef } from 'react'
import './CustomerServicePage.css'
import { api } from '../../services/api'
import type { User } from '../../services/auth'
import ChatWidget from './ChatWidget'

interface FAQ { id: number; category: string; question: string; answer: string; order_num: number }
interface Inquiry {
  id: number; category: string; subject: string; status: string
  content: string; answer: string | null; created_at: string
}

interface Props { user: User | null; onGoLogin: () => void }

const FAQ_CATEGORIES = ['전체', '예약', '체크인', '수하물', '마일리지', '결제']

const STATUS_TXT: Record<string, string> = { pending: '접수완료', answered: '답변완료' }
const STATUS_CLS: Record<string, string> = { pending: 'pending', answered: 'answered' }

interface AiMsg { role: 'user' | 'assistant'; content: string }

export default function CustomerServicePage({ user, onGoLogin }: Props) {
  const [csTab, setCsTab] = useState<'faq' | 'aichat' | 'inquiry' | 'myinquiry'>('faq')
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [faqCat, setFaqCat] = useState('전체')
  const [openFaqId, setOpenFaqId] = useState<number | null>(null)
  const [myInquiries, setMyInquiries] = useState<Inquiry[]>([])
  const [inquiryLoading, setInquiryLoading] = useState(false)

  // AI 챗봇
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<FAQ[]>('/cs/faqs').then(setFaqs).catch(() => {})
  }, [])

  useEffect(() => {
    if (csTab === 'myinquiry' && user) {
      setInquiryLoading(true)
      api.get<Inquiry[]>('/cs/inquiries/me').then(setMyInquiries).catch(() => {}).finally(() => setInquiryLoading(false))
    }
  }, [csTab, user])

  const filteredFaqs = faqCat === '전체' ? faqs : faqs.filter(f => f.category === faqCat)

  function formatDate(dt: string) { return dt?.slice(0, 10).replace(/-/g, '.') }

  async function sendAiMessage() {
    const text = aiInput.trim()
    if (!text || aiLoading) return
    const newMsgs: AiMsg[] = [...aiMessages, { role: 'user', content: text }]
    setAiMessages(newMsgs)
    setAiInput('')
    setAiLoading(true)
    setTimeout(() => aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const res = await api.post<{ reply: string }>('/cs/ai-chat', { messages: newMsgs })
      setAiMessages([...newMsgs, { role: 'assistant', content: res.reply }])
    } catch {
      setAiMessages([...newMsgs, { role: 'assistant', content: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }])
    } finally {
      setAiLoading(false)
      setTimeout(() => aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  return (
    <main className="cs-page">
      <div className="cs-hero">
        <div className="cs-hero-inner">
          <h1>고객센터</h1>
          <p>무엇을 도와드릴까요?</p>
        </div>
      </div>

      <div className="cs-body">
        <div className="cs-tabs">
          <button className={`cs-tab ${csTab === 'faq' ? 'active' : ''}`} onClick={() => setCsTab('faq')}>자주 묻는 질문</button>
          <button className={`cs-tab ${csTab === 'aichat' ? 'active' : ''}`} onClick={() => setCsTab('aichat')}>🤖 AI 챗봇</button>
          <button className={`cs-tab ${csTab === 'inquiry' ? 'active' : ''}`} onClick={() => setCsTab('inquiry')}>1:1 채팅 상담</button>
          {user && (
            <button className={`cs-tab ${csTab === 'myinquiry' ? 'active' : ''}`} onClick={() => setCsTab('myinquiry')}>내 문의 내역</button>
          )}
        </div>

        {/* FAQ */}
        {csTab === 'faq' && (
          <div className="cs-section">
            <div className="cs-faq-cats">
              {FAQ_CATEGORIES.map(c => (
                <button
                  key={c}
                  className={`cs-faq-cat ${faqCat === c ? 'active' : ''}`}
                  onClick={() => { setFaqCat(c); setOpenFaqId(null) }}
                >{c}</button>
              ))}
            </div>
            <div className="cs-faq-list">
              {filteredFaqs.map(f => (
                <div key={f.id} className="cs-faq-item">
                  <button
                    className={`cs-faq-q ${openFaqId === f.id ? 'open' : ''}`}
                    onClick={() => setOpenFaqId(openFaqId === f.id ? null : f.id)}
                  >
                    <span className="cs-faq-qmark">Q</span>
                    <span className="cs-faq-qtext">{f.question}</span>
                    <span className="cs-faq-chevron">{openFaqId === f.id ? '▲' : '▼'}</span>
                  </button>
                  {openFaqId === f.id && (
                    <div className="cs-faq-a">
                      <span className="cs-faq-amark">A</span>
                      <span className="cs-faq-atext">{f.answer}</span>
                    </div>
                  )}
                </div>
              ))}
              {filteredFaqs.length === 0 && (
                <p className="cs-empty">해당 카테고리의 FAQ가 없습니다.</p>
              )}
            </div>
          </div>
        )}

        {/* AI 챗봇 */}
        {csTab === 'aichat' && (
          <div className="cs-section">
            <div className="aichat-wrap">
              <div className="aichat-header">
                <span className="aichat-avatar">🤖</span>
                <div>
                  <h3>CLEARWAY AI 상담원</h3>
                  <p>예약·취소·수하물·마일리지 등 항공 관련 질문에 즉시 답변해 드립니다.</p>
                </div>
              </div>
              <div className="aichat-messages">
                {aiMessages.length === 0 && (
                  <div className="aichat-welcome">
                    <p>안녕하세요! CLEARWAY AI 상담원입니다 👋</p>
                    <p>궁금하신 점을 자유롭게 질문해 주세요.</p>
                    <div className="aichat-suggestions">
                      {['취소·환불 정책이 궁금해요', '수하물 규정을 알고 싶어요', '마일리지는 어떻게 사용하나요?', '온라인 체크인은 언제 가능한가요?'].map(s => (
                        <button key={s} className="aichat-suggestion" onClick={() => { setAiInput(s) }}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {aiMessages.map((m, i) => (
                  <div key={i} className={`aichat-bubble-wrap ${m.role}`}>
                    {m.role === 'assistant' && <span className="aichat-bot-avatar">🤖</span>}
                    <div className={`aichat-bubble ${m.role}`}>{m.content}</div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="aichat-bubble-wrap assistant">
                    <span className="aichat-bot-avatar">🤖</span>
                    <div className="aichat-bubble assistant aichat-typing">
                      <span/><span/><span/>
                    </div>
                  </div>
                )}
                <div ref={aiBottomRef} />
              </div>
              <div className="aichat-input-row">
                <input
                  className="aichat-input"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage() } }}
                  placeholder="질문을 입력하세요..."
                  disabled={aiLoading}
                />
                <button className="aichat-send" onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}>전송</button>
              </div>
            </div>
          </div>
        )}

        {/* 1:1 채팅 상담 */}
        {csTab === 'inquiry' && (
          <ChatWidget user={user} onGoLogin={onGoLogin} />
        )}

        {/* 내 문의 내역 */}
        {csTab === 'myinquiry' && (
          <div className="cs-section">
            <h2 className="cs-form-title">내 문의 내역</h2>
            {!user ? (
              <div className="cs-empty-box">
                <p>로그인 후 이용 가능합니다.</p>
                <button className="cs-btn primary" onClick={onGoLogin}>로그인하기</button>
              </div>
            ) : inquiryLoading ? (
              <p className="cs-empty">불러오는 중...</p>
            ) : myInquiries.length === 0 ? (
              <p className="cs-empty">문의 내역이 없습니다.</p>
            ) : (
              <div className="cs-inq-list">
                {myInquiries.map(inq => (
                  <div key={inq.id} className="cs-inq-card">
                    <div className="cs-inq-top">
                      <span className="cs-inq-cat">{inq.category}</span>
                      <span className={`cs-inq-status ${STATUS_CLS[inq.status] ?? 'pending'}`}>
                        {STATUS_TXT[inq.status] ?? inq.status}
                      </span>
                      <span className="cs-inq-date">{formatDate(inq.created_at)}</span>
                    </div>
                    <h4 className="cs-inq-subject">{inq.subject}</h4>
                    <p className="cs-inq-content">{inq.content}</p>
                    {inq.answer && (
                      <div className="cs-inq-answer">
                        <span className="cs-inq-answer-label">답변</span>
                        <p>{inq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
