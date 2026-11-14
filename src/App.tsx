import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartUiProvider } from './contexts/CartUiContext';
import { StoreSettingsProvider } from './contexts/StoreSettingsContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { detectPreferredLocale, LocaleProvider } from './contexts/LocaleContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import type { Locale } from './types/domain';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ShopPage = lazy(() => import('./pages/ShopPage').then((m) => ({ default: m.ShopPage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })));
const EditorialPolicyPage = lazy(() => import('./pages/EditorialPolicyPage').then((m) => ({ default: m.EditorialPolicyPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const WishlistPage = lazy(() => import('./pages/WishlistPage').then((m) => ({ default: m.WishlistPage })));
const CartPage = lazy(() => import('./pages/CartPage').then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const TrackOrderPage = lazy(() => import('./pages/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const CareersPage = lazy(() => import('./pages/CareersPage').then((m) => ({ default: m.CareersPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

function RouteFallback() {
  return <div aria-hidden="true" className="min-h-[50vh] bg-white" />;
}

function RootLocaleRedirect() {
  const preferred = detectPreferredLocale();
  return <Navigate to={`/${preferred}`} replace />;
}

function LocalizedStorefront() {
  const { locale } = useParams<{ locale: string }>();

  if (locale !== 'ar' && locale !== 'en') {
    const preferred = detectPreferredLocale();
    return <Navigate to={`/${preferred}`} replace />;
  }

  return (
    <LocaleProvider locale={locale as Locale}>
      <Layout>
        <Suspense fallback={<RouteFallback />}><Routes>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="product/:slug" element={<ProductDetailPage />} />
          <Route path="about" element={<EditorialPolicyPage slug="about" />} />
          <Route path="contact" element={<ContactPage />} />
          <Route
            path="shipping-returns"
            element={<EditorialPolicyPage slug="shipping-returns" />}
          />
          <Route path="privacy" element={<EditorialPolicyPage slug="privacy" />} />
          <Route path="terms" element={<EditorialPolicyPage slug="terms" />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="careers" element={<CareersPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="track-order" element={<TrackOrderPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes></Suspense>
      </Layout>
    </LocaleProvider>
  );
}

function LocalizedAdminRoute() {
  const { locale } = useParams<{ locale: string }>();

  if (locale !== 'ar' && locale !== 'en') {
    const preferred = detectPreferredLocale();
    return <Navigate to={`/${preferred}/favmo-studio-7k4m9q2x`} replace />;
  }

  return (
    <LocaleProvider locale={locale as Locale}>
      <Suspense fallback={<RouteFallback />}><AdminPage /></Suspense>
    </LocaleProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <StoreSettingsProvider>
            <WishlistProvider>
              <CartUiProvider>
                <Routes>
                  <Route path="/" element={<RootLocaleRedirect />} />
                  <Route path="/:locale/favmo-studio-7k4m9q2x" element={<LocalizedAdminRoute />} />
                  <Route path="/:locale/*" element={<LocalizedStorefront />} />
                  <Route path="*" element={<RootLocaleRedirect />} />
                </Routes>
              </CartUiProvider>
            </WishlistProvider>
          </StoreSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
