import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MESSAGES, type Messages } from '../i18n/messages';
import type { Locale } from '../types/domain';

interface LocaleContextValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  t: Messages;
  switchLocale: (nextLocale?: Locale) => void;
  localePath: (path: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function getStoredLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)favmo_locale=(ar|en)(?:;|$)/);
  return match ? (match[1] as Locale) : null;
}

export function detectPreferredLocale(): Locale {
  const cookieLocale = getStoredLocaleCookie();
  if (cookieLocale) return cookieLocale;
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language?.toLowerCase() || '';
    if (lang.startsWith('ar')) return 'ar';
  }
  return 'en';
}

function persistLocalePreference(locale: Locale) {
  if (typeof document !== 'undefined') {
    document.cookie = `favmo_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }
  fetch('/api/locale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  }).catch(() => {});
}

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const dir: 'rtl' | 'ltr' = locale === 'ar' ? 'rtl' : 'ltr';
  const isRtl = locale === 'ar';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.cookie = `favmo_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }, [locale, dir]);

  const switchLocale = useCallback(
    (explicitNext?: Locale) => {
      const nextLocale: Locale = explicitNext ?? (locale === 'ar' ? 'en' : 'ar');
      persistLocalePreference(nextLocale);

      const currentPath = location.pathname;
      const stripped = currentPath.replace(/^\/(ar|en)(?=\/|$)/, '');
      const targetPath = `/${nextLocale}${stripped}${location.search}${location.hash}`;
      navigate(targetPath);
    },
    [locale, location.hash, location.pathname, location.search, navigate]
  );

  const localePath = useCallback(
    (path: string) => {
      const normalized = path.startsWith('/') ? path : `/${path}`;
      if (normalized === '/') return `/${locale}`;
      return `/${locale}${normalized}`;
    },
    [locale]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir,
      isRtl,
      t: MESSAGES[locale],
      switchLocale,
      localePath,
    }),
    [locale, dir, isRtl, switchLocale, localePath]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }
  return ctx;
}
