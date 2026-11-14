import type { Locale } from '../types/domain';

export const DISPLAY_CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

const CURRENCY_LOCALES: Record<DisplayCurrency, string> = {
  EGP: 'en-EG', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', SAR: 'ar-SA', AED: 'ar-AE',
};

export function getDisplayCurrency(): DisplayCurrency {
  if (typeof localStorage === 'undefined') return 'EGP';
  const value = localStorage.getItem('favmo_currency');
  return DISPLAY_CURRENCIES.includes(value as DisplayCurrency) ? (value as DisplayCurrency) : 'EGP';
}

function getEgpRates(): Partial<Record<DisplayCurrency, number>> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('favmo_currency_rates') || '{}') as Partial<Record<DisplayCurrency, number>>;
  } catch {
    return {};
  }
}

/** Formats EGP piasters in the selected display currency. Orders and payments remain EGP. */
export function formatMinorUnits(piasters: number, locale: Locale): string {
  const safeInt = Math.trunc(piasters);
  const currency = getDisplayCurrency();
  const rate = currency === 'EGP' ? 1 : getEgpRates()[currency];
  const shownCurrency: DisplayCurrency = rate ? currency : 'EGP';
  const shownRate = rate || 1;
  const amount = (safeInt / 100) * shownRate;
  const digits = shownCurrency === 'EGP' ? (safeInt % 100 ? 2 : 0) : 2;
  const formatted = new Intl.NumberFormat(
    shownCurrency === 'EGP' && locale === 'ar' ? 'ar-EG' : CURRENCY_LOCALES[shownCurrency],
    { style: 'currency', currency: shownCurrency, minimumFractionDigits: digits, maximumFractionDigits: digits }
  ).format(amount);
  return formatted;
}
