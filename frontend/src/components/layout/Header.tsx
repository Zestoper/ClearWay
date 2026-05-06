import { useState, useRef, useEffect } from 'react'
import './Header.css'
import type { Page } from '../../App'
import type { User } from '../../services/auth'

interface HeaderProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  user: User | null
  onGoLogin: () => void
  onLogout: () => void
}

export default function Header({ currentPage, onNavigate, user, onGoLogin, onLogout }: HeaderProps) {
  const isLoggedIn = user !== null
  const initial = user ? user.name.charAt(0) : ''
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="header">
      <div className="header-inner">
        <button className="logo" onClick={() => onNavigate('home')}>CLEAR<span className="logo-accent">WAY</span></button>
        <nav className="nav">
          <button className={currentPage === 'booking'      ? 'active' : ''} onClick={() => onNavigate('booking')}>항공권 예매</button>
          <button className={currentPage === 'reservations' ? 'active' : ''} onClick={() => onNavigate('reservations')}>내 예약</button>
          <button className={currentPage === 'checkin'      ? 'active' : ''} onClick={() => onNavigate('checkin')}>체크인</button>
          <button className={currentPage === 'notice'       ? 'active' : ''} onClick={() => onNavigate('notice')}>공지/이벤트</button>
          <button className={currentPage === 'csevice'       ? 'active' : ''} onClick={() => onNavigate('csevice')}>고객센터</button>
          <button className={currentPage === 'flight-status' ? 'active' : ''} onClick={() => onNavigate('flight-status')}>항공편 현황</button>
          <button className={`nav-nextrip ${currentPage === 'nextrip' ? 'active' : ''}`} onClick={() => onNavigate('nextrip')}>NEXTRIP ✦</button>
        </nav>

        {isLoggedIn ? (
          <div className="avatar-wrap" ref={dropdownRef}>
            <button
              className="avatar-btn"
              onClick={() => setDropdownOpen(prev => !prev)}
              aria-label="내 계정"
            >
              {initial}
            </button>

            {dropdownOpen && (
              <div className="avatar-dropdown">
                <div className="dropdown-profile">
                  <span className="dropdown-avatar">{initial}</span>
                  <div>
                    <p className="dropdown-name">{user?.name}</p>
                    <p className="dropdown-email">{user?.email}</p>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => { onNavigate('mypage'); setDropdownOpen(false) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  마이페이지
                </button>
                <button className="dropdown-item" onClick={() => { onNavigate('reservations'); setDropdownOpen(false) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  내 예약 확인
                </button>
                {user?.is_admin && (
                  <>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item dropdown-admin" onClick={() => { onNavigate('admin'); setDropdownOpen(false) }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                      </svg>
                      관리자 대시보드
                    </button>
                  </>
                )}
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item dropdown-logout"
                  onClick={() => { onLogout(); setDropdownOpen(false) }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  로그아웃
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="login-btn" onClick={onGoLogin}>
            로그인
          </button>
        )}
      </div>
    </header>
  )
}
