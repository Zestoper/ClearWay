import { useState, useEffect } from 'react'
import './AdminPage.css'
import { api } from '../../services/api'
import type { User } from '../../services/auth'
import ChatWidget from './ChatWidget'
import { useToast } from '../common/ToastProvider'

const DEST_GROUPS: { region: string; airports: { code: string; city: string; country: string }[] }[] = [
  { region: '일본', airports: [
    { code: 'NRT', city: '도쿄', country: '나리타국제공항' },
    { code: 'HND', city: '도쿄', country: '하네다공항' },
    { code: 'KIX', city: '오사카', country: '간사이국제공항' },
    { code: 'FUK', city: '후쿠오카', country: '후쿠오카공항' },
    { code: 'CTS', city: '삿포로', country: '신치토세공항' },
  ]},
  { region: '중국·대만·홍콩', airports: [
    { code: 'PEK', city: '베이징', country: '수도국제공항' },
    { code: 'PVG', city: '상하이', country: '푸동국제공항' },
    { code: 'CAN', city: '광저우', country: '바이윈국제공항' },
    { code: 'TPE', city: '타이베이', country: '타오위안국제공항' },
    { code: 'HKG', city: '홍콩', country: '홍콩국제공항' },
  ]},
  { region: '동남아시아', airports: [
    { code: 'BKK', city: '방콕', country: '수완나품국제공항' },
    { code: 'DMK', city: '방콕', country: '돈므앙공항' },
    { code: 'SGN', city: '호치민', country: '탄손낫국제공항' },
    { code: 'HAN', city: '하노이', country: '노이바이국제공항' },
    { code: 'DAD', city: '다낭', country: '다낭국제공항' },
    { code: 'MNL', city: '마닐라', country: '니노이아키노국제공항' },
    { code: 'CEB', city: '세부', country: '막탄세부국제공항' },
    { code: 'SIN', city: '싱가포르', country: '창이국제공항' },
    { code: 'KUL', city: '쿠알라룸푸르', country: 'KLIA' },
  ]},
  { region: '미주', airports: [
    { code: 'JFK', city: '뉴욕', country: '케네디국제공항' },
    { code: 'LAX', city: '로스앤젤레스', country: '국제공항' },
    { code: 'SFO', city: '샌프란시스코', country: '국제공항' },
    { code: 'ORD', city: '시카고', country: '오헤어국제공항' },
    { code: 'SEA', city: '시애틀', country: '터코마국제공항' },
  ]},
  { region: '유럽', airports: [
    { code: 'LHR', city: '런던', country: '히드로공항' },
    { code: 'CDG', city: '파리', country: '샤를 드 골 공항' },
    { code: 'FRA', city: '프랑크푸르트', country: '국제공항' },
    { code: 'FCO', city: '로마', country: '피우미치노공항' },
  ]},
  { region: '오세아니아', airports: [
    { code: 'SYD', city: '시드니', country: '킹스포드스미스공항' },
    { code: 'MEL', city: '멜버른', country: '국제공항' },
  ]},
]

type AdminTab = 'dashboard' | 'flights' | 'members' | 'bookings' | 'revenue' | 'newsletter' | 'notices' | 'chat'

interface Flight {
  id: number; flight_no: string; from_code: string; to_city: string; to_code: string; to_airport: string
  date: string; depart_time: string; arrival_time: string; duration: string
  economy_price: number; business_price: number; economy_seats: number; business_seats: number; is_cancelled: boolean
}
interface Stats { total_flights: number; total_bookings: number; total_users: number; total_revenue: number }
interface Member { id: number; name: string; email: string; tier: string; miles: number; created_at: string; booking_count: number; total_spent: number }
interface AdminBooking {
  id: number; booking_ref: string; fare_class: string; passenger_name_ko: string; status: string; price: number
  flight: { flight_no: string; from_code: string; to_code: string; date: string; depart_time: string }
}
interface PopularRoute { from_code: string; to_code: string; from_city: string; to_city: string; count: number }
type RevItem = { date?: string; week_start?: string; month?: string; revenue: number }
interface RevenueStats {
  daily: RevItem[]
  weekly: RevItem[]
  monthly: RevItem[]
}

interface Props { user: User | null; onGoLogin: () => void }

const STATUS_CLS: Record<string, string> = { confirmed: 'confirmed', checked_in: 'checkin', completed: 'completed', cancelled: 'cancelled' }
const STATUS_TXT: Record<string, string> = { confirmed: '예약확정', checked_in: '체크인', completed: '탑승완료', cancelled: '취소됨' }
const TIER_COLOR: Record<string, string> = { BLUE: '#1d4ed8', RED: '#dc2626', RAINBOW: '#7c3aed' }

export default function AdminPage({ user, onGoLogin }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)
  const [flights, setFlights] = useState<Flight[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [adminBookings, setAdminBookings] = useState<AdminBooking[]>([])
  const [revenue, setRevenue] = useState<RevenueStats | null>(null)
  const [popular, setPopular] = useState<PopularRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Flight>>({})
  const [filterDate, setFilterDate] = useState('')
  const [filterCode, setFilterCode] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')
  const [revPeriod, setRevPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [saveMsg, setSaveMsg] = useState('')

  // newsletter
  const [nlSubject, setNlSubject]   = useState('')
  const [nlContent, setNlContent]   = useState('')
  const [nlTier, setNlTier]         = useState('')
  const [nlSending, setNlSending]   = useState(false)
  const [nlLogs, setNlLogs]         = useState<{ id: number; subject: string; recipient_tier: string | null; sent_count: number; created_at: string }[]>([])
  const [nlSubscribers, setNlSubscribers] = useState<{ id: number; name: string; email: string; tier: string; created_at: string }[]>([])
  const [nlSubTab, setNlSubTab]     = useState<'send' | 'subscribers'>('send')
  const [nlPickerOpen, setNlPickerOpen] = useState(false)
  const [nlNotices, setNlNotices]   = useState<{ id: number; category: string; title: string; content: string; badge: string | null }[]>([])
  const [nlPickerFilter, setNlPickerFilter] = useState('')

  // notices
  interface NoticeItem { id: number; category: string; title: string; content: string; badge: string | null; is_active: boolean; created_at: string }
  const BLANK_NOTICE = { category: 'notice', title: '', content: '', badge: '', is_active: true }
  const [noticeList, setNoticeList]       = useState<NoticeItem[]>([])
  const [noticeForm, setNoticeForm]       = useState<typeof BLANK_NOTICE>(BLANK_NOTICE)
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null)
  const [noticeSaving, setNoticeSaving]   = useState(false)

  // chat
  const [chatRooms, setChatRooms]       = useState<{ id: number; user_name: string; category: string; status: string; admin_unread: number; last_message: string | null; updated_at: string }[]>([])
  const [activeChatRoom, setActiveChatRoom] = useState<number | null>(null)
  const [chatFilter, setChatFilter]     = useState<'open' | 'closed' | 'all'>('open')

  // 채팅 미읽음 폴링 (30초마다, 어느 탭에 있든)
  useEffect(() => {
    if (!user?.is_admin) return
    const id = setInterval(() => {
      api.get<typeof chatRooms>('/chat/rooms').then(setChatRooms).catch(() => {})
    }, 30000)
    return () => clearInterval(id)
  }, [user])

  useEffect(() => {
    if (!user?.is_admin) return
    Promise.all([
      api.get<Stats>('/admin/stats'),
      api.get<Flight[]>('/admin/flights'),
      api.get<PopularRoute[]>('/admin/popular-routes'),
    ]).then(([s, f, p]) => { setStats(s); setFlights(f); setPopular(p) }).finally(() => setLoading(false))
  }, [user])

  function loadTab(t: AdminTab) {
    setTab(t)
    if (t === 'members' && members.length === 0)
      api.get<Member[]>('/admin/members').then(setMembers).catch(() => {})
    if (t === 'bookings' && adminBookings.length === 0)
      api.get<AdminBooking[]>('/admin/bookings').then(setAdminBookings).catch(() => {})
    if (t === 'revenue') {
      if (!revenue) api.get<RevenueStats>('/admin/revenue-stats').then(setRevenue).catch(() => {})
      if (popular.length === 0) api.get<PopularRoute[]>('/admin/popular-routes').then(setPopular).catch(() => {})
    }
    if (t === 'newsletter') {
      api.get<typeof nlLogs>('/admin/newsletter').then(setNlLogs).catch(() => {})
      api.get<typeof nlSubscribers>('/admin/newsletter/subscribers').then(setNlSubscribers).catch(() => {})
    }
    if (t === 'notices')
      api.get<NoticeItem[]>('/notices?show_all=true').then(setNoticeList).catch(() => {})
    if (t === 'chat')
      api.get<typeof chatRooms>('/chat/rooms').then(setChatRooms).catch(() => {})
  }

  function startEditNotice(n: NoticeItem) {
    setEditingNoticeId(n.id)
    setNoticeForm({ category: n.category, title: n.title, content: n.content, badge: n.badge ?? '', is_active: n.is_active })
  }

  function cancelEditNotice() {
    setEditingNoticeId(null)
    setNoticeForm(BLANK_NOTICE)
  }

  async function saveNotice() {
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) return
    setNoticeSaving(true)
    const body = { ...noticeForm, badge: noticeForm.badge.trim() || null }
    try {
      if (editingNoticeId) {
        const updated = await api.put<NoticeItem>(`/notices/${editingNoticeId}`, body)
        setNoticeList(prev => prev.map(n => n.id === editingNoticeId ? updated : n))
      } else {
        const created = await api.post<NoticeItem>('/notices', body)
        setNoticeList(prev => [created, ...prev])
      }
      cancelEditNotice()
    } catch { toast('저장에 실패했습니다.', 'error') }
    finally { setNoticeSaving(false) }
  }

  async function deleteNotice(id: number) {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await api.delete(`/notices/${id}`)
      setNoticeList(prev => prev.filter(n => n.id !== id))
    } catch { toast('삭제에 실패했습니다.', 'error') }
  }

  async function toggleNoticeActive(n: NoticeItem) {
    try {
      const updated = await api.put<NoticeItem>(`/notices/${n.id}`, { is_active: !n.is_active })
      setNoticeList(prev => prev.map(x => x.id === n.id ? updated : x))
    } catch { toast('변경에 실패했습니다.', 'error') }
  }

  async function sendNewsletter() {
    if (!nlSubject.trim() || !nlContent.trim()) return
    setNlSending(true)
    try {
      await api.post('/admin/newsletter', { subject: nlSubject, content: nlContent, recipient_tier: nlTier || null })
      setNlSubject(''); setNlContent(''); setNlTier('')
      toast('뉴스레터가 발송되었습니다.', 'success')
      api.get<typeof nlLogs>('/admin/newsletter').then(setNlLogs).catch(() => {})
    } catch (e) { toast(e instanceof Error ? e.message : '오류 발생', 'error') }
    finally { setNlSending(false) }
  }

  const filteredChatRooms = chatRooms.filter(r =>
    chatFilter === 'all' ? true : r.status === chatFilter
  )

  function loadFlights() {
    const p = new URLSearchParams()
    if (filterDate) p.set('flight_date', filterDate)
    if (filterCode) p.set('to_code', filterCode.toUpperCase())
    api.get<Flight[]>(`/admin/flights?${p}`).then(setFlights)
  }

  async function saveEdit(id: number) {
    try {
      await api.put<Flight>(`/admin/flights/${id}`, editForm)
      setSaveMsg('저장 완료'); setTimeout(() => setSaveMsg(''), 2000)
      setEditId(null); loadFlights()
    } catch (e) { toast(e instanceof Error ? e.message : '오류 발생', 'error') }
  }

  async function cancelFlight(id: number) {
    if (!confirm('운항 중단 처리하시겠습니까?')) return
    await api.put<Flight>(`/admin/flights/${id}`, { is_cancelled: true }); loadFlights()
  }

  async function resumeFlight(id: number) {
    await api.put<Flight>(`/admin/flights/${id}`, { is_cancelled: false }); loadFlights()
  }

  if (!user) return (
    <main className="admin-page">
      <div className="page-topbar"><div className="page-topbar-inner"><h1>관리자</h1></div></div>
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: '#6b7280', marginBottom: 16 }}>로그인이 필요합니다.</p>
        <button onClick={onGoLogin} className="admin-btn primary">로그인하기</button>
      </div>
    </main>
  )

  if (!user.is_admin) return (
    <main className="admin-page">
      <div className="page-topbar"><div className="page-topbar-inner"><h1>관리자</h1></div></div>
      <div style={{ textAlign: 'center', padding: 80, color: '#ef4444' }}>관리자 권한이 없습니다.</div>
    </main>
  )

  const filteredMembers = members.filter(m =>
    m.name.includes(memberSearch) || m.email.includes(memberSearch)
  )
  const filteredBookings = adminBookings.filter(b =>
    b.booking_ref.includes(bookingSearch.toUpperCase()) || b.passenger_name_ko.includes(bookingSearch)
  )

  const revData = revenue ? revenue[revPeriod] : []
  const maxRev = Math.max(...revData.map(r => r.revenue), 1)

  return (
    <main className="admin-page">
      <div className="page-topbar">
        <div className="page-topbar-inner">
          <h1>관리자 대시보드</h1>
          {saveMsg && <span className="save-msg">{saveMsg}</span>}
        </div>
      </div>

      {/* 탭 */}
      <div className="admin-tabs-bar">
        <div className="admin-tabs">
          {([
            { id: 'dashboard',  label: '대시보드' },
            { id: 'flights',    label: '항공편 관리' },
            { id: 'members',    label: '회원 관리' },
            { id: 'bookings',   label: '예약 관리' },
            { id: 'revenue',    label: '매출 통계' },
            { id: 'newsletter', label: '뉴스레터' },
            { id: 'notices',    label: '공지/이벤트' },
            { id: 'chat',       label: '채팅 관리' },
          ] as { id: AdminTab; label: string }[]).map(t => {
            const chatUnread = t.id === 'chat' ? chatRooms.reduce((s, r) => s + (r.admin_unread || 0), 0) : 0
            return (
              <button
                key={t.id}
                className={`admin-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => loadTab(t.id)}
              >
                {t.label}
                {chatUnread > 0 && <span className="admin-tab-badge">{chatUnread}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="admin-body">

        {/* ── 대시보드 탭 ── */}
        {tab === 'dashboard' && (
          <>
            {stats && (
              <div className="admin-stats-row">
                {[
                  { label: '총 항공편', value: stats.total_flights.toLocaleString(), color: '#1d4ed8' },
                  { label: '총 예약',   value: stats.total_bookings.toLocaleString(), color: '#059669' },
                  { label: '총 회원',   value: stats.total_users.toLocaleString(),    color: '#7c3aed' },
                  { label: '총 매출',   value: `₩${stats.total_revenue.toLocaleString()}`, color: '#dc2626' },
                ].map(s => (
                  <div key={s.label} className="admin-stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
                    <p className="admin-stat-value" style={{ color: s.color }}>{s.value}</p>
                    <p className="admin-stat-label">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="admin-section">
              <div className="admin-section-header"><h2>인기 노선 TOP 5</h2></div>
              {popular.length === 0 ? (
                <button className="admin-btn secondary" onClick={() => api.get<PopularRoute[]>('/admin/popular-routes').then(setPopular)}>불러오기</button>
              ) : (
                <div className="admin-popular-routes">
                  {popular.slice(0, 5).map((r, i) => (
                    <div key={i} className="popular-route-row">
                      <span className="popular-rank">#{i + 1}</span>
                      <span className="popular-route-name">{r.from_city} ({r.from_code}) → {r.to_city} ({r.to_code})</span>
                      <div className="popular-bar-wrap">
                        <div className="popular-bar" style={{ width: `${(r.count / popular[0].count) * 100}%` }} />
                      </div>
                      <span className="popular-count">{r.count}건</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 항공편 관리 탭 ── */}
        {tab === 'flights' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>항공편 관리</h2>
              <div className="admin-filters">
                <input type="date" className="admin-filter-input" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                <select className="admin-filter-input" value={filterCode} onChange={e => setFilterCode(e.target.value)}>
                  <option value="">전체 목적지</option>
                  {DEST_GROUPS.map(g => (
                    <optgroup key={g.region} label={g.region}>
                      {g.airports.map(a => (
                        <option key={a.code} value={a.code}>{a.city} ({a.code}) {a.country}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button className="admin-btn secondary" onClick={loadFlights}>조회</button>
              </div>
            </div>
            {loading ? <p className="admin-loading">불러오는 중...</p> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr>
                    <th>편명</th><th>노선</th><th>날짜</th><th>출발</th><th>도착</th>
                    <th>이코노미가</th><th>비즈니스가</th><th>이코노미석</th><th>비즈니스석</th><th>상태</th><th>액션</th>
                  </tr></thead>
                  <tbody>
                    {flights.map(f => (
                      <tr key={f.id} className={f.is_cancelled ? 'cancelled-row' : ''}>
                        <td>{f.flight_no}</td>
                        <td>{f.from_code ?? 'ICN'} → {f.to_code}</td>
                        <td>{editId === f.id ? <input className="admin-cell-input" value={editForm.date ?? f.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} type="date" /> : f.date}</td>
                        <td>{editId === f.id ? <input className="admin-cell-input w-20" value={editForm.depart_time ?? f.depart_time} onChange={e => setEditForm(p => ({ ...p, depart_time: e.target.value }))} /> : f.depart_time}</td>
                        <td>{editId === f.id ? <input className="admin-cell-input w-20" value={editForm.arrival_time ?? f.arrival_time} onChange={e => setEditForm(p => ({ ...p, arrival_time: e.target.value }))} /> : f.arrival_time}</td>
                        <td>{editId === f.id ? <input className="admin-cell-input w-28" type="number" value={editForm.economy_price ?? f.economy_price} onChange={e => setEditForm(p => ({ ...p, economy_price: Number(e.target.value) }))} /> : `₩${Number(f.economy_price).toLocaleString()}`}</td>
                        <td>{editId === f.id ? <input className="admin-cell-input w-28" type="number" value={editForm.business_price ?? f.business_price} onChange={e => setEditForm(p => ({ ...p, business_price: Number(e.target.value) }))} /> : `₩${Number(f.business_price).toLocaleString()}`}</td>
                        <td className={f.economy_seats <= 10 ? 'low-seat' : ''}>
                          {editId === f.id ? <input className="admin-cell-input w-16" type="number" value={editForm.economy_seats ?? f.economy_seats} onChange={e => setEditForm(p => ({ ...p, economy_seats: Number(e.target.value) }))} /> : (f.economy_seats <= 10 ? <strong style={{ color: '#dc2626' }}>{f.economy_seats}석 ⚠</strong> : f.economy_seats)}
                        </td>
                        <td className={f.business_seats <= 3 ? 'low-seat' : ''}>
                          {editId === f.id ? <input className="admin-cell-input w-16" type="number" value={editForm.business_seats ?? f.business_seats} onChange={e => setEditForm(p => ({ ...p, business_seats: Number(e.target.value) }))} /> : (f.business_seats <= 3 ? <strong style={{ color: '#dc2626' }}>{f.business_seats}석 ⚠</strong> : f.business_seats)}
                        </td>
                        <td><span className={`status-badge ${f.is_cancelled ? 'cancelled' : 'active'}`}>{f.is_cancelled ? '운항중단' : '운항중'}</span></td>
                        <td className="action-cell">
                          {editId === f.id ? (
                            <><button className="admin-btn primary sm" onClick={() => saveEdit(f.id)}>저장</button><button className="admin-btn ghost sm" onClick={() => setEditId(null)}>취소</button></>
                          ) : (
                            <><button className="admin-btn secondary sm" onClick={() => { setEditId(f.id); setEditForm({}) }}>수정</button>
                            {f.is_cancelled ? <button className="admin-btn primary sm" onClick={() => resumeFlight(f.id)}>재개</button> : <button className="admin-btn danger sm" onClick={() => cancelFlight(f.id)}>중단</button>}</>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── 회원 관리 탭 ── */}
        {tab === 'members' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>회원 관리 <span className="admin-count">{members.length}명</span></h2>
              <input className="admin-filter-input" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="이름 또는 이메일 검색" style={{ width: 220 }} />
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>이름</th><th>이메일</th><th>등급</th><th>마일리지</th><th>예약 수</th><th>총 결제</th><th>가입일</th></tr></thead>
                <tbody>
                  {filteredMembers.map(m => (
                    <tr key={m.id}>
                      <td><strong>{m.name}</strong></td>
                      <td style={{ color: '#6b7280', fontSize: 13 }}>{m.email}</td>
                      <td><span className="admin-tier-badge" style={{ color: TIER_COLOR[m.tier] ?? '#374151', borderColor: TIER_COLOR[m.tier] ?? '#e5e7eb' }}>{m.tier}</span></td>
                      <td>{(m.miles ?? 0).toLocaleString()}</td>
                      <td>{m.booking_count}</td>
                      <td>₩{Math.round(m.total_spent).toLocaleString()}</td>
                      <td style={{ fontSize: 12, color: '#9ca3af' }}>{m.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 예약 관리 탭 ── */}
        {tab === 'bookings' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>예약 관리 <span className="admin-count">{adminBookings.length}건</span></h2>
              <input className="admin-filter-input" value={bookingSearch} onChange={e => setBookingSearch(e.target.value)} placeholder="예약번호 또는 승객명" style={{ width: 220 }} />
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>예약번호</th><th>항공편</th><th>노선</th><th>날짜</th><th>승객명</th><th>등급</th><th>금액</th><th>상태</th></tr></thead>
                <tbody>
                  {filteredBookings.map(b => (
                    <tr key={b.id}>
                      <td><strong style={{ fontFamily: 'monospace' }}>{b.booking_ref}</strong></td>
                      <td>{b.flight.flight_no}</td>
                      <td>{b.flight.from_code} → {b.flight.to_code}</td>
                      <td style={{ fontSize: 12 }}>{b.flight.date}</td>
                      <td>{b.passenger_name_ko}</td>
                      <td>{b.fare_class === 'economy' ? '일반석' : '비즈니스석'}</td>
                      <td>₩{Number(b.price).toLocaleString()}</td>
                      <td><span className={`status-badge ${STATUS_CLS[b.status] ?? 'completed'}`}>{STATUS_TXT[b.status] ?? b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 매출 통계 탭 ── */}
        {tab === 'revenue' && (
          <>
            <div className="admin-section">
              <div className="admin-section-header">
                <h2>매출 통계</h2>
                <div className="admin-period-toggle">
                  {(['daily', 'weekly', 'monthly'] as const).map(p => (
                    <button key={p} className={`period-btn ${revPeriod === p ? 'active' : ''}`} onClick={() => setRevPeriod(p)}>
                      {p === 'daily' ? '일간' : p === 'weekly' ? '주간' : '월간'}
                    </button>
                  ))}
                </div>
              </div>
              {revenue ? (
                <>
                  <div className="rev-total-box">
                    <span>기간 총 매출</span>
                    <strong>₩{revData.reduce((s, r) => s + r.revenue, 0).toLocaleString()}</strong>
                  </div>
                  <div className="rev-chart">
                    {revData.map((r, i) => (
                      <div key={i} className="rev-bar-item" title={`₩${r.revenue.toLocaleString()}`}>
                        <div className="rev-bar-wrap">
                          <div className="rev-bar-fill" style={{ width: `${(r.revenue / maxRev) * 100}%` }} />
                        </div>
                        <span className="rev-bar-label">
                          {revPeriod === 'daily' ? r.date?.slice(5) : revPeriod === 'weekly' ? r.week_start?.slice(5) : r.month}
                        </span>
                        <span className="rev-bar-val">{r.revenue > 0 ? `₩${Math.round(r.revenue / 10000)}만` : '-'}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="admin-loading">불러오는 중...</p>}
            </div>

            {popular.length > 0 && (
              <div className="admin-section">
                <div className="admin-section-header"><h2>인기 노선 TOP 10</h2></div>
                <div className="admin-popular-routes">
                  {popular.map((r, i) => (
                    <div key={i} className="popular-route-row">
                      <span className="popular-rank">#{i + 1}</span>
                      <span className="popular-route-name">{r.from_city} ({r.from_code}) → {r.to_city} ({r.to_code})</span>
                      <div className="popular-bar-wrap">
                        <div className="popular-bar" style={{ width: `${(r.count / popular[0].count) * 100}%` }} />
                      </div>
                      <span className="popular-count">{r.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 뉴스레터 탭 ── */}
        {tab === 'newsletter' && (
          <div className="admin-section">
            <div className="admin-section-header"><h2>뉴스레터</h2></div>

            <div className="nl-sub-tabs">
              <button className={`nl-sub-tab ${nlSubTab === 'send' ? 'active' : ''}`} onClick={() => setNlSubTab('send')}>발송하기</button>
              <button className={`nl-sub-tab ${nlSubTab === 'subscribers' ? 'active' : ''}`} onClick={() => setNlSubTab('subscribers')}>
                구독자 목록 <span className="nl-badge">{nlSubscribers.length}</span>
              </button>
            </div>

            {nlSubTab === 'send' && (
              <>
                <div className="nl-form">
                  <div className="nl-form-row">
                    <label className="nl-label">제목</label>
                    <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                      <input className="nl-input" style={{ flex: 1 }} value={nlSubject} onChange={e => setNlSubject(e.target.value)} placeholder="이메일 제목을 입력하세요" />
                      <button
                        className="admin-btn ghost sm nl-import-btn"
                        onClick={() => {
                          if (nlNotices.length === 0) {
                            api.get<typeof nlNotices>('/notices').then(setNlNotices).catch(() => {})
                          }
                          setNlPickerOpen(true)
                        }}
                      >
                        공지/이벤트 가져오기
                      </button>
                    </div>
                  </div>
                  <div className="nl-form-row">
                    <label className="nl-label">수신 등급</label>
                    <select className="nl-select" value={nlTier} onChange={e => setNlTier(e.target.value)}>
                      <option value="">전체 구독자</option>
                      <option value="BLUE">BLUE 등급</option>
                      <option value="RED">RED 등급</option>
                      <option value="RAINBOW">RAINBOW 등급</option>
                    </select>
                  </div>
                  <div className="nl-form-row">
                    <label className="nl-label">내용</label>
                    <textarea className="nl-textarea" rows={6} value={nlContent} onChange={e => setNlContent(e.target.value)} placeholder="뉴스레터 본문을 입력하세요" />
                  </div>
                  <button className="admin-btn primary" onClick={sendNewsletter} disabled={nlSending || !nlSubject.trim() || !nlContent.trim()}>
                    {nlSending ? '발송 중...' : `발송하기 (구독자 ${nlSubscribers.length}명)`}
                  </button>
                </div>

                {/* ── 공지/이벤트 picker 모달 ── */}
                {nlPickerOpen && (
                  <div className="nl-picker-overlay" onClick={() => setNlPickerOpen(false)}>
                    <div className="nl-picker-modal" onClick={e => e.stopPropagation()}>
                      <div className="nl-picker-header">
                        <h3>공지 / 이벤트 가져오기</h3>
                        <button className="mp-modal-close" onClick={() => setNlPickerOpen(false)}>✕</button>
                      </div>
                      <div className="nl-picker-search">
                        <input
                          className="nl-input"
                          placeholder="제목 검색..."
                          value={nlPickerFilter}
                          onChange={e => setNlPickerFilter(e.target.value)}
                          autoFocus
                        />
                        <div className="nl-picker-cats">
                          {['', 'notice', 'event', 'promotion', 'membership'].map(cat => (
                            <button
                              key={cat}
                              className={`nl-cat-chip ${nlPickerFilter === cat ? 'active' : ''}`}
                              onClick={() => setNlPickerFilter(cat)}
                            >
                              {cat === '' ? '전체' : cat === 'notice' ? '공지' : cat === 'event' ? '이벤트' : cat === 'promotion' ? '프로모션' : '멤버십'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="nl-picker-list">
                        {nlNotices
                          .filter(n => {
                            if (!nlPickerFilter) return true
                            if (['notice','event','promotion','membership'].includes(nlPickerFilter)) return n.category === nlPickerFilter
                            return n.title.includes(nlPickerFilter) || n.content.includes(nlPickerFilter)
                          })
                          .map(n => (
                            <button
                              key={n.id}
                              className="nl-picker-item"
                              onClick={() => {
                                setNlSubject(n.title)
                                setNlContent(n.content)
                                setNlPickerOpen(false)
                                setNlPickerFilter('')
                              }}
                            >
                              <span className={`nl-cat-badge cat-${n.category}`}>
                                {n.category === 'notice' ? '공지' : n.category === 'event' ? '이벤트' : n.category === 'promotion' ? '프로모션' : '멤버십'}
                              </span>
                              {n.badge && <span className="nl-badge-hot">{n.badge}</span>}
                              <span className="nl-picker-title">{n.title}</span>
                              <p className="nl-picker-preview">{n.content.slice(0, 60)}{n.content.length > 60 ? '…' : ''}</p>
                            </button>
                          ))
                        }
                        {nlNotices.length === 0 && (
                          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0', fontSize: 14 }}>등록된 공지/이벤트가 없습니다.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {nlLogs.length > 0 && (
                  <div style={{ marginTop: 32 }}>
                    <h3 className="nl-history-title">발송 내역</h3>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead><tr><th>제목</th><th>수신 등급</th><th>발송 수</th><th>발송일</th></tr></thead>
                        <tbody>
                          {nlLogs.map(l => (
                            <tr key={l.id}>
                              <td>{l.subject}</td>
                              <td>{l.recipient_tier ?? '전체'}</td>
                              <td>{l.sent_count.toLocaleString()}명</td>
                              <td style={{ fontSize: 12, color: '#9ca3af' }}>{l.created_at.slice(0, 10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {nlSubTab === 'subscribers' && (
              <div>
                {nlSubscribers.length === 0 ? (
                  <p className="mp-empty" style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af' }}>구독자가 없습니다.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr><th>이름</th><th>이메일</th><th>등급</th><th>가입일</th></tr>
                      </thead>
                      <tbody>
                        {nlSubscribers.map(s => (
                          <tr key={s.id}>
                            <td>{s.name}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{s.email}</td>
                            <td><span className={`tier-chip tier-chip--${s.tier.toLowerCase()}`}>{s.tier}</span></td>
                            <td style={{ fontSize: 12, color: '#9ca3af' }}>{s.created_at.slice(0, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 공지/이벤트 관리 탭 ── */}
        {tab === 'notices' && (
          <div className="admin-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="admin-section-title">공지 / 이벤트 관리</h2>
              {editingNoticeId === null && (
                <button className="admin-btn primary" onClick={() => { cancelEditNotice(); setEditingNoticeId(0) }}>+ 새 공지 등록</button>
              )}
            </div>

            {/* 등록/수정 폼 */}
            {(editingNoticeId !== null) && (
              <div className="notice-form-box">
                <h3 className="notice-form-title">{editingNoticeId === 0 ? '새 공지 등록' : '공지 수정'}</h3>
                <div className="notice-form-row">
                  <div className="notice-form-group">
                    <label>카테고리</label>
                    <select className="admin-input" value={noticeForm.category} onChange={e => setNoticeForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="notice">📢 공지</option>
                      <option value="event">🎉 이벤트</option>
                      <option value="promotion">🏷 프로모션</option>
                      <option value="membership">⭐ 멤버십</option>
                    </select>
                  </div>
                  <div className="notice-form-group">
                    <label>배지 (선택)</label>
                    <input className="admin-input" placeholder="HOT / NEW / SALE / D-7 등" value={noticeForm.badge} onChange={e => setNoticeForm(f => ({ ...f, badge: e.target.value }))} />
                  </div>
                  <div className="notice-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                    <input type="checkbox" id="notice-active" checked={noticeForm.is_active} onChange={e => setNoticeForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <label htmlFor="notice-active" style={{ fontSize: 13, fontWeight: 600 }}>활성화</label>
                  </div>
                </div>
                <div className="notice-form-group full">
                  <label>제목</label>
                  <input className="admin-input" placeholder="제목을 입력하세요" value={noticeForm.title} onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="notice-form-group full">
                  <label>내용</label>
                  <textarea className="admin-input" rows={5} placeholder="내용을 입력하세요" value={noticeForm.content} onChange={e => setNoticeForm(f => ({ ...f, content: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="admin-btn primary" onClick={saveNotice} disabled={noticeSaving || !noticeForm.title.trim() || !noticeForm.content.trim()}>
                    {noticeSaving ? '저장 중...' : editingNoticeId === 0 ? '등록' : '수정 완료'}
                  </button>
                  <button className="admin-btn ghost" onClick={cancelEditNotice}>취소</button>
                </div>
              </div>
            )}

            {/* 목록 */}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>카테고리</th>
                    <th style={{ width: 60 }}>배지</th>
                    <th>제목</th>
                    <th style={{ width: 80 }}>상태</th>
                    <th style={{ width: 90 }}>등록일</th>
                    <th style={{ width: 120 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {noticeList.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>등록된 공지/이벤트가 없습니다.</td></tr>
                  )}
                  {noticeList.map(n => (
                    <tr key={n.id}>
                      <td>
                        <span className={`notice-cat-badge cat-${n.category}`}>
                          {n.category === 'notice' ? '공지' : n.category === 'event' ? '이벤트' : n.category === 'promotion' ? '프로모션' : '멤버십'}
                        </span>
                      </td>
                      <td>{n.badge ? <span className="notice-badge-pill">{n.badge}</span> : <span style={{ color: '#d1d5db' }}>-</span>}</td>
                      <td style={{ maxWidth: 300 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.content}</p>
                      </td>
                      <td>
                        <button
                          className={`notice-active-toggle ${n.is_active ? 'on' : 'off'}`}
                          onClick={() => toggleNoticeActive(n)}
                        >{n.is_active ? '활성' : '비활성'}</button>
                      </td>
                      <td style={{ fontSize: 12, color: '#94a3b8' }}>{n.created_at.slice(0, 10)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="admin-btn ghost sm" onClick={() => startEditNotice(n)}>수정</button>
                          <button className="admin-btn danger sm" onClick={() => deleteNotice(n.id)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 채팅 관리 탭 ── */}
        {tab === 'chat' && (
          <div className="admin-chat-layout">
            <div className="admin-chat-sidebar">
              <div className="admin-chat-sidebar-header">
                <h2>채팅 상담 목록</h2>
                <div className="admin-chat-filter-row">
                  {(['open', 'closed', 'all'] as const).map(f => (
                    <button
                      key={f}
                      className={`admin-chat-filter ${chatFilter === f ? 'active' : ''}`}
                      onClick={() => setChatFilter(f)}
                    >
                      {f === 'open' ? '진행중' : f === 'closed' ? '종료' : '전체'}
                    </button>
                  ))}
                  <button className="admin-btn ghost sm" onClick={() => api.get<typeof chatRooms>('/chat/rooms').then(setChatRooms).catch(() => {})}>새로고침</button>
                </div>
              </div>
              <div className="admin-chat-room-list">
                {filteredChatRooms.length === 0 ? (
                  <p className="admin-chat-empty">상담 내역이 없습니다.</p>
                ) : filteredChatRooms.map(r => (
                  <div
                    key={r.id}
                    className={`admin-chat-room-row ${activeChatRoom === r.id ? 'active' : ''}`}
                    onClick={() => setActiveChatRoom(r.id)}
                  >
                    <div className="admin-chat-room-top">
                      <span className="admin-chat-room-cat">{r.category}</span>
                      <span className={`chat-room-status ${r.status}`}>{r.status === 'open' ? '진행중' : '종료'}</span>
                      {r.admin_unread > 0 && <span className="admin-chat-unread">{r.admin_unread}</span>}
                    </div>
                    <p className="admin-chat-room-user">{r.user_name || '비회원'}</p>
                    {r.last_message && <p className="admin-chat-room-preview">{r.last_message}</p>}
                    <p className="admin-chat-room-date">{r.updated_at?.slice(0, 10)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-chat-main">
              {activeChatRoom === null ? (
                <div className="admin-chat-placeholder">
                  <p>왼쪽 목록에서 상담을 선택하세요.</p>
                </div>
              ) : (
                <ChatWidget
                  key={activeChatRoom}
                  user={user}
                  onGoLogin={onGoLogin}
                  adminRoomId={activeChatRoom}
                  adminSender="admin"
                />
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
