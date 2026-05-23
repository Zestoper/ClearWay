import { useState, useEffect } from 'react'
import './Login.css'
import { login, signup } from '../../services/auth'
import type { User } from '../../services/auth'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1'

interface Props {
  onLogin: (token: string, user: User) => void
  onGoHome: () => void
}

export default function Login({ onLogin, onGoHome }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>('login')

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showPw, setShowPw] = useState(false)
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverStatus, setServerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  useEffect(() => {
    const url = API_BASE.replace('/api/v1', '') + '/health'
    fetch(url)
      .then(r => setServerStatus(r.ok ? 'connected' : 'error'))
      .catch(() => setServerStatus('error'))
  }, [])

  function touch(f: string) { setTouched(t => ({ ...t, [f]: true })) }

  const loginErrors: Record<string, string> = {}
  if (touched.lemail && !loginForm.email) loginErrors.lemail = '이메일을 입력해 주세요.'
  else if (touched.lemail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginForm.email)) loginErrors.lemail = '유효한 이메일 형식이 아닙니다.'
  if (touched.lpw && !loginForm.password) loginErrors.lpw = '비밀번호를 입력해 주세요.'
  else if (touched.lpw && loginForm.password.length < 8) loginErrors.lpw = '비밀번호는 8자 이상이어야 합니다.'

  const signupErrors: Record<string, string> = {}
  if (touched.sname && !signupForm.name) signupErrors.sname = '이름을 입력해 주세요.'
  if (touched.semail && !signupForm.email) signupErrors.semail = '이메일을 입력해 주세요.'
  else if (touched.semail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupForm.email)) signupErrors.semail = '유효한 이메일 형식이 아닙니다.'
  if (touched.spw && !signupForm.password) signupErrors.spw = '비밀번호를 입력해 주세요.'
  else if (touched.spw && signupForm.password.length < 8) signupErrors.spw = '비밀번호는 8자 이상이어야 합니다.'
  if (touched.sconfirm && signupForm.confirm !== signupForm.password) signupErrors.sconfirm = '비밀번호가 일치하지 않습니다.'

  const loginValid = loginForm.email && loginForm.password && !loginErrors.lemail && !loginErrors.lpw
  const signupValid = signupForm.name && signupForm.email && signupForm.password && signupForm.confirm === signupForm.password && Object.keys(signupErrors).length === 0

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched({ lemail: true, lpw: true })
    if (!loginValid) return
    setLoading(true)
    setApiError('')
    try {
      const res = await login(loginForm.email, loginForm.password)
      onLogin(res.access_token, res.user)
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched({ sname: true, semail: true, spw: true, sconfirm: true })
    if (!signupValid) return
    setLoading(true)
    setApiError('')
    try {
      const res = await signup(signupForm.name, signupForm.email, signupForm.password)
      onLogin(res.access_token, res.user)
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <button className="login-back" onClick={onGoHome}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        홈으로
      </button>

      <div className="login-card">
        <div className="login-logo" onClick={onGoHome}>CLEARWAY</div>
        <p className="login-sub">항공권 예매부터 체크인까지</p>

        <div className={`server-status server-status--${serverStatus}`}>
          <span className="server-status-dot" />
          {serverStatus === 'connecting' && '서버 연결 중...'}
          {serverStatus === 'connected'  && '서버 연결됨'}
          {serverStatus === 'error'      && '서버 연결 실패'}
        </div>

        <div className="login-tabs">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>로그인</button>
          <button className={tab === 'signup' ? 'active' : ''} onClick={() => setTab('signup')}>회원가입</button>
        </div>

        {tab === 'login' && (
          <form className="login-form" onSubmit={handleLogin}>
            <div className={`lf-field ${touched.lemail && loginErrors.lemail ? 'error' : touched.lemail && loginForm.email ? 'valid' : ''}`}>
              <label>이메일</label>
              <input type="email" placeholder="example@email.com"
                value={loginForm.email}
                onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                onBlur={() => touch('lemail')} />
              {touched.lemail && loginErrors.lemail && <span className="lf-error">{loginErrors.lemail}</span>}
            </div>

            <div className={`lf-field ${touched.lpw && loginErrors.lpw ? 'error' : touched.lpw && loginForm.password ? 'valid' : ''}`}>
              <label>비밀번호</label>
              <div className="pw-wrap">
                <input type={showPw ? 'text' : 'password'} placeholder="8자 이상"
                  value={loginForm.password}
                  onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                  onBlur={() => touch('lpw')} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                  {showPw ? '숨기기' : '보기'}
                </button>
              </div>
              {touched.lpw && loginErrors.lpw && <span className="lf-error">{loginErrors.lpw}</span>}
            </div>

            {apiError && <span className="lf-error" style={{ textAlign: 'center' }}>{apiError}</span>}
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <p className="login-hint">
              아직 계정이 없으신가요?{' '}
              <button type="button" onClick={() => setTab('signup')}>회원가입</button>
            </p>
          </form>
        )}

        {tab === 'signup' && (
          <form className="login-form" onSubmit={handleSignup}>
            <div className={`lf-field ${touched.sname && signupErrors.sname ? 'error' : touched.sname && signupForm.name ? 'valid' : ''}`}>
              <label>이름</label>
              <input placeholder="홍길동"
                value={signupForm.name}
                onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                onBlur={() => touch('sname')} />
              {touched.sname && signupErrors.sname && <span className="lf-error">{signupErrors.sname}</span>}
            </div>

            <div className={`lf-field ${touched.semail && signupErrors.semail ? 'error' : touched.semail && signupForm.email ? 'valid' : ''}`}>
              <label>이메일</label>
              <input type="email" placeholder="example@email.com"
                value={signupForm.email}
                onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                onBlur={() => touch('semail')} />
              {touched.semail && signupErrors.semail && <span className="lf-error">{signupErrors.semail}</span>}
            </div>

            <div className={`lf-field ${touched.spw && signupErrors.spw ? 'error' : touched.spw && signupForm.password ? 'valid' : ''}`}>
              <label>비밀번호</label>
              <div className="pw-wrap">
                <input type={showPw ? 'text' : 'password'} placeholder="8자 이상"
                  value={signupForm.password}
                  onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))}
                  onBlur={() => touch('spw')} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                  {showPw ? '숨기기' : '보기'}
                </button>
              </div>
              {touched.spw && signupErrors.spw && <span className="lf-error">{signupErrors.spw}</span>}
            </div>

            <div className={`lf-field ${touched.sconfirm && signupErrors.sconfirm ? 'error' : touched.sconfirm && signupForm.confirm && !signupErrors.sconfirm ? 'valid' : ''}`}>
              <label>비밀번호 확인</label>
              <input type={showPw ? 'text' : 'password'} placeholder="비밀번호 재입력"
                value={signupForm.confirm}
                onChange={e => setSignupForm(f => ({ ...f, confirm: e.target.value }))}
                onBlur={() => touch('sconfirm')} />
              {touched.sconfirm && signupErrors.sconfirm && <span className="lf-error">{signupErrors.sconfirm}</span>}
            </div>

            {apiError && <span className="lf-error" style={{ textAlign: 'center' }}>{apiError}</span>}
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? '처리 중...' : '회원가입'}
            </button>

            <p className="login-hint">
              이미 계정이 있으신가요?{' '}
              <button type="button" onClick={() => setTab('login')}>로그인</button>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
