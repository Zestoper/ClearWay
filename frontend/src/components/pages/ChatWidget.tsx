import { useState, useEffect, useRef, useCallback } from 'react'
import './ChatWidget.css'
import type { User } from '../../services/auth'
import { api } from '../../services/api'
import { useToast } from '../common/ToastProvider'

const CHAT_CATEGORIES = ['예약/발권', '취소/환불', '수하물', '마일리지', '기타']
const WS_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1')
  .replace(/^http/, 'ws')

interface ChatMessage {
  id: number
  sender: 'user' | 'admin'
  content: string
  msg_type: 'text' | 'image'
  created_at: string
}

interface ChatRoom {
  id: number
  category: string
  status: string
  user_unread: number
  created_at: string
}

function isBusinessHours(): boolean {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const mins = h * 60 + m
  return mins >= 9 * 60 + 30 && mins < 17 * 60 + 30
}

interface Props {
  user: User | null
  onGoLogin: () => void
  /** 어드민 모드이면 roomId를 직접 외부에서 주입 */
  adminRoomId?: number
  adminSender?: 'admin'
}

export default function ChatWidget({ user, onGoLogin, adminRoomId, adminSender }: Props) {
  const isAdmin = !!adminSender
  const { toast } = useToast()

  const [phase, setPhase] = useState<'select' | 'chat' | 'history'>(
    adminRoomId ? 'chat' : 'select'
  )
  const [category, setCategory] = useState(CHAT_CATEGORIES[0])
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [roomId, setRoomId] = useState<number | null>(adminRoomId ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [myRooms, setMyRooms] = useState<ChatRoom[]>([])
  const ws = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const scrollBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const connectWS = useCallback((rid: number) => {
    if (ws.current) ws.current.close()
    const token = localStorage.getItem('token') ?? ''
    const url = `${WS_BASE}/chat/ws/${rid}${token ? `?token=${token}` : ''}`
    const sock = new WebSocket(url)
    sock.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'history') {
        setMessages(data.messages)
        scrollBottom()
      } else if (data.type === 'message') {
        setMessages(prev => [...prev, data])
        scrollBottom()
        // 상대방 메시지일 때 토스트 알림
        const mySender = adminSender ?? 'user'
        if (data.sender !== mySender) {
          toast(isAdmin ? '새 메시지: ' + data.content.slice(0, 40) : '상담사 답변이 도착했습니다.', 'info')
        }
      }
    }
    sock.onclose = () => {}
    ws.current = sock
  }, [toast, isAdmin, adminSender])

  useEffect(() => {
    if (roomId !== null) connectWS(roomId)
    return () => { ws.current?.close() }
  }, [roomId, connectWS])

  useEffect(() => {
    if (phase === 'history' && user) {
      api.get<ChatRoom[]>('/chat/rooms/mine').then(setMyRooms).catch(() => {})
    }
  }, [phase, user])

  async function startChat() {
    if (!user && (!guestName.trim() || !guestEmail.trim())) return
    const body: Record<string, string> = { category }
    if (!user) { body.guest_name = guestName; body.guest_email = guestEmail }
    const room = await api.post<ChatRoom>('/chat/rooms', body)
    setRoomId(room.id)
    setPhase('chat')
  }

  function sendText() {
    if (!input.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN) return
    setSending(true)
    ws.current.send(JSON.stringify({ content: input.trim(), msg_type: 'text' }))
    setInput('')
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendText() }
  }

  function sendImage(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return
      ws.current.send(JSON.stringify({ content: reader.result as string, msg_type: 'image' }))
    }
    reader.readAsDataURL(file)
  }

  const outside = !isBusinessHours() && !isAdmin

  // ── 영업시간 외 안내 ──────────────────────────────────────────────────────
  if (outside) {
    return (
      <div className="chat-closed">
        <div className="chat-closed-icon">🕐</div>
        <h3>현재 상담 가능 시간이 아닙니다</h3>
        <p>실시간 상담은 <strong>평일 09:30 ~ 17:30</strong>에 이용 가능합니다.</p>
        <p className="chat-closed-sub">자주 묻는 질문(FAQ)에서 빠른 답변을 찾아보세요.</p>
      </div>
    )
  }

  // ── 채팅방 선택 (phase: select) ───────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="chat-select">
        <div className="chat-select-header">
          <h3>1:1 실시간 채팅 상담</h3>
          <p>문의 유형을 선택하고 채팅을 시작하세요.</p>
        </div>

        {!user && (
          <div className="chat-guest-form">
            <input placeholder="이름" value={guestName} onChange={e => setGuestName(e.target.value)} />
            <input placeholder="이메일" type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} />
          </div>
        )}

        <div className="chat-cats">
          {CHAT_CATEGORIES.map(c => (
            <button key={c} className={`chat-cat ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>

        <button className="chat-start-btn" onClick={startChat} disabled={!user && (!guestName.trim() || !guestEmail.trim())}>
          채팅 시작하기
        </button>

        {user && (
          <button className="chat-history-btn" onClick={() => setPhase('history')}>내 이전 상담 보기</button>
        )}

        {!user && (
          <p className="chat-login-hint">
            <button className="chat-login-link" onClick={onGoLogin}>로그인</button>하면 상담 내역을 관리할 수 있습니다.
          </p>
        )}
      </div>
    )
  }

  // ── 이전 상담 목록 (phase: history) ──────────────────────────────────────
  if (phase === 'history') {
    return (
      <div className="chat-history">
        <button className="chat-back" onClick={() => setPhase('select')}>← 돌아가기</button>
        <h3>내 상담 내역</h3>
        {myRooms.length === 0
          ? <p className="chat-empty">상담 내역이 없습니다.</p>
          : myRooms.map(r => (
            <div key={r.id} className="chat-room-row" onClick={() => { setRoomId(r.id); setPhase('chat') }}>
              <div>
                <span className="chat-room-cat">{r.category}</span>
                <span className={`chat-room-status ${r.status}`}>{r.status === 'open' ? '진행중' : '종료'}</span>
              </div>
              <p className="chat-room-date">{r.created_at.slice(0, 10)}</p>
            </div>
          ))
        }
      </div>
    )
  }

  // ── 채팅방 (phase: chat) ──────────────────────────────────────────────────
  return (
    <div className="chat-room">
      {!isAdmin && (
        <div className="chat-room-topbar">
          <button className="chat-back" onClick={() => setPhase('select')}>← 목록</button>
          <span>CLEARWAY 고객상담</span>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>안녕하세요! CLEARWAY 고객상담입니다 👋</p>
            <p>문의 내용을 입력해 주시면 빠르게 답변 드리겠습니다.</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`chat-bubble-wrap ${m.sender === (isAdmin ? 'admin' : 'user') ? 'mine' : 'theirs'}`}>
            {m.sender !== (isAdmin ? 'admin' : 'user') && (
              <div className="chat-avatar">{isAdmin ? '👤' : '🎧'}</div>
            )}
            <div className={`chat-bubble ${m.sender === (isAdmin ? 'admin' : 'user') ? 'mine' : 'theirs'}`}>
              {m.msg_type === 'image'
                ? <img src={m.content} alt="첨부이미지" className="chat-img" />
                : m.content
              }
            </div>
            <span className="chat-time">{m.created_at ? new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <button className="chat-attach" onClick={() => fileRef.current?.click()} title="사진 첨부">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { sendImage(e.target.files[0]); e.target.value = '' } }} />
        <textarea
          className="chat-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="메시지를 입력하세요… (Enter 전송)"
          rows={1}
        />
        <button className="chat-send" onClick={sendText} disabled={sending || !input.trim()}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  )
}
