import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../contexts/LocaleContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';
import { DISPLAY_CURRENCIES, getDisplayCurrency, type DisplayCurrency } from '../lib/currency';
import { BrandLogo } from './BrandLogo';
import { InstallAppButton } from './InstallAppButton';

export function Footer() {
  const { locale, t, switchLocale, localePath } = useLocale();
  const { storefront } = useStoreSettings();
  const waDigits = (storefront.whatsappNumber || '').replace(/\D/g, '');
  const [currency, setCurrency] = useState<DisplayCurrency>(getDisplayCurrency);

  useEffect(() => {
    const refreshedAt = Number(localStorage.getItem('favmo_currency_rates_updated_at') || 0);
    if (Date.now() - refreshedAt < 24 * 60 * 60 * 1000) return;
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((response) => {
        if (!response.ok) throw new Error('Exchange rates unavailable');
        return response.json() as Promise<{ result?: string; rates?: Record<string, number> }>;
      })
      .then((data) => {
        const usdPerEgp = data.rates?.EGP;
        if (data.result !== 'success' || !usdPerEgp || !data.rates) return;
        const rates = Object.fromEntries(
          DISPLAY_CURRENCIES.filter((code) => code !== 'EGP').map((code) => [code, data.rates?.[code] ? data.rates[code] / usdPerEgp : undefined])
        );
        localStorage.setItem('favmo_currency_rates', JSON.stringify(rates));
        localStorage.setItem('favmo_currency_rates_updated_at', String(Date.now()));
        if (currency !== 'EGP') window.location.reload();
      })
      .catch(() => {});
  }, [currency]);

  const changeCurrency = (next: DisplayCurrency) => {
    localStorage.setItem('favmo_currency', next);
    setCurrency(next);
    window.location.reload();
  };

  return (
    <footer className="bg-black text-white border-t border-neutral-800">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="md:col-span-4 space-y-6">
            <Link to={localePath('/')} className="inline-block">
              <BrandLogo variant="white" />
            </Link>
            <p className="text-sm text-neutral-300 max-w-xs leading-relaxed">
              {(locale === 'ar'
                ? storefront.storeDescription_ar
                : storefront.storeDescription_en) || (
                <>
                  {t.brand.slogan}
                  <br />
                  <span className="text-neutral-400">{t.brand.supportingText}</span>
                </>
              )}
            </p>
            <label className="flex w-fit items-center gap-2 text-xs text-neutral-400">
              <span>{locale === 'ar' ? 'العملة' : 'Currency'}</span>
              <select
                aria-label={locale === 'ar' ? 'اختر العملة' : 'Choose currency'}
                value={currency}
                onChange={(event) => changeCurrency(event.target.value as DisplayCurrency)}
                className="cursor-pointer border border-neutral-700 bg-black px-2 py-1 text-white"
              >
                {DISPLAY_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
            <InstallAppButton />
            {currency !== 'EGP' && (
              <p className="max-w-xs text-[11px] leading-relaxed text-neutral-500">
                {locale === 'ar'
                  ? 'الأسعار المحوّلة تقديرية؛ الدفع والطلب بالجنيه المصري.'
                  : 'Converted prices are estimates; orders and payment remain in EGP.'}{' '}
                <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="underline">Rates By Exchange Rate API</a>
              </p>
            )}
            {(waDigits ||
              storefront.contactEmail ||
              storefront.instagramUrl ||
              storefront.tiktokUrl ||
              storefront.facebookUrl) && (
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-neutral-300">
                {waDigits && (
                  <a
                    href={`https://wa.me/${waDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white underline"
                  >
                    WhatsApp
                  </a>
                )}
                {storefront.instagramUrl && (
                  <a
                    href={storefront.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white underline"
                  >
                    Instagram
                  </a>
                )}
                {storefront.tiktokUrl && (
                  <a
                    href={storefront.tiktokUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white underline"
                  >
                    TikTok
                  </a>
                )}
                {storefront.facebookUrl && (
                  <a
                    href={storefront.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white underline"
                  >
                    Facebook
                  </a>
                )}
                {storefront.contactEmail && (
                  <a
                    href={`mailto:${storefront.contactEmail}`}
                    dir="ltr"
                    className="hover:text-white underline"
                  >
                    {storefront.contactEmail}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Navigation Column */}
          <div className="md:col-span-3 space-y-4">
            <h2
              className={`text-xs font-semibold text-neutral-400 ${
                locale === 'en' ? 'tracking-[0.16em]' : ''
              }`}
            >
              {t.footer.navigationTitle}
            </h2>
            <ul className="space-y-3 text-sm text-neutral-200">
              <li>
                <Link to={localePath('/')} className="hover:text-white transition-colors">
                  {t.nav.home}
                </Link>
              </li>
              <li>
                <Link to={localePath('/shop')} className="hover:text-white transition-colors">
                  {t.nav.shop}
                </Link>
              </li>
              <li>
                <Link
                  to={localePath('/shop')}
                  className="hover:text-white transition-colors"
                >
                  {t.nav.collection}
                </Link>
              </li>
              <li>
                <Link to={localePath('/about')} className="hover:text-white transition-colors">
                  {t.nav.about}
                </Link>
              </li>
            </ul>
          </div>

          {/* Policies Column */}
          <div className="md:col-span-3 space-y-4">
            <h2
              className={`text-xs font-semibold text-neutral-400 ${
                locale === 'en' ? 'tracking-[0.16em]' : ''
              }`}
            >
              {t.footer.policiesTitle}
            </h2>
            <ul className="space-y-3 text-sm text-neutral-200">
              <li>
                <Link
                  to={localePath('/shipping-returns')}
                  className="hover:text-white transition-colors"
                >
                  {t.footer.shippingReturns}
                </Link>
              </li>
              <li>
                <Link to={localePath('/privacy')} className="hover:text-white transition-colors">
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link to={localePath('/terms')} className="hover:text-white transition-colors">
                  {t.footer.terms}
                </Link>
              </li>
            </ul>
          </div>

          {/* Client Care Column */}
          <div className="md:col-span-2 space-y-4">
            <h2
              className={`text-xs font-semibold text-neutral-400 ${
                locale === 'en' ? 'tracking-[0.16em]' : ''
              }`}
            >
              {t.footer.clientCareTitle}
            </h2>
            <ul className="space-y-3 text-sm text-neutral-200">
              <li>
                <Link
                  to={localePath('/track-order')}
                  className="hover:text-white transition-colors"
                >
                  {t.footer.trackOrder}
                </Link>
              </li>
              <li>
                <Link to={localePath('/contact')} className="hover:text-white transition-colors">
                  {t.footer.contact}
                </Link>
              </li>
              <li>
                <Link to={localePath('/careers')} className="hover:text-white transition-colors">
                  {locale === 'ar' ? 'العمل معنا' : 'Careers'}
                </Link>
              </li>
              <li>
                <Link
                  to={localePath('/account')}
                  className="hover:text-white transition-colors"
                >
                  {t.nav.account}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-neutral-400">
          <p>{t.footer.copyright}</p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => switchLocale('ar')}
              className={`cursor-pointer transition-colors ${
                locale === 'ar' ? 'text-white font-semibold' : 'hover:text-white'
              }`}
            >
              العربية
            </button>
            <span aria-hidden="true" className="text-neutral-700">
              /
            </span>
            <button
              type="button"
              onClick={() => switchLocale('en')}
              className={`cursor-pointer transition-colors ${
                locale === 'en' ? 'text-white font-semibold' : 'hover:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
