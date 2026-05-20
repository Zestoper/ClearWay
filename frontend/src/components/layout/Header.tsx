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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  const navigate = (page: Page) => {
    onNavigate(page)
    setMobileMenuOpen(false)
  }

  const navItems: { page: Page; label: string; className?: string }[] = [
    { page: 'booking',       label: '항공권 예매' },
    { page: 'reservations',  label: '내 예약' },
    { page: 'checkin',       label: '체크인' },
    { page: 'notice',        label: '공지/이벤트' },
    { page: 'csevice',       label: '고객센터' },
    { page: 'flight-status', label: '항공편 현황' },
    { page: 'nextrip',       label: 'NEXTRIP ✦', className: 'nav-nextrip' },
  ]

  return (
    <>
    <header className="header">
      <div className="header-inner">
        <button className="logo" onClick={() => navigate('home')}>
          CLEAR<span className="logo-accent">WAY</span>
        </button>

        {/* Desktop nav */}
        <nav className="nav">
          {navItems.map(({ page, label, className }) => (
            <button
              key={page}
              className={[className, currentPage === page ? 'active' : ''].filter(Boolean).join(' ')}
              onClick={() => onNavigate(page)}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Desktop right */}
        <div className="header-right">
          {isLoggedIn ? (
            <div className="avatar-wrap" ref={dropdownRef}>
              <button className="avatar-btn" onClick={() => setDropdownOpen(prev => !prev)} aria-label="내 계정">
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
                  <button className="dropdown-item dropdown-logout" onClick={() => { onLogout(); setDropdownOpen(false) }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="login-btn" onClick={onGoLogin}>로그인</button>
          )}
        </div>

        {/* Hamburger */}
        <button
          className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label="메뉴"
        >
          <span /><span /><span />
        </button>
      </div>

    </header>

      {/* Mobile menu - outside header to avoid z-index stacking context */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav">
            {navItems.map(({ page, label, className }) => (
              <button
                key={page}
                className={[className, currentPage === page ? 'active' : ''].filter(Boolean).join(' ')}
                onClick={() => navigate(page)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="mobile-menu-footer">
            {isLoggedIn ? (
              <>
                <div className="mobile-user-info">
                  <span className="mobile-avatar">{initial}</span>
                  <div>
                    <p className="mobile-user-name">{user?.name}</p>
                    <p className="mobile-user-email">{user?.email}</p>
                  </div>
                </div>
                <button className="mobile-menu-btn" onClick={() => navigate('mypage')}>마이페이지</button>
                <button className="mobile-menu-btn" onClick={() => navigate('reservations')}>내 예약 확인</button>
                {user?.is_admin && (
                  <button className="mobile-menu-btn mobile-admin-btn" onClick={() => navigate('admin')}>관리자 대시보드</button>
                )}
                <button className="mobile-menu-btn mobile-logout-btn" onClick={() => { onLogout(); setMobileMenuOpen(false) }}>로그아웃</button>
              </>
            ) : (
              <button className="mobile-login-btn" onClick={() => { onGoLogin(); setMobileMenuOpen(false) }}>로그인</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
