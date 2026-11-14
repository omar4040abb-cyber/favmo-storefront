import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { useAuth } from '../contexts/AuthContext';
import { useCartUi } from '../contexts/CartUiContext';
import { BrandLogo } from './BrandLogo';

const FONT_SIZE_STORAGE_KEY = 'favmo-font-size';
function FontSizeControls({ locale, compact = false }: { locale: 'ar' | 'en'; compact?: boolean }) {
  const [fontSize, setFontSize] = useState(16);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(FONT_SIZE_STORAGE_KEY));
    if (saved >= 14 && saved <= 20) setFontSize(saved);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--favmo-font-size', `${fontSize}px`);
    try { window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSize)); } catch { /* Storage may be disabled. */ }
  }, [fontSize]);

  const buttons = <div className="inline-flex items-center gap-1" role="group" aria-label={locale === 'ar' ? 'حجم الخط' : 'Font size'}>
    <button type="button" onClick={() => setFontSize((size) => Math.max(14, size - 2))} disabled={fontSize <= 14} aria-label={locale === 'ar' ? 'تصغير الخط' : 'Decrease text size'} className="h-9 min-w-9 border border-white/30 px-2 text-xs disabled:opacity-40">A−</button>
    <button type="button" onClick={() => setFontSize(16)} aria-label={locale === 'ar' ? 'الحجم الافتراضي للخط' : 'Reset text size'} className="h-9 min-w-9 border border-white/30 px-2 text-xs">A</button>
    <button type="button" onClick={() => setFontSize((size) => Math.min(20, size + 2))} disabled={fontSize >= 20} aria-label={locale === 'ar' ? 'تكبير الخط' : 'Increase text size'} className="h-9 min-w-9 border border-white/30 px-2 text-sm disabled:opacity-40">A+</button>
  </div>;
  if (!compact) return buttons;
  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={locale === 'ar' ? 'إعدادات حجم الخط' : 'Text size controls'} className="h-10 min-w-10 border border-white/30 px-2 text-sm">A</button>
    {open && <div className="absolute end-0 top-full z-50 mt-2 border border-neutral-700 bg-black p-2 shadow-xl">{buttons}</div>}
  </div>;
}

interface HeaderProps {
  onOpenSearch: () => void;
}

export function Header({ onOpenSearch }: HeaderProps) {
  const { locale, t, switchLocale, localePath } = useLocale();
  const { user, isAdmin } = useAuth();
  const { itemCount, openDrawer } = useCartUi();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isHomepage =
    location.pathname === `/${locale}` || location.pathname === `/${locale}/`;
  const accountEntryLabel = user
    ? isAdmin
      ? locale === 'ar'
        ? 'لوحة الإدارة'
        : 'Admin Dashboard'
      : locale === 'ar'
        ? 'حسابي'
        : 'My Account'
    : locale === 'ar'
      ? 'تسجيل الدخول'
      : 'Sign In';
  const accountEntryPath = user && isAdmin ? '/favmo-studio-7k4m9q2x' : '/account';

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const useSolidBlack = !isHomepage || scrolled || mobileMenuOpen;

  const navItems = [
    { id: 'home', label: t.nav.home, to: localePath('/') },
    { id: 'shop', label: t.nav.shop, to: localePath('/shop') },
    { id: 'collection', label: t.nav.collection, to: localePath('/shop') },
    { id: 'about', label: t.nav.about, to: localePath('/about') },
    { id: 'contact', label: t.nav.contact, to: localePath('/contact') },
  ];

  const isActiveLink = (id: string, to: string) => {
    const [pathOnly] = to.split('?');
    if (pathOnly === `/${locale}`) {
      return location.pathname === `/${locale}` || location.pathname === `/${locale}/`;
    }
    if (id === 'collection') return false;
    return location.pathname === pathOnly;
  };

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          useSolidBlack
            ? 'bg-black text-white border-b border-neutral-800'
            : 'bg-transparent text-white border-b border-white/10'
        }`}
      >
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 h-20 flex items-center justify-between gap-6">
          {/* Brand Zone */}
          <Link
            to={localePath('/')}
            className="inline-flex items-center shrink-0 focus-visible:outline-white"
            aria-label="FAVMO"
          >
            <BrandLogo variant="white" />
          </Link>

          {/* Primary Navigation (Desktop) */}
          <nav
            aria-label="Primary"
            className="hidden lg:flex items-center gap-8"
          >
            {navItems.map((item) => {
              const active = isActiveLink(item.id, item.to);
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={`relative py-1 whitespace-nowrap shrink-0 text-xs font-medium transition-opacity duration-200 ${
                    locale === 'en' ? 'tracking-[0.14em]' : ''
                  } ${active ? 'opacity-100' : 'opacity-75 hover:opacity-100'}`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 inset-x-0 h-px bg-white"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Utility Actions */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="md:hidden"><FontSizeControls locale={locale} compact /></div>
            <div className="hidden md:block"><FontSizeControls locale={locale} /></div>
            <button
              type="button"
              onClick={() => switchLocale()}
              className="hidden sm:inline-flex items-center justify-center h-10 px-2.5 text-xs font-medium text-white/85 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              aria-label={t.nav.switchLanguage}
            >
              {t.nav.switchLanguage}
            </button>

            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex items-center justify-center w-10 h-10 text-white/85 hover:text-white transition-colors cursor-pointer"
              aria-label={t.nav.search}
            >
              <span dir="ltr" className="inline-flex">
                <Search className="w-[18px] h-[18px]" strokeWidth={1.6} />
              </span>
            </button>

            <Link
              to={localePath('/wishlist')}
              className="hidden sm:inline-flex items-center justify-center w-10 h-10 text-white/85 hover:text-white transition-colors"
              aria-label={t.nav.wishlist}
            >
              <Heart className="w-[18px] h-[18px]" strokeWidth={1.6} />
            </Link>

            <Link
              to={localePath(accountEntryPath)}
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-2 text-white/85 hover:text-white transition-colors text-xs font-medium tracking-wider"
              aria-label={accountEntryLabel}
            >
              <span dir="ltr" className="inline-flex">
                <User className="w-[18px] h-[18px]" strokeWidth={1.6} />
              </span>
              <span className="hidden md:inline">
                {accountEntryLabel}
              </span>
              {user && (
                <span
                  aria-hidden="true"
                  className="w-1.5 h-1.5 bg-white rounded-full"
                />
              )}
            </Link>

            <button
              type="button"
              onClick={openDrawer}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-2 text-white/90 hover:text-white transition-colors cursor-pointer"
              aria-label={t.nav.bag}
            >
              <span dir="ltr" className="inline-flex">
                <ShoppingBag className="w-[18px] h-[18px]" strokeWidth={1.6} />
              </span>
              <span className="font-mono-code text-xs tabular-nums">({itemCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden inline-flex items-center justify-center w-11 h-11 text-white cursor-pointer"
              aria-label={mobileMenuOpen ? t.nav.close : t.nav.menu}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" strokeWidth={1.6} />
              ) : (
                <Menu className="w-5 h-5" strokeWidth={1.6} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Full-Screen Mobile Menu */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.nav.menu}
          className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between px-6 py-6 overflow-y-auto lg:hidden"
        >
          <div className="flex items-center justify-between h-14 border-b border-neutral-800 pb-4">
            <Link to={localePath('/')} onClick={() => setMobileMenuOpen(false)}>
              <BrandLogo variant="white" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center justify-center w-11 h-11 text-white cursor-pointer"
              aria-label={t.nav.close}
            >
              <X className="w-6 h-6" strokeWidth={1.6} />
            </button>
          </div>

          <nav className="py-10 flex flex-col gap-6" aria-label="Mobile Primary">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-2xl font-semibold text-white hover:text-neutral-400 transition-colors ${
                  locale === 'en' ? 'font-display-en tracking-[0.06em]' : 'font-display-ar'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-neutral-800 pt-6 space-y-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span>{locale === 'ar' ? 'حجم الخط' : 'Text size'}</span>
              <FontSizeControls locale={locale} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Link
                to={localePath(accountEntryPath)}
                onClick={() => setMobileMenuOpen(false)}
                className="border border-neutral-800 py-3 px-4 text-center hover:border-white transition-colors"
              >
                {accountEntryLabel}
              </Link>
              <Link
                to={localePath('/wishlist')}
                onClick={() => setMobileMenuOpen(false)}
                className="border border-neutral-800 py-3 px-4 text-center hover:border-white transition-colors"
              >
                {t.nav.wishlist}
              </Link>
              <Link
                to={localePath('/track-order')}
                onClick={() => setMobileMenuOpen(false)}
                className="border border-neutral-800 py-3 px-4 text-center hover:border-white transition-colors"
              >
                {t.nav.trackOrder}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  switchLocale();
                }}
                className="border border-white bg-white text-black py-3 px-4 text-center font-medium cursor-pointer"
              >
                {t.nav.switchLanguage}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
