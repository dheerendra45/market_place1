import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { Sparkles, User, LogOut, ChevronDown, LayoutGrid } from 'lucide-react'
import Footer from './Footer'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/pricing', label: 'Pricing' },
]

function UserMenu() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded-lg bg-bg-border" />
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2.5">
        <Link
          to="/login"
          className="hidden rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary sm:block"
        >
          Log in
        </Link>
        <Link
          to="/onboarding"
          className="flex items-center gap-1.5 rounded-lg border border-accent-yellow bg-accent-yellow px-4 py-2 text-sm font-semibold text-[#1C1B19] transition-all hover:bg-accent-yellow-hover"
        >
          <Sparkles className="h-4 w-4" />
          Get Your Product Listed
        </Link>
      </div>
    )
  }

  const initials = (user.name || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-bg-border bg-bg-surface py-1.5 pl-1.5 pr-2.5 transition-colors hover:border-accent-yellow/50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-xs font-bold text-accent-yellow">
          {initials}
        </span>
        <span className="hidden max-w-[120px] truncate text-sm font-medium text-text-primary sm:block">
          {user.name || user.email.split('@')[0]}
        </span>
        <ChevronDown className="h-4 w-4 text-text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-bg-border bg-bg-surface shadow-[0_14px_36px_rgba(28,27,25,0.12)]">
          <div className="border-b border-bg-border px-4 py-3">
            <div className="truncate text-sm font-semibold text-text-primary">
              {user.name || 'Your account'}
            </div>
            <div className="truncate text-xs text-text-muted">{user.email}</div>
            <span className="mt-1.5 inline-flex items-center rounded-full border border-accent-yellow/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#7A5B00]">
              {user.role}
            </span>
          </div>
          <Link
            to="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            <User className="h-4 w-4" /> My account
          </Link>
          {user.role === 'vendor' && (
            <Link
              to="/onboarding"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
            >
              <LayoutGrid className="h-4 w-4" /> Manage products
            </Link>
          )}
          <button
            onClick={() => {
              logout()
              setOpen(false)
              navigate('/')
            }}
            className="flex w-full items-center gap-2.5 border-t border-bg-border px-4 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function Brand() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 justify-self-start">
      <img src="/attacked-mark.svg" alt="Attacked.ai" className="h-9 w-9" />
      <span className="flex items-baseline text-[19px] font-semibold tracking-tight text-text-primary transition-colors group-hover:text-accent-yellow">
        Attacked<span className="text-accent-yellow transition-colors group-hover:text-text-primary">.ai</span>
        <sup className="ml-0.5 text-[0.5em] font-medium text-text-muted">™</sup>
      </span>
    </Link>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
      <nav className="sticky top-0 z-50 w-full border-b border-bg-border bg-bg-primary/85 backdrop-blur-md">
        <div className="site-header-inner py-3.5">
          <Brand />

          {/* Center nav */}
          <div className="hidden items-center justify-center gap-9 md:flex">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `border-b-2 pb-0.5 text-[15px] font-medium transition-colors ${
                    isActive
                      ? 'border-accent-yellow text-text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right: auth-aware menu */}
          <div className="flex items-center justify-self-end">
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="w-full flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}
