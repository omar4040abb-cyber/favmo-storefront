import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { formatMinorUnits } from '../lib/currency';
import { trackOrderLookup } from '../lib/storeService';
import type { OrderLookup } from '../types/domain';
import { Bdi } from '../components/Bdi';

export function TrackOrderPage() {
  const { locale, t } = useLocale();
  const [searchParams] = useSearchParams();

  const [orderNumber, setOrderNumber] = useState(searchParams.get('order') || '');
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState<OrderLookup | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setNotFound(false);
    setResult(null);
    try {
      const lookup = await trackOrderLookup(orderNumber, phone);
      if (!lookup) {
        setNotFound(true);
      } else {
        setResult(lookup);
      }
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="bg-white text-black min-h-[75vh]">
      <section className="bg-black text-white py-14 border-b border-neutral-800">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 space-y-2">
          <h1
            className={`text-3xl sm:text-4xl font-semibold ${
              locale === 'en' ? 'font-display-en tracking-[-0.01em]' : 'font-display-ar'
            }`}
          >
            {t.tracking.title}
          </h1>
          <p className="text-sm text-neutral-400 max-w-xl">{t.tracking.subtitle}</p>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-12 lg:py-16">
        <div className="max-w-xl space-y-10">
          <form onSubmit={handleTrack} className="space-y-4 border border-neutral-200 p-6 sm:p-8">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700">
                {t.tracking.orderNumber}
              </label>
              <input
                type="text"
                dir="ltr"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="FAV-2026-000001"
                className="w-full border border-neutral-300 px-3.5 py-3 text-sm uppercase focus:border-black focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700">
                {t.tracking.phone}
              </label>
              <input
                type="tel"
                dir="ltr"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={searching}
              className="w-full bg-black text-white py-3.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {searching ? t.tracking.searching : t.tracking.submit}
            </button>
          </form>

          {notFound && (
            <div role="alert" className="border border-black p-6 text-sm font-medium">
              {t.tracking.notFound}
            </div>
          )}

          {result && (
            <div className="border border-neutral-200 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5" strokeWidth={1.6} />
                  <span className="font-mono-code font-bold text-base">
                    <Bdi>{result.orderNumber}</Bdi>
                  </span>
                </div>
                <span className="bg-black text-white px-3 py-1 text-xs font-semibold">
                  {t.orderStatuses[result.status] || result.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">{t.tracking.paymentLabel}</p>
                  <p className="font-medium mt-0.5">
                    {t.paymentStatuses[result.paymentStatus] || result.paymentStatus}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">{t.tracking.totalLabel}</p>
                  <p className="font-semibold mt-0.5 tabular-nums">
                    {formatMinorUnits(result.totalPiasters, locale)}
                  </p>
                </div>
                {result.trackingNumber && (
                  <div className="col-span-2">
                    <p className="text-xs text-neutral-500">{t.tracking.trackingCode}</p>
                    <p className="font-mono-code font-medium mt-0.5">
                      <Bdi>{result.trackingNumber}</Bdi>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-neutral-200 pt-5">
                <p className="text-xs font-semibold text-neutral-500">{t.tracking.timelineTitle}</p>
                <div className="space-y-3">
                  {(result.statusTimeline || []).map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs border-s-2 border-black ps-3 py-1">
                      <span className="font-semibold">
                        {t.orderStatuses[entry.status] || entry.status}
                      </span>
                      <span className="text-neutral-500 tabular-nums" dir="ltr">
                        {new Date(entry.at).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-EG')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
