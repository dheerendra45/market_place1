import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import MarketplacePage from './pages/MarketplacePage'
import ProductDetailPage from './pages/ProductDetailPage'
import VendorsPage from './pages/VendorsPage'
import VendorProfilePage from './pages/VendorProfilePage'
import PricingPage from './pages/PricingPage'
import OnboardingPage from './pages/OnboardingPage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AccountPage from './pages/AccountPage'

export default function App() {
  return (
    <Routes>
      {/* Hidden admin console — reachable ONLY by typing /admin. Rendered outside
          the marketplace Layout so it has no shared nav, header, or footer links. */}
      <Route path="/admin" element={<AdminPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/product/:slug" element={<ProductDetailPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/vendors/:slug" element={<VendorProfilePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/account" element={<AccountPage />} />
        {/* Legacy routes now funnel into the unified onboarding workflow —
            product management is handled entirely inside onboarding. */}
        <Route path="/claim/:slug" element={<Navigate to="/onboarding" replace />} />
        <Route path="/list-your-product" element={<Navigate to="/onboarding" replace />} />
      </Route>
    </Routes>
  )
}
