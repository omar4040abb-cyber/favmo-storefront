import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { formatMinorUnits } from '../../lib/currency';
import {
  buildSalesSeries,
  buildTopSellingProducts,
  type AnalyticsGranularity,
} from '../../lib/adminAnalytics';
import type { Order, OrderStatus, PaymentMethod, Product } from '../../types/domain';

interface AdminAnalyticsPanelProps {
  orders: Order[];
  products: Product[];
}

export function AdminAnalyticsPanel({ orders, products }: AdminAnalyticsPanelProps) {
  const { locale, t } = useLocale();
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('monthly');

  const summary = useMemo(() => {
    const validOrders = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'refunded' && o.status !== 'returned'
    );
    const totalRevenue = validOrders.reduce((s, o) => s + (o.totalPiasters || 0), 0);
    const avgOrderValue = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

    const byPayment = new Map<PaymentMethod, { count: number; revenue: number }>();
    for (const o of validOrders) {
      const cur = byPayment.get(o.paymentMethod) || { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += o.totalPiasters || 0;
      byPayment.set(o.paymentMethod, cur);
    }

    const byStatus = new Map<OrderStatus, number>();
    for (const o of orders) {
      byStatus.set(o.status, (byStatus.get(o.status) || 0) + 1);
    }

    return {
      totalRevenue,
      validOrdersCount: validOrders.length,
      avgOrderValue,
      byPayment: Array.from(byPayment.entries()),
      byStatus: Array.from(byStatus.entries()),
    };
  }, [orders]);

  const series = useMemo(
    () => buildSalesSeries(orders, granularity, locale),
    [orders, granularity, locale]
  );

  const maxRevenue = useMemo(
    () => Math.max(1, ...series.map((b) => b.revenuePiasters)),
    [series]
  );

  const topProducts = useMemo(() => buildTopSellingProducts(orders, products), [orders, products]);

  const handleExportCsv = () => {
    const rows = [
      ['Period', 'Orders', 'Revenue (EGP)'],
      ...series.map((b) => [b.label, String(b.ordersCount), (b.revenuePiasters / 100).toFixed(2)]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `favmo-analytics-${granularity}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 p-5 space-y-1.5">
          <p className="text-xs text-neutral-500">{t.admin.metrics.totalSales}</p>
          <p className="text-2xl font-semibold tabular-nums text-black">
            {formatMinorUnits(summary.totalRevenue, locale)}
          </p>
        </div>
        <div className="bg-white border border-neutral-200 p-5 space-y-1.5">
          <p className="text-xs text-neutral-500">{t.admin.metrics.totalOrders}</p>
          <p className="text-2xl font-semibold tabular-nums text-black">
            {summary.validOrdersCount}
          </p>
        </div>
        <div className="bg-white border border-neutral-200 p-5 space-y-1.5">
          <p className="text-xs text-neutral-500">{t.admin.analytics.averageOrderValue}</p>
          <p className="text-2xl font-semibold tabular-nums text-black">
            {formatMinorUnits(summary.avgOrderValue, locale)}
          </p>
        </div>
      </div>

      {/* Period Filter & Chart */}
      <section className="bg-white border border-neutral-200 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
          <h2 className="text-sm font-semibold text-black">{t.admin.metrics.salesAnalytics}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center border border-neutral-200 divide-x divide-neutral-200 rtl:divide-x-reverse">
              {(['daily', 'weekly', 'monthly', 'yearly'] as AnalyticsGranularity[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    granularity === g
                      ? 'bg-black text-white'
                      : 'bg-white text-neutral-600 hover:text-black'
                  }`}
                >
                  {t.admin.analytics[g]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 border border-black px-3.5 py-1.5 text-xs font-semibold hover:bg-black hover:text-white transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.admin.analytics.exportCsv}</span>
            </button>
          </div>
        </div>

        <div className="h-64 flex items-end gap-2 pt-4 pb-2 border-b border-neutral-200">
          {series.map((b) => {
            const pct = Math.max(
              b.revenuePiasters > 0 ? 6 : 2,
              Math.round((b.revenuePiasters / maxRevenue) * 100)
            );
            return (
              <div key={b.key} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
                <span className="text-[10px] text-neutral-500 tabular-nums">
                  {b.ordersCount > 0 ? b.ordersCount : ''}
                </span>
                <div
                  className={`w-full max-w-[36px] ${
                    b.revenuePiasters > 0 ? 'bg-black' : 'bg-neutral-200'
                  }`}
                  style={{ height: `${pct}%` }}
                  title={`${b.label}: ${formatMinorUnits(b.revenuePiasters, locale)} (${b.ordersCount})`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500 tabular-nums">
          {series.map((b, idx) => (
            <span
              key={b.key}
              className={`flex-1 text-center truncate ${
                series.length > 10 && idx % 2 === 1 ? 'hidden sm:block' : ''
              }`}
            >
              {b.label}
            </span>
          ))}
        </div>

        {/* Tabular Breakdown for Selected Timeframe */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="py-2.5 text-start font-medium">
                  {locale === 'ar' ? 'الفترة' : 'Period'}
                </th>
                <th className="py-2.5 text-end font-medium">{t.admin.analytics.ordersCount}</th>
                <th className="py-2.5 text-end font-medium">{t.admin.analytics.revenue}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {series.map((b) => (
                <tr key={b.key}>
                  <td className="py-2.5 font-medium text-black">{b.label}</td>
                  <td className="py-2.5 text-end tabular-nums text-neutral-700">{b.ordersCount}</td>
                  <td className="py-2.5 text-end tabular-nums font-semibold text-black">
                    {formatMinorUnits(b.revenuePiasters, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Breakdown by Payment Method & Status + Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-neutral-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-black border-b border-neutral-200 pb-3">
            {t.admin.analytics.paymentBreakdown}
          </h2>
          {summary.byPayment.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4">{t.admin.metrics.noDataYet}</p>
          ) : (
            <div className="divide-y divide-neutral-100 text-xs">
              {summary.byPayment.map(([method, data]) => (
                <div key={method} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-black">{t.paymentMethods[method]}</p>
                    <p className="text-neutral-500 tabular-nums">
                      {data.count} {t.admin.analytics.ordersCount}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-black">
                    {formatMinorUnits(data.revenue, locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-neutral-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-black border-b border-neutral-200 pb-3">
            {t.admin.metrics.salesByStatus}
          </h2>
          {summary.byStatus.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4">{t.admin.metrics.noDataYet}</p>
          ) : (
            <div className="space-y-3 text-xs">
              {summary.byStatus.map(([st, count]) => {
                const pct = Math.round((count / Math.max(1, orders.length)) * 100);
                return (
                  <div key={st} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-neutral-700">{t.orderStatuses[st] || st}</span>
                      <span className="tabular-nums font-semibold text-black">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <progress
                      value={pct}
                      max={100}
                      className="w-full h-1.5 accent-black bg-neutral-200 block"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Top Selling Products Table */}
      <section className="bg-white border border-neutral-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-black border-b border-neutral-200 pb-3">
          {t.admin.metrics.topSellingProducts}
        </h2>
        {topProducts.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4">{t.admin.metrics.noDataYet}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="py-2.5 text-start font-medium">
                    {locale === 'ar' ? 'المنتج' : 'Product'}
                  </th>
                  <th className="py-2.5 text-end font-medium">{t.admin.analytics.unitsSold}</th>
                  <th className="py-2.5 text-end font-medium">{t.admin.analytics.revenue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {topProducts.map((row) => (
                  <tr key={row.productId}>
                    <td className="py-3 font-semibold text-black">
                      {locale === 'ar' ? row.name_ar : row.name_en}
                    </td>
                    <td className="py-3 text-end tabular-nums">{row.unitsSold}</td>
                    <td className="py-3 text-end tabular-nums font-semibold">
                      {formatMinorUnits(row.revenuePiasters, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
