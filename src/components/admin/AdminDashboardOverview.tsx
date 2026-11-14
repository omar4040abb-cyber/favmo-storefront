import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { formatMinorUnits } from '../../lib/currency';
import {
  buildSalesSeries,
  buildTopSellingProducts,
  computeThirtyDayDelta,
  formatShortDate,
  summarizeProductStock,
  type AdminNavigateFn,
  type AnalyticsGranularity,
} from '../../lib/adminAnalytics';
import type { Order, Product, ProductVariant } from '../../types/domain';
import { Bdi } from '../Bdi';

interface AdminDashboardOverviewProps {
  products: Product[];
  variants: ProductVariant[];
  orders: Order[];
  customersCount: number;
  onNavigate: AdminNavigateFn;
}

export function AdminDashboardOverview({
  products,
  variants,
  orders,
  customersCount,
  onNavigate,
}: AdminDashboardOverviewProps) {
  const { locale, t } = useLocale();
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('daily');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const metrics = useMemo(() => {
    const validOrders = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'refunded' && o.status !== 'returned'
    );
    const totalSalesPiasters = validOrders.reduce((sum, o) => sum + (o.totalPiasters || 0), 0);
    const pendingOrders = orders.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'processing'
    ).length;
    const completedOrders = orders.filter((o) => o.status === 'delivered').length;

    const stockSummary = summarizeProductStock(products, variants);
    const revenueDelta = computeThirtyDayDelta(orders, 'revenue');
    const ordersDelta = computeThirtyDayDelta(orders, 'orders');

    return {
      totalSalesPiasters,
      totalOrders: orders.length,
      totalProducts: products.length,
      totalCustomers: customersCount,
      pendingOrders,
      completedOrders,
      lowStockProductsCount: stockSummary.lowStockProducts.length,
      outOfStockProductsCount: stockSummary.outOfStockProducts.length,
      lowStockProducts: stockSummary.lowStockProducts,
      outOfStockProducts: stockSummary.outOfStockProducts,
      revenueDelta,
      ordersDelta,
    };
  }, [products, variants, orders, customersCount]);

  const series = useMemo(
    () => buildSalesSeries(orders, granularity, locale),
    [orders, granularity, locale]
  );

  const maxRevenue = useMemo(
    () => Math.max(1, ...series.map((b) => b.revenuePiasters)),
    [series]
  );

  const topSelling = useMemo(() => buildTopSellingProducts(orders, products), [orders, products]);
  const recentOrders = orders.slice(0, 7);

  const kpiCards: Array<{
    label: string;
    value: string | number;
    delta?: number | null;
    icon: typeof DollarSign;
    tab?: Parameters<AdminNavigateFn>[0];
    emphasis?: 'default' | 'warn' | 'alert';
  }> = [
    {
      label: t.admin.metrics.totalSales,
      value: formatMinorUnits(metrics.totalSalesPiasters, locale),
      delta: metrics.revenueDelta,
      icon: DollarSign,
      tab: 'analytics',
    },
    {
      label: t.admin.metrics.totalOrders,
      value: metrics.totalOrders,
      delta: metrics.ordersDelta,
      icon: ShoppingBag,
      tab: 'orders',
    },
    {
      label: t.admin.metrics.totalProducts,
      value: metrics.totalProducts,
      icon: Package,
      tab: 'products',
    },
    {
      label: t.admin.metrics.totalCustomers,
      value: metrics.totalCustomers,
      icon: Users,
      tab: 'customers',
    },
    {
      label: t.admin.metrics.pendingOrders,
      value: metrics.pendingOrders,
      icon: Clock,
      tab: 'orders',
    },
    {
      label: t.admin.metrics.completedOrders,
      value: metrics.completedOrders,
      icon: CheckCircle2,
      tab: 'orders',
    },
    {
      label: t.admin.metrics.lowStockVariants,
      value: metrics.lowStockProductsCount,
      icon: AlertTriangle,
      tab: 'inventory',
      emphasis: metrics.lowStockProductsCount > 0 ? 'warn' : 'default',
    },
    {
      label: t.admin.metrics.outOfStockVariants,
      value: metrics.outOfStockProductsCount,
      icon: Boxes,
      tab: 'inventory',
      emphasis: metrics.outOfStockProductsCount > 0 ? 'alert' : 'default',
    },
  ];

  const hasSalesActivity = series.some((b) => b.revenuePiasters > 0 || b.ordersCount > 0);
  const inventoryAlertList = [
    ...metrics.outOfStockProducts.map((item) => ({ ...item, type: 'out' as const })),
    ...metrics.lowStockProducts.map((item) => ({ ...item, type: 'low' as const })),
  ].slice(0, 6);

  return (
    <div className="space-y-6">
      {/* 8 Real-Time KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => card.tab && onNavigate(card.tab)}
              className="group text-start bg-white border border-neutral-200 hover:border-black transition-colors p-5 flex flex-col justify-between gap-4 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-neutral-500">{card.label}</span>
                <span className="w-8 h-8 border border-neutral-200 flex items-center justify-center text-neutral-700 group-hover:bg-black group-hover:text-white group-hover:border-black transition-colors">
                  <Icon className="w-4 h-4" strokeWidth={1.6} />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-2xl font-semibold tabular-nums tracking-tight ${
                    card.emphasis === 'alert'
                      ? 'text-red-700'
                      : card.emphasis === 'warn'
                        ? 'text-amber-700'
                        : 'text-black'
                  }`}
                >
                  {card.value}
                </span>
                {card.delta !== undefined && card.delta !== null && (
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      card.delta >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {card.delta >= 0 ? `+${card.delta}%` : `${card.delta}%`}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Sales Analytics Chart + Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white border border-neutral-200 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-black">{t.admin.metrics.salesAnalytics}</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {locale === 'ar'
                  ? 'بيانات الإيرادات والطلبات المستخرجة مباشرة من قاعدة البيانات'
                  : 'Live revenue & order volume derived from Firestore orders'}
              </p>
            </div>
            <div className="flex items-center border border-neutral-200 divide-x divide-neutral-200 rtl:divide-x-reverse">
              {(['daily', 'weekly', 'monthly', 'yearly'] as AnalyticsGranularity[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    granularity === g ? 'bg-black text-white' : 'bg-white text-neutral-600 hover:text-black'
                  }`}
                >
                  {t.admin.analytics[g]}
                </button>
              ))}
            </div>
          </div>

          {!hasSalesActivity ? (
            <div className="h-56 flex flex-col items-center justify-center border border-dashed border-neutral-200 text-center px-4 space-y-2">
              <p className="text-xs font-medium text-neutral-600">{t.admin.metrics.noDataYet}</p>
              <p className="text-[11px] text-neutral-400">
                {locale === 'ar'
                  ? 'ستظهر المخططات البيانية فور تسجيل أول طلب في المتجر.'
                  : 'Revenue bars will render automatically once customer orders are recorded.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-56 flex items-end gap-2 pt-6 pb-2 border-b border-neutral-200">
                {series.map((bucket, idx) => {
                  const pct = Math.max(
                    bucket.revenuePiasters > 0 ? 6 : 2,
                    Math.round((bucket.revenuePiasters / maxRevenue) * 100)
                  );
                  const active = hoverIdx === idx;
                  return (
                    <div
                      key={bucket.key}
                      onMouseEnter={() => setHoverIdx(idx)}
                      onMouseLeave={() => setHoverIdx(null)}
                      className="flex-1 h-full flex flex-col justify-end items-center group relative"
                    >
                      {active && (
                        <div className="absolute -top-2 z-10 bg-black text-white px-2.5 py-1.5 text-[10px] whitespace-nowrap pointer-events-none shadow-sm">
                          <div className="font-semibold">{bucket.label}</div>
                          <div className="tabular-nums">
                            {formatMinorUnits(bucket.revenuePiasters, locale)} · {bucket.ordersCount}{' '}
                            {t.admin.analytics.ordersCount}
                          </div>
                        </div>
                      )}
                      <div
                        className={`w-full max-w-[34px] transition-colors ${
                          bucket.revenuePiasters > 0
                            ? active
                              ? 'bg-neutral-700'
                              : 'bg-black'
                            : 'bg-neutral-200'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500 tabular-nums overflow-hidden">
                {series.map((bucket, idx) => (
                  <span
                    key={bucket.key}
                    className={`flex-1 text-center truncate ${
                      series.length > 10 && idx % 2 === 1 ? 'hidden sm:block' : ''
                    }`}
                  >
                    {bucket.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Top Selling Products */}
        <section className="lg:col-span-4 bg-white border border-neutral-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
            <h2 className="text-sm font-semibold text-black">{t.admin.metrics.topSellingProducts}</h2>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-xs text-neutral-500 hover:text-black inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t.collectionSection.viewAll}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {topSelling.length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 text-center">{t.admin.metrics.noDataYet}</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {topSelling.map((row) => (
                <div key={row.productId} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-11 bg-neutral-100 border border-neutral-200 shrink-0 overflow-hidden">
                      {row.imageUrl && (
                        <img
                          src={row.imageUrl}
                          alt={locale === 'ar' ? row.name_ar : row.name_en}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-black truncate">
                        {locale === 'ar' ? row.name_ar : row.name_en}
                      </p>
                      <p className="text-[11px] text-neutral-500 tabular-nums">
                        {row.unitsSold} {t.admin.analytics.unitsSold}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-black shrink-0">
                    {formatMinorUnits(row.revenuePiasters, locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Orders + Inventory Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Orders Table */}
        <section className="lg:col-span-8 bg-white border border-neutral-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
            <h2 className="text-sm font-semibold text-black">{t.admin.metrics.recentOrders}</h2>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="text-xs text-neutral-500 hover:text-black inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t.admin.tabs.orders}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 text-center">{t.admin.metrics.noDataYet}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="py-2.5 pe-3 text-start font-medium">#</th>
                    <th className="py-2.5 px-3 text-start font-medium">{t.checkout.fullName}</th>
                    <th className="py-2.5 px-3 text-start font-medium">
                      {locale === 'ar' ? 'التاريخ' : 'Date'}
                    </th>
                    <th className="py-2.5 px-3 text-start font-medium">{t.tracking.paymentLabel}</th>
                    <th className="py-2.5 px-3 text-start font-medium">{t.tracking.statusLabel}</th>
                    <th className="py-2.5 px-3 text-end font-medium">{t.cart.total}</th>
                    <th className="py-2.5 ps-3 text-end font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {recentOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-neutral-50">
                      <td className="py-3 pe-3 font-mono-code font-semibold text-black">
                        <Bdi>{ord.orderNumber}</Bdi>
                      </td>
                      <td className="py-3 px-3 text-neutral-800">
                        {ord.shippingAddress?.fullName || '—'}
                      </td>
                      <td className="py-3 px-3 text-neutral-500 tabular-nums whitespace-nowrap">
                        {formatShortDate(ord.createdAt, locale)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block border px-2 py-0.5 text-[11px] font-medium ${
                            ord.paymentStatus === 'paid'
                              ? 'border-emerald-700/30 bg-emerald-50 text-emerald-800'
                              : ord.paymentStatus === 'failed' || ord.paymentStatus === 'rejected'
                                ? 'border-red-700/30 bg-red-50 text-red-800'
                                : 'border-neutral-300 bg-neutral-50 text-neutral-700'
                          }`}
                        >
                          {t.paymentStatuses[ord.paymentStatus] || ord.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-800">
                          {t.orderStatuses[ord.status] || ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-end tabular-nums font-semibold text-black whitespace-nowrap">
                        {formatMinorUnits(ord.totalPiasters, locale)}
                      </td>
                      <td className="py-3 ps-3 text-end">
                        <button
                          type="button"
                          onClick={() => onNavigate('orders', { orderId: ord.id })}
                          className="text-[11px] font-semibold underline text-black hover:text-neutral-600 cursor-pointer whitespace-nowrap"
                        >
                          {t.admin.actions.viewDetails}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Inventory Alerts Panel */}
        <section className="lg:col-span-4 bg-white border border-neutral-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
            <h2 className="text-sm font-semibold text-black">{t.admin.metrics.inventoryAlerts}</h2>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs text-neutral-500 hover:text-black inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t.admin.tabs.inventory}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {inventoryAlertList.length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 text-center">
              {locale === 'ar'
                ? 'جميع مستويات المخزون الحالية سليمة.'
                : 'All active products have healthy stock levels.'}
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {inventoryAlertList.map((item) => (
                <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-black truncate">
                      {locale === 'ar' ? item.product.name_ar : item.product.name_en}
                    </p>
                    <p className="text-[11px] text-neutral-500 tabular-nums">
                      {locale === 'ar' ? 'المتبقي:' : 'Total stock:'} {item.totalStock}
                    </p>
                  </div>
                  <span
                    className={`border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                      item.type === 'out'
                        ? 'border-red-700/30 bg-red-50 text-red-800'
                        : 'border-amber-700/30 bg-amber-50 text-amber-900'
                    }`}
                  >
                    {item.type === 'out' ? t.badges.soldOut : t.badges.lowStock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
