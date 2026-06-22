import { Link } from 'react-router-dom'

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 6 6 18" />
    <path d="M6 6 18 18" />
  </svg>
)

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
)

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
)

const XLogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const socialIcons = [LinkedinIcon, XLogoIcon, FacebookIcon, YoutubeIcon, InstagramIcon]

const footerLinkRow1 = [
  { label: 'Contact us', href: '#' },
  { label: 'Marketplace', to: '/marketplace' },
  { label: 'FAQ', href: '#' },
  { label: 'Privacy policy', href: '#' },
]

const footerLinkRow2 = [
  { label: 'Cookie preferences', href: '#' },
  { label: 'Terms of use', href: '#' },
  { label: 'Vendors', to: '/vendors' },
]

const footerLinkRow3 = [
  { label: 'Accessibility statement', href: '#' },
  { label: 'Pricing', to: '/pricing' },
]

function FooterLink({ label, href, to }: { label: string; href?: string; to?: string }) {
  const className = 'text-white/80 hover:text-accent-yellow transition-colors text-sm font-medium'
  if (to) {
    return <Link to={to} className={className}>{label}</Link>
  }
  return <a href={href} className={className}>{label}</a>
}

function BrandLogo() {
  return (
    <Link to="/" className="flex items-center gap-3 group">
      <img src="/attacked-mark.svg" alt="Attacked.ai" className="h-10 w-10 brightness-0 invert" />
      <div className="flex flex-col leading-tight">
        <span className="flex items-baseline text-xl font-semibold tracking-tight text-white group-hover:text-accent-yellow transition-colors">
          Attacked<span className="text-accent-yellow">.ai</span>
          <sup className="ml-0.5 text-[0.5em] font-medium text-white/50">™</sup>
        </span>
      </div>
    </Link>
  )
}

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-black text-white pt-16 pb-16 w-full">
      <div className="site-footer-inner">
        {/* Logo row */}
        <div className="mb-14">
          <BrandLogo />
        </div>

        <div className="flex flex-col gap-14 lg:flex-row lg:justify-between lg:gap-10">
          {/* Subscribe column */}
          <div className="w-full lg:max-w-[450px]">
            <h3 className="text-xl font-semibold mb-5">Subscribe</h3>
            <p className="text-white/60 text-[15px] mb-9 leading-relaxed">
              Select topics and stay current with our latest intelligence briefs
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                placeholder="Email address"
                className="flex-1 rounded-lg bg-white/5 border border-white/15 text-white placeholder:text-white/40 px-4 py-3 text-sm focus:outline-none focus:border-accent-yellow focus:ring-2 focus:ring-accent-yellow/20 transition-colors"
              />
              <button type="button" className="btn btn-accent shrink-0 uppercase tracking-wider">
                Submit
              </button>
            </div>
            <p className="text-white/40 text-xs mt-8">
              © 2026 ATTACKED.AI · The Defence Layer
            </p>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-6 lg:items-end">
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-medium lg:justify-end">
              {footerLinkRow1.map((link) => (
                <FooterLink key={link.label} {...link} />
              ))}
              <a href="#" className="flex items-center gap-2 text-white/80 hover:text-accent-yellow transition-colors text-sm font-medium">
                <span className="relative w-8 h-4 bg-white rounded-full flex items-center px-0.5">
                  <span className="w-3 h-3 bg-black rounded-full" />
                  <XIcon className="absolute right-0.5 w-2.5 h-2.5 text-black" />
                </span>
                Your privacy choices
              </a>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-4 lg:justify-end">
              {footerLinkRow2.map((link) => (
                <FooterLink key={link.label} {...link} />
              ))}
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-4 lg:justify-end">
              {footerLinkRow3.map((link) => (
                <FooterLink key={link.label} {...link} />
              ))}
            </div>

            {/* Social icons */}
            <div className="flex gap-4 mt-2 lg:justify-end">
              {socialIcons.map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Social link"
                  className="w-10 h-10 border border-white/25 rounded-full flex items-center justify-center text-white/80 hover:bg-accent-yellow hover:text-[#1C1B19] hover:border-accent-yellow transition-all"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
