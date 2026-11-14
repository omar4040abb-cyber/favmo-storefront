import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { formatMinorUnits } from '../../lib/currency';
import { formatShortDate } from '../../lib/adminAnalytics';
import type { CustomerSummary, Order } from '../../types/domain';
import { Bdi } from '../Bdi';

interface AdminCustomersPanelProps {
  customers: CustomerSummary[];
  orders: Order[];
  initialSearch?: string;
}

const PAGE_SIZE = 12;

export function AdminCustomersPanel({
  customers,
  orders,
  initialSearch = '',
}: AdminCustomersPanelProps) {
  const { locale, t } = useLocale();
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const aggregated = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        email?: string;
        phone?: string;
        createdAt?: unknown;
        orders: Order[];
        totalSpentPiasters: number;
      }
    >();

    for (const c of customers) {
      map.set(c.uid, {
        key: c.uid,
        name: c.displayName,
        email: c.email,
        phone: c.phone,
        createdAt: c.createdAt,
        orders: [],
        totalSpentPiasters: 0,
      });
    }

    for (const ord of orders) {
      const key = ord.userId || `guest:${ord.shippingAddress?.phone || ord.id}`;
      const existing = map.get(key) || {
        key,
        name: ord.shippingAddress?.fullName || 'Guest',
        email: ord.shippingAddress?.email,
        phone: ord.shippingAddress?.phone,
        createdAt: ord.createdAt,
        orders: [],
        totalSpentPiasters: 0,
      };
      existing.orders.push(ord);
      if (ord.status !== 'cancelled' && ord.status !== 'refunded' && ord.status !== 'returned') {
        existing.totalSpentPiasters += ord.totalPiasters || 0;
      }
      map.set(key, existing);
    }

    const q = search.trim().toLowerCase();
    return Array.from(map.values())
      .filter((c) => {
        if (!q) return true;
        return `${c.name} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.totalSpentPiasters - a.totalSpentPiasters);
  }, [customers, orders, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(aggregated.length / PAGE_SIZE));
  const paginated = useMemo(
    () => aggregated.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [aggregated, page]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.admin.actions.searchPlaceholder}
          className="border border-neutral-300 bg-white px-3.5 py-2 text-xs text-black placeholder:text-neutral-400 w-full sm:w-72 focus:border-black focus:outline-none"
        />
        <span className="text-xs text-neutral-500 tabular-nums">
          {aggregated.length} {t.admin.tabs.customers}
        </span>
      </div>

      {aggregated.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-500">
          {t.admin.metrics.noDataYet}
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white divide-y divide-neutral-200">
          {paginated.map((c) => {
            const isOpen = expandedKey === c.key;
            return (
              <div key={c.key} className="p-5 space-y-3 hover:bg-neutral-50/70 transition-colors">
                <button
                  type="button"
                  onClick={() => setExpandedKey(isOpen ? null : c.key)}
                  className="w-full flex flex-wrap items-center justify-between gap-4 text-start cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-semibold text-black">{c.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5" dir="ltr">
                      {c.email || '—'} {c.phone ? `· ${c.phone}` : ''}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1 tabular-nums">
                      {locale === 'ar' ? 'تاريخ التسجيل:' : 'Registered:'}{' '}
                      {formatShortDate(c.createdAt, locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    <span className="text-neutral-600 tabular-nums">
                      {c.orders.length} {t.admin.metrics.totalOrders}
                    </span>
                    <span className="font-semibold tabular-nums text-black">
                      {formatMinorUnits(c.totalSpentPiasters, locale)}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-neutral-200 pt-3 space-y-2 text-xs">
                    {c.orders.length === 0 ? (
                      <p className="text-neutral-500">{t.account.noOrders}</p>
                    ) : (
                      c.orders.map((ord) => (
                        <div key={ord.id} className="flex justify-between text-neutral-700">
                          <span className="font-mono-code">
                            <Bdi>{ord.orderNumber}</Bdi> — {t.orderStatuses[ord.status] || ord.status}{' '}
                            · {formatShortDate(ord.createdAt, locale)}
                          </span>
                          <span className="tabular-nums font-semibold text-black">
                            {formatMinorUnits(ord.totalPiasters, locale)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="px-5 py-3 flex items-center justify-between text-xs text-neutral-600 bg-neutral-50">
              <span className="tabular-nums">
                {page} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 border border-neutral-300 bg-white px-3 py-1.5 disabled:opacity-40 hover:border-black cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  <span>{t.admin.actions.prevPage}</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 border border-neutral-300 bg-white px-3 py-1.5 disabled:opacity-40 hover:border-black cursor-pointer"
                >
                  <span>{t.admin.actions.nextPage}</span>
                  <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
