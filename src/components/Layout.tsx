import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { SearchOverlay } from './SearchOverlay';
import { useLocale } from '../contexts/LocaleContext';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Layout({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { locale } = useLocale();
  const { isAdmin } = useAuth();
  const location = useLocation();
  const isHomepage =
    location.pathname === `/${locale}` || location.pathname === `/${locale}/`;
  const isAdminRoute =
    location.pathname === `/${locale}/favmo-studio-7k4m9q2x` || location.pathname.startsWith(`/${locale}/favmo-studio-7k4m9q2x/`);

  if (isAdminRoute) {
    return <div className="min-h-screen bg-white text-black">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <Header onOpenSearch={() => setSearchOpen(true)} />
      <main className={`flex-1 ${isHomepage ? '' : 'pt-20'}`}>{children}</main>
      <Footer />
      {isAdmin && (
        <Link
          to={`/${locale}/favmo-studio-7k4m9q2x`}
          aria-label={locale === 'ar' ? 'فتح لوحة الإدارة' : 'Open admin dashboard'}
          title={locale === 'ar' ? 'لوحة الإدارة' : 'Admin dashboard'}
          className={`fixed ${locale === 'ar' ? 'left-0' : 'right-0'} top-1/2 z-40 inline-flex -translate-y-1/2 items-center gap-2 border border-white/25 bg-black/90 px-3 py-3 text-[11px] text-white shadow-lg transition-colors hover:border-white`}
        >
          <ShieldCheck className="h-4 w-4" strokeWidth={1.6} />
          <span className="[writing-mode:vertical-rl]">
            {locale === 'ar' ? 'لوحة الإدارة' : 'ADMIN'}
          </span>
        </Link>
      )}
      <CartDrawer />
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
