import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { ChevronDown, ChevronUp, Check, Shield } from 'lucide-react';

const PLANS = [
  {
    name: 'BRONZE',
    price: '£0',
    sub: 'Get discovered...',
    btnText: 'GET STARTED FREE',
    popular: false,
    features: [
      'Company profile & description',
      'Product listings',
      'Task mapping (O*NET governed)',
      'Automation Footprint™ positioning',
      'Basic analytics',
      'Name mention in case studies',
    ],
  },
  {
    name: 'SILVER',
    price: '£499',
    sub: 'Accelerate placement...',
    btnText: 'UPGRADE TO SILVER',
    popular: true,
    features: [
      'Everything in Bronze',
      'Featured vendor cards in articles',
      'Sidebar placement in case studies',
      'Demo request button',
      'Advanced analytics & conversion data',
      'Priority verification (24h)',
    ],
  },
  {
    name: 'GOLD',
    price: '£1,499',
    sub: 'Dominate intelligence matches...',
    btnText: 'GO GOLD',
    popular: false,
    features: [
      'Everything in Silver',
      'Hero banners in case studies',
      'Customer testimonial showcases',
      'CTA buttons throughout articles',
      'Customer invite programme (validate claims)',
      'WhiteSpace Intelligence access',
    ],
  },
];

const FAQS = [
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes. You can upgrade, downgrade, or cancel your premium plan at any time directly through the dashboard with zero lock-in contracts.',
  },
  {
    q: 'What does the verification process involve?',
    a: 'Verification requires linking valid evidence domains, certificates, or independent reports matching your capability claims. Priority verification is processed within 24 hours.',
  },
  {
    q: 'What is the Automation Footprint™?',
    a: 'It is a visual representation displaying how versatile a software product is in handling multi-faceted categories versus specialized single-scenario tasks.',
  },
  {
    q: 'Is there a trial available for Silver or Gold?',
    a: 'We offer customized onboarding sessions and demo evaluations to demonstrate lead flows prior to committing to premium tiers.',
  },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <PageContainer className="py-14 sm:py-16">
      {/* Hero */}
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-accent-yellow sm:text-sm">
          PRICING PLANS
        </span>
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
          Simple, transparent pricing
        </h1>
        <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
          From free verified listings to full commercial presence. Choose the plan that matches your growth stage.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 items-stretch">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col justify-between rounded-xl border bg-bg-surface p-8 sm:p-10 transition-all duration-300 ${
              plan.popular
                ? 'border-accent-yellow scale-105 shadow-xl shadow-accent-yellow/5'
                : 'border-bg-border hover:border-text-muted'
            }`}
          >
            {plan.popular && (
              <span className="absolute top-0 right-1/2 -translate-y-1/2 translate-x-1/2 rounded-full bg-accent-yellow px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
                MOST POPULAR
              </span>
            )}

            <div>
              <span className="mb-3 block text-sm font-bold tracking-widest text-text-secondary">
                {plan.name}
              </span>
              <div className="mb-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-text-primary sm:text-5xl">{plan.price}</span>
                <span className="text-sm text-text-secondary">/month</span>
              </div>
              <p className="mb-8 text-sm text-text-secondary">{plan.sub}</p>

              <hr className="mb-8 border-bg-border" />

              <ul className="mb-10 space-y-4">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent-yellow" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              className={`btn w-full ${plan.popular ? 'btn-accent' : 'btn-outline'}`}
            >
              {plan.btnText}
            </button>
          </div>
        ))}
      </div>

      {/* Full Feature Comparison Table */}
      <div className="mb-20">
        <h2 className="mb-8 text-center text-xl font-bold uppercase tracking-wide text-text-primary">
          Compare Features
        </h2>
        <div className="overflow-x-auto rounded-lg border border-bg-border bg-bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-bg-border bg-bg-elevated font-bold uppercase tracking-wider text-text-secondary">
                <th className="p-5">Feature</th>
                <th className="p-5 text-center">Bronze</th>
                <th className="p-5 text-center">Silver</th>
                <th className="p-5 text-center">Gold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border text-text-secondary">
              <tr>
                <td className="p-5 font-medium text-text-primary">Profile Positioning</td>
                <td className="p-5 text-center">Standard</td>
                <td className="p-5 text-center">Featured</td>
                <td className="p-5 text-center">Hero placement</td>
              </tr>
              <tr>
                <td className="p-5 font-medium text-text-primary">O*NET Task Mappings</td>
                <td className="p-5 text-center"><Check className="mx-auto h-5 w-5 text-accent-yellow" /></td>
                <td className="p-5 text-center"><Check className="mx-auto h-5 w-5 text-accent-yellow" /></td>
                <td className="p-5 text-center"><Check className="mx-auto h-5 w-5 text-accent-yellow" /></td>
              </tr>
              <tr>
                <td className="p-5 font-medium text-text-primary">Testimonial Showcases</td>
                <td className="p-5 text-center">-</td>
                <td className="p-5 text-center"><Check className="mx-auto h-5 w-5 text-accent-yellow" /></td>
                <td className="p-5 text-center"><Check className="mx-auto h-5 w-5 text-accent-yellow" /></td>
              </tr>
              <tr>
                <td className="p-5 font-medium text-text-primary">WhiteSpace Intelligence Access</td>
                <td className="p-5 text-center">-</td>
                <td className="p-5 text-center">-</td>
                <td className="p-5 text-center"><Check className="mx-auto h-5 w-5 text-accent-yellow" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto mb-16">
        <h2 className="mb-10 text-center text-xl font-bold uppercase tracking-wide text-text-primary">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="overflow-hidden rounded-lg border border-bg-border bg-bg-surface">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="flex w-full items-center justify-between p-5 text-left text-base font-semibold text-text-primary transition-colors hover:text-accent-yellow"
              >
                <span>{faq.q}</span>
                {openFaq === idx ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              {openFaq === idx && (
                <div className="border-t border-bg-border bg-bg-primary/25 p-5 pt-0 text-sm leading-relaxed text-text-secondary">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mx-auto max-w-4xl rounded-xl border border-bg-border bg-bg-surface p-10 text-center sm:p-14">
        <Shield className="mx-auto mb-5 h-12 w-12 text-accent-yellow" />
        <h2 className="mb-4 text-2xl font-bold text-text-primary sm:text-3xl">
          Ready to get discovered?
        </h2>
        <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-text-secondary">
          Onboard your solution under the Defence Layer marketplace to reach enterprises at critical decision periods.
        </p>
        <Link to="/onboarding" className="btn btn-accent btn-lg">
          Get Your Product Listed
        </Link>
      </div>
    </PageContainer>
  );
}
