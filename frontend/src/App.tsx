import { useState, useEffect } from 'react'
import Header from './components/layout/Header'
import './App.css'
import Home from './components/pages/Home'
import SearchBar from './components/common/SearchBar'
import FlightBooking from './components/pages/FlightBooking'
import BookingFlow from './components/pages/BookingFlow'
import MyReservations from './components/pages/MyReservations'
import CheckIn from './components/pages/CheckIn'
import Nextrip from './components/pages/Nextrip'
import MyPage from './components/pages/MyPage'
import Login from './components/pages/Login'
import AdminPage from './components/pages/AdminPage'
import NoticeEventPage from './components/pages/NoticeEventPage'
import CustomerServicePage from './components/pages/CustomerServicePage'
import FlightStatusPage from './components/pages/FlightStatusPage'
import ReviewPage from './components/pages/ReviewPage'
import AIReviewPage from './components/pages/AIReviewPage'
import ReviewsListPage from './components/pages/ReviewsListPage'
import { ToastProvider } from './components/common/ToastProvider'
import type { BookingFlight, SearchParams } from './types'
import type { User } from './services/auth'
import { fetchMe } from './services/auth'

export type Page =
  | 'home' | 'booking' | 'booking-flow' | 'reservations'
  | 'checkin' | 'nextrip' | 'mypage' | 'login' | 'admin'
  | 'notice' | 'csevice' | 'flight-status' | 'review' | 'ai-review' | 'reviews'

function App() {
  const [page, setPage] = useState<Page>(() => {
    const p = new URLSearchParams(window.location.search).get('p')
    return (p as Page) || 'home'
  })
  const [bookingFlight, setBookingFlight] = useState<BookingFlight | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null)
  const [reservationsInitial, setReservationsInitial] = useState<{ ref: string; lastName: string } | null>(null)
  const [checkinInitial, setCheckinInitial] = useState<{ ref: string; lastName: string } | null>(null)

  // ── 새로고침 시 토큰으로 사용자 복원 ─────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetchMe().then(setUser).catch(() => localStorage.removeItem('token'))
  }, [])

  // ── 브라우저 뒤로가기 지원 ────────────────────────────────────
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const p = (e.state?.page as Page) || 'home'
      setPage(p)
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  function navigate(next: Page) {
    window.history.pushState({ page: next }, '', `?p=${next}`)
    setPage(next)
  }

  function handleBook(flight: BookingFlight) {
    setBookingFlight(flight)
    navigate('booking-flow')
  }

  function handleGoLoginFromBooking(flight: BookingFlight) {
    sessionStorage.setItem('pendingFlight', JSON.stringify(flight))
    navigate('login')
  }

  function handleLogin(token: string, userData: User) {
    localStorage.setItem('token', token)
    setUser(userData)
    const pending = sessionStorage.getItem('pendingFlight')
    if (pending) {
      sessionStorage.removeItem('pendingFlight')
      const f = JSON.parse(pending) as BookingFlight
      setBookingFlight(f)
      navigate('booking-flow')
    } else {
      navigate('home')
    }
  }

  function handleLogout() {
    localStorage.removeItem('token')
    setUser(null)
    navigate('home')
  }

  return (
    <ToastProvider>
      {page !== 'login' && (
        <Header
          currentPage={page}
          onNavigate={navigate}
          user={user}
          onGoLogin={() => navigate('login')}
          onLogout={handleLogout}
        />
      )}
      {page === 'home' && (
        <>
          <SearchBar
            onSearch={p => { setSearchParams(p); navigate('booking') }}
            onGoMyTrips={(ref, lastName) => { setReservationsInitial({ ref: ref ?? '', lastName: lastName ?? '' }); navigate('reservations') }}
            onGoCheckin={(ref, lastName) => { setCheckinInitial({ ref: ref ?? '', lastName: lastName ?? '' }); navigate('checkin') }}
            isLoggedIn={user !== null}
          />
          <Home
            onGoNextrip={() => navigate('nextrip')}
            onGoBooking={(code) => { setSearchParams({ from_code: 'ICN', to_code: code, date: '', tripType: 'roundtrip' }); navigate('booking') }}
            onGoNotice={() => navigate('notice')}
            onGoReview={() => navigate('review')}
            onGoAIReview={() => navigate('ai-review')}
            onGoReviews={() => navigate('reviews')}
          />
        </>
      )}
      {page === 'booking' && (
        <FlightBooking
          onBook={handleBook}
          searchParams={searchParams}
          user={user}
          onGoLogin={() => navigate('login')}
        />
      )}
      {page === 'booking-flow' && bookingFlight && (
        <BookingFlow
          flight={bookingFlight}
          user={user}
          onGoReservations={() => navigate('reservations')}
          onGoHome={() => navigate('home')}
          onGoLogin={() => handleGoLoginFromBooking(bookingFlight)}
          onGoNextrip={() => navigate('nextrip')}
        />
      )}
      {page === 'reservations' && (
        <MyReservations isLoggedIn={user !== null} onGoLogin={() => navigate('login')} onCancelSuccess={() => fetchMe().then(setUser).catch(() => {})} initialRef={reservationsInitial?.ref} initialLastName={reservationsInitial?.lastName} />
      )}
      {page === 'checkin' && (
        <CheckIn isLoggedIn={user !== null} onGoLogin={() => navigate('login')} initialRef={checkinInitial?.ref} initialLastName={checkinInitial?.lastName} />
      )}
      {page === 'nextrip' && <Nextrip user={user} onGoLogin={() => navigate('login')} />}
      {page === 'mypage' && (
        <MyPage user={user} onGoLogin={() => navigate('login')} onUpdateUser={setUser} />
      )}
      {page === 'login' && (
        <Login onLogin={handleLogin} onGoHome={() => navigate('home')} />
      )}
      {page === 'admin' && (
        <AdminPage user={user} onGoLogin={() => navigate('login')} />
      )}
      {page === 'notice' && <NoticeEventPage />}
      {page === 'csevice' && (
        <CustomerServicePage user={user} onGoLogin={() => navigate('login')} />
      )}
      {page === 'flight-status' && <FlightStatusPage />}
      {page === 'review' && (
        <ReviewPage user={user} onGoLogin={() => navigate('login')} onGoHome={() => navigate('home')} />
      )}
      {page === 'ai-review' && (
        <AIReviewPage user={user} onGoLogin={() => navigate('login')} onGoHome={() => navigate('home')} onGoNextrip={() => navigate('nextrip')} />
      )}
      {page === 'reviews' && (
        <ReviewsListPage onGoHome={() => navigate('home')} onGoWrite={() => navigate('review')} />
      )}
    </ToastProvider>
  )
}

export default App
