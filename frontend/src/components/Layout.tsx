import { Outlet, NavLink, Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import Footer from './Footer'

const navLinks = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/pricing', label: 'Pricing' },
]

function Brand() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 justify-self-start">
      <img src="/attacked-mark.svg" alt="Attacked.ai" className="h-9 w-9" />
      <span className="flex items-baseline text-[19px] font-semibold tracking-tight text-text-primary">
        Attacked<span className="text-accent-yellow">.ai</span>
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

          {/* Right CTA */}
          <div className="flex items-center justify-self-end">
            <Link
              to="/onboarding"
              className="flex items-center gap-1.5 rounded-lg border border-accent-yellow bg-accent-yellow px-4 py-2 text-sm font-semibold text-[#1C1B19] transition-all hover:bg-accent-yellow-hover"
            >
              <Sparkles className="h-4 w-4" />
              Get Your Product Listed
            </Link>
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
